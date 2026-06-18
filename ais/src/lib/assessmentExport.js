import { slugifyFilename } from './buildDashboardPDF';
import { supabase } from './supabase';

const META_PREFIX = '#AIS_META';

/** Escape a CSV field (wrap in quotes if needed). */
function csvField(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  return lines.map(parseCsvLine);
}

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

/**
 * Returns true when value falls outside all configured absolute threshold bands.
 * If no tiers or all thresholds null, never flags.
 */
export function isOutOfRange(value, test, tiers) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return false;
  const num = Number(value);
  const testTiers = (tiers ?? []).filter((t) => t.test_id === test?.id);
  if (!testTiers.length) return false;

  const hasAnyThreshold = testTiers.some(
    (t) => t.threshold_min != null || t.threshold_max != null,
  );
  if (!hasAnyThreshold) return false;

  const isLowerBetter = test.direction === 'lower_is_better';

  for (const tier of testTiers) {
    const min = tier.threshold_min;
    const max = tier.threshold_max;

    if (isLowerBetter) {
      const belowMax = max == null || num < max;
      const aboveMin = min == null || num >= min;
      if (belowMax && aboveMin) return false;
    } else {
      const aboveMin = min == null || num >= min;
      const belowMax = max == null || num < max;
      if (aboveMin && belowMax) return false;
    }
  }

  return true;
}

export function generateAssessmentCSV({ athletes, tests, groupDate, orgId, teamId }) {
  const testIds = (tests ?? []).map((t) => t.id);
  const testNames = (tests ?? []).map((t) => t.name);
  const metaRow = [META_PREFIX, orgId, teamId, testIds.join('|')].map(csvField).join(',');
  const headerRow = ['Athlete Name', ...testNames, 'Testing Date'].map(csvField).join(',');
  const dataRows = (athletes ?? []).map((athlete) => {
    const cells = [
      athlete.full_name ?? athlete.name ?? '',
      ...testNames.map(() => ''),
      groupDate,
    ];
    return cells.map(csvField).join(',');
  });

  return [metaRow, headerRow, ...dataRows].join('\n');
}

export function assessmentCsvFilename({ teamName, groupDate }) {
  const slug = slugifyFilename(teamName ?? 'team');
  const date = groupDate ?? new Date().toISOString().slice(0, 10);
  return `assessment_${slug}_${date}.csv`;
}

export function downloadAssessmentCSV({ content, teamName, groupDate }) {
  const filename = assessmentCsvFilename({ teamName, groupDate });
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse assessment CSV. Caller validates orgId/teamId match.
 */
export function parseAssessmentCSV(text, { roster, tests, tiers, orgId, teamId }) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or missing headers.');
  }

  const metaFields = rows[0];
  if (!metaFields[0]?.startsWith(META_PREFIX)) {
    throw new Error('Invalid CSV: missing metadata row.');
  }

  const metaOrgId = metaFields[1]?.trim();
  const metaTeamId = metaFields[2]?.trim();
  const metaTestIds = (metaFields[3] ?? '').split('|').filter(Boolean);

  if (metaOrgId && orgId && metaOrgId !== orgId) {
    throw new Error('CSV org_id does not match current organisation.');
  }
  if (metaTeamId && teamId && metaTeamId !== teamId) {
    throw new Error('CSV team_id does not match current team.');
  }

  const headerFields = rows[1];
  const testCount = metaTestIds.length;
  const expectedCols = 1 + testCount + 1;
  if (headerFields.length < expectedCols) {
    throw new Error('CSV header column count does not match metadata test list.');
  }

  const testById = new Map((tests ?? []).map((t) => [t.id, t]));
  const orderedTests = metaTestIds.map((id) => testById.get(id)).filter(Boolean);

  const rosterByName = new Map(
    (roster ?? []).map((a) => [normalizeName(a.full_name), a]),
  );

  const parsedRows = [];
  let flaggedCount = 0;

  for (let i = 2; i < rows.length; i += 1) {
    const fields = rows[i];
    if (!fields.length || fields.every((f) => !f.trim())) continue;

    const athleteName = fields[0]?.trim() ?? '';
    const testingDate = fields[fields.length - 1]?.trim() || null;
    const valueFields = fields.slice(1, 1 + testCount);

    const athlete = rosterByName.get(normalizeName(athleteName));
    const rowFlags = [];

    if (!athlete) {
      rowFlags.push('unknown_athlete');
      flaggedCount += 1;
    }

    const cellValues = orderedTests.map((test, idx) => {
      const raw = valueFields[idx]?.trim() ?? '';
      if (!raw) {
        rowFlags.push('empty');
        flaggedCount += 1;
        return { testId: test.id, value: null, flagged: true, reason: 'empty' };
      }

      const num = Number(raw);
      if (Number.isNaN(num)) {
        rowFlags.push('invalid');
        flaggedCount += 1;
        return { testId: test.id, value: null, raw, flagged: true, reason: 'invalid' };
      }

      const outOfRange = isOutOfRange(num, test, tiers);
      if (outOfRange) {
        rowFlags.push('out_of_range');
        flaggedCount += 1;
      }

      return {
        testId: test.id,
        value: num,
        flagged: outOfRange,
        reason: outOfRange ? 'out_of_range' : null,
      };
    });

    parsedRows.push({
      athleteName,
      athleteId: athlete?.id ?? null,
      testingDate,
      cells: cellValues,
      flagged: rowFlags.length > 0,
    });
  }

  return {
    metaOrgId,
    metaTeamId,
    metaTestIds,
    orderedTests,
    athleteCount: parsedRows.length,
    testCount: orderedTests.length,
    flaggedCount,
    rows: parsedRows,
  };
}

export function buildImportUpserts(previewRows, { ensureSession, enteredBy }) {
  const upserts = [];

  for (const row of previewRows ?? []) {
    if (!row.athleteId) continue;
    const date = row.testingDate;
    if (!date) continue;

    for (const cell of row.cells ?? []) {
      if (cell.value == null || cell.flagged && cell.reason === 'invalid') continue;
      if (cell.value == null) continue;
      upserts.push({
        athleteId: row.athleteId,
        testId: cell.testId,
        value: cell.value,
        date,
      });
    }
  }

  return upserts;
}

export async function commitImportUpserts(upserts, { ensureSession, enteredBy }) {
  const byDate = new Map();
  for (const item of upserts) {
    const key = String(item.date).slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(item);
  }

  let saved = 0;

  for (const [date, items] of byDate.entries()) {
    try {
      const sessionId = await ensureSession(date);
      const payload = items.map((item) => ({
        session_id: sessionId,
        athlete_id: item.athleteId,
        test_id: item.testId,
        value: item.value,
        entered_by: enteredBy ?? null,
      }));

      const { error } = await supabase
        .from('assessment_results')
        .upsert(payload, { onConflict: 'session_id,athlete_id,test_id' });
      if (error) throw error;
      saved += payload.length;
    } catch (err) {
      console.error('[assessmentExport] commitImportUpserts failed:', err);
      throw err;
    }
  }

  return saved;
}
