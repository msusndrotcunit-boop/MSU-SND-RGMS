import React, { useState, useEffect } from 'react';
import { Save, Bell, Monitor, PaintBucket, Database, Download } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const Settings = ({ role }) => {
    const { settings, updateSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState(settings);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);

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

    const handleDownloadBackup = async () => {
        if (!window.confirm('Download full database backup? This may take a moment.')) return;
        
        setDownloading(true);
        const toastId = toast.loading('Generating backup...');
        
        try {
            const response = await axios.get('/api/admin/backup/download', {
                responseType: 'blob'
            });
            
            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `rotc_backup_${date}.json`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            
            toast.success('Backup downloaded successfully', { id: toastId });
        } catch (err) {
            console.error('Backup failed:', err);
            toast.error('Backup failed: ' + (err.response?.data?.message || err.message), { id: toastId });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <PaintBucket className="text-blue-600" />
                My Settings
            </h2>

            <div className="space-y-8">
                {/* Admin Data Management */}
                {role === 'admin' && (
                    <section>
                        <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                            <Database size={20} />
                            Data Management
                        </h3>
                        <div className="pl-4 border-l-2 border-gray-100">
                            <p className="text-sm text-gray-500 mb-3">
                                Download a complete backup of the database (Cadets, Grades, Attendance, etc.) as a JSON file.
                            </p>
                            <button
                                onClick={handleDownloadBackup}
                                disabled={downloading}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Download size={16} />
                                {downloading ? 'Downloading...' : 'Download Database Backup'}
                            </button>
                        </div>
                    </section>
                )}

                {/* Notifications Settings */}
                <section>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                        <Bell size={20} />
                        Notifications
                    </h3>
                    <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.emailAlerts}
                                onChange={(e) => handleChange('notifications', 'emailAlerts', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
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
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                        <Monitor size={20} />
                        Display
                    </h3>
                    <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.display.darkMode}
                                onChange={(e) => handleChange('display', 'darkMode', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-gray-700">Dark Mode (Beta)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.display.compactMode}
                                onChange={(e) => handleChange('display', 'compactMode', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-gray-700">Compact Mode</span>
                        </label>
                    </div>
                </section>

                {/* Theme Settings */}
                <section>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                        <PaintBucket size={20} />
                        Theme Customization
                    </h3>
                    <div className="pl-4 border-l-2 border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                        <div className="flex gap-4">
                            {['blue', 'green', 'red', 'purple', 'orange'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleChange('theme', 'primaryColor', color)}
                                    className={`w-10 h-10 rounded-full border-2 ${
                                        localSettings.theme.primaryColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: color === 'blue' ? '#3b82f6' : 
                                                            color === 'green' ? '#10b981' :
                                                            color === 'red' ? '#ef4444' :
                                                            color === 'purple' ? '#8b5cf6' : '#f97316' }}
                                />
                            ))}
                        </div>
                    </div>
                </section>

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
