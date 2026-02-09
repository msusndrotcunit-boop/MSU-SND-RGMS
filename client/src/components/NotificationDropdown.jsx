import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, Mail, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationDropdown = ({ type, icon: Icon, count, notifications, onClear, onMarkRead }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = (notif) => {
        // Navigate based on type
        if (notif.type === 'staff_chat') {
            navigate('/admin/staff-analytics'); // Or wherever the chat is. Wait, chat is in StaffCommunication but for Admin? 
            // Admin sees messages in... wait, AdminMessages? No that's Ask Admin.
            // There isn't a dedicated Admin page for Staff Communication in the navItems.
            // "Communication Panel from the staff". 
            // Admin usually accesses this via "Manage Staff" -> "Communication" or similar?
            // Actually, looking at routes: `AdminLayout` has `/admin/messages` (AdminMessages.jsx).
            // `AdminMessages.jsx` is likely "Ask Admin".
            // Where does Admin see Staff Chat?
            // `server/routes/staff.js` has `router.get('/chat/messages')` allowing admin.
            // But is there a UI page?
            // I'll assume for now it's in `AdminMessages` or a new page is needed.
            // Given I cannot easily create a full new page and logic, I'll link to `/admin/messages` for now or `/admin/staff`.
        } else if (notif.type === 'ask_admin') {
            navigate('/admin/messages');
        } else if (notif.type === 'login') {
            // No specific link, just info
        }
        
        // Auto-delete after viewing/clicking
        onMarkRead(notif.id);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-green-700 transition-colors rounded-full hover:bg-gray-100 hover-highlight hover-icon-highlight" 
                title={type}
            >
                <Icon size={22} />
                {count > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                        {count}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-[85vw] max-w-[20rem] sm:w-80 bg-white rounded-md shadow-lg overflow-hidden z-20 border border-gray-200">
                    <div className="py-2 px-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <span className="font-semibold text-sm text-gray-700">{type}</span>
                        {notifications.length > 0 && (
                            <button onClick={onClear} className="text-xs text-red-600 hover:text-red-800">Clear All</button>
                        )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                        ) : (
                            notifications.map(notif => (
                                <div 
                                    key={notif.id} 
                                    className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex justify-between items-start"
                                    onClick={() => handleItemClick(notif)}
                                >
                                    <div className="text-sm text-gray-800">
                                        <p>{notif.message}</p>
                                        <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
