import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { getEffectiveOrgId, resolveOrgTeamScope } from '../../lib/orgScope';
import { athleteDisplayName } from '../../lib/athleteName';
import { useUser } from '../../context/UserContext';
import { useDexaExtraction } from '../../hooks/useDexaExtraction';
import DexaAthleteSelector from './DexaAthleteSelector';
import DexaUploadZone from './DexaUploadZone';
import DexaFieldsPanel from './DexaFieldsPanel';

export default function DexaUploadTab() {
  const { user, activeOrgId } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const [athletes, setAthletes] = useState([]);
  const [athletesLoading, setAthletesLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const {
    step,
    pdfFile,
    extractedFields,
    populatedFields,
    highlightedKeys,
    error,
    selectedAthleteId,
    setSelectedAthleteId,
    handleFileSelect,
    updateField,
    handleSave,
    reset,
  } = useDexaExtraction();

  useEffect(() => {
    let mounted = true;

    async function loadAthletes() {
      try {
        setAthletesLoading(true);
        setLoadError(null);
        const currentUser = user ?? (await getCurrentUser());
        if (!currentUser || !effectiveOrgId) {
          if (mounted) setAthletes([]);
          return;
        }

        const { effectiveTeamIds } = await resolveOrgTeamScope(supabase, currentUser, activeOrgId);
        if (!effectiveTeamIds.length) {
          if (mounted) setAthletes([]);
          return;
        }

        const { data, error: athleteError } = await supabase
          .from('athletes')
          .select('id, first_name, last_name, full_name, photo_url, athlete_teams!inner(team_id)')
          .eq('org_id', effectiveOrgId)
          .eq('is_active', true)
          .in('athlete_teams.team_id', effectiveTeamIds)
          .order('last_name', { ascending: true });

        if (athleteError) throw athleteError;
        if (mounted) setAthletes(data ?? []);
      } catch (err) {
        console.error('[DexaExtraction]', err);
        if (mounted) setLoadError(err?.message ?? 'Failed to load athletes.');
      } finally {
        if (mounted) setAthletesLoading(false);
      }
    }

    loadAthletes();
    return () => {
      mounted = false;
    };
  }, [user, activeOrgId, effectiveOrgId]);

  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.id === selectedAthleteId),
    [athletes, selectedAthleteId],
  );

  const athleteName = selectedAthlete ? athleteDisplayName(selectedAthlete) : '';
  const uploadDisabled = !selectedAthleteId || step === 'extracting' || step === 'uploading' || step === 'saving';
  const displayError = error || loadError;

  function handleCancel() {
    reset();
  }

  function handleReset() {
    reset();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {displayError && (
        <div className="rounded-2xl border border-[var(--color-error-container)] bg-[var(--color-surface-container)] p-4 text-sm text-[var(--color-error)]">
          {displayError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-5 rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-5">
          <DexaAthleteSelector
            athletes={athletes}
            loading={athletesLoading}
            selectedAthleteId={selectedAthleteId}
            onSelect={setSelectedAthleteId}
          />

          {selectedAthleteId && (
            <DexaUploadZone
              pdfFile={pdfFile}
              step={step}
              disabled={uploadDisabled}
              onFileSelect={handleFileSelect}
            />
          )}
        </div>

        <DexaFieldsPanel
          step={step}
          extractedFields={extractedFields}
          populatedFields={populatedFields}
          highlightedKeys={highlightedKeys}
          athleteName={athleteName}
          onChange={updateField}
          onSave={handleSave}
          onCancel={handleCancel}
          onReset={handleReset}
          saving={step === 'saving'}
        />
      </div>
    </div>
  );
}
