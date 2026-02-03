import React, { useState, Suspense, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Calendar, LogOut, UserCheck, User, Menu, X, ClipboardList, Calculator, UserCog, Bell, Check, Settings, QrCode, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';

const AdminLayout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [expandedMenus, setExpandedMenus] = useState({
        'Training Staff': true,
        'Grading Management': true
    });

    const toggleMenu = (label) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    // Helper to check if notification is read
    const isNotifRead = (n) => n.is_read === 1 || n.is_read === '1' || n.is_read === true;

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await axios.get('/api/admin/notifications', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(res.data);
            setUnreadCount(res.data.filter(n => !isNotifRead(n)).length);
        } catch (err) {
            console.error("Error fetching notifications", err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const markAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/admin/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update local state and recompute count robustly
            setNotifications(prev => {
                const next = prev.map(n => n.id === id ? { ...n, is_read: 1 } : n);
                const nextUnread = next.filter(n => !isNotifRead(n)).length;
                setUnreadCount(nextUnread);
                return next;
            });
        } catch (err) {
            console.error("Error marking read", err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put('/api/admin/notifications/read-all', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (err) {
            console.error(err);
        }
    };

    const toggleNotifications = () => {
        setShowNotifications(!showNotifications);
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const navItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/cadets', label: 'Cadet Management', icon: Users },
        { 
            label: 'Grading Management', 
            icon: Calculator,
            children: [
                { path: '/admin/grading', label: 'Grading' },
                { path: '/admin/attendance', label: 'Attendance' }
            ]
        },
        { 
            label: 'Training Staff', 
            icon: UserCog,
            children: [
                { path: '/admin/staff', label: 'Manage Staff' },
                { path: '/admin/staff-scanner', label: 'Staff Scanner' },
                { path: '/admin/staff-analytics', label: 'Analytics' }
            ]
        },
        { path: '/admin/activities', label: 'Activities', icon: Calendar },
        // { path: '/admin/approvals', label: 'Approvals', icon: UserCheck }, // Removed as approvals are automated via import
        { path: '/admin/profile', label: 'Profile', icon: User },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ];

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

            {/* Sidebar */}
            <div className={clsx(
                "fixed inset-y-0 left-0 z-50 w-64 bg-green-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 text-xl font-bold border-b border-green-800 flex justify-between items-center">
                    <span>ROTC Admin</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-green-200 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        
                        if (item.children) {
                            const isExpanded = expandedMenus[item.label];
                            const isActiveParent = item.children.some(child => location.pathname === child.path);
                            
                            return (
                                <div key={item.label}>
                                    <button
                                        onClick={() => toggleMenu(item.label)}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-3 rounded transition",
                                            isActiveParent ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Icon size={20} />
                                            <span>{item.label}</span>
                                        </div>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="ml-8 mt-1 space-y-1 border-l-2 border-green-700 pl-2">
                                            {item.children.map(child => {
                                                const isChildActive = location.pathname === child.path;
                                                return (
                                                    <Link
                                                        key={child.path}
                                                        to={child.path}
                                                        onClick={() => setIsSidebarOpen(false)}
                                                        className={clsx(
                                                            "block p-2 text-sm rounded transition",
                                                            isChildActive ? "text-white font-medium bg-green-800/50" : "text-green-300 hover:text-white"
                                                        )}
                                                    >
                                                        {child.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={clsx(
                                    "flex items-center space-x-3 p-3 rounded transition",
                                    isActive ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                                )}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
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

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow p-4 flex items-center">
                    <button 
                        onClick={toggleSidebar} 
                        className="mr-4 text-gray-600 hover:text-gray-900 md:hidden"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800 flex-1">
                        {navItems.find(i => i.path === location.pathname)?.label || 'Admin Panel'}
                    </h1>

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
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-4 text-gray-500 text-sm text-center">No notifications</div>
                                    ) : (
                                        <div className="max-h-96 overflow-y-auto">
                                            {notifications.map(notif => {
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
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div></div>}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
