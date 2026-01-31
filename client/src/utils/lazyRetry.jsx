import { lazy } from 'react';

/**
 * A wrapper around React.lazy that automatically refreshes the page
 * if a chunk fails to load (e.g., after a new deployment).
 * 
 * @param {Function} importFn - The dynamic import function (e.g. () => import('./Page'))
 * @returns {React.Component} - The lazy loaded component
 */
export const lazyRetry = (importFn) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // Check if the error is related to chunk loading
      const isChunkError = 
        error.message.includes("Failed to fetch dynamically imported module") || 
        error.message.includes("Importing a module script failed") ||
        error.name === 'ChunkLoadError';

      if (isChunkError) {
        const storageKey = 'retry-lazy-refreshed';
        const hasRefreshed = window.sessionStorage.getItem(storageKey) === 'true';

        if (!hasRefreshed) {
          // Set flag so we don't reload infinitely
          window.sessionStorage.setItem(storageKey, 'true');
          window.location.reload();
          
          // Return a dummy component while the page reloads
          // This prevents the error from bubbling up before the reload happens
          return { default: () => <div className="min-h-screen flex items-center justify-center">Reloading...</div> };
        }
      }

      // If we already refreshed or it's a different error, let it bubble to ErrorBoundary
      throw error;
    }
  });
};
