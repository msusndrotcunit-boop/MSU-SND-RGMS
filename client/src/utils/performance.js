/**
 * Performance utilities for mobile optimization
 * Provides tools for measuring, monitoring, and optimizing mobile performance
 */

/**
 * Image compression and optimization utilities
 */
export const ImageOptimizer = {
  /**
   * Compress an image file for mobile upload
   * @param {File} file - Image file to compress
   * @param {Object} options - Compression options
   * @returns {Promise<File>} Compressed image file
   */
  compressImage: async (file, options = {}) => {
    const {
      maxWidth = 1024,
      maxHeight = 1024,
      quality = 0.8,
      format = 'image/jpeg'
    } = options;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: format,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          format,
          quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  },

  /**
   * Generate optimized image URL for different screen sizes
   * @param {string} url - Original image URL
   * @param {Object} options - Optimization options
   * @returns {string} Optimized image URL
   */
  getOptimizedUrl: (url, options = {}) => {
    const {
      width = 800,
      height = null,
      quality = 80,
      format = 'auto',
      dpr = window.devicePixelRatio || 1
    } = options;

    // For Cloudinary URLs
    if (url.includes('cloudinary.com')) {
      const transforms = [
        `w_${Math.round(width * dpr)}`,
        height ? `h_${Math.round(height * dpr)}` : null,
        `q_${quality}`,
        `f_${format}`,
        'dpr_auto',
        'c_limit'
      ].filter(Boolean).join(',');

      return url.replace('/upload/', `/upload/${transforms}/`);
    }

    return url;
  },

  /**
   * Create responsive image srcset
   * @param {string} url - Base image URL
   * @param {Array} sizes - Array of sizes for srcset
   * @returns {string} Srcset string
   */
  createSrcSet: (url, sizes = [400, 800, 1200]) => {
    return sizes
      .map(size => `${ImageOptimizer.getOptimizedUrl(url, { width: size })} ${size}w`)
      .join(', ');
  }
};

/**
 * Performance monitoring utilities
 */
export const PerformanceMonitor = {
  /**
   * Measure First Contentful Paint (FCP)
   * @returns {Promise<number>} FCP time in milliseconds
   */
  measureFCP: () => {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          resolve(fcpEntry.startTime);
          observer.disconnect();
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    });
  },

  /**
   * Measure Largest Contentful Paint (LCP)
   * @returns {Promise<number>} LCP time in milliseconds
   */
  measureLCP: () => {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.startTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    });
  },

  /**
   * Measure Cumulative Layout Shift (CLS)
   * @returns {Promise<number>} CLS score
   */
  measureCLS: () => {
    return new Promise((resolve) => {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        resolve(clsValue);
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    });
  },

  /**
   * Get current memory usage
   * @returns {Object} Memory usage information
   */
  getMemoryUsage: () => {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        percentage: (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100
      };
    }
    return null;
  },

  /**
   * Monitor frame rate
   * @param {Function} callback - Callback function to receive FPS data
   * @returns {Function} Cleanup function
   */
  monitorFPS: (callback) => {
    let frames = 0;
    let lastTime = performance.now();
    let animationId;

    const countFrame = (currentTime) => {
      frames++;
      
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        callback(fps);
        frames = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(countFrame);
    };

    animationId = requestAnimationFrame(countFrame);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }
};

/**
 * Resource loading optimization utilities
 */
export const ResourceLoader = {
  /**
   * Preload critical resources
   * @param {Array} resources - Array of resource objects
   * @param {string} priority - Loading priority ('high', 'low')
   */
  preloadResources: (resources, priority = 'low') => {
    resources.forEach((resource, index) => {
      const delay = priority === 'high' ? 0 : index * 100;
      
      setTimeout(() => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource.url;
        link.as = resource.type || 'fetch';
        
        if (resource.crossOrigin) {
          link.crossOrigin = resource.crossOrigin;
        }
        
        document.head.appendChild(link);
      }, delay);
    });
  },

  /**
   * Lazy load JavaScript modules
   * @param {Function} importFunction - Dynamic import function
   * @param {Object} options - Loading options
   * @returns {Promise} Module loading promise
   */
  lazyLoadModule: async (importFunction, options = {}) => {
    const { timeout = 10000, retries = 3 } = options;
    
    let attempt = 0;
    
    while (attempt < retries) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Module load timeout')), timeout);
        });
        
        const modulePromise = importFunction();
        
        return await Promise.race([modulePromise, timeoutPromise]);
      } catch (error) {
        attempt++;
        if (attempt >= retries) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  },

  /**
   * Prefetch resources for next navigation
   * @param {Array} urls - URLs to prefetch
   */
  prefetchResources: (urls) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        urls.forEach(url => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = url;
          document.head.appendChild(link);
        });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        urls.forEach(url => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = url;
          document.head.appendChild(link);
        });
      }, 2000);
    }
  }
};

