import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, ShieldCheck, Briefcase, ChevronLeft } from 'lucide-react';

const Login = () => {
    const location = useLocation();
    const { login } = useAuth();
    const navigate = useNavigate();

    // 'landing', 'cadet', 'staff'
    const [view, setView] = useState('landing'); 
    const [formData, setFormData] = useState({ username: '', password: '', identifier: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (location.state?.type) {
            if (location.state.type === 'cadet') setView('cadet');
            else if (location.state.type === 'staff' || location.state.type === 'admin') setView('staff');
        }
    }, [location.state]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCadetLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await axios.post('/api/auth/cadet-login', { identifier: formData.identifier });
            login(response.data);

            // Check for Default Cadet User for Onboarding
            if (response.data.role === 'cadet' && response.data.username === 'cadet@2026') {
                navigate('/cadet/onboard');
                return;
            }

            navigate('/cadet/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleStaffLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Use standard login for Staff and Admin (Username + Password)
            const response = await axios.post('/api/auth/login', { 
                username: formData.username, 
                password: formData.password 
            });
            
            const { role } = response.data;
            login(response.data);

            // Check for Default Staff User for Onboarding
            if (role === 'training_staff' && response.data.username === 'staff@2026') {
                navigate('/staff/onboard');
                return;
            }

            if (role === 'admin') {
                navigate('/admin/dashboard');
            } else if (role === 'training_staff') {
                navigate('/staff/dashboard');
            } else if (role === 'cadet') {
                // In case a cadet tries to login here (unlikely if they use the other form, but possible)
                navigate('/cadet/dashboard');
            } else {
                setError('Unknown role');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-gray-900 overflow-hidden">
            {/* Background Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 overflow-hidden">
                <img 
                    src="/assets/rgms_logo.png" 
                    alt="RGMS Background Logo" 
                    className="w-[80vmin] h-[80vmin] object-contain grayscale" 
                />
            </div>

            <div className="relative z-10 bg-white/95 backdrop-blur-md p-8 rounded-lg shadow-2xl w-full max-w-md border border-green-700/30">
                
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <img 
                        src="/assets/rgms_logo.png" 
                        alt="RGMS Logo" 
                        className="w-24 h-24 object-contain drop-shadow-md mb-4"
                    />
                    <h2 className="text-xl font-bold text-center text-green-900 leading-tight">
                        MSU-SND ROTC UNIT <br/> Grading Management System
                    </h2>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-3 rounded">
                        <p className="text-red-700 text-sm font-semibold">{error}</p>
                    </div>
                )}

                {/* VIEW: Landing */}
                {view === 'landing' && (
                    <div className="space-y-4">
                        <button 
                            onClick={() => setView('cadet')}
                            className="w-full group relative bg-white border-2 border-green-800 hover:bg-green-50 text-green-900 p-4 rounded-xl shadow-md transition-all duration-200 flex items-center"
                        >
                            <div className="bg-green-100 p-3 rounded-full mr-4 group-hover:bg-green-200 transition-colors">
                                <User size={24} className="text-green-800" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-lg">Cadet Portal</h3>
                                <p className="text-xs text-gray-500">Sign in with ID or Email</p>
                            </div>
                        </button>

                        <button 
                            onClick={() => setView('staff')}
                            className="w-full group relative bg-green-900 hover:bg-green-800 text-white p-4 rounded-xl shadow-md transition-all duration-200 flex items-center"
                        >
                            <div className="bg-green-800 p-3 rounded-full mr-4 group-hover:bg-green-700 transition-colors">
                                <Briefcase size={24} className="text-white" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-lg">Training Staff Portal</h3>
                                <p className="text-xs text-green-200">Staff & Admin Access</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* VIEW: Cadet Login */}
                {view === 'cadet' && (
                    <form onSubmit={handleCadetLogin} className="animate-fade-in">
                        <button 
                            type="button" 
                            onClick={() => { setView('landing'); setError(''); }}
                            className="mb-4 text-sm text-gray-500 hover:text-green-800 flex items-center transition-colors"
                        >
                            <ChevronLeft size={16} className="mr-1" /> Back to Selection
                        </button>
                        
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <User size={20} className="mr-2 text-green-700" /> Cadet Login
                        </h3>

                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2 text-sm">Login Credential</label>
                            <input
                                type="text"
                                name="identifier"
                                placeholder="Student ID, Username, or Email"
                                className="w-full border-gray-300 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-gray-50 shadow-inner"
                                value={formData.identifier}
                                onChange={handleChange}
                                required
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 mt-2 italic">
                                Note: You must be in the official ROTCMIS list. No password required.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-green-800 text-white py-3 rounded font-bold uppercase tracking-wider hover:bg-green-900 transition shadow-lg ${loading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {loading ? 'Verifying...' : 'Access Portal'}
                        </button>
                    </form>
                )}

                {/* VIEW: Staff/Admin Login */}
                {view === 'staff' && (
                    <form onSubmit={handleStaffLogin} className="animate-fade-in">
                        <button 
                            type="button" 
                            onClick={() => { setView('landing'); setError(''); }}
                            className="mb-4 text-sm text-gray-500 hover:text-green-800 flex items-center transition-colors"
                        >
                            <ChevronLeft size={16} className="mr-1" /> Back to Selection
                        </button>

                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <ShieldCheck size={20} className="mr-2 text-green-700" /> Staff & Admin Login
                        </h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-1 text-sm">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="w-full border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-gray-50"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-1 text-sm">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-gray-50"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-green-800 text-white py-3 rounded font-bold uppercase tracking-wider hover:bg-green-900 transition shadow-lg ${loading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {loading ? 'Authenticating...' : 'Secure Login'}
                        </button>
                    </form>
                )}
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-4 text-green-100/40 text-xs">
                &copy; 2026 MSU-SND ROTC UNIT
            </div>
        </div>
    );
};

export default Login;