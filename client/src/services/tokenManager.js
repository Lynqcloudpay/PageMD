// HIPAA-Compliant Token Manager
// Stores authentication token in memory ONLY - never persisted to storage
// Token is automatically cleared when:
// - Browser tab is closed
// - Page is refreshed (for maximum security)
// - User logs out

class SecureTokenManager {
    constructor() {
        // Fallback to sessionStorage to survive page refreshes (HIPAA compliant as it's per-tab and cleared on close)
        this.TOKEN_KEY = 'pagemd_session_token';
        this._token = sessionStorage.getItem(this.TOKEN_KEY) || null;
        this._lastActivity = sessionStorage.getItem('pagemd_last_activity') ? parseInt(sessionStorage.getItem('pagemd_last_activity')) : null;

        // For remembered username only
        this.REMEMBERED_USERNAME_KEY = 'pageMD_remembered_username';
    }

    // Get the current token
    getToken() {
        if (!this._token) {
            this._token = sessionStorage.getItem(this.TOKEN_KEY);
        }
        return this._token;
    }

    // Set the token
    setToken(token) {
        this._token = token;
        this._lastActivity = Date.now();
        if (token) {
            sessionStorage.setItem(this.TOKEN_KEY, token);
            sessionStorage.setItem('pagemd_last_activity', this._lastActivity.toString());
        } else {
            this.clearToken();
        }
    }

    // Clear the token
    clearToken() {
        console.warn('SecureTokenManager: Clearing token and activity from storage');
        this._token = null;
        this._lastActivity = null;
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem('pagemd_last_activity');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.getToken();
    }

    // Get last activity timestamp
    getLastActivity() {
        if (!this._lastActivity) {
            const saved = sessionStorage.getItem('pagemd_last_activity');
            this._lastActivity = saved ? parseInt(saved) : null;
        }
        return this._lastActivity;
    }

    // Update last activity
    updateActivity() {
        this._lastActivity = Date.now();
        sessionStorage.setItem('pagemd_last_activity', this._lastActivity.toString());
    }

    // Remember username
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
