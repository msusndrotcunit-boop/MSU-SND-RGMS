import React from 'react';
import { Menu } from 'lucide-react';

/**
 * MobileHeader - Responsive header with hamburger menu
 * 
 * Props:
 * - onMenuClick: Handler for hamburger menu click
 * - title: Page title
 * - actions: Optional array of action buttons
 */
const MobileHeader = ({ onMenuClick, title, actions = [] }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Hamburger Menu */}
        <button
          onClick={onMenuClick}
          className="touch-target p-2 -ml-2 text-gray-600 hover:text-gray-900"
          aria-label="Open menu"
          style={{ minHeight: '48px', minWidth: '48px' }}
        >
          <Menu size={28} />
        </button>

        {/* Title */}
        <h1 className="text-lg font-semibold text-gray-900 truncate flex-1 mx-3">
          {title}
        </h1>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="touch-target p-2 text-gray-600 hover:text-gray-900"
                aria-label={action.label}
              >
                {action.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default MobileHeader;
