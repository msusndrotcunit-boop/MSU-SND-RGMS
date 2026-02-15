import React, { useState, Suspense, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Info, Home as HomeIcon, Settings, ChevronRight, QrCode, FileText, CheckCircle, ArrowRight, MessageSquare, Bell, Mail } from 'lucide-react';
import clsx from 'clsx';
import { Toaster, toast } from 'react-hot-toast';
import axios from 'axios';
import { cacheSingleton } from '../utils/db';
import { getProfilePicUrl, getProfilePicFallback } from '../utils/image';
import NotificationDropdown from '../components/NotificationDropdown';
import TouchTargetValidator from '../components/TouchTargetValidator';
import SafeAreaManager, { SafeAreaProvider, FixedElement } from '../components/SafeAreaManager';

const CadetLayout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    // Redirect to profile if not completed
    React.useEffect(() => {
        if (user && user.role === 'cadet' && !user.isProfileCompleted && location.pathname !== '/cadet/profile') {
            navigate('/cadet/profile', { replace: true });
        }
    }, [user, location.pathname, navigate]);

    React.useEffect(() => {
        try {
            const seen = localStorage.getItem('rgms_permissions_seen');
            if (!seen && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
                setShowPermissionModal(true);
            }
        } catch {}
    }, []);

    // Welcome & Guide States
    const [profile, setProfile] = useState(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [guideStep, setGuideStep] = useState(0);
    const [health, setHealth] = useState({ status: 'unknown' });
    const [badgeNotif, setBadgeNotif] = useState(0);
    const [badgeMsg, setBadgeMsg] = useState(0);
    const [notifHighlight, setNotifHighlight] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/cadet/notifications');
            const onlyBroadcasts = (res.data || []).filter(n => n && n.type === 'admin_broadcast');
            setNotifications(onlyBroadcasts);
            setBadgeNotif(onlyBroadcasts.length);
        } catch (err) { console.error(err); }
    };

    const fetchMessages = async () => {
        try {
            const res = await axios.get('/api/messages/my');
            const onlyAdminMessages = (res.data || []).filter(m => m && m.sender_role === 'admin');
            setMessages(onlyAdminMessages);
        } catch (err) { console.error(err); }
    };

    const handleMarkReadNotif = async (id) => {
        try {
            await axios.delete(`/api/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            setBadgeNotif(prev => Math.max(0, prev - 1));
        } catch (err) { console.error(err); }
    };

    const handleMarkReadMsg = async (id) => {
        try {
            await axios.delete(`/api/messages/${id}`).catch(() => {});
            await axios.delete(`/api/notifications/${id}`).catch(() => {});
            setMessages(prev => prev.filter(m => m.id !== id));
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) { console.error(err); }
    };

    const handleClearNotifs = async () => {
        try {
            await axios.delete('/api/cadet/notifications/delete-all');
            setNotifications([]);
            setBadgeNotif(0);
        } catch (err) { console.error(err); }
    };

    const handleClearMessages = async () => {
        try {
            await Promise.all(messages.map(m => axios.delete(`/api/messages/${m.id}`).catch(() => {})));
            await axios.delete('/api/cadet/notifications/delete-all').catch(() => {});
            setMessages([]);
            setNotifications([]);
        } catch (err) { console.error(err); }
    };

    React.useEffect(() => {
        if (user) {
            fetchNotifications();
            fetchMessages();
        }
    }, [user]);

    // Unified badge count on Messages icon: direct admin replies + broadcast announcements
    React.useEffect(() => {
        const count = (messages?.length || 0) + (notifications?.length || 0);
        setBadgeMsg(count);
    }, [messages, notifications]);

    const guideSteps = [
        {
            title: "Dashboard Overview",
            description: "Stay updated with the latest activities and announcements.",
            icon: CheckCircle
        },
        {
            title: "Profile Management",
            description: "Keep your personal information up to date.",
            icon: User
        },
        {
            title: "QR Code Attendance",
            description: "Use your unique QR code for quick attendance scanning during training.",
            icon: QrCode
        },
        {
            title: "Performance Tracking",
            description: "Monitor your grades, merits, and demerits in real-time.",
            icon: FileText
        }
    ];

    // Check for Guide on mount (if profile completed)
    React.useEffect(() => {
        const checkGuideStatus = async () => {
            if (user && user.isProfileCompleted) {
                try {
                    const profileRes = await axios.get('/api/cadet/profile');
                    setProfile(profileRes.data);
                    
                    if (profileRes.data && !profileRes.data.has_seen_guide) {
                        setShowWelcomeModal(true);
                    }
                } catch (err) {
                    console.error('Error fetching profile for guide:', err);
                }
            }
        };
        checkGuideStatus();
    }, [user]);

    React.useEffect(() => {
        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'admin_broadcast') {
                            fetchNotifications();
                            fetchMessages();
                            if (navigator.vibrate) navigator.vibrate(80);
                            setNotifHighlight(true);
                            setTimeout(() => setNotifHighlight(false), 1200);
                        } else if (data.type === 'grade_updated') {
                            toast.success('Grades updated');
                            axios.get('/api/cadet/my-grades').then(async res => {
                                await cacheSingleton('dashboard', 'cadet_grades', { data: res.data, timestamp: Date.now() });
                            }).catch(() => {});
                            axios.get('/api/cadet/my-merit-logs').then(async res => {
                                await cacheSingleton('dashboard', 'cadet_logs', { data: res.data, timestamp: Date.now() });
                            }).catch(() => {});
                        } else if (data.type === 'attendance_updated') {
                            const shouldPrefetch = !data.cadetId || (user && user.cadetId && data.cadetId === user.cadetId);
                            if (shouldPrefetch) {
                                axios.get('/api/attendance/my-history').then(async res => {
                                    await cacheSingleton('attendance_by_day', 'my_history', { data: res.data, timestamp: Date.now() });
                                }).catch(() => {});
                            }
                        } else if (data.type === 'cadet_profile_updated' && data.cadetId === user?.cadetId) {
                            // Re-fetch profile to update UI (like profile picture)
                            axios.get('/api/cadet/profile').then(res => {
                                setProfile(res.data);
                            }).catch(() => {});
                        }
                    } catch {}
                };
                es.onerror = () => {
                    if (es) es.close();
                    setTimeout(connect, 3000);
                };
            } catch {}
        };
        connect();
        return () => { try { es && es.close(); } catch {} };
    }, []);

    React.useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await axios.get('/api/health');
                setHealth(res.data || { status: 'ok', db: 'connected' });
            } catch (_) {
                setHealth({ status: 'ok', db: 'disconnected' });
            }
        };
        fetchHealth();
        const id = setInterval(fetchHealth, 20000);
        return () => clearInterval(id);
    }, []);

    const handleStartGuide = () => {
        setShowWelcomeModal(false);
        setShowGuideModal(true);
    };

    const handleSkipGuide = async () => {
        try {
            await axios.post('/api/cadet/acknowledge-guide');
            setShowWelcomeModal(false);
        } catch (err) {
            console.error("Error skipping guide:", err);
            setShowWelcomeModal(false);
        }
    };

    const handleNextGuideStep = () => {
        if (guideStep < guideSteps.length - 1) {
            setGuideStep(prev => prev + 1);
        } else {
            handleFinishGuide();
        }
    };

    const handleFinishGuide = async () => {
        try {
            await axios.post('/api/cadet/acknowledge-guide');
            setShowGuideModal(false);
            toast.success("You're all set! Welcome aboard.");
        } catch (err) {
            console.error("Error acknowledging guide:", err);
            setShowGuideModal(false);
        }
    };

    const handlePermissionsAccept = () => {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    () => {},
                    () => {},
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        } catch {}
        try {
            localStorage.setItem('rgms_permissions_seen', 'true');
        } catch {}
        setShowPermissionModal(false);
    };

    const handlePermissionsSkip = () => {
        try {
            localStorage.setItem('rgms_permissions_seen', 'true');
        } catch {}
        setShowPermissionModal(false);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Memoize the profile picture URL to avoid recalculation
    const profilePicSrc = useMemo(() => {
        return getProfilePicUrl(profile?.profile_pic, user?.cadetId);
    }, [profile?.profile_pic, user?.cadetId]);

    const renderProfileImage = () => {
        return (
            <img
                key={profilePicSrc}
                src={profilePicSrc}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                    e.target.src = getProfilePicFallback(user?.cadetId, 'cadets');
                }}
            />
        );
    };

    return (
        <SafeAreaProvider>
            <TouchTargetValidator autoCorrect={true} showWarnings={false}>
                <SafeAreaManager className="flex h-screen app-bg overflow-hidden">
                 <Toaster position="top-center" reverseOrder={false} />
                 {/* Mobile Sidebar Overlay */}
                 {isSidebarOpen && (
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                )}

                 {/* Sidebar - simplified for Cadet */}
                 <FixedElement 
                    position="left" 
                    respectSafeArea={true}
                    className={clsx(
                        "w-64 bg-[var(--primary-color)] text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                    )}
                >
                <div className="p-6 text-xl font-bold border-b border-white/10 flex justify-between items-center">
                    <span>ROTC Cadet</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-green-200 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                {/* User Info Section */}
                <div className="px-6 py-4 border-b border-white/10 flex flex-col items-center text-center">
                    <Link to="/cadet/profile" className="w-20 h-20 rounded-full bg-white mb-3 overflow-hidden border-2 border-yellow-400 shadow-md">
                        {renderProfileImage()}
                    </Link>
                    <div className="font-semibold text-sm text-yellow-400">
                        {profile ? `${profile.rank} ${profile.last_name}` : (user?.username || 'Cadet')}
                    </div>
                    {profile && <div className="text-xs text-green-200">{profile.first_name}</div>}
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        to="/cadet/home"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/cadet/home' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <HomeIcon size={20} />
                        <span>Home</span>
                    </Link>
                    <Link
                        to="/cadet/dashboard"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/cadet/dashboard' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <LayoutDashboard size={20} />
                        <span>My Portal</span>
                    </Link>
                    <Link
                        to="/cadet/achievements"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/cadet/achievements' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        <span>Achievements</span>
                    </Link>
                    <Link
                        to="/cadet/ask-admin"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/cadet/ask-admin' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <MessageSquare size={20} />
                        <span>Ask Admin</span>
                    </Link>
                    <Link
                        to="/cadet/about"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/cadet/about' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <Info size={20} />
                        <span>About</span>
                    </Link>
                    <Link
                        to="/cadet/settings"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/cadet/settings' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                    </Link>
                </nav>
                <div className="p-4 border-t border-green-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 p-3 w-full text-left text-green-200 hover:text-white hover:bg-green-800 rounded transition hover-highlight"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </FixedElement>

            <div className="flex-1 flex flex-col overflow-hidden">
                <FixedElement 
                    position="top" 
                    respectSafeArea={true}
                    className="bg-white shadow p-4 flex items-center justify-between"
                >
                    <div className="flex items-center">
                        <button 
                            onClick={toggleSidebar} 
                            className="mr-4 text-gray-600 hover:text-gray-900 md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">
                            {location.pathname.includes('/cadet/home') && 'Home'}
                            {location.pathname.includes('/cadet/dashboard') && 'My Portal'}
                            {location.pathname.includes('/cadet/profile') && 'My Profile'}
                            {location.pathname.includes('/cadet/about') && 'About'}
                        </h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <NotificationDropdown 
                            type="Messages" 
                            icon={Mail} 
                            count={badgeMsg}
                            notifications={[...notifications, ...messages].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))}
                            navigateToMessage="/cadet/ask-admin"
                            navigateToBroadcast="/cadet/broadcasts"
                            onMarkRead={handleMarkReadMsg}
                            onClear={handleClearMessages}
                        />
                    </div>
                </FixedElement>
                {(health && health.db === 'disconnected') && (
                    <div className="bg-yellow-600 text-white text-sm p-2 text-center">
                        Degraded mode: Database disconnected. Your changes will be limited until service restores.
                    </div>
                )}
                <SafeAreaManager 
                    className="flex-1 overflow-auto p-6"
                    enableKeyboardAdjustment={true}
                    enableScrollAdjustment={true}
                >
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div></div>}>
                        <Outlet />
                    </Suspense>
                </SafeAreaManager>
            </div>

            
            {/* Welcome Modal */}
            {showWelcomeModal && profile && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center animate-fade-in-up relative">
                        <button 
                            onClick={handleSkipGuide}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>
                        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <User size={40} className="text-green-700" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
                        <h3 className="text-xl font-semibold text-green-700 mb-4">
                            {profile.rank} {profile.first_name} {profile.last_name}
                        </h3>
                        <p className="text-gray-600 mb-8">
                            to MSU-SND ROTC Grading Management System
                        </p>
                        <button
                            onClick={handleStartGuide}
                            className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800 transition flex items-center justify-center mb-3 hover-highlight"
                        >
                            Start User Guide <ArrowRight size={20} className="ml-2" />
                        </button>
                        <button
                            onClick={handleSkipGuide}
                            className="w-full bg-white border border-gray-300 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-50 transition hover-highlight"
                        >
                            Skip Guide
                        </button>
                    </div>
                </div>
            )}

            {/* User Guide Modal */}
            {showGuideModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-8 relative animate-fade-in-up">
                        {/* Progress Dots */}
                        <div className="absolute top-6 right-8 flex space-x-2">
                            {guideSteps.map((_, idx) => (
                                <div 
                                    key={idx} 
                                    className={`w-2 h-2 rounded-full transition-all ${idx === guideStep ? 'bg-green-600 w-4' : 'bg-gray-300'}`}
                                />
                            ))}
                        </div>

                        <div className="mb-8 mt-4 text-center">
                            <div className="mx-auto w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                {React.createElement(guideSteps[guideStep].icon, { size: 48, className: "text-green-600" })}
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-4">{guideSteps[guideStep].title}</h3>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {guideSteps[guideStep].description}
                            </p>
                        </div>

                        <div className="flex justify-between items-center mt-8">
                            <button
                                onClick={() => {
                                    if (guideStep > 0) setGuideStep(prev => prev - 1);
                                    else setShowGuideModal(false);
                                }}
                                className={`text-gray-500 hover:text-gray-800 font-semibold px-4 py-2 ${guideStep === 0 ? 'invisible' : ''}`}
                            >
                                Back
                            </button>
                            <button
                                onClick={handleNextGuideStep}
                                className="bg-green-700 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-800 transition shadow-lg flex items-center"
                            >
                                {guideStep === guideSteps.length - 1 ? 'Get Started' : 'Next'}
                                {guideStep < guideSteps.length - 1 && <ChevronRight size={20} className="ml-1" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPermissionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Allow Location Access</h2>
                        <p className="text-sm text-gray-600 mb-3">
                            To show local weather advisories, this app requests access to your location. You may decline; we will use approximate location or defaults.
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            You can change location permission anytime in your browser or device settings.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={handlePermissionsSkip}
                                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover-highlight"
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                onClick={handlePermissionsAccept}
                                className="px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800 hover-highlight"
                            >
                                Allow location
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </TouchTargetValidator>
        </SafeAreaProvider>
    );
};

export default CadetLayout;
