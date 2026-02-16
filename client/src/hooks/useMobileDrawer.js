import { useState, useEffect } from 'react';

/**
 * useMobileDrawer - Hook for managing mobile drawer state
 * Automatically closes drawer when screen size changes to desktop
 */
const useMobileDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // Close drawer when switching to desktop view
      if (window.innerWidth >= 768 && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(!isOpen);

  return { isOpen, open, close, toggle };
};

export default useMobileDrawer;
