# Database Setup Instructions

## The Issue
The login is failing with 500 errors because the database connection is not working.

## Quick Fix Options

### Option 1: Use SQLite (No Setup Required)
We can switch to SQLite for development - no database server needed!

### Option 2: Start PostgreSQL (If Installed)
If you have PostgreSQL installed:

1. **Start PostgreSQL:**
   ```bash
   # macOS with Homebrew
   brew services start postgresql@14
   # or
   brew services start postgresql
   
   # Or if installed via Postgres.app, just open the app
   ```

2. **Create the database:**
   ```bash
   createdb paper_emr
   ```

3. **Run migrations:**
   ```bash
   cd server && npm run migrate
   ```

4. **Seed a user:**
   ```bash
   cd server && npm run seed
   ```

### Option 3: Use Docker (Recommended)
If you have Docker:

```bash
docker run --name paper-emr-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=paper_emr \
  -p 5432:5432 \
  -d postgres:14

# Then run migrations
cd server && npm run migrate && npm run seed
```

## Check Current Status

Run this to check if PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

## Alternative: Temporary Bypass for Development

If you just want to test the app without setting up a database, I can modify the code to use mock data temporarily. Let me know!

















