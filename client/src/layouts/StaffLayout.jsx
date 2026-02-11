import React, { useState } from 'react';
import axios from 'axios';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Home as HomeIcon, Settings, Lock, MessageCircle, HelpCircle, Bell, Mail, PieChart, Calendar } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import clsx from 'clsx';
import NotificationDropdown from '../components/NotificationDropdown';
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
    const [staffRole, setStaffRole] = useState(null);
    const [staffProfile, setStaffProfile] = useState(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/staff/notifications');
            setNotifications(res.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchMessages = async () => {
        try {
            const res = await axios.get('/api/messages/my');
            setMessages(res.data || []);
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
            await axios.delete('/api/staff/notifications/delete-all');
            setNotifications([]);
            setBadgeNotif(0);
        } catch (err) { console.error(err); }
    };

    const handleClearMessages = async () => {
        try {
            await Promise.all(messages.map(m => axios.delete(`/api/messages/${m.id}`).catch(() => {})));
            await axios.delete('/api/staff/notifications/delete-all').catch(() => {});
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

    // Unified badge count for Messages icon: direct messages + broadcast notifications
    React.useEffect(() => {
        const msgCount = (messages?.length || 0) + (notifications?.length || 0);
        setBadgeMsg(msgCount);
    }, [messages, notifications]);

    

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
                setStaffProfile(res.data);
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

    

    React.useEffect(() => {

        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'ask_admin_reply' || data.type === 'staff_chat' || data.type === 'cadet_notification' || data.type === 'admin_broadcast') {
                            fetchNotifications();
                            fetchMessages();
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
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xl font-bold">
                            {['Commandant', 'NSTP Director', 'Admin NCO', 'ROTC Coordinator'].includes(staffRole) 
                                ? 'Command Group' 
                                : 'Training Staff'}
                        </span>
                        <div className="flex items-center space-x-3">
                            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/80 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    
                    {staffProfile && (
                        <div className="flex flex-col items-center mt-4">
                            <Link to="/staff/profile" className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/50 mb-2 bg-gray-200">
                                <img 
                                    src={staffProfile.profile_pic || "https://via.placeholder.com/150?text=No+Image"} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {e.target.onerror = null; e.target.src = 'https://via.placeholder.com/150?text=No+Image'}}
                                />
                            </Link>
                            <h3 className="text-white font-semibold text-center text-lg">
                                {staffProfile.rank} {staffProfile.first_name} {staffProfile.last_name}
                            </h3>
                            <p className="text-white/70 text-sm text-center">{staffProfile.role}</p>
                        </div>
                    )}
                </div>
                <nav className="flex-1 p-3 md:p-4 space-y-1 md:space-y-2 overflow-y-auto text-sm md:text-base">
                    {/* Home - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/home" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                                    "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                                    "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                                    "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
                            location.pathname === '/staff/ask-admin' ? "bg-black/10 text-white" : "text-white/80 hover:bg-black/10 hover:text-white"
                        )}
                    >
                        <HelpCircle size={20} />
                        <span>Ask Admin</span>
                    </Link>

                    

                    {/* My QR Code - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/my-qr" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                            "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                        className="flex items-center space-x-3 p-3 w-full text-left text-white/80 hover:text-white hover:bg-black/10 rounded transition hover-highlight"
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

                    <div className="flex items-center space-x-4">
                        <NotificationDropdown 
                            type="Messages" 
                            icon={Mail} 
                            count={badgeMsg}
                            notifications={[...notifications, ...messages].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))}
                            navigateToMessage="/staff/ask-admin"
                            navigateToBroadcast="/staff/broadcasts"
                            onMarkRead={handleMarkReadMsg}
                            onClear={handleClearMessages}
                        />
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-950 p-4 md:p-8">
                    <Outlet />
                </main>

                
            </div>

            {showPermissionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Allow Location Access</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            To display local weather advisories, the app requests your location. You may decline; we will use approximate location or defaults.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            You can change location permission anytime in your browser or device settings.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={handlePermissionsSkip}
                                className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover-highlight"
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                onClick={handlePermissionsAccept}
                                className="px-4 py-2 text-sm rounded bg-[var(--primary-color)] text-white hover:opacity-90 hover-highlight"
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
