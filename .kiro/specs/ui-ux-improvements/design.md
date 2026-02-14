# Design Document: UI/UX Improvements

## Overview

This design document outlines the technical approach for implementing comprehensive UI/UX improvements across the ROTC Grading Management System. The improvements focus on enhancing usability, accessibility, visual consistency, and performance across all user account types (Admin, Cadet, Staff, Command Group) and devices (desktop, tablet, mobile).

The design follows a component-based architecture using React, leveraging existing patterns while introducing new reusable components and utilities. All improvements will be implemented incrementally to minimize disruption to existing functionality.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Admin Layout │  │ Cadet Layout │  │ Staff Layout │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐             │
│         │                                      │             │
│  ┌──────▼──────┐                    ┌─────────▼────────┐   │
│  │   Shared    │                    │   UI Component   │   │
│  │  Components │◄───────────────────┤     Library      │   │
│  └──────┬──────┘                    └─────────┬────────┘   │
│         │                                      │             │
└─────────┼──────────────────────────────────────┼─────────────┘
          │                                      │
┌─────────▼──────────────────────────────────────▼─────────────┐
│                     Business Logic Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Hooks &    │  │    State     │  │   Utilities  │      │
│  │   Context    │  │  Management  │  │   & Helpers  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────┐
│                      Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     API      │  │    Cache     │  │  Real-time   │      │
│  │   Services   │  │  (IndexedDB) │  │     SSE      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Progressive Enhancement**: Core functionality works without JavaScript; enhanced features layer on top
2. **Mobile-First**: Design for mobile screens first, then enhance for larger screens
3. **Accessibility-First**: WCAG 2.1 Level AA compliance built into every component
4. **Performance-Conscious**: Lazy loading, code splitting, and caching strategies
5. **Consistency**: Shared design system with reusable components and utilities
6. **Resilience**: Graceful degradation when services are unavailable

## Components and Interfaces

### 1. Design System Foundation

#### Color System

```typescript
interface ColorPalette {
  primary: {
    50: string;   // Lightest tint
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;  // Base color
    600: string;
    700: string;
    800: string;
    900: string;  // Darkest shade
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  neutral: {
    white: string;
    gray: string[];
    black: string;
  };
}

// Implementation
const colors: ColorPalette = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#354f32',  // Current primary
    600: '#2d4229',
    700: '#253621',
    800: '#1d2a19',
    900: '#151e11',
  },
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  neutral: {
    white: '#ffffff',
    gray: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827'],
    black: '#000000',
  },
};
```

#### Typography System

```typescript
interface TypographyScale {
  fontFamily: {
    sans: string;
    mono: string;
  };
  fontSize: {
    xs: string;    // 12px
    sm: string;    // 14px
    base: string;  // 16px
    lg: string;    // 18px
    xl: string;    // 20px
    '2xl': string; // 24px
    '3xl': string; // 30px
    '4xl': string; // 36px
  };
  fontWeight: {
    normal: number;   // 400
    medium: number;   // 500
    semibold: number; // 600
    bold: number;     // 700
  };
  lineHeight: {
    tight: number;   // 1.25
    normal: number;  // 1.5
    relaxed: number; // 1.75
  };
}
```

#### Spacing System (8px Grid)

```typescript
const spacing = {
  0: '0px',
  1: '8px',
  2: '16px',
  3: '24px',
  4: '32px',
  5: '40px',
  6: '48px',
  7: '56px',
  8: '64px',
};
```

### 2. Core UI Components

#### Button Component

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

// Usage
<Button 
  variant="primary" 
  size="md" 
  loading={isSubmitting}
  icon={<Save />}
  onClick={handleSave}
>
  Save Changes
</Button>
```

#### Input Component

```typescript
interface InputProps {
  type: 'text' | 'email' | 'password' | 'number' | 'tel';
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  maxLength?: number;
  pattern?: string;
  ariaDescribedBy?: string;
}

