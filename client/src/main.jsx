import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// DEBUG: Log API URL to help troubleshoot connection issues
console.log('App Initializing...');
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('Axios Base URL:', import.meta.env.VITE_API_URL || '(relative)');

axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
