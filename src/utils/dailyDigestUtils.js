// Daily Digest Utility Functions

const API_GATEWAY_URL = 'http://localhost:3001/api';

// Get all cached email summaries from localStorage
export const getAllCachedSummaries = () => {
    const summaries = [];
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
        if (key.startsWith('summary_cache_')) {
            try {
                const summaryData = JSON.parse(localStorage.getItem(key));
                if (summaryData && summaryData.summary_json) {
                    summaries.push({
                        emailId: key.replace('summary_cache_', ''),
                        summaryJson: summaryData.summary_json,
                        cachedAt: summaryData.cachedAt || new Date().toISOString(),
                        // --- FIX: Add the missing emailDate ---
                        emailDate: summaryData.emailDate,
                        emailSubject: summaryData.emailSubject
                    });
                }
            } catch (error) {
                console.error(`Error parsing cached summary for ${key}:`, error);
            }
        }
    });
    
    return summaries;
};

// Get cached summaries for a specific date
export const getCachedSummariesForDate = (date) => {
    const allSummaries = getAllCachedSummaries();
    const targetDate = new Date(date).toDateString();
    
    return allSummaries.filter(summary => {
        // First try to use emailDate (new format), fallback to cachedAt (old format)
        const emailDate = summary.emailDate || summary.cachedAt;
        if (!emailDate) return false;
        
        const summaryDate = new Date(emailDate).toDateString();
        return summaryDate === targetDate;
    }).reduce((uniqueSummaries, summary) => {
        // Ensure we don't have duplicate email IDs (can happen if same email is cached multiple times)
        const existingIndex = uniqueSummaries.findIndex(existing => existing.emailId === summary.emailId);
        if (existingIndex === -1) {
            // New email ID, add it
            uniqueSummaries.push(summary);
        } else {
            // Duplicate email ID, keep the one with more recent cache timestamp
            const existingCacheTime = new Date(uniqueSummaries[existingIndex].cachedAt).getTime();
            const currentCacheTime = new Date(summary.cachedAt).getTime();
            if (currentCacheTime > existingCacheTime) {
                uniqueSummaries[existingIndex] = summary;
            }
        }
        return uniqueSummaries;
    }, []);
};

// Save daily digest to localStorage
export const saveDailyDigest = (date, digestData) => {
    const key = `daily_digest_${date}`;
    const digestWithTimestamp = {
        ...digestData,
        savedAt: new Date().toISOString()
    };
    
    try {
        localStorage.setItem(key, JSON.stringify(digestWithTimestamp));
        return true;
    } catch (error) {
        console.error('Error saving daily digest:', error);
        return false;
    }
};

// Get daily digest from localStorage
export const getDailyDigest = (date) => {
    const key = `daily_digest_${date}`;
    try {
        const digestData = localStorage.getItem(key);
        return digestData ? JSON.parse(digestData) : null;
    } catch (error) {
        console.error('Error retrieving daily digest:', error);
        return null;
    }
};

// Get all available daily digests
export const getAllDailyDigests = () => {
    const digests = [];
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
        if (key.startsWith('daily_digest_')) {
            try {
                const digestData = JSON.parse(localStorage.getItem(key));
                const date = key.replace('daily_digest_', '');
                digests.push({
                    date,
                    ...digestData
                });
            } catch (error) {
                console.error(`Error parsing daily digest for ${key}:`, error);
            }
        }
    });
    
    // Sort by date (newest first)
    return digests.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Generate daily digest via API
