import React from 'react';
import { HelpCircle, User, Briefcase, ShieldCheck, X } from 'lucide-react';

const AccessHelpModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="bg-green-900 p-4 flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <HelpCircle size={20} />
          How to Access the App
        </h3>
        <button 
          onClick={onClose}
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
            <li>Choose Cadet, then enter your Username or Email.</li>
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
          onClick={onClose}
          className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition-colors border border-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export default AccessHelpModal;
