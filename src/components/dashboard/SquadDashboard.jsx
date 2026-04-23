import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { supabase } from '../../lib/supabase';
import { classifyScore } from '../../lib/scoring';
import { athleteDisplayName, athleteInitialsFromAthlete } from '../../lib/athleteName';

// Maps a classification tier to Tailwind colour classes for badge + progress bar
const CLASSIFICATION_STYLES = {
  'Excellent':     { badge: 'bg-[#22C55E]/10 text-[#22C55E]', bar: 'bg-[#22C55E]' },
  'Above Average': { badge: 'bg-[#3B82F6]/10 text-[#3B82F6]', bar: 'bg-[#3B82F6]' },
  'Average':       { badge: 'bg-[#F97316]/10 text-[#F97316]', bar: 'bg-[#F97316]' },
  'Below Average': { badge: 'bg-[#93000a]/10 text-[#EF4444]',  bar: 'bg-[#EF4444]' },
  'Unclassified':  { badge: 'bg-white/5 text-gray-400',        bar: 'bg-white/10' },
};

function classifyFromPercentile(p) {
  if (p == null) return 'Unclassified';
  if (p >= 75)   return 'Excellent';
  if (p >= 50)   return 'Above Average';
  if (p >= 25)   return 'Average';
  return 'Below Average';
}

function AthleteInitials({ athlete }) {
  const initials = athleteInitialsFromAthlete(athlete);
  return (
    <div className="w-12 h-12 rounded-full bg-[#353437] flex items-center justify-center text-sm font-black text-white ghost-border shrink-0">
      {initials}
    </div>
  );
}

