import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Filter, SortAsc, SortDesc } from 'lucide-react';
import clsx from 'clsx';
import { useMobile } from '../hooks/useResponsive';

/**
 * ResponsiveTable - Automatically converts table to card layout on mobile
 * Preserves all data visibility and functionality in card format
 */
const ResponsiveTable = ({
  data = [],
  columns = [],
  loading = false,
  emptyMessage = "No data found",
  className = '',
  onRowClick,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  sortable = false,
  filterable = false,
  pagination = false,
  itemsPerPage = 10,
  actions = [],
  cardLayout = 'auto', // 'auto', 'always', 'never'
  ...props
}) => {
  const { isMobile } = useMobile();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterConfig, setFilterConfig] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Determine if we should use card layout
  const useCardLayout = cardLayout === 'always' || (cardLayout === 'auto' && isMobile);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortable || !sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, sortable]);

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!filterable || Object.keys(filterConfig).length === 0) return sortedData;

    return sortedData.filter(item => {
      return Object.entries(filterConfig).every(([key, value]) => {
        if (!value) return true;
        const itemValue = item[key];
        if (itemValue === null || itemValue === undefined) return false;
        return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
      });
    });
  }, [sortedData, filterConfig, filterable]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    if (!pagination) return filteredData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage, pagination]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilter = (key, value) => {
    setFilterConfig(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSelectAll = (checked) => {
    if (!selectable || !onSelectionChange) return;
    if (checked) {
      const allIds = paginatedData.map(item => item.id || item.key);
      onSelectionChange([...new Set([...selectedItems, ...allIds])]);
    } else {
      const currentIds = paginatedData.map(item => item.id || item.key);
      onSelectionChange(selectedItems.filter(id => !currentIds.includes(id)));
    }
  };

  const handleSelectItem = (id) => {
    if (!selectable || !onSelectionChange) return;
    if (selectedItems.includes(id)) {
      onSelectionChange(selectedItems.filter(item => item !== id));
    } else {
      onSelectionChange([...selectedItems, id]);
    }
  };

  const isAllSelected = paginatedData.length > 0 && 
    paginatedData.every(item => selectedItems.includes(item.id || item.key));

  const renderTableHeader = () => (
    <thead className="bg-gray-50 dark:bg-gray-800">
      <tr>
        {selectable && (
          <th className="px-4 py-3 text-left">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 touch-target"
            />
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.key}
            className={clsx(
              "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider",
              sortable && column.sortable !== false && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none",
              column.align === 'center' && "text-center",
              column.align === 'right' && "text-right"
            )}
            onClick={() => column.sortable !== false && handleSort(column.key)}
          >
            <div className="flex items-center space-x-1">
              <span>{column.label}</span>
              {sortable && column.sortable !== false && sortConfig.key === column.key && (
                sortConfig.direction === 'asc' ? 
                  <SortAsc size={14} /> : 
                  <SortDesc size={14} />
              )}
            </div>
          </th>
        ))}
        {actions.length > 0 && (
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Actions
          </th>
        )}
      </tr>
      {filterable && showFilters && (
        <tr className="bg-gray-100 dark:bg-gray-700">
          {selectable && <th className="px-4 py-2"></th>}
          {columns.map((column) => (
            <th key={`filter-${column.key}`} className="px-4 py-2">
              {column.filterable !== false && (
                <input
                  type="text"
                  placeholder={`Filter ${column.label.toLowerCase()}...`}
                  value={filterConfig[column.key] || ''}
                  onChange={(e) => handleFilter(column.key, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 touch-target"
                />
              )}
            </th>
          ))}
          {actions.length > 0 && <th className="px-4 py-2"></th>}
        </tr>
      )}
    </thead>
  );

  const renderTableRow = (item, index) => (
    <tr
      key={item.id || item.key || index}
      className={clsx(
        "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
        onRowClick && "cursor-pointer"
      )}
      onClick={() => onRowClick && onRowClick(item)}
    >
      {selectable && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedItems.includes(item.id || item.key)}
            onChange={() => handleSelectItem(item.id || item.key)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 touch-target"
          />
        </td>
      )}
      {columns.map((column) => (
        <td
          key={column.key}
          className={clsx(
            "px-4 py-3 text-sm text-gray-900 dark:text-gray-100",
            column.align === 'center' && "text-center",
            column.align === 'right' && "text-right"
          )}
        >
          {column.render ? column.render(item[column.key], item) : item[column.key]}
        </td>
      ))}
      {actions.length > 0 && (
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end space-x-2">
            {actions.map((action, actionIndex) => (
              <button
                key={actionIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(item);
                }}
                className={clsx(
                  "p-2 rounded-lg transition-colors touch-target",
                  action.className || "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                )}
                title={action.label}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {action.icon && <action.icon size={18} />}
              </button>
            ))}
          </div>
        </td>
      )}
    </tr>
  );

  const renderCard = (item, index) => (
    <div
      key={item.id || item.key || index}
      className={clsx(
        "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3 transition-shadow",
        onRowClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={() => onRowClick && onRowClick(item)}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="flex items-center justify-between">
          <input
            type="checkbox"
            checked={selectedItems.includes(item.id || item.key)}
            onChange={() => handleSelectItem(item.id || item.key)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 touch-target"
          />
          {actions.length > 0 && (
            <div className="flex items-center space-x-2">
              {actions.map((action, actionIndex) => (
                <button
                  key={actionIndex}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(item);
                  }}
                  className={clsx(
                    "p-2 rounded-lg transition-colors touch-target",
                    action.className || "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                  )}
                  title={action.label}
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  {action.icon && <action.icon size={18} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Card content */}
      <div className="space-y-2">
        {columns.map((column) => {
          const value = item[column.key];
          if (value === null || value === undefined || value === '') return null;

          return (
            <div key={column.key} className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 sm:mb-0">
                {column.label}:
              </span>
              <span className="text-sm text-gray-900 dark:text-gray-100 sm:text-right">
                {column.render ? column.render(value, item) : value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actions for cards without selection */}
      {!selectable && actions.length > 0 && (
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {actions.map((action, actionIndex) => (
            <button
              key={actionIndex}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(item);
              }}
              className={clsx(
                "p-2 rounded-lg transition-colors touch-target",
                action.className || "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
              )}
              title={action.label}
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              {action.icon && <action.icon size={18} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderPagination = () => {
    if (!pagination || totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = isMobile ? 3 : 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} results
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            Previous
          </button>
          {pages.map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={clsx(
                "px-3 py-2 text-sm font-medium rounded-md touch-target",
                page === currentPage
                  ? "text-blue-600 bg-blue-50 border border-blue-300"
                  : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
              )}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden", className)} {...props}>
      {/* Filter toggle for mobile */}
      {filterable && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 touch-target"
          >
            <Filter size={16} />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      )}

      {useCardLayout ? (
        /* Card Layout for Mobile */
        <div className="p-4">
          {paginatedData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedData.map(renderCard)}
            </div>
          )}
        </div>
      ) : (
        /* Table Layout for Desktop */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            {renderTableHeader()}
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map(renderTableRow)
              )}
            </tbody>
          </table>
        </div>
      )}

      {renderPagination()}
    </div>
  );
};

export default ResponsiveTable;