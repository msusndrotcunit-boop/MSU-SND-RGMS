import { useState, useEffect, useCallback } from 'react';
import { 
  getCurrentBreakpoint, 
  isMobile, 
  isMobilePortrait, 
  isMobileLandscape,
  getSafeAreaInsets,
  getDeviceCapabilities,
  debounce,
  isMobileDevice,
  isIOSDevice,
  isAndroidDevice,
  isPWA,
  getPlatformClasses,
  getAdaptiveConfig
} from '../utils/responsive';

/**
 * Custom hook for responsive behavior and mobile optimization
 * Provides reactive state for breakpoints, device capabilities, and safe areas
 */
export const useResponsive = () => {
  const [state, setState] = useState({
    currentBreakpoint: getCurrentBreakpoint(),
    isMobile: isMobile(),
    isMobilePortrait: isMobilePortrait(),
    isMobileLandscape: isMobileLandscape(),
    safeAreaInsets: getSafeAreaInsets(),
    deviceCapabilities: getDeviceCapabilities(),
    orientation: typeof window !== 'undefined' ? 
      (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape') : 'portrait',
    keyboardVisible: false,
    keyboardHeight: 0,
    // Enhanced platform detection
    platform: {
      isMobile: isMobileDevice(),
      isIOS: isIOSDevice(),
      isAndroid: isAndroidDevice(),
      isPWA: isPWA()
    },
    platformClasses: getPlatformClasses()
  });

  // Update responsive state
  const updateState = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      currentBreakpoint: getCurrentBreakpoint(),
      isMobile: isMobile(),
      isMobilePortrait: isMobilePortrait(),
      isMobileLandscape: isMobileLandscape(),
      safeAreaInsets: getSafeAreaInsets(),
      orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
    }));
  }, []);

  // Debounced resize handler for performance
  const debouncedUpdateState = useCallback(debounce(updateState, 150), [updateState]);

  // Handle keyboard visibility (mobile-specific)
  const handleKeyboardVisibility = useCallback(() => {
    if (typeof window === 'undefined' || !isMobile()) return;

    const initialViewportHeight = window.innerHeight;
    
    const checkKeyboard = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      const keyboardVisible = heightDifference > 150; // Threshold for keyboard detection
      
      setState(prevState => ({
        ...prevState,
        keyboardVisible,
        keyboardHeight: keyboardVisible ? heightDifference : 0
      }));
    };

    // Use visualViewport API if available (better for mobile)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        setState(prevState => ({
          ...prevState,
          keyboardVisible: keyboardHeight > 150,
          keyboardHeight: Math.max(0, keyboardHeight)
        }));
      };

      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport.removeEventListener('resize', handleViewportChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', checkKeyboard);
      return () => window.removeEventListener('resize', checkKeyboard);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set up resize listener
    window.addEventListener('resize', debouncedUpdateState);
    
    // Set up orientation change listener
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(updateState, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Set up keyboard visibility detection
    const cleanupKeyboard = handleKeyboardVisibility();

    // Initial state update
    updateState();

    return () => {
      window.removeEventListener('resize', debouncedUpdateState);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (cleanupKeyboard) cleanupKeyboard();
    };
  }, [debouncedUpdateState, updateState, handleKeyboardVisibility]);

  return state;
};

/**
 * Hook for breakpoint-specific behavior
 * @param {string} breakpoint - Target breakpoint
 * @returns {boolean} True if current breakpoint matches or exceeds target
 */
export const useBreakpoint = (breakpoint) => {
  const { currentBreakpoint } = useResponsive();
  
  const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
  const targetIndex = breakpointOrder.indexOf(breakpoint);
  
  return currentIndex >= targetIndex;
};

/**
 * Hook for mobile-specific behavior
 * @returns {object} Mobile-specific state and utilities
 */
export const useMobile = () => {
  const responsive = useResponsive();
  
  return {
    isMobile: responsive.isMobile,
    isPortrait: responsive.isMobilePortrait,
    isLandscape: responsive.isMobileLandscape,
    keyboardVisible: responsive.keyboardVisible,
    keyboardHeight: responsive.keyboardHeight,
    safeAreaInsets: responsive.safeAreaInsets,
    deviceCapabilities: responsive.deviceCapabilities
  };
};