function KpiCard({ label, value, unit, valueClass = 'text-white' }) {
  return (
    <div className="bg-[#2a2a2c] ghost-border p-5 rounded-lg flex flex-col justify-between h-32">
      <span className="font-label text-[10px] uppercase tracking-widest text-gray-400">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-black tracking-tighter ${valueClass}`}>{value ?? '--'}</span>
        {unit && <span className="text-gray-500 text-xs font-bold font-label">{unit}</span>}
      </div>
    </div>
  );
}

export default function SquadDashboard() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // 1. Fetch all athletes
      const { data: athleteRows, error: athErr } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, full_name, date_of_birth, gender, position, photo_url, is_active, org_id, organisations(name, sport, logo_url)');
      if (athErr) throw athErr;

      // 2. Find the most recent assessment session
      const { data: sessions, error: sessErr } = await supabase
        .from('assessment_sessions')
        .select('id, assessed_on')
        .order('assessed_on', { ascending: false })
        .limit(1);
      if (sessErr) throw sessErr;

      if (!sessions?.length) {
        setAthletes(
          (athleteRows ?? []).map((a) => ({
            ...a,
            overallPercentile: null,
            classification: 'Unclassified',
          }))
        );
        setLoading(false);
        return;
      }

      const latestSessionId = sessions[0].id;

      // 3. Fetch all results for that session, joining test definitions
      const { data: results, error: resErr } = await supabase
        .from('assessment_results')
        .select(`
          id,
          athlete_id,
          value,
          test_id,
          test_definitions (
            id,
            name,
            direction
          )
        `)
        .eq('session_id', latestSessionId);
      if (resErr) throw resErr;

      // 4. Fetch benchmarks (for gender-matched absolute classification)
      const { data: benchmarks, error: benchErr } = await supabase
        .from('benchmarks')
        .select('*');
      if (benchErr) throw benchErr;

      // 5. Build per-test squad value arrays
      const testMap = {};
      for (const r of results ?? []) {
        const id = r.test_id;
        if (!testMap[id]) {
          testMap[id] = {
            name: r.test_definitions?.name,
            direction: r.test_definitions?.direction ?? 'higher_is_better',
            entries: [],
          };
        }
        testMap[id].entries.push({ athleteId: r.athlete_id, value: r.value });
      }

      // 6. Classify each athlete across all their tests → derive overall percentile
      const enriched = (athleteRows ?? []).map((athlete) => {
        const athleteResults = (results ?? []).filter(
          (r) => r.athlete_id === athlete.id
        );

        const percentiles = [];

        for (const result of athleteResults) {
          const testId = result.test_id;
          const testInfo = testMap[testId];
          if (!testInfo || result.value == null) continue;

          const squadValues = testInfo.entries.map((e) => e.value);
          const testBenchmarks = (benchmarks ?? []).filter(
            (b) =>
              b.test_id === testId &&
              b.gender === athlete.gender
          );

          const { percentileRank } = classifyScore({
            value: result.value,
            gender: athlete.gender,
            direction: testInfo.direction,
            benchmarks: testBenchmarks,
            squadValues,
          });

          if (percentileRank != null) percentiles.push(percentileRank);
        }

        const overallPercentile =
          percentiles.length > 0
            ? Math.round(
                percentiles.reduce((a, b) => a + b, 0) / percentiles.length
              )
            : null;

        return {
          ...athlete,
          overallPercentile,
          classification: classifyFromPercentile(overallPercentile),
        };
      });

      // Sort by percentile descending (unclassified athletes go last)
      enriched.sort(
        (a, b) => (b.overallPercentile ?? -1) - (a.overallPercentile ?? -1)
      );

      setAthletes(enriched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const belowThreshold = athletes.filter((a) => a.classification === 'Below Average');
  const classifiedAthletes = athletes.filter((a) => a.overallPercentile != null);
  const squadReadiness =
    classifiedAthletes.length > 0
      ? Math.round(
          classifiedAthletes.reduce((sum, a) => sum + a.overallPercentile, 0) /
            classifiedAthletes.length
        )
      : null;

  return (
    <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen">
      <Sidebar />

      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-40 bg-[#131315]/70 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16 md:pl-72">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-gray-400 md:hidden">menu</span>
          <h1 className="font-['Inter'] text-xl font-bold tracking-tight text-white">Squad Dashboard</h1>
        </div>
        <div className="flex items-center gap-5">
          <span className="material-symbols-outlined text-gray-400 hover:opacity-80 transition-opacity cursor-pointer">search</span>
          <div className="w-8 h-8 rounded-full overflow-hidden ghost-border bg-[#353437] flex items-center justify-center">
            <span className="material-symbols-outlined text-sm text-gray-400">person</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-32 px-6 md:pl-72 max-w-7xl mx-auto space-y-8">

        {/* Loading / error states */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined text-[#F97316] animate-spin text-4xl">refresh</span>
          </div>
        )}

        {error && (
          <div className="bg-[#93000a]/20 border border-[#93000a]/40 p-4 rounded-lg text-[#EF4444] text-sm">
            Failed to load dashboard data: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* KPI Grid */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Squad Readiness"
                value={squadReadiness}
                unit="%"
                valueClass="text-white"
              />
              <KpiCard label="Avg Heart Rate" value={null} unit="BPM" />
              <KpiCard label="Avg Sleep" value={null} unit="HRS" />
              <KpiCard
                label="Athletes Assessed"
                value={classifiedAthletes.length || null}
                unit={`/ ${athletes.length}`}
                valueClass="text-[#F97316]"
              />
            </section>

            {/* Critical Fatigue Alert */}
            {belowThreshold.length > 0 && (
              <div className="bg-[#F97316]/10 border border-[#F97316]/40 p-4 rounded-lg flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#F97316] flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
                <div>
                  <h4 className="font-bold text-white tracking-tight">Below-Average Readiness Alert</h4>
                  <p className="text-sm text-[#e0c0b1]">
                    {belowThreshold.length === 1
                      ? `${athleteDisplayName(belowThreshold[0])} is`
                      : `${belowThreshold.map((a) => athleteDisplayName(a)).join(', ')} are`}{' '}
                    currently below readiness threshold.
                  </p>
                </div>
                <button className="ml-auto text-xs font-bold uppercase tracking-widest text-[#F97316] hover:underline whitespace-nowrap">
                  Review Now
                </button>
              </div>
            )}

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Athlete Matrix */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-end mb-2">
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">Athlete Matrix</h2>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                    Sorted by: Readiness
                  </span>
                </div>

                {athletes.length === 0 ? (
                  <div className="bg-[#2a2a2c] ghost-border p-8 rounded-lg text-center text-gray-500 text-sm">
                    No athletes found. Add athletes to your roster to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {athletes.map((athlete) => {
                      const styles = CLASSIFICATION_STYLES[athlete.classification] ?? CLASSIFICATION_STYLES['Unclassified'];
                      const barWidth = athlete.overallPercentile != null
                        ? `${Math.max(4, athlete.overallPercentile)}%`
                        : '4%';
                      const subtitle = [athlete.position]
                        .filter(Boolean)
                        .join(' / ');

                      return (
                        <div
                          key={athlete.id}
                          className="bg-[#2a2a2c] ghost-border p-4 rounded-lg flex items-center gap-4 hover:bg-[#39393b] transition-colors"
                        >
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
                            {subtitle && (
                              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter truncate">
                                {subtitle}
                              </p>
                            )}
                          </div>

                          {/* Percentile progress bar */}
                          <div className="hidden md:block w-32 px-4">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full progress-bar-angled ${styles.bar}`}
                                style={{ width: barWidth }}
                              />
                            </div>
                            {athlete.overallPercentile != null && (
                              <p className="text-[9px] text-gray-500 text-right mt-1">
                                {athlete.overallPercentile}th %ile
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${styles.badge}`}>
                              {athlete.classification}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-8">
                {/* Squad Load Distribution — static chart (daily load data not yet in schema) */}
                <div className="bg-[#2a2a2c] ghost-border p-6 rounded-lg">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6">
                    Squad Load Distribution
                  </h3>
                  <div className="flex items-end justify-between h-40 gap-2 px-2">
                    {[
                      { day: 'Mon', h: '40%',  today: false },
                      { day: 'Tue', h: '65%',  today: false },
                      { day: 'Wed', h: '90%',  today: true  },
                      { day: 'Thu', h: '55%',  today: false },
                      { day: 'Fri', h: '75%',  today: false },
                      { day: 'Sat', h: '30%',  today: false },
                      { day: 'Sun', h: '10%',  today: false },
                    ].map(({ day, h, today }) => (
                      <div key={day} className="flex flex-col items-center gap-2 flex-1">
                        <div
                          className={`w-full rounded-t-sm ${today ? 'bg-[#F97316]/80 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-white/5'}`}
                          style={{ height: h }}
                        />
                        <span className={`text-[8px] font-bold uppercase ${today ? 'text-white' : 'text-gray-500'}`}>
                          {day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-4">
                  <button className="w-full py-4 bg-gradient-to-br from-[#FFB690] to-[#F97316] text-[#552100] font-black uppercase tracking-widest text-sm rounded-lg shadow-lg active:scale-95 transition-transform">
                    Join Live Session
                  </button>
                  <button className="w-full py-4 ghost-border bg-[#353437] text-white font-black uppercase tracking-widest text-sm rounded-lg hover:bg-white/10 transition-colors">
                    Export Full Report
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* FAB — mobile */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-[#F97316] rounded-full shadow-2xl flex items-center justify-center text-white z-50 md:hidden active:scale-90 transition-transform">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>

      {/* Bottom Nav — mobile */}
      <footer className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 bg-[#2A2A2C]/80 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_24px_rgba(249,115,22,0.1)] z-50 rounded-t-2xl">
        {[
          { icon: 'dashboard', label: 'Live',    to: '/'        },
          { icon: 'sensors',   label: 'Data',    to: '/'        },
          { icon: 'edit_note', label: 'Reports', to: '/reports' },
          { icon: 'settings',  label: 'Sets',    to: '/settings'},
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
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
                <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </footer>
    </div>
  );
}
