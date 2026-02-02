import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, ShieldCheck, Briefcase } from 'lucide-react';

const Login = () => {
    const [loginType, setLoginType] = useState('cadet'); // 'cadet', 'staff', 'admin'
    const [formData, setFormData] = useState({ username: '', password: '', identifier: '', email: '' });
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
                response = await axios.post('/api/auth/staff-login-no-pass', { identifier: formData.email });
            } else {
                response = await axios.post('/api/auth/login', { username: formData.username, password: formData.password });
            }

            const data = response.data;
            // Construct user object consistent with what AuthContext expects
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
                // Check if profile is completed (0 or false means incomplete)
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
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-cover bg-center relative" style={{ backgroundImage: "url('/assets/rgms_logo.png')", backgroundBlendMode: 'overlay', backgroundColor: 'rgba(20, 83, 45, 0.9)' }}>
            <div className="bg-white/90 backdrop-blur-md p-8 rounded-lg shadow-2xl w-full max-w-md border border-green-700/30 relative z-10">
                <div className="flex justify-center items-center mb-6">
                    <img src="/assets/rgms_logo.png" alt="RGMS Logo" className="w-32 h-32 object-contain" />
                </div>

                <h2 className="text-2xl font-bold mb-6 text-center text-green-900">MSU-SND ROTC UNIT Grading Management</h2>
                
                <div className="flex mb-6 bg-gray-200 rounded p-1">
                    <button
                        className={`flex-1 flex items-center justify-center py-2 rounded text-sm font-semibold transition ${loginType === 'cadet' ? 'bg-white shadow text-green-800' : 'text-gray-600 hover:text-green-800'}`}
                        onClick={() => { setLoginType('cadet'); setError(''); }}
                    >
                        <User size={18} className="mr-2" />
                        Cadet
                    </button>
                    <button
                        className={`flex-1 flex items-center justify-center py-2 rounded text-sm font-semibold transition ${loginType === 'staff' ? 'bg-white shadow text-green-800' : 'text-gray-600 hover:text-green-800'}`}
                        onClick={() => { setLoginType('staff'); setError(''); }}
                    >
                        <Briefcase size={18} className="mr-2" />
                        Staff
                    </button>
                    <button
                        className={`flex-1 flex items-center justify-center py-2 rounded text-sm font-semibold transition ${loginType === 'admin' ? 'bg-white shadow text-green-800' : 'text-gray-600 hover:text-green-800'}`}
                        onClick={() => { setLoginType('admin'); setError(''); }}
                    >
                        <ShieldCheck size={18} className="mr-2" />
                        Admin
                    </button>
                </div>

                {error && <p className="text-red-500 mb-4 text-center text-sm font-semibold bg-red-50 p-2 rounded border border-red-200">{error}</p>}
                
                <form onSubmit={handleSubmit} className="animate-fade-in">
                    {loginType === 'cadet' && (
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Username or Email Address</label>
                            <input
                                type="text"
                                name="identifier"
                                placeholder="Enter your Username or Email"
                                className="w-full border-gray-300 rounded px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-white shadow-inner"
                                value={formData.identifier}
                                onChange={handleChange}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2 italic">
                                Note: You must be included in the official ROTCMIS list to login. No password required.
                            </p>
                        </div>
                    )}

                    {loginType === 'staff' && (
                        <div className="mb-6">
                            <label className="block text-gray-700 font-semibold mb-2">Username or Email</label>
                            <input
                                type="text"
                                name="identifier"
                                placeholder="Enter your Username or Email"
                                className="w-full border-gray-300 rounded px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent bg-white shadow-inner"
                                value={formData.identifier}
                                onChange={handleChange}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2 italic">
                                Note: Training Staff login. No password required.
                            </p>
                        </div>
                    )}

                    {loginType === 'admin' && (
                        <>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-1 text-sm">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="w-full border-gray-300 rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-1 text-sm">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full border-gray-300 rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full bg-green-800 text-white py-3 rounded font-bold uppercase tracking-wider hover:bg-green-900 transition shadow-lg ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {loading ? 'Authenticating...' : (loginType === 'admin' ? 'Login as Admin' : 'Access Portal')}
                    </button>
                </form>

                <div className="absolute bottom-4 text-green-100/40 text-xs left-0 right-0 text-center">
                    &copy; 2026 MSU-SND ROTC UNIT
                </div>
            </div>
        </div>
    );
};

export default Login;