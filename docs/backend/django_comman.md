```
docker compose exec auth-service python manage.py createsuperuser
```

# to enter the container

1. docker compose exec auth-service bash

# to make migrations

1. docker compose exec auth-service python manage.py makemigrations
2. docker compose exec auth-service python manage.py migrate

JWT (SimpleJWT) — after changing `requirements.txt`, **you must rebuild the auth-service image** (a `restart` is not enough — deps install at **build** time in the Dockerfile):

```bash
docker compose build auth-service && docker compose up -d auth-service
docker compose exec auth-service python manage.py check
```

# Parent login (get JWT access + refresh tokens)

- Direct auth-service (compose maps **port 8001**): `POST http://localhost:8001/api/auth/token/`
- Via nginx (HTTPS): `POST https://localhost/api/auth/token/`

If `**curl`** prints nothing, `**curl -s` hides errors** (e.g. connection refused). Use `**curl -sS`** or `**curl -v`**, or `**docker compose logs auth-service**`.

```bash
curl -sS -X POST http://localhost:8001/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"you@example.com","password":"yourpassword"}'
```

# Common issues

## ModuleNotFoundError after adding a pip package

Dependencies were added to `requirements.txt` but the container image is old. Rebuild **auth-service** (see commands above). `**docker compose restart`** does not reinstall pip packages.

Quick fix without rebuild (dev only):

```bash
docker compose exec auth-service pip install --no-cache-dir -r requirements.txt
docker compose restart auth-service
```

Create a new app inside a service 

docker compose exec gamification-service python [manage.py](http://manage.py) startapp gamification