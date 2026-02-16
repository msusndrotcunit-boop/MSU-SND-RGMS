import { useEffect, useState, useCallback } from 'react';
import { debounce } from '../utils/responsive';

/**
 * Hook for handling orientation changes and adaptive behavior
 * Provides orientation state and utilities for responsive navigation
 */
export const useOrientationChange = () => {
  const [orientation, setOrientation] = useState(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle orientation change with debouncing
  const handleOrientationChange = useCallback(
    debounce(() => {
      if (typeof window === 'undefined') return;

      const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      
      if (newOrientation !== orientation) {
        setIsTransitioning(true);
        setOrientation(newOrientation);
        
        // Clear transition state after animation completes
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }
    }, 150),
    [orientation]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen for both resize and orientationchange events
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Initial check
    handleOrientationChange();

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [handleOrientationChange]);

  return {
    orientation,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    isTransitioning
  };
};

/**
 * Hook for adaptive navigation behavior based on orientation
 */
export const useAdaptiveNavigation = () => {
  const { orientation, isPortrait, isLandscape, isTransitioning } = useOrientationChange();
  const [shouldAutoClose, setShouldAutoClose] = useState(false);

  // Auto-close navigation in landscape mode on small screens
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isSmallScreen = window.innerWidth < 768;
    setShouldAutoClose(isLandscape && isSmallScreen);
  }, [isLandscape]);

  // Get navigation configuration based on orientation
  const getNavigationConfig = useCallback(() => {
    if (typeof window === 'undefined') {
      return {
        sidebarWidth: 280,
        headerHeight: 64,
        compactMode: false,
        autoCollapse: false
      };
    }

    const isSmallScreen = window.innerWidth < 768;
    
    if (isPortrait) {
      return {
        sidebarWidth: Math.min(320, window.innerWidth * 0.85),
        headerHeight: 64,
        compactMode: false,
        autoCollapse: false
      };
    } else {
      // Landscape mode - more compact
      return {
        sidebarWidth: Math.min(280, window.innerWidth * 0.75),
        headerHeight: isSmallScreen ? 56 : 64,
        compactMode: isSmallScreen,
        autoCollapse: isSmallScreen
      };
    }
  }, [isPortrait]);

  // Get spacing configuration for different orientations
  const getSpacingConfig = useCallback(() => {
    if (isLandscape && typeof window !== 'undefined' && window.innerWidth < 768) {
      return {
        padding: 'compact', // Reduced padding in landscape
        spacing: 'tight',   // Tighter spacing between elements
        fontSize: 'small'   // Smaller font sizes
      };
    }

    return {
      padding: 'normal',
      spacing: 'normal',
      fontSize: 'normal'
    };
  }, [isLandscape]);

  return {
    orientation,
    isPortrait,
    isLandscape,
    isTransitioning,
    shouldAutoClose,
    getNavigationConfig,
    getSpacingConfig
  };
};

/**
 * Hook for handling viewport changes that affect navigation
 */
export const useViewportNavigation = () => {
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerHeight;
  });

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialHeight = window.innerHeight;

    const handleViewportChange = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialHeight - currentHeight;
      
      setViewportHeight(currentHeight);
      setKeyboardVisible(heightDifference > 150); // Threshold for keyboard detection
    };

    // Use Visual Viewport API if available (better for mobile)
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        setKeyboardVisible(keyboardHeight > 150);
        setViewportHeight(window.visualViewport.height);
      };

      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      return () => window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleViewportChange);
      return () => window.removeEventListener('resize', handleViewportChange);
    }
  }, []);

  // Get navigation adjustments for keyboard visibility
  const getKeyboardAdjustments = useCallback(() => {
    if (!keyboardVisible) {
      return {
        adjustHeight: false,
        hideFooter: false,
        compactHeader: false
      };
    }

    return {
      adjustHeight: true,
      hideFooter: true,      // Hide footer when keyboard is visible
      compactHeader: true    // Make header more compact
    };
  }, [keyboardVisible]);

  return {
    viewportHeight,
    keyboardVisible,
    getKeyboardAdjustments
  };
};

export default useOrientationChange;