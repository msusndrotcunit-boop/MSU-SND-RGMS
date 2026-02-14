import React from 'react';
import PropTypes from 'prop-types';

/**
 * Card Component
 * Reusable card container with header, body, and footer sections
 * Validates Requirements: 5.5
 */
const Card = ({
  children,
  header = null,
  footer = null,
  variant = 'default',
  hoverable = false,
  clickable = false,
  onClick,
  className = '',
  ...props
}) => {
  const baseStyles = 'bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 border border-gray-100 dark:border-gray-700';
  
  const variantStyles = {
    default: '',
    bordered: 'border-2 border-gray-200 dark:border-gray-600',
    elevated: 'shadow-md',
  };
  
  const interactiveStyles = hoverable || clickable 
    ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer' 
    : '';
  
  const handleClick = (e) => {
    if (clickable && onClick) {
      onClick(e);
    }
  };
  
  const handleKeyDown = (e) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (onClick) onClick(e);
    }
  };
  
  const CardWrapper = clickable ? 'div' : 'div';
  const interactiveProps = clickable ? {
    role: 'button',
    tabIndex: 0,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  } : {};
  
  return (
    <CardWrapper
      className={`${baseStyles} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      {...interactiveProps}
      {...props}
    >
      {header && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          {header}
        </div>
      )}
      
      <div className="px-4 py-3">
        {children}
      </div>
      
      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {footer}
        </div>
      )}
    </CardWrapper>
  );
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  header: PropTypes.node,
  footer: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'bordered', 'elevated']),
  hoverable: PropTypes.bool,
  clickable: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default Card;
