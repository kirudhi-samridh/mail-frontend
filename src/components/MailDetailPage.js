import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import DOMPurify from 'dompurify';
import ClassificationTag from '../ClassificationTag';
import { generateDailyDigest, speakText, stopSpeech } from '../utils/dailyDigestUtils';
import { clearLocalStorageExceptSummaries } from '../utils/storageUtils';

// --- Icon Components ---
const MailIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> );
const LoaderIcon = (props) => ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 1 1 16 0A8 8 0 0 1 4 12z"></path></svg> );
const SparklesIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg> );
const SpeakerWaveIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> );
const StopCircleIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><rect width="6" height="6" x="9" y="9"/></svg> );
const ArrowLeftIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg> );
const CalendarIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> );
const VideoIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg> );

// --- Configuration ---
const API_GATEWAY_URL = 'http://localhost:3001/api';

function MailDetailPage() {
    const { emailId } = useParams();
    const navigate = useNavigate();
    
    // --- State Management ---
    const [user, setUser] = useState(null);
    const [mail, setMail] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [message, setMessage] = useState('');
    
    // Audio and accordion state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingEmailId, setSpeakingEmailId] = useState(null);
    const [activeAccordion, setActiveAccordion] = useState(null);
    
    // Daily Digest states
    const [showDailyDigest, setShowDailyDigest] = useState(false);
    const [dailyDigest, setDailyDigest] = useState(null);
    const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

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
            
            // Check if user needs onboarding
            if (!userData.onboardingCompleted) {
                navigate('/onboarding');
                return;
            }
        };
        
        checkUserStatus();
    }, [navigate]);

    // --- Fetch email content when emailId changes ---
    useEffect(() => {
        const fetchEmailContent = async () => {
            if (!emailId) return;
            
            try {
                setMessage('Loading email...');
                const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch email content.');
                }
                const emailData = await response.json();
                setMail(emailData);
                setMessage('');
            } catch (error) {
                if (error.message === "Session expired") {
                    navigate('/login');
                } else {
                    setMessage(`Error: ${error.message}`);
                }
            }
        };
        
        if (emailId && user) {
            fetchEmailContent();
        }
    }, [emailId, user, navigate]);

    // --- Load summary from cache on initial load ---
    useEffect(() => {
        const loadSummaryFromCache = () => {
            if (emailId) {
                const cacheKey = `summary_cache_${emailId}`;
                const cachedData = localStorage.getItem(cacheKey);
                if (cachedData) {
                    console.log(`Initial load: Cache HIT for emailId: ${emailId}`);
                    setSummaryData(JSON.parse(cachedData));
                } else {
                    console.log(`Initial load: Cache MISS for emailId: ${emailId}`);
                }
            }
        };
        loadSummaryFromCache();
    }, [emailId]);

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
        return response;
    };

    // --- Logout Function ---
    const handleLogout = () => {
        clearLocalStorageExceptSummaries();
        navigate('/login');
    };

    // --- Audio Functions ---
    const handlePlayAudio = (script, emailId) => {
        if (!('speechSynthesis' in window)) {
            alert("Sorry, your browser does not support text-to-speech.");
            return;
        }
    
        if (isSpeaking && speakingEmailId === emailId) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            setSpeakingEmailId(null);
            return;
        }
    
        window.speechSynthesis.cancel();
    
        const utterance = new SpeechSynthesisUtterance(script);
        
        utterance.onstart = () => {
            setIsSpeaking(true);
            setSpeakingEmailId(emailId);
        };
    
        utterance.onend = () => {
            setIsSpeaking(false);
            setSpeakingEmailId(null);
        };
    
        window.speechSynthesis.speak(utterance);
    };

    // --- Summarize Email Function ---
    const handleSummarizeEmail = async () => {
        setIsLoadingSummary(true);
        setMessage('Generating AI summary...');
        
        const cacheKey = `summary_cache_${emailId}`;
        
        try {
            const response = await authenticatedFetch(`${API_GATEWAY_URL}/emails/${emailId}/summarize`, { method: 'POST' });
            if (!response.ok) throw new Error('Failed to get summary.');
            
            const responseData = await response.json();
            
            // Create a consistent data structure for caching and state
            const summaryResult = {
                summary_html_full: responseData.summary_html_full,
                summary_html_breakdown: responseData.summary_html_breakdown,
                summary_json: responseData.summary_json,
                cachedAt: new Date().toISOString(),
                emailId: emailId,
                emailDate: mail?.date || new Date().toISOString(),
                emailSubject: mail?.subject || 'No Subject'
            };

            // Cache the new summary
            try {
                localStorage.setItem(cacheKey, JSON.stringify(summaryResult));
                console.log(`Saved summary for emailId: ${emailId} to cache.`);
            } catch (cacheError) {
                console.error("Failed to save to localStorage:", cacheError);
                // Decide if we want to proceed even if caching fails
            }
            
            // Set the summary data to trigger the two-panel view
            setSummaryData(summaryResult);
            setMessage('');
            
        } catch (error) {
            if (error.message === "Session expired") {
                navigate('/login');
            } else {
                setMessage(`Error: ${error.message}`);
            }
        } finally {
            setIsLoadingSummary(false);
        }
    };

    // --- Daily Digest Functions ---
    const handleGenerateDailyDigest = async () => {
        setIsGeneratingDigest(true);
        setMessage('Generating daily digest...');
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const result = await generateDailyDigest(today);
            
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

    const handleCloseDailyDigest = () => {
        setShowDailyDigest(false);
        setDailyDigest(null);
    };

    // --- Video Generation ---
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

            // Get the video blob from the response
            const videoBlob = await response.blob();
            
            // Create a URL for the blob and trigger a download
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
            <div className="w-full h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <LoaderIcon className="mx-auto mb-4" />
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (!mail) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <LoaderIcon className="mx-auto mb-4" />
                    <p>Loading Email...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen flex flex-col bg-gray-100">
            {/* --- HEADER --- */}
            <header className="p-4 border-b bg-white flex justify-between items-center flex-shrink-0 shadow-sm">
                <Link 
                    to="/inbox" 
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-2 font-medium transition-colors"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Inbox
                </Link>
                
                <div className="text-center flex-1 mx-8">
                    <h1 className="font-semibold truncate text-lg">{mail.subject}</h1>
                    <p className="text-sm text-gray-500">{mail.from}</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleGenerateDailyDigest} 
                        disabled={isGeneratingDigest} 
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2 hover:bg-purple-700 transition-colors text-sm"
                    >
                        {isGeneratingDigest ? (
                            <>
                                <LoaderIcon className="h-4 w-4" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <CalendarIcon className="h-4 w-4" />
                                Daily Digest
                            </>
                        )}
                    </button>
                    
                    <button 
                        onClick={handleSummarizeEmail} 
                        disabled={isLoadingSummary} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                        {isLoadingSummary ? (
                            <>
                                <LoaderIcon className="h-4 w-4" />
                                Summarizing...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="h-4 w-4" />
                                AI Summary
                            </>
                        )}
                    </button>
                    
                    <button 
                        onClick={handleLogout} 
                        className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Message Bar */}
            {message && (
                <div className="p-3 text-sm text-center bg-blue-100 text-blue-700 border-b">
                    {message}
                </div>
            )}

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-grow min-h-0">
                <PanelGroup direction="horizontal">
                    {/* --- PANEL 1: Original Email --- */}
                    <Panel defaultSize={summaryData ? 50 : 100} minSize={20}>
                        <div className="p-6 h-full overflow-y-auto bg-white">
                            <div className="max-w-none">
                                <div className="mb-6 pb-4 border-b">
                                    <h2 className="text-xl font-bold text-gray-800 mb-2">Original Email</h2>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <div><strong>From:</strong> {mail.from}</div>
                                        <div><strong>Subject:</strong> {mail.subject}</div>
                                        <div><strong>Date:</strong> {new Date(mail.date).toLocaleString()}</div>
                                    </div>
                                </div>
                                
                                <div 
                                    className="prose max-w-none"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mail.body) }} 
                                />
                            </div>
                        </div>
                    </Panel>

                    {/* --- RENDER DIVIDER AND SUMMARY PANEL ONLY IF SUMMARY EXISTS --- */}
                    {summaryData && (
                        <>
                            {/* Draggable divider */}
                            <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-600 active:bg-blue-600 transition-colors cursor-col-resize" />

                            {/* --- PANEL 2: AI Summary --- */}
                            <Panel defaultSize={50} minSize={20}>
                                <div className="p-6 h-full overflow-y-auto bg-gray-50">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-gray-800">AI-Powered Summary</h3>
                                        {summaryData.summary_json?.audioScript && (
                                            <button 
                                                onClick={() => handlePlayAudio(summaryData.summary_json.audioScript, emailId)}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                                                title={isSpeaking && speakingEmailId === emailId ? "Stop Audio" : "Play Audio Summary"}
                                            >
                                                {isSpeaking && speakingEmailId === emailId ? (
                                                    <StopCircleIcon className="h-6 w-6 text-red-600"/>
                                                ) : (
                                                    <SpeakerWaveIcon className="h-6 w-6"/>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {(() => {
                                            const classification = summaryData.summary_json?.classification;
                                            return (
                                                <>
                                                    {/* Classification Accordion */}
                                                    {classification && classification.category && (
                                                        <details 
                                                            className="group border rounded-lg overflow-hidden bg-white shadow-sm"
                                                            open={activeAccordion === 'classification'}
                                                        >
                                                            <summary 
                                                                className="bg-blue-50 p-4 font-semibold cursor-pointer list-none flex justify-between items-center group-hover:bg-blue-100 transition-colors"
                                                                onClick={(e) => { 
                                                                    e.preventDefault(); 
                                                                    setActiveAccordion(prev => prev === 'classification' ? null : 'classification'); 
                                                                }}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <ClassificationTag classification={classification} />
                                                                    <span>Category - {classification.category}</span>
                                                                </span>
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
                                                                            {classification.keywordsFound.map((keyword, index) => (
                                                                                <li key={index}>{keyword}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </details>
                                                    )}

                                                    {/* Summary Breakdown Accordions */}
                                                    {summaryData.summary_html_breakdown && Object.keys(summaryData.summary_html_breakdown)
                                                        .filter(sectionKey => sectionKey.toLowerCase() !== 'classification')
                                                        .map(sectionKey => (
                                                            <details 
                                                                key={sectionKey} 
                                                                className="group border rounded-lg overflow-hidden bg-white shadow-sm"
                                                                open={activeAccordion === sectionKey}
                                                            >
                                                                <summary 
                                                                    className="bg-gray-50 p-4 font-semibold cursor-pointer list-none flex justify-between items-center group-hover:bg-gray-100 transition-colors"
                                                                    onClick={(e) => { 
                                                                        e.preventDefault(); 
                                                                        setActiveAccordion(prev => prev === sectionKey ? null : sectionKey); 
                                                                    }}
                                                                >
                                                                    {sectionKey.replace(/([A-Z])/g, ' $1').trim()}
                                                                    <span className="text-gray-500 group-open:rotate-90 transform transition-transform duration-200">▶</span>
                                                                </summary>
                                                                <div 
                                                                    className="p-4 border-t prose max-w-none"
                                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(summaryData.summary_html_breakdown[sectionKey]) }}
                                                                />
                                                            </details>
                                                        ))}

                                                    {/* Full Summary Accordion */}
                                                    {summaryData.summary_html_full && (
                                                        <details 
                                                            className="group border rounded-lg overflow-hidden bg-white shadow-sm"
                                                            open={activeAccordion === 'full_summary'}
                                                        >
                                                            <summary 
                                                                className="bg-gray-50 p-4 font-semibold cursor-pointer list-none flex justify-between items-center group-hover:bg-gray-100 transition-colors"
                                                                onClick={(e) => { 
                                                                    e.preventDefault(); 
                                                                    setActiveAccordion(prev => prev === 'full_summary' ? null : 'full_summary'); 
                                                                }}
                                                            >
                                                                View Full Summary (Combined)
                                                                <span className="text-gray-500 group-open:rotate-90 transform transition-transform duration-200">▶</span>
                                                            </summary>
                                                            <div
                                                                className="p-4 border-t prose max-w-none"
                                                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(summaryData.summary_html_full) }}
                                                            />
                                                        </details>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </Panel>
                        </>
                    )}
                </PanelGroup>
            </div>

            {/* Daily Digest Modal */}
            {showDailyDigest && dailyDigest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="h-6 w-6" />
                                <div>
                                    <h2 className="text-xl font-bold">Daily Email Digest</h2>
                                    <p className="text-purple-100 text-sm">
                                        {new Date(dailyDigest.date).toLocaleDateString('en-US', { 
                                            weekday: 'long', 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {dailyDigest.audioScript && (
                                    <button 
                                        onClick={() => handlePlayAudio(dailyDigest.audioScript, 'daily-digest')}
                                        className="bg-purple-500 hover:bg-purple-400 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                                        title={isSpeaking && speakingEmailId === 'daily-digest' ? "Stop Audio" : "Play Audio Summary"}
                                    >
                                        {isSpeaking && speakingEmailId === 'daily-digest' ? (
                                            <StopCircleIcon className="h-4 w-4" />
                                        ) : (
                                            <SpeakerWaveIcon className="h-4 w-4" />
                                        )}
                                        {isSpeaking && speakingEmailId === 'daily-digest' ? 'Stop' : 'Listen'}
                                    </button>
                                )}
                                <button 
                                    onClick={handleGenerateVideo}
                                    disabled={isGeneratingVideo}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center"
                                >
                                    {isGeneratingVideo ? <LoaderIcon className="mr-2" /> : <VideoIcon className="mr-2" />}
                                    {isGeneratingVideo ? 'Generating...' : 'Generate Video'}
                                </button>
                                <button 
                                    onClick={handleCloseDailyDigest}
                                    className="bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MailDetailPage; 