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
  const useCardLayout = cardLayout === 'always';

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
              className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.key}
            className={clsx(
              column.headerClassName || "px-4 py-3",
              "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider",
              sortable && column.sortable !== false && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none",
              column.align === 'center' && "text-center",
              column.align === 'right' && "text-right",
              column.headerClassName && column.headerClassName
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
            className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </td>
      )}
      {columns.map((column) => (
        <td
          key={column.key}
          className={clsx(
            column.cellClassName || "px-4 py-3",
            "text-sm text-gray-900 dark:text-gray-100 align-baseline min-h-[44px]",
            column.align === 'center' && "text-center",
            column.align === 'right' && "text-right",
            column.cellClassName && column.cellClassName
          )}
        >
          {column.render ? column.render(item[column.key], item) : item[column.key]}
        </td>
      ))}
      {actions.length > 0 && (
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end space-x-1">
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
        "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3 transition-all duration-200",
        onRowClick && "cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 active:scale-[0.98]"
      )}
      onClick={() => onRowClick && onRowClick(item)}
    >
      {/* Selection checkbox and actions header */}
      {(selectable || actions.length > 0) && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
          {selectable && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItems.includes(item.id || item.key)}
                onChange={() => handleSelectItem(item.id || item.key)}
                onClick={(e) => e.stopPropagation()}
                className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Select</span>
            </label>
          )}
          {actions.length > 0 && (
            <div className="flex items-center space-x-1">
              {actions.map((action, actionIndex) => (
                <button
                  key={actionIndex}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(item);
                  }}
                  className={clsx(
                    "p-2 rounded-lg transition-all duration-200 touch-target active:scale-95",
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

      {/* Card content with improved layout */}
      <div className="space-y-3">
        {columns.map((column, colIndex) => {
          const value = item[column.key];
          if (value === null || value === undefined || value === '') return null;

          const isFirstColumn = colIndex === 0;
          const renderedValue = column.render ? column.render(value, item) : value;

          return (
            <div 
              key={column.key} 
              className={clsx(
                "flex flex-col space-y-1",
                isFirstColumn && "pb-2 border-b border-gray-100 dark:border-gray-700"
              )}
            >
              <span className={clsx(
                "font-medium text-gray-500 dark:text-gray-400",
                isFirstColumn ? "text-xs uppercase tracking-wide" : "text-sm"
              )}>
                {column.label}
              </span>
              <span className={clsx(
                "text-gray-900 dark:text-gray-100 break-words",
                isFirstColumn ? "text-lg font-semibold" : "text-sm"
              )}>
                {renderedValue}
              </span>
            </div>
          );
        })}
      </div>

      {/* Visual feedback for interactive cards */}
      {onRowClick && (
        <div className="absolute inset-0 rounded-lg pointer-events-none opacity-0 bg-blue-50 dark:bg-blue-900/20 transition-opacity duration-200 group-active:opacity-100" />
      )}
    </div>
  );

  const renderMobileSortControls = () => {
    if (!sortable || !useCardLayout) return null;

    const sortableColumns = columns.filter(col => col.sortable !== false);
    if (sortableColumns.length === 0) return null;

    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</span>
          <div className="flex items-center space-x-2">
            <select
              value={sortConfig.key || ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleSort(e.target.value);
                } else {
                  setSortConfig({ key: null, direction: 'asc' });
                }
              }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-target"
              style={{ minHeight: '44px', minWidth: '120px' }}
            >
              <option value="">None</option>
              {sortableColumns.map(column => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
            {sortConfig.key && (
              <button
                onClick={() => handleSort(sortConfig.key)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors touch-target"
                title={`Sort ${sortConfig.direction === 'asc' ? 'descending' : 'ascending'}`}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {sortConfig.direction === 'asc' ? <SortAsc size={20} /> : <SortDesc size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

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
      <div className={clsx(
        "bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700",
        isMobile ? "px-4 py-4 space-y-3" : "px-4 py-3 flex items-center justify-between"
      )}>
        {/* Results info */}
        <div className={clsx(
          "text-sm text-gray-700 dark:text-gray-300",
          isMobile ? "text-center" : "flex items-center"
        )}>
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} results
        </div>
        
        {/* Pagination controls */}
        <div className={clsx(
          "flex items-center justify-center",
          isMobile ? "space-x-2" : "space-x-1"
        )}>
          {/* Previous button */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={clsx(
              "font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target",
              isMobile ? "px-4 py-3 text-sm" : "px-3 py-2 text-sm"
            )}
            style={{ minHeight: '44px' }}
          >
            {isMobile ? '← Prev' : 'Previous'}
          </button>

          {/* Page numbers - simplified for mobile */}
          {isMobile ? (
            <div className="flex items-center space-x-2">
              <span className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {currentPage} of {totalPages}
              </span>
            </div>
          ) : (
            pages.map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={clsx(
                  "px-3 py-2 text-sm font-medium rounded-md touch-target transition-colors",
                  page === currentPage
                    ? "text-blue-600 bg-blue-50 dark:bg-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                    : "text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {page}
              </button>
            ))
          )}

          {/* Next button */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={clsx(
              "font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target",
              isMobile ? "px-4 py-3 text-sm" : "px-3 py-2 text-sm"
            )}
            style={{ minHeight: '44px' }}
          >
            {isMobile ? 'Next →' : 'Next'}
          </button>
        </div>

        {/* Mobile page jump controls */}
        {isMobile && totalPages > 5 && (
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Go to page:</span>
            <select
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-target"
              style={{ minHeight: '44px', minWidth: '80px' }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>
          </div>
        )}
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

      {/* Mobile sort controls */}
      {renderMobileSortControls()}

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
