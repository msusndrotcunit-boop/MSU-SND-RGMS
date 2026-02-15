import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMobile } from '../hooks/useResponsive';
import { getDeviceCapabilities, debounce, throttle } from '../utils/responsive';

/**
 * MobilePerformanceOptimizer - Optimizes performance for mobile devices
 * Handles image compression, lazy loading, and JavaScript execution optimization
 */
const MobilePerformanceOptimizer = ({ children, className = '', ...props }) => {
  const { isMobile, deviceCapabilities } = useMobile();
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);
  const [connectionType, setConnectionType] = useState('unknown');
  const containerRef = useRef(null);

  useEffect(() => {
    const capabilities = getDeviceCapabilities();
    setIsLowEndDevice(capabilities.isLowEndDevice);
    setConnectionType(capabilities.connectionType);
  }, []);

  // Apply performance optimizations based on device capabilities
  useEffect(() => {
    if (!isMobile) return;

    // Reduce animations on low-end devices
    if (isLowEndDevice) {
      document.documentElement.style.setProperty('--animation-duration', '0.1s');
      document.documentElement.style.setProperty('--transition-duration', '0.1s');
    }

    // Optimize for slow connections
    if (connectionType === 'slow-2g' || connectionType === '2g') {
      document.documentElement.style.setProperty('--image-quality', '0.6');
      document.documentElement.style.setProperty('--lazy-threshold', '50px');
    }

    return () => {
      // Reset optimizations
      document.documentElement.style.removeProperty('--animation-duration');
      document.documentElement.style.removeProperty('--transition-duration');
      document.documentElement.style.removeProperty('--image-quality');
      document.documentElement.style.removeProperty('--lazy-threshold');
    };
  }, [isMobile, isLowEndDevice, connectionType]);

  return (
    <div
      ref={containerRef}
      className={`mobile-performance-optimizer ${className}`}
      data-mobile={isMobile}
      data-low-end={isLowEndDevice}
      data-connection={connectionType}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * LazyImage - Optimized image component with lazy loading and compression
 */
export const LazyImage = ({
  src,
  alt,
  className = '',
  width,
  height,
  quality = 0.8,
  placeholder = null,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);
  const { isMobile } = useMobile();

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: isMobile ? '50px' : '100px', // Smaller threshold for mobile
        threshold: 0.1
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [isMobile]);

  // Optimize image URL for mobile
  const getOptimizedSrc = useCallback(() => {
    if (!src) return '';
    
    // If it's a Cloudinary URL, add mobile optimizations
    if (src.includes('cloudinary.com')) {
      const mobileTransforms = isMobile 
        ? `q_${Math.round(quality * 100)},f_auto,dpr_auto,w_${width || 800}`
        : `q_${Math.round(quality * 100)},f_auto`;
      
      return src.replace('/upload/', `/upload/${mobileTransforms}/`);
    }
    
    return src;
  }, [src, isMobile, quality, width]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setError(true);
    if (onError) onError();
  }, [onError]);

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={{ width, height }}
      data-loaded={isLoaded}
      data-error={error}
    >
      {!isInView && placeholder && (
        <div className="lazy-image-placeholder">
          {placeholder}
        </div>
      )}
      
      {isInView && !error && (
        <img
          src={getOptimizedSrc()}
          alt={alt}
          className={`lazy-image ${isLoaded ? 'loaded' : 'loading'}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
      
      {error && (
        <div className="lazy-image-error">
          <span>Failed to load image</span>
        </div>
      )}
    </div>
  );
};

/**
 * PerformanceMonitor - Monitors and reports performance metrics
 */
export const PerformanceMonitor = ({ onMetrics, interval = 5000 }) => {
  const { isMobile } = useMobile();
  const [metrics, setMetrics] = useState({});

  const collectMetrics = useCallback(() => {
    if (!isMobile) return;

    const metrics = {
      timestamp: Date.now(),
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      navigation: performance.getEntriesByType('navigation')[0],
      paint: performance.getEntriesByType('paint'),
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };

    setMetrics(metrics);
    if (onMetrics) onMetrics(metrics);
  }, [isMobile, onMetrics]);

  useEffect(() => {
    if (!isMobile) return;

    collectMetrics();
    const intervalId = setInterval(collectMetrics, interval);

    return () => clearInterval(intervalId);
  }, [isMobile, collectMetrics, interval]);

  return null; // This is a monitoring component, no UI
};

/**
 * ServiceWorkerManager - Manages service worker for caching and offline functionality
 */
export const ServiceWorkerManager = ({ onUpdate, onOffline, onOnline }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swRegistration, setSwRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          setSwRegistration(registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                  if (onUpdate) onUpdate();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('Service worker registration failed:', error);
        });
    }
  }, [onUpdate]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (onOnline) onOnline();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (onOffline) onOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOnline, onOffline]);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [swRegistration]);

  return {
    isOnline,
    updateAvailable,
    updateServiceWorker
  };
};

/**
 * ResourcePreloader - Preloads critical resources for better performance
 */
export const ResourcePreloader = ({ resources = [], priority = 'low' }) => {
  const { isMobile } = useMobile();
  const [loadedResources, setLoadedResources] = useState(new Set());

  useEffect(() => {
    if (!isMobile || resources.length === 0) return;

    const preloadResource = (resource) => {
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource.url;
        link.as = resource.type || 'fetch';
        
        if (resource.type === 'image') {
          link.as = 'image';
        } else if (resource.type === 'script') {
          link.as = 'script';
        } else if (resource.type === 'style') {
          link.as = 'style';
        }

        link.onload = () => {
          setLoadedResources(prev => new Set([...prev, resource.url]));
          resolve();
        };
        link.onerror = reject;

        document.head.appendChild(link);
      });
    };

    // Preload resources with priority
    const preloadPromises = resources.map((resource, index) => {
      const delay = priority === 'high' ? 0 : index * 100; // Stagger low priority loads
      return new Promise(resolve => {
        setTimeout(() => {
          preloadResource(resource).then(resolve).catch(resolve);
        }, delay);
      });
    });

    Promise.all(preloadPromises);

    return () => {
      // Cleanup preload links
      resources.forEach(resource => {
        const existingLink = document.querySelector(`link[href="${resource.url}"]`);
        if (existingLink) {
          document.head.removeChild(existingLink);
        }
      });
    };
  }, [isMobile, resources, priority]);

  return null; // This is a utility component, no UI
};

/**
 * VirtualScrollContainer - Optimized scrolling for large lists on mobile
 */
export const VirtualScrollContainer = ({
  items = [],
  itemHeight = 60,
  containerHeight = 400,
  renderItem,
  overscan = 5,
  className = '',
  ...props
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);
  const { isMobile } = useMobile();

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

  const visibleItems = items.slice(startIndex, endIndex + 1);

  const handleScroll = useCallback(
    throttle((e) => {
      setScrollTop(e.target.scrollTop);
    }, 16), // 60fps
    []
  );

  return (
    <div
      ref={setContainerRef}
      className={`virtual-scroll-container ${className}`}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
      data-mobile={isMobile}
      {...props}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobilePerformanceOptimizer;