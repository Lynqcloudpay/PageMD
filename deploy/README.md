# Production Deployment Files

This directory contains all files needed for HIPAA-compliant production deployment.

## Files

- **docker-compose.prod.yml** - Docker Compose configuration for production
- **Caddyfile** - Caddy reverse proxy configuration (HTTPS, security headers)
- **env.prod.example** - Environment variables template
- **Dockerfile.api** - Backend API Docker image
- **Dockerfile.web** - Frontend static build Docker image
- **init-db.sh** - Database initialization script

## Quick Start

1. Copy `env.prod.example` to `.env.prod` and fill in all values
2. Update `Caddyfile` with your domain name (replace `yourdomain.com`)
3. Run: `docker compose -f docker-compose.prod.yml up -d --build`
4. Run migrations: `docker compose -f docker-compose.prod.yml exec api npm run migrate`

## Important Notes

- **Never commit `.env.prod` to version control**
- Update `Caddyfile` with your actual domain before deployment
- Generate strong secrets for `SESSION_SECRET`, `JWT_SECRET`, and `BACKUP_ENCRYPTION_KEY`
- Ensure `ENABLE_PHI_ENCRYPTION=true` in production
- Ensure `ENABLE_AUDIT_LOGGING=true` in production

## See Also

- `../DEPLOYMENT.md` - Complete deployment guide
- `../HIPAA_DEPLOYMENT_QUICK_START.md` - HIPAA compliance checklist

