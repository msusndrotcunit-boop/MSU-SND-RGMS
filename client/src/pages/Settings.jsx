import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Bell, Monitor, PaintBucket, Database, Download, Trash2, Mail as MailIcon } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'react-hot-toast';
import BackgroundUploader from '../components/BackgroundUploader';

const Settings = ({ role }) => {
    const { settings, updateSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState(settings);
    const [saving, setSaving] = useState(false);
    const [sendingCadetTemplate, setSendingCadetTemplate] = useState(null);
    const [sendingWeeklyReminder, setSendingWeeklyReminder] = useState(false);

    // Sync local state with context when context updates (initial load)
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (section, key, value) => {
        setLocalSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await updateSettings(localSettings);
        setSaving(false);
        if (result.success) {
            toast.success('Settings saved and applied successfully');
        } else {
            toast.error(result.message || 'Failed to save settings');
        }
    };

    const handleExportGraduates = async () => {
        try {
            const response = await axios.get('/api/admin/cadets/export-completed', {
                responseType: 'blob', // Important for file download
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Graduates_Archive.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            toast.success('Graduates list exported successfully.');
        } catch (error) {
            console.error('Export failed:', error);
            if (error.response && error.response.status === 404) {
                 toast.error('No completed cadets found to export.');
            } else {
                 toast.error('Failed to export graduates.');
            }
        }
    };

    const handlePruneGraduates = async () => {
        if (!window.confirm('WARNING: This will PERMANENTLY DELETE all cadets with status "Completed" from the database.\n\nMake sure you have exported/downloaded their data first.\n\nAre you sure you want to proceed?')) {
            return;
        }

        try {
             const response = await axios.delete('/api/admin/cadets/prune-completed', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            toast.success(response.data.message);
        } catch (error) {
            console.error('Prune failed:', error);
            toast.error('Failed to delete graduates: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleSendCadetEmailTemplate = async (templateKey) => {
        let confirmMessage = 'This will send an email to all eligible cadets. Continue?';
        if (templateKey === 'cadet_general_update') {
            confirmMessage = 'This will send a general information email to all verified, active cadets with a registered email address. Continue?';
        } else if (templateKey === 'cadet_training_reminder') {
            confirmMessage = 'This will send a training and activities reminder email to all verified, active cadets with a registered email address. Continue?';
        }

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setSendingCadetTemplate(templateKey);
        try {
            const response = await axios.post(
                '/api/admin/cadet-email/send-template',
                { templateKey },
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );
            toast.success(response.data.message || 'Cadet notification emails sent.');
        } catch (error) {
            console.error('Cadet email notification failed:', error);
            toast.error(error.response?.data?.message || 'Failed to send cadet notification emails.');
        } finally {
            setSendingCadetTemplate(null);
        }
    };

    const handleSendWeeklyCadetReminder = async () => {
        if (!window.confirm('This will create an in-app reminder notification for all active cadets. Continue?')) {
            return;
        }

        setSendingWeeklyReminder(true);
        try {
            const response = await axios.post(
                '/api/admin/cadet-notifications/weekly-reminder',
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );
            toast.success(response.data.message || 'Weekly reminder notifications created for cadets.');
        } catch (error) {
            console.error('Weekly cadet reminder failed:', error);
            toast.error(error.response?.data?.message || 'Failed to create weekly cadet reminders.');
        } finally {
            setSendingWeeklyReminder(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <PaintBucket className="text-[var(--primary-color)]" />
                My Settings
            </h2>

            <div className="space-y-8">
                {/* Notifications Settings */}
                <section>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                        <Bell size={20} />
                        Notifications
                    </h3>
                    <div className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.emailAlerts}
                                onChange={(e) => handleChange('notifications', 'emailAlerts', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                            />
                            <span className="text-gray-700">Email Alerts</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.pushNotifications}
                                onChange={(e) => handleChange('notifications', 'pushNotifications', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-gray-700">Push Notifications</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.activityUpdates}
                                onChange={(e) => handleChange('notifications', 'activityUpdates', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-gray-700">Activity Updates</span>
                        </label>
                    </div>
                </section>

                {/* Display Settings */}
                <section>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                        <Monitor size={20} />
                        Display
                    </h3>
                    <div className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.display.darkMode}
                                onChange={(e) => handleChange('display', 'darkMode', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                            />
                            <span className="text-gray-700">Dark Mode (Beta)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.display.compactMode}
                                onChange={(e) => handleChange('display', 'compactMode', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                            />
                            <span className="text-gray-700">Compact Mode</span>
                        </label>
                    </div>
                </section>

                {/* Theme Settings */}
                <section>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                        <PaintBucket size={20} />
                        Theme Customization
                    </h3>
                    <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Primary Color</label>
                            <div className="flex gap-4 flex-wrap">
                                {['default', 'blue', 'green', 'red', 'purple', 'orange', 'teal'].map(color => {
                                    const swatches = {
                                        default: '#0f766e',
                                        blue: '#2563eb',
                                        green: '#16a34a',
                                        red: '#dc2626',
                                        purple: '#7c3aed',
                                        orange: '#ea580c',
                                        teal: '#0f766e'
                                    };
                                    const label =
                                        color === 'default'
                                            ? 'Default'
                                            : color === 'teal'
                                            ? 'Teal (Outdoor)'
                                            : color;
                                    return (
                                        <button
                                            key={color}
                                            onClick={() => handleChange('theme', 'primaryColor', color)}
                                            className={`w-10 h-10 rounded-full border-2 transition-transform ${
                                                localSettings.theme.primaryColor === color ? 'border-gray-900 scale-110' : 'border-gray-200 hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: swatches[color] }}
                                            aria-label={label}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                             <BackgroundUploader />
                        </div>
                    </div>
                </section>

                {/* Archive & Maintenance (Admin Only) */}
                {role === 'admin' && (
                    <section>
                        <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                            <Database size={20} />
                            Archive & Maintenance
                        </h3>
                        <div className="space-y-4 pl-4 border-l-2 border-gray-100">
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <h4 className="font-medium text-gray-800 mb-2">Old Graduates Management</h4>
                                <p className="text-sm text-gray-600 mb-4">
                                    Export data of cadets who have completed the course (Status: "Completed"), then remove them to free up database space.
                                </p>
                                <div className="flex gap-3 flex-wrap">
                                    <button 
                                        onClick={handleExportGraduates}
                                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                                    >
                                        <Download size={16} />
                                        Export Graduates (Excel)
                                    </button>
                                    <button 
                                        onClick={handlePruneGraduates}
                                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        Delete from Database
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h4 className="font-medium text-gray-800 mb-2">Cadet Email Notifications</h4>
                                <p className="text-sm text-gray-600 mb-4">
                                    Send predefined email notifications to all verified, active cadets with a registered email address, and create in-app reminders for formation.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                                    <button
                                        onClick={() => handleSendCadetEmailTemplate('cadet_general_update')}
                                        disabled={sendingCadetTemplate === 'cadet_general_update'}
                                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                    >
                                        <MailIcon size={16} />
                                        <span>{sendingCadetTemplate === 'cadet_general_update' ? 'Sending general update...' : 'Send General Update to Cadets'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendCadetEmailTemplate('cadet_training_reminder')}
                                        disabled={sendingCadetTemplate === 'cadet_training_reminder'}
                                        className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 transition-colors disabled:opacity-60"
                                    >
                                        <MailIcon size={16} />
                                        <span>{sendingCadetTemplate === 'cadet_training_reminder' ? 'Sending training reminder...' : 'Send Training Reminder to Cadets'}</span>
                                    </button>
                                    <button
                                        onClick={handleSendWeeklyCadetReminder}
                                        disabled={sendingWeeklyReminder}
                                        className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition-colors disabled:opacity-60"
                                    >
                                        <MailIcon size={16} />
                                        <span>{sendingWeeklyReminder ? 'Creating reminders...' : 'Send Friday Formation Reminder (In-App)'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                <div className="pt-6 border-t border-gray-200">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        <Save size={20} />
                        <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
