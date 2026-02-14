import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, Smartphone, ShieldCheck, Briefcase, HelpCircle, X, Download, Share, MoreVertical } from 'lucide-react';
import rgmsLogo from '../assets/rgms_logo.webp';

const Login = () => {
    const [loginType, setLoginType] = useState('cadet'); // 'cadet', 'staff', 'admin'
    const [formData, setFormData] = useState({ username: '', password: '', identifier: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showMobileModal, setShowMobileModal] = useState(false);
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
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

            const role = (user.role || '').toLowerCase();

            if (role === 'admin') {
                navigate('/admin/cadets');
            } else if (role === 'training_staff') {
                navigate('/staff/dashboard');
            } else if (role === 'cadet') {
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
            if (err.response) {
                const serverMsg = err.response.data?.message;
                setError(serverMsg || 'Login failed. Please check your credentials.');
            } else if (err.request) {
                setError('Cannot reach the server. Please check your WiFi or mobile data connection and try again.');
            } else {
                setError('Unexpected error during login. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleHelpClick = (type) => {
        if (type === 'access') {
            setShowAccessModal(true);
        } else if (type === 'mobile') {
            setShowMobileModal(true);
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
                                        placeholder={loginType === 'cadet' ? "Enter ROTCMIS Username or Email" : "Enter Staff Username"}
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
                            <button 
                                type="button" 
                                onClick={() => setShowForgotModal(true)}
                                className="text-green-600 hover:text-green-800 font-medium"
                            >
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
                            <Download size={16} className="text-gray-400 group-hover:text-green-600" />
                            Download Mobile App
                        </button>
                    </div>
                </div>
            </div>

                {showAccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-green-900 p-4 flex items-center justify-between">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <HelpCircle size={20} />
                                    How to Access the App
                                </h3>
                                <button 
                                    onClick={() => setShowAccessModal(false)}
                                    className="text-green-100 hover:text-white p-1 hover:bg-green-800 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-5">
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full border border-green-200">Cadet</span>
                                        <User size={14} className="text-green-700" />
                                    </div>
                                    <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside ml-1">
                                        <li>Ensure your account is approved by the ROTC Office.</li>
                                        <li>Choose Cadet, then enter your Student ID or Email.</li>
                                        <li>Tap Sign In. Complete your profile if prompted.</li>
                                    </ol>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full border border-indigo-200">Training Staff</span>
                                        <Briefcase size={14} className="text-indigo-700" />
                                    </div>
                                    <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside ml-1">
                                        <li>Choose Staff, then enter your Staff Username.</li>
                                        <li>No password required. Tap Sign In.</li>
                                        <li>Get your username from the ROTC Office if unsure.</li>
                                    </ol>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full border border-yellow-200">Admin</span>
                                        <ShieldCheck size={14} className="text-yellow-700" />
                                    </div>
                                    <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside ml-1">
                                        <li>Choose Admin, then enter your Admin Username and Password.</li>
                                        <li>Tap Sign In to access the admin dashboard.</li>
                                        <li>For access issues, contact the System Admin/ROTC Office.</li>
                                    </ol>
                                </div>
                                
                                <div className="text-xs text-gray-500 text-center">
                                    If you do not know your credentials, contact your Platoon Leader or the ROTC Office.
                                </div>
                                
                                <button 
                                    onClick={() => setShowAccessModal(false)}
                                    className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition-colors border border-gray-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showForgotModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-green-900 p-4 flex items-center justify-between">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <HelpCircle size={20} />
                                    Account Recovery
                                </h3>
                                <button 
                                    onClick={() => setShowForgotModal(false)}
                                    className="text-green-100 hover:text-white p-1 hover:bg-green-800 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-8 text-center space-y-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-2">
                                    <ShieldCheck size={32} />
                                </div>
                                <h4 className="text-xl font-bold text-gray-800">Contact Administrator</h4>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    For security reasons, account recovery must be handled manually. Please contact the ROTC Office Administrator or your Training Staff to recover your account or reset your password.
                                </p>
                                <div className="pt-2">
                                    <button
                                        onClick={() => setShowForgotModal(false)}
                                        className="px-6 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition-colors"
                                    >
                                        Understood
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* Mobile Download Modal */}
            {showMobileModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-green-900 p-4 flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Smartphone size={20} />
                                Install App
                            </h3>
                            <button 
                                onClick={() => setShowMobileModal(false)}
                                className="text-green-100 hover:text-white p-1 hover:bg-green-800 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="mb-6 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-700">
                                    <Download size={32} />
                                </div>
                                <h4 className="text-xl font-bold text-gray-800 mb-2">Download Mobile App</h4>
                                <p className="text-gray-600 font-medium mb-4">
                                    Get the official RGMS mobile app for the best experience.
                                </p>
                                
                                <a 
                                    href="/downloads/rgms-app.apk" 
                                    download="Mobile_RGMS-v2.4.apk"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-full shadow-lg hover:bg-green-700 transform hover:-translate-y-1 transition-all w-full sm:w-auto"
                                >
                                    <Download size={20} />
                                    Download Mobile_RGMS APK v2.4
                                </a>
                                <p className="text-xs text-gray-500 mt-2">
                                    Note: You may need to allow installation from unknown sources.
                                </p>
                            </div>

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-gray-200"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR USE WEB VERSION</span>
                                <div className="flex-grow border-t border-gray-200"></div>
                            </div>

                            <div className="space-y-4 mt-4">
                                {/* Android Instructions */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full border border-green-200">Android</span>
                                        Chrome
                                    </h4>
                                    <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside ml-1">
                                        <li>Open this page in <strong>Chrome</strong>.</li>
                                        <li>Tap the <strong>Menu</strong> icon <MoreVertical size={14} className="inline mx-1" /> (three dots).</li>
                                        <li>Select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong>.</li>
                                    </ol>
                                </div>

                                {/* iOS Instructions */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                                        <span className="bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full border border-gray-300">iOS</span>
                                        Safari
                                    </h4>
                                    <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside ml-1">
                                        <li>Open this page in <strong>Safari</strong>.</li>
                                        <li>Tap the <strong>Share</strong> icon <Share size={14} className="inline mx-1" />.</li>
                                        <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                                    </ol>
                                </div>
                            </div>

                            <button 
                                onClick={() => setShowMobileModal(false)}
                                className="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition-colors border border-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
