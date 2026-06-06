import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { RouterProvider } from './contexts/RouterContext'
import { SalesProvider } from './contexts/SalesContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RouterProvider>
          <SettingsProvider>
            <SalesProvider>
              <App />
            </SalesProvider>
          </SettingsProvider>
        </RouterProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