// Features:
// - Real-time validation
// - Error state with message
// - Helper text for guidance
// - Icon support
// - Accessibility labels
```

#### Card Component

```typescript
interface CardProps {
  variant: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

// Usage
<Card variant="elevated" padding="md" hoverable>
  <Card.Header>
    <h3>Cadet Performance</h3>
  </Card.Header>
  <Card.Body>
    {/* Content */}
  </Card.Body>
  <Card.Footer>
    <Button variant="ghost">View Details</Button>
  </Card.Footer>
</Card>
```

#### Modal Component

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// Features:
// - Focus trap
// - Scroll lock
// - Keyboard navigation (Escape to close)
// - Overlay click to close
// - Accessible (role="dialog", aria-labelledby)
```

#### Toast Notification Component

```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

// Usage
toast.success('Profile updated successfully', {
  duration: 3000,
  action: {
    label: 'Undo',
    onClick: handleUndo,
  },
});
```

#### Loading Skeleton Component

```typescript
interface SkeletonProps {
  variant: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  count?: number;
}

// Usage
<Skeleton variant="rectangular" width="100%" height={200} animation="wave" />
<Skeleton variant="text" count={3} />
```

#### Table Component

```typescript
interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  sortable?: boolean;
  filterable?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  emptyState?: React.ReactNode;
  mobileCardView?: boolean;
}

interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// Features:
// - Responsive (table on desktop, cards on mobile)
// - Sorting
// - Filtering
// - Pagination
// - Row selection
// - Loading state
// - Empty state
```

### 3. Layout Components

#### Responsive Sidebar

```typescript
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  variant: 'permanent' | 'temporary';
  width?: string;
  children: React.ReactNode;
}

// Behavior:
// - Desktop: Permanent sidebar (always visible)
// - Mobile: Temporary sidebar (overlay, dismissible)
// - Smooth transitions
// - Focus management
```

#### Header Component

```typescript
interface HeaderProps {
  title?: string;
  searchEnabled?: boolean;
  onSearch?: (query: string) => void;
  notifications?: NotificationProps[];
  messages?: MessageProps[];
  userMenu?: React.ReactNode;
}

// Features:
// - Responsive search bar
// - Notification dropdown
// - Message dropdown
// - User profile menu
// - Mobile hamburger menu
```

#### Breadcrumb Component

```typescript
interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  current?: boolean;
}

// Usage
<Breadcrumb 
  items={[
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Cadets', href: '/admin/cadets' },
    { label: 'John Doe', current: true },
  ]}
/>
```

### 4. Form Components

#### Form Validation Hook

```typescript
interface UseFormOptions<T> {
  initialValues: T;
  validationSchema: ValidationSchema<T>;
  onSubmit: (values: T) => Promise<void>;
}

interface ValidationSchema<T> {
  [K in keyof T]?: ValidationRule[];
}

interface ValidationRule {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  message: string;
  value?: any;
  validator?: (value: any) => boolean;
}

// Usage
const { values, errors, handleChange, handleSubmit, isSubmitting } = useForm({
  initialValues: { email: '', password: '' },
  validationSchema: {
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Invalid email format' },
    ],
    password: [
      { type: 'required', message: 'Password is required' },
      { type: 'minLength', value: 8, message: 'Password must be at least 8 characters' },
    ],
  },
  onSubmit: async (values) => {
    await api.login(values);
  },
});
```

#### Multi-Step Form Component

```typescript
interface MultiStepFormProps {
  steps: FormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

interface FormStep {
  title: string;
  description?: string;
  component: React.ComponentType;
  validation?: () => boolean;
}

// Features:
// - Progress indicator
// - Step validation
// - Navigation (next, previous, skip)
// - Keyboard navigation
// - Save progress
```

### 5. Data Visualization Components

#### Chart Wrapper Component

```typescript
interface ChartProps {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartData;
  options?: ChartOptions;
  responsive?: boolean;
  loading?: boolean;
  error?: string;
  emptyState?: React.ReactNode;
}

// Features:
// - Responsive sizing
// - Loading state
// - Error state
// - Empty state
// - Tooltip on hover
// - Legend
// - Accessibility (data table fallback)
```

#### Stats Card Component

```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  color?: string;
  loading?: boolean;
}

// Usage
<StatsCard
  title="Total Cadets"
  value={245}
  change={{ value: 12, trend: 'up' }}
  icon={<Users />}
  color="primary"
/>
```

### 6. Mobile-Specific Components

#### Bottom Navigation (Mobile)

```typescript
interface BottomNavProps {
  items: NavItem[];
  activeItem: string;
  onChange: (item: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  href: string;
}

// Behavior:
// - Fixed at bottom on mobile
// - Hidden on desktop
// - Smooth transitions
// - Badge support for notifications
```

#### Pull-to-Refresh Component

```typescript
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

// Features:
// - Touch gesture detection
// - Visual feedback during pull
// - Loading indicator
// - Haptic feedback
```

#### Swipeable Card Component

```typescript
interface SwipeableCardProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  children: React.ReactNode;
}

interface SwipeAction {
  icon: React.ReactNode;
  color: string;
  label: string;
}

// Usage: Swipe to delete, archive, etc.
```

## Data Models

### Theme Configuration

```typescript
interface ThemeConfig {
  mode: 'light' | 'dark';
  primaryColor: string;
  fontFamily: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  animations: boolean;
}

// Storage: localStorage
// Key: 'rgms_theme_config'
```

### User Preferences

```typescript
interface UserPreferences {
  theme: ThemeConfig;
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    fontSize: 'sm' | 'md' | 'lg';
  };
  layout: {
    sidebarCollapsed: boolean;
    compactMode: boolean;
  };
}

// Storage: IndexedDB + localStorage backup
// Synced with server for cross-device consistency
```

### UI State Management

```typescript
interface UIState {
  modals: {
    [key: string]: {
      isOpen: boolean;
      data?: any;
    };
  };
  toasts: Toast[];
  loading: {
    [key: string]: boolean;
  };
  errors: {
    [key: string]: string | null;
  };
}

// Managed by React Context + useReducer
```

### Cache Strategy

```typescript
interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresIn: number;
}

// Cache layers:
// 1. Memory cache (React state)
// 2. IndexedDB cache (persistent)
// 3. Server cache (Redis)

// Cache invalidation:
// - Time-based (TTL)
// - Event-based (SSE updates)
// - Manual (user refresh)
```

## Error Handling

### Error Boundary Component

```typescript
interface ErrorBoundaryProps {
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: React.ReactNode;
}

// Features:
// - Catch React errors
// - Display fallback UI
// - Log errors to server
// - Reset error state
// - Preserve user data
```

### Error Types and Handling

```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  recoverable: boolean;
  retryable: boolean;
}

// Error handling strategy:
// 1. Network errors: Show retry button
// 2. Validation errors: Highlight fields
// 3. Permission errors: Show upgrade prompt
// 4. Not found errors: Redirect to 404
// 5. Server errors: Show error page with support link
```

### Retry Logic

```typescript
interface RetryConfig {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  // Implementation with exponential backoff
  // Visual feedback during retries
  // Cancel option for user
}
```

## Testing Strategy

### Unit Testing

**Focus Areas:**
- Individual components (Button, Input, Card, etc.)
- Utility functions (validation, formatting, etc.)
- Hooks (useForm, useTheme, etc.)
- State management logic

**Tools:**
- Vitest for test runner
- React Testing Library for component testing
- Mock Service Worker (MSW) for API mocking

**Example Tests:**
- Button renders with correct variant styles
- Input validates email format correctly
- Form submission triggers validation
- Theme toggle updates localStorage

### Integration Testing

**Focus Areas:**
- User workflows (login, profile update, grade viewing)
- Component interactions (modal opens, form submits)
- API integration (data fetching, caching)
- Real-time updates (SSE events)

**Example Tests:**
- User can complete profile setup flow
- Admin can search and filter cadets
- Notifications update in real-time
- Dark mode persists across sessions

### Accessibility Testing

**Tools:**
- axe-core for automated accessibility testing
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)

