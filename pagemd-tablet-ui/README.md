# PageMD Tablet UI

A tablet-optimized EMR web client that looks and feels like the existing PageMD web EMR, but is optimized for iPad/tablet workflows.

## Features

- **Tablet-first design** with landscape-optimized layouts
- **Master-detail navigation** for efficient clinical workflows
- **Touch-optimized** with 44px minimum touch targets
- **Same API** as main PageMD EMR - no backend changes required

## Tech Stack

- React 19 + Vite
- Tailwind CSS
- React Router
- Axios

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your API URL
# VITE_API_BASE_URL=https://bemypcp.com/api

# Start development server
npm run dev
```

## Build & Deploy

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment to tablet.bemypcp.com

1. Build the production bundle:
   ```bash
   npm run build
   ```

2. Deploy `dist/` folder to your static hosting

3. Configure nginx (example):
   ```nginx
   server {
       listen 443 ssl http2;
       server_name tablet.bemypcp.com;

       root /var/www/tablet-ui;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass https://bemypcp.com/api/;
       }
   }
   ```

## Core Screens

| Screen | Status |
|--------|--------|
| Login | ✅ Complete |
| Today Queue | ✅ Complete |
| Patient Search | ✅ Complete |
| Patient Chart | ✅ Complete (tabs scaffolded) |
| Settings | ✅ Complete |
| Vitals/Intake | 🔧 Tab scaffolded |
| Orders | 🔧 Tab scaffolded |
| Notes/Documentation | 🔧 Tab scaffolded |

## UAT Checklist (iPad Safari)

- [ ] Login with valid credentials
- [ ] View today's queue with patient list
- [ ] Select patient and view status
- [ ] Update visit status (Room, Ready, etc.)
- [ ] Search for patient
- [ ] Open patient chart
- [ ] Navigate chart tabs
- [ ] Logout and auto-logout on inactivity

## Design Principles

- **Matches PageMD web UI** colors, typography, and spacing
- **Big touch targets** (min 44px height)
- **Landscape-first** but responsive to portrait
- **Sticky patient header** always visible
- **No billing UI** (hidden per requirements)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API URL (e.g., `https://bemypcp.com/api`) |
