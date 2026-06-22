import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { getEffectiveOrgId } from '../lib/orgScope';
import { useTestDefinitions } from './useTestDefinitions';
import { useAssessmentSessions } from './useAssessmentSessions';
import { BENCHMARK_TIER_SELECT } from '../lib/assessmentSettingsConstants';
import {
  isOutOfRange,
  generateAssessmentCSV,
  downloadAssessmentCSV,
  parseAssessmentCSV,
  commitImportUpserts,
} from '../lib/assessmentExport';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyCellsForTests(testIds) {
  const cells = {};
  for (const id of testIds) {
    cells[id] = { value: '', savedValue: '', status: 'empty', saveError: null };
  }
  return cells;
}

export function isCellDirty(cell) {
  return String(cell?.value ?? '').trim() !== String(cell?.savedValue ?? '').trim();
}

function makeSyncedCell(value, test, tiers) {
  const str = value == null ? '' : String(value);
  return {
    value: str,
    savedValue: str,
    status: cellStatusForValue(str, test, tiers),
    saveError: null,
  };
}

function defaultCell(cell) {
  return cell ?? { value: '', savedValue: '', status: 'empty', saveError: null };
}

function cellStatusForValue(value, test, tiers) {
  if (value == null || value === '') return 'empty';
  const num = Number(value);
  if (Number.isNaN(num)) return 'flagged';
  return isOutOfRange(num, test, tiers) ? 'flagged' : 'saved';
}

function countFilledCells(row, testIds) {
  return testIds.filter((tid) => {
    const v = row.cells?.[tid]?.value;
    return v != null && String(v).trim() !== '';
  }).length;
}

export function rowCompletionStatus(row, testIds) {
  const total = testIds.length;
  if (!total) return 'grey';
  const filled = countFilledCells(row, testIds);
  if (filled === 0) return 'grey';
  if (filled === total) return 'green';
  return 'amber';
}

