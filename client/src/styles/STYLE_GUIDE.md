# ROTC RGMS UI Style Guide

## Color System

- Primary brand color: `#354f32` (CSS var `--primary-color`)
- Primary soft overlay: `rgba(53, 79, 50, 0.16)` (`--primary-color-soft`)
- Tailwind `primary` palette:
  - `primary-50`: `#f0fdf4`
  - `primary-100`: `#dcfce7`
  - `primary-200`: `#bbf7d0`
  - `primary-300`: `#86efac`
  - `primary-400`: `#4ade80`
  - `primary-500`: `#22c55e`
  - `primary-600`: `#16a34a`
  - `primary-700`: `#15803d`
  - `primary-800`: `#166534`
  - `primary-900`: `#14532d`
- Semantic colors:
  - Success: `#10b981`
  - Warning: `#f59e0b`
  - Error: `#ef4444`
  - Info: `#3b82f6`
- Backgrounds:
  - Body light: `#f3f4f6`
  - Body dark: `#020617`
  - App background: `#e5e7eb` with background image overlay

## Typography

Base body settings (from `index.css`):

- Font family: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Base body font size: `14px`
- Line-height: `1.6`

Tailwind extended font sizes:

- `text-xs`: `0.6875rem` ≈ `11px`
- `text-sm`: `0.8125rem` ≈ `13px`
- `text-base`: `0.875rem` ≈ `14px`
- `text-lg`: `0.9375rem` ≈ `15px`
- `text-xl`: `1rem` = `16px`
- `text-2xl`: `1.125rem` ≈ `18px`
- `text-3xl`: `1.375rem` ≈ `22px`
- `text-4xl`: `1.75rem` ≈ `28px`
- `text-5xl`: `2rem` = `32px`

Common patterns:

- Primary headings in cards: `text-lg` (`≈15px`) or `text-xl` (`16px`) with `font-bold`
- Section titles (layouts): `text-xl` (`16px`) or `text-2xl` (`18px`) with `font-semibold`
- Body copy: `text-sm` (`13px`) or `text-base` (`14px`)
- Helper/error text: `text-xs` (`11px`)

## Spacing Scale

Tailwind extended spacing (final values):

- `0`: `0px`
- `1`: `8px`
- `2`: `16px`
- `3`: `24px`
- `4`: `32px`
- `5`: `40px`
- `6`: `48px`
- `7`: `56px`
- `8`: `64px`
- `9`: `72px`
- `10`: `80px`

Key layout spacings:

- Card padding (e.g. ExcuseLetter cards): `p-4 md:p-6`
  - Mobile: `16px` all sides
  - Desktop: `24px` all sides
- Vertical stack spacing between sections: `space-y-6` → `24px` between blocks
- Form vertical spacing: `space-y-4 md:space-y-6`
  - Mobile: `16px` between fields
  - Desktop: `24px` between fields
- History table padding: `p-4` → `16px`

## Buttons

Global touch target:

- All `button` and `[role="button"]` have `min-height: 40px` (from `index.css`)
- Many primary buttons add extra vertical padding to reach ~`44–48px` total height

Primary actions (example: Submit button in ExcuseLetterSubmission):

- Classes: `py-3 px-6 rounded-lg text-white bg-blue-600 hover:bg-blue-700`
- Vertical padding: `py-3` → `24px` total (approx; based on extended scale)
- Horizontal padding: `px-6` → `48px`
- Height: ≥ `40px` enforced, effectively ≈ `44–48px`
- Font size: defaults to `text-sm` or `text-base` depending on parent (`13–14px`)
- Icon size: `18px` (`<Upload size={18} />`, `<Loader2 size={18} />`)

Secondary buttons (outline / neutral):

- Classes (modals, consent dialogs):
  - Neutral: `px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50`
  - Primary outline: `px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700`
  - Alternative: `bg-green-700 text-white hover:bg-green-800`
- Horizontal padding: `px-4` → `32px`
- Vertical padding: `py-2` → `16px`
- Minimum height: `40px` (global rule)
- Font size: `text-sm` → `13px`

Icon-only controls:

- Example: section collapse toggle in MobileFormLayout:
-  - Classes: `p-1 touch-target`
-  - Inline style: `minHeight: 40px`, `minWidth: 40px`
-  - Icon size: `20px`

## Iconography

Lucide icon sizes in layouts and forms:

- Top nav icons: `size={20}` → `20px`
- Status icons (e.g. `CheckCircle` in alerts): `16px` or `18px`
- File upload icon (`Upload` in ExcuseLetterSubmission): `32px` in upload area, `18px` in buttons
- Avatar images:
  - Cadet sidebar: `w-20 h-20` → `80px × 80px`
  - Staff sidebar: `w-24 h-24` → `96px × 96px`
  - Admin avatar in sidebar: `h-10 w-10` → `40px × 40px`

## Containers and Cards

Card shells (used extensively in layouts and feature pages):

- Classes: `bg-white dark:bg-gray-800 p-4 md:p-6 rounded shadow`
  - Background: white in light mode, `#1f2937` range in dark
  - Padding: `16px` mobile, `24px` desktop
  - Border radius: `rounded` → Tailwind default `0.25rem` (`4px`)
  - Shadow: Tailwind `shadow` (matches `boxShadow.DEFAULT`)

