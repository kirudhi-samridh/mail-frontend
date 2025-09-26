import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackPromise } from 'react-promise-tracker';
import { clearLocalStorageExceptSummaries } from '../utils/storageUtils';

// --- Icon Components ---
const MailIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> );
const UserIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );

// --- Configuration ---
const API_GATEWAY_URL = 'http://localhost:3001/api';
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function LoginPage() {
    const navigate = useNavigate();
    
    // --- State Management ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isO365Connected, setIsO365Connected] = useState(false);
    const [user, setUser] = useState(null);
    
    const googleClientRef = useRef(null);

    // --- Check for existing session on component mount ---
    useEffect(() => {
        const checkUserStatus = async () => {
            // Check for redirect loop
            const attempts = parseInt(sessionStorage.getItem('login_attempts') || '0', 10);
            if (attempts > 3) {
                console.warn('Redirect loop detected. Clearing storage and forcing clean login.');
                sessionStorage.removeItem('login_attempts');
                clearLocalStorageExceptSummaries();
                setMessage('There was an issue with your session. Please log in again.');
                return;
            }
            sessionStorage.setItem('login_attempts', (attempts + 1).toString());

            const token = localStorage.getItem('jwt_token');
            const userInfo = localStorage.getItem('user_info');
            
            if (token && userInfo) {
                const userData = JSON.parse(userInfo);
                setUser(userData);
                
                // Check if user has completed onboarding
                if (userData.onboardingCompleted) {
                    navigate('/inbox');
                    return;
                }
                
                // Check email connection status for logged-in user
                try {
                    const statusResponse = await authenticatedFetch(`${API_GATEWAY_URL}/auth/status`);
                    if (statusResponse.ok) {
                        const { isGoogleConnected, isO365Connected } = await statusResponse.json();
                        setIsGoogleConnected(isGoogleConnected);
                        setIsO365Connected(isO365Connected);
                        
                        if (isGoogleConnected || isO365Connected) {
                            setMessage('Email service connected! Complete your setup to continue.');
                        } else {
                            setMessage('Please connect your email service to continue.');
                        }
                    }
                } catch (error) {
                    console.error("Could not verify connection status", error.message);
                    setMessage('Please connect your email service to continue.');
                }
                return;
            }
        };
        
        checkUserStatus();
    }, [navigate]);

    // --- Check for O365 callback on component mount ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state === 'microsoft_auth') {
            handleO365Callback(code);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // --- Effect to initialize the Google GSI client ---
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) {
            setMessage("Configuration Error: Google Client ID is missing.");
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.body.appendChild(script);
        script.onload = () => {
            if (window.google) {
                googleClientRef.current = window.google.accounts.oauth2.initCodeClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/gmail.readonly',
                    prompt: 'consent', 
                    callback: (codeResponse) => { if (codeResponse.code) { handleGoogleLoginSuccess(codeResponse.code); } },
                });
            } else { setMessage("Could not initialize Google Login."); }
        };
        return () => { document.body.removeChild(script); };
    }, []);

    // --- API Fetch Utility ---
    const authenticatedFetch = async (url, options = {}) => {
        const token = localStorage.getItem('jwt_token');
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            clearLocalStorageExceptSummaries();
            sessionStorage.clear();
            setMessage("Your session has expired. Please log in again.");
            throw new Error("Session expired");
        }
        return response;
    };

    // --- Auth Functions ---
    const handleAuthResponse = async (response) => {
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('jwt_token', data.token);
            localStorage.setItem('user_info', JSON.stringify(data.user));
            setUser(data.user);
            setMessage(`Successfully logged in!`);
            
            // Check if user has completed onboarding
            if (data.user.onboardingCompleted) {
                navigate('/inbox');
            } else {
                // User needs to connect email service and complete onboarding
                // Stay on login page to show email connection options
                setMessage('Please connect your email service to continue.');
            }
        } else {
            const errorData = await response.json();
            setMessage(`Error: ${errorData.message || 'Authentication failed'}`);
        }
        setLoading(false);
    };

    const handleSaaSLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API_GATEWAY_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            await handleAuthResponse(response);
        } catch (error) {
            setMessage('Network error during login.');
            setLoading(false);
        }
    };

    const handleSaaSSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API_GATEWAY_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            await handleAuthResponse(response);
        } catch (error) {
            setMessage('Network error during signup.');
            setLoading(false);
        }
    };

    const handleGoogleLoginSuccess = async (authCode) => {
        setLoading(true);
        setMessage('Connecting Google account...');
        
        // Check if user is logged in first
        const token = localStorage.getItem('jwt_token');
        if (!token) {
            setMessage('Please log in first before connecting your Google account.');
            setLoading(false);
            return;
        }
        
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/auth/google/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: authCode })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Backend failed to exchange token.');
            }
            setMessage('Successfully connected Google account! Redirecting to setup...');
            setIsGoogleConnected(true);
            
            // Check if user has already completed onboarding
            const userInfo = localStorage.getItem('user_info');
            if (userInfo) {
                const userData = JSON.parse(userInfo);
                if (userData.onboardingCompleted) {
                    // If already completed, go directly to inbox
                    navigate('/inbox');
                    return;
                }
                // If not completed, navigate directly to onboarding
                navigate('/onboarding');
            } else {
                // If no user info, navigate to inbox as fallback
                navigate('/inbox');
                return;
            }
        } catch (error) {
            if (error.message !== "Session expired") setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const triggerGoogleLogin = () => {
        if (googleClientRef.current) {
            googleClientRef.current.requestCode();
        } else {
            setMessage("Google Login is not ready yet.");
        }
    };

    const triggerO365Login = async () => {
        setLoading(true);
        setMessage('Redirecting to Microsoft for login...');
        try {
            const response = await fetch(`${API_GATEWAY_URL}/auth/microsoft/url`);
            const data = await response.json();
            if (response.ok) {
                window.location.href = data.url;
            } else {
                setMessage(data.message || "Could not get Microsoft auth URL.");
                setLoading(false);
            }
        } catch (error) {
            setMessage('Network error when contacting server.');
            setLoading(false);
        }
    };

    const handleO365Callback = async (code) => {
        setLoading(true);
        setMessage('Connecting Microsoft 365 account...');
        
        const token = localStorage.getItem('jwt_token');
        if (!token) {
            setMessage('Please log in first before connecting your account.');
            setLoading(false);
            return;
        }
        
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/auth/microsoft/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Backend failed to exchange token.');
            }
            setMessage('Successfully connected Microsoft 365 account! Redirecting to setup...');
            setIsO365Connected(true);

            const userInfo = localStorage.getItem('user_info');
            if (userInfo) {
                const userData = JSON.parse(userInfo);
                if (userData.onboardingCompleted) {
                    navigate('/inbox');
                    return;
                }
                navigate('/onboarding');
            } else {
                navigate('/inbox');
                return;
            }
        } catch (error) {
            if (error.message !== "Session expired") setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Logout and Session Management ---
    const clearLoginAttempts = () => {
        sessionStorage.removeItem('login_attempts');
    }

    const handleLogout = () => {
        clearLocalStorageExceptSummaries();
        sessionStorage.clear();
        setUser(null);
        setMessage('You have been logged out.');
        navigate('/login', { replace: true });
        localStorage.setItem('logout', Date.now().toString());
    };

    // This effect detects if a logout has occurred on another tab
    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'logout') {
                handleLogout();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // --- UI Rendering ---
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="p-8 max-w-md w-full bg-white rounded-2xl shadow-lg">
                <div className="text-center mb-8">
                    <UserIcon className="mx-auto h-12 w-auto text-indigo-600" />
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                        {user ? `Welcome, ${user.email}` : "Sign in to your account"}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {user ? "Manage your connected accounts or log out." : "And start managing your emails with AI."}
                    </p>
                </div>

                {message && <p className="text-center text-sm text-red-500 mb-4">{message}</p>}

                {!user ? (
                    <form className="space-y-6" onSubmit={handleSaaSLogin}>
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <button type="submit" disabled={loading} className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400">
                                {loading ? <LoaderIcon /> : 'Sign In'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                             <button type="button" onClick={handleSaaSSignup} disabled={loading} className="group relative flex w-full justify-center rounded-md border border-transparent bg-gray-600 py-2 px-4 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400">
                                {loading ? <LoaderIcon /> : 'Sign Up'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-md">
                            <span className="font-medium">Google</span>
                            {isGoogleConnected ? (
                                <span className="text-green-600 font-semibold">Connected</span>
                            ) : (
                                <button onClick={triggerGoogleLogin} disabled={loading} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                                    {loading ? 'Connecting...' : 'Connect'}
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-md">
                            <span className="font-medium">Microsoft 365</span>
                            {isO365Connected ? (
                                <span className="text-green-600 font-semibold">Connected</span>
                            ) : (
                                <button onClick={triggerO365Login} disabled={loading} className="px-3 py-1 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900 disabled:bg-gray-600">
                                    {loading ? 'Connecting...' : 'Connect'}
                                </button>
                            )}
                        </div>

                        {user && (
                            <button
                                onClick={handleLogout}
                                className="w-full mt-6 text-sm text-gray-600 hover:text-gray-800 px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100"
                            >
                                Log Out
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LoginPage; 