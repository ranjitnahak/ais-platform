import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { canonicalFullName } from '../lib/athleteName';
import { normalizeGenderForDb, normalizePositionForDb } from '../lib/athleteProfileFields';
import { setUserActive } from '../lib/adminUserActions';
import { STAFF_ROLE_DB_NAME, STAFF_ROLE_ENUM, USER_ROLE_DISPLAY } from '../lib/adminUserConstants';
import { resolveGroupIdsForTeams, resolveTeamIdsForGroups } from '../lib/teamGroups';

async function loadTeamsForOrg(orgId) {
  const actor = await getCurrentUser();
  if (actor?.isSuperuser && orgId && actor.allTeams?.length) {
    const cached = actor.allTeams
      .filter((team) => team.org_id === orgId)
      .map((team) => ({ id: team.id, name: team.name, sport: team.sport ?? null, gender: team.gender ?? null }));
    if (cached.length) return cached;
  }

  let query = supabase.from('teams').select('id, name, sport, gender').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

const EMPTY_ATHLETE = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  position: '',
  jersey_number: '',
  email: '',
  phone: '',
  emergency_contact_phone: '',
  blood_group: '',
  address: '',
};

function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' };
}

function roleLabelFromUser(userRow, userRoleRow) {
  const joined = Array.isArray(userRoleRow?.roles) ? userRoleRow.roles[0] : userRoleRow?.roles;
  const name = joined?.name ?? userRow?.role;
  if (!name) return '';
  const key = String(name).trim().toLowerCase();
  return USER_ROLE_DISPLAY[key] ?? name;
}

function roleLabelToDbName(label) {
  return STAFF_ROLE_DB_NAME[label] ?? label;
}

