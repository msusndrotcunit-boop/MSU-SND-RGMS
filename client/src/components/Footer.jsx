import React from 'react';
import { Shield, Facebook, Twitter, Linkedin, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-10 px-6 mt-auto border-t-4 border-yellow-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-500 p-2 rounded-lg shadow-lg shadow-yellow-500/20">
               <Shield className="w-6 h-6 text-gray-900" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-wide">MSU-SND RGMS</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Integrated with Training Staff Attendance System</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-4 leading-relaxed">
            MSU-Sultan Naga Dimporo ROTC Unit Grading Management System
          </p>
          <p className="text-yellow-500 font-mono text-sm font-semibold">Version 2.3.19</p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-yellow-500 font-bold mb-4 uppercase text-sm tracking-wider">Quick Links</h4>
          <ul className="space-y-3 text-gray-300 text-sm">
            <li>
                <Link to="/admin/dashboard" className="hover:text-yellow-500 transition-colors flex items-center gap-2 group">
                    <span className="group-hover:translate-x-1 transition-transform">🏠</span> Dashboard
                </Link>
            </li>
            <li>
                <Link to="/admin/cadets" className="hover:text-yellow-500 transition-colors flex items-center gap-2 group">
                    <span className="group-hover:translate-x-1 transition-transform">📂</span> Cadet Management
                </Link>
            </li>
            <li>
                <Link to="/admin/cadets" className="hover:text-yellow-500 transition-colors flex items-center gap-2 group">
                    <span className="group-hover:translate-x-1 transition-transform">🔍</span> Searching Cadets
                </Link>
            </li>
          </ul>
        </div>

        {/* Information */}
        <div>
          <h4 className="text-yellow-500 font-bold mb-4 uppercase text-sm tracking-wider">Information</h4>
           <ul className="space-y-3 text-gray-300 text-sm">
            <li>
                <Link to="/admin/about" className="hover:text-yellow-500 transition-colors flex items-center gap-2 group">
                    <span className="group-hover:translate-x-1 transition-transform">ℹ️</span> About of the App
                </Link>
            </li>
            <li>
                <Link to="#" className="hover:text-yellow-500 transition-colors flex items-center gap-2 group">
                    <span className="group-hover:translate-x-1 transition-transform">📄</span> Documentation
                </Link>
            </li>
            <li>
                <Link to="#" className="hover:text-yellow-500 transition-colors flex items-center gap-2 group">
                    <span className="group-hover:translate-x-1 transition-transform">🎧</span> Support
                </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
           <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">C</div>
           <div>
             <p className="font-bold text-white">2026 MSU-SND ROTC UNIT</p>
             <p className="text-xs">All rights reserved.</p>
           </div>
        </div>
        
        <div className="flex gap-4">
          <a href="#" className="p-2 bg-gray-800 rounded hover:bg-yellow-600 hover:text-white transition-all"><Facebook size={16} /></a>
          <a href="#" className="p-2 bg-gray-800 rounded hover:bg-yellow-600 hover:text-white transition-all"><Twitter size={16} /></a>
          <a href="#" className="p-2 bg-gray-800 rounded hover:bg-yellow-600 hover:text-white transition-all"><Linkedin size={16} /></a>
          <a href="#" className="p-2 bg-gray-800 rounded hover:bg-yellow-600 hover:text-white transition-all"><Mail size={16} /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
