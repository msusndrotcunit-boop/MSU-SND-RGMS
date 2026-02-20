# Design Document: Mobile Layout Optimization

## Overview

This design document outlines the technical approach for optimizing mobile layouts across all user roles (Admin, Staff, Cadet) in the ROTC Management System. The system currently uses React with Tailwind CSS and has some mobile-first CSS rules, but experiences overlapping elements at 100% zoom on mobile devices. This optimization will systematically address layout issues across 30+ pages while maintaining consistency and usability.

### Current State Analysis

The application currently has:
- React-based frontend with Tailwind CSS
- Some mobile-first CSS rules in `index.css`
- Custom breakpoint at 768px for mobile
- Tailwind default breakpoints (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)
- Three user roles with distinct page sets:
  - Admin: 17 pages (Dashboard, Analytics, Grading, Attendance, etc.)
  - Staff: 7 pages (Dashboard, Communication, Profile, etc.)
  - Cadet: 6 pages (Dashboard, Profile, Achievements, etc.)
- Shared pages: Login, Settings, Landing Page

### Target Devices

- iPhone SE / 12 mini: 375px width
- iPhone 12/13/14: 390px width
- iPhone Plus models: 414px width
- All at 100% zoom level

## Architecture

### Component Hierarchy

```
Mobile Layout System
├── Global Styles Layer (index.css)
│   ├── Base mobile styles (@media max-width: 768px)
│   ├── Typography scaling (clamp functions)
│   ├── Touch target sizing (44px minimum)
│   └── Container constraints
├── Tailwind Utility Layer
│   ├── Responsive grid classes (grid-cols-1 md:grid-cols-2)
│   ├── Spacing utilities (p-4 md:p-6)
│   ├── Text sizing (text-sm md:text-base)
│   └── Display utilities (hidden md:block)
├── Component-Level Styles
│   ├── Dashboard components (status cards, charts, tables)
│   ├── Form components (inputs, buttons, labels)
│   ├── Navigation components (header, sidebar, mobile menu)
│   └── Data display components (tables, lists, cards)
└── Page-Specific Overrides
    ├── Admin pages
    ├── Staff pages
    └── Cadet pages
```

### Responsive Strategy

The design will use a mobile-first approach with progressive enhancement:

1. **Base styles** (< 640px): Single column, full-width elements, stacked layouts
2. **Small tablets** (640px - 767px): Two-column grids where appropriate
3. **Tablets and up** (≥ 768px): Multi-column layouts, side-by-side elements

### Breakpoint Strategy

```css
/* Mobile-first base styles (no media query needed) */
/* Applies to all screen sizes, then overridden at larger breakpoints */

/* Small devices (sm) - 640px and up */
@media (min-width: 640px) { }

/* Medium devices (md) - 768px and up */
@media (min-width: 768px) { }

/* Large devices (lg) - 1024px and up */
@media (min-width: 1024px) { }
```

## Components and Interfaces

### 1. Global Mobile Stylesheet Enhancement

**File**: `client/src/index.css`

**Enhancements needed**:

```css
/* Enhanced mobile base styles */
@media (max-width: 767px) {
  /* Viewport and overflow control */
  html, body {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
    position: relative;
  }
  
  /* Universal box-sizing */
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  /* Container padding optimization */
  .container,
  .space-y-8,
  .space-y-6,
  [class*="max-w-"] {
    padding-left: 1rem;  /* 16px */
    padding-right: 1rem;
    max-width: 100%;
  }
  
  /* Grid to single column */
  .grid {
    grid-template-columns: 1fr !important;
    gap: 1rem;
  }
  
  /* Flex column stacking */
  .flex:not(.flex-col):not(.flex-row) {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  /* Text sizing */
  h1 { font-size: 1.5rem; }  /* 24px */
  h2 { font-size: 1.25rem; } /* 20px */
  h3 { font-size: 1.125rem; } /* 18px */
  p, li { font-size: 0.875rem; } /* 14px */
  small, .text-xs { font-size: 0.75rem; } /* 12px */
  
  /* Button optimization */
  button, .btn, [role="button"] {
    min-height: 44px;
    min-width: 44px;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }
  
  /* Table responsiveness */
  table {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  thead {
    position: sticky;
    top: 0;
    background: white;
    z-index: 10;
  }
  
  th, td {
    min-width: 80px;
    padding: 0.75rem 0.5rem;
    font-size: 0.8125rem;
  }
  
  /* Chart containers */
  .recharts-wrapper,
  .recharts-surface {
    max-width: 100% !important;
    height: auto !important;
  }
  
  /* Prevent icon overflow */
  svg {
    max-width: 100%;
    height: auto;
    flex-shrink: 0;
  }
  
  /* Modal optimization */
  [role="dialog"],
  .modal {
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 2rem);
    margin: 1rem;
  }
}
```

