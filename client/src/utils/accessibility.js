/**
 * Accessibility utilities for mobile responsiveness testing
 * Provides tools for validating mobile accessibility compliance
 */

/**
 * Touch target accessibility validator
 */
export const TouchTargetValidator = {
  /**
   * Validate touch target size meets accessibility standards
   * @param {HTMLElement} element - Element to validate
   * @returns {Object} Validation result
   */
  validateTouchTarget: (element) => {
    if (!element) return { valid: false, error: 'Element not found' };

    const rect = element.getBoundingClientRect();
    const minSize = 44; // WCAG AA standard
    const recommendedSize = 48; // WCAG AAA standard

    const result = {
      valid: rect.width >= minSize && rect.height >= minSize,
      width: rect.width,
      height: rect.height,
      meetsWCAG_AA: rect.width >= minSize && rect.height >= minSize,
      meetsWCAG_AAA: rect.width >= recommendedSize && rect.height >= recommendedSize,
      recommendations: []
    };

    if (rect.width < minSize) {
      result.recommendations.push(`Width ${rect.width}px is below minimum ${minSize}px`);
    }
    if (rect.height < minSize) {
      result.recommendations.push(`Height ${rect.height}px is below minimum ${minSize}px`);
    }
    if (rect.width < recommendedSize || rect.height < recommendedSize) {
      result.recommendations.push(`Consider increasing to ${recommendedSize}px for better accessibility`);
    }

    return result;
  },

  /**
   * Validate spacing between touch targets
   * @param {HTMLElement} element1 - First element
   * @param {HTMLElement} element2 - Second element
   * @returns {Object} Spacing validation result
   */
  validateTouchTargetSpacing: (element1, element2) => {
    if (!element1 || !element2) return { valid: false, error: 'Elements not found' };

    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    const minSpacing = 8; // Minimum spacing in pixels

    // Calculate distance between elements
    const distance = Math.sqrt(
      Math.pow(rect2.left - rect1.right, 2) + 
      Math.pow(rect2.top - rect1.bottom, 2)
    );

    return {
      valid: distance >= minSpacing,
      distance,
      minSpacing,
      recommendation: distance < minSpacing ? 
        `Increase spacing to at least ${minSpacing}px` : 
        'Spacing meets accessibility standards'
    };
  },

  /**
   * Scan page for touch target compliance
   * @param {HTMLElement} container - Container to scan (defaults to document.body)
   * @returns {Object} Comprehensive scan results
   */
  scanPageTouchTargets: (container = document.body) => {
    const interactiveElements = container.querySelectorAll(
      'button, [role="button"], a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const results = {
      totalElements: interactiveElements.length,
      compliantElements: 0,
      nonCompliantElements: [],
      recommendations: []
    };

    interactiveElements.forEach((element, index) => {
      const validation = TouchTargetValidator.validateTouchTarget(element);
      
      if (validation.valid) {
        results.compliantElements++;
      } else {
        results.nonCompliantElements.push({
          element,
          index,
          validation,
          selector: TouchTargetValidator.getElementSelector(element)
        });
      }
    });

    results.complianceRate = (results.compliantElements / results.totalElements) * 100;
    
    if (results.complianceRate < 100) {
      results.recommendations.push(
        `${results.nonCompliantElements.length} elements need touch target improvements`
      );
    }

    return results;
  },

  /**
   * Get CSS selector for an element
   * @param {HTMLElement} element - Element to get selector for
   * @returns {string} CSS selector
   */
  getElementSelector: (element) => {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }
};

/**
 * Color contrast accessibility validator
 */
