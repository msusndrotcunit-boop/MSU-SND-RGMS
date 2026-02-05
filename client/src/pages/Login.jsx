import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, Smartphone, ShieldCheck, Briefcase, HelpCircle } from 'lucide-react';
import rgmsLogo from '../assets/rgms_logo.webp';

const Login = () => {
    const [loginType, setLoginType] = useState('cadet'); // 'cadet', 'staff', 'admin'
    const [formData, setFormData] = useState({ username: '', password: '', identifier: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            let response;
            if (loginType === 'cadet') {
                response = await axios.post('/api/auth/cadet-login', { identifier: formData.identifier });
            } else if (loginType === 'staff') {
                response = await axios.post('/api/auth/staff-login-no-pass', { identifier: formData.identifier });
            } else {
                const username = (formData.username || '').trim();
                const password = (formData.password || '').trim();
                response = await axios.post('/api/auth/login', { username, password });
            }

            const data = response.data;
            const user = {
                token: data.token,
                role: data.role,
                cadetId: data.cadetId,
                staffId: data.staffId,
                isProfileCompleted: data.isProfileCompleted
            };
            
            login(user);

            if (user.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (user.role === 'training_staff') {
                navigate('/staff/dashboard');
            } else if (user.role === 'cadet') {
                if (!user.isProfileCompleted) {
                    navigate('/cadet/profile');
                } else {
                    navigate('/cadet/dashboard');
                }
            } else {
                navigate('/');
            }
        } catch (err) {
            console.error("Login error:", err);
            const serverMsg = err.response?.data?.message;
            setError(serverMsg || `Login failed. Please check your credentials.`);
        } finally {
            setLoading(false);
        }
    };

    const handleHelpClick = (type) => {
        if (type === 'access') {
            toast('Please contact your Platoon Leader or the ROTC Office to get your account credentials.', {
                icon: 'ℹ️',
                duration: 4000
            });
        } else if (type === 'mobile') {
            toast('The mobile app is currently under development. Please check back later!', {
                icon: '📱',
                duration: 4000
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-green-950 relative overflow-hidden">
            {/* Background Overlay */}
            <div className="absolute inset-0 z-0 opacity-20" style={{ 
                backgroundImage: `url(${rgmsLogo})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                filter: 'blur(8px)'
            }}></div>

            <div className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden z-10 mx-4">
                {/* Header Section */}
                <div className="bg-green-900 p-6 md:p-8 text-center border-b-4 border-green-600 flex flex-col items-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 mb-2 rounded-full bg-white overflow-hidden flex items-center justify-center shadow-md relative">
                        <img src={rgmsLogo} alt="RGMS Logo" className="w-full h-full object-cover scale-[1.37] translate-y-1.5 md:translate-y-2" />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-widest mb-2 md:mb-4 drop-shadow-sm">MSU-SND RGMS</h2>
                    <h1 className="text-xs md:text-lg font-bold text-white tracking-wider leading-tight px-2">MSU-SND ROTC UNIT GRADING MANAGEMENT SYSTEM</h1>
                    <p className="text-gray-300 text-[10px] md:text-xs mt-1 uppercase tracking-wide font-medium">
                        integrated with Training Staff Attendance System
                    </p>
                </div>

                {/* Body Section */}
                <div className="p-8 pt-6">
                    {/* Role Selector */}
                    <div className="flex justify-center mb-6 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => { setLoginType('cadet'); setError(''); }}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                                loginType === 'cadet' ? 'bg-white text-green-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <User size={14} /> Cadet
                        </button>
                        <button
                            onClick={() => { setLoginType('staff'); setError(''); }}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                                loginType === 'staff' ? 'bg-white text-green-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Briefcase size={14} /> Staff
                        </button>
                        <button
                            onClick={() => { setLoginType('admin'); setError(''); }}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                                loginType === 'admin' ? 'bg-white text-green-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <ShieldCheck size={14} /> Admin
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700 text-sm rounded">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Input Fields */}
                        {(loginType === 'cadet' || loginType === 'staff') && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Username or Email
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        name="identifier"
                                        value={formData.identifier}
                                        onChange={handleChange}
                                        required
                                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50 text-gray-900 transition-colors"
                                        placeholder={loginType === 'cadet' ? "Enter Student ID or Email" : "Enter Staff Username"}
                                    />
                                </div>
                            </div>
                        )}

                        {loginType === 'admin' && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Username
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            required
                                            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50 text-gray-900 transition-colors"
                                            placeholder="Enter Admin Username"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50 text-gray-900 transition-colors"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Extras: Remember Me / Forgot Password */}
                        <div className="flex items-center justify-between text-xs">
                            <label className="flex items-center text-gray-600 cursor-pointer">
                                <input type="checkbox" className="form-checkbox h-3 w-3 text-green-600 rounded border-gray-300 focus:ring-green-500" />
                                <span className="ml-1.5">Remember me</span>
                            </label>
                            <button type="button" className="text-green-600 hover:text-green-800 font-medium">
                                Forgot Email/Username?
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md shadow-lg transition duration-200 flex items-center justify-center gap-2 ${loading ? 'opacity-75 cursor-wait' : ''}`}
                        >
                            {loading ? (
                                <span>Authenticating...</span>
                            ) : (
                                <>
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    {/* New Footer Links */}
                    <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                        <button 
                            type="button"
                            onClick={() => handleHelpClick('access')}
                            className="w-full text-gray-600 hover:text-green-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors group p-2 rounded hover:bg-green-50"
                        >
                            <HelpCircle size={16} className="text-gray-400 group-hover:text-green-600" />
                            How to access the app
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => handleHelpClick('mobile')}
                            className="w-full text-gray-600 hover:text-green-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors group p-2 rounded hover:bg-green-50"
                        >
                            <Smartphone size={16} className="text-gray-400 group-hover:text-green-600" />
                            How to download it in mobile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
