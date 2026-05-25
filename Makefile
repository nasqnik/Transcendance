export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1

SSL_CERT := security/ssl/server.crt
SSL_KEY := security/ssl/server.key
AUTH_SERVICE := auth-service
TASK_SERVICE := task-service
SERVICES := $(AUTH_SERVICE) $(TASK_SERVICE)

.PHONY: all up down build build-all restart logs ps shell clean fclean ssl ssl-if-missing migrate init-dbs \
        up-front build-front restart-front logs-front shell-front \
        logs-auth shell-auth logs-task shell-task restart-task

all: ssl-if-missing
	docker compose up -d --build
	$(MAKE) init-dbs
	$(MAKE) migrate

init-dbs: init-auth-db init-task-db

init-auth-db:
	docker compose exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname='"'"'auth_db'"'"'" | grep -q 1 \
		|| psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "CREATE DATABASE auth_db;"'

init-task-db:
	docker compose exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname='"'"'task_db'"'"'" | grep -q 1 \
		|| psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "CREATE DATABASE task_db;"'

migrate:
	@for svc in $(SERVICES); do \
		echo "==> migrate $$svc"; \
		docker compose exec $$svc python manage.py migrate; \
	done

ssl-if-missing:
	@test -f $(SSL_CERT) && test -f $(SSL_KEY) || $(MAKE) ssl

build-all:
	docker compose build

up:
	docker compose up -d $(SERVICES)

down:
	docker compose down

clean:
	docker compose down --remove-orphans

fclean:
	docker compose down --remove-orphans --volumes

build:
	docker compose build $(AUTH_SERVICE)

restart:
	docker compose restart $(AUTH_SERVICE)

logs:
	docker compose logs -f $(AUTH_SERVICE)

logs-auth:
	docker compose logs -f $(AUTH_SERVICE)

logs-task:
	docker compose logs -f $(TASK_SERVICE)

ps:
	docker compose ps

shell:
	docker compose exec $(AUTH_SERVICE) /bin/sh

shell-auth:
	docker compose exec $(AUTH_SERVICE) /bin/sh

shell-task:
	docker compose exec $(TASK_SERVICE) /bin/sh

restart-task:
	docker compose restart $(TASK_SERVICE)

up-front:
	docker compose up -d frontend

build-front:
	docker compose build frontend

restart-front:
	docker compose restart frontend

logs-front:
	docker compose logs -f frontend

shell-front:
	docker compose exec frontend /bin/sh

ssl:
	bash security/ssl/certificate_gen.sh

app:
	@test -n "$(name)" || (echo "Usage: make app name=<app_name>" && exit 1)
	docker compose up -d $(AUTH_SERVICE)
	docker compose exec $(AUTH_SERVICE) python manage.py startapp $(name)
	@if rg -q "^[[:space:]]*'$(name)'," services/auth-service/core/settings.py; then \
		echo "[INFO] '$(name)' already exists in INSTALLED_APPS"; \
	else \
		awk -v app="$(name)" '\
			/INSTALLED_APPS = \[/ { in_apps=1 } \
			in_apps && /^]/ && !added { print "    \047" app "\047,"; added=1; in_apps=0 } \
			{ print } \
		' services/auth-service/core/settings.py > services/auth-service/core/settings.py.tmp && mv services/auth-service/core/settings.py.tmp services/auth-service/core/settings.py; \
		echo "[OK] Added '$(name)' to INSTALLED_APPS"; \
	fi
	@echo ""
	@echo "Done. Remaining steps:"
	@echo "1) Add routes in services/auth-service/core/urls.py (include your app urls)"
	@echo "2) Create services/auth-service/$(name)/urls.py if needed"
	@echo "3) Create models, then run migrations:"
	@echo "   docker compose exec $(AUTH_SERVICE) python manage.py makemigrations"
	@echo "   make migrate"

delapp:
	@test -n "$(name)" || (echo "Usage: make delapp name=<app_name>" && exit 1)
	docker compose run --rm $(AUTH_SERVICE) sh -c "rm -rf /app/$(name)"
	@if rg -q "^[[:space:]]*'$(name)'," services/auth-service/core/settings.py; then \
		awk '!/^[[:space:]]*'\''$(name)'\'',$$/' services/auth-service/core/settings.py > services/auth-service/core/settings.py.tmp && mv services/auth-service/core/settings.py.tmp services/auth-service/core/settings.py; \
		echo "[OK] Removed '$(name)' from INSTALLED_APPS"; \
	else \
		echo "[INFO] '$(name)' not found in INSTALLED_APPS"; \
	fi
	@echo ""
	@echo "Done. Remaining checks:"
	@echo "1) Remove app routes/imports from services/auth-service/core/urls.py if you added any"
	@echo "2) If app had models/migrations, create cleanup migration if needed"
