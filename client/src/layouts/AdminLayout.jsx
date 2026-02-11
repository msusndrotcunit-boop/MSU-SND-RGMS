import React, { useState, Suspense, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Calendar, LogOut, UserCheck, User, Menu, X, ClipboardList, Calculator, UserCog, Settings, QrCode, ChevronDown, ChevronRight, PieChart, MessageSquare, Bell, Search, Mail, Activity, AlertCircle } from 'lucide-react';
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
    const [systemStatus, setSystemStatus] = useState(null);
    const [statusError, setStatusError] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState({ cadets: [], staff: [] });
    const [cadetsData, setCadetsData] = useState([]);
    const [staffData, setStaffData] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);
    const [badgeNotif, setBadgeNotif] = useState(0);
    const [badgeMsg, setBadgeMsg] = useState(0);
    const [notifHighlight, setNotifHighlight] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [adminProfile, setAdminProfile] = useState(null);

    const toggleMenu = (label) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/admin/notifications');
            setNotifications(res.data || []);
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    };

    const fetchMessages = async () => {
        try {
            const res = await axios.get('/api/messages');
            setMessages(res.data || []);
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    const handleMarkReadNotif = async (id) => {
        try {
            await axios.delete(`/api/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            setBadgeNotif(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Error deleting notification:", err);
        }
    };

    const handleMarkReadMsg = async (id) => {
        try {
            await axios.delete(`/api/messages/${id}`);
            setMessages(prev => prev.filter(m => m.id !== id));
            setBadgeMsg(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Error deleting message:", err);
        }
    };

    const handleClearNotifs = async () => {
        try {
            await axios.delete('/api/admin/notifications');
            setNotifications([]);
            setBadgeNotif(0);
        } catch (err) {
            console.error("Error clearing notifications:", err);
        }
    };

    const handleClearMessages = async () => {
        try {
            const ids = messages.map(m => m.id);
            await Promise.all(ids.map(id => axios.delete(`/api/messages/${id}`)));
            setMessages([]);
            setBadgeMsg(0);
        } catch (err) {
            console.error("Error clearing messages:", err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        fetchMessages();
    }, []);

    useEffect(() => {
        axios.get('/api/admin/profile').then(res => {
            setAdminProfile(res.data || null);
        }).catch(() => {});
    }, []);
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
                        if (data.type === 'portal_access' || data.type === 'ask_admin_reply' || data.type === 'ask_admin' || data.type === 'staff_chat' || data.type === 'cadet_notification') {
                            fetchNotifications();
                            fetchMessages();
                            if (data.type === 'ask_admin' || data.type === 'staff_chat') {
                                setBadgeMsg(b => b + 1);
                            } else {
                                setBadgeNotif(b => b + 1);
                            }
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
    const shouldShowFooter = location.pathname === '/admin/dashboard';

    const navItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/data-analysis', label: 'Data Analysis', icon: PieChart },
        { path: '/admin/cadets', label: 'Cadet Management', icon: Users },
        { path: '/admin/archived-cadets', label: 'Archived Cadets', icon: UserCheck },
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
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    const getAvatarSrc = () => {
        if (!adminProfile || !adminProfile.profile_pic) return null;
        const raw = adminProfile.profile_pic;
        if (raw.startsWith('data:') || raw.startsWith('http')) return raw;
        
        let normalizedPath = raw.replace(/\\/g, '/');
        const uploadsIndex = normalizedPath.indexOf('/uploads/');
        if (uploadsIndex !== -1) {
            normalizedPath = normalizedPath.substring(uploadsIndex);
        } else if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        const baseA = (axios && axios.defaults && axios.defaults.baseURL) || '';
        const baseB = import.meta.env.VITE_API_URL || '';
        const baseC = (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin)) ? window.location.origin : '';
        const selectedBase = [baseA, baseB, baseC].find(b => b && /^https?:/.test(b)) || '';
        
        return selectedBase ? `${selectedBase.replace(/\/+$/,'')}${normalizedPath}` : normalizedPath;
    };

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
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => navigate('/admin/broadcasts')}
                            className="text-xl font-bold hover:underline"
                            title="Open ROTC Admin Broadcast"
                        >
                            ROTC Admin
                        </button>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-green-200 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="flex items-center mt-3">
                        <Link to="/admin/profile">
                            {adminProfile && adminProfile.profile_pic ? (
                                <img 
                                    src={getAvatarSrc()} 
                                    alt="Profile" 
                                    className="h-10 w-10 rounded-full border border-white/20 object-cover" 
                                    onError={(e) => { 
                                        e.target.onerror = null; 
                                        e.target.src = '/assets/default-avatar.png'; 
                                    }}
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-green-700 text-white flex items-center justify-center font-bold">
                                    {(adminProfile && adminProfile.username ? adminProfile.username.charAt(0) : 'A').toUpperCase()}
                                </div>
                            )}
                        </Link>
                        <div className="ml-3">
                            <div className="text-white font-semibold text-sm">{(adminProfile && adminProfile.username) || 'Admin'}</div>
                        </div>
                    </div>
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
                                            "w-full flex items-center justify-between p-3 rounded transition hover-highlight",
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
                                                            "block p-2 text-sm rounded transition hover-highlight",
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
                                    "flex items-center space-x-3 p-3 rounded transition hover-highlight",
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
                        className="flex items-center space-x-3 p-3 w-full text-left text-white/80 hover:text-white hover:bg-black/20 rounded transition hover-highlight"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <header className="bg-white dark:bg-gray-800 shadow p-4 flex items-center justify-between z-10">
                    <div className="flex items-center flex-1">
                        <button 
                            onClick={toggleSidebar} 
                            className="mr-4 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        
                        {/* Search Bar */}
                        <div className="relative hidden md:flex items-center w-96 ml-4">
                            <Search className="absolute left-3 text-gray-400 dark:text-gray-300" size={18} />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                placeholder="Search cadets, staff..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent text-sm"
                            />
                            {/* Search Results Dropdown */}
                            {searchOpen && (searchResults.cadets.length > 0 || searchResults.staff.length > 0) && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                                    {searchResults.cadets.map(c => (
                                        <Link key={`c-${c.id}`} to={`/admin/cadets`} className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 hover-highlight">
                                            <div className="font-medium">{c.rank} {c.first_name} {c.last_name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{c.student_id}</div>
                                        </Link>
                                    ))}
                                    {searchResults.staff.map(s => (
                                        <Link key={`s-${s.id}`} to={`/admin/staff`} className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 hover-highlight">
                                            <div className="font-medium">{s.rank} {s.first_name} {s.last_name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{s.afpsn || 'N/A'}</div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side Icons */}
                    <div className="flex items-center space-x-5 mr-2">
                         <NotificationDropdown 
                            type="Messages" 
                            icon={Mail} 
                            count={badgeMsg}
                            notifications={messages}
                            navigateToMessage="/admin/messages"
                            onMarkRead={handleMarkReadMsg}
                            onClear={handleClearMessages}
                        />
                        
                        <NotificationDropdown 
                            type="Notifications" 
                            icon={Bell} 
                            count={badgeNotif}
                            notifications={notifications}
                            navigateToBroadcast="/admin/broadcasts"
                            onMarkRead={handleMarkReadNotif}
                            onClear={handleClearNotifs}
                        />

                        <div className="hidden md:block h-8 w-px bg-gray-300 mx-2"></div>
                    </div>
                </header>

                {/* System Status Bar */}
                {(() => {
                    if (!shouldShowFooter) return null;

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

                <main className="flex-1 overflow-auto p-4 md:p-6 flex flex-col">
                    <div className="flex-grow">
                        <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)]"></div></div>}>
                            <Outlet />
                        </Suspense>
                    </div>
                    {shouldShowFooter && <Footer />}
                </main>
            </div>

            {showPermissionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Allow Location Access</h2>
                        <p className="text-sm text-gray-600 mb-3">
                            To show local weather advisories, this app requests access to your location. You can decline and continue; we will use approximate location or defaults.
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            You can change location permission anytime in your browser or device settings.
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
