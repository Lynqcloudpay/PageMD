# Quick Start Guide

## Step 1: Install Dependencies

From the project root directory, run:

```bash
npm run install-all
```

This will install dependencies for the root, server, and client.

## Step 2: Set Up Database (Optional for Basic Testing)

If you want to use the full backend with database:

1. Make sure PostgreSQL is installed and running
2. Create a `.env` file in the `server` directory:
   ```bash
   cp server/.env.example server/.env
   ```
3. Edit `server/.env` with your database credentials
4. Run migrations:
   ```bash
   cd server && npm run migrate
   ```

**Note:** The frontend will work with mock data even without the database set up.

## Step 3: Start the Application

From the project root, run:

```bash
npm run dev
```

This starts both the frontend and backend servers.

## Step 4: Access the Site

Open your browser and go to:

**Frontend (Main Application):**
- http://localhost:5173

**Backend API:**
- http://localhost:3000

## Quick Access Tips

- **Search Patients:** Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) anywhere in the app
- **Home/Schedule:** Click the "PageMD" logo in the sidebar
- **Patient Chart:** Click on a patient name in the schedule

## Troubleshooting

- **Port already in use?** Make sure nothing else is running on ports 3000 or 5173
- **Database errors?** The app will work with local storage fallback - you can skip database setup for testing
- **Dependencies not installing?** Make sure you have Node.js installed (v16 or higher)

