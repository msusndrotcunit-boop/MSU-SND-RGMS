import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSafeArea, useMobile } from '../hooks/useResponsive';
import { applySafeAreaConstraints } from '../utils/responsive';

/**
 * SafeAreaManager - Manages safe area constraints for notched and edge-to-edge displays
 * Ensures critical UI elements remain within safe area boundaries
 */
const SafeAreaManager = ({
  children,
  className = '',
  position = 'all', // 'all', 'top', 'bottom', 'horizontal'
  enableKeyboardAdjustment = true,
  enableScrollAdjustment = true,
  ...props
}) => {
  const { safeAreaInsets, applySafeAreaStyle, hasSafeArea } = useSafeArea();
  const { isMobile, keyboardVisible, keyboardHeight } = useMobile();
  const containerRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Apply safe area styles
  const safeAreaStyles = applySafeAreaStyle(position);

  // Handle keyboard adjustment
  const keyboardStyles = enableKeyboardAdjustment && keyboardVisible ? {
    paddingBottom: `${keyboardHeight + (safeAreaInsets.bottom || 0)}px`,
    transition: 'padding-bottom 0.3s ease'
  } : {};

  // Handle scroll detection for fixed elements
  const handleScroll = useCallback(() => {
    if (!enableScrollAdjustment) return;

    const scrollY = window.scrollY;
    setScrollPosition(scrollY);
    
    if (!isScrolling) {
      setIsScrolling(true);
    }

    // Debounce scroll end detection
    clearTimeout(window.scrollEndTimer);
    window.scrollEndTimer = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, [enableScrollAdjustment, isScrolling]);

  useEffect(() => {
    if (enableScrollAdjustment) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
        clearTimeout(window.scrollEndTimer);
      };
    }
  }, [handleScroll, enableScrollAdjustment]);

  // Apply safe area constraints to the container element
  useEffect(() => {
    if (containerRef.current && hasSafeArea) {
      applySafeAreaConstraints(containerRef.current);
    }
  }, [hasSafeArea]);

  const combinedStyles = {
    ...safeAreaStyles,
    ...keyboardStyles
  };

  return (
    <div
      ref={containerRef}
      className={`safe-area-container ${className}`}
      style={combinedStyles}
      data-safe-area-position={position}
      data-has-safe-area={hasSafeArea}
      data-keyboard-visible={keyboardVisible}
      data-scrolling={isScrolling}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * SafeAreaProvider - Context provider for safe area management
 */
export const SafeAreaProvider = ({ children }) => {
  const { safeAreaInsets, hasSafeArea } = useSafeArea();
  const { isMobile } = useMobile();

  useEffect(() => {
    // Set CSS custom properties for safe area insets
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--safe-area-inset-top', `${safeAreaInsets.top}px`);
      root.style.setProperty('--safe-area-inset-right', `${safeAreaInsets.right}px`);
      root.style.setProperty('--safe-area-inset-bottom', `${safeAreaInsets.bottom}px`);
      root.style.setProperty('--safe-area-inset-left', `${safeAreaInsets.left}px`);
      root.style.setProperty('--has-safe-area', hasSafeArea ? '1' : '0');
      root.style.setProperty('--is-mobile', isMobile ? '1' : '0');
    }
  }, [safeAreaInsets, hasSafeArea, isMobile]);

  return <>{children}</>;
};

/**
 * SafeAreaSpacer - Creates spacing for safe areas
 */
export const SafeAreaSpacer = ({ 
  position = 'top', // 'top', 'bottom', 'left', 'right'
  className = '',
  minHeight = 0,
  ...props 
}) => {
  const { safeAreaInsets, hasSafeArea } = useSafeArea();

  if (!hasSafeArea) return null;

  const getSpacerSize = () => {
    switch (position) {
      case 'top':
        return Math.max(safeAreaInsets.top, minHeight);
      case 'bottom':
        return Math.max(safeAreaInsets.bottom, minHeight);
      case 'left':
        return Math.max(safeAreaInsets.left, minHeight);
      case 'right':
        return Math.max(safeAreaInsets.right, minHeight);
      default:
        return minHeight;
    }
  };

  const size = getSpacerSize();
  const isVertical = position === 'top' || position === 'bottom';

  const style = {
    [isVertical ? 'height' : 'width']: `${size}px`,
    flexShrink: 0
  };

  return (
    <div
      className={`safe-area-spacer safe-area-spacer--${position} ${className}`}
      style={style}
      data-position={position}
      data-size={size}
      {...props}
    />
  );
};

