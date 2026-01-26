import React, { useState, useEffect } from 'react';
import { auth, db, storage } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { File, Trash2, Upload, ExternalLink, Loader2 } from 'lucide-react';

const SecureStorage = () => {
    const [user, setUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState('');

    // 1. Listen to Firebase Auth state (managed by AuthContext)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            if (u) {
                setUser(u);
            } else {
                setUser(null);
                // If we have a JWT token but no Firebase user, AuthContext might be still syncing.
                // Or syncing failed. We can optionally retry here or just wait.
            }
            setInitializing(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Listen to Firestore for file list
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/files`),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const filesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFiles(filesData);
        }, (err) => {
            console.error("Firestore Error:", err);
            if (err.code === 'permission-denied') {
                setError("Access denied. Please check security rules.");
            } else {
                setError("Failed to load files.");
            }
        });

        return () => unsubscribe();
    }, [user]);

    // 3. Handle File Upload
    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File size exceeds 5MB limit.");
            return;
        }

        setUploading(true);
        setError('');

        try {
            // Path: users/{uid}/files/{filename}
            // We use a timestamp prefix to avoid name collisions
            const storageRef = ref(storage, `users/${user.uid}/files/${Date.now()}_${file.name}`);
            
            // Upload
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Save Metadata to Firestore
            await addDoc(collection(db, `users/${user.uid}/files`), {
                name: file.name,
                url: downloadURL,
                path: snapshot.ref.fullPath,
                type: file.type,
                size: file.size,
                createdAt: serverTimestamp()
            });

        } catch (err) {
            console.error("Upload Error:", err);
            setError("Failed to upload file.");
        } finally {
            setUploading(false);
            e.target.value = null; // Reset input
        }
    };

    // 4. Handle Delete
    const handleDelete = async (fileId, filePath) => {
        if (!window.confirm("Are you sure you want to delete this file?")) return;

        try {
            // Delete from Storage
            const storageRef = ref(storage, filePath);
            await deleteObject(storageRef);

            // Delete from Firestore
            await deleteDoc(doc(db, `users/${user.uid}/files`, fileId));

        } catch (err) {
            console.error("Delete Error:", err);
            setError("Failed to delete file.");
        }
    };

    if (initializing) return <div className="p-4 flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin" /> Connecting to Secure Storage...</div>;
    
    // If error is configuration related, show it but keep the UI clean
    if (error) return (
        <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-400">
                <File />
                Secure Files
            </h2>
            <div className="p-4 text-amber-700 bg-amber-50 rounded border border-amber-200 text-sm">
                <p className="font-bold">Module Unavailable</p>
                <p>{error}</p>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <File className="text-blue-600" />
                My Secure Files
            </h2>
            
            {/* Upload Area */}
            <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded transition w-fit">
                    {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
                    <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleUpload} 
                        disabled={uploading}
                    />
                </label>
                <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Only you can access these files.</p>
            </div>

            {/* File List */}
            <div className="space-y-2">
                {files.length === 0 ? (
                    <p className="text-gray-400 italic text-sm">No files uploaded yet.</p>
                ) : (
                    files.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="bg-gray-200 p-2 rounded">
                                    <File size={20} className="text-gray-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • {file.createdAt?.toDate().toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href={file.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Download/View"
                                >
                                    <ExternalLink size={18} />
                                </a>
                                <button 
                                    onClick={() => handleDelete(file.id, file.path)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SecureStorage;
