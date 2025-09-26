import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ClassificationTag from '../ClassificationTag';
import { generateDailyDigest, getAllDailyDigests, speakText, stopSpeech, getAvailableSummaryDates, getSummaryCountForDate, getSummaryCountByProviderForDate } from '../utils/dailyDigestUtils';
import { io } from "socket.io-client";
import { clearLocalStorageExceptSummaries } from '../utils/storageUtils';

// --- Icon Components ---
const MailIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );
const InboxIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> );
const SparklesIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg> );
const CalendarIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> );
const VolumeIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> );
const StopIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg> );
const VideoIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg> );

// --- Configuration ---
const API_GATEWAY_URL = 'http://localhost:3001/api';

function MailListPage() {
    const navigate = useNavigate();
    
    // --- State Management ---
    const [user, setUser] = useState(null);
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true); // Start with loading true
    const [message, setMessage] = useState('');
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isO365Connected, setIsO365Connected] = useState(false);
    
    const [labels, setLabels] = useState([]);
    const [activeLabel, setActiveLabel] = useState('INBOX');
    
    const [summarizingId, setSummarizingId] = useState(null);
    
    // Daily Digest states
    const [showDailyDigest, setShowDailyDigest] = useState(false);
    const [dailyDigest, setDailyDigest] = useState(null);
    const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
    const [digestDate, setDigestDate] = useState(new Date().toISOString().split('T')[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

    // New state for email selection
    const [selectedEmails, setSelectedEmails] = useState(new Set());
    const [isSummarizingBatch, setIsSummarizingBatch] = useState(false);

    // --- Check for authentication on component mount ---
    useEffect(() => {
        const checkUserStatusAndFetchData = async () => {
            const token = localStorage.getItem('jwt_token');
            const userInfo = localStorage.getItem('user_info');
            
            if (!token || !userInfo) {
                navigate('/login');
                return;
            }
            
            const userData = JSON.parse(userInfo);
            setUser(userData);
            
            try {
                console.log('[MAILLIST] Checking authentication status...');
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/auth/status`);
                
                if (response.ok) {
                    const statusData = await response.json();
                    console.log('[MAILLIST] Status response:', statusData);
                    
                    // Set connection status immediately from backend response
                    setIsGoogleConnected(statusData.isGoogleConnected);
                    setIsO365Connected(statusData.isO365Connected);
                    console.log('[MAILLIST] Connection status set:', { 
                        isGoogleConnected: statusData.isGoogleConnected, 
                        isO365Connected: statusData.isO365Connected 
                    });
                    
                    // Check if onboarding is complete
                    if (!statusData.onboardingCompleted) {
                        console.log('[MAILLIST] Onboarding not complete, redirecting to /connect');
                        navigate('/connect');
                        return;
                    }
                    
                    console.log('[MAILLIST] Onboarding complete, loading inbox...');
                    
                    // If we have connected accounts, fetch data
                    if (statusData.isGoogleConnected || statusData.isO365Connected) {
                        console.log('[MAILLIST] Fetching labels and emails...');
                        await handleFetchLabels();
                        await handleFetchEmails('INBOX');
                    } else {
                        // This should not happen if onboarding is complete, but handle it gracefully
                        console.warn('[MAILLIST] Onboarding complete but no connected accounts found');
                        setMessage('Onboarding is complete, but no email services are currently connected.');
                        setLoading(false);
                    }
                } else {
                    const errorData = await response.json();
                    console.error('[MAILLIST] Status check failed:', errorData);
                    setMessage(errorData.message || 'Error checking email service connection.');
                    setLoading(false);
                }
            } catch (error) {
                console.error('[MAILLIST] Error in status check:', error);
                if (error.message !== "Session expired") {
                    setMessage('Error checking email service connection. Please try refreshing the page.');
                }
                setLoading(false);
            }
        };
        
        checkUserStatusAndFetchData();
    }, [navigate]);

    // --- WebSocket Connection ---
    useEffect(() => {
        if (user) {
            // Connect to the WebSocket server
            const socket = io("http://localhost:3003");

            socket.on('connect', () => {
                console.log('[SOCKET.IO] Connected to server!');
                // Join a room for this user to receive targeted updates
                socket.emit('join-room', user.id);
            });

            // Listen for summary completion events
            socket.on('summary-complete', (data) => {
                console.log('[SOCKET.IO] Received summary-complete event:', data);
                const { emailId, summary } = data;

                // Update the UI
                setEmails(currentEmails =>
                    currentEmails.map(email => {
                        if (email.id === emailId) {
                            // Update cache
                            const cacheKey = `summary_cache_${emailId}`;
                            const cacheData = {
                                ...summary,
                                cachedAt: new Date().toISOString(),
                                emailId: emailId,
                                emailDate: email.date,
                                emailSubject: email.subject
                            };
                            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                            
                            // Update state
                            return {
                                ...email,
                                summary: summary.summary_html_full,
                                summaryBreakdown: summary.summary_html_breakdown,
                                summaryJson: summary.summary_json,
                                isSummaryLoaded: true,
                            };
                        }
                        return email;
                    })
                );
            });

            // Disconnect on component unmount
            return () => {
                console.log('[SOCKET.IO] Disconnecting...');
                socket.disconnect();
            };
        }
    }, [user]);

    // --- API Fetch Utility ---
    const authenticatedFetch = async (url, options = {}) => {
        const token = localStorage.getItem('jwt_token');
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        
        try {
            const response = await fetch(url, { ...options, headers });
            if (response.status === 401 || response.status === 403) {
                // If the token is invalid or expired, trigger a clean logout
                console.log('Session expired or token invalid. Logging out.');
                handleLogout(); 
                // Throw an error to stop further processing in the calling function
                throw new Error("Session expired");
            }
            return response;
        } catch (error) {
            // Handle network errors or other exceptions
            console.error('Fetch error:', error);
            // We can re-throw the error to be handled by the caller
            throw error;
        }
    };

    // --- Logout Function ---
    const handleLogout = () => {
        console.log('Logging out user and clearing session data...');
        
        // Use the selective clear function
        clearLocalStorageExceptSummaries();
        sessionStorage.clear();
        
        // Reset all component state
        setUser(null);
        setEmails([]);
        setIsGoogleConnected(false);
        setIsO365Connected(false);
        setLabels([]);
        setActiveLabel('INBOX');
        setMessage('');
        
        // Use navigate for a soft redirect within the React app
        navigate('/login', { replace: true });
    };

    // --- Email and Label Fetching Functions ---
    const handleFetchLabels = async () => {
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/labels`);
            if (response.ok) {
                const data = await response.json();
                setLabels(data.labels || []);
            }
        } catch (error) {
            if (error.message !== "Session expired") {
                console.error("Failed to fetch labels:", error.message);
            }
        }
    };
    
    const handleFetchEmails = async (labelId) => {
        setLoading(true);
        setActiveLabel(labelId);
        setMessage(`Fetching emails from ${labelId}...`);
        setEmails([]);
        
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails?labelId=${labelId}`);
            if (response.ok) {
                const data = await response.json();
                const processedEmails = (data.messages || []).map(mail => {
                    // Check if we have a cached summary for this email
                    const cacheKey = `summary_cache_${mail.id}`;
                    const cachedData = localStorage.getItem(cacheKey);
                    let summaryData = null;
                    
                    if (cachedData) {
                        try {
                            const parsed = JSON.parse(cachedData);
                            summaryData = {
                                summary: parsed.summary_html_full,
                                summaryBreakdown: parsed.summary_html_breakdown,
                                summaryJson: parsed.summary_json,
                                isSummaryLoaded: true
                            };
                        } catch (error) {
                            console.error(`Error parsing cached summary for ${mail.id}:`, error);
                        }
                    }
                    
                    return { 
                        ...mail, 
                        summary: summaryData?.summary || null, 
                        summaryBreakdown: summaryData?.summaryBreakdown || null,
                        summaryJson: summaryData?.summaryJson || null,
                        isSummaryLoaded: summaryData?.isSummaryLoaded || false,
                        body: null 
                    };
                });
                setEmails(processedEmails);
                setMessage(processedEmails.length > 0 ? `Showing emails from ${labelId}` : `No emails found in ${labelId}.`);
            } else {
                const errorData = await response.json();
                setMessage(`Error fetching emails: ${errorData.message || 'Failed to fetch'}`);
            }
        } catch (error) {
            if (error.message !== "Session expired") {
                setMessage('Network error during email fetch.');
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Email Selection Handlers ---
    const handleSelectEmail = (emailId) => {
        setSelectedEmails(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(emailId)) {
                newSelected.delete(emailId);
            } else {
                newSelected.add(emailId);
            }
            return newSelected;
        });
    };

    const handleSelectAll = () => {
        if (selectedEmails.size === emails.length && emails.length > 0) {
            setSelectedEmails(new Set());
        } else {
            const allEmailIds = new Set(emails.map(email => email.id));
            setSelectedEmails(allEmailIds);
        }
    };

    const handleBatchSummarize = async () => {
        setIsSummarizingBatch(true);
        setMessage(`Starting summarization for ${selectedEmails.size} emails. This will happen in the background.`);

        try {
            // NOTE: The endpoint /api/summarize-batch doesn't exist yet. This will be created in a later step.
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/summarize-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ emailIds: Array.from(selectedEmails) }),
            });

            if (response.ok) {
                const result = await response.json();
                setSelectedEmails(new Set());
                setMessage(result.message || 'Emails queued for summarization. The UI will update as each summary is completed.');
                
                // Clear the message after a few seconds
                setTimeout(() => {
                    setMessage('');
                }, 5000);
            } else {
                const errorData = await response.json();
                setMessage(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.message !== "Session expired") {
                setMessage('Network error during batch summarization.');
            }
        } finally {
            setIsSummarizingBatch(false);
        }
    };

    // --- Quick Summarize Function ---
    const handleQuickSummarize = async (e, emailId) => {
        e.preventDefault();
        e.stopPropagation();
        setSummarizingId(emailId);
        
        const cacheKey = `summary_cache_${emailId}`;
        
        try {
            // Check cache first
            const cachedData = localStorage.getItem(cacheKey);
            let responseData;
            
            if (cachedData) {
                responseData = JSON.parse(cachedData);
            } else {
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}/summarize`, { method: 'POST' });
                if (!response.ok) throw new Error('Failed to get summary.');
                
                responseData = await response.json();
                
                // Cache the summary with timestamp and email date
                try {
                    // Find the email in current emails to get its date
                    const currentEmail = emails.find(mail => mail.id === emailId);
                    const cacheData = {
                        ...responseData,
                        cachedAt: new Date().toISOString(),
                        emailId: emailId,
                        emailDate: currentEmail?.date || new Date().toISOString(),
                        emailSubject: currentEmail?.subject || 'No Subject'
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                    console.log(`Saved summary for emailId: ${emailId} with date: ${cacheData.emailDate} to cache.`);
                } catch (cacheError) {
                    console.error("Failed to save to localStorage:", cacheError);
                }
            }
            
            // Update the email in the list with summary data
            setEmails(currentEmails =>
                currentEmails.map(mail =>
                    mail.id === emailId
                        ? {
                            ...mail,
                            summary: responseData.summary_html_full,
                            summaryBreakdown: responseData.summary_html_breakdown,
                            summaryJson: responseData.summary_json,
                            isSummaryLoaded: true 
                          }
                        : mail
                )
            );
            
        } catch (error) {
            if (error.message !== "Session expired") {
                setMessage(`Error: ${error.message}`);
            }
        } finally {
            setSummarizingId(null);
        }
    };

    // --- Daily Digest Functions ---
    const handleGenerateDailyDigest = async (selectedDate = null) => {
        const targetDate = selectedDate || digestDate;
        setIsGeneratingDigest(true);
        setMessage('Generating daily digest...');
        
        try {
            const result = await generateDailyDigest(targetDate);
            
            if (result.success) {
                setDailyDigest(result.digest);
                setShowDailyDigest(true);
                setMessage(result.fromCache ? 'Daily digest loaded from cache' : 'Daily digest generated successfully');
            } else {
                setMessage(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error generating daily digest:', error);
            setMessage('Failed to generate daily digest');
        } finally {
            setIsGeneratingDigest(false);
        }
    };

    const handleDateChange = (event) => {
        const selectedDate = event.target.value;
        setDigestDate(selectedDate);
    };

    const handleShowCalendar = () => {
        setShowDailyDigest(true);
        setDailyDigest(null); // Clear existing digest to show calendar
    };

    const handlePlayAudio = () => {
        if (!dailyDigest || !dailyDigest.audioScript) {
            setMessage('No audio script available');
            return;
        }

        if (isPlaying) {
            stopSpeech();
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
            speakText(dailyDigest.audioScript, {
                onStart: () => setIsPlaying(true),
                onEnd: () => setIsPlaying(false),
                onError: () => {
                    setIsPlaying(false);
                    setMessage('Error playing audio');
                }
            });
        }
    };

    const handleCloseDailyDigest = () => {
        setShowDailyDigest(false);
        setDailyDigest(null);
        if (isPlaying) {
            stopSpeech();
            setIsPlaying(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!dailyDigest || !dailyDigest.digestJson?.audioScript || !dailyDigest.digestHtml) {
            setMessage("Not enough data to generate video.");
            return;
        }

        setIsGeneratingVideo(true);
        setMessage("Generating video, this may take a moment...");

        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/daily-digest/generate-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioScript: dailyDigest.digestJson.audioScript,
                    digestHtml: dailyDigest.digestHtml,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to generate video.");
            }

            const videoBlob = await response.blob();
            const url = window.URL.createObjectURL(videoBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `daily_digest_${dailyDigest.date}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            setMessage("Video downloaded successfully.");

        } catch (error) {
            setMessage(`Error generating video: ${error.message}`);
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <LoaderIcon className="mx-auto mb-4" />
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm border-b px-6 py-4 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <MailIcon className="mr-3 text-blue-600" />
                        LMAA AI Email Assistant
                    </h1>
                    <div className="text-right">
                        <p className="text-gray-700 text-sm">
                            Logged in as: <span className="font-semibold">{user.email}</span>
                        </p>
                        <button 
                            onClick={handleLogout} 
                            className="mt-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Message Bar */}
            {message && (
                <div className="p-3 text-sm text-center bg-blue-100 text-blue-700 border-b">
                    {message}
                </div>
            )}

            {/* Main Content */}
            <div className="flex flex-1 min-h-0">
                {/* Sidebar */}
                <aside className="w-64 bg-white shadow-sm border-r flex-shrink-0">
                    <div className="p-4">
                        <h2 className="text-lg font-semibold mb-4">Mailboxes</h2>
                        <nav className="space-y-1">
                            {labels.map(label => (
                                <button 
                                    key={label.id} 
                                    onClick={() => handleFetchEmails(label.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                        activeLabel === label.id 
                                            ? 'bg-blue-100 text-blue-700 font-semibold' 
                                            : 'hover:bg-gray-100'
                                    }`}
                                >
                                    <InboxIcon className="h-5 w-5"/> 
                                    <span className="flex-1">{label.name}</span>
                                    {isGoogleConnected && isO365Connected && (
                                        <span className="text-xs text-gray-500">
                                            {label.source === 'google' ? 'G' : label.source === 'o365' ? 'M' : ''}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                        
                        <div className="mt-6 pt-4 border-t">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4" />
                                    <span className={isGoogleConnected ? 'text-green-600' : 'text-gray-400'}>
                                        {loading ? 'Checking...' : (isGoogleConnected ? 'Gmail Connected' : 'Gmail Disconnected')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <img src="https://www.microsoft.com/favicon.ico" alt="Microsoft" className="h-4 w-4" />
                                    <span className={isO365Connected ? 'text-green-600' : 'text-gray-400'}>
                                        {loading ? 'Checking...' : (isO365Connected ? 'O365 Connected' : 'O365 Disconnected')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Email List */}
                <main className="flex-1 bg-gray-50 overflow-hidden">
                    <div className="p-6 h-full flex flex-col">
                        {/* List Header */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-semibold">Folder: {activeLabel}</h2>
                                <p className="text-sm text-gray-500">
                                    {isGoogleConnected && isO365Connected ? 'Gmail & O365 Connected' : 
                                     isGoogleConnected ? 'Gmail Connected' : 
                                     isO365Connected ? 'O365 Connected' : 
                                     'No email service connected'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {isSummarizingBatch && <LoaderIcon className="text-blue-500" />}
                                {selectedEmails.size > 0 && (
                                    <button
                                        onClick={handleBatchSummarize}
                                        disabled={isSummarizingBatch}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50 text-sm hover:bg-blue-700 transition-colors"
                                    >
                                        <SparklesIcon className="h-4 w-4 mr-2" />
                                        <span>Summarize ({selectedEmails.size})</span>
                                    </button>
                                )}
                                <button 
                                    onClick={handleShowCalendar} 
                                    disabled={isGeneratingDigest} 
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50 text-sm hover:bg-purple-700 transition-colors"
                                >
                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                    Daily Digest
                                </button>
                                <button 
                                    onClick={() => handleFetchEmails(activeLabel)} 
                                    disabled={loading} 
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50 text-sm hover:bg-green-700 transition-colors"
                                >
                                    {loading ? <LoaderIcon className="text-white" /> : 'Refresh'}
                                </button>
                            </div>
                        </div>
                        
                        {/* Email List */}
                        <div className="flex-1 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th scope="col" className="p-4">
                                            <input 
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                onChange={handleSelectAll}
                                                checked={emails.length > 0 && selectedEmails.size === emails.length}
                                                aria-label="Select all emails"
                                            />
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            From
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Subject
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th scope="col" className="relative px-6 py-3">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {emails.length > 0 ? emails.map((mail) => (
                                        <tr 
                                            key={mail.id} 
                                            onClick={() => navigate(`/email/${mail.id}`)}
                                            className={`cursor-pointer transition-colors duration-150 ${selectedEmails.has(mail.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedEmails.has(mail.id)}
                                                    onChange={() => handleSelectEmail(mail.id)}
                                                    aria-labelledby={`subject-${mail.id}`}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 truncate" style={{maxWidth: '200px'}}>{mail.from}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2" style={{maxWidth: '450px'}}>
                                                    {mail.isSummaryLoaded && mail.summaryJson?.classification && (
                                                        <div className="flex-shrink-0">
                                                            <ClassificationTag classification={mail.summaryJson.classification} />
                                                        </div>
                                                    )}
                                                    <span id={`subject-${mail.id}`} className="truncate min-w-0">{mail.subject}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(mail.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickSummarize(e, mail.id);
                                                    }} 
                                                    disabled={summarizingId === mail.id} 
                                                    className={`p-2 rounded-full disabled:text-gray-400 transition-colors ${
                                                        mail.isSummaryLoaded 
                                                            ? 'text-green-600 hover:bg-green-100' 
                                                            : 'text-blue-600 hover:bg-blue-100'
                                                    }`}
                                                    title={mail.isSummaryLoaded ? "View Summary" : "Generate Summary"}
                                                >
                                                    {summarizingId === mail.id ? <LoaderIcon className="h-4 w-4"/> : <SparklesIcon className="h-4 w-4"/>}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center text-gray-500 pt-20">
                                                <MailIcon className="mx-auto h-12 w-12 mb-4 text-gray-300" />
                                                <p>No emails found. Select a label or click Refresh.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>

            {/* Daily Digest Modal */}
            {showDailyDigest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 daily-digest-modal">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden modal-content">
                        {/* Modal Header */}
                        <div className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="h-6 w-6" />
                                <div>
                                    <h2 className="text-xl font-bold">Daily Email Digest</h2>
                                    <p className="text-purple-100 text-sm">
                                        {dailyDigest ? 
                                            new Date(dailyDigest.date).toLocaleDateString('en-US', { 
                                                weekday: 'long', 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            }) : 
                                            'Select a date to generate digest'
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {dailyDigest && (
                                    <button 
                                        onClick={handlePlayAudio}
                                        className={`bg-purple-500 hover:bg-purple-400 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors audio-button ${isPlaying ? 'playing' : ''}`}
                                        title={isPlaying ? "Stop Audio" : "Play Audio Summary"}
                                    >
                                        {isPlaying ? <StopIcon className="h-4 w-4" /> : <VolumeIcon className="h-4 w-4" />}
                                        {isPlaying ? 'Stop' : 'Listen'}
                                    </button>
                                )}
                                <button 
                                    onClick={handleCloseDailyDigest}
                                    className="bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] daily-digest-content">
                            {!dailyDigest ? (
                                /* Calendar Date Selection */
                                <div className="text-center">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Date for Daily Digest</h3>
                                        <div className="flex justify-center items-center gap-4">
                                            <label htmlFor="digest-date" className="text-sm font-medium text-gray-700">
                                                Choose Date:
                                            </label>
                                            <input
                                                type="date"
                                                id="digest-date"
                                                value={digestDate}
                                                onChange={handleDateChange}
                                                max={new Date().toISOString().split('T')[0]}
                                                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                            <button
                                                onClick={() => handleGenerateDailyDigest(digestDate)}
                                                disabled={isGeneratingDigest}
                                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                                            >
                                                {isGeneratingDigest ? (
                                                    <>
                                                        <LoaderIcon className="h-4 w-4" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <SparklesIcon className="h-4 w-4" />
                                                        Generate Digest
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Available Dates Preview */}
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h4 className="font-medium text-gray-800 mb-3">Available Email Summaries</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                            {(() => {
                                                const availableDates = getAvailableSummaryDates();
                                                return availableDates.slice(0, 10).map(date => {
                                                    const summaryCount = getSummaryCountForDate(date);
                                                    const providerCounts = getSummaryCountByProviderForDate(date);
                                                    
                                                    // Create tooltip with provider breakdown
                                                    const tooltipParts = [];
                                                    if (providerCounts.gmail > 0) tooltipParts.push(`${providerCounts.gmail} Gmail`);
                                                    if (providerCounts.outlook > 0) tooltipParts.push(`${providerCounts.outlook} Outlook`);
                                                    if (providerCounts.unknown > 0) tooltipParts.push(`${providerCounts.unknown} Other`);
                                                    const tooltip = `${summaryCount} total emails: ${tooltipParts.join(', ')}`;
                                                    
                                                    return (
                                                        <button
                                                            key={date}
                                                            onClick={() => {
                                                                setDigestDate(date);
                                                                handleGenerateDailyDigest(date);
                                                            }}
                                                            className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 p-2 rounded transition-colors border border-purple-200"
                                                            title={tooltip}
                                                        >
                                                            <div className="font-medium">
                                                                {new Date(date).toLocaleDateString('en-US', { 
                                                                    month: 'short', 
                                                                    day: 'numeric' 
                                                                })}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {summaryCount} emails
                                                            </div>
                                                            {(providerCounts.gmail > 0 && providerCounts.outlook > 0) && (
                                                                <div className="text-xs text-blue-500 flex items-center justify-center gap-1">
                                                                    <span>📧</span>
                                                                    <span>📨</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        {(() => {
                                            const availableDates = getAvailableSummaryDates();
                                            return availableDates.length === 0 ? (
                                                <p className="text-gray-500 text-center mt-4">
                                                    No email summaries found. Generate some email summaries first to create daily digests.
                                                </p>
                                            ) : (
                                                <p className="text-gray-600 text-center mt-2 text-xs">
                                                    Showing recent {Math.min(availableDates.length, 10)} dates with email summaries
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                /* Digest Display */
                                <>
                                    <div className="mb-6">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <h3 className="font-semibold text-gray-800 mb-2">Summary Overview</h3>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-600">Total Emails:</span>
                                                    <span className="font-semibold ml-2">{dailyDigest.totalEmails}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600">Generated:</span>
                                                    <span className="font-semibold ml-2">
                                                        {new Date(dailyDigest.generatedAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Digest Content */}
                                    <div 
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: dailyDigest.digestHtml }}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MailListPage; 