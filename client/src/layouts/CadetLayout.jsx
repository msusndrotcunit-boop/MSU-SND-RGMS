import React, { useState, Suspense } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Info, Home as HomeIcon, Settings, Bell, Check, ChevronRight, QrCode, FileText, CheckCircle, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

const CadetLayout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Notification State
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    // Redirect to profile if not completed
    React.useEffect(() => {
        if (user && user.role === 'cadet' && !user.isProfileCompleted && location.pathname !== '/cadet/profile') {
            navigate('/cadet/profile', { replace: true });
        }
    }, [user, location.pathname, navigate]);

    // Welcome & Guide States
    const [profile, setProfile] = useState(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [guideStep, setGuideStep] = useState(0);

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

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Notification Logic
    const isNotifRead = (n) => n.is_read === 1 || n.is_read === '1' || n.is_read === true;

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const res = await axios.get('/api/cadet/notifications', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(res.data);
            setUnreadCount(res.data.filter(n => !isNotifRead(n)).length);
        } catch (err) {
            console.error("Error fetching notifications", err);
        }
    };

    React.useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
            return () => clearInterval(interval);
        }
    }, [user]);

    const toggleNotifications = () => setShowNotifications(!showNotifications);

    const markAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/cadet/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Update local state
            setNotifications(notifications.filter(n => n.id !== id));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Error marking notification as read", err);
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/cadet/notifications/read-all', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Update local state
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error("Error marking all notifications as read", err);
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
             <Toaster position="top-right" reverseOrder={false} />
             {/* Mobile Sidebar Overlay */}
             {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

             {/* Sidebar - simplified for Cadet */}
             <div className={clsx(
                "fixed inset-y-0 left-0 z-50 w-64 bg-green-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 text-xl font-bold border-b border-green-800 flex justify-between items-center">
                    <span>ROTC Cadet</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-green-200 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        to="/cadet/home"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
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
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/cadet/dashboard' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <LayoutDashboard size={20} />
                        <span>My Portal</span>
                    </Link>
                    <Link
                        to="/cadet/profile"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/cadet/profile' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                        )}
                    >
                        <User size={20} />
                        <span>My Profile</span>
                    </Link>
                    <Link
                        to="/cadet/about"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
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
                            "flex items-center space-x-3 p-3 rounded transition",
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
                        className="flex items-center space-x-3 p-3 w-full text-left text-green-200 hover:text-white hover:bg-green-800 rounded transition"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow p-4 flex items-center justify-between">
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
                            {location.pathname.includes('/cadet/settings') && 'Settings'}
                        </h1>
                    </div>

                    {/* Notification Bell */}
                    <div className="relative mr-4">
                        <button 
                            onClick={toggleNotifications}
                            className="p-2 text-gray-600 hover:text-gray-900 relative"
                        >
                            <Bell size={24} />
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-20 border border-gray-200">
                                <div className="py-2">
                                    <div className="px-4 py-2 border-b border-gray-100 font-semibold text-gray-700 flex justify-between items-center">
                                        <span>Notifications</span>
                                        {unreadCount > 0 && (
                                            <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 font-normal">
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    {notifications.filter(n => !isNotifRead(n)).length === 0 ? (
                                        <div className="px-4 py-4 text-gray-500 text-sm text-center">No notifications</div>
                                    ) : (
                                        <div className="max-h-96 overflow-y-auto">
                                            {notifications.filter(n => !isNotifRead(n)).map(notif => {
                                                const isRead = isNotifRead(notif);
                                                return (
                                                    <div 
                                                        key={notif.id} 
                                                        onClick={(e) => !isRead && markAsRead(notif.id, e)}
                                                        className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isRead ? 'opacity-60' : 'bg-blue-50'}`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-sm text-gray-800">{notif.message}</p>
                                                            {!isRead && (
                                                                <button 
                                                                    onClick={(e) => markAsRead(notif.id, e)}
                                                                    className="text-blue-600 hover:text-blue-800 ml-2"
                                                                    title="Mark as read"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-6">
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div></div>}>
                        <Outlet />
                    </Suspense>
                </main>
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
                            className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800 transition flex items-center justify-center mb-3"
                        >
                            Start User Guide <ArrowRight size={20} className="ml-2" />
                        </button>
                        <button
                            onClick={handleSkipGuide}
                            className="w-full bg-white border border-gray-300 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-50 transition"
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
        </div>
    );
};

export default CadetLayout;
