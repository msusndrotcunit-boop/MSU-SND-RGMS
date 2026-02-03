import React, { useState, Suspense } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Info, Home as HomeIcon, Settings } from 'lucide-react';
import clsx from 'clsx';
import { Toaster } from 'react-hot-toast';

const CadetLayout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Redirect to profile if not completed
    React.useEffect(() => {
        if (user && user.role === 'cadet' && !user.isProfileCompleted && location.pathname !== '/cadet/profile') {
            navigate('/cadet/profile', { replace: true });
        }
    }, [user, location.pathname, navigate]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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
                <main className="flex-1 overflow-auto p-6">
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div></div>}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default CadetLayout;
