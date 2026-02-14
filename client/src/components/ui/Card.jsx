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
  const baseStyles = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-fast';
  
  const variantStyles = {
    default: '',
    bordered: 'border border-gray-200 dark:border-gray-700',
    elevated: 'shadow-lg',
  };
  
  const interactiveStyles = hoverable || clickable 
    ? 'hover-lift cursor-pointer hover:shadow-lg' 
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
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {header}
        </div>
      )}
      
      <div className="px-6 py-4">
        {children}
      </div>
      
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
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
