import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { useMobile, useSafeArea } from '../hooks/useResponsive';

/**
 * MobileModalManager - Viewport-aware modal component optimized for mobile devices
 * Provides consistent modal behavior with proper sizing, scrolling, and safe area handling
 */
const MobileModalManager = ({
  isOpen = false,
  onClose,
  title,
  children,
  size = 'default', // 'small', 'default', 'large', 'fullscreen'
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  preventBodyScroll = true,
  className = '',
  contentClassName = '',
  headerClassName = '',
  footerActions = null,
  stickyFooter = false,
  maxHeight = 'auto',
  ...props
}) => {
  const { isMobile, keyboardVisible, keyboardHeight } = useMobile();
  const { applySafeAreaStyle } = useSafeArea();
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Size configurations
  const sizeConfig = {
    small: {
      mobile: 'w-full max-w-sm',
      desktop: 'w-full max-w-md'
    },
    default: {
      mobile: 'w-full max-w-full',
      desktop: 'w-full max-w-2xl'
    },
    large: {
      mobile: 'w-full max-w-full',
      desktop: 'w-full max-w-4xl'
    },
    fullscreen: {
      mobile: 'w-full h-full',
      desktop: 'w-full max-w-6xl h-full max-h-[95vh]'
    }
  };

  // Calculate modal dimensions based on viewport and keyboard
  const getModalStyles = useCallback(() => {
    if (!isMobile) return {};

    const viewportHeight = window.innerHeight;
    const availableHeight = keyboardVisible ? viewportHeight - keyboardHeight : viewportHeight;
    
    const styles = {
      maxHeight: size === 'fullscreen' ? '100vh' : `${Math.min(availableHeight * 0.9, 800)}px`,
      ...applySafeAreaStyle('all')
    };

    // Adjust for keyboard
    if (keyboardVisible) {
      styles.marginBottom = `${keyboardHeight + 16}px`;
      styles.maxHeight = `${availableHeight - 32}px`;
    }

    return styles;
  }, [isMobile, keyboardVisible, keyboardHeight, size, applySafeAreaStyle]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle body scroll prevention
  useEffect(() => {
    if (!isOpen || !preventBodyScroll) return;

    const originalStyle = window.getComputedStyle(document.body);
    const originalOverflow = originalStyle.overflow;
    const originalPaddingRight = originalStyle.paddingRight;

    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen, preventBodyScroll]);

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle modal collapse for mobile (slide down to minimize)
  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalSizeClass = isMobile ? sizeConfig[size].mobile : sizeConfig[size].desktop;
  const modalStyles = getModalStyles();

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex items-end md:items-center justify-center",
        "bg-black/60 backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        isAnimating && "animate-in fade-in duration-300",
        className
      )}
      onClick={handleBackdropClick}
      {...props}
    >
        <div
          ref={modalRef}
          className={clsx(
            "bg-white dark:bg-gray-800 shadow-2xl",
            "transition-all duration-300 ease-out transform",
            // Mobile-first responsive sizing
            isMobile ? [
              "w-full mx-4 mb-4",
              size === 'fullscreen' ? "h-full rounded-t-2xl" : "rounded-2xl",
              isCollapsed && size !== 'fullscreen' && "translate-y-[calc(100%-4rem)]"
            ] : [
              modalSizeClass,
              "mx-4 rounded-xl",
              isAnimating && "animate-in zoom-in-95 duration-300"
            ],
            // Safe area handling
            isMobile && "overflow-hidden",
            contentClassName
          )}
          style={modalStyles}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={clsx(
            "flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700",
            isMobile && "sticky top-0 bg-white dark:bg-gray-800 z-10",
            headerClassName
          )}>
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {title}
                </h2>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Mobile collapse button */}
              {isMobile && size !== 'fullscreen' && (
                <button
                  onClick={handleCollapse}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-target"
                  title={isCollapsed ? 'Expand' : 'Minimize'}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  {isCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              )}

              {/* Close button */}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-target"
                  title="Close"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Modal Content */}
          <div
            ref={contentRef}
            className={clsx(
              "overflow-y-auto",
              // Handle collapsed state
              isCollapsed && isMobile && size !== 'fullscreen' && "hidden",
              // Proper scrolling with safe areas
              isMobile && "-webkit-overflow-scrolling: touch",
              // Adjust for sticky footer
              stickyFooter && footerActions && "pb-16"
            )}
            style={{
              maxHeight: maxHeight === 'auto' 
                ? (isMobile ? 'calc(100vh - 8rem)' : 'calc(90vh - 8rem)')
                : maxHeight
            }}
          >
            <div className="p-4 md:p-6">
              {children}
            </div>
          </div>

          {/* Modal Footer */}
          {footerActions && (
            <div className={clsx(
              "border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50",
              stickyFooter && isMobile && "sticky bottom-0",
              // Handle collapsed state
              isCollapsed && isMobile && size !== 'fullscreen' && "hidden"
            )}>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
                {footerActions}
              </div>
            </div>
          )}

          {/* Mobile drag indicator for collapsed state */}
          {isMobile && isCollapsed && size !== 'fullscreen' && (
            <div 
              className="absolute top-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer"
              onClick={handleCollapse}
            />
          )}
        </div>
    </div>
  );
};

/**
 * Hook for managing modal state with mobile optimizations
 */
export const useMobileModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const { isMobile } = useMobile();

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleModal = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal,
    isMobile
  };
};

/**
 * Confirmation Modal Component
 */
export const MobileConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // 'default', 'danger', 'warning'
  ...props
}) => {
  const variantStyles = {
    default: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white'
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <MobileModalManager
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      footerActions={
        <>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors touch-target"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={clsx(
              "w-full sm:w-auto px-4 py-2 rounded-lg transition-colors touch-target",
              variantStyles[variant]
            )}
          >
            {confirmText}
          </button>
        </>
      }
      {...props}
    >
      <div className="text-gray-700 dark:text-gray-300">
        {message}
      </div>
    </MobileModalManager>
  );
};

export default MobileModalManager;
