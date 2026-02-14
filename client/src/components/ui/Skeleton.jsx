import React from 'react';
import PropTypes from 'prop-types';

/**
 * Skeleton Component
 * Loading placeholder with multiple variants
 * Validates Requirements: 2.2, 13.4
 */
const Skeleton = ({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  count = 1,
  ...props
}) => {
  const baseStyles = 'bg-gray-200 dark:bg-gray-700';
  
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };
  
  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'skeleton',
    none: '',
  };
  
  const getStyles = () => {
    const styles = {
      width: width || (variant === 'circular' ? '40px' : '100%'),
      height: height || (variant === 'text' ? '1rem' : variant === 'circular' ? '40px' : '200px'),
    };
    return styles;
  };
  
  const skeletonElement = (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={getStyles()}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  );
  
  if (count === 1) {
    return skeletonElement;
  }
  
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
          style={getStyles()}
          aria-busy="true"
          aria-live="polite"
        />
      ))}
    </div>
  );
};

Skeleton.propTypes = {
  variant: PropTypes.oneOf(['text', 'circular', 'rectangular']),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  animation: PropTypes.oneOf(['pulse', 'wave', 'none']),
  className: PropTypes.string,
  count: PropTypes.number,
};

/**
 * SkeletonCard Component
 * Pre-configured skeleton for card layouts
 */
export const SkeletonCard = ({ showAvatar = false, lines = 3 }) => {
  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      {showAvatar && (
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width="40px" height="40px" />
          <div className="flex-1">
            <Skeleton width="60%" />
          </div>
        </div>
      )}
      <Skeleton count={lines} />
    </div>
  );
};

SkeletonCard.propTypes = {
  showAvatar: PropTypes.bool,
  lines: PropTypes.number,
};

/**
 * SkeletonTable Component
 * Pre-configured skeleton for table layouts
 */
export const SkeletonTable = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} width="100%" height="20px" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} width="100%" height="16px" />
          ))}
        </div>
      ))}
    </div>
  );
};

SkeletonTable.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
};

export default Skeleton;
