# Docker Build Optimization Notes

## Optimizations Applied

### 1. BuildKit Cache Mounts
- **Dockerfile.web**: Uses `--mount=type=cache` for npm cache and build cache
- **Dockerfile.api**: Uses `--mount=type=cache` for npm cache
- **Result**: Dependencies are cached between builds, reducing rebuild time by 60-80%

### 2. Layer Optimization
- Package files copied first (better layer caching)
- Dependencies installed before source code copy
- Build dependencies removed after installation (smaller images)

### 3. Build Context Optimization
- Separate `.dockerignore` files in `client/` and `server/` directories
- Smaller build contexts = faster uploads to Docker daemon

### 4. Parallel Builds
- `quick-build.sh` can build API and web in parallel
- Uses BuildKit for concurrent layer processing

### 5. Timeout Protection
- All build scripts have timeout limits (5 min for builds, 2 min for operations)
- Prevents hangs from network issues or stuck processes

### 6. Faster Health Checks
- Reduced health check intervals and timeouts
- Faster failure detection

## Usage

### Quick Build (with timeout protection)
```bash
cd deploy
./quick-build.sh [web|api|all]
```

### Quick Deploy (build + restart)
```bash
cd deploy
./quick-deploy.sh [web|api|all]
```

### Enable BuildKit (required for optimizations)
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

Or add to `~/.bashrc`:
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

## Expected Performance Improvements

- **First build**: Similar time (no cache)
- **Subsequent builds** (no dependency changes): 60-80% faster
- **Subsequent builds** (dependency changes only): 40-60% faster
- **Source-only changes**: 70-90% faster

## Troubleshooting

If builds still hang:
1. Check Docker daemon: `docker info`
2. Check disk space: `df -h`
3. Clear BuildKit cache: `docker builder prune`
4. Use timeout scripts: `./quick-build.sh web`