export const generateDailyDigest = async (date = null, authToken = null) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Check if we already have a digest for this date
    const existingDigest = getDailyDigest(targetDate);
    if (existingDigest) {
        return { success: true, digest: existingDigest, fromCache: true };
    }
    
    // Get summaries for the target date
    const summaries = getCachedSummariesForDate(targetDate);
    
    if (summaries.length === 0) {
        return { 
            success: false, 
            error: 'No email summaries found for this date. Please summarize some emails first.' 
        };
    }
    
    try {
        const token = authToken || localStorage.getItem('jwt_token');
        const response = await fetch(`${API_GATEWAY_URL}/daily-digest/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                summaries: summaries.map(s => {
                    // Determine provider from email ID
                    let provider = 'unknown';
                    if (s.emailId) {
                        if (s.emailId.startsWith('g_') || s.emailId.includes('gmail')) {
                            provider = 'gmail';
                        } else if (s.emailId.startsWith('o_') || s.emailId.startsWith('ms_') || s.emailId.includes('outlook')) {
                            provider = 'outlook';
                        }
                    }
                    
                    return {
                        emailId: s.emailId,
                        emailDate: s.emailDate,
                        emailSubject: s.emailSubject,
                        emailProvider: provider,
                        summaryJson: s.summary_json || s.summaryJson
                    };
                }),
                date: targetDate,
                providerCounts: getSummaryCountByProviderForDate(targetDate)
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to generate daily digest');
        }
        
        const data = await response.json();
        
        // Save the digest to localStorage
        saveDailyDigest(targetDate, data.dailyDigest);
        
        return { success: true, digest: data.dailyDigest, fromCache: false };
        
    } catch (error) {
        console.error('Error generating daily digest:', error);
        return { success: false, error: error.message };
    }
};

// Text-to-Speech functionality
export const speakText = (text, options = {}) => {
    if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported');
        return false;
    }
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice options
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    utterance.lang = options.lang || 'en-US';
    
    // Set voice if available
    if (options.voice) {
        utterance.voice = options.voice;
    }
    
    // Event handlers
    utterance.onstart = () => {
        console.log('Speech started');
        if (options.onStart) options.onStart();
    };
    
    utterance.onend = () => {
        console.log('Speech ended');
        if (options.onEnd) options.onEnd();
    };
    
    utterance.onerror = (event) => {
        console.error('Speech error:', event.error);
        if (options.onError) options.onError(event.error);
    };
    
    window.speechSynthesis.speak(utterance);
    return true;
};

// Get available voices
export const getAvailableVoices = () => {
    return window.speechSynthesis.getVoices();
};

// Stop current speech
export const stopSpeech = () => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};

// Get all available dates that have email summaries
export const getAvailableSummaryDates = () => {
    const allSummaries = getAllCachedSummaries();
    const dates = new Set();
    
    allSummaries.forEach(summary => {
        const emailDate = summary.emailDate || summary.cachedAt;
        if (emailDate) {
            const dateStr = new Date(emailDate).toISOString().split('T')[0];
            dates.add(dateStr);
        }
    });
    
    // Convert to array and sort (newest first)
    return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
};

// Get summary count for a specific date
export const getSummaryCountForDate = (date) => {
    const summaries = getCachedSummariesForDate(date);
    return summaries.length;
};

// Get summary count by provider for a specific date
export const getSummaryCountByProviderForDate = (date) => {
    const summaries = getCachedSummariesForDate(date);
    const counts = {
        gmail: 0,
        outlook: 0,
        unknown: 0,
        total: summaries.length
    };
    
    summaries.forEach(summary => {
        if (!summary.emailId) {
            counts.unknown++;
            return;
        }
        
        // Determine provider based on email ID pattern
        if (summary.emailId.startsWith('g_') || summary.emailId.includes('gmail')) {
            counts.gmail++;
        } else if (summary.emailId.startsWith('o_') || summary.emailId.startsWith('ms_') || summary.emailId.includes('outlook')) {
            counts.outlook++;
        } else {
            counts.unknown++;
        }
    });
    
    return counts;
};

// Get summaries for a specific date grouped by provider
export const getCachedSummariesByProvider = (date) => {
    const summaries = getCachedSummariesForDate(date);
    const grouped = {
        gmail: [],
        outlook: [],
        unknown: []
    };
    
    summaries.forEach(summary => {
        if (!summary.emailId) {
            grouped.unknown.push(summary);
            return;
        }
        
        // Determine provider based on email ID pattern
        if (summary.emailId.startsWith('g_') || summary.emailId.includes('gmail')) {
            grouped.gmail.push(summary);
        } else if (summary.emailId.startsWith('o_') || summary.emailId.startsWith('ms_') || summary.emailId.includes('outlook')) {
            grouped.outlook.push(summary);
        } else {
            grouped.unknown.push(summary);
        }
    });
    
    return grouped;
};

// Clean up old cache entries (optional maintenance function)
export const cleanupOldCacheEntries = (daysToKeep = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const keys = Object.keys(localStorage);
    let cleanedCount = 0;
    
    keys.forEach(key => {
        if (key.startsWith('summary_cache_') || key.startsWith('daily_digest_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const dataDate = new Date(data.cachedAt || data.savedAt || 0);
                
                if (dataDate < cutoffDate) {
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            } catch (error) {
                // If we can't parse it, remove it
                localStorage.removeItem(key);
                cleanedCount++;
            }
        }
    });
    
    console.log(`Cleaned up ${cleanedCount} old cache entries`);
    return cleanedCount;
}; 