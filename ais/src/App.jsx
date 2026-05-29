import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Log from './pages/Log';
import Reports from './pages/Reports';
import AthleteReportView from './pages/AthleteReportView';
import TeamReportView from './pages/TeamReportView';
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

const PUBLIC_PATHS = ['/login', '/reset-password'];

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

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary-container)] border-t-transparent animate-spin" />
    </div>
  );
}

function RoleLoading() {
  return <LoadingScreen />;
}

const ACCOUNT_SETUP_MESSAGE =
  'Account setup incomplete. Please contact your administrator.';

function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const { user, loading: userLoading } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  const needsProfile = Boolean(session && !isPublicPath);
  const profileChecking = needsProfile && userLoading;
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
    if (!profileFailed) return;
    void supabase.auth.signOut().then(() => {
      navigate('/login', { replace: true, state: { message: ACCOUNT_SETUP_MESSAGE } });
    });
  }, [profileFailed, navigate]);

  useEffect(() => {
    if (!checkingSession && !session && !isPublicPath) {
      navigate('/login', { replace: true });
    }
  }, [checkingSession, isPublicPath, navigate, session]);

  if (checkingSession || profileChecking || profileFailed) return <LoadingScreen />;
  if (!session && !isPublicPath) return <LoadingScreen />;

  return children;
}

function HomeRedirect({ user }) {
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/log" element={<Log />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/athlete/:reportId" element={<AthleteReportView />} />
            <Route path="/reports/team/:reportId" element={<TeamReportView />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteProfile />} />
            <Route path="/wellness" element={<Navigate to="/dashboard" replace />} />
            <Route path="/staff-notes" element={<Navigate to="/log" replace />} />
            <Route path="/squad" element={<Navigate to="/dashboard" replace />} />
            <Route path="/periodisation" element={<Periodisation />} />
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
