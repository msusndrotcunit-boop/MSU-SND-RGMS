import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Bell, Monitor, PaintBucket, Database, Download, Trash2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'react-hot-toast';
import BackgroundUploader from '../components/BackgroundUploader';

const Settings = ({ role }) => {
    const { settings, updateSettings } = useSettings();
    const [localSettings, setLocalSettings] = useState(settings);
    const [saving, setSaving] = useState(false);
    // Removed cadet email notifications controls
    const [systemStatus, setSystemStatus] = useState(null);
    const [statusError, setStatusError] = useState(false);

    // Sync local state with context when context updates (initial load)
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        let mounted = true;
        const fetchStatus = async () => {
            if (role !== 'admin') return;
            try {
                // Use system-status endpoint (includes health check)
                const res = await axios.get('/api/admin/system-status');
                
                if (!mounted) return;
                setSystemStatus(res.data || null);
                setStatusError(false);
            } catch (err) {
                console.error('System status error:', err);
                if (!mounted) return;
                setStatusError(true);
            }
        };
        fetchStatus();
        const id = setInterval(fetchStatus, 60000);
        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, [role]);

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

    // Removed cadet email notifications handlers

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <PaintBucket className="text-[var(--primary-color)] w-5 h-5 md:w-6 md:h-6" />
                My Settings
            </h2>

            <div className="space-y-6 md:space-y-8">
                {/* Notifications Settings */}
                <section>
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                        <Bell size={18} className="md:w-5 md:h-5" />
                        Notifications
                    </h3>
                    <div className="space-y-3 pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.emailAlerts}
                                onChange={(e) => handleChange('notifications', 'emailAlerts', e.target.checked)}
                                className="form-checkbox h-4 w-4 md:h-3 md:w-3 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                            />
                            <span className="text-sm md:text-base text-gray-700">Email Alerts</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.pushNotifications}
                                onChange={(e) => handleChange('notifications', 'pushNotifications', e.target.checked)}
                                className="form-checkbox h-4 w-4 md:h-3 md:w-3 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm md:text-base text-gray-700">Push Notifications</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.notifications.activityUpdates}
                                onChange={(e) => handleChange('notifications', 'activityUpdates', e.target.checked)}
                                className="form-checkbox h-4 w-4 md:h-3 md:w-3 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm md:text-base text-gray-700">Activity Updates</span>
                        </label>
                    </div>
                </section>

                {/* Display Settings */}
                <section>
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                        <Monitor size={18} className="md:w-5 md:h-5" />
                        Display
                    </h3>
                    <div className="space-y-3 pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.display.darkMode}
                                onChange={(e) => handleChange('display', 'darkMode', e.target.checked)}
                                className="form-checkbox h-4 w-4 md:h-3 md:w-3 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                            />
                            <span className="text-sm md:text-base text-gray-700">Dark Mode (Beta)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={localSettings.display.compactMode}
                                onChange={(e) => handleChange('display', 'compactMode', e.target.checked)}
                                className="form-checkbox h-4 w-4 md:h-3 md:w-3 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                            />
                            <span className="text-sm md:text-base text-gray-700">Compact Mode</span>
                        </label>
                    </div>
                </section>

                {/* Theme Settings */}
                <section>
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                        <PaintBucket size={18} className="md:w-5 md:h-5" />
                        Theme Customization
                    </h3>
                    <div className="pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-4 md:space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Primary Color</label>
                            <label className="flex items-center gap-2 mb-2 text-xs text-gray-600 dark:text-gray-400">
                                <input 
                                    type="checkbox" 
                                    checked={!!localSettings.display?.compactSwatches} 
                                    onChange={(e) => setLocalSettings(prev => ({ 
                                        ...prev, 
                                        display: { ...prev.display, compactSwatches: e.target.checked } 
                                    }))}
                                    className="form-checkbox h-3 w-3 text-[var(--primary-color)] rounded focus:ring-[var(--primary-color)]"
                                />
                                Compact swatches
                            </label>
                            <div className="flex gap-3 flex-wrap">
                                {[
                                    'default','blue','indigo','green','emerald','red','pink','purple','orange','amber','cyan','teal','slate',
                                    'gradient-emerald','gradient-sunset','gradient-ocean'
                                ].map(token => {
                                    const solids = {
                                        default: '#0f766e',
                                        blue: '#2563eb',
                                        indigo: '#4f46e5',
                                        green: '#16a34a',
                                        emerald: '#059669',
                                        red: '#dc2626',
                                        pink: '#db2777',
                                        purple: '#7c3aed',
                                        orange: '#ea580c',
                                        amber: '#d97706',
                                        cyan: '#06b6d4',
                                        teal: '#0f766e',
                                        slate: '#334155'
                                    };
                                    const isGradient = token.startsWith('gradient-');
                                    const label = isGradient
                                        ? token.replace('gradient-', '').replace('-', ' ') + ' gradient'
                                        : token === 'default' ? 'Default' : token;
                                    return (
                                        <button
                                            key={token}
                                            onClick={() => handleChange('theme', 'primaryColor', token)}
                                            className={`${localSettings.display?.compactSwatches ? 'w-6 h-6' : 'w-8 h-8'} rounded-full border-2 transition-transform ${
                                                localSettings.theme.primaryColor === token ? 'border-gray-900 scale-110' : 'border-gray-200 hover:scale-105'
                                            }`}
                                            style={isGradient ? { backgroundImage: 'var(--primary-gradient)', background: token === 'gradient-emerald'
                                                ? 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                                                : token === 'gradient-sunset'
                                                ? 'linear-gradient(135deg, #fb7185 0%, #f59e0b 50%, #ea580c 100%)'
                                                : 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #1d4ed8 100%)'
                                            } : { backgroundColor: solids[token] }}
                                            aria-label={label}
                                            title={label}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Grouped sections */}
                        <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase text-gray-500">Solids</div>
                            <div className="flex gap-3 flex-wrap">
                                {['default','blue','indigo','green','emerald','red','pink','purple','orange','amber','cyan','teal','slate'].map(token => {
                                    const solids = {
                                        default: '#0f766e', blue: '#2563eb', indigo: '#4f46e5', green: '#16a34a', emerald: '#059669',
                                        red: '#dc2626', pink: '#db2777', purple: '#7c3aed', orange: '#ea580c', amber: '#d97706',
                                        cyan: '#06b6d4', teal: '#0f766e', slate: '#334155'
                                    };
                                    return (
                                        <button
                                            key={`solid-${token}`}
                                            onClick={() => handleChange('theme', 'primaryColor', token)}
                                            className={`${localSettings.display?.compactSwatches ? 'w-6 h-6' : 'w-8 h-8'} rounded-full border-2 ${localSettings.theme.primaryColor===token ? 'border-gray-900 scale-110' : 'border-gray-200 hover:scale-105'} transition-transform`}
                                            style={{ backgroundColor: solids[token] }}
                                            title={token}
                                        />
                                    );
                                })}
                            </div>
                            <div className="text-xs font-semibold uppercase text-gray-500">Gradients</div>
                            <div className="flex gap-3 flex-wrap">
                                {['gradient-emerald','gradient-sunset','gradient-ocean'].map(token => {
                                    const gradients = {
                                        'gradient-emerald': 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                        'gradient-sunset': 'linear-gradient(135deg, #fb7185 0%, #f59e0b 50%, #ea580c 100%)',
                                        'gradient-ocean': 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #1d4ed8 100%)'
                                    };
                                    return (
                                        <button
                                            key={`grad-${token}`}
                                            onClick={() => handleChange('theme', 'primaryColor', token)}
                                            className={`${localSettings.display?.compactSwatches ? 'w-6 h-6' : 'w-8 h-8'} rounded-full border-2 ${localSettings.theme.primaryColor===token ? 'border-gray-900 scale-110' : 'border-gray-200 hover:scale-105'} transition-transform`}
                                            style={{ background: gradients[token] }}
                                            title={token.replace('gradient-','') + ' gradient'}
                                        />
                                    );
                                })}
                            </div>
                            <div className="text-xs font-semibold uppercase text-gray-500">Unit Packages</div>
                            <div className="flex gap-3 flex-wrap">
                                {[
                                    { token: 'default', name: 'ROTC Green' },
                                    { token: 'slate', name: 'Ops Slate' },
                                    { token: 'gradient-emerald', name: 'Field Blend' }
                                ].map(p => (
                                    <button
                                        key={`pkg-${p.token}`}
                                        onClick={() => handleChange('theme', 'primaryColor', p.token)}
                                        className={`${localSettings.display?.compactSwatches ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded border-2 ${localSettings.theme.primaryColor===p.token ? 'border-gray-900' : 'border-gray-200'} bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:shadow`}
                                        title={p.name}
                                    >
                                        {p.name}
                                    </button>
                                ))}
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
                        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700 flex items-center gap-2">
                            <Database size={18} className="md:w-5 md:h-5" />
                            Archive & Maintenance
                        </h3>
                        <div className="space-y-4 pl-3 md:pl-4 border-l-2 border-gray-100">
                            <div className="p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <h4 className="text-sm md:text-base font-medium text-gray-800 mb-2">Old Graduates Management</h4>
                                <p className="text-xs md:text-sm text-gray-600 mb-4">
                                    Export data of cadets who have completed the course (Status: "Completed"), then remove them to free up database space.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={handleExportGraduates}
                                        className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded hover:bg-green-700 transition-colors text-sm min-h-[44px]"
                                    >
                                        <Download size={16} />
                                        Export Graduates (Excel)
                                    </button>
                                    <button 
                                        onClick={handlePruneGraduates}
                                        className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded hover:bg-red-700 transition-colors text-sm min-h-[44px]"
                                    >
                                        <Trash2 size={16} />
                                        Delete from Database
                                    </button>
                                </div>
                            </div>
                            {/* Cadet Email Notifications removed per admin request */}
                        </div>
                    </section>
                )}

                {role === 'admin' && (
                    <section>
                        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700 dark:text-gray-100 flex items-center gap-2">
                            <Database size={18} className="md:w-5 md:h-5" />
                            Database Status
                        </h3>
                        <div className="space-y-4 pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-gray-700">
                            <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Type</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                            {systemStatus?.database?.type || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                                        <span className={`text-sm font-semibold ${systemStatus?.database?.status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                                            {systemStatus?.database?.status || (statusError ? 'error' : 'unknown')}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Latency (ms)</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                            {systemStatus?.database?.latencyMs ?? '—'}
                                        </span>
                                    </div>
                                </div>
                                {systemStatus?.database?.error && (
                                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                                        <div className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Error Details:</div>
                                        <div className="text-xs text-red-700 dark:text-red-400 font-mono">{systemStatus.database.error}</div>
                                    </div>
                                )}
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Cadets</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{systemStatus?.metrics?.cadets ?? '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Users</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{systemStatus?.metrics?.users ?? '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Training Days</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{systemStatus?.metrics?.trainingDays ?? '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Activities</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{systemStatus?.metrics?.activities ?? '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Unread Notifications</span>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{systemStatus?.metrics?.unreadNotifications ?? '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                <div className="pt-4 md:pt-6 border-t border-gray-200">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors min-h-[44px]"
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