Sidebar layouts (Admin / Staff / Cadet):

- Width: `w-64` → `256px` fixed
- Background: `bg-[var(--primary-color)]` → `#354f32`
- Layout: `flex flex-col`
- Behavior:
  - Mobile: slides in with `transform` and `transition-transform duration-300`
  - Desktop: `md:relative md:translate-x-0` (always visible)

Main content area:

- Wrapper: `className="flex-1 flex flex-col overflow-hidden"`
- Top bars: `className="bg-white shadow p-4 flex items-center justify-between"` (Admin/Cadet)
  - Height: controlled by `p-4` (`16px`) and internal content, typically ~`64–72px`

App background:

- Root layout wrapper: `className="flex h-screen app-bg overflow-hidden"`
- Height: `100vh` full viewport height
- Background: gradient overlay plus `background_1.jpg` centered, `background-size: cover`

## Form Elements

Inputs (MobileInput):

- Classes:
  - `w-full`
  - `px-3 py-3` → `horizontal 24px` padding, `vertical ~24px`
  - `border border-gray-300 dark:border-gray-600`
  - `rounded-lg` → Tailwind `0.5rem` (`8px`)
  - `bg-white dark:bg-gray-800`
  - Focus ring: `focus:ring-2 focus:ring-blue-500 focus:border-blue-500`
- Inline styles:
  - `minHeight: 44px`
  - `fontSize: 16px` on mobile (`14px` desktop via `text-base` override)

Textareas (MobileTextarea):

- Similar padding & border radius as inputs
- Default `rows={4}` with `min-height` comfortably above 44px

FormField layout:

- Vertical layout: `space-y-2` → `8–16px` between label and field
- Horizontal layout (desktop only): `sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start`
  - Label in first column, field in `sm:col-span-2`

ExcuseLetter upload area:

- Container classes:
  - `border-2 border-dashed border-gray-300 dark:border-gray-600`
  - `rounded-lg`
  - `p-6` → `24px` padding
  - `text-center`
  - `min-height: 120px` inline style

## Grids and Tables

ResponsiveTable defaults (as used in ExcuseLetter history):

- Items per page: `5`
- Table container class: `bg-white`
- Columns for ExcuseLetter:
  - Date Absent
  - Reason (truncated in `max-w-xs` ≈ `20rem` / `320px`)
  - Status (badge-style)
  - Proof (View/Download links stacked)

Status badges:

- Classes:
  - `px-2 py-1` → `horizontal 16px`, `vertical 8px`
  - `rounded` (4px radius)
  - `text-xs font-bold uppercase`
  - Color variants:
    - Approved: `bg-green-100 text-green-800`
    - Rejected: `bg-red-100 text-red-800`
    - Pending: `bg-yellow-100 text-yellow-800`

## Modals

General modal structure (e.g. upload/camera consent, permission modals):

- Backdrop:
  - Classes: `fixed inset-0 z-50 flex items-center justify-center bg-black/60`
  - Background: 60% black overlay
  - Full-screen: `inset-0` → `top/right/bottom/left: 0`
- Content:
  - Classes: `bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6`
  - Max width: `max-w-md` → `448px`
  - Horizontal margin: `mx-4` → `32px` (ensures safe edges on mobile)
  - Border radius: `rounded-lg` → `0.5rem` (`8px`)
  - Padding: `24px`

Mobile modal enhancements from CSS:

- Backdrop blur: `.mobile-modal-backdrop` uses `backdrop-filter: blur(8px)`
- Shadow: `.mobile-modal-shadow` uses multi-layer shadows for depth
- Slide animations: `mobile-modal-slide-up` / `mobile-modal-slide-down` with `0.3s` duration

## Breakpoints and Responsiveness

The project uses Tailwind’s default breakpoints unless overridden (no overrides in `tailwind.config.js`):

- `sm`: `640px`
- `md`: `768px`
- `lg`: `1024px`
- `xl`: `1280px`
- `2xl`: `1536px`

Key responsive behaviors:

- Sidebar:
  - Hidden off-canvas on `< md` (`-translate-x-full`), toggled via `translate-x-0`
  - Fixed, always visible on `md+`
- Padding adjustments:
  - Many cards and sections use `p-4 md:p-6` for denser desktop spacing
- Form spacing:
  - `space-y-4 md:space-y-6` to give more breathing room on larger screens
- Text:
  - Some components bump text size on mobile (`isMobile && "text-base"`) to prevent iOS zooming

## Alignment Patterns

- Primary layout:
  - Top-level: `flex h-screen app-bg overflow-hidden`
  - Sidebar + main: `flex` with sidebar fixed width and `flex-1` main
- Buttons:
  - Primary form actions: right-aligned via `FormActions alignment="right"` (internally `flex justify-end`)
  - Modal actions: `flex justify-end gap-3` (24px gap between buttons)
- Tables and content:
  - Many lists and summaries use `flex items-center justify-between` for headers

This guide reflects the measurements and visual system used throughout the current client, matching the deployed ROTC Grading Management System’s layout, proportions, and spacing on both mobile and desktop views.
