import { useEffect, useRef, useState } from 'react';

const ZOOMS = ['4Y', '1Y', '6M', '1M', '1W'];

export default function PeriodisationToolbar({
  teams,
  selectedTeamId,
  setSelectedTeamId,
  viewMode,
  setViewMode,
  athletes,
  selectedAthleteId,
  setSelectedAthleteId,
  hasIndividualPlan,
  showTeamPlan,
  setShowTeamPlan,
  zoomLevel,
  setZoomLevel,
  canEdit,
  onAddRow,
  templates,
  saveStatus,
  onExportPDF,
  isExporting,
  hasTeamPlanForSync = false,
  teamPlanSyncBusy = false,
  onReplaceWithTeamPlan,
  onUpdateFromTeamPlan,
}) {
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'replace' | 'update' | null
  const teamMenuRef = useRef(null);

  useEffect(() => {
    if (!teamMenuOpen) return;
    const close = (e) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(e.target)) setTeamMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [teamMenuOpen]);

  const teamActionsEnabled =
    viewMode === 'individual' &&
    !!selectedAthleteId &&
    hasTeamPlanForSync &&
    canEdit &&
    !teamPlanSyncBusy;

  return (
    <div className="flex flex-wrap items-center gap-2 border border-white/10 rounded-lg bg-[#252528] p-3">
      <select
        value={selectedTeamId ?? ''}
        onChange={(e) => setSelectedTeamId(e.target.value)}
        className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs min-w-[160px]"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value)}
        className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs"
      >
        <option value="team">Team Plan</option>
        <option value="individual">Individual Athlete</option>
      </select>
      {viewMode === 'individual' && (
        <select
          value={selectedAthleteId ?? ''}
          onChange={(e) => setSelectedAthleteId(e.target.value || null)}
          className="bg-[#1C1C1E] border border-white/10 rounded px-2 py-1.5 text-xs min-w-[140px]"
        >
          <option value="">Select athlete…</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
      )}
      {viewMode === 'individual' && selectedAthleteId && (
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full
        text-[9px] font-bold border ${
              hasIndividualPlan
                ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300'
                : 'bg-red-900/20 border-red-700/30 text-red-300'
            }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${
            hasIndividualPlan ? 'bg-emerald-400' : 'bg-red-400'
          }`} />
          {hasIndividualPlan ? 'Individual plan active' : 'No individual plan'}
        </div>
      )}
      {viewMode === 'individual' && (
        <button
          type="button"
          onClick={() => setShowTeamPlan?.((v) => {
            if (v === 'on') return 'ghost';
            if (v === 'ghost') return 'off';
            return 'on';
          })}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded
        text-[10px] font-bold uppercase border transition-colors
        ${
          showTeamPlan === 'on'
            ? 'border-[#F97316] text-[#F97316] bg-[#F97316]/10'
            : showTeamPlan === 'ghost'
            ? 'border-[#F97316]/40 text-[#F97316]/60 bg-[#F97316]/5'
            : 'border-white/10 text-gray-500 hover:text-white'
        }`}
        >
          <span className="material-symbols-outlined text-[12px]">
            {showTeamPlan === 'on' ? 'visibility'
              : showTeamPlan === 'ghost' ? 'visibility'
              : 'visibility_off'}
          </span>
          Team plan{showTeamPlan === 'ghost' ? ' ·' : ''}
        </button>
      )}
      <div className="flex rounded-lg overflow-hidden border border-white/10">
        {ZOOMS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoomLevel(z)}
            className={`px-2 py-1.5 text-[10px] font-black uppercase ${
              zoomLevel === z ? 'bg-[#F97316] text-black' : 'bg-[#1C1C1E] text-gray-400 hover:text-white'
            }`}
          >
            {z}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        disabled={!canEdit}
        onClick={(e) => {
          e.stopPropagation();
          if (!canEdit) return;
          onAddRow();
        }}
        className="px-2 py-1.5 rounded border border-white/15 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/5 disabled:opacity-40"
      >
        + Add row
      </button>
      {viewMode === 'individual' && (
        <div className="relative" ref={teamMenuRef}>
          <button
            type="button"
            disabled={!teamActionsEnabled}
            onClick={() => teamActionsEnabled && setTeamMenuOpen((o) => !o)}
            className={`px-2 py-1.5 rounded border text-[10px] font-bold uppercase transition-colors ${
              teamActionsEnabled
                ? 'border-white/15 text-gray-300 hover:bg-white/5'
                : 'border-white/5 text-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            Team plan ▾
          </button>
          {teamMenuOpen && teamActionsEnabled && (
            <div className="absolute right-0 top-full mt-1 z-[60] w-[min(100vw-2rem,22rem)] bg-[#2a2a2c] border border-white/10 rounded-lg py-1 shadow-xl">
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5"
                onClick={() => {
                  setTeamMenuOpen(false);
                  setConfirmAction('replace');
                }}
              >
                <div className="text-[11px] font-bold text-white">Replace with team plan</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                  Duplicates the full team plan here — rows, cells, and dates. Removes individual content.
                </div>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-white/5"
                onClick={() => {
                  setTeamMenuOpen(false);
                  setConfirmAction('update');
                }}
              >
                <div className="text-[11px] font-bold text-white">Update from team plan</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                  Keeps this athlete’s rows and saved cells; pulls the latest team values only where the athlete has no data yet.
                </div>
              </button>
            </div>
          )}
        </div>
      )}
      <div className="relative group">
        <button
          type="button"
          className="px-2 py-1.5 rounded border border-white/15 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/5"
        >
          Templates ▾
        </button>
        <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-[#2a2a2c] border border-white/10 rounded-lg py-1 min-w-[180px] shadow-xl">
          {templates.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-gray-500">No templates in DB</div>
          )}
          {templates.map((t) => (
            <div key={t.id} className="px-3 py-1.5 text-[10px] text-gray-400">
              {t.name}
            </div>
          ))}
        </div>
      </div>
      {/* Export PDF button — left of save indicator */}
      <button
        type="button"
        disabled={isExporting}
        onClick={() => onExportPDF?.()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? (
          <>
            <span className="w-2 h-2 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
            Export PDF
          </>
        )}
      </button>

      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold">
        {saveStatus === 'saving' && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        )}
        {saveStatus === 'saved' && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        )}
        {saveStatus === 'unsaved' && (
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        )}
        <span className="text-gray-400">
          {teamPlanSyncBusy
            ? 'Updating plan…'
            : saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'unsaved'
                ? 'Unsaved'
                : 'Saved'}
        </span>
      </div>

      {confirmAction && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#2a2a2c] border border-white/10 rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">
              {confirmAction === 'replace' ? 'Replace with team plan?' : 'Update from team plan?'}
            </h2>
            {confirmAction === 'replace' ? (
              <p className="text-sm text-gray-400 leading-relaxed">
                This replaces this athlete’s periodisation with a full copy of the current team plan
                (structure, cells, and date range). Individual-only content will be removed.
              </p>
            ) : (
              <p className="text-sm text-gray-400 leading-relaxed">
                Rows are aligned with the team template (matched by row key where set, otherwise section +
                label). Any cells already saved for this athlete are kept; empty weeks are filled from the
                team plan. Team-only rows are added; rows tied to a removed team row key are removed.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={teamPlanSyncBusy}
                className="px-3 py-2 rounded-lg text-xs font-bold uppercase text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-40"
                onClick={() => !teamPlanSyncBusy && setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={teamPlanSyncBusy}
                className="px-3 py-2 rounded-lg text-xs font-bold uppercase text-[#1a0a00] bg-[#F97316] hover:brightness-110 disabled:opacity-50"
                onClick={() => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  if (action === 'replace') void onReplaceWithTeamPlan?.();
                  else if (action === 'update') void onUpdateFromTeamPlan?.();
                }}
              >
                {teamPlanSyncBusy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
