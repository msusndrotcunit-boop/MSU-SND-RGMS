import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useMobile, useSafeArea } from '../hooks/useResponsive';
import { useAdaptiveNavigation, useViewportNavigation } from '../hooks/useOrientationChange';

/**
 * MobileNavigation - Unified mobile navigation component
 * Provides consistent navigation patterns across all layouts
 */
const MobileNavigation = ({
  title,
  navItems = [],
  userInfo = null,
  onLogout,
  primaryColor = 'var(--primary-color)',
  className = '',
  children
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const location = useLocation();
  const { isMobile } = useMobile();
  const { applySafeAreaStyle } = useSafeArea();
  const { 
    orientation, 
    isLandscape, 
    shouldAutoClose, 
    getNavigationConfig, 
    getSpacingConfig,
    isTransitioning 
  } = useAdaptiveNavigation();
  const { keyboardVisible, getKeyboardAdjustments } = useViewportNavigation();

  const navConfig = getNavigationConfig();
  const spacingConfig = getSpacingConfig();
  const keyboardAdjustments = getKeyboardAdjustments();

  // Auto-close sidebar in landscape mode on small screens
  useEffect(() => {
    if (shouldAutoClose && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [shouldAutoClose, isSidebarOpen]);

  // Close sidebar when keyboard appears
  useEffect(() => {
    if (keyboardVisible && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [keyboardVisible, isSidebarOpen]);

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSidebarOpen]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const toggleMenu = (label) => {
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavItemClick = (item) => {
    if (item.onClick) {
      item.onClick();
    }
    if (!item.children) {
      setIsSidebarOpen(false);
    }
  };

  const getItemSpacing = () => {
    if (spacingConfig.spacing === 'tight') {
      return 'space-y-1';
    }
    return 'space-y-2';
  };

  const getItemPadding = () => {
    if (spacingConfig.padding === 'compact') {
      return 'p-2';
    }
    return 'p-3';
  };

  const getItemHeight = () => {
    if (spacingConfig.spacing === 'tight') {
      return '44px';
    }
    return '48px';
  };

  const renderNavItem = (item, index) => {
    const Icon = item.icon;
    const isActive = item.path && location.pathname === item.path;
    const isParentActive = item.children && item.children.some(child => location.pathname === child.path);
    const isExpanded = expandedMenus[item.label];

    if (item.children) {
      return (
        <div key={item.label || index} className="space-y-1">
          <button
            onClick={() => toggleMenu(item.label)}
            className={clsx(
              "w-full flex items-center justify-between rounded-lg transition-all duration-200 touch-target",
              "hover:bg-black/10 active:bg-black/20",
              isParentActive ? "bg-black/15 text-white" : "text-white/80 hover:text-white",
              getItemPadding()
            )}
            style={{ minHeight: getItemHeight() }}
          >
            <div className="flex items-center space-x-3">
              {Icon && <Icon size={20} className="flex-shrink-0" />}
              <span className="font-medium">{item.label}</span>
            </div>
            <div className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <ChevronRight size={16} />
            </div>
          </button>
          
          {isExpanded && (
            <div className="ml-8 space-y-1 border-l-2 border-white/20 pl-3">
              {item.children.map(child => renderNavItem(child, `${index}-${child.label}`))}
            </div>
          )}
        </div>
      );
    }

    const isDisabled = item.disabled;
    const Component = item.path && !isDisabled ? Link : 'button';
    const componentProps = item.path && !isDisabled ? { to: item.path } : {};

    return (
      <Component
        key={item.label || index}
        {...componentProps}
        onClick={() => handleNavItemClick(item)}
        disabled={isDisabled}
        className={clsx(
          "w-full flex items-center space-x-3 rounded-lg transition-all duration-200 touch-target",
          "hover:bg-black/10 active:bg-black/20",
          isActive ? "bg-black/15 text-white" : "text-white/80 hover:text-white",
          isDisabled && "opacity-50 cursor-not-allowed",
          getItemPadding()
        )}
        style={{ minHeight: getItemHeight() }}
      >
        {Icon && <Icon size={20} className="flex-shrink-0" />}
        <span className="font-medium flex-1 text-left">{item.label}</span>
        {item.badge && (
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
            {item.badge}
          </span>
        )}
        {isDisabled && item.lockIcon && (
          <item.lockIcon size={16} className="flex-shrink-0 ml-auto" />
        )}
      </Component>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white touch-target"
          style={{ minHeight: '48px', minWidth: '48px' }}
          aria-label="Toggle navigation menu"
        >
          <Menu size={28} />
        </button>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div 
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-64",
          "text-white shadow-xl md:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          isTransitioning && "transition-all duration-300",
          className
        )}
        style={{ 
          backgroundColor: primaryColor,
          width: `${navConfig.sidebarWidth}px`,
          maxWidth: '85vw',
          ...applySafeAreaStyle('horizontal')
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10" style={applySafeAreaStyle('top')}>
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="md:hidden text-white/80 hover:text-white p-2 touch-target"
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label="Close navigation menu"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* User Info */}
          {userInfo && (
            <div className="mt-4 flex items-center space-x-3">
              {userInfo.avatar && (
                <Link to={userInfo.profilePath || '#'} className="flex-shrink-0">
                  <img 
                    src={userInfo.avatar} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full border-2 border-white/20 object-cover"
                    onError={(e) => {
                      if (userInfo.fallbackAvatar) {
                        e.target.src = userInfo.fallbackAvatar;
                      }
                    }}
                  />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">
                  {userInfo.name}
                </div>
                {userInfo.role && (
                  <div className="text-white/70 text-xs truncate">
                    {userInfo.role}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className={clsx("flex-1 p-4 overflow-y-auto", getItemSpacing())}>
          {navItems.map((item, index) => renderNavItem(item, index))}
        </nav>

        {/* Footer Actions */}
        {!keyboardAdjustments.hideFooter && (
          <div className="p-4 border-t border-white/10" style={applySafeAreaStyle('bottom')}>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-3 p-3 text-left text-white/80 hover:text-white hover:bg-black/10 rounded-lg transition-all duration-200 touch-target"
              style={{ minHeight: '48px' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="font-medium">Logout</span>
            </button>
          )}
          {children}
        </div>
        )}
      </div>
    </>
  );
};

/**
 * MobileHeader - Standardized mobile header component
 */
export const MobileHeader = ({ 
  title, 
  actions = [], 
  showMenuButton = true,
  onMenuClick,
  className = ''
}) => {
  const { applySafeAreaStyle } = useSafeArea();

  return (
    <header 
      className={clsx(
        "bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700",
        "flex items-center justify-between px-4 py-3 sticky top-0 z-30",
        className
      )}
      style={applySafeAreaStyle('top')}
    >
      <div className="flex items-center space-x-3">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white touch-target"
            style={{ minHeight: '48px', minWidth: '48px' }}
            aria-label="Toggle navigation menu"
          >
            <Menu size={28} />
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {title}
        </h1>
      </div>

      {actions.length > 0 && (
        <div className="flex items-center space-x-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={clsx(
                "p-2 rounded-lg transition-colors touch-target",
                "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                "dark:text-gray-200 dark:hover:text-white dark:hover:bg-gray-700",
                action.className
              )}
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label={action.label}
            >
              {action.icon && <action.icon size={20} />}
              {action.badge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {action.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

export default MobileNavigation;
