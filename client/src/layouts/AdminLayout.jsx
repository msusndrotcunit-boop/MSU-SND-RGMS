import React, { useState, Suspense, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
<<<<<<< HEAD
import { LayoutDashboard, Users, Calendar, LogOut, UserCheck, User, Menu, X, ClipboardList, Calculator, UserCog, Settings, QrCode, ChevronDown, ChevronRight, PieChart, MessageSquare, Search, Bell, Mail } from 'lucide-react';
=======
import { LayoutDashboard, Users, Calendar, LogOut, UserCheck, User, Menu, X, ClipboardList, Calculator, UserCog, Settings, QrCode, ChevronDown, ChevronRight, PieChart, MessageSquare, Bell, Search, Mail, Activity, AlertCircle } from 'lucide-react';
>>>>>>> d84a7e1793311a5b46d3a3dca2e515967d01d196
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
<<<<<<< HEAD
    const [health, setHealth] = useState({ status: 'unknown' });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
=======
    const [systemStatus, setSystemStatus] = useState(null);
    const [statusError, setStatusError] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState({ cadets: [], staff: [] });
    const [cadetsData, setCadetsData] = useState([]);
    const [staffData, setStaffData] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);
    const [badgeNotif, setBadgeNotif] = useState(0);
    const [badgeMsg, setBadgeMsg] = useState(0);
    const [notifHighlight, setNotifHighlight] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
>>>>>>> d84a7e1793311a5b46d3a3dca2e515967d01d196

    const toggleMenu = (label) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

<<<<<<< HEAD
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

