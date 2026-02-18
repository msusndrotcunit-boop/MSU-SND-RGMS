import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('rgms_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    notifications: {
                        emailAlerts: !!parsed?.notifications?.emailAlerts,
                        pushNotifications: !!parsed?.notifications?.pushNotifications,
                        activityUpdates: !!parsed?.notifications?.activityUpdates
                    },
                    display: {
                        darkMode: !!parsed?.display?.darkMode,
                        compactMode: !!parsed?.display?.compactMode
                    },
                    theme: {
                        primaryColor: parsed?.theme?.primaryColor || 'default',
                        customBg: parsed?.theme?.customBg
                    }
                };
            }
        } catch {}
        return {
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
                primaryColor: 'default'
            }
        };
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
                const newSettings = {
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
                    primaryColor: res.data.primary_color || 'default',
                    customBg: res.data.custom_bg
                }
            };
                setSettings(newSettings);
                try {
                    localStorage.setItem('rgms_settings', JSON.stringify(newSettings));
                } catch {}
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

    // Apply settings side effects (run before paint to avoid flicker)
    useLayoutEffect(() => {
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

        // Custom Background
        if (settings.theme.customBg) {
            document.documentElement.style.setProperty('--bg-image', `url('${settings.theme.customBg}')`);
        } else {
            document.documentElement.style.removeProperty('--bg-image');
        }

        const palettes = {
            default: {
                main: '#0f766e',
                soft: 'rgba(15, 118, 110, 0.18)'
            },
            blue: {
                main: '#2563eb',
                soft: 'rgba(37, 99, 235, 0.18)'
            },
            indigo: {
                main: '#4f46e5',
                soft: 'rgba(79, 70, 229, 0.18)'
            },
            green: {
                main: '#16a34a',
                soft: 'rgba(22, 163, 74, 0.18)'
            },
            emerald: {
                main: '#059669',
                soft: 'rgba(5, 150, 105, 0.18)'
            },
            red: {
                main: '#dc2626',
                soft: 'rgba(220, 38, 38, 0.18)'
            },
            pink: {
                main: '#db2777',
                soft: 'rgba(219, 39, 119, 0.18)'
            },
            purple: {
                main: '#7c3aed',
                soft: 'rgba(124, 58, 237, 0.18)'
            },
            orange: {
                main: '#ea580c',
                soft: 'rgba(234, 88, 12, 0.18)'
            },
            amber: {
                main: '#d97706',
                soft: 'rgba(217, 119, 6, 0.18)'
            },
            cyan: {
                main: '#06b6d4',
                soft: 'rgba(6, 182, 212, 0.18)'
            },
            slate: {
                main: '#334155',
                soft: 'rgba(51, 65, 85, 0.18)'
            },
            teal: {
                main: '#0f766e',
                soft: 'rgba(15, 118, 110, 0.22)'
            },
            'gradient-emerald': {
                main: '#059669',
                soft: 'rgba(5, 150, 105, 0.18)',
                gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
            },
            'gradient-sunset': {
                main: '#ea580c',
                soft: 'rgba(234, 88, 12, 0.18)',
                gradient: 'linear-gradient(135deg, #fb7185 0%, #f59e0b 50%, #ea580c 100%)'
            },
            'gradient-ocean': {
                main: '#2563eb',
                soft: 'rgba(37, 99, 235, 0.18)',
                gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #1d4ed8 100%)'
            }
        };
        const palette = palettes[settings.theme.primaryColor] || palettes.blue;
        document.documentElement.style.setProperty('--primary-color', palette.main);
        document.documentElement.style.setProperty('--primary-color-soft', palette.soft);
        if (palette.gradient) {
            document.documentElement.style.setProperty('--primary-gradient', palette.gradient);
        } else {
            document.documentElement.style.removeProperty('--primary-gradient');
        }

        // Persist to local storage for instant application on next load
        try {
            localStorage.setItem('rgms_settings', JSON.stringify(settings));
        } catch {}
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
            try {
                localStorage.setItem('rgms_settings', JSON.stringify(newSettings));
            } catch {}
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