**Test Cases:**
- All interactive elements are keyboard accessible
- Focus indicators are visible
- ARIA labels are present and correct
- Color contrast meets WCAG AA standards
- Screen reader announces dynamic content

### Visual Regression Testing

**Tools:**
- Playwright for screenshot comparison
- Percy or Chromatic for visual diff

**Test Cases:**
- Component renders correctly across breakpoints
- Dark mode styles are consistent
- Hover states are visible
- Loading states display correctly

### Performance Testing

**Metrics:**
- First Contentful Paint (FCP) < 1.5s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3.5s
- Cumulative Layout Shift (CLS) < 0.1

**Tools:**
- Lighthouse for performance audits
- WebPageTest for detailed analysis
- Chrome DevTools for profiling



## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Mobile Touch Target Minimum Size

*For any* interactive element rendered on a mobile viewport (width < 768px), the element's computed dimensions should be at least 44x44 pixels to ensure accessibility and usability.

**Validates: Requirements 1.1, 1.3**

### Property 2: Responsive Table Adaptation

*For any* data table rendered on a mobile viewport, the table should either provide horizontal scrolling or transform into a card-based layout, ensuring no content overflow occurs.

**Validates: Requirements 1.2**

### Property 3: Chart Responsive Scaling

*For any* chart or graph component, when the viewport width changes, the chart should scale proportionally to fit within the container bounds without horizontal overflow.

