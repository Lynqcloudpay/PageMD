# Manual Deployment Instructions

The clock counter changes have been committed and pushed to GitHub. To deploy manually on the server:

## Option 1: Quick Deploy (Recommended)

SSH into the server and run:

```bash
cd /home/ubuntu/emr
git pull origin main
cd deploy
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web
```

## Option 2: Use the Fast Update Script

If the `fast-web-update.sh` script is on the server:

```bash
cd /home/ubuntu/emr/deploy
bash fast-web-update.sh
```

## Option 3: Full Restart (if needed)

```bash
cd /home/ubuntu/emr/deploy
docker compose -f docker-compose.prod.yml restart web
```

## What Changed

- Added a prominent clock counter to the schedule patient status
- Clock shows total visit time (from arrival)
- More vibrant blue gradient colors when patient is active
- Updates every second in real-time

The changes are in: `client/src/components/InlinePatientStatus.jsx`

