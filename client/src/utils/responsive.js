/**
 * Responsive utilities for mobile-first design
 * Provides consistent breakpoint management, device detection, and responsive behavior
 */

// Standard breakpoints following Tailwind CSS conventions
export const BREAKPOINTS = {
  xs: 0,      // 0px and up
  sm: 640,    // 640px and up
  md: 768,    // 768px and up (tablet)
  lg: 1024,   // 1024px and up (desktop)
  xl: 1280,   // 1280px and up (large desktop)
  '2xl': 1536 // 1536px and up (extra large)
};

// Touch target configuration for accessibility compliance
export const TOUCH_TARGETS = {
  minimum: { width: 44, height: 44 },
  recommended: { width: 48, height: 48 },
  spacing: 8 // minimum spacing between adjacent touch targets
};

// Safe area configuration
export const SAFE_AREA_CONFIG = {
  enabled: true,
  fallbackInsets: { top: 0, right: 0, bottom: 0, left: 0 }
};

// Performance configuration
export const PERFORMANCE_CONFIG = {
  lazyLoadingThreshold: 100, // pixels from viewport
  imageOptimization: true,
  virtualScrollingThreshold: 1000 // items
};

/**
 * Get current breakpoint based on window width
 * @returns {string} Current breakpoint key
 */
export const getCurrentBreakpoint = () => {
  if (typeof window === 'undefined') return 'lg';
  
  const width = window.innerWidth;
  
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

/**
 * Check if current viewport is mobile
 * @returns {boolean} True if mobile viewport
 */
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < BREAKPOINTS.md;
};

/**
 * Check if current viewport is mobile portrait
 * @returns {boolean} True if mobile portrait
 */
export const isMobilePortrait = () => {
  if (typeof window === 'undefined') return false;
  return isMobile() && window.innerHeight > window.innerWidth;
};

/**
 * Check if current viewport is mobile landscape
 * @returns {boolean} True if mobile landscape
 */
export const isMobileLandscape = () => {
  if (typeof window === 'undefined') return false;
  return isMobile() && window.innerWidth > window.innerHeight;
};

/**
 * Get safe area insets for notched devices
 * @returns {object} Safe area insets
 */
export const getSafeAreaInsets = () => {
  if (typeof window === 'undefined' || !CSS.supports('padding', 'env(safe-area-inset-top)')) {
    return SAFE_AREA_CONFIG.fallbackInsets;
  }

  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
    right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
    bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
    left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0
  };
};

/**
 * Apply safe area constraints to an element
 * @param {HTMLElement} element - Element to apply constraints to
 */
export const applySafeAreaConstraints = (element) => {
  if (!element || !SAFE_AREA_CONFIG.enabled) return;

  const insets = getSafeAreaInsets();
  
  // Apply safe area padding if insets are detected
  if (insets.top > 0) element.style.paddingTop = `max(${element.style.paddingTop || '0px'}, ${insets.top}px)`;
  if (insets.right > 0) element.style.paddingRight = `max(${element.style.paddingRight || '0px'}, ${insets.right}px)`;
  if (insets.bottom > 0) element.style.paddingBottom = `max(${element.style.paddingBottom || '0px'}, ${insets.bottom}px)`;
  if (insets.left > 0) element.style.paddingLeft = `max(${element.style.paddingLeft || '0px'}, ${insets.left}px)`;
};

/**
 * Handle fixed element positioning during scroll with safe area awareness
 * @param {HTMLElement} element - Fixed element to manage
 * @param {string} position - Position type ('top', 'bottom', 'left', 'right')
 * @param {boolean} respectSafeArea - Whether to respect safe area insets
 */
export const handleFixedElementScroll = (element, position = 'top', respectSafeArea = true) => {
  if (!element) return;

  const insets = respectSafeArea ? getSafeAreaInsets() : { top: 0, right: 0, bottom: 0, left: 0 };
  
  const updatePosition = () => {
    const scrollY = window.scrollY;
    
    switch (position) {
      case 'top':
        element.style.top = `${insets.top}px`;
        element.style.left = `${insets.left}px`;
        element.style.right = `${insets.right}px`;
        break;
      case 'bottom':
        element.style.bottom = `${insets.bottom}px`;
        element.style.left = `${insets.left}px`;
        element.style.right = `${insets.right}px`;
        break;
      case 'left':
        element.style.left = `${insets.left}px`;
        element.style.top = `${insets.top}px`;
        element.style.bottom = `${insets.bottom}px`;
        break;
      case 'right':
        element.style.right = `${insets.right}px`;
        element.style.top = `${insets.top}px`;
        element.style.bottom = `${insets.bottom}px`;
        break;
    }
    
    // Add scroll-aware class for CSS transitions
    element.classList.toggle('scroll-aware-fixed', scrollY > 0);
  };

  // Initial positioning
  updatePosition();
  
  // Update on scroll with throttling for performance
  const throttledUpdate = throttle(updatePosition, 16); // ~60fps
  window.addEventListener('scroll', throttledUpdate, { passive: true });
  
  // Return cleanup function
  return () => {
    window.removeEventListener('scroll', throttledUpdate);
  };
};

/**
 * Create a scroll-aware safe area observer
 * @param {HTMLElement} container - Container element to observe
 * @param {Function} callback - Callback function for scroll events
 * @returns {Function} Cleanup function
 */
export const createScrollSafeAreaObserver = (container, callback) => {
  if (!container || typeof callback !== 'function') return () => {};

  let isScrolling = false;
  let scrollTimeout;

  const handleScroll = () => {
    if (!isScrolling) {
      isScrolling = true;
      callback({ type: 'scroll-start', scrollY: window.scrollY, container });
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
      callback({ type: 'scroll-end', scrollY: window.scrollY, container });
    }, 150);

    callback({ type: 'scroll', scrollY: window.scrollY, container });
  };

  const throttledScroll = throttle(handleScroll, 16);
  container.addEventListener('scroll', throttledScroll, { passive: true });

  return () => {
    container.removeEventListener('scroll', throttledScroll);
    clearTimeout(scrollTimeout);
  };
};

/**
 * Detect device capabilities and performance characteristics
 * @returns {object} Device capability information
 */
export const getDeviceCapabilities = () => {
  if (typeof window === 'undefined') {
    return {
      isLowEndDevice: false,
      connectionType: 'unknown',
      batteryLevel: null,
      supportsTouch: false,
      supportsHover: true
    };
  }

  // Detect low-end device based on hardware concurrency and memory
  const isLowEndDevice = (
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2)
  );

  // Get connection type
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const connectionType = connection ? connection.effectiveType || 'unknown' : 'unknown';

  // Get battery level if available
  let batteryLevel = null;
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      batteryLevel = battery.level;
    });
  }

  // Detect touch and hover support
  const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const supportsHover = window.matchMedia('(hover: hover)').matches;

  return {
    isLowEndDevice,
    connectionType,
    batteryLevel,
    supportsTouch,
    supportsHover
  };
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
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

/**
 * Throttle function for performance optimization
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};