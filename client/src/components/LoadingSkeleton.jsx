import React from 'react';

/**
 * LoadingSkeleton - Lightweight loading skeleton for low-end devices
 * No animations to preserve performance
 */
const LoadingSkeleton = ({ type = 'card', count = 1 }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (type === 'table') {
    return (
      <div className="space-y-3">
        {skeletons.map((i) => (
          <div key={i} className="bg-gray-100 rounded h-16" />
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="space-y-3">
        {skeletons.map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="bg-gray-100 rounded h-4 w-3/4 mb-3" />
            <div className="bg-gray-100 rounded h-4 w-1/2 mb-3" />
            <div className="bg-gray-100 rounded h-4 w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className="space-y-2">
        {skeletons.map((i) => (
          <div key={i} className="bg-gray-100 rounded h-4" />
        ))}
      </div>
    );
  }

  return null;
};

export default LoadingSkeleton;
