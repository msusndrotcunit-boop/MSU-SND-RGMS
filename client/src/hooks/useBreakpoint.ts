import { useState, useEffect } from 'react';

/**
 * Breakpoint constants matching Tailwind CSS breakpoints
 */
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

export type BreakpointName = 'mobile' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Hook for responsive behavior based on viewport width
 * @returns Current breakpoint name
 */
export const useBreakpoint = (): BreakpointName => {
  const [breakpoint, setBreakpoint] = useState<BreakpointName>('mobile');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < 640) {
        setBreakpoint('mobile');
      } else if (width < 768) {
        setBreakpoint('sm');
      } else if (width < 1024) {
        setBreakpoint('md');
      } else if (width < 1280) {
        setBreakpoint('lg');
      } else {
        setBreakpoint('xl');
      }
    };

    // Set initial breakpoint
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
};

/**
 * Hook to check if viewport is mobile size
 * @returns true if viewport is mobile (< 640px)
 */
export const useIsMobile = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'mobile';
};

/**
 * Hook to check if viewport is tablet size or smaller
 * @returns true if viewport is tablet or mobile (< 1024px)
 */
export const useIsTabletOrMobile = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'mobile' || breakpoint === 'sm' || breakpoint === 'md';
};

/**
 * Hook to check if viewport is desktop size
 * @returns true if viewport is desktop (>= 1024px)
 */
export const useIsDesktop = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'lg' || breakpoint === 'xl';
};