export const ColorContrastValidator = {
  /**
   * Calculate relative luminance of a color
   * @param {string} color - Color in hex, rgb, or rgba format
   * @returns {number} Relative luminance (0-1)
   */
  getLuminance: (color) => {
    const rgb = ColorContrastValidator.parseColor(color);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },

  /**
   * Parse color string to RGB values
   * @param {string} color - Color string
   * @returns {Array|null} RGB values or null if invalid
   */
  parseColor: (color) => {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return hex.split('').map(c => parseInt(c + c, 16));
      }
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    // Handle rgb/rgba colors
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      ];
    }

    return null;
  },

  /**
   * Calculate contrast ratio between two colors
   * @param {string} color1 - First color
   * @param {string} color2 - Second color
   * @returns {number} Contrast ratio
   */
  getContrastRatio: (color1, color2) => {
    const lum1 = ColorContrastValidator.getLuminance(color1);
    const lum2 = ColorContrastValidator.getLuminance(color2);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  },

  /**
   * Validate color contrast meets WCAG standards
   * @param {string} foreground - Foreground color
   * @param {string} background - Background color
   * @param {string} level - WCAG level ('AA' or 'AAA')
   * @param {string} size - Text size ('normal' or 'large')
   * @returns {Object} Validation result
   */
  validateContrast: (foreground, background, level = 'AA', size = 'normal') => {
    const ratio = ColorContrastValidator.getContrastRatio(foreground, background);
    
    const requirements = {
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 }
    };
    
    const required = requirements[level][size];
    
    return {
      ratio: Math.round(ratio * 100) / 100,
      required,
      passes: ratio >= required,
      level,
      size,
      recommendation: ratio < required ? 
        `Increase contrast to at least ${required}:1` : 
        'Contrast meets accessibility standards'
    };
  },

  /**
   * Scan page for color contrast issues
   * @param {HTMLElement} container - Container to scan
   * @returns {Object} Scan results
   */
  scanPageContrast: (container = document.body) => {
    const textElements = container.querySelectorAll('*');
    const results = {
      totalElements: 0,
      compliantElements: 0,
      issues: []
    };

    textElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;
      
      // Skip elements without visible text or transparent backgrounds
      if (!color || backgroundColor === 'rgba(0, 0, 0, 0)' || !element.textContent.trim()) {
        return;
      }

      results.totalElements++;
      
      const fontSize = parseFloat(computedStyle.fontSize);
      const fontWeight = computedStyle.fontWeight;
      const isLarge = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
      
      const validation = ColorContrastValidator.validateContrast(
        color, 
        backgroundColor, 
        'AA', 
        isLarge ? 'large' : 'normal'
      );
      
      if (validation.passes) {
        results.compliantElements++;
      } else {
        results.issues.push({
          element,
          validation,
          selector: TouchTargetValidator.getElementSelector(element),
          text: element.textContent.trim().substring(0, 50)
        });
      }
    });

    results.complianceRate = results.totalElements > 0 ? 
      (results.compliantElements / results.totalElements) * 100 : 100;

    return results;
  }
};

/**
 * Mobile accessibility validator
 */
