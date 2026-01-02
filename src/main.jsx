import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { processQueue } from './services/offlineQueue'
import { realApi } from './api/realApi'
import { outboxService } from './services/outbox'


const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

const loadConfig = async () => {
  try {
    const res = await fetch('/config.json')
    if (res.ok) {
      const cfg = await res.json()
      if (typeof window !== 'undefined') {
        window.__APP_CONFIG__ = cfg
      }
    }
  } catch (e) {
    console.error('Failed to load config.json', e)
  }
}

// Load config first, then render the app
loadConfig().finally(() => {
  renderApp()

  // Service worker registration removed to avoid automatic reloads/updates.
})

// Process offline queue when back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue({
      'order.update': async ({ id, updateData }) => {
        if (typeof realApi.updateOrder === 'function') {
          await realApi.updateOrder(id, updateData)
        }
      }
    })
  })
}

// Unregister any existing service workers and clear their caches to prevent automatic reloads
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) {
      try { reg.unregister(); } catch (e) { console.warn('Failed to unregister SW:', e); }
    }
    if (window.caches && window.caches.keys) {
      window.caches.keys().then((keys) => Promise.all(keys.map((k) => window.caches.delete(k))).catch(() => {}));
    }
  }).catch((e) => console.warn('Failed to get SW registrations:', e));
}
