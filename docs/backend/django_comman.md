create superuser for django
    docker compose exec backend python manage.py createsuperuser

django-admin startproject <project name> .

every time you will create a new model:
1.    docker compose exec backend bash
2.    python manage.py makemigrations
3.    python manage.py migrate
or
1.    docker compose exec backend python manage.py makemigrations
2.    docker compose exec backend python manage.py migrate

JWT (SimpleJWT) — after changing `requirements.txt`, **you must rebuild the backend image** (a `restart` is not enough — deps install at **build** time in the Dockerfile):

```bash
docker compose build backend && docker compose up -d backend
docker compose exec backend python manage.py check
```

Endpoints (JSON uses **`emailOrUsername`** + **`password`** — email or username for parent login). Use your real superuser values — not placeholders like `<superuser-email>`.

- Direct backend (compose maps **port 8000**): `POST http://localhost:8000/api/auth/token/`
- Behind nginx (**HTTPS**): `POST https://localhost/api/auth/token/` — add **`curl -k`** for the self-signed cert in dev.

- Obtain: `{"emailOrUsername":"you@example.com","password":"your-password"}` → `access` + `refresh`
- Refresh: `{"refresh":"<refresh-token>"}`
- Verify: `{"token":"<access-token>"}`

If **`curl`** prints nothing, **`curl -s` hides errors** (e.g. connection refused). Use **`curl -sS`** or **`curl -v`**, or **`docker compose logs backend`**.

```bash
curl -sS http://localhost:8000/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"emailOrUsername":"you@example.com","password":"your-real-password"}'
```

```bash
curl -sSk https://localhost/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"emailOrUsername":"you@example.com","password":"your-real-password"}'
```

### If logs show `ModuleNotFoundError: No module named 'rest_framework'`

Dependencies were added to `requirements.txt` but the container image is old. Rebuild **backend** (see commands above). **`docker compose restart`** does not reinstall pip packages.

Quick one-off install inside the running container (lost on next recreate unless you rebuild):

```bash
docker compose exec backend pip install --no-cache-dir -r requirements.txt
docker compose restart backend
```
python manage.py createsuperuser