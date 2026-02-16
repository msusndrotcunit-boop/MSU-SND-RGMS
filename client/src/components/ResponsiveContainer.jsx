import React from 'react';

/**
 * ResponsiveContainer - Mobile-first container with proper padding
 * 
 * Props:
 * - children: Content to render
 * - className: Additional classes
 * - noPadding: Remove default padding
 */
const ResponsiveContainer = ({ children, className = '', noPadding = false }) => {
  const paddingClass = noPadding ? '' : 'px-4 py-4 md:px-6 md:py-6';
  
  return (
    <div className={`w-full max-w-7xl mx-auto ${paddingClass} ${className}`}>
      {children}
    </div>
  );
};

export default ResponsiveContainer;
