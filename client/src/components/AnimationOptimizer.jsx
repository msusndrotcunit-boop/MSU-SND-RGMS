import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMobile } from '../hooks/useResponsive';
import { getDeviceCapabilities, throttle } from '../utils/responsive';

/**
 * AnimationOptimizer - Optimizes animations and transitions for mobile performance
 * Provides smooth page transitions without layout shifts and efficient rendering
 */
const AnimationOptimizer = ({ children, className = '', preserveFixed = false, ...props }) => {
  const { isMobile, deviceCapabilities } = useMobile();
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const capabilities = getDeviceCapabilities();
    setIsLowEndDevice(capabilities.isLowEndDevice);
    
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handleChange = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply animation optimizations
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Set CSS custom properties for animation control
    container.style.setProperty('--animation-enabled', reducedMotion || isLowEndDevice ? '0' : '1');
    container.style.setProperty('--animation-duration', reducedMotion || isLowEndDevice ? '0.1s' : '0.3s');
    container.style.setProperty('--transition-duration', reducedMotion || isLowEndDevice ? '0.1s' : '0.2s');
    
    // Enable hardware acceleration for smooth animations
    // IMPORTANT: Avoid applying transform on containers that include position: fixed elements
    // Setting transform on an ancestor creates a containing block and breaks viewport-fixed positioning.
    if (!isLowEndDevice && !preserveFixed) {
      container.style.transform = 'translateZ(0)';
      container.style.willChange = 'transform, opacity';
    }

    return () => {
      if (container) {
        container.style.removeProperty('--animation-enabled');
        container.style.removeProperty('--animation-duration');
        container.style.removeProperty('--transition-duration');
        if (!preserveFixed) {
          container.style.transform = '';
          container.style.willChange = '';
        }
      }
    };
  }, [isLowEndDevice, reducedMotion, preserveFixed]);

  return (
    <div
      ref={containerRef}
      className={`animation-optimizer ${className}`}
      data-mobile={isMobile}
      data-low-end={isLowEndDevice}
      data-reduced-motion={reducedMotion}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * PageTransition - Smooth page transitions without layout shifts
 */
export const PageTransition = ({
  children,
  isLoading = false,
  transitionKey,
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentKey, setCurrentKey] = useState(transitionKey);
  const { isMobile } = useMobile();
  const containerRef = useRef(null);

  useEffect(() => {
    if (transitionKey !== currentKey) {
      // Start exit transition
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentKey(transitionKey);
        setIsVisible(true);
      }, isMobile ? 100 : 150); // Faster transitions on mobile
    } else {
      setIsVisible(true);
    }
  }, [transitionKey, currentKey, isMobile]);

  return (
    <div
      ref={containerRef}
      className={`page-transition ${className}`}
      data-visible={isVisible}
      data-loading={isLoading}
      data-mobile={isMobile}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * FadeTransition - Optimized fade transition component
 */
export const FadeTransition = ({
  show,
  children,
  duration = 200,
  className = '',
  onEnter,
  onExit,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);
  const { isMobile } = useMobile();
  const elementRef = useRef(null);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Use requestAnimationFrame for smooth animation
      requestAnimationFrame(() => {
        setIsVisible(true);
        if (onEnter) onEnter();
      });
    } else {
      setIsVisible(false);
      if (onExit) onExit();
      
      // Remove from DOM after transition
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, isMobile ? duration / 2 : duration);
      
      return () => clearTimeout(timeout);
    }
  }, [show, duration, isMobile, onEnter, onExit]);

  if (!shouldRender) return null;

  return (
    <div
      ref={elementRef}
      className={`fade-transition ${className}`}
      data-visible={isVisible}
      data-mobile={isMobile}
      style={{
        '--transition-duration': `${isMobile ? duration / 2 : duration}ms`
      }}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * SlideTransition - Optimized slide transition component
 */
export const SlideTransition = ({
  show,
  children,
  direction = 'up', // 'up', 'down', 'left', 'right'
  duration = 300,
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);
  const { isMobile } = useMobile();

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, isMobile ? duration / 2 : duration);
      
      return () => clearTimeout(timeout);
    }
  }, [show, duration, isMobile]);

  if (!shouldRender) return null;

  return (
    <div
      className={`slide-transition slide-transition--${direction} ${className}`}
      data-visible={isVisible}
      data-mobile={isMobile}
      style={{
        '--transition-duration': `${isMobile ? duration / 2 : duration}ms`
      }}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * ScaleTransition - Optimized scale transition component
 */
export const ScaleTransition = ({
  show,
  children,
  scale = 0.95,
  duration = 200,
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);
  const { isMobile } = useMobile();

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, isMobile ? duration / 2 : duration);
      
      return () => clearTimeout(timeout);
    }
  }, [show, duration, isMobile]);

  if (!shouldRender) return null;

  return (
    <div
      className={`scale-transition ${className}`}
      data-visible={isVisible}
      data-mobile={isMobile}
      style={{
        '--transition-duration': `${isMobile ? duration / 2 : duration}ms`,
        '--scale-from': scale
      }}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * LayoutShiftPreventer - Prevents layout shifts during content loading
 */
export const LayoutShiftPreventer = ({
  children,
  minHeight,
  aspectRatio,
  className = '',
  ...props
}) => {
  const [contentLoaded, setContentLoaded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      // Set minimum dimensions to prevent layout shift
      if (minHeight) {
        containerRef.current.style.minHeight = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;
      }
      
      if (aspectRatio) {
        containerRef.current.style.aspectRatio = aspectRatio;
      }
      
      // Mark as loaded after content is rendered
      const timeout = setTimeout(() => {
        setContentLoaded(true);
      }, 50);
      
      return () => clearTimeout(timeout);
    }
  }, [minHeight, aspectRatio]);

  return (
    <div
      ref={containerRef}
      className={`layout-shift-preventer ${className}`}
      data-loaded={contentLoaded}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * PerformantScroll - Optimized scrolling component
 */
export const PerformantScroll = ({
  children,
  onScroll,
  throttleMs = 16, // 60fps
  className = '',
  ...props
}) => {
  const { isMobile } = useMobile();
  const scrollRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const handleScroll = useCallback(
    throttle((e) => {
      if (onScroll) onScroll(e);
      
      if (!isScrolling) {
        setIsScrolling(true);
      }
      
      // Clear scrolling state after scroll ends
      clearTimeout(window.scrollEndTimer);
      window.scrollEndTimer = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    }, throttleMs),
    [onScroll, throttleMs, isScrolling]
  );

  return (
    <div
      ref={scrollRef}
      className={`performant-scroll ${className}`}
      onScroll={handleScroll}
      data-mobile={isMobile}
      data-scrolling={isScrolling}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * AnimationFrame - Hook for requestAnimationFrame-based animations
 */
export const useAnimationFrame = (callback, deps = []) => {
  const requestRef = useRef();
  const previousTimeRef = useRef();
  
  const animate = useCallback((time) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, deps);
  
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);
};

/**
 * IntersectionObserver hook for performance-optimized visibility detection
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState(null);
  const elementRef = useRef(null);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
    };
  }, [options]);
  
  return [elementRef, isIntersecting, entry];
};

export default AnimationOptimizer;
