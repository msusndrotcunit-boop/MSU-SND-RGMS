# Mobile CSS Architecture Standards

## Overview

This document defines the mobile-specific CSS architecture standards for the MSU-SND ROTC Grading Management System. All mobile responsive components and features should follow these guidelines to ensure consistency, maintainability, and optimal performance.

## Table of Contents

1. [Breakpoint System](#breakpoint-system)
2. [Naming Conventions](#naming-conventions)
3. [Component Structure](#component-structure)
4. [Touch Target Standards](#touch-target-standards)
5. [Safe Area Handling](#safe-area-handling)
6. [Performance Guidelines](#performance-guidelines)
7. [Accessibility Requirements](#accessibility-requirements)
8. [Testing Standards](#testing-standards)

## Breakpoint System

### Standard Breakpoints

```javascript
const breakpoints = {
  xs: 0,      // Extra small devices (phones, portrait)
  sm: 640px,  // Small devices (phones, landscape)
  md: 768px,  // Medium devices (tablets, portrait)
  lg: 1024px, // Large devices (tablets, landscape / small desktops)
  xl: 1280px, // Extra large devices (desktops)
  '2xl': 1536px // 2X large devices (large desktops)
};
```

### Usage in Tailwind CSS

```jsx
// Mobile-first approach
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Content */}
</div>

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
  {/* Content */}
</div>

// Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Title
</h1>
```

### Custom Breakpoint Hooks

```javascript
import { useResponsive } from '../hooks/useResponsive';

const MyComponent = () => {
  const { isMobile, isTablet, isDesktop, breakpoint } = useResponsive();
  
  return (
    <div>
      {isMobile && <MobileView />}
      {isTablet && <TabletView />}
      {isDesktop && <DesktopView />}
    </div>
  );
};
```

## Naming Conventions

### Component Naming

- **Mobile-specific components**: Prefix with `Mobile`
  - `MobileNavigation.jsx`
  - `MobileCard.jsx`
  - `MobileModalManager.jsx`

- **Responsive components**: Prefix with `Responsive`
  - `ResponsiveTable.jsx`
  - `ResponsiveButton.jsx`
  - `ResponsiveContainer.jsx`

- **Utility components**: Descriptive names
  - `TouchTargetValidator.jsx`
  - `SafeAreaManager.jsx`
  - `MobilePerformanceOptimizer.jsx`

### CSS Class Naming

Follow BEM (Block Element Modifier) convention for custom classes:

```css
/* Block */
.mobile-card { }

/* Element */
.mobile-card__header { }
.mobile-card__body { }
.mobile-card__footer { }

/* Modifier */
.mobile-card--expanded { }
.mobile-card--collapsed { }
```

### Tailwind Utility Classes

Prefer Tailwind utilities over custom CSS:

```jsx
// Good
<button className="min-h-[44px] min-w-[44px] p-3 rounded-lg">

// Avoid (unless necessary)
<button className="custom-touch-button">
```

## Component Structure

### Standard Mobile Component Template

```jsx
import React from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { TouchTargetValidator } from './TouchTargetValidator';

/**
 * MobileComponent - Brief description
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.title - Component title
 * @param {ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
const MobileComponent = ({ title, children }) => {
  const { isMobile } = useResponsive();
  
  return (
    <div className="mobile-component">
      {/* Mobile-specific rendering */}
      {isMobile ? (
        <MobileView title={title}>
          {children}
        </MobileView>
      ) : (
        <DesktopView title={title}>
          {children}
        </DesktopView>
      )}
    </div>
  );
};

export default MobileComponent;
```

### Responsive Component Pattern

```jsx
const ResponsiveComponent = () => {
  const { breakpoint } = useResponsive();
  
  // Adapt behavior based on breakpoint
  const columns = {
    xs: 1,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4
  }[breakpoint] || 1;
  
  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {/* Content */}
    </div>
  );
};
```

## Touch Target Standards

### Minimum Touch Target Size

All interactive elements MUST meet WCAG 2.5.5 standards:

- **Minimum size**: 44px × 44px
- **Recommended size**: 48px × 48px
- **Minimum spacing**: 8px between adjacent targets

### Implementation

```jsx
// Using Tailwind classes
<button className="min-h-[44px] min-w-[44px] p-3">
  Click Me
</button>

// Using TouchTargetValidator
import { TouchTargetValidator } from '../components/TouchTargetValidator';

<TouchTargetValidator>
  <button>Click Me</button>
</TouchTargetValidator>
```

### Touch Target Validation

```javascript
import { TouchTargetValidator } from '../utils/accessibility';

// Validate single element
const result = TouchTargetValidator.validateTouchTarget(element);
console.log(result.valid); // true/false

// Scan entire page
const scanResults = TouchTargetValidator.scanPageTouchTargets();
console.log(`Compliance: ${scanResults.complianceRate}%`);
```

## Safe Area Handling

### CSS Environment Variables

```css
/* Use safe area insets for notched devices */
.mobile-header {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.mobile-footer {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      }
    }
  }
};
```

### SafeAreaManager Component

```jsx
import { SafeAreaManager } from '../components/SafeAreaManager';

<SafeAreaManager>
  <div className="mobile-content">
    {/* Content automatically respects safe areas */}
  </div>
</SafeAreaManager>
```

## Performance Guidelines

### Image Optimization

```jsx
// Use lazy loading for images
<img 
  src={imageUrl} 
  loading="lazy"
  alt="Description"
  className="w-full h-auto"
/>

// Use MobilePerformanceOptimizer
import { MobilePerformanceOptimizer } from '../components/MobilePerformanceOptimizer';

<MobilePerformanceOptimizer>
  <img src={imageUrl} alt="Description" />
</MobilePerformanceOptimizer>
```

### Code Splitting

```jsx
// Lazy load mobile-specific components
const MobileView = React.lazy(() => import('./MobileView'));

const MyComponent = () => {
  const { isMobile } = useResponsive();
  
  return (
    <React.Suspense fallback={<LoadingSkeleton />}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </React.Suspense>
  );
};
```

### Animation Performance

```css
/* Use transform and opacity for animations (GPU-accelerated) */
.mobile-card {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.mobile-card:hover {
  transform: translateY(-2px);
}

/* Avoid animating layout properties */
/* Bad */
.mobile-card:hover {
  height: 200px; /* Causes reflow */
}
```

## Accessibility Requirements

### ARIA Labels

```jsx
// Always provide accessible labels
<button 
  aria-label="Close menu"
  className="min-h-[44px] min-w-[44px]"
>
  <X size={20} />
</button>

// Use aria-labelledby for complex labels
<div id="dialog-title">Confirmation</div>
<div role="dialog" aria-labelledby="dialog-title">
  {/* Dialog content */}
</div>
```

### Keyboard Navigation

```jsx
// Ensure all interactive elements are keyboard accessible
<button 
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  tabIndex={0}
>
  Action
</button>
```

### Focus Management

```jsx
// Manage focus for modals and drawers
import { useEffect, useRef } from 'react';

const MobileModal = ({ isOpen }) => {
  const firstFocusableRef = useRef(null);
  
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);
  
  return (
    <div role="dialog" aria-modal="true">
      <button ref={firstFocusableRef}>First Action</button>
    </div>
  );
};
```

## Testing Standards

### Unit Testing

```javascript
// Test responsive behavior
import { render, screen } from '@testing-library/react';
import { useResponsive } from '../hooks/useResponsive';

jest.mock('../hooks/useResponsive');

test('renders mobile view on small screens', () => {
  useResponsive.mockReturnValue({ isMobile: true });
  
  render(<MyComponent />);
  expect(screen.getByTestId('mobile-view')).toBeInTheDocument();
});
```

### Touch Target Testing

```javascript
// Validate touch targets in tests
import { TouchTargetValidator } from '../utils/accessibility';

test('all buttons meet touch target requirements', () => {
  const { container } = render(<MyComponent />);
  const buttons = container.querySelectorAll('button');
  
  buttons.forEach(button => {
    const result = TouchTargetValidator.validateTouchTarget(button);
    expect(result.valid).toBe(true);
  });
});
```

### Cross-Browser Testing

```javascript
// Use CrossBrowserTestSuite
import { CrossBrowserTestSuite } from '../utils/crossBrowserTesting';

test('component works across browsers', () => {
  const results = CrossBrowserTestSuite.runAllTests();
  expect(results.successRate).toBeGreaterThan(90);
});
```

## Best Practices

### 1. Mobile-First Approach

Always design and code for mobile first, then enhance for larger screens:

```jsx
// Good: Mobile-first
<div className="p-4 md:p-6 lg:p-8">

// Avoid: Desktop-first
<div className="p-8 md:p-6 sm:p-4">
```

### 2. Progressive Enhancement

Build core functionality that works everywhere, then add enhancements:

```jsx
const MyComponent = () => {
  const hasTouch = 'ontouchstart' in window;
  
  return (
    <div>
      {/* Core functionality */}
      <BasicView />
      
      {/* Enhanced for touch devices */}
      {hasTouch && <TouchGestures />}
    </div>
  );
};
```

### 3. Performance Budget

- Initial load: < 3 seconds on 3G
- Time to Interactive: < 5 seconds
- First Contentful Paint: < 1.5 seconds
- Cumulative Layout Shift: < 0.1

### 4. Consistent Spacing

Use Tailwind's spacing scale consistently:

```jsx
// Consistent spacing
<div className="space-y-4">  {/* 16px */}
  <div className="p-4">      {/* 16px */}
    <div className="mb-4">   {/* 16px */}
```

### 5. Responsive Typography

```jsx
// Scale typography appropriately
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
<p className="text-sm md:text-base lg:text-lg">
```

## Component Library

### Available Mobile Components

1. **MobileNavigation** - Standardized mobile navigation
2. **MobileCard** - Mobile-optimized card layout
3. **MobileModalManager** - Viewport-aware modals
4. **MobileFormLayout** - Touch-friendly forms
5. **ResponsiveTable** - Table-to-card conversion
6. **TouchTargetValidator** - Touch target validation
7. **SafeAreaManager** - Safe area handling
8. **MobilePerformanceOptimizer** - Performance optimization

### Usage Examples

See individual component documentation in `/src/components/` directory.

## Maintenance

### Regular Audits

Run these audits regularly:

```javascript
// Accessibility audit
import { MobileAccessibilityValidator } from '../utils/accessibility';
const audit = MobileAccessibilityValidator.auditMobileAccessibility();
console.log(`Overall Score: ${audit.overallScore}%`);

// Performance audit
import { MobilePerformanceOptimizer } from '../components/MobilePerformanceOptimizer';
const metrics = MobilePerformanceOptimizer.measurePerformanceMetrics();
console.log('Performance Metrics:', metrics);

// Cross-browser compatibility
import { CrossBrowserTestSuite } from '../utils/crossBrowserTesting';
const results = CrossBrowserTestSuite.runAllTests();
console.log(`Success Rate: ${results.successRate}%`);
```

### Version Control

Document all changes to mobile architecture in this file with:
- Date of change
- Description of change
- Reason for change
- Migration guide (if applicable)

## Support

For questions or issues related to mobile architecture:
1. Check this documentation first
2. Review component examples in `/src/components/`
3. Run automated tests and audits
4. Consult the design document at `.kiro/specs/mobile-responsiveness-optimization/design.md`

---

**Last Updated**: February 15, 2026
**Version**: 1.0.0
**Maintained By**: Development Team
