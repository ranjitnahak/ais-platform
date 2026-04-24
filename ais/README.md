# Athlete Intelligence System (AIS)

> A globally competitive, sport-agnostic athlete management platform.
> Built to be faster, smarter, and cleaner than Smartabase.

---

## Vision

AIS is not a camp tool. It is a full-stack athlete management platform designed to compete globally — serving S&C coaches, physios, head coaches, analysts, team managers, and athletes across any sport, any organisation, any country.

**Core philosophy:** Smart defaults over drag-and-drop builders. Every user role sees exactly what they need the moment they log in — no configuration required, full customisation available when needed.

**Where AIS beats Smartabase:**
- Faster, cleaner UI — no training required
- Professional PDF output — reports that look like reports, not database exports
- Minimal clicks for data entry — bulk entry, inline classification, no page reloads
- Sport-agnostic intelligence — configurable tests, benchmarks, and classifications per org
- Fully owned — your data, your infrastructure, zero per-athlete licensing cost

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite | Fast dev, reusable components |
| UI Design | Google Stitch | Visual component generation |
| Database | Supabase (PostgreSQL) | Real-time, RLS, auth built-in |
| IDE | Cursor | AI-assisted development |
| PDF Generation | jsPDF | Client-side, no server needed |
| Charts | Chart.js | Radar + bar charts for athlete profiles |
| Hosting | TBD (Vercel / Netlify) | One-click deploy |

---

## Architecture — 4 Interface Layers

```
┌─────────────────────────────────────┐
│  Superuser (AIS platform owner)     │  ← V3
│  Manage all orgs, billing, config   │
├─────────────────────────────────────┤
│  Admin (org/team manager)           │  ← V2
│  Users, roles, sport config         │
├─────────────────────────────────────┤
│  Staff (S&C, physio, head coach)    │  ← MVP (today)
│  Roster, assessments, reports       │
├─────────────────────────────────────┤
│  Athlete (self-view portal)         │  ← V2
│  Own data, feedback, plans          │
└─────────────────────────────────────┘
```

**Key design decision:** The database schema is built for all 4 layers from day one. UI for Admin, Athlete, and Superuser layers comes in V2/V3 — but no schema rebuild will ever be needed.

---

## Database Schema

12 tables, designed for multi-org, multi-sport, role-based access from day one.

| Table | Purpose |
|---|---|
| `organisations` | Top-level entity — one per team/federation/academy |
| `users` | Extends Supabase auth — role-based, org-scoped |
| `teams` | Squads within an org (Senior, U23, Academy) |
| `athletes` | Core athlete profiles |
| `athlete_teams` | Many-to-many athlete ↔ team membership |
| `test_definitions` | Configurable tests per org — sport-agnostic |
| `benchmarks` | Per test, per gender, per classification tier |
| `assessment_sessions` | A testing event (e.g. "Pre-Camp Jan 2026") |
| `assessment_results` | One row per athlete per test per session |
| `dashboard_layouts` | Per-user widget preferences (JSON) |
| `camps` | Time-bounded training events |
| `audit_log` | Full data change history |

Row Level Security (RLS) enforced — users only access their own org's data.

---

## MVP Scope (v1.0)

**What's built in v1.0:**

- [ ] Athlete roster — add, edit, view (name, gender, age, position)
- [ ] Assessment session creation
- [ ] Bulk score entry for all athletes in one session
- [ ] Auto-classification on entry (men: benchmarks, women: squad percentile)
- [ ] Athlete profile page — scores, classification badges, radar chart
- [ ] PDF assessment report — per athlete, one-click download
- [ ] Squad dashboard — sortable table, filter by gender/position/classification

**Not in MVP (V2+):**

- Training plan generator (separate project)
- Wellness & RPE tracking
- Injury & medical module
- Re-test tracking and trend analytics
- Athlete self-view portal
- Admin configuration UI
- Mobile app

---

## Project Structure

```
ais/
├── src/
│   ├── components/
│   │   ├── athletes/        # Roster, profile, athlete card
│   │   ├── assessments/     # Session entry, score table
│   │   ├── dashboard/       # Squad overview, filters
│   │   ├── reports/         # PDF generation
│   │   └── shared/          # Buttons, badges, nav, layout
│   ├── lib/
│   │   ├── supabase.js      # Supabase client
│   │   ├── scoring.js       # Classification engine
│   │   └── pdf.js           # PDF generation helpers
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Athletes.jsx
│   │   ├── AthleteProfile.jsx
│   │   ├── AssessmentEntry.jsx
│   │   └── Reports.jsx
│   └── App.jsx
├── supabase/
│   └── schema.sql           # Full database schema + seed data
├── .env.local               # Supabase credentials (never commit)
├── README.md
└── package.json
```

---

## Setup Instructions

### 1. Supabase

1. Go to your Supabase project → SQL Editor
2. Paste and run `supabase/schema.sql`
3. Confirm all 12 tables created successfully

### 2. Environment Variables

Create `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://cwyesqbxcczgbkkekhsc.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

> ⚠️ Never commit `.env.local` to version control.

### 3. Local Development

```bash
npm install
npm run dev
```

---

## Roadmap

### V1 — MVP (current)
Roster + Assessment entry + Classification + PDF report + Squad dashboard

### V2 — Full Staff Platform
Training plans · Wellness & RPE · Re-test tracking · Injury module · Athlete portal · Admin config UI

### V3 — Global Product
Multi-org superuser · Billing · Mobile app · API · Integrations (GPS, wearables)

---

## Benchmarks — Kabaddi (Men)

| Test | Below average | Average | Above average | Excellent |
|---|---|---|---|---|
| Sit & Reach (cm) | ≤34.8 | 34.8–41 | 41–45 | >45 |
| Chest Pass (m) | ≤4.7 | 4.7–5.498 | 5.498–5.832 | >5.832 |
| Broad Jump (m) | ≤2.288 | 2.288–2.5 | 2.5–2.66 | >2.66 |
| Sprint 5m (s) | ≥1.13 | 1.13–1.04 | 1.04–1.006 | <1.006 |
| Sprint 10m (s) | ≥0.774 | 0.774–0.73 | 0.73–0.71 | <0.71 |
| Sprint 20m (s) | ≥1.37 | 1.37–1.28 | 1.28–1.26 | <1.26 |
| Sprint Total (s) | ≥3.2322 | 3.2322–3.05 | 3.05–2.9707 | <2.9707 |
| Yo-Yo IR1 (level) | ≤15.5 | 15.5–16.5 | 16.5–17.3 | >17.3 |

Women: squad percentile rank (no external benchmarks applied).

---

## Notes & Decisions

- **No Builder layer** — customisation is inline, not a separate mode
- **Dashboard layouts stored as JSONB** — new widget types require no schema changes
- **score_direction field** — handles both "higher is better" and "lower is better" tests cleanly in a single scoring engine
- **Benchmarks are org-scoped** — different orgs can have different standards for the same test

---

*AIS — Built to be better.*