### 2. Dashboard Component Optimization

**Pattern for all dashboard pages** (Admin, Staff, Cadet):

```jsx
// Mobile-optimized dashboard structure
<div className="space-y-4 md:space-y-8 p-4 md:p-6">
  {/* Header - stack on mobile */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
    <div className="flex flex-wrap gap-2">
      {/* Action buttons */}
    </div>
  </div>
  
  {/* Stats cards - 1 column on mobile, 2-3 on tablet, 5 on desktop */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
    {/* Status cards */}
  </div>
  
  {/* Charts - full width on mobile */}
  <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
    <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4">Chart Title</h3>
    <div className="w-full overflow-x-auto">
      <ResponsiveContainer width="100%" height={250} minWidth={300}>
        {/* Chart component */}
      </ResponsiveContainer>
    </div>
  </div>
  
  {/* Data tables - horizontal scroll on mobile */}
  <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
    <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4">Table Title</h3>
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full">
          {/* Table content */}
        </table>
      </div>
    </div>
  </div>
</div>
```

### 3. Table Component Pattern

**Mobile-optimized table wrapper**:

```jsx
// Reusable table wrapper component
const MobileTable = ({ children, className = "" }) => (
  <div className="overflow-x-auto -mx-4 md:mx-0">
    <div className="inline-block min-w-full align-middle px-4 md:px-0">
      <div className="overflow-hidden border border-gray-200 md:rounded-lg">
        <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
          {children}
        </table>
      </div>
    </div>
  </div>
);

// Usage with sticky headers
<MobileTable>
  <thead className="bg-gray-50 sticky top-0 z-10">
    <tr>
      <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">
        Column 1
      </th>
      {/* More columns */}
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    {/* Rows */}
  </tbody>
</MobileTable>
```

### 4. Form Component Optimization

**Mobile-first form layout**:

```jsx
// Form container
<form className="space-y-4 md:space-y-6">
  {/* Form field pattern */}
  <div className="space-y-1.5">
    <label className="block text-sm font-medium text-gray-700">
      Field Label
    </label>
    <input
      type="text"
      className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      style={{ fontSize: '16px' }} // Prevent iOS zoom
    />
    <p className="text-xs text-gray-500">Helper text</p>
  </div>
  
  {/* Button group - stack on mobile */}
  <div className="flex flex-col sm:flex-row gap-3 pt-4">
    <button
      type="submit"
      className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-md font-medium"
    >
      Submit
    </button>
    <button
      type="button"
      className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-md font-medium"
    >
      Cancel
    </button>
  </div>
</form>
```

### 5. Navigation Component Optimization

**Mobile header pattern**:

```jsx
// Mobile-optimized header
<header className="sticky top-0 z-50 bg-white border-b border-gray-200">
  <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6">
    {/* Logo - scale down on mobile */}
    <div className="flex items-center gap-2">
      <img 
        src="/logo.png" 
        alt="Logo" 
        className="h-8 md:h-10 w-auto"
      />
      <span className="text-sm md:text-base font-semibold truncate max-w-[120px] md:max-w-none">
        ROTC System
      </span>
    </div>
    
    {/* Actions - hide text on mobile */}
    <div className="flex items-center gap-2">
      <button className="p-2 md:px-4 md:py-2 rounded-md hover:bg-gray-100">
        <span className="sr-only md:not-sr-only">Profile</span>
        <User className="h-5 w-5 md:mr-2" />
      </button>
    </div>
  </div>
</header>
```

### 6. Card Component Optimization

**Responsive card pattern**:

```jsx
// Status card for dashboards
const StatusCard = ({ title, count, icon, color }) => (
  <div className="bg-white rounded-lg shadow-md p-3 md:p-4 border-t-4" style={{ borderColor: color }}>
    <div className="flex flex-col items-center text-center">
      <div className="mb-2" style={{ color }}>
        {icon}
      </div>
      <div className="text-xs md:text-sm text-gray-500 mb-1 line-clamp-2">
        {title}
      </div>
      <div className="text-xl md:text-2xl font-bold" style={{ color }}>
        {count || 0}
      </div>
    </div>
  </div>
);
```

