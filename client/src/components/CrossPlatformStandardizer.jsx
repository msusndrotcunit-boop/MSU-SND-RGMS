import React, { useEffect, useRef, useCallback } from 'react';
import { usePlatform, useCrossPlatformTouch } from '../hooks/useResponsive';
import { CrossPlatformHandler } from '../utils/performance';

/**
 * CrossPlatformStandardizer - Ensures consistent behavior across platforms
 * Handles touch gestures, font rendering, and platform-specific optimizations
 */
const CrossPlatformStandardizer = ({ children, className = '', ...props }) => {
  const containerRef = useRef(null);
  const { platform, platformClasses, shouldReduceAnimations } = usePlatform();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Apply platform-specific optimizations
    CrossPlatformHandler.applyPlatformOptimizations(container);
    
    // Add platform classes for CSS targeting
    container.className += ` ${platformClasses}`;
    
    // Apply performance optimizations
    if (shouldReduceAnimations()) {
      container.style.setProperty('--animation-duration', '0.1s');
      container.style.setProperty('--transition-duration', '0.1s');
    }
    
    // Platform-specific font optimizations
    if (platform.isIOS) {
      container.style.webkitFontSmoothing = 'antialiased';
      container.style.mozOsxFontSmoothing = 'grayscale';
    }
    
    if (platform.isAndroid) {
      container.style.textRendering = 'optimizeLegibility';
    }
    
  }, [platform, platformClasses, shouldReduceAnimations]);

  return (
    <div
      ref={containerRef}
      className={`cross-platform-standardizer ${className}`}
      data-platform={platform.isIOS ? 'ios' : platform.isAndroid ? 'android' : 'desktop'}
      data-pwa={platform.isPWA}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * StandardizedTouchButton - Button with consistent touch behavior across platforms
 */
export const StandardizedTouchButton = ({
  children,
  onClick,
  onTouchStart,
  onTouchEnd,
  className = '',
  disabled = false,
  variant = 'default',
  size = 'medium',
  ...props
}) => {
  const buttonRef = useRef(null);
  const { platform } = usePlatform();
  const [isPressed, setIsPressed] = React.useState(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    setIsPressed(true);
    if (onTouchStart) onTouchStart(e);
  }, [disabled, onTouchStart]);

  const handleTouchEnd = useCallback((e) => {
    if (disabled) return;
    setIsPressed(false);
    if (onTouchEnd) onTouchEnd(e);
  }, [disabled, onTouchEnd]);

  const handleClick = useCallback((e) => {
    if (disabled) return;
    if (onClick) onClick(e);
  }, [disabled, onClick]);

  const { attachTouchHandlers } = useCrossPlatformTouch({
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onClick: handleClick
  });

  useEffect(() => {
    if (buttonRef.current) {
      attachTouchHandlers(buttonRef.current);
    }
  }, [attachTouchHandlers]);

  const getButtonClasses = () => {
    const baseClasses = 'cross-platform-button cross-platform-touch-target';
    const variantClasses = {
      default: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50'
    };
    const sizeClasses = {
      small: 'px-3 py-2 text-sm',
      medium: 'px-4 py-2 text-base',
      large: 'px-6 py-3 text-lg'
    };
    
    return [
      baseClasses,
      variantClasses[variant] || variantClasses.default,
      sizeClasses[size] || sizeClasses.medium,
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      isPressed ? 'transform scale-95' : '',
      className
    ].filter(Boolean).join(' ');
  };

  return (
    <button
      ref={buttonRef}
      className={getButtonClasses()}
      disabled={disabled}
      data-pressed={isPressed}
      data-platform={platform.isIOS ? 'ios' : platform.isAndroid ? 'android' : 'desktop'}
      style={{
        transition: 'all 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation'
      }}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * StandardizedInput - Input with consistent behavior across platforms
 */
export const StandardizedInput = ({
  type = 'text',
  className = '',
  onFocus,
  onBlur,
  ...props
}) => {
  const inputRef = useRef(null);
  const { platform } = usePlatform();

  const handleFocus = useCallback((e) => {
    // Prevent iOS zoom on input focus
    if (platform.isIOS && inputRef.current) {
      const fontSize = window.getComputedStyle(inputRef.current).fontSize;
      if (parseFloat(fontSize) < 16) {
        inputRef.current.style.fontSize = '16px';
      }
    }
    if (onFocus) onFocus(e);
  }, [platform.isIOS, onFocus]);

  const handleBlur = useCallback((e) => {
    if (onBlur) onBlur(e);
  }, [onBlur]);

  return (
    <input
      ref={inputRef}
      type={type}
      className={`cross-platform-input ${className}`}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{
        fontSize: '16px', // Prevent iOS zoom
        WebkitAppearance: 'none',
        appearance: 'none',
        borderRadius: '0.375rem'
      }}
      {...props}
    />
  );
};

/**
 * StandardizedText - Text with consistent font rendering across platforms
 */
export const StandardizedText = ({
  children,
  variant = 'body',
  className = '',
  ...props
}) => {
  const { platform } = usePlatform();

  const getTextClasses = () => {
    const baseClasses = 'cross-platform-text';
    const variantClasses = {
      heading: 'font-bold text-xl leading-tight',
      subheading: 'font-semibold text-lg leading-snug',
      body: 'text-base leading-relaxed',
      caption: 'text-sm leading-normal',
      small: 'text-xs leading-tight'
    };
    
    return [
      baseClasses,
      variantClasses[variant] || variantClasses.body,
      className
    ].filter(Boolean).join(' ');
  };

  const getTextStyles = () => {
    const baseStyles = {
      fontFamily: platform.isIOS 
        ? '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
        : platform.isAndroid 
        ? '"Roboto", system-ui, sans-serif'
        : 'system-ui, -apple-system, sans-serif'
    };

    if (platform.isIOS) {
      baseStyles.WebkitFontSmoothing = 'antialiased';
      baseStyles.MozOsxFontSmoothing = 'grayscale';
    }

    if (platform.isAndroid) {
      baseStyles.textRendering = 'optimizeLegibility';
    }

    return baseStyles;
  };

  const Component = variant === 'heading' ? 'h2' : 
                   variant === 'subheading' ? 'h3' : 
                   variant === 'caption' || variant === 'small' ? 'span' : 'p';

  return (
    <Component
      className={getTextClasses()}
      style={getTextStyles()}
      data-platform={platform.isIOS ? 'ios' : platform.isAndroid ? 'android' : 'desktop'}
      {...props}
    >
      {children}
    </Component>
  );
};

/**
 * StandardizedLink - Link with consistent behavior across platforms
 */
export const StandardizedLink = ({
  children,
  href,
  external = false,
  className = '',
  onClick,
  ...props
}) => {
  const { platform } = usePlatform();

  const handleClick = useCallback((e) => {
    if (external && platform.isPWA) {
      e.preventDefault();
      CrossPlatformHandler.handleNavigation(href, { external: true });
    }
    if (onClick) onClick(e);
  }, [external, platform.isPWA, href, onClick]);

  return (
    <a
      href={href}
      className={`cross-platform-link ${external ? 'external-link' : ''} ${className}`}
      onClick={handleClick}
      target={external && !platform.isPWA ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.2)',
        touchAction: 'manipulation'
      }}
      {...props}
    >
      {children}
    </a>
  );
};

