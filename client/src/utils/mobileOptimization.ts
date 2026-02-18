/**
 * Mobile Optimization Utilities
 * 
 * Helper functions for detecting and validating mobile layout issues
 */

/**
 * Detects elements with horizontal overflow
 * @returns Array of elements that are overflowing horizontally
 */
export const detectHorizontalOverflow = (): Array<{
  element: Element;
  scrollWidth: number;
  clientWidth: number;
  overflow: number;
  selector: string;
}> => {
  const elements = document.querySelectorAll('*');
  const overflowing: Array<{
    element: Element;
    scrollWidth: number;
    clientWidth: number;
    overflow: number;
    selector: string;
  }> = [];

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.scrollWidth > htmlEl.clientWidth) {
      const selector = htmlEl.tagName.toLowerCase() + 
        (htmlEl.id ? `#${htmlEl.id}` : '') +
        (htmlEl.className ? `.${htmlEl.className.toString().split(' ').join('.')}` : '');
      
      overflowing.push({
        element: el,
        scrollWidth: htmlEl.scrollWidth,
        clientWidth: htmlEl.clientWidth,
        overflow: htmlEl.scrollWidth - htmlEl.clientWidth,
        selector
      });
    }
  });

  if (overflowing.length > 0) {
    console.warn('Horizontal overflow detected:', overflowing);
  }

  return overflowing;
};

/**
 * Validates that interactive elements meet minimum touch target size (44x44px)
 * @returns Array of elements that don't meet the minimum size
 */
export const validateTouchTargets = (): Array<{
  element: Element;
  width: number;
  height: number;
  selector: string;
}> => {
  const MIN_SIZE = 44;
  const interactive = document.querySelectorAll(
    'button, a, [role="button"], input[type="checkbox"], input[type="radio"]'
  );
  const invalid: Array<{
    element: Element;
    width: number;
    height: number;
    selector: string;
  }> = [];

  interactive.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      const htmlEl = el as HTMLElement;
      const selector = htmlEl.tagName.toLowerCase() + 
        (htmlEl.id ? `#${htmlEl.id}` : '') +
        (htmlEl.className ? `.${htmlEl.className.toString().split(' ').join('.')}` : '');
      
      invalid.push({
        element: el,
        width: rect.width,
        height: rect.height,
        selector
      });
    }
  });

  if (invalid.length > 0) {
    console.warn('Invalid touch targets found:', invalid);
  }

  return invalid;
};

/**
 * Validates that elements have responsive classes applied
 * @param element - The element to validate
 * @returns true if element has responsive classes or is a leaf element
 */
export const validateResponsiveClasses = (element: HTMLElement): boolean => {
  const classes = element.className.toString().split(' ');
  const responsiveClasses = classes.filter((c) =>
    c.startsWith('sm:') || 
    c.startsWith('md:') || 
    c.startsWith('lg:') || 
    c.startsWith('xl:')
  );

  if (responsiveClasses.length === 0 && element.children.length > 0) {
    console.warn('Element may not be responsive:', element);
    return false;
  }

  return true;
};

/**
 * Gets the current viewport width
 * @returns Current viewport width in pixels
 */
export const getViewportWidth = (): number => {
  return window.innerWidth || document.documentElement.clientWidth;
};

/**
 * Checks if current viewport is mobile size
 * @returns true if viewport is mobile size (< 768px)
 */
export const isMobileViewport = (): boolean => {
  return getViewportWidth() < 768;
};

/**
 * Checks if current viewport is tablet size
 * @returns true if viewport is tablet size (768px - 1023px)
 */
export const isTabletViewport = (): boolean => {
  const width = getViewportWidth();
  return width >= 768 && width < 1024;
};

/**
 * Checks if current viewport is desktop size
 * @returns true if viewport is desktop size (>= 1024px)
 */
export const isDesktopViewport = (): boolean => {
  return getViewportWidth() >= 1024;
};

/**
 * Runs all mobile optimization validations
 * @returns Object containing all validation results
 */
export const runMobileValidations = () => {
  const results = {
    viewport: {
      width: getViewportWidth(),
      isMobile: isMobileViewport(),
      isTablet: isTabletViewport(),
      isDesktop: isDesktopViewport()
    },
    overflow: detectHorizontalOverflow(),
    touchTargets: validateTouchTargets()
  };

  console.log('Mobile Validation Results:', results);
  return results;
};