=======
>>>>>>> d84a7e1793311a5b46d3a3dca2e515967d01d196
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await axios.get('/api/admin/system-status');
                setSystemStatus(res.data || null);
                setStatusError(false);
            } catch {
                setStatusError(true);
            }
        };
        fetchStatus();
        const id = setInterval(fetchStatus, 30000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [cad, stf] = await Promise.all([
                    axios.get('/api/admin/cadets'),
                    axios.get('/api/staff')
                ]);
                setCadetsData(cad.data || []);
                setStaffData(stf.data || []);
            } catch {}
        };
        loadData();
    }, []);

    useEffect(() => {
        try {
            const seen = localStorage.getItem('rgms_permissions_seen');
            if (!seen && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
                setShowPermissionModal(true);
            }
        } catch {}
    }, []);

    useEffect(() => {
        let es;
        const connect = () => {
            try {
                es = new EventSource('/api/attendance/events');
                es.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data || '{}');
                        if (data.type === 'portal_access') {
                            setBadgeNotif((b) => b + 1);
                        } else if (data.type === 'ask_admin_reply') {
                            setBadgeNotif((b) => b + 1);
                        }
                        if (data.type === 'portal_access' || data.type === 'ask_admin_reply') {
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

    useEffect(() => {
        if (!searchQuery) {
            setSearchResults({ cadets: [], staff: [] });
            return;
        }
        const q = searchQuery.toLowerCase();
        const cad = cadetsData.filter(c => {
            const name = `${c.rank} ${c.first_name} ${c.last_name}`.toLowerCase();
            return name.includes(q) || (c.student_id || '').toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q);
        }).slice(0, 5);
        const stf = staffData.filter(s => {
            const name = `${s.rank} ${s.first_name} ${s.last_name}`.toLowerCase();
            return name.includes(q) || (s.afpsn || '').toLowerCase().includes(q) || (s.username || '').toLowerCase().includes(q);
        }).slice(0, 5);
        setSearchResults({ cadets: cad, staff: stf });
    }, [searchQuery, cadetsData, staffData]);

    const openNotifications = async () => {
        setNotifOpen((o) => !o);
        try {
            const res = await axios.get('/api/admin/notifications');
            setNotifications(res.data || []);
            setBadgeNotif(0);
            await axios.delete('/api/admin/notifications/delete-all');
        } catch {}
    };

    const openMessages = async () => {
        setMessageOpen((o) => !o);
        try {
            const res = await axios.get('/api/messages');
            setMessages(res.data || []);
            setBadgeMsg(0);
            await Promise.all((res.data || []).map(m => axios.delete(`/api/messages/${m.id}`)));
        } catch {}
    };
    

    const handleLogout = () => {
        logout();
        navigate('/login');
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
        { path: '/admin/profile', label: 'Profile', icon: User },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen app-bg overflow-hidden dark:bg-gray-900 dark:text-gray-100">
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
                                            isActiveParent ? "bg-black/15 text-white" : "text-white/80 hover:bg-black/10 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Icon size={20} />
                                            <span>{item.label}</span>
                                        </div>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    
                                        {isExpanded && (
                                        <div className="ml-8 mt-1 space-y-1 border-l-2 border-white/20 pl-2">
                                            {item.children.map(child => {
                                                const isChildActive = location.pathname === child.path;
                                                return (
                                                    <Link
                                                        key={child.path}
                                                        to={child.path}
                                                        onClick={() => setIsSidebarOpen(false)}
                                                        className={clsx(
                                                            "block p-2 text-sm rounded transition",
                                                            isChildActive ? "text-white font-medium bg-black/20" : "text-white/80 hover:text-white"
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
                                    isActive ? "bg-black/15 text-white" : "text-white/80 hover:bg-black/10 hover:text-white"
                                )}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 p-3 w-full text-left text-white/80 hover:text-white hover:bg-black/20 rounded transition"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
<<<<<<< HEAD
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
=======
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-gray-800 shadow p-4 flex items-center">
                    <button 
                        onClick={toggleSidebar} 
                        className="mr-4 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white md:hidden"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="text-sm md:text-xl font-semibold text-gray-800 dark:text-gray-100 flex-1 truncate">
                        {navItems.find(i => i.path === location.pathname)?.label || 'Admin Panel'}
                    </h1>

                    <div className="flex items-center space-x-2 md:space-x-4">
                        <div className="relative">
                            <div className="flex items-center border rounded-md px-2 py-1 md:px-3 md:py-2 w-32 md:w-64 focus-within:ring-2 focus-within:ring-[var(--primary-color)] dark:border-gray-700">
                                <Search size={18} className="text-gray-400 dark:text-gray-300 mr-2" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchOpen(true)}
                                    onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                    placeholder="Search..."
                                    className="w-full outline-none text-xs md:text-sm bg-transparent dark:text-gray-100"
                                />
                            </div>
                            {searchOpen && (searchResults.cadets.length > 0 || searchResults.staff.length > 0) && (
                                <div className="absolute mt-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow w-64 z-50">
                                    {searchResults.cadets.map(c => (
                                        <Link key={`c-${c.id}`} to={`/admin/cadets`} className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                                            {c.rank} {c.first_name} {c.last_name} • {c.student_id}
                                        </Link>
                                    ))}
                                    {searchResults.staff.map(s => (
                                        <Link key={`s-${s.id}`} to={`/admin/staff`} className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                                            {s.rank} {s.first_name} {s.last_name} • {s.afpsn || 'N/A'}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={openMessages} className="relative text-gray-600 dark:text-gray-200 hover:text-[var(--primary-color)]">
                            <Mail size={20} />
                            {badgeMsg > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{badgeMsg}</span>}
                        </button>
                        <button 
                            onClick={openNotifications} 
                            className={clsx(
                                "relative transition-colors",
                                notifHighlight ? "text-[var(--primary-color)]" : "text-gray-600 dark:text-gray-200 hover:text-[var(--primary-color)]"
                            )}
                        >
                            <Bell size={20} />
                            {badgeNotif > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{badgeNotif}</span>}
                        </button>
                        {(notifOpen && notifications.length > 0) && (
                            <div className="absolute right-4 top-14 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow w-80 z-50">
                                {notifications.map(n => (
                                    <div key={n.id} className="px-4 py-2 border-b last:border-b-0">
                                        <div className="text-sm text-gray-800 dark:text-gray-100">{n.message}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-400">{n.type}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(messageOpen && messages.length > 0) && (
                            <div className="absolute right-4 top-14 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow w-80 z-50">
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
                {(() => {
                    const appStatus = systemStatus && systemStatus.app ? systemStatus.app.status : 'unknown';
                    const dbStatus = systemStatus && systemStatus.database ? systemStatus.database.status : 'unknown';
                    const metrics = systemStatus && systemStatus.metrics ? systemStatus.metrics : {};
                    const hasIssue = statusError || appStatus === 'error' || dbStatus === 'error' || appStatus === 'degraded';
                    const bgClass = hasIssue ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800';
                    const iconClass = hasIssue ? 'text-red-600' : 'text-green-600';
                    const label = hasIssue ? 'System alerts detected' : 'System operating normally';
                    const updated = systemStatus && systemStatus.app && systemStatus.app.time ? new Date(systemStatus.app.time) : null;
                    if (!systemStatus && !statusError) return null;
                    return (
                        <div className={clsx('text-xs md:text-sm px-3 py-2 border-b flex flex-wrap items-center gap-3', bgClass)}>
                            <div className="flex items-center gap-2 mr-2">
                                {hasIssue ? <AlertCircle size={14} className={iconClass} /> : <Activity size={14} className={iconClass} />}
                                <span className="font-semibold">{label}</span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <span>App: <span className="font-semibold capitalize">{appStatus}</span></span>
                                <span>DB: <span className="font-semibold capitalize">{dbStatus}</span></span>
                                {typeof metrics.cadets === 'number' && <span>Cadets: <span className="font-semibold">{metrics.cadets}</span></span>}
                                {typeof metrics.users === 'number' && <span>Users: <span className="font-semibold">{metrics.users}</span></span>}
                                {typeof metrics.trainingDays === 'number' && <span>Training days: <span className="font-semibold">{metrics.trainingDays}</span></span>}
                                {typeof metrics.activities === 'number' && <span>Activities: <span className="font-semibold">{metrics.activities}</span></span>}
                                {typeof metrics.unreadNotifications === 'number' && <span>Unread notif: <span className="font-semibold">{metrics.unreadNotifications}</span></span>}
                                {updated && <span>Updated: <span className="font-mono">{updated.toLocaleTimeString()}</span></span>}
                                {statusError && <span className="font-semibold">Status API unreachable</span>}
                            </div>
                        </div>
                    );
                })()}
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)]"></div></div>}>
                        <Outlet />
                    </Suspense>
                        
>>>>>>> d84a7e1793311a5b46d3a3dca2e515967d01d196
                </main>
            </div>

            {showPermissionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Allow App Permissions</h2>
                        <p className="text-sm text-gray-600 mb-3">
                            This app uses your device location for weather and safety checks, and your camera or file uploads for excuse letters and other documents.
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            You can change these permissions anytime in your browser or device settings.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={handlePermissionsSkip}
                                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                onClick={handlePermissionsAccept}
                                className="px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800"
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

export default AdminLayout;
