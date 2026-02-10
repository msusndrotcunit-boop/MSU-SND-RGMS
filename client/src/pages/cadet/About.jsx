import React from 'react';

const About = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-6">
                        <img 
                            src="/assets/msu_rotc_logo.webp" 
                            alt="ROTC Logo" 
                            className="w-24 h-24 object-contain"
                        />
                        <img 
                            src="/assets/1002nd_cdc.webp" 
                            alt="1002nd CDC Logo" 
                            className="w-24 h-24 object-contain"
                        />
                        <img 
                            src="/assets/msu_snd_seal.webp" 
                            alt="MSU-SND Seal" 
                            className="w-24 h-24 object-contain"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-green-900 dark:text-green-400 mb-2">
                        ROTC GRADING MANAGEMENT SYSTEM
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                        MSU-SND ROTC UNIT
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Version {import.meta.env.PACKAGE_VERSION}
                    </p>
                </div>

                <div className="space-y-6 text-gray-700 dark:text-gray-300">
                    <section>
                        <h2 className="text-2xl font-bold text-green-800 dark:text-green-500 mb-3 border-b border-gray-200 pb-2">
                            About the System
                        </h2>
                        <p className="leading-relaxed">
                            The ROTC Grading Management System is a comprehensive platform designed to streamline the management of cadet records, grading, attendance, and performance tracking for the MSU-SND ROTC Unit. This system ensures transparency, accuracy, and efficiency in handling cadet data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-green-800 dark:text-green-500 mb-3 border-b border-gray-200 pb-2">
                            Key Features
                        </h2>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>
                                <span className="font-semibold">Grade Monitoring:</span> View your academic performance, including prelim, midterm, and final scores.
                            </li>
                            <li>
                                <span className="font-semibold">Attendance Tracking:</span> Keep track of your training attendance record and submit excuse letters when necessary.
                            </li>
                            <li>
                                <span className="font-semibold">Merit & Demerit Logs:</span> Monitor your disciplinary records and merits earned during training.
                            </li>
                            <li>
                                <span className="font-semibold">Profile Management:</span> Update your personal contact information and profile picture.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-green-800 dark:text-green-500 mb-3 border-b border-gray-200 pb-2">
                            Contact Information
                        </h2>
                        <p>
                            For any issues regarding your grades, attendance, or account access, please report to the Admin Office or your Platoon Leader.
                        </p>
                    </section>
                </div>
                
                <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400 border-t pt-6">
                    &copy; {new Date().getFullYear()} MSU-SND ROTC Unit • Developed by JUNJIE L. BAHIAN. All Rights Reserved.
                </div>
            </div>
        </div>
    );
};

export default About;
