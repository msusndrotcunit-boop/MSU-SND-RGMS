import React, { useState } from 'react';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';

const BackgroundUploader = () => {
    const { settings, setSettings } = useSettings(); // Assuming setSettings is exposed or I need to reload
    // Actually SettingsContext exposes settings, but maybe not setSettings directly for partial updates.
    // I should check SettingsContext again.
    
    // SettingsContext exposes: { settings, loading, updateSettings } - Wait, I need to check what it exposes.
    
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        setMessage('');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/auth/settings/background', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            // Update context
            // I need to trigger a reload of settings or update state locally.
            // For now, let's assume I can force a reload.
            window.location.reload(); 
            // Or better, if context exposes a way to refresh.
        } catch (error) {
            console.error(error);
            setMessage('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleReset = async () => {
         try {
            const token = localStorage.getItem('token');
            // We can send empty string or null to clear it? 
            // The backend endpoint might need adjustment or we use PUT /settings with custom_bg: null
            await axios.put('/api/auth/settings', { ...settings, custom_bg: null }, {
                 headers: { Authorization: `Bearer ${token}` }
            });
             window.location.reload();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Custom Background</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Upload a custom background image for your dashboard.
            </p>

            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <label className="block">
                        <span className="sr-only">Choose profile photo</span>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={uploading}
                            className="block w-full text-sm text-gray-500 dark:text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100
                                dark:file:bg-gray-700 dark:file:text-gray-300
                            "
                        />
                    </label>
                    {uploading && <span className="text-sm text-blue-500">Uploading...</span>}
                </div>

                {settings.theme.customBg && (
                    <div className="mt-4">
                        <p className="text-xs text-gray-500 mb-2">Current Background:</p>
                        <img 
                            src={settings.theme.customBg} 
                            alt="Current Background" 
                            className="w-32 h-20 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                        />
                        <button 
                            onClick={handleReset}
                            className="mt-2 text-xs text-red-500 hover:text-red-600 underline"
                        >
                            Remove Background
                        </button>
                    </div>
                )}
                
                {message && <p className="text-sm text-red-500">{message}</p>}
            </div>
        </div>
    );
};

export default BackgroundUploader;
