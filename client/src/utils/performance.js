/**
 * Performance utilities for low-end Android devices
 */

// Debounce function for search inputs
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for scroll events
export const throttle = (func, limit = 100) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Lazy load images
export const lazyLoadImage = (src, placeholder = '/placeholder.png') => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(src);
    img.onerror = () => resolve(placeholder);
  });
};

// Check if device is low-end
export const isLowEndDevice = () => {
  // Check for low memory (< 4GB)
  const memory = navigator.deviceMemory;
  if (memory && memory < 4) return true;

  // Check for slow connection
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
    return true;
  }

  // Check for low CPU cores
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return true;

  return false;
};

// Optimize for low-end devices
export const optimizeForDevice = () => {
  if (isLowEndDevice()) {
    // Disable animations
    document.documentElement.classList.add('reduce-motion');
    
    // Reduce image quality
    return {
      imageQuality: 'low',
      enableAnimations: false,
      lazyLoadThreshold: 0.1,
      pageSize: 20,
    };
  }

  return {
    imageQuality: 'high',
    enableAnimations: true,
    lazyLoadThreshold: 0.5,
    pageSize: 50,
  };
};

// Virtual scrolling helper for large lists
export const getVisibleRange = (scrollTop, itemHeight, containerHeight, totalItems) => {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight)
  );
  
  return {
    startIndex: Math.max(0, startIndex - 5), // Buffer
    endIndex: Math.min(totalItems - 1, endIndex + 5), // Buffer
  };
};
