import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearLocalStorageExceptSummaries } from '../utils/storageUtils';

// --- Icon Components ---
const SparklesIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg> );
const CheckCircleIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg> );
const PlayIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="5,3 19,12 5,21"/></svg> );
const ClockIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );

// --- Configuration ---
const API_GATEWAY_URL = 'http://localhost:3001/api';

function OnboardingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // --- State Management ---
    const [user, setUser] = useState(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [onboardingStatus, setOnboardingStatus] = useState('not-started');
    const [onboardingProgress, setOnboardingProgress] = useState(null);
    const [fetchDays, setFetchDays] = useState(15);
    const [summaryDays, setSummaryDays] = useState(15);
    const [correlationId, setCorrelationId] = useState(null);
    const [accountId, setAccountId] = useState(null);

    const progressIntervalRef = useRef(null);

    // --- Get accountId from URL on component mount ---
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const id = queryParams.get('accountId');
        if (id) {
            setAccountId(id);
            console.log(`Onboarding for accountId: ${id}`);
        } else {
            console.warn("No accountId found in URL for onboarding.");
            // Optional: Redirect if no accountId is present, as it's required.
            // navigate('/connect'); 
        }
    }, [location]);

    // --- Check for authentication on component mount ---
    useEffect(() => {
        const checkUserStatus = async () => {
            const token = localStorage.getItem('jwt_token');
            const userInfo = localStorage.getItem('user_info');
            
            if (!token || !userInfo) {
                navigate('/login');
                return;
            }
            
            const userData = JSON.parse(userInfo);
            setUser(userData);
            
            // Check connection status from the backend, which is the source of truth
            try {
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/auth/status`);
                if (response.ok) {
                    const statusData = await response.json();
                    
                    // Only redirect if onboarding is EXPLICITLY completed.
                    if (statusData.onboardingCompleted) {
                        navigate('/inbox');
                        return;
                    }
                    
                    // setIsGmailConnected(statusData.isGmailConnected); // This line is removed
                    // setIsOutlookConnected(statusData.isOutlookConnected); // This line is removed
                }
            } catch (error) {
                console.error("Error checking auth status:", error);
                setMessage("Could not verify email connection status.");
            }
        };
        
        checkUserStatus();
    }, [navigate]);

    // Cleanup effect for progress tracking
    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        };
    }, []);

    // --- API Fetch Utility ---
    const authenticatedFetch = async (url, options = {}) => {
        const token = localStorage.getItem('jwt_token');
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            clearLocalStorageExceptSummaries();
            navigate('/login');
            throw new Error("Session expired");
        }
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Authenticated fetch failed:", response.status, errorText);
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || 'An error occurred');
            } catch (e) {
                throw new Error(errorText || 'An error occurred');
            }
        }
        return response;
    };

    // --- Logout Function ---
    const handleLogout = () => {
        clearLocalStorageExceptSummaries();
        navigate('/login');
    };

    // --- Navigation and Action Handlers ---
    const handleGoToInbox = async () => {
        if (!accountId) {
            setMessage("Cannot complete setup: No account ID specified.");
            return;
        }

        setLoading(true);
        setMessage('Finalizing your setup...');
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/accounts/complete-onboarding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: accountId }),
            });

            if (response.ok) {
                // The user's global onboarding status might not be 'completed' yet,
                // but we can proceed to the inbox. The next full login will handle
                // the redirect logic based on the now-updated DB status.
                setMessage('Setup skipped! Redirecting to your inbox...');
                navigate('/inbox');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save setup status.');
            }
        } catch (error) {
            if (error.message !== "Session expired") {
                setMessage(`Error: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Onboarding Functions ---
    const startOnboarding = async () => {
        setLoading(true);
        setMessage('Starting onboarding process...');
        
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/user/onboarding/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fetchDays, summaryDays })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start onboarding');
            }
            
            const data = await response.json();
            setCorrelationId(data.correlationId);
            setOnboardingStatus('in-progress');
            setMessage(`Onboarding started! Estimated time: ${data.estimatedTime}`);
            
            // Start progress tracking
            startProgressTracking(data.correlationId);
            
        } catch (error) {
            if (error.message !== "Session expired") {
                setMessage(`Error starting onboarding: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const startProgressTracking = (corrId) => {
        progressIntervalRef.current = setInterval(async () => {
            try {
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/user/onboarding/progress/${corrId}`);
                
                if (!response.ok) {
                    throw new Error('Failed to fetch progress');
                }
                
                const progress = await response.json();
                setOnboardingProgress(progress);
                
                if (progress.status === 'completed') {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                    setOnboardingStatus('completed');
                    setMessage('Onboarding completed successfully! Redirecting to inbox...');
                    
                    // Update user info to mark onboarding as completed
                    const userInfo = JSON.parse(localStorage.getItem('user_info'));
                    userInfo.onboardingCompleted = true;
                    localStorage.setItem('user_info', JSON.stringify(userInfo));
                    
                    // Redirect to inbox after a short delay
                    setTimeout(() => {
                        navigate('/inbox');
                    }, 2000);
                    
                } else if (progress.status === 'failed') {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                    setOnboardingStatus('not-started');
                    setMessage('Onboarding failed. Please try again.');
                }
                
            } catch (error) {
                if (error.message !== "Session expired") {
                    console.error('Error tracking progress:', error);
                }
            }
        }, 2000); // Poll every 2 seconds
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <LoaderIcon className="text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl">
                <header className="flex justify-between items-center mb-6 pb-4 border-b">
                    <h1 className="text-2xl font-bold text-gray-900">Email Processing Setup</h1>
                    {user && (
                        <div className="text-right">
                            <p className="text-gray-700 text-sm">Logged in as: <span className="font-semibold">{user.email}</span></p>
                            <button onClick={handleLogout} className="mt-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600">Logout</button>
                        </div>
                    )}
                </header>

                {message && <div className="p-3 mb-4 text-sm text-center rounded-lg bg-blue-100 text-blue-700">{message}</div>}

                {/* Onboarding Form */}
                {onboardingStatus === 'not-started' && (
                    <div className="max-w-2xl mx-auto py-10">
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-xl border">
                            <div className="text-center mb-6">
                                <div className="flex justify-center mb-4">
                                    <div className="bg-blue-100 p-3 rounded-full">
                                        <SparklesIcon className="h-8 w-8 text-blue-600" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to LMAA!</h2>
                                <p className="text-gray-600">Let's set up your email processing preferences</p>
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        How many days of emails should we fetch?
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={fetchDays}
                                        onChange={(e) => setFetchDays(Number(e.target.value))}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="15"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Recommended: 7-30 days</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        How many days should we generate summaries for?
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={fetchDays}
                                        value={summaryDays}
                                        onChange={(e) => setSummaryDays(Number(e.target.value))}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="15"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Must be ≤ fetch days</p>
                                </div>
                                
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="flex items-start">
                                        <ClockIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                                        <div>
                                            <h4 className="text-sm font-medium text-blue-900">Estimated Processing Time</h4>
                                            <p className="text-sm text-blue-700">
                                                ~{Math.ceil(fetchDays * 0.5)} minutes for {fetchDays} days of emails
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={startOnboarding}
                                    disabled={loading || summaryDays > fetchDays}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all"
                                >
                                    {loading ? (
                                        <LoaderIcon className="text-white" />
                                    ) : (
                                        <>
                                            <PlayIcon className="mr-2 h-5 w-5" />
                                            Start Email Processing
                                        </>
                                    )}
                                </button>

                                <div className="text-center mt-4">
                                     <button
                                         onClick={handleGoToInbox}
                                         disabled={loading}
                                         className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
                                     >
                                         Skip Setup - Go to Inbox
                                     </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Tracking */}
                {onboardingStatus === 'in-progress' && (
                    <div className="max-w-3xl mx-auto py-10">
                        <div className="bg-white p-8 rounded-xl border shadow-lg">
                            <div className="text-center mb-8">
                                <div className="flex justify-center mb-4">
                                    <div className="bg-blue-100 p-3 rounded-full">
                                        <LoaderIcon className="h-8 w-8 text-blue-600" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Emails</h2>
                                <p className="text-gray-600">Please wait while we fetch and analyze your emails</p>
                            </div>
                            
                            {onboardingProgress && (
                                <div className="space-y-6">
                                    {/* Overall Progress */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                                            <span className="text-sm text-gray-500">{onboardingProgress.percentage}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <div 
                                                className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                                                style={{width: `${onboardingProgress.percentage}%`}}
                                            ></div>
                                        </div>
                                    </div>
                                    
                                    {/* Sub-tasks */}
                                    {onboardingProgress.subTasks && (
                                        <div className="space-y-4">
                                            {Object.entries(onboardingProgress.subTasks).map(([taskId, task]) => (
                                                <div key={taskId} className="bg-gray-50 p-4 rounded-lg">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center">
                                                            {task.status === 'completed' ? (
                                                                <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                                                            ) : task.status === 'running' ? (
                                                                <LoaderIcon className="h-5 w-5 text-blue-600 mr-2" />
                                                            ) : (
                                                                <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                                                            )}
                                                            <span className="text-sm font-medium text-gray-700">
                                                                {taskId === 'email-fetch' ? 'Fetching Emails' : 'Generating AI Summaries'}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm text-gray-500">
                                                            {task.completed}/{task.total}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div 
                                                            className={`h-2 rounded-full transition-all duration-300 ${
                                                                task.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                                                            }`}
                                                            style={{width: `${(task.completed / task.total) * 100}%`}}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {onboardingProgress.currentAction && (
                                        <div className="text-center text-sm text-gray-600">
                                            {onboardingProgress.currentAction}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Completion State */}
                {onboardingStatus === 'completed' && (
                    <div className="max-w-2xl mx-auto py-10 text-center">
                        <div className="bg-green-50 p-8 rounded-xl border">
                            <div className="flex justify-center mb-4">
                                <div className="bg-green-100 p-3 rounded-full">
                                    <CheckCircleIcon className="h-8 w-8 text-green-600" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Onboarding Complete!</h2>
                            <p className="text-gray-600 mb-4">Your emails are now being processed with AI summaries.</p>
                            <p className="text-sm text-gray-500">Redirecting to your inbox...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OnboardingPage; 