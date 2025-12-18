#!/bin/bash
set -e

echo "🚀 Starting PM2-based deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please don't run as root. Use a regular user with sudo privileges.${NC}"
   exit 1
fi

# Navigate to project directory
cd /home/ubuntu/emr || { echo -e "${RED}Directory /home/ubuntu/emr not found${NC}"; exit 1; }

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing PM2...${NC}"
    npm install -g pm2
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version 18+ required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd server
npm install --production
cd ..

# Create logs directory
mkdir -p logs
mkdir -p uploads

# Load environment variables from .env.prod if it exists
if [ -f "deploy/.env.prod" ]; then
    echo -e "${GREEN}✓ Found .env.prod file${NC}"
    set -a
    source deploy/.env.prod
    set +a
else
    echo -e "${YELLOW}⚠ Warning: deploy/.env.prod not found. Make sure environment variables are set.${NC}"
fi

# Stop existing PM2 process if running
if pm2 list | grep -q "emr-api"; then
    echo -e "${YELLOW}Stopping existing emr-api process...${NC}"
    pm2 stop emr-api || true
    pm2 delete emr-api || true
fi

# Start with PM2
echo -e "${YELLOW}Starting application with PM2...${NC}"
pm2 start deploy/ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
if ! pm2 startup | grep -q "already"; then
    echo -e "${YELLOW}Setting up PM2 startup script...${NC}"
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
fi

# Show status
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "Application status:"
pm2 status
echo ""
echo "View logs with: pm2 logs emr-api"
echo "Restart with: pm2 restart emr-api"
echo "Stop with: pm2 stop emr-api"