export const MobileAccessibilityValidator = {
  /**
   * Comprehensive mobile accessibility audit
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Audit results
   */
  auditMobileAccessibility: (container = document.body) => {
    const results = {
      touchTargets: TouchTargetValidator.scanPageTouchTargets(container),
      colorContrast: ColorContrastValidator.scanPageContrast(container),
      focusManagement: MobileAccessibilityValidator.auditFocusManagement(container),
      screenReader: MobileAccessibilityValidator.auditScreenReaderSupport(container),
      keyboardNavigation: MobileAccessibilityValidator.auditKeyboardNavigation(container),
      overallScore: 0,
      recommendations: []
    };

    // Calculate overall score
    const scores = [
      results.touchTargets.complianceRate,
      results.colorContrast.complianceRate,
      results.focusManagement.score,
      results.screenReader.score,
      results.keyboardNavigation.score
    ];

    results.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Generate recommendations
    if (results.touchTargets.complianceRate < 100) {
      results.recommendations.push('Improve touch target sizes for better mobile accessibility');
    }
    if (results.colorContrast.complianceRate < 100) {
      results.recommendations.push('Improve color contrast for better readability');
    }
    if (results.focusManagement.score < 90) {
      results.recommendations.push('Improve focus management for keyboard and screen reader users');
    }

    return results;
  },

  /**
   * Audit focus management
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Focus audit results
   */
  auditFocusManagement: (container) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const results = {
      totalElements: focusableElements.length,
      elementsWithVisibleFocus: 0,
      elementsWithAriaLabels: 0,
      issues: [],
      score: 0
    };

    focusableElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const hasVisibleFocus = computedStyle.outline !== 'none' || 
                             computedStyle.boxShadow.includes('inset') ||
                             element.classList.contains('focus:');
      
      if (hasVisibleFocus) results.elementsWithVisibleFocus++;

      const hasAriaLabel = element.hasAttribute('aria-label') || 
                          element.hasAttribute('aria-labelledby') ||
                          element.hasAttribute('title') ||
                          element.textContent.trim();
      
      if (hasAriaLabel) results.elementsWithAriaLabels++;

      if (!hasVisibleFocus) {
        results.issues.push({
          element,
          issue: 'No visible focus indicator',
          selector: TouchTargetValidator.getElementSelector(element)
        });
      }

      if (!hasAriaLabel) {
        results.issues.push({
          element,
          issue: 'Missing accessible label',
          selector: TouchTargetValidator.getElementSelector(element)
        });
      }
    });

    results.score = results.totalElements > 0 ? 
      ((results.elementsWithVisibleFocus + results.elementsWithAriaLabels) / (results.totalElements * 2)) * 100 : 100;

    return results;
  },

  /**
   * Audit screen reader support
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Screen reader audit results
   */
  auditScreenReaderSupport: (container) => {
    const results = {
      headingStructure: MobileAccessibilityValidator.auditHeadingStructure(container),
      landmarks: MobileAccessibilityValidator.auditLandmarks(container),
      altText: MobileAccessibilityValidator.auditAltText(container),
      ariaLabels: MobileAccessibilityValidator.auditAriaLabels(container),
      score: 0
    };

    // Calculate overall screen reader score
    const scores = [
      results.headingStructure.score,
      results.landmarks.score,
      results.altText.score,
      results.ariaLabels.score
    ];

    results.score = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    return results;
  },

  /**
   * Audit heading structure
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Heading audit results
   */
  auditHeadingStructure: (container) => {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const results = {
      totalHeadings: headings.length,
      hasH1: container.querySelector('h1') !== null,
      properSequence: true,
      issues: [],
      score: 0
    };

    let previousLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (level > previousLevel + 1) {
        results.properSequence = false;
        results.issues.push({
          element: heading,
          issue: `Heading level ${level} follows level ${previousLevel}, skipping levels`,
          selector: TouchTargetValidator.getElementSelector(heading)
        });
      }
      
      previousLevel = level;
    });

    if (!results.hasH1) {
      results.issues.push({
        issue: 'Page missing main H1 heading'
      });
    }

    results.score = results.hasH1 && results.properSequence ? 100 : 
                   results.hasH1 || results.properSequence ? 50 : 0;

    return results;
  },

  /**
   * Audit landmarks
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Landmarks audit results
   */
  auditLandmarks: (container) => {
    const landmarks = container.querySelectorAll(
      'main, nav, header, footer, aside, section[aria-label], [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]'
    );

    const results = {
      totalLandmarks: landmarks.length,
      hasMain: container.querySelector('main, [role="main"]') !== null,
      hasNav: container.querySelector('nav, [role="navigation"]') !== null,
      score: 0
    };

    results.score = results.hasMain && results.hasNav ? 100 : 
                   results.hasMain || results.hasNav ? 75 : 
                   results.totalLandmarks > 0 ? 50 : 0;

    return results;
  },

  /**
   * Audit alt text for images
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Alt text audit results
   */
  auditAltText: (container) => {
    const images = container.querySelectorAll('img');
    const results = {
      totalImages: images.length,
      imagesWithAlt: 0,
      issues: [],
      score: 0
    };

    images.forEach(img => {
      if (img.hasAttribute('alt')) {
        results.imagesWithAlt++;
      } else {
        results.issues.push({
          element: img,
          issue: 'Image missing alt attribute',
          selector: TouchTargetValidator.getElementSelector(img)
        });
      }
    });

    results.score = results.totalImages > 0 ? 
      (results.imagesWithAlt / results.totalImages) * 100 : 100;

    return results;
  },

  /**
   * Audit ARIA labels
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} ARIA labels audit results
   */
  auditAriaLabels: (container) => {
    const interactiveElements = container.querySelectorAll(
      'button, [role="button"], input, select, textarea'
    );

    const results = {
      totalElements: interactiveElements.length,
      elementsWithLabels: 0,
      issues: [],
      score: 0
    };

    interactiveElements.forEach(element => {
      const hasLabel = element.hasAttribute('aria-label') ||
                      element.hasAttribute('aria-labelledby') ||
                      element.hasAttribute('title') ||
                      (element.tagName === 'INPUT' && element.labels && element.labels.length > 0) ||
                      element.textContent.trim();

      if (hasLabel) {
        results.elementsWithLabels++;
      } else {
        results.issues.push({
          element,
          issue: 'Interactive element missing accessible label',
          selector: TouchTargetValidator.getElementSelector(element)
        });
      }
    });

    results.score = results.totalElements > 0 ? 
      (results.elementsWithLabels / results.totalElements) * 100 : 100;

    return results;
  },

  /**
   * Audit keyboard navigation
   * @param {HTMLElement} container - Container to audit
   * @returns {Object} Keyboard navigation audit results
   */
  auditKeyboardNavigation: (container) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const results = {
      totalElements: focusableElements.length,
      elementsInTabOrder: 0,
      hasSkipLinks: container.querySelector('a[href^="#"], .skip-link') !== null,
      issues: [],
      score: 0
    };

    focusableElements.forEach(element => {
      const tabIndex = element.getAttribute('tabindex');
      const inTabOrder = tabIndex === null || parseInt(tabIndex) >= 0;

      if (inTabOrder) {
        results.elementsInTabOrder++;
      } else {
        results.issues.push({
          element,
          issue: 'Element removed from tab order but may need to be accessible',
          selector: TouchTargetValidator.getElementSelector(element)
        });
      }
    });

    const tabOrderScore = results.totalElements > 0 ? 
      (results.elementsInTabOrder / results.totalElements) * 100 : 100;
    
    const skipLinkScore = results.hasSkipLinks ? 100 : 0;

    results.score = (tabOrderScore + skipLinkScore) / 2;

    return results;
  }
};

export default {
  TouchTargetValidator,
  ColorContrastValidator,
  MobileAccessibilityValidator
};