## Data Models

### Responsive Breakpoint Configuration

```typescript
// Breakpoint constants
export const BREAKPOINTS = {
  mobile: {
    min: 0,
    max: 639,
    name: 'mobile'
  },
  sm: {
    min: 640,
    max: 767,
    name: 'small-tablet'
  },
  md: {
    min: 768,
    max: 1023,
    name: 'tablet'
  },
  lg: {
    min: 1024,
    max: 1279,
    name: 'desktop'
  },
  xl: {
    min: 1280,
    max: Infinity,
    name: 'large-desktop'
  }
} as const;

// Hook for responsive behavior
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState('mobile');
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setBreakpoint('mobile');
      else if (width < 768) setBreakpoint('sm');
      else if (width < 1024) setBreakpoint('md');
      else if (width < 1280) setBreakpoint('lg');
      else setBreakpoint('xl');
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return breakpoint;
};
```

### Mobile Layout Utility Classes

```typescript
// Tailwind class generator for mobile optimization
export const mobileClasses = {
  container: 'px-4 md:px-6 lg:px-8',
  spacing: {
    section: 'space-y-4 md:space-y-6 lg:space-y-8',
    card: 'space-y-3 md:space-y-4',
    form: 'space-y-4 md:space-y-6'
  },
  grid: {
    auto: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4',
    stats: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4',
    twoCol: 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6'
  },
  text: {
    heading: 'text-2xl md:text-3xl font-bold',
    subheading: 'text-lg md:text-xl font-semibold',
    body: 'text-sm md:text-base',
    small: 'text-xs md:text-sm'
  },
  button: 'min-h-[44px] px-4 py-2.5 text-sm md:text-base',
  card: 'bg-white rounded-lg shadow-md p-4 md:p-6'
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Viewport Containment

*For any* page and any mobile viewport width (375px, 390px, 414px), all rendered elements should fit within the viewport width without causing horizontal overflow.

**Validates: Requirements 1.1, 1.2, 1.3, 1.5**

### Property 2: Touch Target Minimum Size

*For any* interactive element (button, link, icon button), the rendered element should have a minimum touch target size of 44x44 pixels on mobile devices.

**Validates: Requirements 3.1, 3.4**

### Property 3: Text Readability Threshold

*For any* text element on mobile devices, the computed font size should be at least 14px for body text and scale proportionally for headings.

**Validates: Requirements 2.1, 2.2**

### Property 4: Grid Column Collapse

*For any* grid layout on mobile devices (width < 640px), the grid should render as a single column or maximum two columns.

**Validates: Requirements 4.2, 5.1**

### Property 5: Table Horizontal Scroll

*For any* table element on mobile devices, the table container should enable horizontal scrolling while the page body remains fixed.

**Validates: Requirements 6.1, 6.2**

### Property 6: Element Spacing Consistency

*For any* two adjacent elements on mobile devices, the spacing between them should be at least 8px to prevent visual overlap.

**Validates: Requirements 9.1, 4.5**

### Property 7: Container Padding Bounds

*For any* container element on mobile devices, the horizontal padding should be between 12px and 16px to maximize content area while maintaining readability.

**Validates: Requirements 4.1, 4.3**

### Property 8: Form Input Width

*For any* form input field on mobile devices, the input should span the full available width of its container minus padding.

**Validates: Requirements 8.1, 8.4**

### Property 9: Button Spacing

*For any* two adjacent buttons on mobile devices, the spacing between them should be at least 8px to prevent accidental taps.

**Validates: Requirements 3.3, 9.1**

### Property 10: Modal Viewport Fit

*For any* modal or dialog on mobile devices, the modal dimensions should not exceed calc(100vw - 2rem) width and calc(100vh - 2rem) height.

**Validates: Requirements 9.3**

### Property 11: Icon Size Constraint

*For any* icon element on mobile devices, the icon size should not exceed 24px unless it's a standalone decorative element.

**Validates: Requirements 3.2, 3.5**

### Property 12: Chart Responsiveness

*For any* chart component on mobile devices, the chart should have a minimum width of 300px and enable horizontal scrolling if content exceeds viewport.

**Validates: Requirements 5.4**

### Property 13: Header Height Limit

*For any* page header on mobile devices, the header height should not exceed 64px to maximize content viewing area.

**Validates: Requirements 7.5**

### Property 14: Text Wrapping

*For any* text element on mobile devices, long strings should wrap to the next line rather than causing horizontal overflow.

**Validates: Requirements 2.3**

### Property 15: Z-Index Layer Management

*For any* overlapping elements on mobile devices, the z-index values should follow the defined stacking order (dropdown: 1000, modal: 1050, tooltip: 1070) to prevent unintended overlap.

**Validates: Requirements 9.2**

## Error Handling

### Viewport Overflow Detection

```typescript
// Utility to detect and log horizontal overflow
export const detectHorizontalOverflow = () => {
  const elements = document.querySelectorAll('*');
  const overflowing = [];
  
  elements.forEach(el => {
    if (el.scrollWidth > el.clientWidth) {
      overflowing.push({
        element: el,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflow: el.scrollWidth - el.clientWidth
      });
    }
  });
  
  if (overflowing.length > 0) {
    console.warn('Horizontal overflow detected:', overflowing);
  }
  
  return overflowing;
};
```

### Touch Target Validation

```typescript
// Utility to validate touch target sizes
export const validateTouchTargets = () => {
  const MIN_SIZE = 44;
  const interactive = document.querySelectorAll('button, a, [role="button"], input[type="checkbox"], input[type="radio"]');
  const invalid = [];
  
  interactive.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      invalid.push({
        element: el,
        width: rect.width,
        height: rect.height,
        selector: el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '')
      });
    }
  });
  
  if (invalid.length > 0) {
    console.warn('Invalid touch targets found:', invalid);
  }
  
  return invalid;
};
```

### Responsive Breakpoint Mismatch

```typescript
// Detect when elements don't respond to breakpoint changes
export const validateResponsiveClasses = (element: HTMLElement) => {
  const classes = element.className.split(' ');
  const responsiveClasses = classes.filter(c => 
    c.startsWith('sm:') || c.startsWith('md:') || c.startsWith('lg:') || c.startsWith('xl:')
  );
  
  if (responsiveClasses.length === 0 && element.children.length > 0) {
    console.warn('Element may not be responsive:', element);
    return false;
  }
  
  return true;
};
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and component rendering
- **Property tests**: Verify universal properties across all viewport sizes and components