**Validates: Requirements 1.5**

### Property 4: State Preservation During Orientation Change

*For any* page with user-entered data or UI state, when the device orientation changes (portrait ↔ landscape), all form values, scroll positions, and component states should be preserved.

**Validates: Requirements 1.6**

### Property 5: Loading Indicator Timing

*For any* asynchronous operation (API call, data fetch, form submission), a loading indicator should appear within 100ms of operation initiation.

**Validates: Requirements 2.1**

### Property 6: Loading State Display During Data Fetch

*For any* component that fetches data from the server, a skeleton screen or loading spinner should be visible in the content area while the fetch is in progress.

**Validates: Requirements 2.2**

### Property 7: Form Submit Button Disabled State

*For any* form submission, the submit button should be disabled and display a loading state from the moment of submission until the operation completes (success or error).

**Validates: Requirements 2.3**

### Property 8: Long Operation Progress Display

*For any* operation that exceeds 3 seconds in duration, progress information or estimated time remaining should be displayed to the user.

**Validates: Requirements 2.4**

### Property 9: Success Message Duration

*For any* successful operation, a success message should be displayed for a duration between 3 and 5 seconds before automatically dismissing.

**Validates: Requirements 2.5**

### Property 10: Non-Blocking Background Updates

*For any* background update operation, the user interface should remain interactive and responsive, allowing user input without blocking.

**Validates: Requirements 2.6**

### Property 11: Network Error Retry Option

*For any* operation that fails due to network issues, an error message should be displayed with a retry button that allows the user to reattempt the operation.

**Validates: Requirements 3.1**

### Property 12: Form Validation Error Display

*For any* form with validation rules, when validation fails, each invalid field should be highlighted and display a specific error message adjacent to the field.

**Validates: Requirements 3.2**

### Property 13: Permission Error Explanation

*For any* operation that fails due to insufficient permissions, an error message should explain what permission is required and provide guidance on how to request it.

**Validates: Requirements 3.3**

### Property 14: Invalid Action Prevention and Explanation

*For any* user action that violates business rules or constraints, the system should prevent the action from executing and display an explanation of why it cannot be performed.

**Validates: Requirements 3.5**

### Property 15: Navigation Active State Highlighting

*For any* page in the navigation menu, when that page is currently active, the corresponding navigation item should be visually highlighted to indicate the current location.

**Validates: Requirements 4.1**

### Property 16: Nested Menu Expand/Collapse Controls

*For any* navigation menu with nested items, expand/collapse controls should be present with clear visual indicators (chevron icons) showing the current state.

**Validates: Requirements 4.2**

### Property 17: Admin Search Results Display

*For any* search query entered by an admin user, results should be displayed in a dropdown containing relevant information (name, ID, role) for each matching cadet or staff member.

**Validates: Requirements 4.3**

### Property 18: Profile Completion Feature Locking

*For any* user who has not completed their profile, attempting to access locked features should display a lock icon and redirect to the profile completion page.

**Validates: Requirements 4.4**

### Property 19: Scroll Position Restoration

*For any* page navigation where the user returns to a previously visited page, the scroll position should be restored to where it was before navigation.

**Validates: Requirements 4.5**

### Property 20: Color Palette Consistency

*For any* page or component across all user account types, the colors used should match the defined color palette, ensuring visual consistency.

**Validates: Requirements 5.1**

### Property 21: Typography Consistency

