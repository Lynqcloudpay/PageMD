# Quick Setup Guide

## 🚀 Quick Setup (Recommended)

After cloning the repository, run this single command in Cursor terminal:

```bash
npm run setup
```

**That's it!** This is the easiest way to set up everything.

## Alternative Methods

### Option 1: Direct Script
```bash
bash setup.sh
```

### Option 2: npm init
```bash
npm run init
```

Or if you prefer a one-liner that does everything:

```bash
cd server && npm install && cd ../client && npm install && cd .. && [ ! -f server/.env ] && cat > server/.env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=paper_emr
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key-change-in-production
EOF
echo "✅ Setup complete! Edit server/.env with your database credentials, then:"
echo "   Terminal 1: cd server && npm start"
echo "   Terminal 2: cd client && npm run dev"
```

## Manual Setup (if script doesn't work)

```bash
# 1. Install dependencies
cd server && npm install && cd ../client && npm install && cd ..

# 2. Create .env file (copy the content above or use the template)

# 3. Create database
createdb paper_emr

# 4. Run migrations (if available)
cd server && npm run migrate && cd ..

# 5. Start servers
# Terminal 1:
cd server && npm start

# Terminal 2:
cd client && npm run dev
```

## Prerequisites

- Node.js (v16 or higher recommended)
- PostgreSQL (v12 or higher)
- npm (comes with Node.js)

## Troubleshooting

- **Database connection error**: Make sure PostgreSQL is running and credentials in `.env` are correct
- **Port already in use**: Change `PORT` in `server/.env` or `FRONTEND_URL` if needed
- **Permission denied**: Run `chmod +x setup.sh` first

