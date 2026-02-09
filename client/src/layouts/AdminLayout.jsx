import React, { useState, Suspense, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Calendar, LogOut, UserCheck, User, Menu, X, ClipboardList, Calculator, UserCog, Settings, QrCode, ChevronDown, ChevronRight, PieChart, MessageSquare, Search, Bell, Mail } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';
import Footer from '../components/Footer';
import NotificationDropdown from '../components/NotificationDropdown';

const AdminLayout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState({
        'Training Staff': true,
        'Grading Management': true
    });
    const [health, setHealth] = useState({ status: 'unknown' });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadMessages, setUnreadMessages] = useState(0);

    const toggleMenu = (label) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await axios.get('/api/notifications');
                setNotifications(res.data);
            } catch (err) {
                console.error("Error fetching notifications:", err);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length > 2) {
                try {
                    const res = await axios.get(`/api/admin/search?query=${searchQuery}`);
                    setSearchResults(res.data);
                    setIsSearchOpen(true);
                } catch (error) {
                    console.error("Search failed", error);
                }
            } else {
                setSearchResults([]);
                setIsSearchOpen(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleMarkRead = async (id) => {
        try {
            await axios.delete(`/api/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error("Error deleting notification:", err);
        }
    };

    const handleClearAll = async (typeCategory) => {
        const toDelete = typeCategory === 'Messages' 
            ? notifications.filter(n => n.type === 'staff_chat' || n.type === 'ask_admin')
            : notifications.filter(n => n.type !== 'staff_chat' && n.type !== 'ask_admin');
        
        for (const n of toDelete) {
            await handleMarkRead(n.id);
        }
    };

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await axios.get('/api/health');
                setHealth(res.data || { status: 'ok', db: 'connected' });
            } catch (_) {
                setHealth({ status: 'ok', db: 'disconnected' });
            }
        };
        fetchHealth();
        const id = setInterval(fetchHealth, 15000);
        return () => clearInterval(id);
    }, []);

    

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Removed manual toggle and buttons; notifications auto-show and auto-hide

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Filter logic for Footer
    const shouldShowFooter = !['/admin/profile', '/admin/settings'].some(path => location.pathname.includes(path)) && !location.pathname.includes('/about');

    const navItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/data-analysis', label: 'Data Analysis', icon: PieChart },
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
        { path: '/admin/messages', label: 'Messages', icon: MessageSquare },
        // { path: '/admin/approvals', label: 'Approvals', icon: UserCheck }, // Removed as approvals are automated via import
        { path: '/admin/profile', label: 'Profile', icon: User },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ];

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
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <header className="bg-white shadow p-3 flex items-center justify-between z-10">
                    <div className="flex items-center flex-1">
                        <button 
                            onClick={toggleSidebar} 
                            className="mr-4 text-gray-600 hover:text-gray-900 md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        
                        {/* Search Bar - Uppermost Corner */}
                        <div className="relative hidden md:flex items-center w-96 ml-4">
                            <Search className="absolute left-3 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search cadets, staff..." 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery.length > 2 && setIsSearchOpen(true)}
                                onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                            />
                            {/* Search Results Dropdown */}
                            {isSearchOpen && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200 max-h-96 overflow-y-auto">
                                    {searchResults.map((result) => (
                                        <div 
                                            key={`${result.type}-${result.id}`}
                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                                            onClick={() => {
                                                navigate(result.type === 'cadet' ? `/admin/cadets` : `/admin/staff`);
                                                setSearchQuery('');
                                                setIsSearchOpen(false);
                                            }}
                                        >
                                            <div>
                                                <div className="font-medium text-gray-800">
                                                    {result.last_name}, {result.first_name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {result.rank} • {result.sub_info}
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${result.type === 'cadet' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                {result.type === 'cadet' ? 'Cadet' : 'Staff'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side Icons */}
                    <div className="flex items-center space-x-4 mr-4">
                        <NotificationDropdown 
                            type="Messages" 
                            icon={Mail} 
                            count={notifications.filter(n => n.type === 'staff_chat' || n.type === 'ask_admin').length}
                            notifications={notifications.filter(n => n.type === 'staff_chat' || n.type === 'ask_admin')}
                            onMarkRead={handleMarkRead}
                            onClear={() => handleClearAll('Messages')}
                        />
                        
                        <NotificationDropdown 
                            type="Notifications" 
                            icon={Bell} 
                            count={notifications.filter(n => n.type !== 'staff_chat' && n.type !== 'ask_admin').length}
                            notifications={notifications.filter(n => n.type !== 'staff_chat' && n.type !== 'ask_admin')}
                            onMarkRead={handleMarkRead}
                            onClear={() => handleClearAll('Notifications')}
                        />

                        <div className="hidden md:block h-8 w-px bg-gray-300 mx-2"></div>
                        
                        <div className="flex items-center">
                            <span className="text-sm font-semibold text-gray-700 mr-2 hidden md:block">Admin</span>
                            <div className="h-8 w-8 rounded-full bg-green-700 text-white flex items-center justify-center font-bold">
                                A
                            </div>
                        </div>
                    </div>
                </header>

                {(health && health.db === 'disconnected') && (
                    <div className="bg-red-600 text-white text-sm p-2 text-center">
                        Degraded mode: Database disconnected. Writes are queued; some features may be limited.
                    </div>
                )}
                <main className="flex-1 overflow-auto p-4 md:p-6 flex flex-col">
                    <div className="flex-grow">
                        <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div></div>}>
                            <Outlet />
                        </Suspense>
                    </div>
                    {shouldShowFooter && <Footer />}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