*For any* text element across the application, the font family, size, and weight should match the defined typography scale, ensuring consistent text rendering.

**Validates: Requirements 5.2**

### Property 22: Spacing Grid Consistency

*For any* spacing or padding value applied to components, the value should be a multiple of 8px, adhering to the 8px grid system.

**Validates: Requirements 5.3**

### Property 23: Button Style Consistency

*For any* button with a specific variant (primary, secondary, danger), the styling (colors, padding, border radius) should be consistent across all instances of that variant.

**Validates: Requirements 5.4**

### Property 24: Card Component Consistency

*For any* card or panel component used to group content, the styling (background, border, shadow, padding) should be consistent across all instances.

**Validates: Requirements 5.5**

### Property 25: Icon Size Consistency

*For any* icon used in the interface, the size should match one of the defined icon sizes (16px, 20px, 24px), ensuring consistent visual weight.

**Validates: Requirements 5.6**

### Property 26: Admin Search Quick Actions

*For any* search result displayed to an admin user, quick action buttons (view, edit, message) should be present and functional.

**Validates: Requirements 6.2**

### Property 27: Grading Keyboard Shortcuts

*For any* keyboard shortcut defined in the grading interface, triggering the shortcut should execute the corresponding action (save, next field, previous field).

**Validates: Requirements 6.3**

### Property 28: System Status Color Coding

*For any* system status indicator, the color should correctly represent the status: green for healthy, yellow for degraded, red for error.

**Validates: Requirements 6.5**

### Property 29: Cadet Grade Visual Indicators

*For any* grade displayed to a cadet, visual indicators (colors, icons) should be present to represent the performance level (excellent, good, needs improvement).

**Validates: Requirements 7.2**

### Property 30: Staff QR Scan Feedback

*For any* QR code scan performed by a staff member, immediate visual feedback (success animation, color change) and haptic feedback (vibration) should be provided.

**Validates: Requirements 8.2**

### Property 31: Staff Profile Completion Feature Lock

*For any* staff member who has not completed their profile, all features except profile completion and Ask Admin should be locked and display lock icons.

**Validates: Requirements 8.6**

### Property 32: Command Group Activity Drag-and-Drop

*For any* activity in the command group calendar interface, the activity should be draggable to a different date/time slot, and the change should be persisted.

**Validates: Requirements 9.4**

### Property 33: Notification Visual Feedback Non-Blocking

*For any* notification received by a user, visual feedback (badge count increment, highlight animation) should appear without blocking user interaction with other UI elements.

**Validates: Requirements 10.1**

### Property 34: Notification Grouping and Timestamps

*For any* notification dropdown opened by a user, notifications should be grouped by type and each notification should display a timestamp.

**Validates: Requirements 10.2**

### Property 35: Notification Dismissal and Badge Update

*For any* notification marked as read by a user, the notification should be removed from the list and the badge count should decrement immediately.

**Validates: Requirements 10.3**

### Property 36: Real-Time Notification Haptic Feedback

*For any* real-time notification received on a device that supports haptic feedback, a subtle vibration should occur when the notification arrives.

**Validates: Requirements 10.5**

### Property 37: Bulk Notification Clear Confirmation

*For any* bulk notification clear action, a confirmation should be displayed showing the number of notifications to be cleared, and upon confirmation, the UI should update immediately.

**Validates: Requirements 10.6**

### Property 38: Input Focus Visual Feedback

*For any* input field that receives focus, visual feedback (border highlight, focus ring) should appear immediately to indicate the active field.

**Validates: Requirements 11.1**

### Property 39: Real-Time Input Validation

*For any* input field with validation rules, when the user enters invalid data, an inline validation message should appear as they type (debounced).

**Validates: Requirements 11.2**

### Property 40: Form Error Navigation

*For any* form submission with validation errors, the page should scroll to the first error and focus the invalid field automatically.

**Validates: Requirements 11.3**

### Property 41: Multi-Step Form Progress Indication

*For any* multi-step form, a progress indicator should display the current step number and total number of steps.

**Validates: Requirements 11.4**

### Property 42: Unsaved Changes Warning

*For any* form with unsaved changes, when the user attempts to navigate away, a warning dialog should appear asking for confirmation.

