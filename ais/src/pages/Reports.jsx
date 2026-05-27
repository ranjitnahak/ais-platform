import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { useUser } from '../context/UserContext';
import AthleteReport from '../components/reports/AthleteReport';
import TeamReportConfig from '../components/reports/TeamReportConfig';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../lib/athleteName';
import Sidebar from '../components/Sidebar';

function AthleteInitials({ athlete }) {
  const initials = athleteInitialsFromAthlete(athlete);
  return (
    <div className="w-12 h-12 rounded-full bg-[#353437] flex items-center justify-center text-sm font-black text-white shrink-0" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {initials}
    </div>
  );
}

export default function Reports() {
  const [athletes, setAthletes]             = useState([]);
  const [teams, setTeams]                   = useState([]);
  const [athleteTeamsMap, setAthleteTeamsMap] = useState({});  // athleteId → [teamId]
  const [teamFilter, setTeamFilter]         = useState('All');
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [activeTab, setActiveTab]           = useState('individual');
  const [teamReportTeams, setTeamReportTeams] = useState([]);
  const [teamReportLoading, setTeamReportLoading] = useState(false);
  const [teamReportError, setTeamReportError] = useState(null);
  const [selectedTeamReportTeamId, setSelectedTeamReportTeamId] = useState('');

  const navigate = useNavigate();
  const { user } = useUser();

  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  useEffect(() => {
    loadAthletes();
  }, []);

  useEffect(() => {
    if (activeTab === 'team' && user) loadTeamReportTeams();
  }, [activeTab, user]);

  async function loadAthletes() {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      const { data, error: err } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, full_name, date_of_birth, gender, position, photo_url, email, is_active, org_id, organisations(name, sport, logo_url, secondary_logo_url, report_signatory_name, report_signatory_title)')
        .eq('org_id', currentUser.orgId)
        .eq('is_active', true)
        .order('full_name');
      if (err) throw err;
      setAthletes(data ?? []);

      // Fetch teams for this org
      const { data: teamRows, error: teamErr } = await supabase
        .from('teams')
        .select('id, name')
        .eq('org_id', currentUser.orgId)
        .order('name');
      if (teamErr) throw teamErr;
      setTeams(teamRows ?? []);

      const teamIds = (teamRows ?? []).map((team) => team.id);
      if (!teamIds.length) {
        setAthleteTeamsMap({});
        return;
      }

      // Fetch athlete-team memberships
      const { data: atRows, error: atErr } = await supabase
        .from('athlete_teams')
        .select('athlete_id, team_id')
        .in('team_id', teamIds);
      if (atErr) throw atErr;
      const atMap = {};
      for (const r of atRows ?? []) {
        if (!atMap[r.athlete_id]) atMap[r.athlete_id] = [];
        atMap[r.athlete_id].push(r.team_id);
      }
      setAthleteTeamsMap(atMap);
    } catch (err) {
      console.error('[Reports] loadAthletes failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamReportTeams() {
    try {
      setTeamReportLoading(true);
      setTeamReportError(null);
      if (!user?.teamIds?.length) {
        setTeamReportTeams([]);
        return;
      }
      const { data, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, sport')
        .eq('org_id', user.orgId)
        .in('id', user.teamIds)
        .order('name');
      if (teamsError) throw teamsError;
      setTeamReportTeams(data ?? []);
      setSelectedTeamReportTeamId((current) => current || data?.[0]?.id || '');
    } catch (err) {
      console.error('[Reports] loadTeamReportTeams failed:', err);
      setTeamReportError(err.message);
    } finally {
      setTeamReportLoading(false);
    }
  }

  async function generateReport(athlete) {
    setSelectedAthlete(athlete);
    setReportLoading(true);
    setReportError(null);
    setReportData(null);

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');
      // Find sessions containing this athlete's results
      const { data: sessionLinks, error: slErr } = await supabase
        .from('assessment_results')
        .select('session_id')
        .eq('org_id', currentUser.orgId)
        .eq('athlete_id', athlete.id);
      if (slErr) throw slErr;

      const sessionIds = [...new Set((sessionLinks ?? []).map((r) => r.session_id))];
      if (!sessionIds.length) throw new Error('No assessment results found for this athlete.');

      // Get the most recent of those sessions
      const { data: sessions, error: sessErr } = await supabase
        .from('assessment_sessions')
        .select('id, assessed_on, name, notes, org_id, team_id')
        .eq('org_id', currentUser.orgId)
        .in('id', sessionIds)
        .order('assessed_on', { ascending: false })
        .limit(1);
      if (sessErr) throw sessErr;

      const session = sessions?.[0];
      if (!session) throw new Error('Could not resolve session.');

      // Athlete results for that session with test definitions
      const { data: athleteResults, error: arErr } = await supabase
        .from('assessment_results')
        .select(`
          id,
          value,
          test_id,
          test_definitions (
            id,
            name,
            direction,
            unit
          )
        `)
        .eq('org_id', currentUser.orgId)
        .eq('athlete_id', athlete.id)
        .eq('session_id', session.id);
      if (arErr) throw arErr;

      // All squad results for same session — join athletes to filter by gender
      const { data: squadResults, error: sqErr } = await supabase
        .from('assessment_results')
        .select('athlete_id, value, test_id, athletes(gender)')
        .eq('org_id', currentUser.orgId)
        .eq('session_id', session.id);
      if (sqErr) throw sqErr;

      // Build map: testId → array of values from same-gender squad members only
      const athleteGender = athlete.gender?.toLowerCase() ?? null;
      const squadMap = {};
      for (const r of squadResults ?? []) {
        const rowGender = r.athletes?.gender?.toLowerCase() ?? null;
        if (athleteGender && rowGender && rowGender !== athleteGender) continue;
        if (!squadMap[r.test_id]) squadMap[r.test_id] = [];
        if (r.value != null) squadMap[r.test_id].push(r.value);
      }

      // Benchmarks for these tests + athlete gender
      const testIds = (athleteResults ?? []).map((r) => r.test_id).filter(Boolean);
      const { data: benchmarks, error: bmErr } = testIds.length
        ? await supabase
            .from('benchmarks')
            .select('*')
            .eq('org_id', currentUser.orgId)
            .in('test_id', testIds)
        : { data: [], error: null };
      if (bmErr) throw bmErr;

      // Compose results array with squad values attached
      const results = (athleteResults ?? [])
        .filter((r) => r.test_definitions != null)
        .map((r) => ({
          test_id: r.test_id,
          test_name: r.test_definitions.name ?? 'Unknown',
          value: r.value,
          unit: r.test_definitions.unit ?? null,
          direction: r.test_definitions.direction ?? 'higher_is_better',
          squadValues: squadMap[r.test_id] ?? [],
        }));

      const orgLogoUrl       = athlete.organisations?.logo_url ?? null;
      const signatoryName    = athlete.organisations?.report_signatory_name ?? null;
      const signatoryTitle   = athlete.organisations?.report_signatory_title ?? null;

      setReportData({ session, results, benchmarks: benchmarks ?? [], orgLogoUrl, signatoryName, signatoryTitle });
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportLoading(false);
    }
  }

  const filteredAthletes = useMemo(() => {
    if (teamFilter === 'All') return athletes;
    return athletes.filter((a) => (athleteTeamsMap[a.id] ?? []).includes(teamFilter));
  }, [athletes, teamFilter, athleteTeamsMap]);

  const selectedTeamReportTeam = teamReportTeams.find((team) => team.id === selectedTeamReportTeamId);

  return (
    <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen">
      <Sidebar />

      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-40 bg-[#131315]/70 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16 md:pl-72">
        <div className="flex items-center gap-4">
          <button
            className="material-symbols-outlined text-white md:hidden"
            onClick={() => navigate('/')}
          >
            arrow_back
          </button>
          <h1 className="font-['Inter'] text-xl font-bold tracking-tight text-white uppercase">
            {selectedAthlete && reportData ? athleteDisplayName(selectedAthlete) : 'Reports'}
          </h1>
          {selectedAthlete && reportData && (
            <button
              onClick={() => { setSelectedAthlete(null); setReportData(null); }}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              All Athletes
            </button>
          )}
        </div>
        <div className="flex items-center gap-5">
          <span className="material-symbols-outlined text-gray-400 hover:opacity-80 transition-opacity cursor-pointer">search</span>
          <div className="w-8 h-8 rounded-full bg-[#353437] flex items-center justify-center ghost-border">
            <span className="material-symbols-outlined text-sm text-gray-400">person</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-32 px-6 md:pl-72 max-w-7xl mx-auto">

        {!selectedAthlete && !reportLoading && (
          <div className="mb-6 flex flex-wrap gap-2 rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-2">
            {[
              { id: 'individual', label: 'Individual Reports' },
              { id: 'team', label: 'Team Reports' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {activeTab === 'individual' && loading && (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined text-[#F97316] animate-spin text-4xl">refresh</span>
          </div>
        )}

        {/* Error */}
        {activeTab === 'individual' && error && (
          <div className="bg-[#93000a]/20 border border-[#93000a]/40 p-4 rounded-lg text-[#EF4444] text-sm">
            Failed to load athletes: {error}
          </div>
        )}

        {/* Athlete List */}
        {activeTab === 'individual' && !loading && !error && !selectedAthlete && (
          <div className="space-y-6">

            {/* Team filter pills */}
            {teams.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTeamFilter('All')}
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
                    onClick={() => setTeamFilter(team.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                      teamFilter === team.id
                        ? 'bg-[#F97316] text-[#552100]'
                        : 'bg-[#2a2a2c] text-gray-400 hover:text-white'
                    }`}
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {filteredAthletes.length} athlete{filteredAthletes.length !== 1 ? 's' : ''} · select to generate report
                </p>
                <h2 className="text-3xl font-black tracking-tighter text-white uppercase">Athlete Reports</h2>
              </div>
            </div>

            {filteredAthletes.length === 0 ? (
              <div className="bg-[#2a2a2c] p-8 rounded-xl text-center text-gray-500 text-sm" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                No active athletes found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAthletes.map((athlete) => {
                  const age = athlete.date_of_birth
                    ? (() => {
                        const d = new Date(athlete.date_of_birth);
                        const t = new Date();
                        let a = t.getFullYear() - d.getFullYear();
                        if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
                        return a;
                      })()
                    : null;

                  return (
                    <div
                      key={athlete.id}
                      className="bg-[#2a2a2c] rounded-xl p-5 flex flex-col gap-4 hover:bg-[#39393b] transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-3">
                        {athlete.photo_url ? (
                          <img
                            src={athlete.photo_url}
                            alt={athleteDisplayName(athlete)}
                            className="w-12 h-12 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <AthleteInitials athlete={athlete} />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm truncate">{athleteDisplayName(athlete)}</h4>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight truncate">
                            {[athlete.position, athlete.organisations?.sport, age ? `Age ${age}` : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => generateReport(athlete)}
                        className="w-full py-2.5 bg-gradient-to-br from-[#FFB690] to-[#F97316] text-[#552100] font-black uppercase tracking-widest text-[10px] rounded-lg hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">assessment</span>
                        Generate Report
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && !selectedAthlete && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  Select a squad and choose report data sources
                </p>
                <h2 className="text-3xl font-black tracking-tighter text-[var(--color-on-surface)] uppercase">Team Reports</h2>
              </div>
              <select
                value={selectedTeamReportTeamId}
                onChange={(event) => setSelectedTeamReportTeamId(event.target.value)}
                className="min-w-64 rounded-xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] px-4 py-3 text-sm font-bold text-[var(--color-on-surface)]"
              >
                {teamReportTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            {teamReportLoading && (
              <div className="flex items-center justify-center py-16">
                <span className="material-symbols-outlined text-[var(--color-primary)] animate-spin text-4xl">refresh</span>
              </div>
            )}
            {teamReportError && (
              <div className="rounded-xl bg-[var(--color-error-container)]/20 border border-[var(--color-error-container)] p-4 text-sm text-[var(--color-error)]">
                Failed to load teams: {teamReportError}
              </div>
            )}
            {!teamReportLoading && !teamReportError && teamReportTeams.length === 0 && (
              <div className="rounded-xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] p-8 text-center text-sm text-[var(--color-on-surface-variant)]">
                No teams available for team reports.
              </div>
            )}
            {!teamReportLoading && selectedTeamReportTeam && (
              <TeamReportConfig
                teamId={selectedTeamReportTeam.id}
                teamName={selectedTeamReportTeam.name}
                onReportGenerated={(id) => navigate(`/reports/team/${id}`)}
              />
            )}
          </div>
        )}

        {/* Report Loading */}
        {reportLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="material-symbols-outlined text-[#F97316] animate-spin text-5xl">refresh</span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Compiling tactical report…
            </p>
          </div>
        )}

        {/* Report Error */}
        {reportError && (
          <div className="space-y-4">
            <div className="bg-[#93000a]/20 border border-[#93000a]/40 p-4 rounded-lg text-[#EF4444] text-sm">
              {reportError}
            </div>
            <button
              onClick={() => { setSelectedAthlete(null); setReportData(null); setReportError(null); }}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Athletes
            </button>
          </div>
        )}

        {/* Rendered Report */}
        {selectedAthlete && reportData && !reportLoading && !reportError && (
          <AthleteReport
            athlete={selectedAthlete}
            session={reportData.session}
            results={reportData.results}
            benchmarks={reportData.benchmarks}
            orgLogoUrl={reportData.orgLogoUrl}
            signatoryName={reportData.signatoryName}
            signatoryTitle={reportData.signatoryTitle}
          />
        )}
      </main>

      {/* Bottom Nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 bg-[#2A2A2C]/80 backdrop-blur-2xl border-t border-white/10 z-50 rounded-t-2xl">
        {[
          { icon: 'dashboard', label: 'Home',    to: '/'        },
          { icon: 'sensors',   label: 'Live',    to: '/'        },
          { icon: 'edit_note', label: 'Reports', to: '/reports' },
          { icon: 'settings',  label: 'Settings',to: '/settings'},
        ].map(({ icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-2 active:scale-90 transition-transform ${isActive ? 'text-[#F97316] scale-110' : 'text-gray-500 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {icon}
                </span>
                <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
