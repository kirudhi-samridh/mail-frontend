import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearLocalStorageExceptSummaries } from '../utils/storageUtils';

const API_GATEWAY_URL = 'http://localhost:3001/api';

const GoogleIcon = () => (
    <svg className="mr-3 h-5 w-5" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

const MicrosoftIcon = () => (
    <svg className="mr-3 h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
        <path d="M1 1h10v10H1V1zm11 0h10v10H12V1zM1 12h10v10H1V12zm11 0h10v10H12V12z" />
    </svg>
);


function ConnectPage() {
    const navigate = useNavigate();
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleGoogleConnect = async () => {
        setIsLoading(true);
        setErrorMessage('');
        const token = localStorage.getItem('jwt_token');

        try {
            const response = await fetch(`${API_GATEWAY_URL}/auth/google`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get Google auth URL');
            }

            const data = await response.json();
            if (data.authorizationUrl) {
                window.location.href = data.authorizationUrl;
            } else {
                throw new Error('Authorization URL not received from server.');
            }
        } catch (error) {
            console.error("Error connecting to Google:", error);
            setErrorMessage(error.message);
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        clearLocalStorageExceptSummaries();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Connect Your Email</h1>
                    <p className="text-gray-500 mb-6">
                        Choose a provider to get started. You can add more accounts later.
                    </p>

                    {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}

                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleConnect}
                            disabled={isLoading}
                            className="w-full bg-white border border-gray-300 text-gray-700 p-4 rounded-lg font-semibold flex items-center justify-center hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                           <GoogleIcon />
                           {isLoading ? 'Redirecting...' : 'Connect Gmail Account'}
                        </button>
                        <button
                            disabled // O365 flow not implemented yet
                            className="w-full bg-white border border-gray-300 text-gray-700 p-4 rounded-lg font-semibold flex items-center justify-center transition-all opacity-50 cursor-not-allowed"
                        >
                            <MicrosoftIcon />
                            Connect Outlook/O365
                        </button>
                    </div>

                </div>
                 {userInfo && (
                    <div className="text-center mt-6">
                        <p className="text-sm text-gray-600">Logged in as {userInfo.email}</p>
                        <button onClick={handleLogout} className="text-xs text-red-500 hover:underline">Logout</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectPage; 