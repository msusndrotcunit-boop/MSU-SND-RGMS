import React from 'react';
import { Smartphone, X, Download, Share, MoreVertical } from 'lucide-react';

const MobileDownloadModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="bg-green-900 p-4 flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <Smartphone size={20} />
          Install App
        </h3>
        <button 
          onClick={onClose}
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
          onClick={onClose}
          className="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition-colors border border-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export default MobileDownloadModal;
