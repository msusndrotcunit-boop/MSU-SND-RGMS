import React, { useState, Suspense, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Calendar, LogOut, UserCheck, User, Menu, X, ClipboardList, Calculator, UserCog, Settings, QrCode, ChevronDown, ChevronRight, PieChart, MessageSquare, Bell, Search, Mail } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';

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

    const toggleMenu = (label) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
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

    // Removed manual toggle and buttons; notifications auto-show and auto-hide

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow p-4 flex items-center">
                    <button 
                        onClick={toggleSidebar} 
                        className="mr-4 text-gray-600 hover:text-gray-900 md:hidden"
                    >
                        <Menu size={24} />
                    </button>
                    <h1 className="text-sm md:text-xl font-semibold text-gray-800 flex-1 truncate">
                        {navItems.find(i => i.path === location.pathname)?.label || 'Admin Panel'}
                    </h1>

                    <div className="flex items-center space-x-2 md:space-x-4">
                        <div className="relative">
                            <div className="flex items-center border rounded-md px-2 py-1 md:px-3 md:py-2 w-32 md:w-64 focus-within:ring-2 focus-within:ring-green-600">
                                <Search size={18} className="text-gray-400 mr-2" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchOpen(true)}
                                    onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                                    placeholder="Search..."
                                    className="w-full outline-none text-xs md:text-sm"
                                />
                            </div>
                            {searchOpen && (searchResults.cadets.length > 0 || searchResults.staff.length > 0) && (
                                <div className="absolute mt-2 bg-white border rounded shadow w-64 z-50">
                                    {searchResults.cadets.map(c => (
                                        <Link key={`c-${c.id}`} to={`/admin/cadets`} className="block px-3 py-2 hover:bg-gray-100 text-sm">
                                            {c.rank} {c.first_name} {c.last_name} • {c.student_id}
                                        </Link>
                                    ))}
                                    {searchResults.staff.map(s => (
                                        <Link key={`s-${s.id}`} to={`/admin/staff`} className="block px-3 py-2 hover:bg-gray-100 text-sm">
                                            {s.rank} {s.first_name} {s.last_name} • {s.afpsn || 'N/A'}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
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
                {(health && health.db === 'disconnected') && (
                    <div className="bg-red-600 text-white text-sm p-2 text-center">
                        Degraded mode: Database disconnected. Writes are queued; some features may be limited.
                    </div>
                )}
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
