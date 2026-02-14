import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Input Component
 * Reusable input with validation and accessibility
 * Validates Requirements: 11.1, 11.2, 12.2
 */
const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder = '',
  error = '',
  helperText = '',
  disabled = false,
  required = false,
  icon = null,
  iconPosition = 'left',
  validate = null,
  debounceMs = 300,
  className = '',
  inputClassName = '',
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(value || '');
  const [validationError, setValidationError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimer = useRef(null);
  const inputId = useRef(`input-${Math.random().toString(36).substr(2, 9)}`);
  
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);
  
  const handleChange = (e) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    
    if (onChange) {
      onChange(e);
    }
    
    // Debounced validation
    if (validate) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      debounceTimer.current = setTimeout(() => {
        const validationResult = validate(newValue);
        setValidationError(validationResult || '');
      }, debounceMs);
    }
  };
  
  const handleBlur = (e) => {
    setIsFocused(false);
    
    // Immediate validation on blur
    if (validate) {
      const validationResult = validate(e.target.value);
      setValidationError(validationResult || '');
    }
    
    if (onBlur) {
      onBlur(e);
    }
  };
  
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const displayError = error || validationError;
  const hasError = Boolean(displayError);
  
  const baseInputStyles = 'w-full px-3 py-2 border rounded-lg transition-fast focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-touch';
  const errorStyles = hasError 
    ? 'border-error focus:ring-error focus:border-error' 
    : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:focus:ring-primary-400';
  const iconPaddingStyles = icon ? (iconPosition === 'left' ? 'pl-10' : 'pr-10') : '';
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label 
          htmlFor={inputId.current}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-error ml-1" aria-label="required">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        
        <input
          id={inputId.current}
          type={type}
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`${baseInputStyles} ${errorStyles} ${iconPaddingStyles} ${inputClassName} dark:bg-gray-800 dark:text-gray-100`}
          aria-invalid={hasError}
          aria-describedby={
            displayError ? `${inputId.current}-error` : 
            helperText ? `${inputId.current}-helper` : 
            undefined
          }
          {...props}
        />
        
        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
      </div>
      
      {displayError && (
        <p 
          id={`${inputId.current}-error`}
          className="mt-1 text-sm text-error"
          role="alert"
        >
          {displayError}
        </p>
      )}
      
      {!displayError && helperText && (
        <p 
          id={`${inputId.current}-helper`}
          className="mt-1 text-sm text-gray-500 dark:text-gray-400"
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

Input.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  validate: PropTypes.func,
  debounceMs: PropTypes.number,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
};

export default Input;
