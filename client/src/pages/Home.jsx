import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, ShieldCheck } from 'lucide-react';

const Home = () => {
    const navigate = useNavigate();

    const handleNavigation = (type) => {
        navigate('/login', { state: { type } });
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-gray-900 overflow-hidden text-white">
            {/* Background Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 overflow-hidden">
                <img 
                    src="/assets/rgms_logo.png" 
                    alt="RGMS Background Logo" 
                    className="w-[80vmin] h-[80vmin] object-contain grayscale" 
                />
            </div>

            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4">
                <div className="mb-12 text-center">
                    <img 
                        src="/assets/rgms_logo.png" 
                        alt="RGMS Logo" 
                        className="w-32 h-32 object-contain mx-auto mb-6 drop-shadow-md"
                    />
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">ROTC Grading Management System</h1>
                    <p className="text-xl text-green-100 max-w-2xl mx-auto">
                        MSU-SND ROTC Unit
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                    {/* Cadet Account Button */}
                    <button 
                        onClick={() => handleNavigation('cadet')}
                        className="group relative bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center text-center"
                    >
                        <div className="bg-green-600 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                            <User size={48} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Cadet Account</h2>
                        <p className="text-green-100 text-sm">
                            Access your profile, check attendance, and view grades.
                        </p>
                    </button>

                    {/* Training Staff Account Button */}
                    <button 
                        onClick={() => handleNavigation('staff')}
                        className="group relative bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center text-center"
                    >
                        <div className="bg-blue-600 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                            <Briefcase size={48} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Training Staff Account</h2>
                        <p className="text-blue-100 text-sm">
                            Manage attendance, input grades, and monitor cadet progress.
                        </p>
                    </button>
                </div>

                {/* Admin Link */}
                <button 
                    onClick={() => handleNavigation('admin')}
                    className="mt-12 text-green-200 hover:text-white flex items-center space-x-2 transition-colors opacity-70 hover:opacity-100"
                >
                    <ShieldCheck size={18} />
                    <span className="text-sm font-medium">Access Admin Portal</span>
                </button>

                <footer className="absolute bottom-6 text-green-200/40 text-xs">
                    © {new Date().getFullYear()} MSU-SND ROTC Unit. All rights reserved.
                </footer>
            </div>
        </div>
    );
};

export default Home;
