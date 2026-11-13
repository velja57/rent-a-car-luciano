import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.jsx'

// Vercel Web Analytics — anonimna statistika poseta, bez kolačića (Vercel →
// projekat → Analytics). Učitava se samo na sajtu objavljenom na Vercel-u, ne
// lokalno; admin panel (admin.html) ima svoj ulaz i ne broji se.
if (import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  window.va = window.va || function (...args) {
    (window.vaq = window.vaq || []).push(args)
  }
  const script = document.createElement('script')
  script.defer = true
  script.src = '/_vercel/insights/script.js'
  document.head.appendChild(script)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
