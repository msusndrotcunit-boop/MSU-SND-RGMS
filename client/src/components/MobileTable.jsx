import React from 'react';
import PropTypes from 'prop-types';

/**
 * Mobile-optimized table wrapper component
 * Provides horizontal scrolling on mobile while keeping page body fixed
 * Includes sticky headers and responsive padding
 */
const MobileTable = ({ children, className = '', stickyHeader = true }) => {
  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="inline-block min-w-full align-middle px-4 md:px-0">
        <div className="overflow-hidden border border-gray-200 md:rounded-lg">
          <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
            {React.Children.map(children, (child) => {
              // Add sticky positioning to thead if stickyHeader is true
              if (child && child.type === 'thead' && stickyHeader) {
                return React.cloneElement(child, {
                  className: `${child.props.className || ''} bg-gray-50 sticky top-0 z-10`.trim()
                });
              }
              return child;
            })}
          </table>
        </div>
      </div>
    </div>
  );
};

MobileTable.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  stickyHeader: PropTypes.bool
};

MobileTable.defaultProps = {
  className: '',
  stickyHeader: true
};

/**
 * Mobile-optimized table header cell
 */
export const MobileTableHeader = ({ children, className = '', ...props }) => {
  return (
    <th
      className={`px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

MobileTableHeader.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

/**
 * Mobile-optimized table cell
 */
export const MobileTableCell = ({ children, className = '', ...props }) => {
  return (
    <td
      className={`px-3 md:px-6 py-2 md:py-4 text-sm text-gray-900 ${className}`}
      {...props}
    >
      {children}
    </td>
  );
};

MobileTableCell.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
};

export default MobileTable;
