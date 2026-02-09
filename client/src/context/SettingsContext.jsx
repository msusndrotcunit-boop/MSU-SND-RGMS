import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const navigate = useNavigate();
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

        const palettes = {
            blue: {
                main: '#2563eb',
                soft: 'rgba(37, 99, 235, 0.18)'
            },
            green: {
                main: '#16a34a',
                soft: 'rgba(22, 163, 74, 0.18)'
            },
            red: {
                main: '#dc2626',
                soft: 'rgba(220, 38, 38, 0.18)'
            },
            purple: {
                main: '#7c3aed',
                soft: 'rgba(124, 58, 237, 0.18)'
            },
            orange: {
                main: '#ea580c',
                soft: 'rgba(234, 88, 12, 0.18)'
            },
            teal: {
                main: '#0f766e',
                soft: 'rgba(15, 118, 110, 0.22)'
            }
        };
        const palette = palettes[settings.theme.primaryColor] || palettes.blue;
        document.documentElement.style.setProperty('--primary-color', palette.main);
        document.documentElement.style.setProperty('--primary-color-soft', palette.soft);

    }, [settings]);

    const updateSettings = async (newSettings) => {
        // Optimistic update
        const previousSettings = settings;
        setSettings(newSettings);
        
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error("Authentication expired. Please login again.");

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
            return { success: true };
        } catch (error) {
            console.error('Error saving settings:', error);
            // Revert on error
            setSettings(previousSettings);

            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                localStorage.removeItem('token');
                navigate('/login');
                return { success: false, message: 'Session expired. Please login again.' };
            }

            const msg = error.response?.data?.message || error.message || 'Failed to save settings';
            return { success: false, message: msg };
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, fetchSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};
