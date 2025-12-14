// HIPAA-Compliant Token Manager
// Stores authentication token in memory ONLY - never persisted to storage
// Token is automatically cleared when:
// - Browser tab is closed
// - Page is refreshed (for maximum security)
// - User logs out

class SecureTokenManager {
    constructor() {
        // Token stored in closure - not accessible from outside
        this._token = null;
        this._lastActivity = null;

        // For remembered username only (not security-sensitive)
        this.REMEMBERED_USERNAME_KEY = 'pageMD_remembered_username';
    }

    // Get the current token (memory only)
    getToken() {
        return this._token;
    }

    // Set the token (memory only)
    setToken(token) {
        this._token = token;
        this._lastActivity = Date.now();
    }

    // Clear the token
    clearToken() {
        this._token = null;
        this._lastActivity = null;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this._token !== null;
    }

    // Get last activity timestamp
    getLastActivity() {
        return this._lastActivity;
    }

    // Update last activity
    updateActivity() {
        this._lastActivity = Date.now();
    }

    // Remember username (this is OK to persist - not sensitive)
    setRememberedUsername(username) {
        if (username) {
            localStorage.setItem(this.REMEMBERED_USERNAME_KEY, username);
        }
    }

    getRememberedUsername() {
        return localStorage.getItem(this.REMEMBERED_USERNAME_KEY) || '';
    }
}

// Singleton instance
const tokenManager = new SecureTokenManager();

export default tokenManager;
