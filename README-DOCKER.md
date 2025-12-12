# Running PostgreSQL with Docker

## Quick Start

1. **Start PostgreSQL:**
   ```bash
   docker-compose up -d
   ```

2. **Check if it's running:**
   ```bash
   docker ps | grep postgres
   ```

3. **Stop PostgreSQL:**
   ```bash
   docker-compose down
   ```

4. **View logs:**
   ```bash
   docker-compose logs postgres
   ```

## Database Connection

The PostgreSQL container uses these default settings (matching your `server/.env`):
- **Host:** localhost
- **Port:** 5432
- **Database:** paper_emr
- **User:** postgres
- **Password:** postgres

## First Time Setup

After starting the container, you may need to run migrations:

```bash
cd server
npm run migrate
```

## Troubleshooting

If port 5432 is already in use:
```bash
# Stop the local PostgreSQL service
brew services stop postgresql@18

# Then start Docker
docker-compose up -d
```

