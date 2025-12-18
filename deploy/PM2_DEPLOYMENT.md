# PM2 Deployment Guide

This guide explains how to deploy the EMR application using PM2 instead of Docker. PM2 is simpler, faster, and avoids Docker build issues.

## Why PM2?

- ✅ **Simpler**: No Docker images to build
- ✅ **Faster**: Direct Node.js process management
- ✅ **Easier debugging**: Direct access to logs and processes
- ✅ **Less overhead**: No containerization layer
- ✅ **Better for single-server deployments**

## Prerequisites

1. **Node.js 18+** installed on the server
2. **PostgreSQL** running (can be on same server or remote)
3. **Nginx** for reverse proxy and SSL (or use Caddy)
4. **Git** for pulling code

## Step 1: Install Node.js and PM2

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Step 2: Install PostgreSQL (if not already installed)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Step 3: Setup Database

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE emr_db;
CREATE USER emr_user WITH PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE emr_db TO emr_user;
\q
EOF
```

## Step 4: Clone and Setup Application

```bash
# Clone repository
cd /home/ubuntu
git clone <your-repo-url> emr
cd emr

# Install dependencies
cd server
npm install --production
cd ../client
npm install
npm run build
cd ..
```

## Step 5: Configure Environment

```bash
# Copy and edit environment file
cp deploy/env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

Update these key variables:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://emr_user:your_password@localhost:5432/emr_db
FRONTEND_URL=https://bemypcp.com
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
```

## Step 6: Run Database Migrations

```bash
cd server
npm run migrate
```

## Step 7: Deploy with PM2

```bash
# Make script executable
chmod +x deploy/pm2-deploy.sh

# Run deployment
./deploy/pm2-deploy.sh
```

## Step 8: Setup Nginx (Alternative to Caddy)

```bash
# Install Nginx
sudo apt install -y nginx

# Copy configuration
sudo cp deploy/nginx-pm2.conf /etc/nginx/sites-available/emr
sudo ln -s /etc/nginx/sites-available/emr /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Setup SSL with Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bemypcp.com -d www.bemypcp.com

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

## Step 9: Build and Deploy Frontend

```bash
cd /home/ubuntu/emr/client
npm run build

# Copy build to Nginx directory (if using nginx-pm2.conf)
sudo cp -r dist/* /home/ubuntu/emr/client/dist/
```

## PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs emr-api

# Restart application
pm2 restart emr-api

# Stop application
pm2 stop emr-api

# View detailed info
pm2 show emr-api

# Monitor (real-time)
pm2 monit
```

## Updating the Application

```bash
cd /home/ubuntu/emr

# Pull latest code
git pull origin main

# Install/update dependencies
cd server
npm install --production
cd ..

# Rebuild frontend
cd client
npm run build
cd ..

# Restart PM2
pm2 restart emr-api
```

## Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs emr-api --lines 50

# Check if port is in use
sudo lsof -i :3000

# Check environment variables
pm2 show emr-api
```

### Database connection issues
```bash
# Test database connection
psql -U emr_user -d emr_db -h localhost

# Check PostgreSQL is running
sudo systemctl status postgresql
```

### 502 Bad Gateway
```bash
# Check if API is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/emr-error.log

# Test API directly
curl http://localhost:3000/api/health
```

## Advantages Over Docker

1. **No build timeouts**: No need to pull Docker images
2. **Faster deployments**: Direct code execution
3. **Easier debugging**: Direct process access
4. **Lower resource usage**: No container overhead
5. **Simpler updates**: Just `git pull` and `pm2 restart`

## Migration from Docker

If you're currently using Docker:

1. Stop Docker containers:
   ```bash
   cd /home/ubuntu/emr/deploy
   docker compose -f docker-compose.prod.yml down
   ```

2. Export database (if needed):
   ```bash
   docker compose -f docker-compose.prod.yml exec db pg_dump -U emr_user emr_db > backup.sql
   ```

3. Follow PM2 deployment steps above

4. Import database (if needed):
   ```bash
   psql -U emr_user -d emr_db < backup.sql
   ```



