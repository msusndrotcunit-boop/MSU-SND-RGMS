import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    try {
      const msg = String(error && error.message ? error.message : '').toLowerCase();
      if (msg.includes("cannot access 'g' before initialization")) {
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
        try {
          if (window.caches && caches.keys) {
            caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
          }
        } catch {}
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => {});
          }
        } catch {}
        setTimeout(() => {
          const u = new URL(window.location.href);
          u.searchParams.set('fresh', Date.now().toString());
          window.location.href = u.toString();
        }, 200);
      }
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h2>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
