import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { canonicalFullName } from '../lib/athleteName';
import { normalizeGenderForDb, normalizePositionForDb } from '../lib/athleteProfileFields';
import { STAFF_ROLE_DB_NAME, STAFF_ROLE_ENUM } from '../lib/adminUserConstants';
import { resolveGroupIdsForTeams } from '../lib/teamGroups';

async function resolveFunctionErrorMessage(fnError, fnData) {
  if (fnData?.error) return String(fnData.error);
  if (fnError?.context) {
    try {
      const body = await fnError.context.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch (_) {
      // fall back to base message
    }
  }
  return fnError?.message || 'Edge function request failed.';
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

const EMPTY_STAFF = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  roleLabel: '',
};

async function uploadPhoto(blob, fileName) {
  const path = `${Date.now()}-${fileName}`;
  const { error: uploadErr } = await supabase.storage
    .from('Athletes')
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (uploadErr) throw uploadErr;
  const { data: urlData } = supabase.storage.from('Athletes').getPublicUrl(path);
  return urlData?.publicUrl ?? null;
}

export function useAddUser({ onSuccess, onClose }) {
  const [path, setPath] = useState('athlete');
  const [athleteForm, setAthleteForm] = useState(EMPTY_ATHLETE);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [teams, setTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadTeams() {
      try {
        const user = await getCurrentUser();
        if (!user?.orgId) return;
        const { data, error: teamError } = await supabase
          .from('teams')
          .select('id, name, sport, gender')
          .eq('org_id', user.orgId)
          .order('name');
        if (teamError) throw teamError;
        if (mounted) setTeams(data ?? []);
      } catch (err) {
        console.error('[useAddUser] loadTeams', err);
      }
    }
    void loadTeams();
    return () => { mounted = false; };
  }, []);

  const setAthleteField = useCallback((field, value) => {
    setAthleteForm((f) => ({ ...f, [field]: value }));
  }, []);

  const setStaffField = useCallback((field, value) => {
    setStaffForm((f) => ({ ...f, [field]: value }));
  }, []);

  const toggleTeam = useCallback((teamId) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  }, []);

  const handlePhotoChange = useCallback((file) => {
    if (!file) return;
    setPendingFile(file);
  }, []);

  const handleCropDone = useCallback((blob) => {
    const sanitizedName = pendingFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    setPhotoBlob(blob);
    setPhotoName(sanitizedName);
    setPhotoPreview(URL.createObjectURL(blob));
    setPendingFile(null);
  }, [pendingFile]);

  const handleCropCancel = useCallback(() => setPendingFile(null), []);

  const insertAthleteTeams = async (athleteId, teamIds) => {
    if (!teamIds.length) return;
    const teamRows = teamIds.map((teamId) => ({
      athlete_id: athleteId,
      team_id: teamId,
      joined_at: new Date().toISOString(),
    }));
    const { error: teamErr } = await supabase.from('athlete_teams').insert(teamRows);
    if (teamErr) throw teamErr;
  };

  const assignStaffTeams = async (orgId, userId, roleId, teamIds) => {
    if (!roleId) return;
    if (!teamIds.length) {
      const { error: roleErr } = await supabase.from('user_roles').insert({
        org_id: orgId,
        user_id: userId,
        role_id: roleId,
        group_id: null,
      });
      if (roleErr) console.error('[useAddUser] staff team assignment', roleErr);
      return;
    }
    const groupIds = await resolveGroupIdsForTeams(orgId, teamIds);
    const rows = groupIds.map((groupId) => ({
      org_id: orgId,
      user_id: userId,
      role_id: roleId,
      group_id: groupId,
    }));
    const { error: roleErr } = await supabase.from('user_roles').insert(rows);
    if (roleErr) console.error('[useAddUser] staff team assignment', roleErr);
  };

  const submitAthlete = async (user) => {
    if (!athleteForm.first_name.trim()) throw new Error('First name is required.');
    if (!athleteForm.email.trim()) throw new Error('Email is required.');
    if (!athleteForm.date_of_birth) throw new Error('Date of birth is required.');
    if (!athleteForm.gender) throw new Error('Gender is required.');
    if (!athleteForm.position) throw new Error('Position is required.');

    let photo_url = null;
    if (photoBlob) photo_url = await uploadPhoto(photoBlob, photoName);

    const first_name = athleteForm.first_name.trim();
    const last_name = athleteForm.last_name.trim();
    const emailValue = athleteForm.email.trim();

    const { data: existingUserRows, error: existingUserErr } = await supabase
      .from('users')
      .select('id, org_id, role, athlete_id')
      .ilike('email', emailValue)
      .limit(5);
    if (existingUserErr) throw existingUserErr;
    const existingUserByEmail = Array.isArray(existingUserRows) ? existingUserRows[0] ?? null : null;
    if (existingUserByEmail?.org_id && existingUserByEmail.org_id !== user.orgId) {
      throw new Error('This email is already linked to an athlete account in another organisation. Use a different email.');
    }

    const { data: existingAthleteRows, error: existingAthleteErr } = await supabase
      .from('athletes')
      .select('id, org_id, auth_id')
      .eq('org_id', user.orgId)
      .ilike('email', emailValue)
      .order('created_at', { ascending: false })
      .limit(10);
    if (existingAthleteErr) throw existingAthleteErr;
    const existingAthleteByEmail = Array.isArray(existingAthleteRows) ? existingAthleteRows[0] ?? null : null;
    if ((existingAthleteRows ?? []).length > 1) {
      throw new Error('Multiple athlete profiles already exist with this email in this organisation. Delete duplicates first, then retry invite.');
    }
    let athleteId = existingAthleteByEmail?.id ?? null;

    const payload = {
      first_name,
      last_name: last_name || null,
      full_name: canonicalFullName(first_name, last_name),
      date_of_birth: athleteForm.date_of_birth,
      gender: normalizeGenderForDb(athleteForm.gender),
      position: normalizePositionForDb(athleteForm.position),
      jersey_number: athleteForm.jersey_number ? Number(athleteForm.jersey_number) : null,
      email: emailValue,
      phone: athleteForm.phone.trim() || null,
      emergency_contact_phone: athleteForm.emergency_contact_phone?.trim() || null,
      blood_group: athleteForm.blood_group?.trim() || null,
      address: athleteForm.address?.trim() || null,
      org_id: user.orgId,
      is_active: true,
      ...(photo_url ? { photo_url } : {}),
    };

    if (!athleteId) {
      const { data: athleteData, error: insertErr } = await supabase
        .from('athletes')
        .insert(payload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      athleteId = athleteData?.id ?? null;
    }
    if (!athleteId) throw new Error('Could not resolve athlete profile for invite.');

    try {
      await insertAthleteTeams(athleteId, selectedTeamIds);
    } catch (teamErr) {
      console.error('[useAddUser] athlete team assignment', teamErr);
    }

    const inviteFullName = `${first_name} ${last_name}`.trim();
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: emailValue,
          fullName: inviteFullName,
          orgId: user.orgId,
          userType: 'athlete',
          athleteId,
        },
      });
      if (fnError) throw new Error(await resolveFunctionErrorMessage(fnError, fnData));
      if (fnData?.error) throw new Error(fnData.error);
      setSuccessMessage(`Athlete added and invite sent to ${emailValue}. Ask them to check spam if it is not in their inbox.`);
    } catch (err) {
      console.error('[useAddUser] athlete invite', err);
      setSuccessMessage(
        'Athlete profile created but invite failed. Use Resend Invite from the Users tab to retry.',
      );
    }
  };

  const submitStaff = async (user) => {
    if (!staffForm.first_name.trim()) throw new Error('First name is required.');
    if (!staffForm.email.trim()) throw new Error('Email is required.');
    if (!staffForm.phone.trim()) throw new Error('Phone is required.');
    if (!staffForm.roleLabel) throw new Error('Role is required.');

    const roleEnum = STAFF_ROLE_ENUM[staffForm.roleLabel];
    if (!roleEnum) throw new Error('Invalid role selected.');

    const fullName = canonicalFullName(staffForm.first_name.trim(), staffForm.last_name.trim());
    const emailValue = staffForm.email.trim();

    const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
      body: { email: emailValue, fullName, orgId: user.orgId, userType: 'staff', roleEnum },
    });
    if (fnError) throw new Error(await resolveFunctionErrorMessage(fnError, fnData));
    if (fnData?.error) throw new Error(fnData.error);

    const newUserId = fnData.userId;
    let photo_url = null;
    if (photoBlob) photo_url = await uploadPhoto(photoBlob, photoName);

    const profilePatch = {
      phone: staffForm.phone.trim(),
      title: staffForm.title.trim() || null,
      ...(photo_url ? { photo_url } : {}),
    };
    const { error: profileErr } = await supabase
      .from('users')
      .update(profilePatch)
      .eq('id', newUserId)
      .eq('org_id', user.orgId);
    if (profileErr) console.error('[useAddUser] staff profile update', profileErr);

    const roleDbName = STAFF_ROLE_DB_NAME[staffForm.roleLabel];
    const { data: roleRow, error: roleLookupErr } = await supabase
      .from('roles')
      .select('id')
      .eq('org_id', user.orgId)
      .eq('name', roleDbName)
      .maybeSingle();
    if (roleLookupErr) console.error('[useAddUser] role lookup', roleLookupErr);

    if (roleRow?.id) {
      await assignStaffTeams(user.orgId, newUserId, roleRow.id, selectedTeamIds);
    }

    setSuccessMessage(`Invite sent to ${emailValue}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const user = await getCurrentUser();
      if (!user?.orgId) throw new Error('No authenticated user found.');
      if (path === 'athlete') await submitAthlete(user);
      else await submitStaff(user);
      await onSuccess?.();
      window.setTimeout(() => {
        onClose?.();
      }, 1400);
    } catch (err) {
      console.error('[useAddUser] submit', err);
      setError(err.message || 'Could not save user.');
    } finally {
      setSaving(false);
    }
  };

  return {
    path,
    setPath,
    athleteForm,
    staffForm,
    teams,
    selectedTeamIds,
    toggleTeam,
    pendingFile,
    photoPreview,
    saving,
    error,
    successMessage,
    setAthleteField,
    setStaffField,
    handlePhotoChange,
    handleCropDone,
    handleCropCancel,
    handleSubmit,
  };
}
