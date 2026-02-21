import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// DEBUG: Log API URL to help troubleshoot connection issues
console.log('App Initializing...');
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);

// Resolve API base URL
// Prefer explicit VITE_API_URL when provided; fallback to localhost in dev,
// and relative same-origin when no explicit URL exists.
let apiBaseURL = '';
if (import.meta.env.VITE_API_URL) {
  apiBaseURL = import.meta.env.VITE_API_URL;
} else if (import.meta.env.DEV) {
  apiBaseURL = 'http://localhost:5000';
} else {
  apiBaseURL = '';
}
axios.defaults.baseURL = apiBaseURL;
console.log('Axios Base URL:', apiBaseURL || '(relative same-origin)');

// Global Axios interceptors for graceful 404/403 handling on staff/cadet endpoints
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      const url = error?.config?.url || '';
      const msg = (error?.response?.data && (error.response.data.message || error.response.data.error)) || '';
      if (status === 401 && error?.config && !error.config.__isRetryRequest) {
        const refresh = localStorage.getItem('refreshToken');
        if (refresh) {
          error.config.__isRetryRequest = true;
          return axios.post('/api/auth/token/refresh', { refresh })
            .then((res) => {
              const newToken = res?.data?.access || res?.data?.token || '';
              if (newToken) {
                localStorage.setItem('token', newToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                error.config.headers = error.config.headers || {};
                error.config.headers['Authorization'] = `Bearer ${newToken}`;
                return axios(error.config);
              }
              return Promise.reject(error);
            })
            .catch(() => Promise.reject(error));
        }
      }
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
      // Gracefully handle accidental cadet calls when not a cadet
      const notCadet = (status === 403) && /not a cadet/i.test(msg);
      if (notCadet) {
        if (url.includes('/api/cadet/my-merit-logs')) {
          return Promise.resolve({ data: [], status: 200, statusText: 'OK', headers: error.response?.headers || {}, config: error.config });
        }
        if (url.includes('/api/cadet/my-grades')) {
          return Promise.resolve({
            data: {
              attendanceScore: 0,
              attendance_present: 0,
              aptitudeScore: 0,
              merit_points: 0,
              demerit_points: 0,
              subjectScore: 0,
              prelim_score: 0,
              midterm_score: 0,
              final_score: 0,
              finalGrade: 0,
              transmutedGrade: '5.00',
              remarks: 'Not a cadet'
            },
            status: 200,
            statusText: 'OK',
            headers: error.response?.headers || {},
            config: error.config
          });
        }
        if (url.includes('/api/cadet/profile')) {
          return Promise.resolve({ data: null, status: 200, statusText: 'OK', headers: error.response?.headers || {}, config: error.config });
        }
        if (url.includes('/api/attendance/my-history')) {
          return Promise.resolve({ data: [], status: 200, statusText: 'OK', headers: error.response?.headers || {}, config: error.config });
        }
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
