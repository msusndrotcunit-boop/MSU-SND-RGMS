import React from 'react';
import { File } from 'lucide-react';

const SecureStorage = () => {
    return (
        <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-400">
                <File />
                Secure Files
            </h2>
            <div className="p-4 text-amber-700 bg-amber-50 rounded border border-amber-200 text-sm">
                <p className="font-bold">Module Unavailable</p>
                <p>Secure Storage has been disabled as part of the Firebase removal.</p>
            </div>
        </div>
    );
};

export default SecureStorage;
