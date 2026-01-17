---
description: Hybrid Deployment Rule - Offloading VPS Memory
---
// turbo-all

# Hybrid Deployment Strategy
To ensure the stability of the 1GB RAM Lightsail instance and maintain fast delivery speeds, all front-end builds MUST be offloaded from the server to the local development environment.

## 1. Always Use Hybrid Build
- **NEVER** build the frontend directly on the server (DANGER: OOM/Freeze).
- **ALWAYS** run `./deploy-to-lightsail.sh`. This script has been optimized to:
    a. Build the React app locally on your CPU/RAM.
    b. Package the `dist` folder into `dist.tar.gz`.
    c. Securely upload the artifacts to the server.
    d. Atomically swap the new version into the production web container.

## 2. Maintenance of the Deploy Script
- If you add new environment variables, update the `sed` commands in `deploy-to-lightsail.sh`.
- Ensure the `static/` directory on the server is hard-cleaned (`rm -rf static`) before copying new artifacts to prevent 404 errors or cached file collisions.

## 3. Verify Deployment
- After every deploy, check the HTTP status code. 
- If you see a `404`, check the server's `/home/ubuntu/emr/client/dist` directory for nested folders. The deployment script should handle this automatically by cleaning the destination first.
