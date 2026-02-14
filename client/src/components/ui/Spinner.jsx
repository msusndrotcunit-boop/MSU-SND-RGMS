import React from 'react';
import PropTypes from 'prop-types';

/**
 * Spinner Component
 * Loading spinner with configurable size and color
 * Validates Requirements: 2.1, 12.2
 */
const Spinner = ({
  size = 'md',
  color = 'primary',
  label = 'Loading...',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };
  
  const colorStyles = {
    primary: 'text-primary-500',
    white: 'text-white',
    gray: 'text-gray-500',
    success: 'text-success',
    error: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  };
  
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={label}
      {...props}
    >
      <svg
        className={`animate-spin ${sizeStyles[size]} ${colorStyles[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  color: PropTypes.oneOf(['primary', 'white', 'gray', 'success', 'error', 'warning', 'info']),
  label: PropTypes.string,
  className: PropTypes.string,
};

/**
 * FullPageSpinner Component
 * Centered full-page loading spinner
 */
export const FullPageSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 z-fixed">
      <Spinner size="xl" />
      {message && (
        <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
};

FullPageSpinner.propTypes = {
  message: PropTypes.string,
};

/**
 * InlineSpinner Component
 * Inline spinner with optional text
 */
export const InlineSpinner = ({ text, size = 'sm' }) => {
  return (
    <div className="inline-flex items-center gap-2">
      <Spinner size={size} />
      {text && <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>}
    </div>
  );
};

InlineSpinner.propTypes = {
  text: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
};

export default Spinner;
