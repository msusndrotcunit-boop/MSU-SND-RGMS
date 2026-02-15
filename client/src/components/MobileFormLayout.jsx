import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useMobile } from '../hooks/useResponsive';
import TouchTargetValidator from './TouchTargetValidator';

/**
 * MobileFormLayout - Mobile-optimized form component with proper spacing and keyboard handling
 */
const MobileFormLayout = ({
  children,
  onSubmit,
  className = '',
  sections = [],
  collapsible = false,
  ...props
}) => {
  const { isMobile, keyboardVisible } = useMobile();
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  const toggleSection = (sectionId) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  return (
    <TouchTargetValidator autoCorrect={true}>
      <form
        onSubmit={onSubmit}
        className={clsx(
          "space-y-4 md:space-y-6",
          isMobile && keyboardVisible && "pb-8",
          className
        )}
        {...props}
      >
        {sections.length > 0 ? (
          sections.map((section, index) => (
            <FormSection
              key={section.id || index}
              title={section.title}
              description={section.description}
              collapsible={collapsible}
              isCollapsed={collapsedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              className={section.className}
            >
              {section.content}
            </FormSection>
          ))
        ) : (
          children
        )}
      </form>
    </TouchTargetValidator>
  );
};

/**
 * FormSection - Collapsible form section for better mobile organization
 */
const FormSection = ({
  title,
  description,
  children,
  collapsible = false,
  isCollapsed = false,
  onToggle,
  className = ''
}) => {
  const { isMobile } = useMobile();

  return (
    <div className={clsx("border border-gray-200 dark:border-gray-700 rounded-lg", className)}>
      {title && (
        <div
          className={clsx(
            "px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800",
            collapsible && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          )}
          onClick={collapsible ? onToggle : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {description}
                </p>
              )}
            </div>
            {collapsible && (
              <button
                type="button"
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 touch-target"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className={clsx(
        "p-4 space-y-4",
        isCollapsed && "hidden"
      )}>
        {children}
      </div>
    </div>
  );
};

/**
 * FormField - Mobile-optimized form field with proper labeling and validation
 */
const FormField = ({
  label,
  required = false,
  error,
  hint,
  children,
  className = '',
  labelClassName = '',
  layout = 'vertical' // 'vertical', 'horizontal'
}) => {
  const { isMobile } = useMobile();
  const fieldId = useRef(`field-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <div className={clsx(
      layout === 'horizontal' && !isMobile ? "sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start" : "space-y-2",
      className
    )}>
      {label && (
        <label
          htmlFor={fieldId.current}
          className={clsx(
            "block text-sm font-medium text-gray-700 dark:text-gray-300",
            layout === 'horizontal' && !isMobile && "sm:pt-2",
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className={layout === 'horizontal' && !isMobile ? "sm:col-span-2" : ""}>
        <div className="relative">
          {React.cloneElement(children, { id: fieldId.current })}
          {error && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <AlertCircle size={16} className="text-red-500" />
            </div>
          )}
        </div>
        
        {hint && !error && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
        
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * MobileInput - Mobile-optimized input component
 */
const MobileInput = React.forwardRef(({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  className = '',
  showPasswordToggle = false,
  ...props
}, ref) => {
  const { isMobile } = useMobile();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className="relative">
      <input
        ref={ref}
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={clsx(
          "w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg",
          "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
          "placeholder-gray-500 dark:placeholder-gray-400",
          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "transition-all duration-200",
          isMobile && "text-base", // Prevent zoom on iOS
          isFocused && "ring-2 ring-blue-500 border-blue-500",
          disabled && "bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60",
          showPasswordToggle && "pr-12",
          className
        )}
        style={{
          minHeight: '44px', // Touch target compliance
          fontSize: isMobile ? '16px' : '14px' // Prevent iOS zoom
        }}
        {...props}
      />
      
      {type === 'password' && showPasswordToggle && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 touch-target"
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
});

/**
 * MobileSelect - Mobile-optimized select component
 */
const MobileSelect = React.forwardRef(({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const { isMobile } = useMobile();

  return (
    <select
      ref={ref}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={clsx(
        "w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg",
        "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
        "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        "transition-all duration-200 appearance-none cursor-pointer",
        isMobile && "text-base", // Prevent zoom on iOS
        disabled && "bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60",
        className
      )}
      style={{
        minHeight: '44px', // Touch target compliance
        fontSize: isMobile ? '16px' : '14px', // Prevent iOS zoom
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1.5em 1.5em',
        paddingRight: '2.5rem'
      }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option, index) => (
        <option key={index} value={option.value || option}>
          {option.label || option}
        </option>
      ))}
    </select>
  );
});

/**
 * MobileTextarea - Mobile-optimized textarea component
 */
const MobileTextarea = React.forwardRef(({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  className = '',
  autoResize = false,
  ...props
}, ref) => {
  const { isMobile } = useMobile();
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value, autoResize]);

  return (
    <textarea
      ref={ref || textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={clsx(
        "w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg",
        "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
        "placeholder-gray-500 dark:placeholder-gray-400",
        "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        "transition-all duration-200 resize-none",
        isMobile && "text-base", // Prevent zoom on iOS
        disabled && "bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60",
        className
      )}
      style={{
        minHeight: '88px', // Minimum for touch targets
        fontSize: isMobile ? '16px' : '14px' // Prevent iOS zoom
      }}
      {...props}
    />
  );
});

/**
 * FormActions - Mobile-optimized form action buttons
 */
const FormActions = ({
  children,
  alignment = 'right', // 'left', 'center', 'right', 'stretch'
  className = ''
}) => {
  const { isMobile } = useMobile();

  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    stretch: 'justify-stretch'
  };

  return (
    <div className={clsx(
      "flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700",
      isMobile ? "flex-col" : `flex-row ${alignmentClasses[alignment]}`,
      className
    )}>
      {children}
    </div>
  );
};

// Set display names for better debugging
MobileInput.displayName = 'MobileInput';
MobileSelect.displayName = 'MobileSelect';
MobileTextarea.displayName = 'MobileTextarea';

export {
  MobileFormLayout,
  FormSection,
  FormField,
  MobileInput,
  MobileSelect,
  MobileTextarea,
  FormActions
};

export default MobileFormLayout;