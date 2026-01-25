import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/api/auth/login', formData);
            login(response.data);
            if (response.data.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/cadet/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
                <div className="flex justify-center items-center space-x-4 mb-6">
                    {/* 1002nd CDC Logo */}
                    <img 
                        src="/assets/1002nd_cdc.png" 
                        alt="1002nd CDC Logo" 
                        className="w-20 h-20 object-contain"
                    />
                    {/* ROTC Unit Logo */}
                    <img 
                        src="/assets/msu_rotc_logo.png" 
                        alt="ROTC Unit Logo" 
                        className="w-20 h-20 object-contain"
                    />
                    {/* MSU-SND Seal */}
                    <img 
                        src="/assets/msu_snd_seal.png" 
                        alt="MSU-SND Seal" 
                        className="w-20 h-20 object-contain"
                    />
                </div>
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">MSU-SND ROTC UNIT Grading Management Login</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700">Username</label>
                        <input
                            type="text"
                            name="username"
                            className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                    >
                        Login
                    </button>
                </form>
                <div className="mt-4 text-center">
                    <p className="text-sm">Don't have a cadet account? <Link to="/signup" className="text-blue-600 hover:underline">Sign Up</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Login;
