import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify'; // <-- Import the sanitizer

// --- Icon Components (No changes needed) ---
const MailIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> );
const UserIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );
const CloseIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> );

// --- Configuration ---
const API_GATEWAY_URL = 'http://localhost:3001/api'; 
const GOOGLE_CLIENT_ID = "457452182711-i3p81h9k5knvnnohbbk9oufe6hql2o54.apps.googleusercontent.com"; // IMPORTANT: Replace this

function App() {
    // --- State Management ---
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState(null); // Holds the full email content
    const [isEmailLoading, setIsEmailLoading] = useState(false); // Loading state for a single email
    const [isSummarizing, setIsSummarizing] = useState(false); // Loading state for summarization

    const googleClientRef = useRef(null);

    // --- Effects (No changes needed) ---
    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        const userInfo = localStorage.getItem('user_info');
        if (token && userInfo) {
            setUser(JSON.parse(userInfo));
            setMessage('Welcome back!');
        }
    }, []);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
        script.onload = () => {
            if (window.google) {
                googleClientRef.current = window.google.accounts.oauth2.initCodeClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/gmail.readonly',
                    callback: (codeResponse) => { if (codeResponse.code) { handleGoogleLoginSuccess(codeResponse.code); } },
                });
            } else { setMessage("Could not initialize Google Login. Please refresh.") }
        };
        return () => { document.body.removeChild(script); };
    }, []);

    // --- Auth Functions (No changes needed) ---
    const handleGoogleLoginSuccess = async (authCode) => { setLoading(true); setMessage('Connecting Google account...'); try { const saasToken = localStorage.getItem('jwt_token'); const response = await fetch(`${API_GATEWAY_URL}/auth/google/callback`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${saasToken}` }, body: JSON.stringify({ code: authCode }) }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Backend failed to exchange token.'); } setMessage('Successfully connected Google account!'); setIsGoogleConnected(true); } catch (error) { setMessage(`Error: ${error.message}`); } finally { setLoading(false); } };
    const triggerGoogleLogin = () => { if (googleClientRef.current) { googleClientRef.current.requestCode(); } else { setMessage("Google Login is not ready yet."); } };
    const handleAuthResponse = async (response) => { if (response.ok) { const data = await response.json(); localStorage.setItem('jwt_token', data.token); localStorage.setItem('user_info', JSON.stringify(data.user)); setUser(data.user); setMessage(`Successfully logged in!`); } else { const errorData = await response.json(); setMessage(`Error: ${errorData.message || 'Authentication failed'}`); } setLoading(false); };
    const handleSaaSLogin = async (e) => { e.preventDefault(); setLoading(true); setMessage(''); try { const response = await fetch(`${API_GATEWAY_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), }); await handleAuthResponse(response); } catch (error) { setMessage('Network error during login.'); setLoading(false); } };
    const handleSaaSSignup = async (e) => { e.preventDefault(); setLoading(true); setMessage(''); try { const response = await fetch(`${API_GATEWAY_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), }); await handleAuthResponse(response); } catch (error) { setMessage('Network error during signup.'); setLoading(false); } };
    const handleLogout = () => { localStorage.clear(); setUser(null); setEmails([]); setIsGoogleConnected(false); setSelectedEmail(null); setMessage('Logged out successfully.'); };

    // --- Email Functionality (UPDATED) ---
    const handleFetchEmails = async () => {
        setLoading(true);
        setMessage('Fetching emails...');
        setEmails([]);
        setSelectedEmail(null); // Close any open email
        try {
            const token = localStorage.getItem('jwt_token');
            const response = await fetch(`${API_GATEWAY_URL}/emails/inbox`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const data = await response.json();
                setEmails(data.messages || []);
                setMessage(data.messages.length > 0 ? 'Emails fetched successfully!' : 'Inbox is empty.');
            } else {
                const errorData = await response.json();
                setMessage(`Error fetching emails: ${errorData.message || 'Failed to fetch'}`);
            }
        } catch (error) { setMessage('Network error during email fetch.'); } finally { setLoading(false); }
    };

    // --- NEW: Function to view a single email ---
    const handleViewEmail = async (emailId) => {
        setSelectedEmail(null); // Clear previous selection
        setIsEmailLoading(true);
        setMessage('');
        try {
            const token = localStorage.getItem('jwt_token');
            const response = await fetch(`${API_GATEWAY_URL}/emails/${emailId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch email content.');
            }
            const emailData = await response.json();
            setSelectedEmail(emailData); // Set the full email data to show the modal
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setIsEmailLoading(false);
        }
    };

    // --- UPDATED: Function to summarize an email ---
    const handleSummarizeEmail = async (emailId) => {
        setIsSummarizing(true);
        setMessage('');
        try {
            const token = localStorage.getItem('jwt_token');
            const response = await fetch(`${API_GATEWAY_URL}/emails/${emailId}/summarize`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get summary.');
            }
            const { summary } = await response.json();
            // Update the selectedEmail state with the new summary
            setSelectedEmail(prev => ({ ...prev, summary }));
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setIsSummarizing(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
            {/* --- NEW: Email Detail Modal --- */}
            {selectedEmail && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-semibold truncate">{selectedEmail.subject}</h2>
                            <button onClick={() => setSelectedEmail(null)} className="text-gray-500 hover:text-gray-800"><CloseIcon/></button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <div className="text-sm text-gray-600 mb-4">
                                <p><strong>From:</strong> {selectedEmail.from}</p>
                                <p><strong>Date:</strong> {new Date(selectedEmail.date).toLocaleString()}</p>
                            </div>
                            <button 
                                onClick={() => handleSummarizeEmail(selectedEmail.id)}
                                disabled={isSummarizing || selectedEmail.summary}
                                className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center disabled:opacity-50"
                            >
                                {isSummarizing ? <LoaderIcon className="mr-2"/> : '✨'}
                                {selectedEmail.summary ? 'Summarized' : 'Summarize with Gemini'}
                            </button>
                            {selectedEmail.summary && (
                                <div className="p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h3 className="font-bold text-blue-800 mb-2">Summary:</h3>
                                    <p className="text-gray-700 whitespace-pre-wrap">{selectedEmail.summary}</p>
                                </div>
                            )}
                            <div className="p-3 bg-gray-50 border rounded-lg">
                                <h3 className="font-bold text-gray-800 mb-2">Full Content:</h3>
                                {/* --- UPDATED: Render sanitized HTML --- */}
                                <div 
                                    className="prose max-w-none" // Optional: for better typography with @tailwindcss/typography
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.body || "") }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-6xl">
                 <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center"><MailIcon className="mr-3 text-blue-600" />SaaS Web Mail Client</h1>
                    {user && (
                         <div className="text-right">
                             <p className="text-gray-700">Logged in as: <span className="font-semibold">{user.email}</span></p>
                             <button onClick={handleLogout} className="mt-1 text-sm bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600">Logout</button>
                         </div>
                    )}
                </div>

                {message && !isEmailLoading && <div className="p-3 mb-4 text-sm text-center rounded-lg bg-blue-100 text-blue-700">{message}</div>}

                {!user ? (
                    <div className="max-w-md mx-auto"><h2 className="text-2xl font-semibold text-center mb-4">Login or Sign Up</h2><form className="space-y-4"><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border rounded-lg"/><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border rounded-lg"/><div className="flex gap-4"><button onClick={handleSaaSLogin} disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center disabled:opacity-50">{loading ? <LoaderIcon /> : <><UserIcon className="mr-2" />Login</>}</button><button onClick={handleSaaSSignup} disabled={loading} className="w-full bg-purple-600 text-white p-3 rounded-lg flex items-center justify-center disabled:opacity-50">{loading ? <LoaderIcon /> : 'Sign Up'}</button></div></form></div>
                ) : (
                    <div>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 bg-gray-50 p-4 rounded-lg border"><h2 className="text-xl font-semibold mb-4">Actions</h2><div className="space-y-3"><button onClick={triggerGoogleLogin} disabled={isGoogleConnected || loading} className="w-full bg-gray-100 p-3 rounded-lg border flex items-center justify-center disabled:opacity-50"><img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5 mr-2" />{isGoogleConnected ? 'Gmail Connected' : 'Connect Gmail'}</button><button onClick={handleFetchEmails} disabled={loading} className="w-full bg-green-600 text-white p-3 rounded-lg flex items-center justify-center disabled:opacity-50">{loading && message.startsWith('Fetching') ? <LoaderIcon className="text-white" /> : <><MailIcon className="mr-2" />Fetch Emails</>}</button></div></div>
                            <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border"><h2 className="text-2xl font-semibold mb-4">Your Inbox</h2>
                                {isEmailLoading && <div className="flex justify-center items-center p-10"><LoaderIcon className="h-8 w-8 text-blue-600"/></div>}
                                {emails.length > 0 && !isEmailLoading ? (
                                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">{emails.map((mail) => (
                                        <div key={mail.id} onClick={() => handleViewEmail(mail.id)} className="bg-white p-3 rounded-lg shadow-sm border hover:shadow-md hover:border-blue-500 cursor-pointer transition">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-gray-800 truncate pr-4">{mail.subject}</p>
                                                    <p className="text-sm text-gray-600">{mail.from}</p>
                                                </div>
                                                <p className="text-xs text-gray-400 flex-shrink-0">{new Date(mail.date).toLocaleDateString()}</p>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-2 truncate">{mail.snippet || "No snippet available."}</p>
                                        </div>
                                    ))}</div>
                                ) : (!isEmailLoading && <p className="text-center text-gray-500 pt-10">Inbox is empty. Click "Fetch Emails".</p>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
export default App;
