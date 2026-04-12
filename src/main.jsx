import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SettingsProvider } from './contexts/SettingsContext'
import { RouterProvider } from './contexts/RouterContext'
import { SalesProvider } from './contexts/SalesContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider>
      <SettingsProvider>
        <SalesProvider>
          <App />
        </SalesProvider>
      </SettingsProvider>
    </RouterProvider>
  </StrictMode>,
)
