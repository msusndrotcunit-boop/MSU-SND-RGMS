import React, { useEffect, useRef, useState } from 'react';
import { TOUCH_TARGETS } from '../utils/responsive';

/**
 * TouchTargetValidator - Validates and auto-corrects touch target sizes
 * Ensures all interactive elements meet accessibility requirements (44px minimum)
 */
const TouchTargetValidator = ({ 
  children, 
  autoCorrect = true, 
  showWarnings = import.meta.env && import.meta.env.DEV,
  className = '',
  ...props 
}) => {
  const containerRef = useRef(null);
  const [validationResults, setValidationResults] = useState([]);

  /**
   * Validate touch target size for an element
   * @param {HTMLElement} element - Element to validate
   * @returns {object} Validation result
   */
  const validateTouchTarget = (element) => {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    // Get actual dimensions including padding
    const width = rect.width;
    const height = rect.height;
    
    // Check if element is interactive
    const isInteractive = (
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.tagName === 'INPUT' ||
      element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA' ||
      element.getAttribute('role') === 'button' ||
      element.getAttribute('role') === 'link' ||
      element.onclick ||
      element.onmousedown ||
      element.ontouchstart ||
      computedStyle.cursor === 'pointer'
    );

    if (!isInteractive) {
      return { isValid: true, element, reason: 'Not interactive' };
    }

    const meetsMinimum = width >= TOUCH_TARGETS.minimum.width && height >= TOUCH_TARGETS.minimum.height;
    const meetsRecommended = width >= TOUCH_TARGETS.recommended.width && height >= TOUCH_TARGETS.recommended.height;

    return {
      isValid: meetsMinimum,
      meetsRecommended,
      element,
      width,
      height,
      reason: meetsMinimum ? 
        (meetsRecommended ? 'Meets recommended size' : 'Meets minimum size') :
        `Too small: ${Math.round(width)}x${Math.round(height)}px (minimum: ${TOUCH_TARGETS.minimum.width}x${TOUCH_TARGETS.minimum.height}px)`
    };
  };

  /**
   * Auto-correct undersized touch targets
   * @param {HTMLElement} element - Element to correct
   * @param {object} validation - Validation result
   */
  const autoCorrectTouchTarget = (element, validation) => {
    if (validation.isValid || !autoCorrect) return;

    const currentStyle = window.getComputedStyle(element);
    
    // Calculate required padding to meet minimum size
    const widthDiff = Math.max(0, TOUCH_TARGETS.minimum.width - validation.width);
    const heightDiff = Math.max(0, TOUCH_TARGETS.minimum.height - validation.height);
    
    // Apply corrections via CSS custom properties
    const paddingX = Math.ceil(widthDiff / 2);
    const paddingY = Math.ceil(heightDiff / 2);
    
    // Only add padding if element doesn't already have sufficient padding
    const currentPaddingX = parseInt(currentStyle.paddingLeft) + parseInt(currentStyle.paddingRight);
    const currentPaddingY = parseInt(currentStyle.paddingTop) + parseInt(currentStyle.paddingBottom);
    
    if (currentPaddingX < paddingX) {
      element.style.paddingLeft = `max(${currentStyle.paddingLeft}, ${paddingX}px)`;
      element.style.paddingRight = `max(${currentStyle.paddingRight}, ${paddingX}px)`;
    }
    
    if (currentPaddingY < paddingY) {
      element.style.paddingTop = `max(${currentStyle.paddingTop}, ${paddingY}px)`;
      element.style.paddingBottom = `max(${currentStyle.paddingBottom}, ${paddingY}px)`;
    }

    // Ensure minimum dimensions
    element.style.minWidth = `${TOUCH_TARGETS.minimum.width}px`;
    element.style.minHeight = `${TOUCH_TARGETS.minimum.height}px`;
    
    // Add touch target class for styling
    element.classList.add('touch-target-corrected');
  };

  /**
   * Validate spacing between adjacent touch targets
   * @param {HTMLElement[]} elements - Interactive elements to check
   * @returns {object[]} Spacing validation results
   */
  const validateTouchTargetSpacing = (elements) => {
    const spacingIssues = [];
    
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const elem1 = elements[i];
        const elem2 = elements[j];
        
        const rect1 = elem1.getBoundingClientRect();
        const rect2 = elem2.getBoundingClientRect();
        
        // Calculate distance between elements
        const horizontalDistance = Math.max(0, 
          Math.max(rect1.left, rect2.left) - Math.min(rect1.right, rect2.right)
        );
        const verticalDistance = Math.max(0,
          Math.max(rect1.top, rect2.top) - Math.min(rect1.bottom, rect2.bottom)
        );
        
        // Check if elements are adjacent (overlapping or very close)
        const isAdjacent = horizontalDistance <= TOUCH_TARGETS.spacing || verticalDistance <= TOUCH_TARGETS.spacing;
        
        if (isAdjacent && (horizontalDistance < TOUCH_TARGETS.spacing && verticalDistance < TOUCH_TARGETS.spacing)) {
          spacingIssues.push({
            element1: elem1,
            element2: elem2,
            horizontalDistance,
            verticalDistance,
            reason: `Insufficient spacing: ${Math.round(Math.min(horizontalDistance, verticalDistance))}px (minimum: ${TOUCH_TARGETS.spacing}px)`
          });
        }
      }
    }
    
    return spacingIssues;
  };

  /**
   * Run validation on all interactive elements
   */
  const runValidation = () => {
    if (!containerRef.current) return;

    const interactiveElements = containerRef.current.querySelectorAll(
      'button, a, input, select, textarea, [role="button"], [role="link"], [onclick], [style*="cursor: pointer"]'
    );

    const results = Array.from(interactiveElements).map(element => {
      const validation = validateTouchTarget(element);
      
      if (autoCorrect) {
        autoCorrectTouchTarget(element, validation);
      }
      
      return validation;
    });

    // Validate spacing between elements
    const spacingIssues = validateTouchTargetSpacing(Array.from(interactiveElements));
    
    setValidationResults([...results, ...spacingIssues.map(issue => ({
      isValid: false,
      element: issue.element1,
      reason: issue.reason,
      type: 'spacing'
    }))]);

    // Log warnings in development
    if (showWarnings) {
      const issues = results.filter(r => !r.isValid);
      if (issues.length > 0) {
        console.warn('Touch target validation issues:', issues);
      }
      if (spacingIssues.length > 0) {
        console.warn('Touch target spacing issues:', spacingIssues);
      }
    }
  };

  // Run validation on mount and when children change
  useEffect(() => {
    const timer = setTimeout(runValidation, 100); // Small delay to ensure DOM is ready
    return () => clearTimeout(timer);
  }, [children, autoCorrect]);

  // Re-run validation on window resize
  useEffect(() => {
    const handleResize = () => {
      setTimeout(runValidation, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`touch-target-validator ${className}`}
      {...props}
    >
      {children}
      
      {/* Development overlay showing validation results */}
      {showWarnings && (import.meta.env && import.meta.env.DEV) && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          {validationResults.filter(r => !r.isValid).map((result, index) => (
            <div 
              key={index}
              className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 mb-2 text-xs rounded shadow"
            >
              <strong>Touch Target Issue:</strong> {result.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Hook for manual touch target validation
 * @param {React.RefObject} elementRef - Ref to element to validate
 * @returns {object} Validation utilities
 */
export const useTouchTargetValidation = (elementRef) => {
  const [isValid, setIsValid] = useState(true);
  const [validationResult, setValidationResult] = useState(null);

  const validate = () => {
    if (!elementRef.current) return;

    const validator = new TouchTargetValidator({});
    const result = validator.validateTouchTarget(elementRef.current);
    
    setIsValid(result.isValid);
    setValidationResult(result);
    
    return result;
  };

  useEffect(() => {
    validate();
  }, [elementRef.current]);

  return {
    isValid,
    validationResult,
    validate,
    autoCorrect: (element = elementRef.current) => {
      if (!element || !validationResult) return;
      const validator = new TouchTargetValidator({});
      validator.autoCorrectTouchTarget(element, validationResult);
    }
  };
};

export default TouchTargetValidator;
