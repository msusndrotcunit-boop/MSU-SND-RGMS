import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, User, LogOut, Menu, X, Info, Home as HomeIcon, Settings } from 'lucide-react';
import clsx from 'clsx';

const StaffLayout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
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
                <header className="bg-white shadow p-4 flex items-center md:hidden">
                    <button 
                        onClick={toggleSidebar}
                        className="text-green-900 focus:outline-none"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="ml-4 font-bold text-green-900">Training Staff Portal</span>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default StaffLayout;