**Validates: Requirements 11.6**

### Property 43: Keyboard Navigation Focus Indicators

*For any* interactive element navigated to via keyboard (Tab key), a visible focus indicator should be present to show the current focus position.

**Validates: Requirements 12.1**

### Property 44: ARIA Labels and Roles

*For any* custom component or interactive element, appropriate ARIA labels and roles should be present to support screen readers.

**Validates: Requirements 12.2**

### Property 45: Color Contrast Ratios

*For any* text element, the contrast ratio between text and background should be at least 4.5:1 for normal text and 3:1 for large text (18px+ or 14px+ bold).

**Validates: Requirements 12.3**

### Property 46: Image Alt Text

*For any* image, icon, or non-text content, a text alternative (alt attribute) should be present describing the content or function.

**Validates: Requirements 12.4**

### Property 47: Screen Reader Dynamic Content Announcements

*For any* dynamic content update (new notification, data refresh, error message), an ARIA live region should announce the change to screen readers.

**Validates: Requirements 12.5**

### Property 48: Keyboard Form Navigation

*For any* form, users should be able to navigate between fields using only the keyboard (Tab, Shift+Tab, Enter, Arrow keys) without requiring a mouse.

**Validates: Requirements 12.6**

### Property 49: Cached Page Load Performance

*For any* page navigation where cached data is available, the new page should be displayed within 200ms of navigation initiation.

**Validates: Requirements 13.1**

### Property 50: Virtual Scrolling for Long Lists

*For any* list containing more than 100 items, virtual scrolling should be implemented to render only visible items, maintaining smooth scroll performance.

**Validates: Requirements 13.2**

### Property 51: Immediate Interaction Feedback

*For any* interactive element (button, link, input), hover and active states should appear immediately (within 16ms) when the user interacts with the element.

**Validates: Requirements 13.3**

### Property 52: Image Loading Placeholders

*For any* image that is loading, a placeholder (solid color, blur-up effect, or skeleton) should be displayed until the image fully loads.

**Validates: Requirements 13.4**

### Property 53: Search Input Debouncing

*For any* search input, the search query should be debounced (300ms delay) and results should be displayed within 300ms of the last keystroke.

**Validates: Requirements 13.5**

### Property 54: Data Prefetching and Caching

*For any* frequently accessed data (user profile, dashboard metrics), the data should be prefetched and cached to reduce loading time on subsequent accesses.

**Validates: Requirements 13.6**

### Property 55: Dark Mode Application

*For any* page or component, when dark mode is enabled, dark color schemes should be applied consistently across all elements.

**Validates: Requirements 14.2**

### Property 56: Dark Mode Preference Persistence

*For any* dark mode toggle action, the preference should be saved to localStorage and persist across browser sessions.

**Validates: Requirements 14.3**

### Property 57: Dark Mode Chart Color Adaptation

*For any* chart or graph displayed in dark mode, colors should be adjusted to ensure optimal visibility against the dark background.

**Validates: Requirements 14.4**

### Property 58: Dark Mode Image Contrast

*For any* image or profile picture displayed in dark mode, appropriate contrast should be maintained to ensure visibility.

**Validates: Requirements 14.5**

### Property 59: System Dark Mode Preference Detection

*For any* first-time visitor, the system should detect the user's system-level dark mode preference (prefers-color-scheme) and apply it automatically.

**Validates: Requirements 14.6**

### Property 60: Multi-Field Search

*For any* search query, the system should search across multiple fields (name, ID, username) and return results matching any of these fields.

**Validates: Requirements 15.1**

### Property 61: Search Result Text Highlighting

*For any* search result displayed, the matching text should be highlighted to show which part of the result matched the query.

**Validates: Requirements 15.2**

### Property 62: Real-Time Filter Updates

*For any* filter applied to a data table, the results should update in real-time without requiring a page reload.

**Validates: Requirements 15.3**

### Property 63: Active Filter Display and Removal

*For any* combination of filters applied, each active filter should be displayed as a removable tag, allowing individual filter removal.

**Validates: Requirements 15.4**

### Property 64: Search Result Count Display

*For any* search performed, the number of results found should be displayed prominently near the search results.

**Validates: Requirements 15.6**