/**
 * Battery and network optimization utilities
 */
export const AdaptiveLoader = {
  /**
   * Check if device is in power saving mode
   * @returns {Promise<boolean>} True if in power saving mode
   */
  isPowerSavingMode: async () => {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        return battery.level < 0.2 || !battery.charging;
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Get network connection quality
   * @returns {Object} Connection information
   */
  getConnectionQuality: () => {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        isSlowConnection: connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
      };
    }
    return { effectiveType: 'unknown', isSlowConnection: false };
  },

  /**
   * Adapt loading strategy based on device conditions
   * @param {Object} options - Loading options
   * @returns {Object} Adapted loading configuration
   */
  adaptLoadingStrategy: async (options = {}) => {
    const isPowerSaving = await AdaptiveLoader.isPowerSavingMode();
    const connection = AdaptiveLoader.getConnectionQuality();
    
    const adaptedOptions = { ...options };
    
    // Reduce quality on slow connections or power saving mode
    if (connection.isSlowConnection || isPowerSaving) {
      adaptedOptions.imageQuality = Math.min(adaptedOptions.imageQuality || 0.8, 0.6);
      adaptedOptions.lazyLoadThreshold = Math.min(adaptedOptions.lazyLoadThreshold || 100, 50);
      adaptedOptions.preloadCount = Math.min(adaptedOptions.preloadCount || 5, 2);
    }
    
    // Enable data saver mode
    if (connection.saveData) {
      adaptedOptions.imageQuality = 0.5;
      adaptedOptions.disableAnimations = true;
      adaptedOptions.lazyLoadThreshold = 25;
    }
    
    return adaptedOptions;
  }
};

/**
 * Service Worker utilities
 */
export const ServiceWorkerUtils = {
  /**
   * Register service worker with error handling
   * @param {string} swPath - Path to service worker file
   * @returns {Promise<ServiceWorkerRegistration>} Registration promise
   */
  register: async (swPath = '/sw.js') => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(swPath);
        console.log('Service Worker registered successfully');
        return registration;
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
        throw error;
      }
    } else {
      throw new Error('Service Worker not supported');
    }
  },

  /**
   * Update service worker
   * @param {ServiceWorkerRegistration} registration - SW registration
   */
  update: (registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  },

  /**
   * Check for service worker updates
   * @param {ServiceWorkerRegistration} registration - SW registration
   * @param {Function} onUpdate - Update callback
   */
  checkForUpdates: (registration, onUpdate) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdate();
          }
        });
      }
    });
  }
};

/**
 * Memory management utilities
 */
export const MemoryManager = {
  /**
   * Clean up unused resources
   */
  cleanup: () => {
    // Force garbage collection if available (Chrome DevTools)
    if (window.gc) {
      window.gc();
    }
    
    // Clear unused image objects
    const images = document.querySelectorAll('img[data-cleanup="true"]');
    images.forEach(img => {
      if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
    });
  },

  /**
   * Monitor memory usage and trigger cleanup
   * @param {number} threshold - Memory threshold percentage (0-100)
   * @param {Function} onThresholdExceeded - Callback when threshold exceeded
   */
  monitorMemory: (threshold = 80, onThresholdExceeded) => {
    const checkMemory = () => {
      const memoryInfo = PerformanceMonitor.getMemoryUsage();
      if (memoryInfo && memoryInfo.percentage > threshold) {
        MemoryManager.cleanup();
        if (onThresholdExceeded) {
          onThresholdExceeded(memoryInfo);
        }
      }
    };

    // Check memory every 30 seconds
    const intervalId = setInterval(checkMemory, 30000);
    
    return () => clearInterval(intervalId);
  }
};

/**
 * Platform detection and cross-platform utilities
 */
