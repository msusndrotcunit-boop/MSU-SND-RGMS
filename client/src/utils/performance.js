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

export default {
  ImageOptimizer,
  PerformanceMonitor,
  ResourceLoader,
  AdaptiveLoader,
  ServiceWorkerUtils,
  MemoryManager
};