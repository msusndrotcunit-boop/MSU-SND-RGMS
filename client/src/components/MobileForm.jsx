import React from 'react';
import PropTypes from 'prop-types';

/**
 * Mobile-optimized form wrapper component
 * Provides full-width inputs with proper spacing
 * Stacks buttons vertically on mobile
 */
const MobileForm = ({ children, onSubmit, className = '' }) => {
  return (
    <form 
      onSubmit={onSubmit}
      className={`space-y-4 md:space-y-6 ${className}`}
    >
      {children}
    </form>
  );
};

MobileForm.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func,
  className: PropTypes.string
};

MobileForm.defaultProps = {
  onSubmit: (e) => e.preventDefault(),
  className: ''
};

/**
 * Mobile-optimized form field wrapper
 */
export const MobileFormField = ({ 
  label, 
  children, 
  error = null, 
  helperText = null,
  required = false,
  className = '' 
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

MobileFormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  error: PropTypes.string,
  helperText: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string
};

/**
 * Mobile-optimized text input
 */
export const MobileInput = ({ 
  type = 'text',
  value,
  onChange,
  placeholder = '',
  className = '',
  ...props 
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent ${className}`}
      style={{ fontSize: '16px' }} // Prevent iOS zoom
      {...props}
    />
  );
};

MobileInput.propTypes = {
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string
};

/**
 * Mobile-optimized textarea
 */
export const MobileTextarea = ({ 
  value,
  onChange,
  placeholder = '',
  rows = 4,
  className = '',
  ...props 
}) => {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent ${className}`}
      style={{ fontSize: '16px' }} // Prevent iOS zoom
      {...props}
    />
  );
};

MobileTextarea.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  className: PropTypes.string
};

/**
 * Mobile-optimized select dropdown
 */
export const MobileSelect = ({ 
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
  ...props 
}) => {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent ${className}`}
      style={{ fontSize: '16px' }} // Prevent iOS zoom
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

MobileSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired
    })
  ),
  placeholder: PropTypes.string,
  className: PropTypes.string
};

/**
 * Mobile-optimized button group
 * Stacks buttons vertically on mobile, horizontally on larger screens
 */
export const MobileButtonGroup = ({ children, className = '' }) => {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 pt-4 ${className}`}>
      {children}
    </div>
  );
};

MobileButtonGroup.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

/**
 * Mobile-optimized button
 */
export const MobileButton = ({ 
  children,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  onClick,
  disabled = false,
  className = '',
  ...props 
}) => {
  const baseClasses = 'px-6 py-3 rounded-md font-medium min-h-[44px] transition-colors duration-200';
  const widthClasses = fullWidth ? 'w-full' : 'w-full sm:w-auto';
  
  const variantClasses = {
    primary: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300',
    secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300',
    outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50 disabled:border-gray-300 disabled:text-gray-300'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${widthClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

MobileButton.propTypes = {
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'outline']),
  fullWidth: PropTypes.bool,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string
};

export default MobileForm;