/**
 * GestureHandler - Standardized gesture handling across platforms
 */
export const GestureHandler = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinch,
  onRotate,
  threshold = 50,
  className = '',
  ...props
}) => {
  const containerRef = useRef(null);
  const gestureState = useRef({
    startX: 0,
    startY: 0,
    startDistance: 0,
    startAngle: 0,
    isGesturing: false
  });

  const getDistance = (touch1, touch2) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const getAngle = (touch1, touch2) => {
    return Math.atan2(
      touch2.clientY - touch1.clientY,
      touch2.clientX - touch1.clientX
    ) * 180 / Math.PI;
  };

  const handleTouchStart = useCallback((e) => {
    const touches = e.touches;
    
    if (touches.length === 1) {
      gestureState.current.startX = touches[0].clientX;
      gestureState.current.startY = touches[0].clientY;
      gestureState.current.isGesturing = true;
    } else if (touches.length === 2) {
      gestureState.current.startDistance = getDistance(touches[0], touches[1]);
      gestureState.current.startAngle = getAngle(touches[0], touches[1]);
      gestureState.current.isGesturing = true;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!gestureState.current.isGesturing) return;
    
    const touches = e.touches;
    
    if (touches.length === 2 && (onPinch || onRotate)) {
      const currentDistance = getDistance(touches[0], touches[1]);
      const currentAngle = getAngle(touches[0], touches[1]);
      
      if (onPinch) {
        const scale = currentDistance / gestureState.current.startDistance;
        onPinch({ scale, distance: currentDistance });
      }
      
      if (onRotate) {
        const rotation = currentAngle - gestureState.current.startAngle;
        onRotate({ rotation, angle: currentAngle });
      }
    }
  }, [onPinch, onRotate]);

  const handleTouchEnd = useCallback((e) => {
    if (!gestureState.current.isGesturing) return;
    
    const changedTouches = e.changedTouches;
    
    if (changedTouches.length === 1) {
      const endX = changedTouches[0].clientX;
      const endY = changedTouches[0].clientY;
      const deltaX = endX - gestureState.current.startX;
      const deltaY = endY - gestureState.current.startY;
      
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight({ deltaX, deltaY });
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft({ deltaX, deltaY });
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > threshold) {
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown({ deltaX, deltaY });
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp({ deltaX, deltaY });
          }
        }
      }
    }
    
    gestureState.current.isGesturing = false;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`gesture-handler ${className}`}
      style={{ touchAction: 'none' }}
      {...props}
    >
      {children}
    </div>
  );
};

export default CrossPlatformStandardizer;