/**
 * FixedElement - Wrapper for fixed positioned elements with safe area support
 */
export const FixedElement = ({
  children,
  position = 'top', // 'top', 'bottom', 'left', 'right'
  className = '',
  respectSafeArea = true,
  adjustForKeyboard = false,
  zIndex = 40,
  ...props
}) => {
  const { safeAreaInsets, hasSafeArea } = useSafeArea();
  const { keyboardVisible, keyboardHeight } = useMobile();

  const getPositionStyles = () => {
    const styles = {
      position: 'fixed',
      zIndex
    };

    if (!respectSafeArea || !hasSafeArea) {
      styles[position] = 0;
      return styles;
    }

    switch (position) {
      case 'top':
        styles.top = `${safeAreaInsets.top}px`;
        styles.left = `${safeAreaInsets.left}px`;
        styles.right = `${safeAreaInsets.right}px`;
        break;
      case 'bottom':
        {
          let bottomOffset = safeAreaInsets.bottom;
          if (adjustForKeyboard && keyboardVisible) {
            bottomOffset += keyboardHeight;
          }
          styles.bottom = `${bottomOffset}px`;
          styles.left = `${safeAreaInsets.left}px`;
          styles.right = `${safeAreaInsets.right}px`;
        }
        break;
      case 'left':
        styles.left = `${safeAreaInsets.left}px`;
        styles.top = `${safeAreaInsets.top}px`;
        styles.bottom = `${safeAreaInsets.bottom}px`;
        break;
      case 'right':
        styles.right = `${safeAreaInsets.right}px`;
        styles.top = `${safeAreaInsets.top}px`;
        styles.bottom = `${safeAreaInsets.bottom}px`;
        break;
      default:
        styles[position] = 0;
    }

    return styles;
  };

  return (
    <div
      className={`fixed-element fixed-element--${position} ${className}`}
      style={getPositionStyles()}
      data-position={position}
      data-respect-safe-area={respectSafeArea}
      data-adjust-for-keyboard={adjustForKeyboard}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * ViewportAdjuster - Adjusts content for virtual keyboard and safe areas
 */
export const ViewportAdjuster = ({
  children,
  className = '',
  adjustForKeyboard = true,
  maintainScrollPosition = false,
  ...props
}) => {
  const { keyboardVisible, keyboardHeight } = useMobile();
  const { safeAreaInsets } = useSafeArea();
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (maintainScrollPosition && keyboardVisible) {
      setScrollPosition(window.scrollY);
    }
  }, [keyboardVisible, maintainScrollPosition]);

  useEffect(() => {
    if (maintainScrollPosition && !keyboardVisible && scrollPosition > 0) {
      window.scrollTo(0, scrollPosition);
    }
  }, [keyboardVisible, scrollPosition, maintainScrollPosition]);

  const adjustmentStyles = {
    paddingBottom: adjustForKeyboard && keyboardVisible 
      ? `${keyboardHeight + safeAreaInsets.bottom}px` 
      : `${safeAreaInsets.bottom}px`,
    paddingTop: `${safeAreaInsets.top}px`,
    paddingLeft: `${safeAreaInsets.left}px`,
    paddingRight: `${safeAreaInsets.right}px`,
    transition: 'padding 0.3s ease',
    minHeight: keyboardVisible ? `calc(100vh - ${keyboardHeight}px)` : '100vh'
  };

  return (
    <div
      className={`viewport-adjuster ${className}`}
      style={adjustmentStyles}
      data-keyboard-visible={keyboardVisible}
      data-keyboard-height={keyboardHeight}
      {...props}
    >
      {children}
    </div>
  );
};

export default SafeAreaManager;
