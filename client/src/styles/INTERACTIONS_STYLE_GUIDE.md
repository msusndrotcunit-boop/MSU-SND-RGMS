# Interaction Patterns and Hover States

This guide documents interactive behaviors for buttons, links, inputs, and navigation, aligned with RGMS palette and accessibility standards.

## Timing and Easing
- Duration: 150–200ms
- Easing: ease-in-out

## Core Classes
- hover-highlight: subtle lift, shadow, and saturation on hover
- hover-icon-highlight: icon color shift to brand green with small scale
- hover-text-highlight: text color shift to brand green
- touch-target: enforces 44×44px minimum tap targets

## Usage
```
<button class="hover-highlight touch-target px-4 py-2 rounded bg-green-700 text-white">Action</button>
<a class="hover-text-highlight" href="#">Learn more</a>
```

## Accessibility
- All interactive elements must include .touch-target
- Maintain 3:1 contrast for UI components and 4.5:1 for body text

## Notes
- Classes are defined in src/index.css
- Consistency with Tailwind utilities is encouraged (focus:ring, transitions) 

