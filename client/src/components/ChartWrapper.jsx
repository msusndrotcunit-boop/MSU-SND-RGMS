import React, { useEffect, useRef } from 'react';

const ChartWrapper = ({ children, className = '' }) => {
  const containerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (containerRef.current) {
        const canvases = containerRef.current.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
          try {
            // Do not create WebGL contexts here.
            // Simply neutralize and detach canvases to allow GC.
            canvas.width = 0;
            canvas.height = 0;
            if (canvas.parentNode) {
              canvas.parentNode.removeChild(canvas);
            }
          } catch {}
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
