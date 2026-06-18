import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar.jsx'
import AppHeader from './components/layout/AppHeader.jsx'
import { UserProvider } from './context/UserContext.jsx'
import Programmes from './pages/Programmes.jsx'
import ProgrammeDetail from './pages/ProgrammeDetail.jsx'
import SessionBuilder from './pages/SessionBuilder.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'
import Athletes from './pages/Athletes.jsx'
import Login from './pages/Login.jsx'
import AssistantPanel from './components/assistant/AssistantPanel.jsx'

function Shell({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppHeader />
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
    </div>
  )
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Shell>
                <Outlet />
              </Shell>
            }
          >
            <Route path="/" element={<Navigate to="/programmes" replace />} />
            <Route path="/programmes" element={<Programmes />} />
            <Route path="/programmes/:id" element={<ProgrammeDetail />} />
            <Route path="/programmes/:id/edit" element={<ProgrammeDetail />} />
            <Route path="/programmes/:programmeId/sessions/:sessionId" element={<SessionBuilder />} />
            <Route path="/home" element={<PlaceholderPage title="Home" />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
            <Route path="/exercise-library" element={<PlaceholderPage title="Exercise Library" />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
            <Route path="*" element={<Navigate to="/programmes" replace />} />
          </Route>
        </Routes>
        <AssistantPanel />
      </BrowserRouter>
    </UserProvider>
  )
}
