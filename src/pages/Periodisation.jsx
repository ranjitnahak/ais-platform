import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getCurrentUser, canEditPlan, can } from '../lib/auth';
import Sidebar from '../components/Sidebar';
import { MAIN_NAV_ITEMS } from '../nav/mainNavItems';
import { usePeriodisationPlan } from '../hooks/usePeriodisationPlan';
import PeriodisationCanvas from '../components/periodisation/PeriodisationCanvas';
import PeriodisationWeekly from '../components/periodisation/PeriodisationWeekly';
import { addDays } from '../lib/periodisationUtils';
import {
  replaceAthleteWithTeamPlan,
  updateAthleteFromTeamPlan,
} from '../lib/athleteTeamPlanSync';

function toMondayIso(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

const formatPlanDate = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** Fallback when `plan_templates` is empty — matches expected `rows_config` shape */
const DEFAULT_TEMPLATE_ROWS = [
  { row_group: 'Planning', label: 'Phase', row_type: 'band', sort_order: 0 },
  { row_group: 'Planning', label: 'Peaking index', row_type: 'auto', sort_order: 1, row_key: 'peaking_index' },
  { row_group: 'Planning', label: 'Week focus', row_type: 'text', sort_order: 2, row_key: 'week_focus' },
  { row_group: 'Events & fixtures', label: 'Competition', row_type: 'marker', sort_order: 10, row_key: 'competition' },
  { row_group: 'Events & fixtures', label: 'Testing', row_type: 'marker', sort_order: 11, row_key: 'testing' },
  { row_group: 'Physical fitness', label: 'Strength', row_type: 'band', sort_order: 20 },
  { row_group: 'Physical fitness', label: 'Volume (1-10)', row_type: 'number', sort_order: 21, row_key: 'volume' },
  { row_group: 'Physical fitness', label: 'Intensity (1-10)', row_type: 'number', sort_order: 22, row_key: 'intensity' },
  { row_group: 'Physical fitness', label: 'ACWR (auto)', row_type: 'auto', sort_order: 23, row_key: 'acwr' },
  { row_group: 'Technical / tactical', label: 'Primary focus', row_type: 'text', sort_order: 30 },
];

export default function Periodisation() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(user.teamIds[0] ?? null);
  const [viewMode, setViewMode] = useState('team');
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [zoomLevel, setZoomLevel] = useState('1Y');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [createForm, setCreateForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    template_id: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [editingDates, setEditingDates] = useState(false);
  const [dateForm, setDateForm] = useState({ start_date: '', end_date: '' });
  const [dateSaving, setDateSaving] = useState(false);
  const [showTeamPlan, setShowTeamPlan] = useState('on');
  const planScopeRef = useRef({ athleteId: null, viewMode: 'team', enabled: true });

  const athleteIdForPlan = viewMode === 'individual' ? selectedAthleteId : null;
  const planQueryEnabled = true;
  const {
    plan,
    rows,
    cells,
    ghostPlan,
    ghostRows,
    ghostCells,
    initialLoading,
    fetchPlan,
    upsertCell,
    deletePlanCellById,
    insertPlanRow,
    deletePlanRow,
    updatePlanRow,
    reorderPlanRows,
    reorderPlanRowsWithGroups,
    updateDisplayLabelForGroup,
    updatePlanDates,
  } = usePeriodisationPlan(selectedTeamId, { athleteId: athleteIdForPlan, enabled: planQueryEnabled });

  useEffect(() => {
    const prev = planScopeRef.current;
    const next = {
      athleteId: selectedAthleteId,
      viewMode,
      enabled: planQueryEnabled,
    };
    const scopeChanged =
      prev.athleteId !== next.athleteId || prev.viewMode !== next.viewMode || prev.enabled !== next.enabled;
    planScopeRef.current = next;
    if (!scopeChanged) return;
    void fetchPlan();
  }, [selectedAthleteId, viewMode, planQueryEnabled, fetchPlan]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = getCurrentUser();
      if (!user?.orgId) {
        if (!cancelled) setTeams([]);
        return;
      }
      const { data: teamList, error } = await supabase
        .from('teams')
        .select('id, name, logo_url')
        .eq('org_id', user.orgId)
        .order('name');
      if (cancelled) return;
      if (error) {
        console.error(error);
        setTeams([]);
        return;
      }
      const list = teamList ?? [];
      setTeams(list);
      if (list.length) {
        setSelectedTeamId((current) =>
          current && list.some((t) => t.id === current) ? current : list[0].id
        );
        setSelectedAthleteId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('plan_templates')
        .select('id, name, rows_config')
        .or(`is_system.eq.true,org_id.eq.${user.orgId}`)
        .order('name');
      setTemplates(data ?? []);
    })();
  }, [user.orgId]);

  useEffect(() => {
    if (viewMode !== 'individual' || !selectedTeamId) {
      setAthletes([]);
      return;
    }
    (async () => {
      const { data: links } = await supabase
        .from('athlete_teams')
        .select('athlete_id')
        .eq('team_id', selectedTeamId);
      const ids = [...new Set((links ?? []).map((l) => l.athlete_id))];
      if (!ids.length) {
        setAthletes([]);
        return;
      }
      const { data: ath } = await supabase
        .from('athletes')
        .select('id, full_name, photo_url, position')
        .eq('org_id', user.orgId)
        .in('id', ids)
        .order('full_name');
      setAthletes(ath ?? []);
    })();
  }, [viewMode, selectedTeamId, user.orgId]);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedTeamId), [teams, selectedTeamId]);

  const hasTeamPlanForSync = useMemo(
    () => !!(ghostPlan?.id && ghostRows?.length),
    [ghostPlan?.id, ghostRows?.length],
  );

  const handleReplaceWithTeamPlan = useCallback(async () => {
    const u = getCurrentUser();
    if (!u?.orgId || !selectedTeamId || !selectedAthleteId || !ghostPlan?.id) return;
    await replaceAthleteWithTeamPlan(supabase, {
      orgId: u.orgId,
      teamId: selectedTeamId,
      athleteId: selectedAthleteId,
      teamPlan: ghostPlan,
      teamRows: ghostRows,
      teamCells: ghostCells,
      athletePlan: plan,
    });
    await fetchPlan();
  }, [selectedTeamId, selectedAthleteId, ghostPlan, ghostRows, ghostCells, plan, fetchPlan]);

  const handleUpdateFromTeamPlan = useCallback(async () => {
    const u = getCurrentUser();
    if (!u?.orgId || !selectedTeamId || !selectedAthleteId || !ghostPlan?.id) return;
    await updateAthleteFromTeamPlan(supabase, {
      orgId: u.orgId,
      teamId: selectedTeamId,
      athleteId: selectedAthleteId,
      teamPlan: ghostPlan,
      teamRows: ghostRows,
      teamCells: ghostCells,
      athletePlan: plan,
    });
    await fetchPlan();
  }, [selectedTeamId, selectedAthleteId, ghostPlan, ghostRows, ghostCells, plan, fetchPlan]);

  const effectivePlan = useMemo(() => {
    if (plan) return plan;
    if (viewMode === 'individual' && selectedAthleteId && ghostPlan) {
      return {
        ...ghostPlan,
        id: null,
        athlete_id: selectedAthleteId,
      };
    }
    return null;
  }, [plan, viewMode, selectedAthleteId, ghostPlan]);

  const canEdit = plan ? canEditPlan(plan) : can('periodisation', 'edit');

  async function handleCreatePlan(e) {
    e.preventDefault();
    setCreateError(null);
    if (!selectedTeamId || !createForm.name || !createForm.start_date || !createForm.end_date) {
      setCreateError('Please fill plan name and dates.');
      return;
    }
    setCreating(true);
    try {
      const { data: planRow, error: pErr } = await supabase
        .from('periodisation_plans')
        .insert({
          org_id: user.orgId,
          team_id: selectedTeamId,
          name: createForm.name.trim(),
          start_date: createForm.start_date,
          end_date: createForm.end_date,
          athlete_id: athleteIdForPlan,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      let rowDefs = DEFAULT_TEMPLATE_ROWS;
      if (createForm.template_id) {
        const tpl = templates.find((t) => t.id === createForm.template_id);
        if (tpl?.rows_config?.length) rowDefs = tpl.rows_config;
      }

      const inserts = rowDefs.map((r, i) => ({
        org_id: user.orgId,
        plan_id: planRow.id,
        row_group: r.row_group,
        label: r.label,
        row_type: r.row_type,
        sort_order: r.sort_order ?? i,
        row_key: r.row_key ?? null,
      }));

      const { error: rErr } = await supabase.from('plan_rows').insert(inserts);
      if (rErr) throw rErr;

      setShowCreateModal(false);
      setCreateForm({ name: '', start_date: '', end_date: '', template_id: '' });
      await fetchPlan();
    } catch (err) {
      setCreateError(err.message ?? 'Could not create plan');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-[#1C1C1E] text-[#e4e2e4] font-['Inter'] min-h-screen">
      <Sidebar />

      <header className="fixed top-0 w-full z-40 bg-[#1C1C1E]/90 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16 md:pl-72">
        <div className="flex items-center gap-4">
          <button type="button" className="material-symbols-outlined text-white md:hidden" onClick={() => navigate('/')}>
            arrow_back
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase leading-none">Periodisation</h1>
            {selectedTeam && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">{selectedTeam.name}</p>
            )}
            {plan && (
              <>
                {!editingDates ? (
                  <button
                    type="button"
                    className="group flex items-center gap-1.5 text-sm text-gray-400 mt-1 hover:text-white transition-colors"
                    onClick={() => {
                      setDateForm({ start_date: plan.start_date, end_date: plan.end_date });
                      setEditingDates(true);
                    }}
                  >
                    {formatPlanDate(plan.start_date)} — {formatPlanDate(plan.end_date)}
                    <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-60 transition-opacity">
                      edit
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <input
                      type="date"
                      value={dateForm.start_date}
                      onChange={(e) => setDateForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1 text-sm text-white"
                    />
                    <span className="text-gray-500 text-sm">—</span>
                    <input
                      type="date"
                      value={dateForm.end_date}
                      onChange={(e) => setDateForm((f) => ({ ...f, end_date: e.target.value }))}
                      className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1 text-sm text-white"
                    />
                    <button
                      type="button"
                      disabled={
                        dateSaving ||
                        !dateForm.start_date ||
                        !dateForm.end_date ||
                        dateForm.start_date >= dateForm.end_date
                      }
                      onClick={async () => {
                        setDateSaving(true);
                        try {
                          await updatePlanDates(dateForm.start_date, dateForm.end_date);
                          setEditingDates(false);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setDateSaving(false);
                        }
                      }}
                      className="px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-[#F97316] text-[#1a0a00] disabled:opacity-40"
                    >
                      {dateSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDates(false)}
                      className="px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-white/10 text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#353437] flex items-center justify-center border border-white/10">
          <span className="material-symbols-outlined text-sm text-gray-400">person</span>
        </div>
      </header>

      <main className="pt-20 pb-28 px-4 md:pl-72 md:pr-6 min-h-screen">
        {initialLoading && (
          <div className="flex items-center justify-center py-24">
            <span className="material-symbols-outlined text-[#F97316] animate-spin text-4xl">refresh</span>
          </div>
        )}

        {!initialLoading && !plan && viewMode === 'team' && (
          <div className="max-w-lg mx-auto mt-16 text-center space-y-8">
            <div className="space-y-2">
              <span className="text-4xl font-black tracking-tighter text-white uppercase">AIS</span>
              <p className="text-gray-400 text-sm">No plan created yet for this team.</p>
            </div>
            <div className="flex flex-col gap-3 items-center">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 self-start w-full max-w-sm">
                Team
              </label>
              <select
                value={selectedTeamId ?? ''}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setSelectedAthleteId(null);
                }}
                className="w-full max-w-sm bg-[#2a2a2c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-4 w-full max-w-sm py-3 rounded-lg font-black uppercase tracking-widest text-[10px] text-[#1a0a00] bg-[#F97316] hover:brightness-110 transition-all"
              >
                Create new plan
              </button>
            </div>
          </div>
        )}

        {!initialLoading && !selectedWeek &&
         (plan || (viewMode === 'individual' && selectedAthleteId)) && (
          <PeriodisationCanvas
            plan={effectivePlan}
            rows={rows}
            cells={cells}
            ghostRows={ghostRows}
            ghostCells={ghostCells}
            hasTeamPlanForSync={hasTeamPlanForSync}
            onReplaceWithTeamPlan={handleReplaceWithTeamPlan}
            onUpdateFromTeamPlan={handleUpdateFromTeamPlan}
            teams={teams}
            selectedTeamId={selectedTeamId}
            setSelectedTeamId={(id) => {
              setSelectedTeamId(id);
              setSelectedAthleteId(null);
            }}
            viewMode={viewMode}
            setViewMode={setViewMode}
            showTeamPlan={showTeamPlan}
            setShowTeamPlan={setShowTeamPlan}
            athletes={athletes}
            selectedAthleteId={selectedAthleteId}
            setSelectedAthleteId={setSelectedAthleteId}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            canEdit={canEdit}
            upsertCell={upsertCell}
            deletePlanCellById={deletePlanCellById}
            insertPlanRow={insertPlanRow}
            deletePlanRow={deletePlanRow}
            updatePlanRow={updatePlanRow}
            reorderPlanRows={reorderPlanRows}
            reorderPlanRowsWithGroups={reorderPlanRowsWithGroups}
            updateDisplayLabelForGroup={updateDisplayLabelForGroup}
            onWeekSelect={(w) =>
              setSelectedWeek({
                ...w,
                weekStartIso: toMondayIso(w.weekStartIso),
                weekEndIso: addDays(toMondayIso(w.weekStartIso), 6),
              })
            }
            templates={templates}
          />
        )}

        {!initialLoading && effectivePlan && selectedWeek && (
          <PeriodisationWeekly
            team={selectedTeam}
            plan={effectivePlan}
            weekStartIso={selectedWeek.weekStartIso}
            weekIndex={selectedWeek.weekIndex}
            weekEndIso={selectedWeek.weekEndIso}
            rows={rows}
            cells={cells}
            teamId={selectedTeamId}
            onBack={() => setSelectedWeek(null)}
            onPrev={() =>
              setSelectedWeek((w) => {
                if (!w) return w;
                const mon = toMondayIso(addDays(w.weekStartIso, -7));
                return { ...w, weekStartIso: mon, weekIndex: Math.max(0, w.weekIndex - 1), weekEndIso: addDays(mon, 6) };
              })
            }
            onNext={() =>
              setSelectedWeek((w) => {
                if (!w) return w;
                const mon = toMondayIso(addDays(w.weekStartIso, 7));
                return { ...w, weekStartIso: mon, weekIndex: w.weekIndex + 1, weekEndIso: addDays(mon, 6) };
              })
            }
          />
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 bg-[#2A2A2C]/90 backdrop-blur-2xl border-t border-white/10 z-50 rounded-t-2xl">
        {MAIN_NAV_ITEMS.filter((i) => !['Squad', 'Assessment'].includes(i.label)).map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-2 transition-transform ${isActive ? 'text-[#F97316] scale-110' : 'text-gray-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {icon}
                </span>
                <span className="text-[9px] uppercase tracking-widest mt-0.5 font-bold">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="bg-[#2a2a2c] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Create periodisation plan</h2>
              <button type="button" className="text-gray-400 hover:text-white" onClick={() => setShowCreateModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Plan name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Start date</label>
                  <input
                    type="date"
                    required
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="mt-1 w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">End date</label>
                  <input
                    type="date"
                    required
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="mt-1 w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-2 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Template</label>
                <select
                  value={createForm.template_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, template_id: e.target.value }))}
                  className="mt-1 w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Default layout (built-in)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {createError && <p className="text-sm text-red-400">{createError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="w-full py-3 rounded-lg font-black uppercase tracking-widest text-[10px] text-[#1a0a00] bg-[#F97316] disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
