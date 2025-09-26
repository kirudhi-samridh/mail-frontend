import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

// --- Icon Components (No changes needed) ---
const MailIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> );
const UserIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );
const InboxIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> );
const SparklesIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg> );

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
    
    const [labels, setLabels] = useState([]);
    const [activeLabel, setActiveLabel] = useState('INBOX');
    
    const [summarizingId, setSummarizingId] = useState(null);
    const [expandedEmailId, setExpandedEmailId] = useState(null);

    const googleClientRef = useRef(null);

    // --- Logout Function ---
    const handleLogout = () => { localStorage.clear(); setUser(null); setEmails([]); setIsGoogleConnected(false); setExpandedEmailId(null); setLabels([]); setActiveLabel('INBOX'); setMessage('Logged out successfully.'); };
    
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
            console.error("Failed to fetch labels:", error.message);
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
                    console.error("Could not verify Google connection status", error.message);
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
                    // --- UPDATED: Force consent screen to get a refresh token every time for testing ---
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
        if (expandedEmailId === emailId) {
            setExpandedEmailId(null);
            return;
        }
        setExpandedEmailId(emailId);
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

    const handleSummarizeEmail = async (e, emailId) => {
        e.stopPropagation();
        setSummarizingId(emailId);
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}/summarize`, { method: 'POST' });
            if (!response.ok) throw new Error('Failed to get summary.');
            const { summary } = await response.json();
            setEmails(currentEmails => currentEmails.map(mail => 
                mail.id === emailId ? { ...mail, summary: summary } : mail
            ));
        } catch (error) {
            if (error.message !== "Session expired") setMessage(`Error: ${error.message}`);
        } finally {
            setSummarizingId(null);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-7xl">
                 <header className="flex justify-between items-center mb-4 pb-4 border-b">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center"><MailIcon className="mr-3 text-blue-600" />SaaS Web Mail Client</h1>
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
                                        <div className="grid grid-cols-12 gap-4 items-center p-3 cursor-pointer" onClick={() => handleReadEmail(mail.id)}>
                                            <div className="col-span-3 font-medium text-gray-800 truncate">{mail.from.split('<')[0].trim()}</div>
                                            <div className="col-span-6 text-gray-600 truncate">{mail.subject}</div>
                                            <div className="col-span-3 flex justify-end items-center gap-2">
                                                <span className="text-xs text-gray-500">{new Date(mail.date).toLocaleDateString()}</span>
                                                <button onClick={(e) => handleSummarizeEmail(e, mail.id)} disabled={summarizingId === mail.id} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full disabled:text-gray-400" title="Summarize Email">
                                                    {summarizingId === mail.id ? <LoaderIcon className="h-4 w-4"/> : <SparklesIcon className="h-4 w-4"/>}
                                                </button>
                                            </div>
                                        </div>
                                        {expandedEmailId === mail.id && (
                                            <div className="p-4 ml-4 my-1 border-t">
                                                {mail.summary && (
                                                    <div className="p-4 mb-4 bg-blue-50 border-l-4 border-blue-400">
                                                        <h4 className="font-bold text-sm mb-2 text-blue-800">AI Summary</h4>
                                                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{mail.summary}</p>
                                                    </div>
                                                )}
                                                {mail.body ? (
                                                     <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mail.body) }} />
                                                ): (
                                                    <div className="flex justify-center p-6"><LoaderIcon/></div>
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
