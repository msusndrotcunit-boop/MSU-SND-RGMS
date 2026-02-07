import React, { useState } from 'react';
import axios from 'axios';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Home as HomeIcon, Settings, Lock, MessageCircle, HelpCircle, Bell, Mail } from 'lucide-react';
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
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);

    

    // Redirect to profile if not completed and trying to access other pages
    React.useEffect(() => {
        if (user && !user.isProfileCompleted && location.pathname !== '/staff/profile') {
            navigate('/staff/profile');
        }
    }, [user, location.pathname, navigate]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    React.useEffect(() => {
        axios.post('/api/staff/access').catch(() => {});
        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'ask_admin_reply') {
                            setBadgeNotif((b) => b + 1);
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
                "fixed inset-y-0 left-0 z-50 w-64 bg-green-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 text-xl font-bold border-b border-green-800 flex justify-between items-center">
                    <span>Training Staff</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-green-200 hover:text-white">
                        <X size={24} />
                    </button>
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
                            location.pathname === '/staff/home' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white",
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
                            location.pathname === '/staff/dashboard' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <LayoutDashboard size={20} />
                        <span>My Portal</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
                    </Link>

                    {/* Communication - Locked if profile incomplete */}
                    <Link
                        to={user?.isProfileCompleted ? "/staff/communication" : "#"}
                        onClick={(e) => {
                            if (!user?.isProfileCompleted) e.preventDefault();
                            setIsSidebarOpen(false);
                        }}
                        className={clsx(
                            "flex items-center space-x-3 p-3 rounded transition",
                            location.pathname === '/staff/communication' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white",
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
                            location.pathname === '/staff/ask-admin' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
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
                            location.pathname === '/staff/profile' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
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
                            location.pathname === '/staff/my-qr' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white",
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
                            location.pathname === '/staff/settings' ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white",
                            !user?.isProfileCompleted && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                        {!user?.isProfileCompleted && <Lock size={16} className="ml-auto" />}
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
                            className="text-green-900 focus:outline-none md:hidden mr-4"
                        >
                            <Menu size={24} />
                        </button>
                        <span className="font-bold text-green-900">Training Staff Portal</span>
                    </div>

                    <div className="hidden md:flex items-center space-x-4">
                        <button onClick={openMessages} className="relative text-gray-600 hover:text-green-700">
                            <Mail size={20} />
                            {badgeMsg > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{badgeMsg}</span>}
                        </button>
                        <button onClick={openNotifications} className="relative text-gray-600 hover:text-green-700">
                            <Bell size={20} />
                            {badgeNotif > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{badgeNotif}</span>}
                        </button>
                        {(notifOpen && notifications.length > 0) && (
                            <div className="absolute right-4 top-14 bg-white border rounded shadow w-80 z-50">
                                {notifications.map(n => (
                                    <div key={n.id} className="px-4 py-2 border-b last:border-b-0">
                                        <div className="text-sm text-gray-800">{n.message}</div>
                                        <div className="text-xs text-gray-400">{n.type}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(messageOpen && messages.length > 0) && (
                            <div className="absolute right-4 top-14 bg-white border rounded shadow w-80 z-50">
                                {messages.map(m => (
                                    <div key={m.id} className="px-4 py-2 border-b last:border-b-0">
                                        <div className="text-sm text-gray-800">{m.subject}</div>
                                        <div className="text-xs text-gray-400">{m.sender_role}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default StaffLayout;
