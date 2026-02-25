import React, { useState } from 'react';
import { Facebook, Twitter, Linkedin, Mail, Info, FileText, Headphones, MoreHorizontal, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import rgmsLogo from '../assets/rgms_logo.webp';

const Footer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modal, setModal] = useState(null); // 'about' | 'docs' | null
  const [showMore, setShowMore] = useState(false);

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
    <footer className="bg-primary-surface text-white py-2 md:py-3 px-3 md:px-6 mt-auto border-t border-yellow-500/30 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-[60px] md:h-auto gap-3 md:gap-4">
        {/* Brand Section - Ultra Compact on Mobile */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
            <img src={rgmsLogo} alt="RGMS" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col items-start leading-none">
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-1">
              MSU-SND{' '}
              <button 
                type="button"
                onClick={toggleAdminMap}
                className="hover:text-yellow-300 transition-colors"
              >
                RGMS
              </button>
            </h3>
            <p className="text-[11px] md:text-[10px] text-green-100/50">ROTC Grading System</p>
          </div>
        </div>

        {/* Essential Navigation Links (Mobile: Icons, Desktop: Text) */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 justify-center md:justify-start">
          <button
            type="button"
            onClick={() => setModal('about')}
            className="w-11 h-11 md:w-auto md:h-auto flex items-center justify-center md:gap-2 text-sm md:text-[11px] text-green-100/80 hover:text-yellow-500 transition-colors"
            title="About the App"
          >
            <Info size={22} className="md:hidden" />
            <span className="hidden md:inline">About</span>
          </button>
          
          <button
            type="button"
            onClick={handleSupport}
            className="w-11 h-11 md:w-auto md:h-auto flex items-center justify-center md:gap-2 text-sm md:text-[11px] text-green-100/80 hover:text-yellow-500 transition-colors"
            title="Support"
          >
            <Headphones size={22} className="md:hidden" />
            <span className="hidden md:inline">Support</span>
          </button>

          {/* More Dropdown for Mobile / Desktop Docs Link */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth >= 768) {
                  setModal('docs');
                } else {
                  setShowMore(!showMore);
                }
              }}
              className="w-11 h-11 md:w-auto md:h-auto flex items-center justify-center md:gap-2 text-sm md:text-[11px] text-green-100/80 hover:text-yellow-500 transition-colors"
              title={showMore ? "Close Menu" : "More Options"}
            >
              <MoreHorizontal size={22} className="md:hidden" />
              <span className="hidden md:inline">Docs</span>
            </button>

            {/* Mobile "More" Menu */}
            {showMore && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-200 overflow-hidden md:hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">More Links</span>
                  <ChevronUp size={14} className="text-gray-400" />
                </div>
                <button
                  onClick={() => { setModal('docs'); setShowMore(false); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 flex items-center gap-3"
                >
                  <FileText size={16} className="text-blue-600" />
                  Documentation
                </button>
                <div className="p-2 border-t flex justify-around bg-gray-50">
                  <a href="#" className="p-2 text-gray-600 hover:text-blue-600"><Facebook size={18} /></a>
                  <a href="#" className="p-2 text-gray-600 hover:text-blue-400"><Twitter size={18} /></a>
                  <a href="#" className="p-2 text-gray-600 hover:text-blue-700"><Linkedin size={18} /></a>
                  <a href="#" className="p-2 text-gray-600 hover:text-red-500"><Mail size={18} /></a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Copyright & Social / Mobile Compact Copyright */}
        <div className="flex flex-col items-end shrink-0 ml-auto">
          <div className="hidden md:flex gap-3 mb-1">
            <a href="#" className="text-green-100/40 hover:text-yellow-500 transition-colors"><Facebook size={14} /></a>
            <a href="#" className="text-green-100/40 hover:text-yellow-500 transition-colors"><Twitter size={14} /></a>
            <a href="#" className="text-green-100/40 hover:text-yellow-500 transition-colors"><Linkedin size={14} /></a>
            <a href="#" className="text-green-100/40 hover:text-yellow-500 transition-colors"><Mail size={14} /></a>
          </div>
          <p className="text-sm md:text-[10px] text-green-100/40 text-right leading-none md:leading-normal">
            <span className="hidden sm:inline">© {new Date().getFullYear()} MSU-SND ROTC • </span>
            <span className="sm:hidden">© {new Date().getFullYear()} </span>
            JUNJIE L. BAHIAN
          </p>
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
