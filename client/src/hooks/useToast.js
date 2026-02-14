import { useState, useCallback } from 'react';

/**
 * useToast Hook
 * Custom hook for managing toast notifications
 * Validates Requirements: 2.5
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  
  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast = {
      id,
      message,
      type,
      duration: options.duration !== undefined ? options.duration : 5000,
      action: options.action,
    };
    
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);
  
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);
  
  const success = useCallback((message, options) => {
    return addToast(message, 'success', options);
  }, [addToast]);
  
  const error = useCallback((message, options) => {
    return addToast(message, 'error', options);
  }, [addToast]);
  
  const warning = useCallback((message, options) => {
    return addToast(message, 'warning', options);
  }, [addToast]);
  
  const info = useCallback((message, options) => {
    return addToast(message, 'info', options);
  }, [addToast]);
  
  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
};