export const PlatformDetector = {
  _webglSupported: undefined,
  /**
   * Detect the current platform
   * @returns {Object} Platform information
   */
  getPlatform: () => {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                  (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(userAgent);
    const isMobile = isIOS || isAndroid || /Mobile/.test(userAgent);
    const isTablet = /iPad/.test(userAgent) || 
                     (isAndroid && !/Mobile/.test(userAgent)) ||
                     (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Detect specific browsers
    const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isEdge = /Edge/.test(userAgent);
    
    // Detect PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true;
    
    return {
      isIOS,
      isAndroid,
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      browser: {
        isChrome,
        isSafari,
        isFirefox,
        isEdge,
        name: isChrome ? 'Chrome' : isSafari ? 'Safari' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'Unknown'
      },
      isPWA,
      userAgent,
      platform
    };
  },

  /**
   * Check if a specific feature is supported
   * @param {string} feature - Feature to check
   * @returns {boolean} Whether the feature is supported
   */
  supportsFeature: (feature) => {
    const features = {
      // Touch and interaction
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hover: window.matchMedia('(hover: hover)').matches,
      pointer: window.matchMedia('(pointer: fine)').matches,
      
      // Storage
      localStorage: (() => {
        try {
          const test = 'test';
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch {
          return false;
        }
      })(),
      sessionStorage: (() => {
        try {
          const test = 'test';
          sessionStorage.setItem(test, test);
          sessionStorage.removeItem(test);
          return true;
        } catch {
          return false;
        }
      })(),
      indexedDB: 'indexedDB' in window,
      
      // Network and connectivity
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      networkInformation: 'connection' in navigator,
      
      // Device capabilities
      geolocation: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      vibration: 'vibrate' in navigator,
      battery: 'getBattery' in navigator,
      
      // Display and graphics
      webGL: (() => {
        if (typeof PlatformDetector._webglSupported !== 'undefined') {
          return PlatformDetector._webglSupported;
        }
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl', { preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true }) 
                 || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: false });
          PlatformDetector._webglSupported = !!gl;
          if (gl) {
            try {
              const lose = gl.getExtension('WEBGL_lose_context');
              if (lose && lose.loseContext) lose.loseContext();
            } catch {}
          }
          return PlatformDetector._webglSupported;
        } catch {
          PlatformDetector._webglSupported = false;
          return false;
        }
      })(),
      canvas: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext && canvas.getContext('2d'));
        } catch {
          return false;
        }
      })(),
      
      // Performance APIs
      performanceObserver: 'PerformanceObserver' in window,
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
      
      // Modern web features
      webAssembly: 'WebAssembly' in window,
      webWorkers: 'Worker' in window,
      sharedArrayBuffer: 'SharedArrayBuffer' in window,
      
      // CSS features
      cssGrid: CSS.supports('display', 'grid'),
      cssFlexbox: CSS.supports('display', 'flex'),
      cssCustomProperties: CSS.supports('--test', 'value'),
      cssBackdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
      
      // Safe area support
      safeArea: CSS.supports('padding', 'env(safe-area-inset-top)'),
      
      // Reduced motion preference
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
    
    return features[feature] || false;
  },

  /**
   * Get device capabilities and limitations
   * @returns {Object} Device capabilities
   */
  getCapabilities: () => {
    const platform = PlatformDetector.getPlatform();
    
    // Estimate device performance tier
    const getPerformanceTier = () => {
      const memory = navigator.deviceMemory || 4; // Default to 4GB if not available
      const cores = navigator.hardwareConcurrency || 4; // Default to 4 cores
      
      if (memory <= 2 || cores <= 2) return 'low';
      if (memory <= 4 || cores <= 4) return 'medium';
      return 'high';
    };
    
    // Get connection information
    const getConnectionInfo = () => {
      if (!navigator.connection) {
        return { effectiveType: 'unknown', downlink: 10, rtt: 100 };
      }
      
      return {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    };
    
    return {
      performanceTier: getPerformanceTier(),
      memory: navigator.deviceMemory || 4,
      cores: navigator.hardwareConcurrency || 4,
      connection: getConnectionInfo(),
      maxTouchPoints: navigator.maxTouchPoints || 0,
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: window.devicePixelRatio || 1,
        orientation: screen.orientation ? screen.orientation.type : 'unknown'
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      platform
    };
  }
};

/**
 * Cross-platform feature handling utilities
 */
