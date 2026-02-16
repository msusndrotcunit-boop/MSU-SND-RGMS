import React, { useState } from 'react';
import { Shield, Facebook, Twitter, Linkedin, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import rgmsLogo from '../assets/rgms_logo.webp';

const Footer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modal, setModal] = useState(null); // 'about' | 'docs' | null
  const toggleAdminMap = () => {
    try {
      if (user?.role !== 'admin') return;
      const current = localStorage.getItem('rgms_hide_admin_map') === 'true';
      const next = !current;
      localStorage.setItem('rgms_hide_admin_map', next ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('rgms:hide_admin_map', { detail: { hide: next } }));
      toast(next ? 'Admin map hidden' : 'Admin map shown');
    } catch {}
  };

  const handleSupport = () => {
    const role = user?.role;
    if (role === 'admin') {
      navigate('/admin/messages');
      return;
    }
    if (role === 'cadet') {
      navigate('/cadet/ask-admin');
      return;
    }
    if (role === 'training_staff') {
      navigate('/staff/ask-admin');
      return;
    }
    toast('Please coordinate with your ROTC staff for support.');
  };

  return (
    <footer className="bg-primary-surface text-white py-10 px-6 mt-auto border-t-4 border-yellow-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Brand Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-500 p-2 rounded-lg shadow-lg shadow-yellow-500/20">
               <Shield className="w-6 h-6 text-gray-900" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-wide">
                MSU-SND{' '}
                <button 
                  type="button"
                  onClick={toggleAdminMap}
                  className="hover:text-yellow-300 transition-colors"
                  title="Toggle Admin Map"
                >
                  RGMS
                </button>
              </h3>
              <p className="text-[10px] text-green-100/70 uppercase tracking-wider">Integrated with Training Staff Attendance System</p>
            </div>
          </div>
          <p className="text-green-100/80 text-sm mb-4 leading-relaxed">
            MSU-Sultan Naga Dimporo ROTC Unit Grading Management System
          </p>
          <p className="text-yellow-500 font-mono text-sm font-semibold">
            Version {import.meta.env.PACKAGE_VERSION}
          </p>
        </div>

        {/* Information */}
        <div>
          <h4 className="text-yellow-500 font-bold mb-4 uppercase text-sm tracking-wider">Information</h4>
           <ul className="space-y-3 text-green-50 text-sm">
            <li>
                <button
                  type="button"
                  onClick={() => setModal('about')}
                  className="hover:text-yellow-500 transition-colors flex items-center gap-2 group"
                >
                  <span className="group-hover:translate-x-1 transition-transform">ℹ️</span> About the App
                </button>
            </li>
            <li>
                <button
                    type="button"
                    onClick={() => setModal('docs')}
                    className="hover:text-yellow-500 transition-colors flex items-center gap-2 group"
                >
                    <span className="group-hover:translate-x-1 transition-transform">📄</span> Documentation
                </button>
            </li>
            <li>
                <button
                    type="button"
                    onClick={handleSupport}
                    className="hover:text-yellow-500 transition-colors flex items-center gap-2 group"
                >
                    <span className="group-hover:translate-x-1 transition-transform">🎧</span> Support
                </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-green-100/60">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
           <div className="w-8 h-8 rounded-full shadow-lg overflow-hidden">
             <img src={rgmsLogo} alt="RGMS" className="w-full h-full object-cover" />
           </div>
           <div>
             <p className="font-bold text-white">© {new Date().getFullYear()} MSU-SND ROTC Unit</p>
             <p className="text-xs">Developed by JUNJIE L. BAHIAN • All rights reserved.</p>
           </div>
        </div>
        
        <div className="flex gap-4">
          <a href="#" className="p-2 bg-black/20 rounded hover:bg-yellow-600 hover:text-white transition-all"><Facebook size={16} /></a>
          <a href="#" className="p-2 bg-black/20 rounded hover:bg-yellow-600 hover:text-white transition-all"><Twitter size={16} /></a>
          <a href="#" className="p-2 bg-black/20 rounded hover:bg-yellow-600 hover:text-white transition-all"><Linkedin size={16} /></a>
          <a href="#" className="p-2 bg-black/20 rounded hover:bg-yellow-600 hover:text-white transition-all"><Mail size={16} /></a>
        </div>
      </div>

      {/* Modal Overlay */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-gray-800 w-full max-w-lg rounded-lg shadow-xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h5 className="font-semibold">
                {modal === 'about' ? 'About the App' : 'System Documentation'}
              </h5>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm leading-relaxed">
              {modal === 'about' && (
                <>
                  <p>
                    MSU‑SND ROTC Grading Management System streamlines cadet and training staff operations:
                    attendance tracking (scanner and OCR import), grading automation, merit/demerit logs,
                    in‑app notifications, and instant PDF/CSV reporting.
                  </p>
                  <p>
                    It integrates cadet positions for dynamic report signatories, supports real‑time grade sync,
                    and provides analytics for training staff performance. Built with React + Vite on the client
                    and Express.js on the server.
                  </p>
                  <p className="mt-2">
                    Crafted with care by JUNJIE L. BAHIAN together with the MSU‑SND ROTC Unit team and contributors.
                  </p>
                </>
              )}
              {modal === 'docs' && (
                <>
                  <p className="font-medium">Key Modules</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Attendance: mark, scan QR, time in/out windows, OCR import of sheets.</li>
                    <li>Grading: compute prelim/midterm/final scores; sync on updates.</li>
                    <li>Merit/Demerit: ledger with points and reasons per cadet.</li>
                    <li>Reports: PDF and CSV exports with headers, signatories, and footers.</li>
                    <li>Notifications: server‑sent events for grades and unit updates.</li>
                    <li>Admin: cadet/staff management, analytics, communication.</li>
                  </ul>
                  <div className="pt-2">
                    <a
                      href="https://github.com/msusndrotcunit-boop/MSU-SND-RGMS#readme"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Open full documentation
                    </a>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
