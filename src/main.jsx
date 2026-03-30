import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  console.error('Root element not found!')
} else {
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
    console.log('App mounted successfully')
  } catch (err) {
    console.error('Failed to render app:', err)
    root.innerHTML = '<div style="padding:20px;color:red">Error: ' + err.message + '</div>'
  }
}