### Unit Testing

Unit tests will focus on:

1. **Component Rendering**: Verify that components render correctly at different breakpoints
2. **CSS Class Application**: Ensure responsive classes are applied correctly
3. **Edge Cases**: Test boundary conditions (exactly 375px, 640px, 768px widths)
4. **Integration**: Test that shared components work across all user roles

Example unit tests:

```typescript
describe('StatusCard Mobile Rendering', () => {
  it('should render with mobile-optimized padding at 375px', () => {
    // Test specific mobile rendering
  });
  
  it('should stack icon and text vertically on mobile', () => {
    // Test layout direction
  });
  
  it('should meet minimum touch target size', () => {
    // Test 44px minimum
  });
});

describe('Dashboard Grid Layout', () => {
  it('should render single column at 375px width', () => {
    // Test grid collapse
  });
  
  it('should render 2 columns at 640px width', () => {
    // Test small tablet layout
  });
  
  it('should render 5 columns at 1024px width', () => {
    // Test desktop layout
  });
});
```

### Property-Based Testing

Property tests will use **fast-check** (JavaScript/TypeScript property-based testing library) with minimum 100 iterations per test.

Each property test must reference its design document property using the tag format:
**Feature: mobile-layout-optimization, Property {number}: {property_text}**

Example property tests:

