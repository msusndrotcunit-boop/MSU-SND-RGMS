import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, BookOpen, Award, Users } from 'lucide-react';
import cdcLogo from '../assets/1002nd_cdc.webp';
import rotcLogo from '../assets/msu_rotc_logo.webp';
import sndSeal from '../assets/msu_snd_seal.webp';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-gray-900 text-white font-sans">
            {/* Navigation Bar */}
            <nav className="flex justify-between items-center p-4 md:p-6 max-w-7xl mx-auto">
                <div className="flex items-center space-x-2 md:space-x-3">
                    {/* Logos can be added here if available, using placeholders for now or just text */}
                    <div className="font-bold text-xl md:text-2xl tracking-wider text-green-100">ROTC<span className="text-yellow-500">GMS</span></div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="flex flex-col items-center justify-center text-center px-4 mt-6 md:mt-10 lg:mt-20 mb-12 md:mb-20">
                <div className="flex space-x-4 md:space-x-6 mb-6 md:mb-8 animate-fade-in-up">
                    <img src={cdcLogo} alt="1002nd CDC" className="w-16 h-16 md:w-20 md:h-20 lg:w-28 lg:h-28 object-contain drop-shadow-2xl tilt-media" />
                    <img src={rotcLogo} alt="ROTC Unit" className="w-16 h-16 md:w-20 md:h-20 lg:w-28 lg:h-28 object-contain drop-shadow-2xl tilt-media" />
                    <img src={sndSeal} alt="MSU-SND Seal" className="w-16 h-16 md:w-20 md:h-20 lg:w-28 lg:h-28 object-contain drop-shadow-2xl tilt-media" />
                </div>
                
                <h1 className="text-2xl md:text-4xl lg:text-6xl font-extrabold mb-3 md:mb-4 tracking-tight leading-tight max-w-4xl px-2">
                    MSU-SND ROTC UNIT <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                        Grading Management System
                    </span>
                </h1>
                
                <p className="text-sm md:text-lg lg:text-xl text-green-100/80 max-w-2xl mb-6 md:mb-10 leading-relaxed px-4">
                    A comprehensive platform for managing cadet records, attendance, grading, and merit systems. 
                    Streamlining operations for the 1002nd Community Defense Center.
                </p>
                
                <button 
                    onClick={() => navigate('/login')}
                    className="group relative inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-4 text-base md:text-lg font-bold text-white transition-all duration-200 bg-green-600 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 hover:bg-green-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 min-h-[44px]"
                >
                    Access Portal
                    <svg className="w-4 h-4 md:w-5 md:h-5 ml-2 -mr-1 transition-transform group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </header>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                    <FeatureCard 
                        icon={<Users size={32} />}
                        title="Cadet Management"
                        description="Centralized database for cadet profiles, enlistment, and unit organization."
                    />
                    <FeatureCard 
                        icon={<Shield size={32} />}
                        title="Attendance Tracking"
                        description="Efficient monitoring of training attendance for cadets and staff."
                    />
                    <FeatureCard 
                        icon={<BookOpen size={32} />}
                        title="Grading System"
                        description="Automated computation of grades based on attendance, aptitude, and exams."
                    />
                    <FeatureCard 
                        icon={<Award size={32} />}
                        title="Merit & Demerit"
                        description="Transparent recording of merits and demerits to track cadet conduct."
                    />
                </div>
            </section>

            {/* Footer */}
            <footer className="text-center py-6 md:py-8 text-green-200/60 text-xs md:text-sm border-t border-green-800/50 px-4">
                <p>&copy; {new Date().getFullYear()} MSU-SND ROTC Unit • Developed by JUNJIE L. BAHIAN.</p>
                <p className="text-green-200/40">All rights reserved.</p>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }) => (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 md:p-6 rounded-2xl hover:bg-white/10 transition duration-300">
        <div className="text-yellow-400 mb-3 md:mb-4 flex items-center justify-center md:justify-start">
            {React.cloneElement(icon, { size: 24, className: 'md:w-8 md:h-8' })}
        </div>
        <h3 className="text-lg md:text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-green-100/70 text-xs md:text-sm leading-relaxed">{description}</p>
    </div>
);

export default LandingPage;
