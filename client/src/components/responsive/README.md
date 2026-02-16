# Mobile-First Responsive Architecture

## Overview
This architecture refactors the UI to be mobile-first, optimized for 500 concurrent cadet users on low-end Android devices.

## Core Principles
1. **Mobile-First**: Design for mobile, enhance for desktop
2. **Performance**: Optimized for low-end devices (reduced animations, simplified shadows)
3. **Touch-Friendly**: Minimum 44px touch targets
4. **Clarity**: Clean, functional design over fancy effects

## Components

### MobileDrawer
Collapsible sidebar for mobile navigation.
```jsx
import { MobileDrawer } from '@/components/responsive';

<MobileDrawer isOpen={isOpen} onClose={handleClose}>
  <nav>...</nav>
</MobileDrawer>
```

### MobileHeader
Sticky header with hamburger menu for mobile.
```jsx
import { MobileHeader } from '@/components/responsive';

<MobileHeader 
  onMenuClick={handleMenuClick}
  title="Dashboard"
  actions={[
    { icon: <Bell />, onClick: handleNotifications, label: 'Notifications' }
  ]}
/>
```

### ResponsiveTable
Automatically converts to card layout on mobile.
```jsx
import { ResponsiveTable } from '@/components/responsive';

<ResponsiveTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> }
  ]}
  data={cadets}
  onRowClick={handleRowClick}
  keyExtractor={(row) => row.id}
/>
```

### MobileCard
Optimized card component with touch-friendly actions.
```jsx
import { MobileCard } from '@/components/responsive';

<MobileCard
  title="Cadet Profile"
  actions={[
    { icon: <Edit />, onClick: handleEdit, label: 'Edit' }
  ]}
  onClick={handleCardClick}
>
  <p>Card content...</p>
</MobileCard>
```

### ResponsiveButton
Touch-friendly button with proper sizing.
```jsx
import { ResponsiveButton } from '@/components/responsive';

<ResponsiveButton
  variant="primary"
  size="md"
  fullWidth
  icon={<Save />}
  onClick={handleSave}
  loading={isSaving}
>
  Save Changes
</ResponsiveButton>
```

### ResponsiveContainer
Proper padding and max-width for content.
```jsx
import { ResponsiveContainer } from '@/components/responsive';

<ResponsiveContainer>
  <h1>Page Content</h1>
</ResponsiveContainer>
```

### LoadingSkeleton
Lightweight loading state (no animations for performance).
```jsx
import { LoadingSkeleton } from '@/components/responsive';

{loading ? <LoadingSkeleton type="card" count={3} /> : <Content />}
```

## Hooks

### useMobileDrawer
Manages mobile drawer state with auto-close on resize.
```jsx
import useMobileDrawer from '@/hooks/useMobileDrawer';

const { isOpen, open, close, toggle } = useMobileDrawer();
```

## Performance Utilities

### Debounce & Throttle
```jsx
import { debounce, throttle } from '@/utils/performance';

const handleSearch = debounce((query) => {
  // Search logic
}, 300);

const handleScroll = throttle(() => {
  // Scroll logic
}, 100);
```

### Device Detection
```jsx
import { isLowEndDevice, optimizeForDevice } from '@/utils/performance';

const config = optimizeForDevice();
// Returns: { imageQuality, enableAnimations, lazyLoadThreshold, pageSize }
```

## CSS Utilities

### Touch Targets
```jsx
<button className="touch-target">Button</button>
// Ensures minimum 44px height and width
```

### Mobile Card Layout
```jsx
<div className="mobile-card">
  // Visible only on mobile, styled as card
</div>

<table className="desktop-table">
  // Hidden on mobile, visible on desktop
</table>
```

### Responsive Text
```jsx
<h1 className="text-responsive-lg">Heading</h1>
<p className="text-responsive-base">Body text</p>
```

### Responsive Spacing
```jsx
<div className="spacing-responsive">
  // space-y-3 on mobile, space-y-4 on desktop
</div>

<div className="padding-responsive">
  // p-4 on mobile, p-6 on desktop
</div>
```

## Migration Guide

### Converting Existing Tables
**Before:**
```jsx
<table>
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

**After:**
```jsx
<ResponsiveTable
  columns={columns}
  data={data}
  onRowClick={handleClick}
/>
```

### Converting Sidebar Navigation
**Before:**
```jsx
<aside className="sidebar">
  <nav>...</nav>
</aside>
```

**After:**
```jsx
// Desktop sidebar (hidden on mobile)
<aside className="hidden md:block sidebar">
  <nav>...</nav>
</aside>

// Mobile drawer
<MobileDrawer isOpen={isOpen} onClose={close}>
  <nav>...</nav>
</MobileDrawer>

// Mobile header with hamburger
<MobileHeader onMenuClick={open} title="Dashboard" />
```

### Converting Buttons
**Before:**
```jsx
<button className="bg-green-600 text-white px-4 py-2">
  Save
</button>
```

**After:**
```jsx
<ResponsiveButton variant="primary" onClick={handleSave}>
  Save
</ResponsiveButton>
```

## Performance Checklist

- [ ] Use ResponsiveTable for all data tables
- [ ] Implement MobileDrawer for navigation
- [ ] Use LoadingSkeleton instead of spinners
- [ ] Apply debounce to search inputs
- [ ] Apply throttle to scroll handlers
- [ ] Use ResponsiveButton for all buttons (44px min height)
- [ ] Wrap content in ResponsiveContainer
- [ ] Remove unnecessary gradients on mobile
- [ ] Simplify shadows (use shadow-sm instead of shadow-xl)
- [ ] Test on low-end Android device (or Chrome DevTools throttling)

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Android 8.0+
- iOS 12+

## Performance Targets
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Lighthouse Performance Score: > 90
- Support 500 concurrent users