export const CrossPlatformHandler = {
  /**
   * Handle platform-specific touch events
   * @param {HTMLElement} element - Element to attach events to
   * @param {Object} handlers - Event handlers
   */
  handleTouchEvents: (element, handlers = {}) => {
    const platform = PlatformDetector.getPlatform();
    const { onTouchStart, onTouchEnd, onTouchMove, onClick } = handlers;
    
    if (platform.isMobile) {
      // Use touch events on mobile
      if (onTouchStart) {
        element.addEventListener('touchstart', onTouchStart, { passive: true });
      }
      if (onTouchEnd) {
        element.addEventListener('touchend', onTouchEnd, { passive: true });
      }
      if (onTouchMove) {
        element.addEventListener('touchmove', onTouchMove, { passive: false });
      }
    } else {
      // Use mouse events on desktop
      if (onTouchStart) {
        element.addEventListener('mousedown', onTouchStart);
      }
      if (onTouchEnd) {
        element.addEventListener('mouseup', onTouchEnd);
      }
      if (onTouchMove) {
        element.addEventListener('mousemove', onTouchMove);
      }
    }
    
    // Always add click handler as fallback
    if (onClick) {
      element.addEventListener('click', onClick);
    }
  },

  /**
   * Get platform-specific CSS classes
   * @returns {string} CSS classes for current platform
   */
  getPlatformClasses: () => {
    const platform = PlatformDetector.getPlatform();
    const capabilities = PlatformDetector.getCapabilities();
    
    const classes = [];
    
    // Platform classes
    if (platform.isIOS) classes.push('platform-ios');
    if (platform.isAndroid) classes.push('platform-android');
    if (platform.isMobile) classes.push('platform-mobile');
    if (platform.isTablet) classes.push('platform-tablet');
    if (platform.isDesktop) classes.push('platform-desktop');
    if (platform.isPWA) classes.push('platform-pwa');
    
    // Browser classes
    classes.push(`browser-${platform.browser.name.toLowerCase()}`);
    
    // Capability classes
    if (PlatformDetector.supportsFeature('touch')) classes.push('supports-touch');
    if (PlatformDetector.supportsFeature('hover')) classes.push('supports-hover');
    if (PlatformDetector.supportsFeature('safeArea')) classes.push('supports-safe-area');
    if (PlatformDetector.supportsFeature('reducedMotion')) classes.push('prefers-reduced-motion');
    
    // Performance classes
    classes.push(`performance-${capabilities.performanceTier}`);
    
    // Connection classes
    if (capabilities.connection.effectiveType) {
      classes.push(`connection-${capabilities.connection.effectiveType}`);
    }
    if (capabilities.connection.saveData) {
      classes.push('save-data');
    }
    
    return classes.join(' ');
  },

  /**
   * Apply platform-specific optimizations
   * @param {HTMLElement} element - Element to optimize
   */
  applyPlatformOptimizations: (element) => {
    const platform = PlatformDetector.getPlatform();
    const capabilities = PlatformDetector.getCapabilities();
    
    // Add platform classes
    element.className += ` ${CrossPlatformHandler.getPlatformClasses()}`;
    
    // iOS-specific optimizations
    if (platform.isIOS) {
      // Prevent iOS Safari zoom on input focus
      const inputs = element.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        if (input.style.fontSize === '' || parseFloat(input.style.fontSize) < 16) {
          input.style.fontSize = '16px';
        }
      });
      
      // Fix iOS Safari viewport issues
      element.style.minHeight = '-webkit-fill-available';
    }
    
    // Android-specific optimizations
    if (platform.isAndroid) {
      // Optimize tap highlighting
      element.style.webkitTapHighlightColor = 'rgba(0, 0, 0, 0.1)';
      
      // Improve scrolling performance
      element.style.webkitOverflowScrolling = 'touch';
    }
    
    // Low-end device optimizations
    if (capabilities.performanceTier === 'low') {
      // Disable expensive visual effects
      element.style.setProperty('--animation-duration', '0.1s');
      element.style.setProperty('--transition-duration', '0.1s');
      
      // Remove shadows and gradients
      const shadowElements = element.querySelectorAll('[class*="shadow"]');
      shadowElements.forEach(el => {
        el.style.boxShadow = 'none';
      });
    }
    
    // Slow connection optimizations
    if (capabilities.connection.effectiveType === 'slow-2g' || 
        capabilities.connection.effectiveType === '2g') {
      // Reduce image quality
      const images = element.querySelectorAll('img');
      images.forEach(img => {
        if (img.src.includes('cloudinary.com')) {
          img.src = img.src.replace(/q_\d+/, 'q_50');
        }
      });
    }
  },

  /**
   * Handle platform-specific navigation
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   */
  handleNavigation: (url, options = {}) => {
    const platform = PlatformDetector.getPlatform();
    const { replace = false, external = false } = options;
    
    if (external) {
      // Handle external links based on platform
      if (platform.isPWA) {
        // Open in system browser from PWA
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.open(url, '_blank');
      }
    } else {
      // Internal navigation
      if (replace) {
        window.location.replace(url);
      } else {
        window.location.href = url;
      }
    }
  },

  /**
   * Get platform-specific storage
   * @returns {Object} Storage interface
   */
  getStorage: () => {
    const hasLocalStorage = PlatformDetector.supportsFeature('localStorage');
    const hasSessionStorage = PlatformDetector.supportsFeature('sessionStorage');
    
    return {
      local: hasLocalStorage ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      },
      session: hasSessionStorage ? sessionStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      },
      supported: {
        local: hasLocalStorage,
        session: hasSessionStorage
      }
    };
  }
};

export default {
  ImageOptimizer,
  PerformanceMonitor,
  ResourceLoader,
  AdaptiveLoader,
  ServiceWorkerUtils,
  MemoryManager,
  PlatformDetector,
  CrossPlatformHandler
};
