export const clearLocalStorageExceptSummaries = () => {
    console.log("Clearing local storage but preserving summaries...");
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
        // Preserve summaries and the logout flag for other tabs
        if (!key.startsWith('summary_') && key !== 'logout') {
            localStorage.removeItem(key);
        }
    });
}; 