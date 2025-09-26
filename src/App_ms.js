import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import './App.css';
import ClassificationTag from './ClassificationTag';

// --- Icon Components (No changes needed) ---
const MailIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> );
const UserIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );
const InboxIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> );
const SparklesIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg> );
const SpeakerWaveIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> );
const StopCircleIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><rect width="6" height="6" x="9" y="9"/></svg> );

// --- Configuration ---
const API_GATEWAY_URL = 'http://localhost:3001/api'; 
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID; 

function App() {
    // --- State Management ---
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isO365Connected, setIsO365Connected] = useState(false);
    
    const [labels, setLabels] = useState([]);
    const [activeLabel, setActiveLabel] = useState('INBOX');
    
    const [summarizingId, setSummarizingId] = useState(null);
    const [expandedEmailId, setExpandedEmailId] = useState(null);
    
    // Audio and accordion state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingEmailId, setSpeakingEmailId] = useState(null);
    const [activeAccordion, setActiveAccordion] = useState(null);

    const googleClientRef = useRef(null);

    // --- Logout Function ---
    const handleLogout = () => { setUser(null); setEmails([]); setIsGoogleConnected(false); setIsO365Connected(false); setExpandedEmailId(null); setLabels([]); setActiveLabel('INBOX'); setMessage('Logged out successfully.'); };
    
    // --- API Fetch Utility ---
    const authenticatedFetch = async (url, options = {}) => {
        const token = localStorage.getItem('jwt_token');
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            handleLogout();
            setMessage("Your session has expired. Please log in again.");
            throw new Error("Session expired");
        }
        return response;
    };


    // --- Effects ---

    // Define email and label fetching functions using useCallback for stability
    const handleFetchLabels = React.useCallback(async () => {
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/labels`);
            if(response.ok) {
                const data = await response.json();
                setLabels(data.labels || []);
            }
        } catch (error) {
            if (error.message !== "Session expired") console.error("Failed to fetch labels:", error.message);
        }
    }, []);
    
    const handleFetchEmails = React.useCallback(async (labelId) => {
        setLoading(true);
        setActiveLabel(labelId);
        setMessage(`Fetching emails from ${labelId}...`);
        setEmails([]);
        setExpandedEmailId(null);
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails?labelId=${labelId}`);
            if (response.ok) {
                const data = await response.json();
                const processedEmails = (data.messages || []).map(mail => ({ ...mail, summary: null, body: null }));
                setEmails(processedEmails);
                setMessage(processedEmails.length > 0 ? `Showing emails from ${labelId}` : `No emails found in ${labelId}.`);
            } else {
                const errorData = await response.json();
                setMessage(`Error fetching emails: ${errorData.message || 'Failed to fetch'}`);
            }
        } catch (error) { if (error.message !== "Session expired") setMessage('Network error during email fetch.'); } finally { setLoading(false); }
    }, []);

    // Effect to check for an existing session on initial load
    useEffect(() => {
        const checkUserStatus = async () => {
            const token = localStorage.getItem('jwt_token');
            const userInfo = localStorage.getItem('user_info');
            if (token && userInfo) {
                setUser(JSON.parse(userInfo));
                
                try {
                    const statusResponse = await authenticatedFetch(`${API_GATEWAY_URL}/auth/status`);
                    if (statusResponse.ok) {
                        const { isGoogleConnected } = await statusResponse.json();
                        if (isGoogleConnected) {
                            setIsGoogleConnected(true);
                            await handleFetchLabels();
                            await handleFetchEmails('INBOX');
                        }
                    }
                } catch (error) {
                    if (error.message !== "Session expired") console.error("Could not verify Google connection status", error.message);
                }
            }
        };
        checkUserStatus();
    }, [handleFetchLabels, handleFetchEmails]);

    // Effect to initialize the Google GSI client
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

    // --- Auth Functions ---
    const handleGoogleLoginSuccess = async (authCode) => { 
        setLoading(true); 
        setMessage('Connecting Google account...'); 
        try { 
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/auth/google/callback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: authCode }) }); 
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(errorData.message || 'Backend failed to exchange token.'); 
            } 
            setMessage('Successfully connected Google account!'); 
            setIsGoogleConnected(true);
            await handleFetchLabels();
            await handleFetchEmails('INBOX');
        } catch (error) { 
            if (error.message !== "Session expired") setMessage(`Error: ${error.message}`); 
        } finally { 
            setLoading(false); 
        } 
    };
    const triggerGoogleLogin = () => { if (googleClientRef.current) { googleClientRef.current.requestCode(); } else { setMessage("Google Login is not ready yet."); } };
    const handleAuthResponse = async (response) => { if (response.ok) { const data = await response.json(); localStorage.setItem('jwt_token', data.token); localStorage.setItem('user_info', JSON.stringify(data.user)); setUser(data.user); setMessage(`Successfully logged in!`); } else { const errorData = await response.json(); setMessage(`Error: ${errorData.message || 'Authentication failed'}`); } setLoading(false); };
    const handleSaaSLogin = async (e) => { e.preventDefault(); setLoading(true); setMessage(''); try { const response = await fetch(`${API_GATEWAY_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), }); await handleAuthResponse(response); } catch (error) { setMessage('Network error during login.'); setLoading(false); } };
    const handleSaaSSignup = async (e) => { e.preventDefault(); setLoading(true); setMessage(''); try { const response = await fetch(`${API_GATEWAY_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), }); await handleAuthResponse(response); } catch (error) { setMessage('Network error during signup.'); setLoading(false); } };
    

    // --- Email Interaction Functions ---
    const handleReadEmail = async (emailId) => {
        setExpandedEmailId(prevId => (prevId === emailId ? null : emailId));
        setActiveAccordion(null); // Reset accordion on new email expand
        // if (expandedEmailId === emailId) {
        //     setExpandedEmailId(null);
        //     return;
        // }
        // setExpandedEmailId(emailId);
        const currentEmail = emails.find(e => e.id === emailId);
        if (!currentEmail.body) {
            try {
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}`);
                if (!response.ok) throw new Error('Failed to fetch email content.');
                const emailData = await response.json();
                setEmails(currentEmails => currentEmails.map(mail => 
                    mail.id === emailId ? { ...mail, body: emailData.body } : mail
                ));
            } catch (error) {
                if (error.message !== "Session expired") setMessage(`Error: ${error.message}`);
            }
        }
    };

    const handlePlayAudio = (script, emailId) => {
        // First, check if the browser supports the Web Speech API
        if (!('speechSynthesis' in window)) {
            alert("Sorry, your browser does not support text-to-speech.");
            return;
        }
    
        // If we click the button while it's speaking, stop it
        if (isSpeaking && speakingEmailId === emailId) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            setSpeakingEmailId(null);
            return;
        }
    
        // Cancel any previous utterance before starting a new one
        window.speechSynthesis.cancel();
    
        const utterance = new SpeechSynthesisUtterance(script);
        
        // Event listener for when speech starts
        utterance.onstart = () => {
            setIsSpeaking(true);
            setSpeakingEmailId(emailId);
        };
    
        // Event listener for when speech ends (or is cancelled)
        utterance.onend = () => {
            setIsSpeaking(false);
            setSpeakingEmailId(null);
        };
    
        window.speechSynthesis.speak(utterance);
    };

    // const handleSummarizeEmail = async (e, emailId) => {
    //     e.stopPropagation();
    //     setSummarizingId(emailId);
    //     setExpandedEmailId(emailId);
    
    //     // Create a unique key for this email in local storage
    //     const cacheKey = `summary_cache_${emailId}`;
    
    //     try {
    //         // --- STEP 1: Check for cached data first ---
    //         const cachedData = localStorage.getItem(cacheKey);
    
    //         if (cachedData) {
    //             console.log(`Cache HIT for emailId: ${emailId}. Loading from localStorage.`);
    //             const responseData = JSON.parse(cachedData); // Parse the string back into an object
                
    //             // Update the state with the cached data
    //             setEmails(currentEmails =>
    //                 currentEmails.map(mail =>
    //                     mail.id === emailId
    //                         ? {
    //                             ...mail,
    //                             summary: responseData.summary_html_full,
    //                             summaryBreakdown: responseData.summary_html_breakdown,
    //                             summaryJson: responseData.summary_json,
    //                             isSummaryLoaded: true
    //                           }
    //                         : mail
    //                 )
    //             );
    //             setSummarizingId(null); // Finish loading state
    //             return; // Exit the function since we don't need to fetch
    //         }
    
    //         // --- STEP 2: If no cache, fetch from API ---
    //         console.log(`Cache MISS for emailId: ${emailId}. Fetching from API.`);
            
    //         // Immediately reset state to show a clean loading indicator
    //         setEmails(currentEmails =>
    //             currentEmails.map(mail =>
    //                 mail.id === emailId
    //                     ? { ...mail, isSummaryLoaded: false, summary: null, summaryBreakdown: null, summaryJson: null }
    //                     : mail
    //             )
    //         );
    
    //         const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}/summarize`, { method: 'POST' });
    //         if (!response.ok) throw new Error('Failed to get summary.');
            
    //         const responseData = await response.json();
            
    //         // --- STEP 3: Save the new data to the cache ---
    //         try {
    //             localStorage.setItem(cacheKey, JSON.stringify(responseData));
    //             console.log(`Saved summary for emailId: ${emailId} to cache.`);
    //         } catch (cacheError) {
    //             console.error("Failed to save summary to localStorage:", cacheError);
    //             // This is not a critical error, the app can continue without caching
    //         }
    
    //         // --- STEP 4: Update the state with the new data ---
    //         setEmails(currentEmails =>
    //             currentEmails.map(mail =>
    //                 mail.id === emailId
    //                     ? {
    //                         ...mail,
    //                         summary: responseData.summary_html_full,
    //                         summaryBreakdown: responseData.summary_html_breakdown,
    //                         summaryJson: responseData.summary_json,
    //                         isSummaryLoaded: true 
    //                       }
    //                     : mail
    //             )
    //         );
    
    //     } catch (error) {
    //         if (error.message !== "Session expired") setMessage(`Error: ${error.message}`);
    //         setEmails(currentEmails =>
    //             currentEmails.map(mail =>
    //                 mail.id === emailId ? { ...mail, summary: '<p>Error loading summary.</p>', isSummaryLoaded: true } : mail
    //             )
    //         );
    //     } finally {
    //         setSummarizingId(null);
    //     }
    // };

    const handleSummarizeEmail = async (e, emailId) => {
        e.stopPropagation();
        setSummarizingId(emailId);
        setExpandedEmailId(emailId);
    
        // Create a unique key for this email in local storage
        const cacheKey = `summary_cache_${emailId}`;
    
        try {
            // --- STEP 1: Always reset the summary state for this email first. ---
            // This gives us a clean slate and a consistent loading state.
            setEmails(currentEmails =>
                currentEmails.map(mail =>
                    mail.id === emailId
                        ? {
                            ...mail,
                            isSummaryLoaded: false,
                            summary: null,
                            summaryBreakdown: null,
                            summaryJson: null
                          }
                        : mail
                )
            );
    
            // --- STEP 2: Now, check for cached data ---
            const cachedData = localStorage.getItem(cacheKey);
    
            let responseData; // We'll populate this from either the cache or the API
    
            if (cachedData) {
                // CACHE HIT: Use the data from local storage
                console.log(`Cache HIT for emailId: ${emailId}.`);
                responseData = JSON.parse(cachedData);
            } else {
                // CACHE MISS: Fetch from the API
                console.log(`Cache MISS for emailId: ${emailId}.`);
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}/summarize`, { method: 'POST' });
                if (!response.ok) throw new Error('Failed to get summary.');
                
                responseData = await response.json();
                
                // Save the new data to the cache for next time
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(responseData));
                    console.log(`Saved summary for emailId: ${emailId} to cache.`);
                } catch (cacheError) {
                    console.error("Failed to save to localStorage:", cacheError);
                }
            }
    
            // --- STEP 3: Populate the state with the final data ---
            // This step is now the same for both cache hits and misses.
            if (responseData) {
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
            }
    
        } catch (error) {
            if (error.message !== "Session expired") setMessage(`Error: ${error.message}`);
            setEmails(currentEmails =>
                currentEmails.map(mail =>
                    mail.id === emailId ? { ...mail, summary: '<p>Error loading summary.</p>', isSummaryLoaded: true } : mail
                )
            );
        } finally {
            setSummarizingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-7xl">
                 <header className="flex justify-between items-center mb-4 pb-4 border-b">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center"><MailIcon className="mr-3 text-blue-600" />LMAA AI Email Assistant</h1>
                    {user && (
                         <div className="text-right">
                             <p className="text-gray-700 text-sm">Logged in as: <span className="font-semibold">{user.email}</span></p>
                             <button onClick={handleLogout} className="mt-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600">Logout</button>
                         </div>
                    )}
                </header>

                {message && <div className="p-3 mb-4 text-sm text-center rounded-lg bg-blue-100 text-blue-700">{message}</div>}

                {!user ? (
                    <div className="max-w-md mx-auto py-10"><h2 className="text-2xl font-semibold text-center mb-4">Login or Sign Up</h2><form className="space-y-4"><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border rounded-lg"/><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border rounded-lg"/><div className="flex gap-4"><button onClick={handleSaaSLogin} disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center disabled:opacity-50">{loading ? <LoaderIcon /> : <><UserIcon className="mr-2" />Login</>}</button><button onClick={handleSaaSSignup} disabled={loading} className="w-full bg-purple-600 text-white p-3 rounded-lg flex items-center justify-center disabled:opacity-50">{loading ? <LoaderIcon /> : 'Sign Up'}</button></div></form></div>
                ) : (
                    <div className="flex gap-6">
                        <aside className="w-64 flex-shrink-0">
                            <h2 className="text-lg font-semibold mb-4 px-2">Mailboxes</h2>
                            <nav className="space-y-1">
                                {labels.map(label => (
                                    <button key={label.id} onClick={() => handleFetchEmails(label.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${activeLabel === label.id ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-gray-100'}`}>
                                        <InboxIcon className="h-5 w-5"/> {label.name}
                                    </button>
                                ))}
                            </nav>
                             <div className="mt-4 border-t pt-4">
                                <button onClick={triggerGoogleLogin} disabled={isGoogleConnected || loading} className="w-full bg-gray-100 p-3 rounded-lg border flex items-center justify-center disabled:opacity-50 text-sm"><img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5 mr-2" />{isGoogleConnected ? 'Gmail Connected' : 'Connect Gmail'}</button>
                                <button onClick={triggerO365Login} disabled={isO365Connected || loading} className="w-full bg-gray-100 p-3 rounded-lg border flex items-center justify-center disabled:opacity-50 text-sm"><img src="https://www.microsoft.com/favicon.ico" alt="Microsoft" className="h-5 w-5 mr-2" />{isO365Connected ? 'O365 Connected' : 'Connect O365'}</button>
                            </div>
                        </aside>

                        <main className="flex-1 bg-gray-50 p-4 rounded-lg border min-w-0">
                            <div className="flex justify-between items-center mb-4">
                               <h2 className="text-xl font-semibold">Folder: {activeLabel}</h2>
                               <button onClick={() => handleFetchEmails(activeLabel)} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50 text-sm">{loading ? <LoaderIcon className="text-white" /> : 'Refresh'}</button>
                            </div>
                            

                            <div className="space-y-1">
                                {emails.length > 0 ? emails.map((mail) => (
                                    <div key={mail.id} className="bg-white rounded-lg border transition-shadow duration-200 hover:shadow-md" >
                                        
                                        {/* This is the clickable email header row */}
                                        <div className="grid grid-cols-12 gap-4 items-center p-3 cursor-pointer" onClick={() => handleReadEmail(mail.id)}>
                                            
                                            <div className="col-span-3 font-medium text-gray-800 truncate">
                                                {mail.from.split('<')[0].trim()}
                                            </div>

                                            {/* This div correctly displays the Classification Tag and the Subject */}
                                            <div className="col-span-6 text-gray-600 truncate flex items-center gap-2">
                                                <ClassificationTag classification={mail.summaryJson?.classification} />
                                                <span>{mail.subject}</span>
                                            </div>

                                            <div className="col-span-3 flex justify-end items-center gap-2">
                                                <span className="text-xs text-gray-500">
                                                    {new Date(mail.date).toLocaleDateString()}
                                                </span>
                                                <button onClick={(e) => handleSummarizeEmail(e, mail.id)} disabled={summarizingId === mail.id} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full disabled:text-gray-400" title="Summarize Email">
                                                    {summarizingId === mail.id ? <LoaderIcon className="h-4 w-4"/> : <SparklesIcon className="h-4 w-4"/>}
                                                </button>
                                            </div>
                                        </div>

                                        {/* --- THIS IS THE CORRECTED EXPANDABLE SECTION --- */}
                                        {/* The entire block is now correctly wrapped in { } to be executed as JavaScript */}
                                        {expandedEmailId === mail.id && (
                                            <div className="p-4 ml-4 my-1 border-t space-y-6">

                                                {/* --- SECTION 1: ORIGINAL EMAIL (Always visible when expanded) --- */}
                                                <div className="original-content-group">
                                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Original Email</h3>
                                                    <div className="border rounded-lg p-4 bg-white h-96 overflow-y-auto prose max-w-none shadow-sm">
                                                        {mail.body ? (
                                                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mail.body) }} />
                                                        ) : (
                                                            <div className="flex justify-center items-center h-full text-gray-500">
                                                                <LoaderIcon/>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* --- SECTION 2: AI SUMMARY (Appears below after loading) --- */}
                                                
                                                {/* Loading State Display */}
                                                {summarizingId === mail.id && !mail.isSummaryLoaded && (
                                                    <div className="flex items-center text-blue-600 p-4 border rounded-lg bg-white">
                                                        <LoaderIcon className="mr-2"/>Generating AI Summary...
                                                    </div>
                                                )}

                                                {/* The entire AI Summary accordion only appears AFTER summarization is complete */}
                                                {mail.isSummaryLoaded && (
                                                    <div className="summary-accordion-group">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <h3 className="text-lg font-bold text-gray-800">AI-Powered Summary</h3>
                                                            {mail.summaryJson?.audioScript && (
                                                                <button 
                                                                    onClick={() => handlePlayAudio(mail.summaryJson.audioScript, mail.id)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                                                                    title={isSpeaking && speakingEmailId === mail.id ? "Stop Audio" : "Play Audio Summary"}
                                                                >
                                                                    {isSpeaking && speakingEmailId === mail.id ? (
                                                                        <StopCircleIcon className="h-6 w-6 text-red-600"/>
                                                                    ) : (
                                                                        <SpeakerWaveIcon className="h-6 w-6"/>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="accordion-container space-y-2">
                                                            {(() => {
                                                                const classification = mail.summaryJson?.classification;
                                                                return (
                                                                    <>
                                                                        {/* 1. Custom Accordion Item for Classification */}
                                                                        {classification && classification.category && (
                                                                            <details 
                                                                                key="classification" 
                                                                                className="group border rounded-lg overflow-hidden bg-white shadow-sm"
                                                                                open={activeAccordion === 'classification'}
                                                                            >
                                                                                <summary 
                                                                                    className="accordion-title bg-blue-50 p-3 font-semibold cursor-pointer list-none flex justify-between items-center group-hover:bg-blue-100"
                                                                                    onClick={(e) => { e.preventDefault(); setActiveAccordion(prev => prev === 'classification' ? null : 'classification'); }}
                                                                                >
                                                                                    <span>Category - <span className="font-bold">{classification.category}</span></span>
                                                                                    <span className="text-gray-500 group-open:rotate-90 transform transition-transform duration-200">▶</span>
                                                                                </summary>
                                                                                <div className="p-4 border-t text-sm space-y-2">
                                                                                    {classification.confidenceScore != null && (
                                                                                        <div><strong>Confidence:</strong> {Math.round(classification.confidenceScore * 100)}%</div>
                                                                                    )}
                                                                                    {classification.keywordsFound && classification.keywordsFound.length > 0 && classification.keywordsFound[0] && (
                                                                                        <div>
                                                                                            <strong>Keywords Found:</strong>
                                                                                            <ul className="list-disc list-inside ml-2 mt-1">
                                                                                                {classification.keywordsFound.map((keyword, index) => <li key={index}>{keyword}</li>)}
                                                                                            </ul>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </details>
                                                                        )}

                                                                        {/* 2. Accordion Items for all other summary parts */}
                                                                        {mail.summaryBreakdown && Object.keys(mail.summaryBreakdown)
                                                                            .filter(sectionKey => sectionKey.toLowerCase() !== 'classification')
                                                                            .map(sectionKey => (
                                                                                <details 
                                                                                    key={sectionKey} 
                                                                                    className="group border rounded-lg overflow-hidden bg-white shadow-sm"
                                                                                    open={activeAccordion === sectionKey}
                                                                                >
                                                                                    <summary 
                                                                                        className="accordion-title bg-gray-50 p-3 font-semibold cursor-pointer list-none flex justify-between items-center group-hover:bg-gray-100"
                                                                                        onClick={(e) => { e.preventDefault(); setActiveAccordion(prev => prev === sectionKey ? null : sectionKey); }}
                                                                                    >
                                                                                        {sectionKey.replace(/([A-Z])/g, ' $1').trim()}
                                                                                        <span className="text-gray-500 group-open:rotate-90 transform transition-transform duration-200">▶</span>
                                                                                    </summary>
                                                                                    <div 
                                                                                        className="p-4 border-t"
                                                                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mail.summaryBreakdown[sectionKey]) }}
                                                                                    />
                                                                                </details>
                                                                            ))}

                                                                        {/* --- 3. THE FIX IS HERE: Accordion Item for the Full Summary --- */}
                                                                        {mail.summary && (
                                                                            <details 
                                                                                key="full_summary"
                                                                                className="group border rounded-lg overflow-hidden bg-white shadow-sm"
                                                                                open={activeAccordion === 'full_summary'}
                                                                            >
                                                                                <summary 
                                                                                    className="accordion-title bg-gray-50 p-3 font-semibold cursor-pointer list-none flex justify-between items-center group-hover:bg-gray-100"
                                                                                    onClick={(e) => { e.preventDefault(); setActiveAccordion(prev => prev === 'full_summary' ? null : 'full_summary'); }}
                                                                                >
                                                                                    View Full Summary (Combined)
                                                                                    <span className="text-gray-500 group-open:rotate-90 transform transition-transform duration-200">▶</span>
                                                                                </summary>
                                                                                <div
                                                                                    className="p-4 border-t"
                                                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mail.summary) }}
                                                                                />
                                                                            </details>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )) : <p className="text-center text-gray-500 pt-10">No emails found. Select a label or click Refresh.</p>}
                            </div>
                        </main>
                    </div>
                )}
            </div>
        </div>
    );
}
export default App;
