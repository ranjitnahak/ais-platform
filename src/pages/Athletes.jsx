import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AddAthleteModal from '../components/athletes/AddAthleteModal';
import Sidebar from '../components/Sidebar';

const ORG_ID = 'a1000000-0000-0000-0000-000000000001';

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeAge(dob) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
  return age;
}

function AthleteInitials({ name, size = 56 }) {
  const initials = name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: '#353437',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.3) + 'px', fontWeight: 900, color: '#e4e2e4',
        border: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

const CLASS_BADGE = {
  'Excellent':     'bg-[#22C55E]/10 text-[#22C55E]',
  'Above Average': 'bg-[#3B82F6]/10 text-[#3B82F6]',
  'Average':       'bg-[#F97316]/10 text-[#F97316]',
  'Below Average': 'bg-[#EF4444]/10 text-[#EF4444]',
};

function formatTier(tier) {
  if (!tier) return null;
  const known = { excellent: 'Excellent', above_average: 'Above Average', average: 'Average', below_average: 'Below Average' };
  return known[String(tier).toLowerCase()] ?? tier;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Athletes() {
  const navigate = useNavigate();

  const [athletes, setAthletes]             = useState([]);
  const [classMap, setClassMap]             = useState({});
  const [teams, setTeams]                   = useState([]);         // [{ id, name, gender, count }]
  const [athleteTeamsMap, setAthleteTeamsMap] = useState({});       // athleteId → [teamId]
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [showModal, setShowModal]           = useState(false);
  const [search, setSearch]                 = useState('');
  const [teamFilter, setTeamFilter]         = useState('All');
  const [genderFilter, setGenderFilter]     = useState('All');
  const [posFilter, setPosFilter]           = useState('All');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // ── Athletes ──────────────────────────────────────────────────────────
      const { data: rows, error: athErr } = await supabase
        .from('athletes')
        .select('id, full_name, date_of_birth, gender, position, photo_url, is_active, org_id, organisations(name, sport, logo_url)')
        .eq('is_active', true)
        .order('full_name');
      if (athErr) throw athErr;
      setAthletes(rows ?? []);

      // ── Teams ─────────────────────────────────────────────────────────────
      const { data: teamRows } = await supabase
        .from('teams')
        .select('id, name')
        .eq('org_id', ORG_ID)
        .order('name');

      // ── Athlete–team membership ───────────────────────────────────────────
      const athleteIds = (rows ?? []).map((a) => a.id);
      const atMap = {};      // athleteId → [teamId]
      const teamCounts = {}; // teamId → count

      if (athleteIds.length && teamRows?.length) {
        const { data: atRows } = await supabase
          .from('athlete_teams')
          .select('athlete_id, team_id')
          .in('athlete_id', athleteIds);

        for (const r of atRows ?? []) {
          if (!atMap[r.athlete_id]) atMap[r.athlete_id] = [];
          atMap[r.athlete_id].push(r.team_id);
          teamCounts[r.team_id] = (teamCounts[r.team_id] ?? 0) + 1;
        }
      }

      setAthleteTeamsMap(atMap);
      setTeams((teamRows ?? []).map((t) => ({ ...t, count: teamCounts[t.id] ?? 0 })));

      // ── Latest session classification ─────────────────────────────────────
      const { data: sessions } = await supabase
        .from('assessment_sessions')
        .select('id')
        .order('assessed_on', { ascending: false })
        .limit(1);

      if (sessions?.length) {
        const sessionId = sessions[0].id;
        const { data: results } = await supabase
          .from('assessment_results')
          .select('athlete_id, classification')
          .eq('session_id', sessionId);

        const map = {};
        for (const r of results ?? []) {
          if (!map[r.athlete_id]) map[r.athlete_id] = [];
          const label = formatTier(r.classification);
          if (label) map[r.athlete_id].push(label);
        }
        const TIER_SCORE = { 'Below Average': 1, 'Average': 2, 'Above Average': 3, 'Excellent': 4 };
        const SCORE_TIER = ['', 'Below Average', 'Average', 'Above Average', 'Excellent'];
        const classResult = {};
        for (const [id, tiers] of Object.entries(map)) {
          const scores = tiers.map((t) => TIER_SCORE[t]).filter(Boolean);
          if (scores.length) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            classResult[id] = SCORE_TIER[Math.round(avg)];
          }
        }
        setClassMap(classResult);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // When a team is selected, reset gender filter and derive locked gender
  function selectTeam(teamId) {
    setTeamFilter(teamId);
    setGenderFilter('All');
  }

  const selectedTeam   = teams.find((t) => t.id === teamFilter) ?? null;
  const selectedName   = selectedTeam?.name ?? '';
  // Hide gender filter row entirely when a gendered team is selected
  const showGenderRow  = teamFilter === 'All'
    || (!selectedName.includes('Men') && !selectedName.includes('Women'));

  const positions = ['All', 'Raider', 'Defender', 'All-Rounder'];
  const genders   = ['All', 'Male', 'Female'];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return athletes.filter((a) => {
      if (q && !a.full_name.toLowerCase().includes(q)) return false;
      if (genderFilter !== 'All' && a.gender?.toLowerCase() !== genderFilter.toLowerCase()) return false;
      if (posFilter !== 'All' && a.position?.toLowerCase() !== posFilter.toLowerCase()) return false;
      if (teamFilter !== 'All') {
        const memberOf = athleteTeamsMap[a.id] ?? [];
        if (!memberOf.includes(teamFilter)) return false;
      }
      return true;
    });
  }, [athletes, search, genderFilter, posFilter, teamFilter, athleteTeamsMap]);

  return (
    <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen">

      <Sidebar />

      {/* Top bar */}
      <header className="fixed top-0 w-full z-40 bg-[#131315]/70 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16 md:pl-72">
        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-white md:hidden" onClick={() => navigate('/')}>
            arrow_back
          </button>
          <div>
            <h1 className="font-['Inter'] text-xl font-bold tracking-tight text-white uppercase leading-none">Athletes</h1>
            {selectedTeam && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">
                {selectedTeam.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] text-[#552100] active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #FFB690, #F97316)' }}
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Add Athlete
          </button>
          <div className="w-8 h-8 rounded-full bg-[#353437] flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="material-symbols-outlined text-sm text-gray-400">person</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 pb-32 px-6 md:pl-72 max-w-7xl mx-auto space-y-6">

        {/* Search + Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search athletes…"
              className="w-full pl-9 pr-4 py-2.5 bg-[#2a2a2c] text-[#e4e2e4] text-sm rounded-lg outline-none placeholder-gray-500"
              style={{ border: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Inter', system-ui, sans-serif" }}
            />
          </div>

          {/* Team filter pills */}
          {teams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => selectTeam('All')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                  teamFilter === 'All'
                    ? 'bg-[#F97316] text-[#552100]'
                    : 'bg-[#2a2a2c] text-gray-400 hover:text-white'
                }`}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                All Teams
              </button>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => selectTeam(team.id)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                    teamFilter === team.id
                      ? 'bg-[#F97316] text-[#552100]'
                      : 'bg-[#2a2a2c] text-gray-400 hover:text-white'
                  }`}
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {team.name}{team.gender ? ` — ${team.gender}` : ''} ({team.count})
                </button>
              ))}
            </div>
          )}

          {/* Gender + Position filter pills */}
          <div className="flex flex-wrap gap-2">
            {/* Gender — hidden when a Men's or Women's team is selected */}
            {showGenderRow && genders.map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                  genderFilter === g
                    ? 'bg-[#F97316] text-[#552100]'
                    : 'bg-[#2a2a2c] text-gray-400 hover:text-white'
                }`}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {g}
              </button>
            ))}
            {showGenderRow && <div className="w-px bg-white/10 self-stretch mx-1" />}
            {positions.map((p) => (
              <button
                key={p}
                onClick={() => setPosFilter(p)}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                  posFilter === p
                    ? 'bg-[#F97316] text-[#552100]'
                    : 'bg-[#2a2a2c] text-gray-400 hover:text-white'
                }`}
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!loading && !error && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {filtered.length} athlete{filtered.length !== 1 ? 's' : ''}
            {(search || genderFilter !== 'All' || posFilter !== 'All' || teamFilter !== 'All') ? ' matching filters' : ''}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined text-[#F97316] animate-spin text-4xl">refresh</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#93000a]/20 border border-[#93000a]/40 p-4 rounded-lg text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        {/* Grid */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div
                className="bg-[#2a2a2c] p-12 rounded-xl text-center text-gray-500 text-sm"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {athletes.length === 0 ? 'No athletes yet. Add your first athlete.' : 'No athletes match the current filters.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((athlete) => {
                  const age = computeAge(athlete.date_of_birth);
                  const tier = classMap[athlete.id];
                  const badgeClass = CLASS_BADGE[tier];

                  return (
                    <button
                      key={athlete.id}
                      onClick={() => navigate(`/athletes/${athlete.id}`)}
                      className="bg-[#2a2a2c] rounded-xl p-5 flex flex-col gap-4 hover:bg-[#39393b] transition-colors text-left w-full active:scale-95"
                      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {/* Photo / initials */}
                      <div className="flex items-start justify-between">
                        {athlete.photo_url ? (
                          <img
                            src={athlete.photo_url}
                            alt={athlete.full_name}
                            className="rounded-full object-cover"
                            style={{ width: 56, height: 56, border: '2px solid #F97316' }}
                          />
                        ) : (
                          <AthleteInitials name={athlete.full_name} size={56} />
                        )}
                        {tier && badgeClass && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${badgeClass}`}>
                            {tier}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{athlete.full_name}</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight mt-0.5 truncate">
                          {[athlete.position, athlete.gender, age ? `Age ${age}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {athlete.organisations?.name && (
                          <p className="text-[10px] text-gray-600 mt-1 truncate">{athlete.organisations.name}</p>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-end">
                        <span className="material-symbols-outlined text-gray-600 text-sm">chevron_right</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 bg-[#2A2A2C]/80 backdrop-blur-2xl border-t border-white/10 z-50 rounded-t-2xl">
        {[
          { icon: 'dashboard', label: 'Home',    to: '/'        },
          { icon: 'person',    label: 'Athletes', to: '/athletes'},
          { icon: 'edit_note', label: 'Reports', to: '/reports' },
          { icon: 'settings',  label: 'Settings', to: '/settings'},
        ].map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-2 transition-transform ${isActive ? 'text-[#F97316] scale-110' : 'text-gray-500 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
                <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Modal */}
      {showModal && (
        <AddAthleteModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