async function resolveStaffRoleId(orgId, userRow, userRoleRows, roleLabel) {
  const primary = userRoleRows?.[0];
  if (primary?.role_id) return primary.role_id;

  const candidates = [
    roleLabel ? roleLabelToDbName(roleLabel) : null,
    userRow?.role ? String(userRow.role) : null,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  if (!candidates.length) return null;

  const { data: roleRows, error } = await supabase
    .from('roles')
    .select('id, name')
    .eq('org_id', orgId);
  if (error) throw error;

  const match = (roleRows ?? []).find((row) =>
    candidates.includes(String(row.name).trim().toLowerCase()),
  );
  return match?.id ?? null;
}

async function uploadPhoto(blob, fileName, folder) {
  const path = `${folder}/${Date.now()}-${fileName}`;
  const { error: uploadErr } = await supabase.storage
    .from('Athletes')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (uploadErr) throw uploadErr;
  const { data: urlData } = supabase.storage.from('Athletes').getPublicUrl(path);
  return urlData?.publicUrl ?? null;
}

async function syncAthleteTeams(athleteId, selectedTeamIds) {
  const { data: existing, error } = await supabase
    .from('athlete_teams')
    .select('team_id')
    .eq('athlete_id', athleteId);
  if (error) throw error;

  const existingIds = (existing ?? []).map((row) => row.team_id);
  const toAdd = selectedTeamIds.filter((id) => !existingIds.includes(id));
  const toRemove = existingIds.filter((id) => !selectedTeamIds.includes(id));

  if (toRemove.length) {
    const { data: deletedRows, error: delErr } = await supabase
      .from('athlete_teams')
      .delete()
      .eq('athlete_id', athleteId)
      .in('team_id', toRemove)
      .select('team_id');
    if (delErr) throw delErr;
    if ((deletedRows ?? []).length < toRemove.length) {
      throw new Error('Team unassignment was blocked. Check organisation access and try again.');
    }
  }
  if (toAdd.length) {
    const rows = toAdd.map((teamId) => ({
      athlete_id: athleteId,
      team_id: teamId,
      joined_at: new Date().toISOString(),
    }));
    const { error: insErr } = await supabase.from('athlete_teams').insert(rows);
    if (insErr) throw insErr;
  }
}

async function syncStaffTeams(orgId, userId, roleId, selectedTeamIds) {
  if (!roleId) throw new Error('Staff role is not configured for this user.');

  const { error: delErr } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', orgId);
  if (delErr) throw delErr;

  if (!selectedTeamIds.length) {
    const { error: insErr } = await supabase.from('user_roles').insert({
      org_id: orgId,
      user_id: userId,
      role_id: roleId,
      group_id: null,
    });
    if (insErr) throw insErr;
    return;
  }

  const groupIds = await resolveGroupIdsForTeams(orgId, selectedTeamIds);
  const rows = groupIds.map((groupId) => ({
    org_id: orgId,
    user_id: userId,
    role_id: roleId,
    group_id: groupId,
  }));
  const { error: insErr } = await supabase.from('user_roles').insert(rows);
  if (insErr) throw insErr;
}

export function useUserProfilePanel({ target, activeOrgId, onUpdated }) {
  const isStaff = target?.kind === 'staff';
  const isAthlete = !isStaff;
  const orgId = target?.orgId ?? target?.org_id ?? activeOrgId;
  const userId = target?.userId ?? null;
  const athleteId = target?.athleteId ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [athleteForm, setAthleteForm] = useState(EMPTY_ATHLETE);
  const [staffForm, setStaffForm] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '', roleLabel: '' });
  const [roleId, setRoleId] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  const load = useCallback(async () => {
    if (!target || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const [{ data: roleRows, error: rolesError }, teamRows] = await Promise.all([
        orgId
          ? supabase.from('roles').select('id, name').eq('org_id', orgId).order('name')
          : Promise.resolve({ data: [], error: null }),
        loadTeamsForOrg(orgId),
      ]);
      if (rolesError) throw rolesError;
      setAvailableRoles(roleRows ?? []);
      setTeams(teamRows);

      if (isStaff && userId) {
        const [{ data, error: userError }, { data: userRoleRows, error: userRolesError }] = await Promise.all([
          supabase
            .from('users')
            .select('id, full_name, email, phone, title, role, photo_url, is_active')
            .eq('id', userId)
            .eq('org_id', orgId)
            .single(),
          supabase
            .from('user_roles')
            .select('role_id, group_id, roles(name)')
            .eq('user_id', userId)
            .eq('org_id', orgId),
        ]);
        if (userError) throw userError;
        if (userRolesError) throw userRolesError;
        const names = splitFullName(data.full_name);
        const primaryRole = userRoleRows?.[0];
        const roleLabel = roleLabelFromUser(data, primaryRole);
        const resolvedRoleId = await resolveStaffRoleId(orgId, data, userRoleRows, roleLabel);
        const staffGroupIds = [...new Set((userRoleRows ?? []).map((r) => r.group_id).filter(Boolean))];
        const staffTeamIds = await resolveTeamIdsForGroups(orgId, staffGroupIds);
        setSelectedTeamIds(staffTeamIds);
        setRoleId(resolvedRoleId);
        setStaffForm({
          first_name: names.first_name,
          last_name: names.last_name,
          email: data.email ?? '',
          phone: data.phone ?? '',
          title: data.title ?? '',
          roleLabel,
        });
        setPhotoUrl(data.photo_url ?? null);
        setPhotoPreview(data.photo_url ?? null);
        setIsActive(Boolean(data.is_active));
        return;
      }

      if (isAthlete && athleteId) {
        const { data, error: athleteError } = await supabase
          .from('athletes')
          .select('id, first_name, last_name, date_of_birth, gender, position, jersey_number, email, phone, emergency_contact_phone, blood_group, address, photo_url, is_active')
          .eq('id', athleteId)
          .eq('org_id', orgId)
          .single();
        if (athleteError) throw athleteError;
        setAthleteForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          date_of_birth: data.date_of_birth ?? '',
          gender: data.gender ?? '',
          position: data.position ?? '',
          jersey_number: data.jersey_number ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          emergency_contact_phone: data.emergency_contact_phone ?? '',
          blood_group: data.blood_group ?? '',
          address: data.address ?? '',
        });
        setPhotoUrl(data.photo_url ?? null);
        setPhotoPreview(data.photo_url ?? null);
        setIsActive(Boolean(data.is_active));
        const { data: athleteTeamRows, error: athleteTeamsError } = await supabase
          .from('athlete_teams')
          .select('team_id')
          .eq('athlete_id', athleteId);
        if (athleteTeamsError) throw athleteTeamsError;
        const athleteTeamIds = (athleteTeamRows ?? []).map((r) => r.team_id);
        setSelectedTeamIds(athleteTeamIds);
      }
    } catch (err) {
      console.error('[useUserProfilePanel] load', err);
      setError('Could not load user profile.');
    } finally {
      setLoading(false);
    }
  }, [target, orgId, isStaff, isAthlete, userId, athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  function setAthleteField(field, value) {
    setAthleteForm((prev) => ({ ...prev, [field]: value }));
  }

  function setStaffField(field, value) {
    setStaffForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTeam(teamId) {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  }

  function handlePhotoChange(file) {
    setPendingFile(file);
  }

  function handleCropCancel() {
    setPendingFile(null);
  }

  function handleCropDone(blob) {
    setPendingFile(null);
    setPhotoBlob(blob);
    setPhotoName(pendingFile?.name?.replace(/\s+/g, '_') ?? 'photo.jpg');
    setPhotoPreview(URL.createObjectURL(blob));
  }

  async function saveProfile() {
    if (!orgId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      let nextPhotoUrl = photoUrl;
      if (photoBlob) {
        const folder = isStaff ? `staff/${userId ?? 'new'}` : athleteId;
        nextPhotoUrl = await uploadPhoto(photoBlob, photoName || 'photo.jpg', folder);
      }

      if (isStaff && userId) {
        if (!staffForm.first_name.trim()) throw new Error('First name is required.');
        const first_name = staffForm.first_name.trim();
        const last_name = staffForm.last_name.trim();
        const full_name = canonicalFullName(first_name, last_name);
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name,
            email: staffForm.email.trim() || null,
            phone: staffForm.phone.trim() || null,
            title: staffForm.title.trim() || null,
            ...(nextPhotoUrl ? { photo_url: nextPhotoUrl } : {}),
          })
          .eq('id', userId)
          .eq('org_id', orgId);
        if (updateError) throw updateError;
        const effectiveRoleId = roleId ?? await resolveStaffRoleId(
          orgId,
          { role: staffForm.roleLabel ? STAFF_ROLE_ENUM[staffForm.roleLabel] : null },
          null,
          staffForm.roleLabel,
        );
        if (!effectiveRoleId) {
          throw new Error('Could not resolve staff role for team assignment.');
        }
        await syncStaffTeams(orgId, userId, effectiveRoleId, selectedTeamIds);
        setRoleId(effectiveRoleId);
        if (nextPhotoUrl) setPhotoUrl(nextPhotoUrl);
        setSaveMsg({ type: 'success', text: 'Changes saved.' });
        await onUpdated?.();
        return;
      }

      if (isAthlete && athleteId) {
        if (!athleteForm.first_name.trim()) throw new Error('First name is required.');
        const first_name = athleteForm.first_name.trim();
        const last_name = athleteForm.last_name.trim();
        const full_name = canonicalFullName(first_name, last_name);
        const patch = {
          first_name,
          last_name: last_name || null,
          full_name,
          date_of_birth: athleteForm.date_of_birth || null,
          gender: normalizeGenderForDb(athleteForm.gender),
          position: normalizePositionForDb(athleteForm.position),
          jersey_number: athleteForm.jersey_number !== '' ? Number(athleteForm.jersey_number) : null,
          email: athleteForm.email.trim() || null,
          phone: athleteForm.phone.trim() || null,
          emergency_contact_phone: athleteForm.emergency_contact_phone?.trim() || null,
          blood_group: athleteForm.blood_group?.trim() || null,
          address: athleteForm.address?.trim() || null,
          ...(nextPhotoUrl ? { photo_url: nextPhotoUrl } : {}),
        };
        const { data: updatedAthleteRows, error: athleteError } = await supabase
          .from('athletes')
          .update(patch)
          .eq('id', athleteId)
          .eq('org_id', orgId)
          .select('id');
        if (athleteError) throw athleteError;
        if (!updatedAthleteRows?.length) {
          throw new Error('Save was blocked or no profile matched. Check organisation access and try again.');
        }

        if (userId) {
          const { error: userError } = await supabase
            .from('users')
            .update({ full_name, email: patch.email })
            .eq('id', userId)
            .eq('org_id', orgId);
          if (userError) console.error('[useUserProfilePanel] sync user name', userError);
        }
        await syncAthleteTeams(athleteId, selectedTeamIds);
        if (nextPhotoUrl) setPhotoUrl(nextPhotoUrl);
        setSaveMsg({ type: 'success', text: 'Changes saved.' });
        await onUpdated?.();
      }
    } catch (err) {
      console.error('[useUserProfilePanel] saveProfile', err);
      setSaveMsg({ type: 'error', text: err.message || 'Could not save changes.' });
    } finally {
      setSaving(false);
    }
  }

  async function deactivateUser() {
    if (!orgId) return;
    try {
      if (userId) {
        await setUserActive(orgId, userId, false);
      } else if (athleteId) {
        const { error } = await supabase
          .from('athletes')
          .update({ is_active: false })
          .eq('id', athleteId)
          .eq('org_id', orgId);
        if (error) throw error;
      }
      setIsActive(false);
      await onUpdated?.();
    } catch (err) {
      console.error('[useUserProfilePanel] deactivateUser', err);
      throw err;
    }
  }

  async function changeRole(nextRoleLabel) {
    if (!orgId || !userId || !isStaff) return;
    const roleDbName = roleLabelToDbName(nextRoleLabel);
    const roleEnum = STAFF_ROLE_ENUM[nextRoleLabel];
    if (!roleEnum) throw new Error('Invalid role selected.');

    const { data: roleRow, error: roleLookupErr } = await supabase
      .from('roles')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', roleDbName)
      .maybeSingle();
    if (roleLookupErr) throw roleLookupErr;
    if (!roleRow?.id) throw new Error('Role not found in organisation.');

    const { error: userUpdateErr } = await supabase
      .from('users')
      .update({ role: roleEnum })
      .eq('id', userId)
      .eq('org_id', orgId);
    if (userUpdateErr) throw userUpdateErr;

    const { data: existingRows, error: existingErr } = await supabase
      .from('user_roles')
      .select('id, group_id')
      .eq('user_id', userId)
      .eq('org_id', orgId);
    if (existingErr) throw existingErr;

    if (existingRows?.length) {
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update({ role_id: roleRow.id })
        .eq('user_id', userId)
        .eq('org_id', orgId);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase.from('user_roles').insert({
        org_id: orgId,
        user_id: userId,
        role_id: roleRow.id,
        group_id: null,
      });
      if (insertErr) throw insertErr;
    }

    setRoleId(roleRow.id);
    setStaffForm((prev) => ({ ...prev, roleLabel: nextRoleLabel }));
    await onUpdated?.();
  }

  return {
    loading,
    error,
    saving,
    saveMsg,
    isStaff,
    isAthlete,
    isActive,
    orgId,
    userId,
    athleteId,
    athleteForm,
    staffForm,
    availableRoles,
    roleId,
    teams,
    selectedTeamIds,
    toggleTeam,
    photoPreview,
    pendingFile,
    setAthleteField,
    setStaffField,
    handlePhotoChange,
    handleCropCancel,
    handleCropDone,
    saveProfile,
    deactivateUser,
    changeRole,
    reload: load,
  };
}
