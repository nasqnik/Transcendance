.PHONY: up down build restart logs ps shell clean fclean app delapp \
        up-front build-front restart-front logs-front shell-front

up:
	docker compose up -d backend

down:
	docker compose down

clean:
	docker compose down --remove-orphans

fclean:
	docker compose down --remove-orphans --volumes

build:
	docker compose build backend

restart:
	docker compose restart backend

logs:
	docker compose logs -f backend

ps:
	docker compose ps

shell:
	docker compose exec backend /bin/sh

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

# production make commands -> to delete later

# usage: make app name=<app_name>
app:
	@test -n "$(name)" || (echo "Usage: make app name=<app_name>" && exit 1)
	docker compose up -d backend
	docker compose exec backend python manage.py startapp $(name)
	@if rg -q "^[[:space:]]*'$(name)'," backend/core/settings.py; then \
		echo "[INFO] '$(name)' already exists in INSTALLED_APPS"; \
	else \
		awk -v app="$(name)" '\
			/INSTALLED_APPS = \[/ { in_apps=1 } \
			in_apps && /^]/ && !added { print "    \047" app "\047,"; added=1; in_apps=0 } \
			{ print } \
		' backend/core/settings.py > backend/core/settings.py.tmp && mv backend/core/settings.py.tmp backend/core/settings.py; \
		echo "[OK] Added '$(name)' to INSTALLED_APPS"; \
	fi
	@echo ""
	@echo "Done. Remaining steps:"
	@echo "1) Add routes in backend/core/urls.py (include your app urls)"
	@echo "2) Create backend/$(name)/urls.py if needed"
	@echo "3) Create models, then run migrations:"
	@echo "   docker compose exec backend python manage.py makemigrations"
	@echo "   docker compose exec backend python manage.py migrate"

# usage: make delapp name=<app_name>
delapp:
	@test -n "$(name)" || (echo "Usage: make delapp name=<app_name>" && exit 1)
	docker compose run --rm backend sh -c "rm -rf /app/$(name)"
	@if rg -q "^[[:space:]]*'$(name)'," backend/core/settings.py; then \
		awk '!/^[[:space:]]*'\''$(name)'\'',$$/' backend/core/settings.py > backend/core/settings.py.tmp && mv backend/core/settings.py.tmp backend/core/settings.py; \
		echo "[OK] Removed '$(name)' from INSTALLED_APPS"; \
	else \
		echo "[INFO] '$(name)' not found in INSTALLED_APPS"; \
	fi
	@echo ""
	@echo "Done. Remaining checks:"
	@echo "1) Remove app routes/imports from backend/core/urls.py if you added any"
	@echo "2) If app had models/migrations, create cleanup migration if needed"
