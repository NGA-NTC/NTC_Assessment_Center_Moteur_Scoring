import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoutes from './routes/index.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import Toaster from './components/ui/Toaster.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppRoutes />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
)
