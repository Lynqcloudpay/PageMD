#!/bin/bash

echo "🚀 Setting up database for Paper EMR..."
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL is not running"
    echo ""
    echo "Starting PostgreSQL..."
    
    # Try to start with Homebrew
    if command -v brew &> /dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null
        sleep 3
    fi
    
    # Check again
    if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "❌ Could not start PostgreSQL automatically"
        echo ""
        echo "Please start PostgreSQL manually:"
        echo "  - If using Homebrew: brew services start postgresql"
        echo "  - If using Postgres.app: Open the app"
        echo "  - Or use Docker: docker run -d --name paper-emr-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=paper_emr -p 5432:5432 postgres:14"
        exit 1
    fi
fi

echo "✅ PostgreSQL is running"
echo ""

# Create database if it doesn't exist
echo "Creating database..."
createdb paper_emr 2>/dev/null && echo "✅ Database created" || echo "ℹ️  Database already exists or error (this is OK)"
echo ""

# Run migrations
echo "Running migrations..."
cd server
npm run migrate
echo ""

# Seed user
echo "Creating default user..."
npm run seed
echo ""

# Disable DEV_MODE
echo "Disabling DEV_MODE..."
if grep -q "^DEV_MODE=true" .env 2>/dev/null; then
    sed -i '' 's/^DEV_MODE=true/DEV_MODE=false/' .env
    echo "✅ DEV_MODE disabled"
elif ! grep -q "^DEV_MODE=" .env 2>/dev/null; then
    echo "DEV_MODE=false" >> .env
    echo "✅ DEV_MODE set to false"
else
    echo "ℹ️  DEV_MODE already configured"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart the server: npm run dev"
echo "2. Login with: doctor@clinic.com / Password123!"
echo "3. Your data will now be saved! 🎉"

