```typescript
import fc from 'fast-check';

describe('Property Tests: Mobile Layout Optimization', () => {
  /**
   * Feature: mobile-layout-optimization, Property 1: Viewport Containment
   * For any page and any mobile viewport width (375px, 390px, 414px),
   * all rendered elements should fit within the viewport width without
   * causing horizontal overflow.
   */
  it('should contain all elements within viewport at mobile widths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(375, 390, 414), // Mobile widths
        fc.constantFrom('admin', 'staff', 'cadet'), // User roles
        fc.constantFrom('dashboard', 'profile', 'attendance'), // Page types
        (width, role, page) => {
          // Set viewport width
          window.innerWidth = width;
          
          // Render page component
          const { container } = render(<PageComponent role={role} page={page} />);
          
          // Check for horizontal overflow
          const overflowing = detectHorizontalOverflow();
          
          expect(overflowing.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: mobile-layout-optimization, Property 2: Touch Target Minimum Size
   * For any interactive element (button, link, icon button), the rendered
   * element should have a minimum touch target size of 44x44 pixels on
   * mobile devices.
   */
  it('should ensure all interactive elements meet minimum touch target size', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(375, 390, 414),
        fc.constantFrom('button', 'a', '[role="button"]'),
        (width, selector) => {
          window.innerWidth = width;
          
          const { container } = render(<DashboardComponent />);
          const elements = container.querySelectorAll(selector);
          
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.height).toBeGreaterThanOrEqual(44);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: mobile-layout-optimization, Property 3: Text Readability Threshold
   * For any text element on mobile devices, the computed font size should be
   * at least 14px for body text and scale proportionally for headings.
   */
  it('should maintain minimum font sizes for readability', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(375, 390, 414),
        fc.constantFrom('p', 'li', 'span', 'div'),
        (width, selector) => {
          window.innerWidth = width;
          
          const { container } = render(<ContentComponent />);
          const textElements = container.querySelectorAll(selector);
          
          textElements.forEach(el => {
            const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
            expect(fontSize).toBeGreaterThanOrEqual(14);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: mobile-layout-optimization, Property 7: Container Padding Bounds
   * For any container element on mobile devices, the horizontal padding
   * should be between 12px and 16px to maximize content area while
   * maintaining readability.
   */
  it('should apply appropriate container padding on mobile', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(375, 390, 414),
        fc.constantFrom('.container', '.space-y-8', '[class*="max-w-"]'),
        (width, selector) => {
          window.innerWidth = width;
          
          const { container } = render(<PageLayout />);
          const containers = container.querySelectorAll(selector);
          
          containers.forEach(el => {
            const style = window.getComputedStyle(el);
            const paddingLeft = parseFloat(style.paddingLeft);
            const paddingRight = parseFloat(style.paddingRight);
            
            expect(paddingLeft).toBeGreaterThanOrEqual(12);
            expect(paddingLeft).toBeLessThanOrEqual(16);
            expect(paddingRight).toBeGreaterThanOrEqual(12);
            expect(paddingRight).toBeLessThanOrEqual(16);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Visual Regression Testing

Use **Playwright** or **Cypress** with visual snapshot testing:

```typescript
describe('Visual Regression: Mobile Layouts', () => {
  const viewports = [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 390, height: 844, name: 'iPhone 12' },
    { width: 414, height: 896, name: 'iPhone Plus' }
  ];
  
  viewports.forEach(viewport => {
    it(`should match snapshot at ${viewport.name}`, () => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/admin/dashboard');
      cy.matchImageSnapshot(`admin-dashboard-${viewport.name}`);
    });
  });
});
```

### Manual Testing Checklist

For each page across all roles:

1. ✓ No horizontal scrolling at 100% zoom
2. ✓ All text is readable without zooming
3. ✓ No overlapping elements
4. ✓ All buttons are tappable (44px minimum)
5. ✓ Tables scroll horizontally within container
6. ✓ Forms are usable and inputs are full-width
7. ✓ Navigation is accessible
8. ✓ Modals fit within viewport
9. ✓ Charts are responsive
10. ✓ Consistent spacing throughout

### Performance Testing

Monitor performance metrics on mobile devices:

```typescript
// Performance monitoring
export const measureMobilePerformance = () => {
  const metrics = {
    fcp: 0, // First Contentful Paint
    lcp: 0, // Largest Contentful Paint
    cls: 0, // Cumulative Layout Shift
    fid: 0  // First Input Delay
  };
  
  // Measure FCP and LCP
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        metrics.fcp = entry.startTime;
      }
      if (entry.entryType === 'largest-contentful-paint') {
        metrics.lcp = entry.startTime;
      }
    }
  }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
  
  // Measure CLS
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        metrics.cls += entry.value;
      }
    }
  }).observe({ entryTypes: ['layout-shift'] });
  
  return metrics;
};
```

### Test Coverage Requirements

- **Unit test coverage**: Minimum 80% for mobile-specific code
- **Property test iterations**: Minimum 100 per property
- **Visual regression**: All pages at 3 viewport sizes
- **Manual testing**: All pages across all 3 user roles
- **Performance**: FCP < 2s, LCP < 2.5s, CLS < 0.1 on 3G connection
