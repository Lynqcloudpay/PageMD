# How to Save Data - Database Setup Guide

## Current Status
Right now you're in DEV_MODE which means data is **not being saved**. To save data permanently, you need to set up PostgreSQL.

## Option 1: Install PostgreSQL (Recommended)

### macOS with Homebrew:
```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL
brew services start postgresql@14

# Create the database
createdb paper_emr
```

### macOS with Postgres.app:
1. Download from: https://postgresapp.com/
2. Install and open the app
3. Click "Initialize" to create a new server
4. The database will be available on port 5432

### Then:
```bash
# Run migrations to create tables
cd server
npm run migrate

# Create a default user
npm run seed

# Disable DEV_MODE
# Edit server/.env and remove or set DEV_MODE=false
```

## Option 2: Use Docker (Easiest - No Installation)

If you have Docker installed:

```bash
# Start PostgreSQL in Docker
docker run --name paper-emr-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=paper_emr \
  -p 5432:5432 \
  -d postgres:14

# Wait a few seconds for it to start, then run migrations
cd server
npm run migrate
npm run seed

# Disable DEV_MODE in server/.env
```

## Option 3: Use SQLite (Simplest - No Server Needed)

I can modify the code to use SQLite instead of PostgreSQL. This requires no setup - just works!

Would you like me to:
1. Switch to SQLite (easiest, no setup)
2. Help you set up PostgreSQL
3. Keep DEV_MODE but add file-based storage

## After Setup

1. **Disable DEV_MODE:**
   ```bash
   # Edit server/.env
   # Remove or comment out: DEV_MODE=true
   # Or set: DEV_MODE=false
   ```

2. **Restart the server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. **Login:**
   - Email: `doctor@clinic.com`
   - Password: `Password123!`

## Verify It's Working

After setup, try:
1. Create a patient
2. Write a note
3. Sign the note
4. Refresh the page
5. Data should still be there! ✅

































