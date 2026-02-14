import React, { useState } from 'react';
import {
  Button,
  Input,
  Card,
  Modal,
  ToastContainer,
  Skeleton,
  SkeletonCard,
  Spinner,
  InlineSpinner,
} from '../../components/ui';
import { useToast } from '../../hooks/useToast';

/**
 * UI Showcase Page
 * Demo page for testing all UI components
 */
const UIShowcase = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const { toasts, removeToast, success, error, warning, info } = useToast();
  
  const validateEmail = (value) => {
    if (!value) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? '' : 'Please enter a valid email';
  };
  
  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">UI Component Showcase</h1>
      
      {/* Buttons */}
      <Card header={<h2 className="text-xl font-semibold">Buttons</h2>}>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>
      </Card>
      
      {/* Inputs */}
      <Card header={<h2 className="text-xl font-semibold">Inputs</h2>}>
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            validate={validateEmail}
            helperText="We'll never share your email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            required
          />
          <Input
            label="Disabled Input"
            value="Cannot edit"
            disabled
          />
          <Input
            label="Error State"
            error="This field has an error"
          />
        </div>
      </Card>
      
      {/* Cards */}
      <Card header={<h2 className="text-xl font-semibold">Cards</h2>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="default">
            <h3 className="font-semibold mb-2">Default Card</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">This is a default card</p>
          </Card>
          <Card variant="bordered">
            <h3 className="font-semibold mb-2">Bordered Card</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">This card has a border</p>
          </Card>
          <Card variant="elevated" hoverable>
            <h3 className="font-semibold mb-2">Elevated Hoverable</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Hover over me!</p>
          </Card>
        </div>
      </Card>
      
      {/* Modal */}
      <Card header={<h2 className="text-xl font-semibold">Modal</h2>}>
        <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Example Modal"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setIsModalOpen(false)}>Confirm</Button>
            </div>
          }
        >
          <p>This is an example modal with focus trap and keyboard navigation.</p>
          <p className="mt-2">Press Escape to close or click outside.</p>
        </Modal>
      </Card>
      
      {/* Toasts */}
      <Card header={<h2 className="text-xl font-semibold">Toast Notifications</h2>}>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => success('Success message!')}>Success Toast</Button>
          <Button onClick={() => error('Error message!')}>Error Toast</Button>
          <Button onClick={() => warning('Warning message!')}>Warning Toast</Button>
          <Button onClick={() => info('Info message!')}>Info Toast</Button>
          <Button onClick={() => success('Action available', {
            action: { label: 'Undo', onClick: () => console.log('Undo clicked') }
          })}>
            Toast with Action
          </Button>
        </div>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </Card>
      
      {/* Loading States */}
      <Card header={<h2 className="text-xl font-semibold">Loading States</h2>}>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Spinners</h3>
            <div className="flex items-center gap-4">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
              <InlineSpinner text="Loading data..." />
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-3">Skeletons</h3>
            <div className="space-y-4">
              <Skeleton count={3} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard showAvatar lines={2} />
                <SkeletonCard lines={3} />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UIShowcase;
