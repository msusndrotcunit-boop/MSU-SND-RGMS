import React from 'react';

/**
 * ResponsiveTable - Displays as table on desktop, cards on mobile
 * 
 * Props:
 * - columns: Array of { key, label, render? }
 * - data: Array of row objects
 * - onRowClick: Optional click handler
 * - keyExtractor: Function to extract unique key from row
 */
const ResponsiveTable = ({ 
  columns, 
  data, 
  onRowClick, 
  keyExtractor = (row, index) => row.id || index 
}) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row, rowIndex)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden mobile-card-list">
        {data.map((row, rowIndex) => (
          <div
            key={keyExtractor(row, rowIndex)}
            onClick={() => onRowClick?.(row)}
            className={`mobile-card ${onRowClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
          >
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between items-start mb-2 last:mb-0">
                <span className="text-xs font-medium text-gray-500 uppercase mr-2">
                  {column.label}
                </span>
                <span className="text-sm text-gray-900 text-right flex-1">
                  {column.render ? column.render(row) : row[column.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No data available</p>
        </div>
      )}
    </>
  );
};

export default ResponsiveTable;
