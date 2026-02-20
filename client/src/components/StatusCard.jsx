import React from 'react';
import PropTypes from 'prop-types';

/**
 * Mobile-optimized status card component
 * Displays a status metric with icon, title, and count
 * Responsive padding and text sizing for mobile devices
 */
const StatusCard = ({ 
  title, 
  count, 
  icon, 
  color = '#16a34a',
  className = '',
  onClick = null
}) => {
  const CardWrapper = onClick ? 'button' : 'div';
  const interactiveProps = onClick ? {
    onClick,
    type: 'button',
    className: `${className} bg-white rounded-lg shadow-md p-3 md:p-4 border-t-4 hover:shadow-lg transition-shadow duration-200 w-full`
  } : {
    className: `${className} bg-white rounded-lg shadow-md p-3 md:p-4 border-t-4`
  };

  return (
    <CardWrapper
      {...interactiveProps}
      style={{ borderColor: color }}
    >
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        {icon && (
          <div 
            className="mb-2 flex items-center justify-center"
            style={{ color }}
          >
            {React.cloneElement(icon, {
              className: 'w-6 h-6 md:w-8 md:h-8',
              style: { maxWidth: '24px', maxHeight: '24px', ...icon.props.style }
            })}
          </div>
        )}
        
        {/* Title */}
        <div className="text-xs md:text-sm text-gray-500 mb-1 line-clamp-2 overflow-hidden">
          {title}
        </div>
        
        {/* Count */}
        <div 
          className="text-xl md:text-2xl font-bold"
          style={{ color }}
        >
          {count !== null && count !== undefined ? count : 0}
        </div>
      </div>
    </CardWrapper>
  );
};

StatusCard.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  icon: PropTypes.element,
  color: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func
};

StatusCard.defaultProps = {
  count: 0,
  icon: null,
  color: '#16a34a',
  className: '',
  onClick: null
};

export default StatusCard;
