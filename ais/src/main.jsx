import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './context/UserContext.jsx'
import { SessionConfigProvider } from './context/SessionConfigContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <SessionConfigProvider>
        <App />
      </SessionConfigProvider>
    </UserProvider>
  </StrictMode>,
)
