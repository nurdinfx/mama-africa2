import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { processQueue } from './services/offlineQueue'
import { realApi } from './api/realApi'

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
  } catch { }
}

loadConfig().finally(() => {
  renderApp()
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
          if (registration.waiting) {
            console.log('A new service worker is waiting to activate.');
          }
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });

    // Reload when a new Service Worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('New service worker activated, reloading the page...');
      window.location.reload();
    });
  }
})

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
