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

// Global Axios interceptors for graceful 404/403 handling on staff endpoints
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      const url = error?.config?.url || '';
      // Transform missing staff profile into a safe placeholder
      if (status === 404 && url.includes('/api/staff/me')) {
        return Promise.resolve({
          data: {
            id: null,
            first_name: '',
            last_name: '',
            rank: '',
            role: 'training_staff',
            profile_pic: null,
            username: null
          },
          status: 200,
          statusText: 'OK',
          headers: error.response?.headers || {},
          config: error.config
        });
      }
      // Transform staff history forbidden or missing into an empty list for UI
      if ((status === 403 || status === 404) && url.includes('/api/attendance/my-history/staff')) {
        return Promise.resolve({
          data: [],
          status: 200,
          statusText: 'OK',
          headers: error.response?.headers || {},
          config: error.config
        });
      }
    } catch {}
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
