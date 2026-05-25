# Service template — do not run directly

Copy with:

```bash
./scripts/new-service.sh <slug> <port> [db_name]
```

Example:

```bash
./scripts/new-service.sh gamification 8003
```

Creates `services/gamification-service/` from this folder and prints wiring steps for
docker-compose, nginx, Makefile, and `.env`.
