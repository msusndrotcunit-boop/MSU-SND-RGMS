import React from 'react';
import { MobileFormLayout, FormSection, FormField, MobileInput, MobileSelect, MobileTextarea, FormActions } from './MobileFormLayout';
import MobileModalManager from './MobileModalManager';
import TouchTargetValidator from './TouchTargetValidator';

/**
 * StandardMobileForms - Collection of standardized mobile form patterns
 * Provides consistent form layouts and behaviors across the application
 */

/**
 * LoginForm - Standardized mobile login form
 */
export const LoginForm = ({
  formData,
  onChange,
  onSubmit,
  loading = false,
  error = null,
  loginType = 'cadet',
  showForgotPassword = false,
  onForgotPassword
}) => {
  const handleChange = (field) => (e) => {
    onChange({ ...formData, [field]: e.target.value });
  };

  return (
    <MobileFormLayout onSubmit={onSubmit}>
      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {(loginType === 'cadet' || loginType === 'staff') && (
        <FormField 
          label="Username or Email" 
          required
          hint={loginType === 'cadet' ? "Use your Student ID or Email" : "Use your Staff Username"}
        >
          <MobileInput
            type="text"
            value={formData.identifier || ''}
            onChange={handleChange('identifier')}
            placeholder={loginType === 'cadet' ? "Student ID or Email" : "Staff Username"}
            disabled={loading}
            required
          />
        </FormField>
      )}

      {loginType === 'admin' && (
        <>
          <FormField label="Username" required>
            <MobileInput
              type="text"
              value={formData.username || ''}
              onChange={handleChange('username')}
              placeholder="Admin Username"
              disabled={loading}
              required
            />
          </FormField>

          <FormField label="Password" required>
            <MobileInput
              type="password"
              value={formData.password || ''}
              onChange={handleChange('password')}
              placeholder="Enter your password"
              disabled={loading}
              showPasswordToggle={true}
              required
            />
          </FormField>
        </>
      )}

      <FormActions alignment="stretch">
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors touch-target"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
        
        {showForgotPassword && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="w-full text-green-600 hover:text-green-800 font-medium py-2 touch-target"
          >
            Forgot Password?
          </button>
        )}
      </FormActions>
    </MobileFormLayout>
  );
};

/**
 * ContactForm - Standardized contact/message form
 */
export const ContactForm = ({
  formData,
  onChange,
  onSubmit,
  loading = false,
  title = "Contact Form",
  showSubject = true,
  showCategory = false,
  categories = []
}) => {
  const handleChange = (field) => (e) => {
    onChange({ ...formData, [field]: e.target.value });
  };

  return (
    <MobileFormLayout onSubmit={onSubmit}>
      {showCategory && categories.length > 0 && (
        <FormField label="Category" required>
          <MobileSelect
            value={formData.category || ''}
            onChange={handleChange('category')}
            options={categories}
            placeholder="Select a category"
            required
          />
        </FormField>
      )}

      {showSubject && (
        <FormField label="Subject" required>
          <MobileInput
            type="text"
            value={formData.subject || ''}
            onChange={handleChange('subject')}
            placeholder="Enter subject"
            disabled={loading}
            required
          />
        </FormField>
      )}

      <FormField label="Message" required>
        <MobileTextarea
          value={formData.message || ''}
          onChange={handleChange('message')}
          placeholder="Enter your message"
          rows={6}
          disabled={loading}
          autoResize={true}
          required
        />
      </FormField>

      <FormActions alignment="right">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors touch-target"
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </FormActions>
    </MobileFormLayout>
  );
};

/**
 * ProfileForm - Standardized profile editing form
 */
export const ProfileForm = ({
  formData,
  onChange,
  onSubmit,
  loading = false,
  sections = [],
  isLocked = false,
  showPhotoUpload = true,
  photoPreview = null,
  onPhotoChange
}) => {
  const handleChange = (field) => (e) => {
    onChange({ ...formData, [field]: e.target.value });
  };

  return (
    <MobileFormLayout 
      onSubmit={onSubmit}
      sections={sections.length > 0 ? sections : [
        {
          id: 'personal',
          title: 'Personal Information',
          description: 'Basic personal details',
          content: (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First Name" required>
                  <MobileInput
                    type="text"
                    value={formData.firstName || ''}
                    onChange={handleChange('firstName')}
                    placeholder="Enter first name"
                    disabled={isLocked || loading}
                    required
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <MobileInput
                    type="text"
                    value={formData.lastName || ''}
                    onChange={handleChange('lastName')}
                    placeholder="Enter last name"
                    disabled={isLocked || loading}
                    required
                  />
                </FormField>
              </div>
              
              <FormField label="Email" required>
                <MobileInput
                  type="email"
                  value={formData.email || ''}
                  onChange={handleChange('email')}
                  placeholder="Enter email address"
                  disabled={isLocked || loading}
                  required
                />
              </FormField>
            </div>
          )
        }
      ]}
      collapsible={sections.length > 1}
    >
      <FormActions alignment="right">
        <button
          type="submit"
          disabled={loading || isLocked}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors touch-target"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </FormActions>
    </MobileFormLayout>
  );
};

/**
 * SearchForm - Standardized search form
 */
export const SearchForm = ({
  searchTerm,
  onSearchChange,
  onSubmit,
  placeholder = "Search...",
  showFilters = false,
  filters = [],
  onFilterChange,
  className = ''
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow ${className}`}>
      <MobileFormLayout onSubmit={onSubmit}>
        <FormField label="Search">
          <MobileInput
            type="search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
          />
        </FormField>

        {showFilters && filters.length > 0 && (
          <FormSection title="Filters" collapsible={true}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filters.map((filter, index) => (
                <FormField key={index} label={filter.label}>
                  <MobileSelect
                    value={filter.value}
                    onChange={(e) => onFilterChange(filter.key, e.target.value)}
                    options={filter.options}
                    placeholder={`Select ${filter.label.toLowerCase()}`}
                  />
                </FormField>
              ))}
            </div>
          </FormSection>
        )}

        <FormActions alignment="right">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors touch-target"
          >
            Search
          </button>
        </FormActions>
      </MobileFormLayout>
    </div>
  );
};

/**
 * ModalForm - Standardized modal form wrapper
 */
export const ModalForm = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  loading = false,
  size = 'default',
  submitText = 'Save',
  cancelText = 'Cancel',
  submitVariant = 'primary' // 'primary', 'danger', 'warning'
}) => {
  const submitStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white'
  };

  return (
    <MobileModalManager
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footerActions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors touch-target"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            form="modal-form"
            disabled={loading}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors touch-target ${submitStyles[submitVariant]} disabled:bg-gray-400`}
          >
            {loading ? 'Processing...' : submitText}
          </button>
        </>
      }
    >
      <form id="modal-form" onSubmit={onSubmit}>
        {children}
      </form>
    </MobileModalManager>
  );
};

export default {
  LoginForm,
  ContactForm,
  ProfileForm,
  SearchForm,
  ModalForm
};