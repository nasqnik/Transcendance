# KiddoPath

## First time setup

```bash
cp .env.example .env
```

Edit `.env`: set `DOCKER_UID` and `DOCKER_GID` (`id -u` and `id -g`).

```bash
make all
```

That starts Docker and runs database migrations.

Open **https://localhost** (accept the self-signed certificate warning).

## Useful commands

| Command | What it does |
|---------|----------------|
| `make all` | Start everything + migrate database |
| `make migrate` | Run database migrations only |
| `make down` | Stop all services |

More details: [Developer.md](Developer.md)
