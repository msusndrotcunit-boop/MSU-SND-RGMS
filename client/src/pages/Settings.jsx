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

    const handleExportData = async (type, format) => {
        if (!window.confirm(`Export all ${type} data as ${format.toUpperCase()}? This may include sensitive information. Only download on secure, trusted devices.`)) {
            return;
        }
        try {
            const url = `/api/admin/export/${type}?format=${format}`;
            const res = await axios.get(url, { responseType: 'blob' });
            const contentType = res.headers['content-type'] || (format === 'json' ? 'application/json' : 'text/csv');
            const blob = new Blob([res.data], { type: contentType });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${type}_export.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error(err);
            toast.error('Export failed: ' + (err.response?.data?.message || err.message));
        }
    };

    // Removed cadet email notifications handlers

    return (
        <div className="space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                    <span className="border-l-4 border-[var(--primary-color)] pl-3">System Settings & Configuration</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 transition flex items-center shadow-md min-h-[44px] hover-highlight disabled:opacity-50"
                    >
                        <Save size={18} className="mr-2" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Sidebar: Navigation/Quick Stats */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Appearance Preview */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-blue-600 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <PaintBucket className="text-blue-600" size={20} />
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Appearance</h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Customize the look and feel of your interface.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Theme Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => handleChange('appearance', 'theme', 'light')}
                                        className={`py-2 px-3 text-xs font-bold rounded border transition-all ${localSettings.appearance?.theme === 'light' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                    >
                                        LIGHT
                                    </button>
                                    <button 
                                        onClick={() => handleChange('appearance', 'theme', 'dark')}
                                        className={`py-2 px-3 text-xs font-bold rounded border transition-all ${localSettings.appearance?.theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                    >
                                        DARK
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {role === 'admin' && (
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-amber-600 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Database className="text-amber-600" size={20} />
                                <h3 className="font-bold text-gray-800 dark:text-gray-100">Database Health</h3>
                            </div>
                            {systemStatus ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Status</span>
                                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">Online</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Active Users</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-100">{systemStatus.active_users || 0}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">Checking system health...</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Settings Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Background Settings */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-[var(--primary-color)] p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <Monitor className="text-[var(--primary-color)]" size={20} />
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Interface Customization</h3>
                        </div>
                        
                        <div className="space-y-6">
                            <BackgroundUploader />
                        </div>
                    </div>

                    {/* Data Management (Admin Only) */}
                    {role === 'admin' && (
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md border-t-4 border-red-600 p-6">
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                                <Database className="text-red-600" size={20} />
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Data Management</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button 
                                    onClick={handleExportGraduates}
                                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex flex-col items-center text-center gap-2 group"
                                >
                                    <Download size={24} className="text-blue-600 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">Export Graduates</span>
                                    <span className="text-[10px] text-gray-500">Download Excel archive of completed cadets</span>
                                </button>
                                <button 
                                    onClick={handlePruneGraduates}
                                    className="p-4 border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex flex-col items-center text-center gap-2 group"
                                >
                                    <Trash2 size={24} className="text-red-600 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-red-700 text-sm">Prune Database</span>
                                    <span className="text-[10px] text-red-500/70">Permanently remove archived records</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
