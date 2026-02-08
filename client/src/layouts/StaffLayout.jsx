import React, { useState } from 'react';
import axios from 'axios';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Home as HomeIcon, Settings, Lock, MessageCircle, HelpCircle, Bell, Mail, PieChart, Calendar, MapPin } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import clsx from 'clsx';
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const StaffLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [badgeNotif, setBadgeNotif] = useState(0);
    const [badgeMsg, setBadgeMsg] = useState(0);
    const [notifHighlight, setNotifHighlight] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);
    const [staffRole, setStaffRole] = useState(null);
    const [hasAutoSharedLocation, setHasAutoSharedLocation] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    

    // Redirect to profile if not completed and trying to access other pages
    React.useEffect(() => {
        if (user && !user.isProfileCompleted && location.pathname !== '/staff/profile') {
            navigate('/staff/profile');
        }
    }, [user, location.pathname, navigate]);

    React.useEffect(() => {
        const fetchStaffRole = async () => {
            try {
                const res = await axios.get('/api/staff/me');
                setStaffRole(res.data?.role || null);
            } catch {}
        };
        fetchStaffRole();
    }, []);

    React.useEffect(() => {
        try {
            const seen = localStorage.getItem('rgms_permissions_seen');
            if (!seen && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
                setShowPermissionModal(true);
            }
        } catch {}
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const isPrivilegedStaff =
        staffRole === 'Commandant' ||
        staffRole === 'Assistant Commandant' ||
        staffRole === 'NSTP Director' ||
        staffRole === 'ROTC Coordinator' ||
        staffRole === 'Admin NCO';

    const shareLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Location is not supported on this device.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await axios.post('/api/auth/location', {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    });
                    toast.success('Location shared successfully.');
                } catch (e) {
                    toast.error('Failed to share location.');
                }
            },
            () => {
                toast.error('Location permission denied.');
            }
        );
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
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then(stream => {
                        try {
                            stream.getTracks().forEach(t => t.stop());
                        } catch {}
                    })
                    .catch(() => {});
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

    React.useEffect(() => {
        if (!isPrivilegedStaff || hasAutoSharedLocation) return;
        shareLocation();
        setHasAutoSharedLocation(true);
    }, [isPrivilegedStaff, hasAutoSharedLocation]);

    React.useEffect(() => {
        axios.post('/api/staff/access').catch(() => {});

        const fetchInitialCounts = async () => {
            try {
                const [notifRes, msgRes] = await Promise.all([
                    axios.get('/api/staff/notifications'),
                    axios.get('/api/messages/my')
                ]);
                setBadgeNotif((notifRes.data || []).length || 0);
                setBadgeMsg((msgRes.data || []).length || 0);
            } catch {}
        };

        fetchInitialCounts();

        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'ask_admin_reply') {
                            setBadgeNotif((b) => b + 1);
                            if (navigator.vibrate) navigator.vibrate(80);
                            setNotifHighlight(true);
                            setTimeout(() => setNotifHighlight(false), 1200);
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

    const openNotifications = async () => {
        setNotifOpen((o) => !o);
        try {
            const res = await axios.get('/api/staff/notifications');
            setNotifications(res.data || []);
            setBadgeNotif(0);
            await axios.delete('/api/staff/notifications/delete-all');
        } catch {}
    };

    const openMessages = async () => {
        setMessageOpen((o) => !o);
        try {
            const res = await axios.get('/api/messages/my');
            setMessages(res.data || []);
            setBadgeMsg(0);
            await Promise.all((res.data || []).map(m => axios.delete(`/api/messages/${m.id}`)));
        } catch {}
    };
    

    

    

    // Removed manual toggle and buttons; notifications auto-show and auto-hide
    
    return (
        <div className="flex h-screen app-bg overflow-hidden">
            <Toaster position="top-right" reverseOrder={false} />
             {/* Mobile Sidebar Overlay */}
             {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

             {/* Sidebar */}
             <div className={clsx(
                "fixed inset-y-0 left-0 z-50 w-64 bg-[var(--primary-color)] text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 text-xl font-bold border-b border-white/10 flex justify-between items-center">
                    <span>Training Staff</span>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={shareLocation}
                            className="text-[var(--primary-color)] bg-white/90 hover:bg-white text-xs border border-white px-2 py-1 rounded-full flex items-center space-x-1"
                        >
                            <MapPin size={14} />
                            <span>Share Location</span>
                        </button>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/80 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {/* Home - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/home" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/home' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <HomeIcon size={20} />
                        <span>Home</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                    </Link>

                    {/* My Portal - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/dashboard" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/dashboard' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <LayoutDashboard size={20} />
                        <span>My Portal</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                    </Link>

                    {isPrivilegedStaff && (
                        <>
                            <Link
                                to={user?.isProfileCompleted ? "/staff/unit-dashboard" : "#"}
                                onClick={(e) => {
                                    if (!user?.isProfileCompleted) e.preventDefault();
                                    setIsSidebarOpen(false);
                                }}
                                className={clsx(
                                    "flex items-center space-x-3 p-3 rounded transition",
                                    location.pathname === '/staff/unit-dashboard' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                                    !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <LayoutDashboard size={20} />
                                <span>Unit Dashboard</span>
                                {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                            </Link>

                            <Link
                                to={user?.isProfileCompleted ? "/staff/data-analysis" : "#"}
                                onClick={(e) => {
                                    if (!user?.isProfileCompleted) e.preventDefault();
                                    setIsSidebarOpen(false);
                                }}
                                className={clsx(
                                    "flex items-center space-x-3 p-3 rounded transition",
                                    location.pathname === '/staff/data-analysis' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                                    !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <PieChart size={20} />
                                <span>Data Analysis</span>
                                {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                            </Link>

                            <Link
                                to={user?.isProfileCompleted ? "/staff/activities" : "#"}
                                onClick={(e) => {
                                    if (!user?.isProfileCompleted) e.preventDefault();
                                    setIsSidebarOpen(false);
                                }}
                                className={clsx(
                                    "flex items-center space-x-3 p-3 rounded transition",
                                    location.pathname === '/staff/activities' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                                    !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <Calendar size={20} />
                                <span>Activities</span>
                                {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                            </Link>
                        </>
                    )}

                    {/* Communication - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/communication" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/communication' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <MessageCircle size={20} />
                        <span>Communication</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                    </Link>

                    {/* Ask Admin - Always Accessible or Locked? Let's keep it accessible or locked? Usually reporting bugs should be accessible even if profile incomplete?
                        But consistent with other items, let's keep it accessible or locked.
                        User said "users to be able to ask and report bugs and issues".
                        If they can't complete profile due to bug, they need this.
                        So it should be ALWAYS ACCESSIBLE.
                    */}
                    <Link
                        to="/staff/ask-admin"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/ask-admin' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white"
                        )}
                    >
                        <HelpCircle size={20} />
                        <span>Ask Admin</span>
                    </Link>

                    {/* Profile - Always Accessible */}
                    <Link
                        to="/staff/profile"
                        onClick={() => setIsSidebarOpen(false)}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/profile' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white"
                        )}
                    >
                        <User size={20} />
                        <span>My Profile</span>
                        {!user?.isProfileCompleted && <div className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    </Link>

                    {/* My QR Code - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/my-qr" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/my-qr' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <User size={20} />
                        <span>My QR Code</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                    </Link>

                    {/* Settings - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/settings" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/settings' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                    </Link>
                </nav>
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 p-3 w-full text-left text-white/80 hover:text-white hover:bg-black/10 rounded transition"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-gray-900 shadow p-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <button 
                            onClick={toggleSidebar}
                            className="text-[var(--primary-color)] focus:outline-none md:hidden mr-4"
                        >
                            <Menu size={24} />
                        </button>
                        <span className="font-bold text-gray-900 dark:text-gray-100">Training Staff Portal</span>
                    </div>

                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button onClick={openMessages} className="relative text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)]">
                            <Mail size={20} />
                            {badgeMsg > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{badgeMsg}</span>}
                        </button>
                        <button 
                            onClick={openNotifications} 
                            className={clsx(
                                "relative transition-colors",
                                notifHighlight ? "text-[var(--primary-color)]" : "text-gray-600 dark:text-gray-300 hover:text-[var(--primary-color)]"
                            )}
                        >
                            <Bell size={20} />
                            {badgeNotif > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{badgeNotif}</span>}
                        </button>
                        {(notifOpen && notifications.length > 0) && (
                            <div className="absolute right-4 top-14 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow w-80 z-50">
                                {notifications.map(n => (
                                    <div key={n.id} className="px-4 py-2 border-b last:border-b-0">
                                        <div className="text-sm text-gray-800 dark:text-gray-100">{n.message}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-400">{n.type}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(messageOpen && messages.length > 0) && (
                            <div className="absolute right-4 top-14 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow w-80 z-50">
                                {messages.map(m => (
                                    <div key={m.id} className="px-4 py-2 border-b last:border-b-0">
                                        <div className="text-sm text-gray-800 dark:text-gray-100">{m.subject}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-400">{m.sender_role}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-950 p-4 md:p-8">
                    <Outlet />
                </main>

                {isPrivilegedStaff &&
                    user?.isProfileCompleted &&
                    !['/staff/communication', '/staff/profile', '/staff/settings'].includes(location.pathname) && (
                    <div className="border-t bg-white dark:bg-gray-900 px-3 py-2 md:px-6 md:py-3 flex items-center gap-2 md:gap-4">
                        <Link
                            to="/staff/unit-dashboard"
                            className="flex-1 flex items-center justify-center bg-[var(--primary-color)] text-white text-xs md:text-sm rounded-full px-3 py-2 hover:opacity-90 transition-colors"
                        >
                            <LayoutDashboard size={16} className="mr-1" />
                            <span className="hidden sm:inline">Unit Dashboard</span>
                            <span className="sm:hidden">Unit</span>
                        </Link>
                        <Link
                            to="/staff/data-analysis"
                            className="flex-1 flex items-center justify-center bg-[var(--primary-color)]/90 text-white text-xs md:text-sm rounded-full px-3 py-2 hover:opacity-90 transition-colors"
                        >
                            <PieChart size={16} className="mr-1" />
                            <span className="hidden sm:inline">Data Analysis</span>
                            <span className="sm:hidden">Data</span>
                        </Link>
                        <Link
                            to="/staff/activities"
                            className="flex-1 flex items-center justify-center bg-yellow-400 text-[var(--primary-color)] text-xs md:text-sm font-semibold rounded-full px-3 py-2 hover:bg-yellow-300 transition-colors"
                        >
                            <Calendar size={16} className="mr-1" />
                            <span className="hidden sm:inline">Activities</span>
                            <span className="sm:hidden">Acts</span>
                        </Link>
                        <button
                            onClick={shareLocation}
                            onClick={shareLocation}
                            className="flex items-center justify-center bg-white dark:bg-gray-900 text-[var(--primary-color)] text-xs md:text-sm rounded-full px-3 py-2 border border-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-colors"
                        >
                            <MapPin size={16} className="mr-1" />
                            <span className="hidden sm:inline">Share Location</span>
                            <span className="sm:hidden">Location</span>
                        </button>
                    </div>
                )}
            </div>

            {showPermissionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Allow App Permissions</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            This app uses your device location for weather and safety checks, and your camera or file uploads for excuse letters and other documents.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            You can change these permissions anytime in your browser or device settings.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={handlePermissionsSkip}
                                className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                onClick={handlePermissionsAccept}
                                className="px-4 py-2 text-sm rounded bg-[var(--primary-color)] text-white hover:opacity-90"
                            >
                                Allow permissions
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffLayout;
