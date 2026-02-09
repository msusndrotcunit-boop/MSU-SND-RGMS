import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { Printer, Download, RefreshCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const MyQRCode = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const imgRef = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await axios.get('/api/staff/me');
      setProfile(res.data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      toast.error('Failed to load profile');
    }
  };

  const generate = async () => {
    if (!profile) return;
    const payload = {
      id: profile.id,
      role: 'training_staff',
      afpsn: profile.afpsn,
      name: `${profile.rank || ''} ${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      contact_number: profile.contact_number || '',
      email: profile.email || '',
      rotc_unit: profile.rotc_unit || '',
      mobilization_center: profile.mobilization_center || '',
    };
    try {
      const data = JSON.stringify(payload);
      const url = await QRCode.toDataURL(data, { errorCorrectionLevel: 'M' });
      setQrCodeUrl(url);
      toast.success('QR code generated');
    } catch (e) {
      toast.error('Failed to generate QR code');
    }
  };

  const download = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `staff-qr-${profile?.afpsn || profile?.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const print = () => {
    if (!qrCodeUrl || !profile) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html>
        <head>
          <title>My QR Code</title>
          <style>
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; }
            img { width:300px; height:300px; }
            h2 { margin-top: 16px; }
            p { color:#666 }
          </style>
        </head>
        <body>
          <img src="${qrCodeUrl}" />
          <h2>${profile.rank || ''} ${profile.first_name || ''} ${profile.last_name || ''}</h2>
          <p>AFPSN: ${profile.afpsn || ''}</p>
          <p>Training Staff</p>
          <script>window.onload = function(){ window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!profile) return <div className="p-6">No profile found</div>;

  const locked = !!profile.is_profile_completed;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-xl text-gray-800">My QR Code</h2>
          <Link to="/staff/profile" className="text-sm text-green-700 hover:underline">Back to Profile</Link>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          QR code contains your latest profile info. Generate after updating your profile.
        </p>
        <div className="flex flex-col items-center">
          {qrCodeUrl ? (
            <img ref={imgRef} src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-4 border-green-800 rounded-lg" />
          ) : (
            <div className="w-64 h-64 bg-gray-100 flex items-center justify-center text-gray-400 rounded-lg">No QR yet</div>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={generate} className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded flex items-center gap-2">
              <RefreshCcw size={16} /> Generate
            </button>
            <button onClick={download} disabled={!qrCodeUrl} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50">
              <Download size={16} /> Download
            </button>
            <button onClick={print} disabled={!qrCodeUrl} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50">
              <Printer size={16} /> Print
            </button>
          </div>
          {!locked && (
            <div className="mt-4 text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded">
              Complete your profile to lock details and avoid future changes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyQRCode;
