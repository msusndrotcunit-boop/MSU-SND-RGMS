import React from 'react';
import ThreeDViewer from '../../components/ThreeDViewer';

export default function ThreeDStudio() {
  return (
    <div className="w-full h-full p-3 md:p-6">
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-[70vh] md:h-[78vh]">
        <ThreeDViewer className="w-full h-full" objects={9} />
      </div>
      <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
        Interact with objects by hovering, clicking, or dragging to tilt.
      </div>
    </div>
  );
}
