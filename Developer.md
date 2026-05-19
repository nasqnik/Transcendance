# Developer setup

Local development uses **Docker Compose**.

## Quick start

```bash
cp .env.example .env
# Edit .env: set DOCKER_UID / DOCKER_GID from `id -u` and `id -g`

make all
```

`make all` creates SSL certs if missing, builds images (only when Dockerfiles or build context changed), and starts **db**, **backend**, **frontend**, and **nginx**.

| URL | What |
|-----|------|
| https://localhost | App via nginx (HTTPS) |
| https://localhost/admin/ | Django admin via nginx |
| https://localhost/api/… | API via nginx (`/api` prefix stripped) |
| http://localhost:8000 | Backend directly |
| http://localhost:5173 | Frontend directly (Vite) |

Accept the self-signed certificate warning in the browser (dev only).

First-time Django setup:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

## System packages (Ubuntu)

```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 docker-buildx util-linux-extra
```

| Package | Purpose |
|---------|---------|
| `docker.io` | Docker engine and CLI |
| `docker-compose-v2` | `docker compose` subcommand (Compose v2) |
| `docker-buildx` | Build plugin for Compose Bake (`make all` / `--build`) |
| `util-linux-extra` | `newgrp` (apply `docker` group without logging out) |

Verify:

```bash
docker --version
docker compose version
docker buildx version
```

**Bake / buildx warning:** If you see `Docker Compose is configured to build using Bake, but buildx isn't installed`, run `sudo apt install docker-buildx`.

Do **not** install Docker via `sudo snap install docker` if you use the apt packages above (avoid mixing installs).

## Docker daemon and permissions

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Apply the `docker` group (pick one):

```bash
newgrp docker
```

Or log out and back in (or reboot).

Verify (no `sudo`):

```bash
docker compose ps
```

## Environment file

Compose reads `.env` from the project root (see `.env.example`).

```bash
cp .env.example .env
id -u    # → DOCKER_UID
id -g    # → DOCKER_GID (may differ from UID, e.g. 116)
```

`DOCKER_UID` / `DOCKER_GID` match the container user to your host user so files in `./backend` keep correct permissions.

After changing them, rebuild the backend image:

```bash
make build
```

## SSL certificates (dev)

Self-signed certs for nginx HTTPS:

```bash
make ssl
```

Writes `security/ssl/server.key` and `security/ssl/server.crt`. `make all` runs this automatically if certs are missing.

## Services (docker-compose)

| Service | Container | Role |
|---------|-------------|------|
| `db` | `django_db` | PostgreSQL 16 |
| `backend` | `django_backend` | Django on port 8000 |
| `frontend` | `react_frontend` | Vite/React on port 5173 |
| `nginx` | `nginx_proxy` | HTTPS reverse proxy on port 443 |

Compose creates a default network; services reach each other by name (`backend`, `frontend`, `db`). No custom network is required.

**Nginx routing** (`security/nginx/nginx.conf`):

- `/` → frontend
- `/admin/` → backend (Django admin)
- `/api/` → backend (prefix removed, e.g. `/api/foo` → `/foo`)

After editing nginx config:

```bash
docker compose restart nginx
```

## Makefile commands

### Full stack

| Command | Description |
|---------|-------------|
| `make all` | SSL if needed, build (cached), start all services |
| `make build-all` | Build all images without starting |
| `make down` | Stop all services |
| `make ps` | List containers |
| `make clean` | Stop and remove orphans |
| `make fclean` | Stop, remove orphans and volumes |
| `make ssl` | Generate self-signed TLS certs |

Rebuilds use Docker layer cache: running `make all` again is fast if nothing in Dockerfiles or `COPY` context changed.

### Backend

| Command | Description |
|---------|-------------|
| `make up` | Start backend (+ db) |
| `make build` | Build backend image |
| `make restart` | Restart backend |
| `make logs` | Follow backend logs |
| `make shell` | Shell into backend container |

### Frontend

| Command | Description |
|---------|-------------|
| `make up-front` | Start frontend |
| `make build-front` | Build frontend image |
| `make restart-front` | Restart frontend |
| `make logs-front` | Follow frontend logs |
| `make shell-front` | Shell into frontend container |

### Django apps

| Command | Description |
|---------|-------------|
| `make app name=<app>` | Create app and add to `INSTALLED_APPS` |
| `make delapp name=<app>` | Remove app directory and `INSTALLED_APPS` entry |

Migrations (after models change):

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied` on docker.sock | `usermod -aG docker $USER`, then `newgrp docker` or re-login |
| `docker-compose` not found | Use `docker compose` (v2), not hyphen |
| Vite: host `frontend` not allowed | nginx must send `Host $host` (already in config) |
| nginx mount error on `nginx.config` | Config lives at `security/nginx/nginx.conf` |
| Backend 404 via HTTPS | Use `/admin/` or `/api/…`, not only `/` for Django |
| Compose Bake / buildx warning | `sudo apt install docker-buildx` |
