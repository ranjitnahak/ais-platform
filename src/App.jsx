import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SquadDashboard from './components/dashboard/SquadDashboard';
import Reports from './pages/Reports';
import Athletes from './pages/Athletes';
import AthleteProfile from './pages/AthleteProfile';

function Placeholder({ title }) {
  return (
    <div className="bg-[#131315] text-[#e4e2e4] font-['Inter'] min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <span className="material-symbols-outlined text-5xl text-gray-600">construction</span>
        <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
        <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Coming soon</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<SquadDashboard />} />
        <Route path="/reports"         element={<Reports />} />
        <Route path="/athletes"        element={<Athletes />} />
        <Route path="/athletes/:id"    element={<AthleteProfile />} />
        <Route path="/assess"          element={<Placeholder title="Assessment" />} />
        <Route path="/settings"        element={<Placeholder title="Settings" />} />
      </Routes>
    </BrowserRouter>
  );
}
