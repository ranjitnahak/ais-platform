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
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
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
            <Route path="/programmes" element={<ProtectedRoute><Programmes /></ProtectedRoute>} />
            <Route path="/programmes/:id" element={<ProtectedRoute><ProgrammeDetail /></ProtectedRoute>} />
            <Route path="/programmes/:id/edit" element={<ProtectedRoute><ProgrammeDetail /></ProtectedRoute>} />
            <Route path="/programmes/:programmeId/sessions/:sessionId" element={<ProtectedRoute><SessionBuilder /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><PlaceholderPage title="Home" /></ProtectedRoute>} />
            <Route path="/athletes" element={<ProtectedRoute><Athletes /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><PlaceholderPage title="Analytics" /></ProtectedRoute>} />
            <Route path="/exercise-library" element={<ProtectedRoute><PlaceholderPage title="Exercise Library" /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><PlaceholderPage title="Settings" /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/programmes" replace />} />
          </Route>
        </Routes>
        <AssistantPanel />
      </BrowserRouter>
    </UserProvider>
  )
}
