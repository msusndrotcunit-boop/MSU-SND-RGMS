# Attendance UI Style Guide

## Layout
 - Responsive table on md+; stacked cards auto-adapt on small screens via overflow scroll.
 - Header: gradient bar, uppercase labels, sticky on scroll.
 - Columns: Name • Company/Platoon (cadet only) • Status • Time • Remarks • Actions.

## Color Mapping
 - Primary: var(--primary-color) for focus rings, primary actions, and accents.
 - Neutral surfaces: bg-white/dark:bg-gray-900; borders gray-200/dark:gray-800.
 - Status chips:
   - Present: bg-green-100 text-green-800 (dark: bg-green-900/30 text-green-300)
   - Absent: bg-red-100 text-red-800 (dark: bg-red-900/30 text-red-300)
   - Excused: bg-blue-100 text-blue-800 (dark: bg-blue-900/30 text-blue-300)
   - Late: bg-yellow-100 text-yellow-800 (dark: bg-yellow-900/30 text-yellow-300)

## Interactions
 - Row hover: subtle bg tint.
 - Action buttons: pill-shaped with accessible contrast; active = solid tone; idle = light tone.
 - Inputs: time fields with focus:ring-2 ring-[var(--primary-color)].

## Accessibility
 - WCAG 2.1 AA: status chips use light backgrounds with dark text; active buttons use solid tones with white text.
 - Keyboard support: buttons have focus-visible rings; inputs labeled via sr-only.
 - Contrast verified for default theme; ensure var(--primary-color) stays AA against white/dark surfaces.

## Usage
 - Apply same status chip classes anywhere attendance status appears.
 - Keep actions order: Present • Absent • Excused • Late.
 - Preserve data logic; this guide affects presentation only.

## Mobile
 - Horizontal scroll for table container; minimum width 900px.
 - Controls collapse behind “Show Controls”; chips and buttons retain size for touch targets.

