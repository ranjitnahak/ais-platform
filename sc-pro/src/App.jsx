import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar.jsx'
import Programmes from './pages/Programmes.jsx'
import ProgrammeDetail from './pages/ProgrammeDetail.jsx'
import SessionBuilder from './pages/SessionBuilder.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'

function Shell({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--color-bg)',
        }}
      >
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/programmes" replace />} />
        <Route path="/programmes" element={<Programmes />} />
        <Route path="/programmes/:id" element={<ProgrammeDetail />} />
        <Route path="/programmes/:id/edit" element={<ProgrammeDetail />} />
        <Route path="/programmes/:programmeId/sessions/:sessionId" element={<SessionBuilder />} />
        <Route path="/home" element={<PlaceholderPage title="Home" />} />
        <Route path="/athletes" element={<PlaceholderPage title="Athletes" />} />
        <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
        <Route path="/exercise-library" element={<PlaceholderPage title="Exercise Library" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="*" element={<Navigate to="/programmes" replace />} />
      </Routes>
    </Shell>
    </BrowserRouter>
  )
}
