import React from 'react';

/**
 * MobileCard - Optimized card component for mobile-first design
 * 
 * Props:
 * - children: Card content
 * - title: Optional card title
 * - actions: Optional action buttons
 * - onClick: Optional click handler
 * - className: Additional classes
 */
const MobileCard = ({ 
  children, 
  title, 
  actions = [], 
  onClick, 
  className = '' 
}) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200
        ${isClickable ? 'cursor-pointer active:bg-gray-50' : ''}
        ${className}
      `}
    >
      {/* Header */}
      {(title || actions.length > 0) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          {title && (
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          )}
          {actions.length > 0 && (
            <div className="flex items-center gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  className="touch-target p-2 text-gray-600 hover:text-gray-900"
                  aria-label={action.label}
                >
                  {action.icon}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default MobileCard;