### Property 65: Profile Update Real-Time Validation

*For any* profile field being edited, validation should occur in real-time as the user types, and a success confirmation should appear after saving.

**Validates: Requirements 16.3**

### Property 66: Profile Completion Progress Indicator

*For any* incomplete profile, a progress indicator should display the percentage of completion and highlight which required fields are missing.

**Validates: Requirements 16.4**

### Property 67: Password Strength Visual Feedback

*For any* password input during password change, a visual strength indicator (weak, medium, strong) should update in real-time as the user types.

**Validates: Requirements 16.5**

### Property 68: Profile Change Sidebar Synchronization

*For any* profile change that affects displayed information (name, profile picture), the navigation sidebar should update immediately to reflect the changes.

**Validates: Requirements 16.6**

### Property 69: Chart Interactive Tooltips

*For any* chart element (bar, line point, pie slice), hovering over the element should display a tooltip with detailed data values.

**Validates: Requirements 17.1**

### Property 70: Chart Series Visual Distinction

*For any* comparison chart with multiple data series, each series should use distinct colors and patterns to ensure differentiation.

**Validates: Requirements 17.3**

### Property 71: Large Dataset Pagination

*For any* dataset containing more than 50 items, pagination or infinite scrolling should be implemented to maintain performance.

**Validates: Requirements 17.4**

### Property 72: Mobile Chart Simplification

*For any* chart displayed on a mobile viewport, the visualization should be simplified (fewer data points, larger touch targets) to improve readability.

**Validates: Requirements 17.6**

### Property 73: Onboarding Guide Completion Tracking

*For any* user who completes the onboarding guide, the system should mark the guide as seen and not display it on subsequent logins.

**Validates: Requirements 18.3**

### Property 74: Ask Admin Global Accessibility

*For any* page in the application, the "Ask Admin" feature should be accessible from the navigation menu or a persistent button.

**Validates: Requirements 18.4**

### Property 75: Contextual Tooltip Display

*For any* complex UI element with a tooltip, hovering over the element should display the tooltip with an explanation after a brief delay (500ms).

**Validates: Requirements 18.5**

### Property 76: Bulk Selection Toolbar Display

*For any* list where multiple items are selected, a bulk action toolbar should appear displaying available operations (delete, edit, export).

**Validates: Requirements 19.2**

### Property 77: Bulk Action Confirmation Dialog

*For any* bulk action initiated, a confirmation dialog should display the number of items affected and require user confirmation before proceeding.

**Validates: Requirements 19.3**

### Property 78: Bulk Action Results Summary

*For any* completed bulk action, a summary should display the number of successful operations and any failed operations with reasons.

**Validates: Requirements 19.4**

### Property 79: Select All Checkbox Functionality

*For any* table with selectable rows, a "select all" checkbox in the header should select or deselect all visible rows when clicked.

**Validates: Requirements 19.5**

### Property 80: Bulk Delete Additional Confirmation

*For any* bulk delete action, an additional confirmation step should be required beyond the standard bulk action confirmation to prevent accidental deletion.

**Validates: Requirements 19.6**

### Property 81: Real-Time UI Updates via SSE

*For any* data change triggered by another user or process, the UI should update automatically via Server-Sent Events without requiring a manual refresh.

**Validates: Requirements 20.1**

### Property 82: Updated Item Highlight Animation

*For any* list item that is updated in real-time, the item should be highlighted with a subtle animation to draw attention to the change.

**Validates: Requirements 20.2**

### Property 83: Background Cache Updates

*For any* page with cached data, when real-time updates occur, the cache should be updated in the background without user intervention.

**Validates: Requirements 20.3**

### Property 84: Real-Time Update Visual Feedback

*For any* real-time update received, visual feedback (notification badge, highlight) should appear to inform the user of the change.

**Validates: Requirements 20.4**

### Property 85: SSE Connection Resilience

*For any* Server-Sent Events connection loss, the system should attempt to reconnect automatically and display a notification to the user about the connection status.

**Validates: Requirements 20.5**

### Property 86: Update Broadcasting to Connected Clients

*For any* user action that modifies shared data (grade update, attendance mark), the update should be broadcast to all connected clients via SSE.

**Validates: Requirements 20.6**

