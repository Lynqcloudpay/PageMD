#!/bin/bash

# PageMD - Complete Setup Script
# Run this script in Cursor terminal to set up the entire project

set -e  # Exit on error

echo "🚀 Starting PageMD Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "${GREEN}✓${NC} Node.js version: $(node --version)"
echo "${GREEN}✓${NC} npm version: $(npm --version)"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "${YELLOW}⚠${NC} PostgreSQL is not installed."
    echo "   Please install PostgreSQL: https://www.postgresql.org/download/"
    echo "   Or use Homebrew: brew install postgresql@14"
    echo ""
else
    echo "${GREEN}✓${NC} PostgreSQL is installed"
    echo ""
fi

# Navigate to the project directory (assuming we're already in the cloned repo)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "${BLUE}📦 Installing Server Dependencies...${NC}"
cd server
npm install
echo "${GREEN}✓${NC} Server dependencies installed"
echo ""

echo "${BLUE}📦 Installing Client Dependencies...${NC}"
cd ../client
npm install
echo "${GREEN}✓${NC} Client dependencies installed"
echo ""

# Go back to root
cd ..

# Create .env file if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "${BLUE}📝 Creating server/.env file...${NC}"
    cat > server/.env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=paper_emr
DB_USER=postgres
DB_PASSWORD=postgres

# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# JWT Secret (change this in production!)
JWT_SECRET=your-secret-key-change-in-production

# Add other environment variables as needed
EOF
    echo "${GREEN}✓${NC} Created server/.env file"
    echo "${YELLOW}⚠${NC} Please edit server/.env with your database credentials"
    echo ""
else
    echo "${GREEN}✓${NC} server/.env already exists"
    echo ""
fi

# Check if database exists
echo "${BLUE}🗄️  Checking Database...${NC}"
if command -v psql &> /dev/null; then
    DB_EXISTS=$(psql -U postgres -lqt | cut -d \| -f 1 | grep -w paper_emr | wc -l)
    
    if [ "$DB_EXISTS" -eq 0 ]; then
        echo "${YELLOW}⚠${NC} Database 'paper_emr' does not exist"
        echo ""
        read -p "Would you like to create it now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "${BLUE}Creating database...${NC}"
            createdb paper_emr || echo "${YELLOW}Note: You may need to run 'createdb paper_emr' manually${NC}"
            echo "${GREEN}✓${NC} Database created"
            echo ""
            
            # Ask about migrations
            read -p "Would you like to run database migrations? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "${BLUE}Running migrations...${NC}"
                cd server
                npm run migrate 2>/dev/null || echo "${YELLOW}Note: Migration script may not exist or may need manual setup${NC}"
                cd ..
                echo "${GREEN}✓${NC} Migrations completed"
                echo ""
            fi
        else
            echo "${YELLOW}⚠${NC} Please create the database manually: createdb paper_emr"
            echo ""
        fi
    else
        echo "${GREEN}✓${NC} Database 'paper_emr' exists"
        echo ""
    fi
else
    echo "${YELLOW}⚠${NC} PostgreSQL not found. Please set up the database manually"
    echo ""
fi

echo ""
echo "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "${BLUE}Next Steps:${NC}"
echo "1. Edit server/.env with your database credentials"
echo "2. Make sure PostgreSQL is running"
echo "3. Create database if needed: createdb paper_emr"
echo "4. Run migrations: cd server && npm run migrate"
echo ""
echo "${BLUE}To start the application:${NC}"
echo "  Terminal 1: cd server && npm start"
echo "  Terminal 2: cd client && npm run dev"
echo ""
echo "${BLUE}Access the app at:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000"
echo ""

