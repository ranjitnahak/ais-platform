import { useState } from 'react';
import { useSessionConfig } from '../../context/SessionConfigContext';
import { useSessionConfigAdmin } from '../../hooks/useSessionConfigAdmin';

function AddSessionTypeModal({ open, onClose, onSave, saving, emptyForm, venueLabels }) {
  const [form, setForm] = useState({ ...emptyForm });

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'label' && !current.key) {
        next.key = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 48);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#2a2a2c] p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white">Add session type</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Label
            <input
              value={form.label}
              onChange={(e) => updateField('label', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Key
            <input
              value={form.key}
              onChange={(e) => updateField('key', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Default venue (optional)
            <select
              value={form.default_venue}
              onChange={(e) => updateField('default_venue', e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            >
              <option value="">None</option>
              {venueLabels.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form).then(() => { setForm({ ...emptyForm }); onClose(); }).catch(() => {})}
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add session type'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddVenueModal({ open, onClose, onSave, saving, emptyForm }) {
  const [form, setForm] = useState({ ...emptyForm });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#2a2a2c] p-6 shadow-2xl">
        <h3 className="text-base font-bold text-white">Add venue</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
            Venue name
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#131315] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form).then(() => { setForm({ ...emptyForm }); onClose(); }).catch(() => {})}
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add venue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigListCard({
  subtitle,
  inactive,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  onToggle,
  toggleLabel,
  saving,
  children,
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 ${inactive ? 'bg-[#2a2a2c]/50 opacity-60' : 'bg-[#2a2a2c]'}`}
      style={{ border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={saving || disableMoveUp} onClick={onMoveUp} className="rounded p-1 text-gray-500 hover:text-white disabled:opacity-30">
            <span className="material-symbols-outlined text-base">arrow_upward</span>
          </button>
          <button type="button" disabled={saving || disableMoveDown} onClick={onMoveDown} className="rounded p-1 text-gray-500 hover:text-white disabled:opacity-30">
            <span className="material-symbols-outlined text-base">arrow_downward</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onToggle}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400"
          >
            {toggleLabel}
          </button>
        </div>
      </div>
      {subtitle && (
        <p className="mt-1 text-[10px] uppercase tracking-widest text-gray-600">{subtitle}</p>
      )}
    </div>
  );
}

export default function SessionSetupPanel() {
  const { reload: reloadSessionConfig } = useSessionConfig();
  const admin = useSessionConfigAdmin({ onSaved: reloadSessionConfig });
  const [showAddType, setShowAddType] = useState(false);
  const [showAddVenue, setShowAddVenue] = useState(false);

  const sortedTypes = [...admin.sessionTypes].sort((a, b) => a.sort_order - b.sort_order);
  const sortedVenues = [...admin.venues].sort((a, b) => a.sort_order - b.sort_order);
  const activeVenueLabels = sortedVenues.filter((v) => v.is_active).map((v) => v.label);
  const isEmpty = sortedTypes.length === 0 && sortedVenues.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Session Setup</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Configure session types and venues for your organisation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={admin.saving}
            onClick={() => admin.copyTemplate()}
            className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-300 disabled:opacity-50"
          >
            Copy default template
          </button>
          <button
            type="button"
            onClick={() => setShowAddVenue(true)}
            className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-300"
          >
            Add venue
          </button>
          <button
            type="button"
            onClick={() => setShowAddType(true)}
            className="rounded-lg bg-[#F97316] px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-black"
          >
            Add session type
          </button>
        </div>
      </div>

      {admin.error && (
        <p className="mb-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#EF4444]">
          {admin.error}
        </p>
      )}

      {admin.loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-2xl text-[#F97316]">progress_activity</span>
        </div>
      ) : isEmpty ? (
        <p className="rounded-lg bg-[#2a2a2c] px-4 py-8 text-center text-sm text-gray-500">
          No session types or venues configured. Copy the default template to get started.
        </p>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-500">Session types</h3>
            <div className="space-y-2">
              {sortedTypes.length === 0 ? (
                <p className="rounded-lg bg-[#2a2a2c] px-4 py-4 text-sm text-gray-500">No session types yet.</p>
              ) : (
                sortedTypes.map((item, index) => (
                  <ConfigListCard
                    key={item.id}
                    inactive={!item.is_active}
                    saving={admin.saving}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === sortedTypes.length - 1}
                    onMoveUp={() => admin.moveType(item, -1)}
                    onMoveDown={() => admin.moveType(item, 1)}
                    onToggle={() => admin.toggleTypeActive(item)}
                    toggleLabel={item.is_active ? 'Disable' : 'Enable'}
                    subtitle={`${item.key}${item.default_venue ? ` · default venue: ${item.default_venue}` : ''}${!item.is_active ? ' · inactive' : ''}`}
                  >
                    <input
                      defaultValue={item.label}
                      onBlur={(e) => admin.updateSessionTypeLabel(item, e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-white outline-none"
                    />
                  </ConfigListCard>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-500">Venues</h3>
            <div className="space-y-2">
              {sortedVenues.length === 0 ? (
                <p className="rounded-lg bg-[#2a2a2c] px-4 py-4 text-sm text-gray-500">No venues yet.</p>
              ) : (
                sortedVenues.map((item, index) => (
                  <ConfigListCard
                    key={item.id}
                    inactive={!item.is_active}
                    saving={admin.saving}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === sortedVenues.length - 1}
                    onMoveUp={() => admin.moveVenue(item, -1)}
                    onMoveDown={() => admin.moveVenue(item, 1)}
                    onToggle={() => admin.toggleVenueActive(item)}
                    toggleLabel={item.is_active ? 'Disable' : 'Enable'}
                    subtitle={!item.is_active ? 'inactive' : undefined}
                  >
                    <input
                      defaultValue={item.label}
                      onBlur={(e) => admin.updateVenueLabel(item, e.target.value)}
                      className="w-full bg-transparent text-sm font-bold text-white outline-none"
                    />
                  </ConfigListCard>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <AddSessionTypeModal
        open={showAddType}
        onClose={() => setShowAddType(false)}
        onSave={admin.addSessionType}
        saving={admin.saving}
        emptyForm={admin.EMPTY_TYPE_FORM}
        venueLabels={activeVenueLabels}
      />
      <AddVenueModal
        open={showAddVenue}
        onClose={() => setShowAddVenue(false)}
        onSave={admin.addVenue}
        saving={admin.saving}
        emptyForm={admin.EMPTY_VENUE_FORM}
      />
    </div>
  );
}
