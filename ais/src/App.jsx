import { useEffect, useLayoutEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DashboardWellness from './pages/dashboard/DashboardWellness';
import DashboardRPE from './pages/dashboard/DashboardRPE';
import AssessmentDashboard from './pages/dashboard/AssessmentDashboard';
import Log from './pages/Log';
import Reports from './pages/Reports';
import AthleteReportView from './pages/AthleteReportView';
import TeamReportView from './pages/TeamReportView';
import StaffLogReportView from './pages/StaffLogReportView';
import Athletes from './pages/Athletes';
import AthleteProfile from './pages/AthleteProfile';
import AthleteHome from './pages/AthleteHome';
import Periodisation from './pages/Periodisation';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import UserDetailPage from './pages/UserDetailPage';
import SuperuserPanel from './pages/SuperuserPanel';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { supabase } from './lib/supabase';
import { useUser } from './context/UserContext';
import AthleteLayout from './components/layout/AthleteLayout';
import BottomNav from './components/layout/BottomNav';
import AthleteData from './pages/AthleteData';
import AthleteLog from './pages/AthleteLog';
import AthleteProfileSelf from './pages/AthleteProfileSelf';
import AthleteSettings from './pages/AthleteSettings';
import { getDefaultStaffHomeRoute } from './nav/navResourceMap';
import AppLoadingScreen from './components/shared/AppLoadingScreen';
import { hasAuthCallbackInUrl } from './lib/authRedirect';

const PUBLIC_PATHS = ['/login', '/reset-password'];

function AuthRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY') return;
      if (location.pathname === '/reset-password') return;
      navigate('/reset-password', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [location.pathname, navigate]);

  useLayoutEffect(() => {
    const hasCallback = hasAuthCallbackInUrl(location.search, location.hash);
    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/09400f1d-2f1d-444b-9de1-5295367ffdb1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7b82e9'},body:JSON.stringify({sessionId:'7b82e9',runId:'post-fix-2',hypothesisId:'H1-H2',location:'App.jsx:AuthRecoveryRedirect',message:'AuthRecoveryRedirect layout',data:{pathname:location.pathname,searchLen:location.search.length,hashLen:location.hash.length,hasCallback},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (location.pathname === '/reset-password') return;
    if (!hasCallback) return;
    navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

function Placeholder({ title }) {
  return (
    <div className="bg-[var(--color-background)] text-[var(--color-on-background)] font-['Inter'] min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <span className="material-symbols-outlined text-5xl text-[var(--color-outline)]">construction</span>
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-on-surface)]">{title}</h1>
        <p className="text-sm text-[var(--color-on-surface-variant)] uppercase tracking-widest font-bold">Coming soon</p>
      </div>
    </div>
  );
}

function RoleLoading() {
  return <AppLoadingScreen />;
}

const ACCOUNT_SETUP_MESSAGE =
  'Account setup incomplete. Please contact your administrator.';

const ACCOUNT_DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Please contact your administrator.';

function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const { user, loading: userLoading } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  const needsProfile = Boolean(session && !isPublicPath);
  const profileChecking = needsProfile && userLoading && !user;
  const profileFailed = needsProfile && !userLoading && !user;

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setCheckingSession(false);
    }

    checkSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profileFailed || !session?.user?.id) return;
    void (async () => {
      const { data: profileRow } = await supabase
        .from('users')
        .select('is_active')
        .eq('auth_id', session.user.id)
        .maybeSingle();
      const message = profileRow?.is_active === false
        ? ACCOUNT_DEACTIVATED_MESSAGE
        : ACCOUNT_SETUP_MESSAGE;
      await supabase.auth.signOut();
      navigate('/login', { replace: true, state: { message } });
    })();
  }, [profileFailed, navigate, session?.user?.id]);

  useEffect(() => {
    if (!checkingSession && !session && !isPublicPath) {
      navigate('/login', { replace: true });
    }
  }, [checkingSession, isPublicPath, navigate, session]);

  if (checkingSession || profileChecking || profileFailed) return <AppLoadingScreen />;
  if (!session && !isPublicPath) return <AppLoadingScreen />;

  return children;
}

function HomeRedirect({ user }) {
  const location = useLocation();
  const hasCallback = hasAuthCallbackInUrl(location.search, location.hash);
  if (hasCallback) {
    return <AppLoadingScreen />;
  }
  if (!user) return <RoleLoading />;
  if (user.role?.toLowerCase() === 'athlete') return <Navigate to="/athlete-home" replace />;
  return <Navigate to={getDefaultStaffHomeRoute(user)} replace />;
}

function AthleteRouteGuard({ user }) {
  if (!user) return <RoleLoading />;
  if (user.role?.toLowerCase() !== 'athlete') {
    return <Navigate to={getDefaultStaffHomeRoute(user)} replace />;
  }
  return (
    <AthleteLayout>
      <Outlet />
    </AthleteLayout>
  );
}

function StaffRouteGuard({ user }) {
  if (!user) return <RoleLoading />;
  if (user.role?.toLowerCase() === 'athlete') return <Navigate to="/athlete-home" replace />;
  return (
    <>
      <BottomNav variant="staff" />
      <Outlet />
    </>
  );
}

export default function App() {
  const { user: resolvedUser, loading: checkingUser } = useUser();

  return (
    <BrowserRouter>
      <AuthRecoveryRedirect />
      <AuthGate>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/" element={<HomeRedirect user={checkingUser ? null : resolvedUser} />} />

          <Route element={<AthleteRouteGuard user={checkingUser ? null : resolvedUser} />}>
            <Route path="/athlete-home" element={<AthleteHome />} />
            <Route path="/athlete-log" element={<AthleteLog />} />
            <Route path="/athlete-data" element={<AthleteData />} />
            <Route path="/athlete-settings" element={<AthleteSettings />} />
            <Route path="/athlete-profile" element={<AthleteProfileSelf />} />
            <Route path="*" element={<Navigate to="/athlete-home" replace />} />
          </Route>

          <Route element={<StaffRouteGuard user={checkingUser ? null : resolvedUser} />}>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<Navigate to="wellness" replace />} />
              <Route path="wellness" element={<DashboardWellness />} />
              <Route path="rpe" element={<DashboardRPE />} />
              <Route path="assessment" element={<AssessmentDashboard />} />
            </Route>
            <Route path="/log" element={<Log />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/athlete/:reportId" element={<AthleteReportView />} />
            <Route path="/reports/team/:reportId" element={<TeamReportView />} />
            <Route path="/reports/staff-logs/:reportId" element={<StaffLogReportView />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteProfile />} />
            <Route path="/wellness" element={<Navigate to="/dashboard/wellness" replace />} />
            <Route path="/staff-notes" element={<Navigate to="/log" replace />} />
            <Route path="/squad" element={<Navigate to="/dashboard/wellness" replace />} />
            <Route path="/periodisation" element={<Periodisation />} />
            <Route
              path="/plan/calendar"
              element={<Periodisation defaultView="weekly" defaultWeek="current" />}
            />
            <Route path="/assess" element={<Navigate to="/log" replace />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/users/:userId" element={<UserDetailPage />} />
            <Route path="/superuser" element={<SuperuserPanel />} />
            <Route
              path="*"
              element={<Navigate to={getDefaultStaffHomeRoute(resolvedUser)} replace />}
            />
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
