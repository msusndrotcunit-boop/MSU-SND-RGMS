import React, { useEffect, useRef } from 'react';

/**
 * ChartWrapper - Prevents WebGL context leaks from Recharts
 * 
 * Recharts creates WebGL contexts that can leak on hot reload or frequent re-renders.
 * This wrapper ensures proper cleanup of chart instances.
 */
const ChartWrapper = ({ children, className = '' }) => {
  const containerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      
      // Clean up any canvas elements that might have WebGL contexts
      if (containerRef.current) {
        const canvases = containerRef.current.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          try {
            // Get WebGL context and lose it
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (gl && gl.getExtension('WEBGL_lose_context')) {
              gl.getExtension('WEBGL_lose_context').loseContext();
            }
          } catch (e) {
            // Ignore errors during cleanup
          }
        });
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default ChartWrapper;
