import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { getCurrentUser } from './auth.js'
import {
  fetch1rmMap,
  fetchAthleteMeta,
  fetchBlocks,
  fetchExercises,
  fetchOrgLogos,
  fetchTeamLogoForProgramme,
  fetchWeeksAndSessions,
  displaySets,
  libRow,
} from './programmePDFData.js'

const ORANGE = [249, 115, 22]
const TEXT = [28, 28, 30]
const MUTED = [107, 114, 128]
const MARGIN = 16
const PAGE_W = 210
const PAGE_H = 297
const INNER_W = PAGE_W - MARGIN * 2
function slug(s) {
  return String(s || 'unknown')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
}

function displayName(a) {
  if (a?.display_name) return a.display_name
  if (a?.full_name) return a.full_name
  if (a?.name) return a.name
  return [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim() || 'Athlete'
}

function ageFromDob(iso) {
  if (!iso) return null
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}

function sessionDayLabel(s) {
  const d = s.session_date ? String(s.session_date).slice(0, 10) : ''
  if (!d) return '—'
  const dt = new Date(`${d}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function sessionTimeLabel(s) {
  const t = s.start_time ?? s.session_time
  if (!t) return '—'
  const str = String(t).slice(0, 5)
  return str || '—'
}

function sessionDuration(s) {
  return s.planned_duration_min ?? s.duration_planned ?? null
}

function sessionCategory(s) {
  return s.category || s.session_type || '—'
}

async function renderCoverHtml2Canvas(doc, coverHtml) {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:780px;padding:20px;background:#fff;color:#1C1C1E;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;'
  host.innerHTML = coverHtml
  document.body.appendChild(host)
  try {
    const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
    const img = canvas.toDataURL('image/png')
    const maxH = PAGE_H - MARGIN * 2 - 24
    let h = (canvas.height * INNER_W) / canvas.width
    let w = INNER_W
    if (h > maxH) {
      h = maxH
      w = (canvas.width * h) / canvas.height
    }
    doc.addImage(img, 'PNG', MARGIN, MARGIN, w, h)
    return MARGIN + h + 10
  } finally {
    document.body.removeChild(host)
  }
}

function drawFooters(doc, athleteName, programmeName, weekLabelByPage, totalWeeks) {
  const n = doc.internal.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, PAGE_H - 18, PAGE_W - MARGIN, PAGE_H - 18)
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    const wk = weekLabelByPage[i] ?? 1
    const line = `${athleteName} · ${programmeName} · Week ${wk} of ${totalWeeks || 1}`
    doc.text(line, PAGE_W / 2, PAGE_H - 10, { align: 'center' })
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Per-session: which prescription table columns have at least one non-empty value. */
function getVisibleExerciseColumns(exercises) {
  const vis = { sets: true, reps: false, load: false, rpe: false, tempo: false, rest: false }
  for (const ex of exercises) {
    if (ex?.reps != null && ex.reps !== '') vis.reps = true
    if (formatLoad(ex) !== '—') vis.load = true
    if (
      ex?.prescription_type === 'rpe' ||
      ex?.rpe != null ||
      ex?.target_rpe != null ||
      ex?.planned_rpe != null ||
      ex?.secondary_prescription_type === 'rpe' ||
      ex?.tertiary_prescription_type === 'rpe'
    ) {
      vis.rpe = true
    }
    const tempo = ex?.tempo
    if (tempo != null && String(tempo).trim() !== '' && String(tempo).trim() !== '—') vis.tempo = true
    if (ex?.rest_seconds != null) vis.rest = true
  }
  return vis
}

/**
 * Positions for #, Exercise, and variable metric columns so the row fills INNER_W.
 * @returns {{ xNum: number, xEx: number, exW: number, cols: { key: string, label: string, x: number, w: number }[] }}
 */
function buildExerciseTableColumnLayout(vis) {
  const xNum = MARGIN + 2
  const xEx = MARGIN + 12
  const dataStart = MARGIN + 88
  const dataEnd = PAGE_W - MARGIN - 2
  const avail = Math.max(24, dataEnd - dataStart)

  const spec = []
  if (vis.sets) spec.push({ key: 'sets', label: 'Sets', w: 12 })
  if (vis.reps) spec.push({ key: 'reps', label: 'Reps', w: 12 })
  if (vis.load) spec.push({ key: 'load', label: 'Load', w: 16 })
  if (vis.rpe) spec.push({ key: 'rpe', label: 'RPE', w: 10 })
  if (vis.tempo) spec.push({ key: 'tempo', label: 'Tempo', w: 14 })
  if (vis.rest) spec.push({ key: 'rest', label: 'Rest', w: 14 })

  const baseW = spec.reduce((s, c) => s + c.w, 0) || 1
  const scale = avail / baseW
  let x = dataStart
  const cols = []
  for (const c of spec) {
    const w = c.w * scale
    cols.push({ key: c.key, label: c.label, x, w })
    x += w
  }
  return { xNum, xEx, exW: dataStart - xEx - 4, cols }
}



function formatLoad(ex) {
  const type = ex.prescription_type
  const value = ex.prescription_value

  if (!type) return '—'

  switch (type) {
    case 'absolute':
      return value != null ? value + ' kg' : '—'

    case 'pct_1rm':
      if (value == null) return '—'
      if (ex.calculated_kg != null) return ex.calculated_kg + ' kg · ' + value + '%'
      return value + '%'

    case 'rpe':
      return '—'

    case 'rir':
      return value != null ? value + ' RIR' : '—'

    case 'velocity':
      return value != null ? value + ' m/s' : '—'

    case 'max':
      return ex.max_prescribed === true ? 'MAX' : '—'

    case 'time':
      return value != null ? value + 's' : '—'

    case 'distance':
      return value != null ? value + 'm' : '—'

    default:
      return '—'
  }
}

function formatRpe(ex) {
  if (ex?.prescription_type === 'rpe') {
    return ex?.prescription_value != null && ex.prescription_value !== '' ? String(ex.prescription_value) : '—'
  }
  if (ex?.rpe != null && ex.rpe !== '') return String(ex.rpe)
  if (ex?.target_rpe != null && ex.target_rpe !== '') return String(ex.target_rpe)
  if (ex?.planned_rpe != null && ex.planned_rpe !== '') return String(ex.planned_rpe)
  if (ex?.secondary_prescription_type === 'rpe') {
    return ex?.secondary_prescription_value != null && ex.secondary_prescription_value !== ''
      ? String(ex.secondary_prescription_value)
      : '—'
  }
  if (ex?.tertiary_prescription_type === 'rpe') {
    return ex?.tertiary_prescription_value != null && ex.tertiary_prescription_value !== ''
      ? String(ex.tertiary_prescription_value)
      : '—'
  }
  return '—'
}

function cellForExerciseColumn(key, ex, loadStr) {
  switch (key) {
    case 'sets':
      return String(displaySets(ex))
    case 'reps':
      return ex.reps != null ? String(ex.reps) : '—'
    case 'load':
      return loadStr.slice(0, 18)
    case 'rpe':
      return formatRpe(ex)
    case 'tempo':
      return ex.tempo ? String(ex.tempo).slice(0, 10) : '—'
    case 'rest':
      return ex.rest_seconds != null ? `${ex.rest_seconds}s` : '—'
    default:
      return '—'
  }
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A'
}

/**
 * Build and download a printable PDF for an athlete's programme.
 * @param {object} athlete — row from useAthletes (teams, photo_url, …)
 * @param {object} programme — full programme row (id, name, …)
 */
export async function buildProgrammePDF(athlete, programme) {
  const user = getCurrentUser()
  const orgId = user.orgId
  const athleteName = displayName(athlete)
  const programmeName = programme?.name || 'Programme'
  const weekBundles = await fetchWeeksAndSessions(programme.id, orgId)
  const totalWeeks = weekBundles.length || 1
  const allExIds = []
  for (const { sessions } of weekBundles) {
    for (const s of sessions) {
      const blocks = await fetchBlocks(s.id, orgId)
      for (const b of blocks) {
        const exs = await fetchExercises(b.id, orgId)
        for (const ex of exs) allExIds.push(ex.exercise_id)
      }
    }
  }
  const rmMap = await fetch1rmMap(athlete.id, orgId, allExIds)
  const [orgLogos, teamInfo, meta] = await Promise.all([
    fetchOrgLogos(orgId),
    fetchTeamLogoForProgramme(athlete, programme.id, orgId),
    fetchAthleteMeta(athlete.id, orgId),
  ])
  const age = ageFromDob(meta.date_of_birth)
  const sport = meta.sport || '—'
  const position = meta.position || '—'
  const teamName = teamInfo.name || (athlete.teams?.[0]?.name ?? '—')
  const totalSessions = weekBundles.reduce((n, { sessions }) => n + sessions.length, 0)
  const avgPerWeek = totalWeeks ? Math.round((totalSessions / totalWeeks) * 10) / 10 : 0
  const coverLeftLogo = teamInfo.logo_url || orgLogos.logo_url || ''

  const coverHtml = `
    <div style="border-bottom:2px solid #F97316;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="width:96px;min-height:48px;display:flex;align-items:center;">${coverLeftLogo ? `<img src="${coverLeftLogo}" style="max-width:96px;max-height:48px;object-fit:contain;" crossorigin="anonymous"/>` : ''}</div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#1C1C1E;">${escapeHtml(programmeName)}</div>
      </div>
      <div style="width:96px;min-height:48px;"></div>
    </div>
    <div style="display:flex;gap:16px;align-items:flex-start;">
      <div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#eee;flex-shrink:0;">
        ${athlete.photo_url ? `<img src="${athlete.photo_url}" style="width:64px;height:64px;object-fit:cover;" crossorigin="anonymous"/>` : `<div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:18px;">${escapeHtml(initials(athleteName))}</div>`}
      </div>
      <div style="flex:1;">
        <div style="font-size:20px;font-weight:500;color:#1C1C1E;">${escapeHtml(athleteName)}</div>
        <div style="font-size:13px;color:#6B7280;margin-top:4px;">${escapeHtml(position)} · ${escapeHtml(teamName)}</div>
        <div style="margin-top:8px;display:flex;gap:8px;">
          <span style="font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(249,115,22,0.12);color:#F97316;">${escapeHtml(sport)}</span>
          ${age != null ? `<span style="font-size:11px;padding:4px 8px;border-radius:999px;background:#f3f4f6;color:#6B7280;">Age ${age}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;min-width:120px;">
        <div style="font-size:11px;color:#6B7280;">Programme</div>
        <div style="font-size:13px;font-weight:500;color:#F97316;margin-top:4px;">${escapeHtml(programmeName)}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:4px;">${weekBundles.length} weeks · ${avgPerWeek} sessions/week</div>
      </div>
    </div>
    <div style="margin-top:16px;padding:10px 12px;background:#f3f4f6;border-radius:8px;font-size:11px;color:#6B7280;font-style:italic;">
      Note: exercise names shown in orange with a &gt; prefix are hyperlinks — click to open the video.
    </div>
  `

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const weekLabelByPage = []
  const stampWeek = (wn) => {
    const p = doc.internal.getNumberOfPages()
    weekLabelByPage[p] = wn
  }
  const addPageWeek = (wn) => {
    doc.addPage()
    stampWeek(wn)
  }

  let yAfterCover = MARGIN
  try {
    yAfterCover = await renderCoverHtml2Canvas(doc, coverHtml)
  } catch (err) {
    console.error('[buildProgrammePDF] cover canvas', err)
    doc.setFontSize(14)
    doc.setTextColor(...TEXT)
    doc.text(programmeName, MARGIN, MARGIN + 10)
    yAfterCover = MARGIN + 20
  }

  let currentWeekNum = 1
  for (let wi = 0; wi < weekBundles.length; wi++) {
    const { week, sessions } = weekBundles[wi]
    currentWeekNum = wi + 1
    if (wi > 0 || yAfterCover > PAGE_H - 60) {
      addPageWeek(currentWeekNum)
    } else {
      doc.setPage(1)
      stampWeek(currentWeekNum)
    }

    let y = wi === 0 && yAfterCover < PAGE_H - 40 ? yAfterCover + 8 : MARGIN
    if (wi > 0) y = MARGIN

    doc.setFontSize(16)
    doc.setTextColor(...TEXT)
    doc.text(`Week ${week.week_number ?? wi + 1}`, MARGIN, y)
    y += 8
    const dates = sessions.map((s) => s.session_date).filter(Boolean).sort()
    const phaseBit = week.label ? ` · ${week.label}` : ''
    const range =
      dates.length > 0
        ? `${sessionDayLabel({ session_date: dates[0] })} – ${sessionDayLabel({ session_date: dates[dates.length - 1] })} ${new Date(`${dates[dates.length - 1]}T12:00:00`).getFullYear()}${phaseBit}`
        : `—${phaseBit}`
    doc.setFontSize(12)
    doc.setTextColor(...MUTED)
    doc.text(range, MARGIN, y)
    y += 10
    y += 8

    const hRow = 7
    const cols = [MARGIN, 38, 92, 118, 150, 178]
    doc.setFontSize(10)
    doc.setTextColor(...TEXT)
    doc.setFillColor(245, 245, 245)
    doc.rect(MARGIN, y - 5, INNER_W, hRow + 2, 'F')
    ;['Day', 'Session', 'Category', 'Exercises', 'Duration'].forEach((h, i) => doc.text(h, cols[i], y))
    y += hRow + 4

    for (const s of sessions) {
      const blocks = await fetchBlocks(s.id, orgId)
      let exCount = 0
      for (const b of blocks) {
        const exs = await fetchExercises(b.id, orgId)
        exCount += exs.length
      }
      doc.setTextColor(...TEXT)
      doc.text(sessionDayLabel(s), cols[0], y)
      doc.text(String(s.name || 'Session').slice(0, 28), cols[1], y)
      doc.text(String(sessionCategory(s)).slice(0, 12), cols[2], y)
      doc.text(String(exCount), cols[3], y)
      const dur = sessionDuration(s)
      doc.text(dur != null ? `${dur} min` : '—', cols[4], y)
      y += hRow + 2
      if (y > PAGE_H - 50) {
        addPageWeek(currentWeekNum)
        y = MARGIN
      }
    }
    y += 10

    const rowH = 6.8

    for (const s of sessions) {
      const blocks = await fetchBlocks(s.id, orgId)
      const blockExercises = []
      for (const b of blocks) {
        const exs = await fetchExercises(b.id, orgId)
        blockExercises.push({ block: b, exs })
      }
      const allSessionExercises = blockExercises.flatMap((be) => be.exs)
      const exerciseColVis = getVisibleExerciseColumns(allSessionExercises)
      const exerciseTableLayout = buildExerciseTableColumnLayout(exerciseColVis)

      const dur = sessionDuration(s)
      const headH = 14
      if (y + headH > PAGE_H - 40) {
        addPageWeek(currentWeekNum)
        y = MARGIN
      }
      doc.setFillColor(243, 244, 246)
      doc.rect(MARGIN, y, INNER_W, headH, 'F')
      doc.setFontSize(13)
      doc.setTextColor(...TEXT)
      doc.text(`${sessionDayLabel(s)} · ${String(s.name || 'Session').slice(0, 40)}`, MARGIN + 2, y + 6)
      doc.setFontSize(11)
      doc.setTextColor(...MUTED)
      doc.text(
        `${sessionTimeLabel(s)} · ${sessionCategory(s)} · ${dur != null ? `${dur} min planned` : '—'}`,
        MARGIN + 2,
        y + 11,
      )
      y += headH + 4

      for (const { block: b, exs } of blockExercises) {
        if (y + 12 > PAGE_H - 30) {
          addPageWeek(currentWeekNum)
          y = MARGIN
        }
        doc.setFontSize(10)
        doc.setTextColor(...MUTED)
        doc.text(`Block ${b.label || '—'} · ${b.format || '—'}`, MARGIN, y)
        y += 6

        doc.setFontSize(9)
        doc.setTextColor(...MUTED)
        doc.text('#', exerciseTableLayout.xNum, y)
        doc.text('Exercise', exerciseTableLayout.xEx, y)
        for (const c of exerciseTableLayout.cols) {
          doc.text(c.label, c.x, y)
        }
        y += 5
        let ri = 1
        for (const ex of exs) {
          if (y > PAGE_H - 28) {
            addPageWeek(currentWeekNum)
            y = MARGIN
          }
          const lib = libRow(ex)
          const name = lib?.name || 'Exercise'
          const vid = lib?.video_url
          const rm = rmMap.get(ex.exercise_id) ?? null
          const calculatedKg = ex.prescription_type === 'pct_1rm' && ex.prescription_value != null && rm != null
            ? Math.round((Number(ex.prescription_value) / 100) * Number(rm))
            : null
          const loadStr = formatLoad({ ...ex, calculated_kg: Number.isFinite(calculatedKg) ? calculatedKg : null })
          const yRow = y
          doc.setTextColor(...TEXT)
          doc.setFontSize(9)
          doc.text(String(ri), exerciseTableLayout.xNum, yRow)
          const exBand = exerciseTableLayout.exW
          const shortName = name.slice(0, 80)
          if (vid) {
            doc.setTextColor(...ORANGE)
            let linkLabel = `> ${shortName}`
            if (doc.getTextWidth(linkLabel) > exBand) linkLabel = `> ${shortName.slice(0, 40)}…`
            doc.textWithLink(linkLabel, exerciseTableLayout.xEx, yRow, { url: String(vid) })
          } else {
            const nm = doc.splitTextToSize(shortName, exBand)[0] || shortName
            doc.setTextColor(...TEXT)
            doc.text(nm, exerciseTableLayout.xEx, yRow)
          }
          doc.setTextColor(...TEXT)
          for (const c of exerciseTableLayout.cols) {
            const txt = cellForExerciseColumn(c.key, ex, loadStr)
            doc.text(txt, c.x, yRow)
          }
          y += rowH
          ri += 1
        }
        y += 4
      }

      const coach = s.coach_instructions && String(s.coach_instructions).trim()
      if (coach) {
        if (y > PAGE_H - 35) {
          addPageWeek(currentWeekNum)
          y = MARGIN
        }
        doc.setFontSize(11)
        doc.setTextColor(...MUTED)
        doc.setFont('helvetica', 'italic')
        const lines = doc.splitTextToSize(`Coach notes: ${coach}`, INNER_W - 4)
        doc.text(lines, MARGIN, y)
        doc.setFont('helvetica', 'normal')
        y += lines.length * 4 + 4
      }
      y += 6
    }
  }

  drawFooters(doc, athleteName, programmeName, weekLabelByPage, totalWeeks)
  doc.save(`${slug(athleteName)}_${slug(programmeName)}_Programme.pdf`)
}
