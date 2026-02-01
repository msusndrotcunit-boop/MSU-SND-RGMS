import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        notifications: {
            emailAlerts: true,
            pushNotifications: true,
            activityUpdates: true
        },
        display: {
            darkMode: false,
            compactMode: false
        },
        theme: {
            primaryColor: 'blue'
        }
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const res = await axios.get('/api/auth/settings', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data) {
                setSettings({
                    notifications: {
                        emailAlerts: !!res.data.email_alerts,
                        pushNotifications: !!res.data.push_notifications,
                        activityUpdates: !!res.data.activity_updates
                    },
                    display: {
                        darkMode: !!res.data.dark_mode,
                        compactMode: !!res.data.compact_mode
                    },
                    theme: {
                        primaryColor: res.data.primary_color || 'blue'
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    // Apply settings side effects
    useEffect(() => {
        // Dark Mode
        if (settings.display.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Compact Mode (can be used by components via context)
        if (settings.display.compactMode) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }

        // Theme Color (CSS Variable)
        const colors = {
            blue: '#3b82f6',
            green: '#10b981',
            red: '#ef4444',
            purple: '#8b5cf6',
            orange: '#f97316'
        };
        document.documentElement.style.setProperty('--primary-color', colors[settings.theme.primaryColor] || colors.blue);

    }, [settings]);

    const updateSettings = async (newSettings) => {
        // Optimistic update
        setSettings(newSettings);
        
        try {
            const token = localStorage.getItem('token');
            const payload = {
                email_alerts: newSettings.notifications.emailAlerts,
                push_notifications: newSettings.notifications.pushNotifications,
                activity_updates: newSettings.notifications.activityUpdates,
                dark_mode: newSettings.display.darkMode,
                compact_mode: newSettings.display.compactMode,
                primary_color: newSettings.theme.primaryColor
            };

            await axios.put('/api/auth/settings', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            // Revert on error? For now, just log it.
            return false;
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, fetchSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};
