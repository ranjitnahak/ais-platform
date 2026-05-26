import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import SquadDashboard from './components/dashboard/SquadDashboard';
import Reports from './pages/Reports';
import AthleteReportView from './pages/AthleteReportView';
import Athletes from './pages/Athletes';
import AthleteProfile from './pages/AthleteProfile';
import AthleteHome from './pages/AthleteHome';
import WellnessDashboard from './components/wellness/WellnessDashboard';
import StaffNotes from './pages/StaffNotes';
import Periodisation from './pages/Periodisation';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { supabase } from './lib/supabase';

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

function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);

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
    if (!checkingSession && !session && !isPublicPath) {
      navigate('/login', { replace: true });
    }
  }, [checkingSession, isPublicPath, navigate, session]);

  if (checkingSession || (!session && !isPublicPath)) return <LoadingScreen />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/login"          element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/"               element={<SquadDashboard />} />
          <Route path="/reports"        element={<Reports />} />
          <Route path="/reports/athlete/:reportId" element={<AthleteReportView />} />
          <Route path="/athletes"       element={<Athletes />} />
          <Route path="/athletes/:id"   element={<AthleteProfile />} />
          <Route path="/athlete-home"   element={<AthleteHome />} />
          <Route path="/wellness"       element={<WellnessDashboard />} />
          <Route path="/staff-notes"    element={<StaffNotes />} />
          <Route path="/periodisation"  element={<Periodisation />} />
          <Route path="/assess"         element={<Placeholder title="Assessment" />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="/admin"          element={<Admin />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