export function useAssessmentGrid({ onToast } = {}) {
  const { user, activeOrgId, activeTeamId, availableTeams } = useUser();
  const effectiveOrgId = getEffectiveOrgId(user, activeOrgId);

  const [groupDate, setGroupDateState] = useState(todayIso);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [wholeTeam, setWholeTeam] = useState(true);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState([]);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const toast = useCallback((message, type = 'error') => {
    onToastRef.current?.(message, type);
  }, []);

  const { activeTests, loading: testsLoading } = useTestDefinitions(activeTeamId, {
    onError: (msg) => toast(msg, 'error'),
  });

  const { ensureSession, loadSessionsForDates, clearCache, getSessionId } = useAssessmentSessions({
    orgId: effectiveOrgId,
    teamId: activeTeamId,
    userId: user?.id,
  });

  const teamName = useMemo(
    () => availableTeams?.find((t) => t.id === activeTeamId)?.name ?? 'team',
    [availableTeams, activeTeamId],
  );

  const visibleTests = useMemo(
    () => activeTests.filter((t) => selectedTestIds.includes(t.id)),
    [activeTests, selectedTestIds],
  );

  const visibleAthletes = useMemo(() => {
    if (wholeTeam) return roster;
    const idSet = new Set(selectedAthleteIds);
    return roster.filter((a) => idSet.has(a.id));
  }, [roster, wholeTeam, selectedAthleteIds]);

  useEffect(() => {
    if (!activeTests.length) return;
    setSelectedTestIds((prev) => {
      if (!prev.length) return activeTests.map((t) => t.id);
      const valid = prev.filter((id) => activeTests.some((t) => t.id === id));
      return valid.length ? valid : activeTests.map((t) => t.id);
    });
  }, [activeTests]);

  const loadRoster = useCallback(async () => {
    if (!activeTeamId || !effectiveOrgId) {
      setRoster([]);
      setRosterLoading(false);
      return;
    }
    setRosterLoading(true);
    try {
      const { data, error } = await supabase
        .from('athlete_teams')
        .select('athlete_id, athletes!inner(id, full_name, org_id, is_active)')
        .eq('team_id', activeTeamId)
        .eq('athletes.org_id', effectiveOrgId)
        .eq('athletes.is_active', true)
        .is('left_at', null);
      if (error) throw error;

      const list = (data ?? [])
        .map((row) => {
          const athlete = Array.isArray(row.athletes) ? row.athletes[0] : row.athletes;
          return athlete ? { id: athlete.id, full_name: athlete.full_name } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setRoster(list);
      if (wholeTeam) {
        setSelectedAthleteIds(list.map((a) => a.id));
      }
    } catch (err) {
      console.error('[useAssessmentGrid] loadRoster failed:', err);
      toast(err.message ?? 'Could not load roster.', 'error');
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  }, [activeTeamId, effectiveOrgId, wholeTeam, toast]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const loadTiers = useCallback(async () => {
    if (!effectiveOrgId || !activeTeamId || !selectedTestIds.length) {
      setTiers([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('benchmark_tiers')
        .select(BENCHMARK_TIER_SELECT)
        .eq('org_id', effectiveOrgId)
        .eq('team_id', activeTeamId)
        .in('test_id', selectedTestIds);
      if (error) throw error;
      setTiers(data ?? []);
    } catch (err) {
      console.error('[useAssessmentGrid] loadTiers failed:', err);
    }
  }, [effectiveOrgId, activeTeamId, selectedTestIds]);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  const buildRowsFromAthletes = useCallback(
    (athletes, date, prevRows = []) => {
      const prevMap = new Map((prevRows ?? []).map((r) => [r.athleteId, r]));
      return athletes.map((a) => {
        const prev = prevMap.get(a.id);
        if (prev) {
          return {
            ...prev,
            fullName: a.full_name,
            date: prev.dateOverridden ? prev.date : date,
            cells: { ...emptyCellsForTests(selectedTestIds), ...prev.cells },
          };
        }
        return {
          athleteId: a.id,
          fullName: a.full_name,
          date,
          dateOverridden: false,
          cells: emptyCellsForTests(selectedTestIds),
        };
      });
    },
    [selectedTestIds],
  );

  const loadResultsIntoRows = useCallback(
    async (baseRows) => {
      if (!baseRows.length || !selectedTestIds.length || !activeTeamId) {
        return baseRows;
      }

      const dates = [...new Set(baseRows.map((r) => r.date))];
      try {
        await loadSessionsForDates(dates);
      } catch (err) {
        console.error('[useAssessmentGrid] loadSessionsForDates failed:', err);
        toast(err.message ?? 'Could not load sessions.', 'error');
        return baseRows;
      }

      const sessionByDate = new Map();
      for (const d of dates) {
        const sid = getSessionId(d);
        if (sid) sessionByDate.set(d, sid);
      }

      const sessionIds = [...sessionByDate.values()].filter(Boolean);
      if (!sessionIds.length) return baseRows;

      const athleteIds = baseRows.map((r) => r.athleteId);

      try {
        const { data, error } = await supabase
          .from('assessment_results')
          .select('session_id, athlete_id, test_id, value')
          .in('session_id', sessionIds)
          .in('athlete_id', athleteIds)
          .in('test_id', selectedTestIds);
        if (error) throw error;

        const testById = new Map(activeTests.map((t) => [t.id, t]));
        const sessionToDate = new Map([...sessionByDate.entries()].map(([d, sid]) => [sid, d]));

        const resultMap = new Map();
        for (const row of data ?? []) {
          const date = sessionToDate.get(row.session_id);
          const key = `${row.athlete_id}:${date}:${row.test_id}`;
          resultMap.set(key, row.value);
        }

        return baseRows.map((row) => {
          const cells = { ...emptyCellsForTests(selectedTestIds) };
          for (const testId of selectedTestIds) {
            const key = `${row.athleteId}:${row.date}:${testId}`;
            const val = resultMap.get(key);
            if (val != null) {
              const test = testById.get(testId);
              cells[testId] = makeSyncedCell(val, test, tiers);
            }
          }
          return { ...row, cells };
        });
      } catch (err) {
        console.error('[useAssessmentGrid] loadResults failed:', err);
        toast(err.message ?? 'Could not load results.', 'error');
        return baseRows;
      }
    },
    [
      selectedTestIds,
      activeTeamId,
      loadSessionsForDates,
      getSessionId,
      activeTests,
      tiers,
      toast,
    ],
  );

  const refreshGrid = useCallback(async () => {
    if (!visibleAthletes.length || !selectedTestIds.length) {
      setRows([]);
      return;
    }
    setGridLoading(true);
    try {
      clearCache();
      const base = buildRowsFromAthletes(visibleAthletes, groupDate, rowsRef.current);
      const withResults = await loadResultsIntoRows(base);
      setRows(withResults);
    } finally {
      setGridLoading(false);
    }
  }, [
    visibleAthletes,
    selectedTestIds,
    groupDate,
    buildRowsFromAthletes,
    loadResultsIntoRows,
    clearCache,
  ]);

  useEffect(() => {
    void refreshGrid();
  }, [visibleAthletes, selectedTestIds, groupDate]);

  const setGroupDate = useCallback((nextDate) => {
    setGroupDateState(nextDate);
    setRows((prev) =>
      prev.map((row) =>
        row.dateOverridden ? row : { ...row, date: nextDate },
      ),
    );
  }, []);

  const setRowDate = useCallback(
    async (athleteId, nextDate) => {
      let updatedRow = null;
      setRows((prev) =>
        prev.map((row) => {
          if (row.athleteId !== athleteId) return row;
          updatedRow = {
            ...row,
            date: nextDate,
            dateOverridden: true,
            cells: emptyCellsForTests(selectedTestIds),
          };
          return updatedRow;
        }),
      );

      if (!updatedRow || !selectedTestIds.length) return;

      try {
        await loadSessionsForDates([nextDate]);
        const sessionId = getSessionId(nextDate);
        if (!sessionId) return;

        const { data, error } = await supabase
          .from('assessment_results')
          .select('test_id, value')
          .eq('session_id', sessionId)
          .eq('athlete_id', athleteId)
          .in('test_id', selectedTestIds);
        if (error) throw error;

        const testById = new Map(activeTests.map((t) => [t.id, t]));
        const cells = emptyCellsForTests(selectedTestIds);
        for (const result of data ?? []) {
          const test = testById.get(result.test_id);
          cells[result.test_id] = makeSyncedCell(result.value, test, tiers);
        }

        setRows((prev) =>
          prev.map((row) =>
            row.athleteId === athleteId ? { ...row, cells } : row,
          ),
        );
      } catch (err) {
        console.error('[useAssessmentGrid] setRowDate reload failed:', err);
        toast(err.message ?? 'Could not load results for date.', 'error');
      }
    },
    [selectedTestIds, loadSessionsForDates, getSessionId, activeTests, tiers, toast],
  );

  const updateCellValue = useCallback(
    (athleteId, testId, value) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.athleteId !== athleteId) return row;
          const existingCell = row.cells[testId] ?? {
            value: '',
            savedValue: '',
            status: 'empty',
            saveError: null,
          };
          const savedValue = existingCell.savedValue ?? '';
          const dirty = String(value).trim() !== String(savedValue).trim();
          const test = activeTests.find((t) => t.id === testId);
          let status = 'empty';
          if (dirty) {
            status = 'dirty';
          } else if (String(savedValue).trim()) {
            status = cellStatusForValue(savedValue, test, tiers);
          }
          return {
            ...row,
            cells: {
              ...row.cells,
              [testId]: { ...existingCell, value, savedValue, status, saveError: null },
            },
          };
        }),
      );
    },
    [activeTests, tiers],
  );

  const persistCell = useCallback(
    async (athleteId, testId) => {
      const row = rowsRef.current.find((r) => r.athleteId === athleteId);
      if (!row) return;

      const cell = row.cells[testId] ?? { value: '', savedValue: '' };
      const raw = String(cell.value ?? '').trim();
      const test = activeTests.find((t) => t.id === testId);

      try {
        const sessionId = await ensureSession(row.date);

        if (!raw) {
          const hadSaved = String(cell.savedValue ?? '').trim() !== '';
          if (!hadSaved) {
            setRows((prev) =>
              prev.map((r) => {
                if (r.athleteId !== athleteId) return r;
                return {
                  ...r,
                  cells: {
                    ...r.cells,
                    [testId]: { value: '', savedValue: '', status: 'empty', saveError: null },
                  },
                };
              }),
            );
            return;
          }

          const { error } = await supabase
            .from('assessment_results')
            .delete()
            .eq('session_id', sessionId)
            .eq('athlete_id', athleteId)
            .eq('test_id', testId);
          if (error) throw error;

          setRows((prev) =>
            prev.map((r) => {
              if (r.athleteId !== athleteId) return r;
              return {
                ...r,
                cells: {
                  ...r.cells,
                  [testId]: { value: '', savedValue: '', status: 'empty', saveError: null },
                },
              };
            }),
          );
          return;
        }

        const num = Number(raw);
        if (Number.isNaN(num)) {
          setRows((prev) =>
            prev.map((r) => {
              if (r.athleteId !== athleteId) return r;
              return {
                ...r,
                cells: {
                  ...r.cells,
                  [testId]: {
                    ...defaultCell(r.cells[testId]),
                    value: raw,
                    status: 'dirty',
                    saveError: 'Invalid number',
                  },
                },
              };
            }),
          );
          toast('Invalid number', 'error');
          return;
        }

        const { error } = await supabase
          .from('assessment_results')
          .upsert(
            {
              session_id: sessionId,
              athlete_id: athleteId,
              test_id: testId,
              value: num,
              entered_by: user?.id ?? null,
            },
            { onConflict: 'session_id,athlete_id,test_id' },
          );
        if (error) throw error;

        const status = cellStatusForValue(num, test, tiers);
        setRows((prev) =>
          prev.map((r) => {
            if (r.athleteId !== athleteId) return r;
            return {
              ...r,
              cells: {
                ...r.cells,
                [testId]: { value: raw, savedValue: raw, status, saveError: null },
              },
            };
          }),
        );
      } catch (err) {
        console.error('[useAssessmentGrid] persistCell failed:', err);
        setRows((prev) =>
          prev.map((r) => {
            if (r.athleteId !== athleteId) return r;
            return {
              ...r,
              cells: {
                ...r.cells,
                [testId]: {
                  ...defaultCell(r.cells[testId]),
                  saveError: err.message ?? 'Save failed',
                },
              },
            };
          }),
        );
        toast(err.message ?? 'Could not save.', 'error');
        throw err;
      }
    },
    [activeTests, ensureSession, tiers, user?.id, toast],
  );

  const saveAll = useCallback(async () => {
    const pending = [];
    for (const row of rowsRef.current) {
      for (const testId of selectedTestIds) {
        const cell = row.cells[testId];
        if (isCellDirty(cell)) {
          pending.push({ athleteId: row.athleteId, testId });
        }
      }
    }

    if (!pending.length) return;

    setSaving(true);
    try {
      for (const { athleteId, testId } of pending) {
        try {
          await persistCell(athleteId, testId);
        } catch {
          // persistCell logs and marks cell; continue with remaining cells
        }
      }

      const stillPending = rowsRef.current.some((row) =>
        selectedTestIds.some((tid) => {
          const c = row.cells[tid];
          return isCellDirty(c) || c?.saveError;
        }),
      );

      if (!stillPending) {
        toast('All changes saved', 'success');
      }
    } catch (err) {
      console.error('[useAssessmentGrid] saveAll failed:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedTestIds, persistCell, toast]);

  const toggleTest = useCallback((testId) => {
    setSelectedTestIds((prev) => {
      if (prev.includes(testId)) {
        return prev.length > 1 ? prev.filter((id) => id !== testId) : prev;
      }
      return [...prev, testId];
    });
  }, []);

  const setAthleteWholeTeam = useCallback((isWhole) => {
    setWholeTeam(isWhole);
    if (isWhole) {
      setSelectedAthleteIds(roster.map((a) => a.id));
    }
  }, [roster]);

  const toggleAthlete = useCallback((athleteId) => {
    setWholeTeam(false);
    setSelectedAthleteIds((prev) => {
      const set = new Set(prev);
      if (set.has(athleteId)) {
        set.delete(athleteId);
        return [...set];
      }
      set.add(athleteId);
      return [...set];
    });
  }, []);

  const exportCsv = useCallback(() => {
    try {
      const content = generateAssessmentCSV({
        athletes: visibleAthletes,
        tests: visibleTests,
        groupDate,
        orgId: effectiveOrgId,
        teamId: activeTeamId,
      });
      downloadAssessmentCSV({ content, teamName, groupDate });
      toast('CSV exported', 'success');
    } catch (err) {
      console.error('[useAssessmentGrid] exportCsv failed:', err);
      toast(err.message ?? 'Export failed.', 'error');
    }
  }, [visibleAthletes, visibleTests, groupDate, effectiveOrgId, activeTeamId, teamName, toast]);

  const handleImportFile = useCallback(
    async (file) => {
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseAssessmentCSV(text, {
          roster,
          tests: activeTests,
          tiers,
          orgId: effectiveOrgId,
          teamId: activeTeamId,
        });
        setImportFileName(file.name);
        setImportPreview(parsed);
      } catch (err) {
        console.error('[useAssessmentGrid] handleImportFile failed:', err);
        toast(err.message ?? 'Could not parse CSV.', 'error');
      }
    },
    [roster, activeTests, tiers, effectiveOrgId, activeTeamId, toast],
  );

  const cancelImport = useCallback(() => {
    setImportPreview(null);
    setImportFileName('');
  }, []);

  const confirmImport = useCallback(async () => {
    if (!importPreview?.rows?.length) return;
    setSaving(true);
    try {
      const upserts = [];
      for (const row of importPreview.rows) {
        if (!row.athleteId) continue;
        const date = row.testingDate || groupDate;
        for (const cell of row.cells ?? []) {
          if (cell.value == null || cell.reason === 'invalid') continue;
          upserts.push({
            athleteId: row.athleteId,
            testId: cell.testId,
            value: cell.value,
            date,
          });
        }
      }

      await commitImportUpserts(upserts, {
        ensureSession,
        enteredBy: user?.id,
      });

      setImportPreview(null);
      setImportFileName('');
      toast(`Imported ${upserts.length} values`, 'success');
      await refreshGrid();
    } catch (err) {
      console.error('[useAssessmentGrid] confirmImport failed:', err);
      toast(err.message ?? 'Import failed.', 'error');
    } finally {
      setSaving(false);
    }
  }, [importPreview, groupDate, ensureSession, user?.id, refreshGrid, toast]);

  const progress = useMemo(() => {
    const total = rows.length;
    if (!total || !selectedTestIds.length) return { complete: 0, total: 0 };
    const complete = rows.filter(
      (row) => rowCompletionStatus(row, selectedTestIds) === 'green',
    ).length;
    return { complete, total };
  }, [rows, selectedTestIds]);

  const hasUnsavedChanges = useMemo(
    () =>
      rows.some((row) =>
        selectedTestIds.some((tid) => isCellDirty(row.cells[tid])),
      ),
    [rows, selectedTestIds],
  );

  const loading = rosterLoading || testsLoading || gridLoading;

  return {
    groupDate,
    setGroupDate,
    selectedTestIds,
    toggleTest,
    activeTests,
    visibleTests,
    wholeTeam,
    setAthleteWholeTeam,
    selectedAthleteIds,
    toggleAthlete,
    roster,
    rows,
    setRowDate,
    updateCellValue,
    saveAll,
    hasUnsavedChanges,
    importPreview,
    importFileName,
    handleImportFile,
    cancelImport,
    confirmImport,
    exportCsv,
    progress,
    rowCompletionStatus: (row) => rowCompletionStatus(row, selectedTestIds),
    loading,
    saving,
    teamName,
    effectiveOrgId,
    activeTeamId,
  };
}
