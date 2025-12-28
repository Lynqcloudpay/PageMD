# Architecture Plan: Dedicated Impersonation Subdomain

## 1. Problem Statement
Currently, Platform Admins (SuperAdmins) and Tenant Users (Doctors/Staff) log in to the same domain (`bemypcp.com`). When a SuperAdmin "Breaks Glass" to impersonate a user, authentication tokens for both the high-privilege Admin session and the impersonated User session may coexist in the same browser storage (cookies/localStorage).

**Risks:**
- **Token Leakage:** Malicious tenant scripts (if XSS exists) could theoretically access the SuperAdmin token if not scoped strictly.
- **Session Confusion:** Hard to distinguish between "Acting as Admin" and "Acting as User".
- **Privilege Escalation:** If a cookie is not cleared properly, a subsequent user on the same machine might access Admin functions.

## 2. Proposed Solution: Domain Isolation

Isolate the high-privilege context to a dedicated subdomain: `admin.bemypcp.com`.

### 2.1. Domain Structure
- **Patient/Doctor Portal:** `https://bemypcp.com` (or `app.bemypcp.com`)
- **Platform Admin Portal:** `https://admin.bemypcp.com`

### 2.2. Authentication Flow
1. **Admin Login:**
   - Admin access `admin.bemypcp.com`.
   - Login sets an `HttpOnly` cookie named `platform_session` scoped to `admin.bemypcp.com`.
   - **Crucial:** This cookie is NEVER sent to `bemypcp.com`.

2. **Break Glass (Impersonation):**
   - Admin clicks "Impersonate Doctor X" on `admin.bemypcp.com`.
   - Backend generates a short-lived (30s) one-time-use `impersonation_token`.
   - Admin UI redirects browser to: `https://bemypcp.com/api/auth/impersonate-callback?token=xyz`

3. **Session Establishment:**
   - The main application (`bemypcp.com`) receives the token.
   - Verifies token with backend.
   - Sets a standard `user_session` cookie scoped to `bemypcp.com`.
   - Redirects to Dashboard.

### 2.3. Security Benefits
- **Zero Leakage:** Even if `bemypcp.com` is fully compromised by XSS, the attacker CANNOT access the `platform_session` cookie because it belongs to a different subdomain (`admin.`).
- **Clear Boundary:** The browser treats them as separate sites context-wise.

## 3. Implementation Checklist
- [ ] **DNS**: Configure `admin.bemypcp.com` CNAME.
- [ ] **Caddy**: Update `Caddyfile` to handle the new subdomain routing.
- [ ] **Cookie Config**: Update `auth.js` to support dynamic cookie domains (or distinct names/scopes).
- [ ] **Frontend**: Split the Admin Portal build or use conditional routing based on `window.location.hostname`.

## 4. Phase 4 Execution
This architecture will be implemented as part of the Phase 4 Core Hardening.
