import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, can } from '../lib/auth';
import Sidebar from '../components/Sidebar';
import TeamDetailModal from '../components/settings/TeamDetailModal';

// ── Helpers ────────────────────────────────────────────────────────────────────

function teamInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Nav item ───────────────────────────────────────────────────────────────────

function NavItem({ label, tabKey, activeTab, onClick, disabled, badge }) {
  const isActive = activeTab === tabKey && !disabled;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'w-full text-left px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center justify-between',
        isActive
          ? 'bg-[#2a2a2c] text-white'
          : disabled
          ? 'text-gray-600 cursor-default'
          : 'text-gray-500 hover:text-white',
      ].join(' ')}
      style={
        isActive
          ? { borderLeft: '2px solid #F97316', borderRadius: 0 }
          : { borderLeft: '2px solid transparent' }
      }
    >
      <span>{label}</span>
      {badge && (
        <span className="bg-[#2a2a2c] text-gray-600 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Teams tab ──────────────────────────────────────────────────────────────────

function TeamsTab() {
  const [teams, setTeams]               = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    setLoadingTeams(true);
    try {
      const user = getCurrentUser();

      const { data: teamRows, error: teamErr } = await supabase
        .from('teams')
        .select('id, name, sport, gender, logo_url')
        .eq('org_id', user.orgId)
        .order('name');
      console.log('orgId:', getCurrentUser().orgId)
      console.log('teams data:', teamRows)
      console.log('teams error:', teamErr)
      if (teamErr) throw teamErr;

      const { data: memberRows } = await supabase
        .from('athlete_teams')
        .select('team_id')
        .in('team_id', (teamRows ?? []).map(t => t.id));

      const countMap = {};
      for (const row of memberRows ?? []) {
        countMap[row.team_id] = (countMap[row.team_id] ?? 0) + 1;
      }

      const teamsWithCounts = (teamRows ?? []).map(t => ({
        ...t,
        memberCount: countMap[t.id] ?? 0,
      }));
      setTeams(teamsWithCounts);
    } catch (err) {
      console.error('[Settings] loadTeams failed:', err);
    } finally {
      setLoadingTeams(false);
    }
  }

  function handleClose() {
    setSelectedTeam(null);
    setShowCreateTeam(false);
  }

  function handleSaved() {
    setSelectedTeam(null);
    setShowCreateTeam(false);
    loadTeams();
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">Teams</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Create and manage squads, upload team logos
          </p>
        </div>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="bg-[#F97316] text-[#552100] text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg active:scale-95 transition-transform"
        >
          + Create team
        </button>
      </div>

      {/* List */}
      <div className="space-y-3 mt-4">
        {loadingTeams ? (
          <div className="flex justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-[#F97316] text-2xl">
              progress_activity
            </span>
          </div>
        ) : teams.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center text-gray-600 text-sm"
            style={{ border: '1px dashed rgba(255,255,255,0.1)' }}
          >
            No teams yet. Click '+ Create team' to get started.
          </div>
        ) : (
          teams.map((team) => {
            const meta = [team.sport, team.gender, team.memberCount != null ? `${team.memberCount} athletes` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className="w-full bg-[#2a2a2c] rounded-xl px-4 py-3 flex items-center gap-4 hover:bg-[#39393b] transition-colors cursor-pointer text-left"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {/* Logo / initials */}
                <div
                  className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{ background: team.logo_url ? undefined : '#353437' }}
                >
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#F97316] text-xs font-black">
                      {teamInitials(team.name)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{team.name}</p>
                  {meta && (
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 truncate">
                      {meta}
                    </p>
                  )}
                </div>

                {/* Badges + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="bg-[#22C55E]/10 text-[#22C55E] text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                    Active
                  </span>
                  <span className="material-symbols-outlined text-gray-600 text-sm">
                    chevron_right
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Modal */}
      {(selectedTeam !== null || showCreateTeam) && (
        <TeamDetailModal
          team={showCreateTeam ? null : selectedTeam}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ── Test Setup tab ─────────────────────────────────────────────────────────────

function TestSetupTab() {
  const [tests, setTests]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const user = getCurrentUser();
        const { data, error } = await supabase
          .from('test_definitions')
          .select('id, name, unit, direction')
          .eq('org_id', user.orgId)
          .order('name');
        if (error) throw error;
        setTests(data ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-white font-bold text-base">Test Setup</h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          View the performance tests configured for your organisation
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-[#F97316] text-2xl">
            progress_activity
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test) => {
            const isHigher = test.direction !== 'lower';
            return (
              <div
                key={test.id}
                className="bg-[#2a2a2c] rounded-lg px-4 py-3 flex items-center gap-4"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="text-white text-sm font-bold flex-1">{test.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {test.unit && (
                    <span className="bg-[#353437] text-gray-400 text-[10px] px-2 py-0.5 rounded">
                      {test.unit}
                    </span>
                  )}
                  <span
                    className={[
                      'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded',
                      isHigher
                        ? 'bg-[#22C55E]/10 text-[#22C55E]'
                        : 'bg-[#3B82F6]/10 text-[#3B82F6]',
                    ].join(' ')}
                  >
                    {isHigher ? 'Higher is better' : 'Lower is better'}
                  </span>
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-gray-600 mt-4 px-1">
            Test definitions are configured at the platform level.
            Contact your administrator to add or modify tests.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [activeTab, setActiveTab] = useState('teams');

  if (!can('adminConfig', 'admin')) {
    return (
      <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen">
        <Sidebar />
        <div className="pt-24 pb-32 px-6 md:pl-72 flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Access restricted — admin permission required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen">
      <Sidebar />

      {/* Fixed header */}
      <header className="fixed top-0 w-full z-40 bg-[#131315]/70 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16 md:pl-72">
        <div>
          <h1 className="font-['Inter'] text-xl font-bold tracking-tight text-white uppercase leading-none">
            Settings
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
            style={{
              color: '#F97316',
              background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.2)',
            }}
          >
            Admin
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 pb-32 px-6 md:pl-72">
        <div className="flex min-h-[calc(100vh-6rem)]">

          {/* Settings nav */}
          <aside
            className="flex-shrink-0 pt-2"
            style={{ width: 180, borderRight: '1px solid rgba(255,255,255,0.05)' }}
          >
            {/* SETUP */}
            <p className="text-[10px] uppercase tracking-widest text-gray-500 px-4 pb-2 mt-4">
              Setup
            </p>
            <NavItem
              label="Teams"
              tabKey="teams"
              activeTab={activeTab}
              onClick={() => setActiveTab('teams')}
            />
            <NavItem
              label="Test Setup"
              tabKey="tests"
              activeTab={activeTab}
              onClick={() => setActiveTab('tests')}
            />

            {/* ACCESS */}
            <p className="text-[10px] uppercase tracking-widest text-gray-500 px-4 pb-2 mt-4">
              Access
            </p>
            <NavItem label="Users" disabled badge="V2" />
            <NavItem label="Roles" disabled badge="V2" />

            {/* ORGANISATION */}
            <p className="text-[10px] uppercase tracking-widest text-gray-500 px-4 pb-2 mt-4">
              Organisation
            </p>
            <NavItem label="Organisation" disabled badge="V2" />
          </aside>

          {/* Tab content */}
          <div className="flex-1 pl-8 pt-2">
            {activeTab === 'teams' && <TeamsTab />}
            {activeTab === 'tests' && <TestSetupTab />}
          </div>

        </div>
      </main>
    </div>
  );
}