/**
 * Hook for safe area handling
 * @returns {object} Safe area utilities
 */
export const useSafeArea = () => {
  const { safeAreaInsets } = useResponsive();
  
  const applySafeAreaStyle = useCallback((position = 'all') => {
    const styles = {};
    
    switch (position) {
      case 'top':
        if (safeAreaInsets.top > 0) {
          styles.paddingTop = `max(1rem, ${safeAreaInsets.top}px)`;
        }
        break;
      case 'bottom':
        if (safeAreaInsets.bottom > 0) {
          styles.paddingBottom = `max(1rem, ${safeAreaInsets.bottom}px)`;
        }
        break;
      case 'horizontal':
        if (safeAreaInsets.left > 0) {
          styles.paddingLeft = `max(1rem, ${safeAreaInsets.left}px)`;
        }
        if (safeAreaInsets.right > 0) {
          styles.paddingRight = `max(1rem, ${safeAreaInsets.right}px)`;
        }
        break;
      case 'all':
      default:
        if (safeAreaInsets.top > 0) {
          styles.paddingTop = `max(1rem, ${safeAreaInsets.top}px)`;
        }
        if (safeAreaInsets.bottom > 0) {
          styles.paddingBottom = `max(1rem, ${safeAreaInsets.bottom}px)`;
        }
        if (safeAreaInsets.left > 0) {
          styles.paddingLeft = `max(1rem, ${safeAreaInsets.left}px)`;
        }
        if (safeAreaInsets.right > 0) {
          styles.paddingRight = `max(1rem, ${safeAreaInsets.right}px)`;
        }
        break;
    }
    
    return styles;
  }, [safeAreaInsets]);
  
  return {
    safeAreaInsets,
    applySafeAreaStyle,
    hasSafeArea: Object.values(safeAreaInsets).some(inset => inset > 0)
  };
};

/**
 * Hook for platform-specific behavior and optimizations
 * @returns {object} Platform-specific state and utilities
 */
export const usePlatform = () => {
  const { platform, deviceCapabilities, platformClasses } = useResponsive();
  
  const getAdaptiveConfiguration = useCallback((baseConfig) => {
    return getAdaptiveConfig(baseConfig);
  }, []);
  
  const shouldReduceAnimations = useCallback(() => {
    return deviceCapabilities.features?.reducedMotion || 
           deviceCapabilities.capabilities?.performanceTier === 'low' ||
           deviceCapabilities.connectionType === 'slow-2g' ||
           deviceCapabilities.connectionType === '2g';
  }, [deviceCapabilities]);
  
  const shouldOptimizeImages = useCallback(() => {
    return deviceCapabilities.connectionType === 'slow-2g' ||
           deviceCapabilities.connectionType === '2g' ||
           deviceCapabilities.capabilities?.connection?.saveData;
  }, [deviceCapabilities]);
  
  return {
    platform,
    deviceCapabilities,
    platformClasses,
    getAdaptiveConfiguration,
    shouldReduceAnimations,
    shouldOptimizeImages,
    // Platform-specific utilities
    isLowEndDevice: deviceCapabilities.capabilities?.performanceTier === 'low',
    isSlowConnection: deviceCapabilities.connectionType === 'slow-2g' || deviceCapabilities.connectionType === '2g',
    supportsAdvancedFeatures: deviceCapabilities.capabilities?.performanceTier === 'high',
    // Feature flags
    features: deviceCapabilities.features || {}
  };
};

/**
 * Hook for cross-platform touch handling
 * @param {Object} handlers - Touch event handlers
 * @returns {object} Touch utilities
 */
export const useCrossPlatformTouch = (handlers = {}) => {
  const { platform } = usePlatform();
  
  const attachTouchHandlers = useCallback((element) => {
    if (!element) return;
    
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
  }, [handlers, platform.isMobile]);
  
  return {
    attachTouchHandlers,
    isTouchDevice: platform.isMobile,
    supportsTouch: deviceCapabilities?.supportsTouch || false,
    supportsHover: deviceCapabilities?.supportsHover || false
  };
};