#!/usr/bin/env bash
# Scaffold a new Django microservice from services/_template/
#
# Usage:
#   ./scripts/new-service.sh <slug> <port> [db_name] [nginx_prefixes]
#
# Examples:
#   ./scripts/new-service.sh gamification 8003
#   ./scripts/new-service.sh catalog 8004 catalog_db "/api/catalog/,/api/avatars/"
#
# Creates services/<slug>-service/ only — does NOT edit docker-compose or nginx.
# Follow the printed checklist to wire infra when you are ready to run the service.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="${ROOT}/services/_template"

slug="${1:-}"
port="${2:-}"
db_name="${3:-}"
nginx_prefixes="${4:-}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./scripts/new-service.sh <slug> <port> [db_name] [nginx_prefixes]

  slug             Short name, e.g. gamification (creates gamification-service)
  port             Host port, e.g. 8003
  db_name          Postgres DB name (default: <slug>_db)
  nginx_prefixes   Comma-separated API paths for nginx, e.g. /api/progress/,/api/quests/

Example:
  ./scripts/new-service.sh gamification 8003 gamification_db "/api/progress/,/api/quests/"
EOF
}

[[ -n "$slug" && -n "$port" ]] || { usage; exit 1; }

[[ "$slug" =~ ^[a-z][a-z0-9-]*$ ]] || die "slug must be lowercase letters, digits, or hyphens (start with a letter)"

service_dir="${ROOT}/services/${slug}-service"
env_key="$(echo "$slug" | tr '[:lower:]' '[:upper:]' | tr '-' '_')_DB_NAME"
db_name="${db_name:-${slug}_db}"
service_title="$(tr '[:lower:]' '[:upper:]' <<< "${slug:0:1}")${slug:1}"
compose_service="${slug}-service"
container_name="$(echo "$slug" | tr '-' '_')_service"

[[ -d "$TEMPLATE" ]] || die "template not found at ${TEMPLATE}"
[[ ! -e "$service_dir" ]] || die "${service_dir} already exists"

cp -a "$TEMPLATE" "$service_dir"

find "$service_dir" -type f \( -name '*.py' -o -name '*.md' -o -name '*.txt' \) -print0 \
  | while IFS= read -r -d '' file; do
      sed -i \
        -e "s/__SERVICE_SLUG__/${slug}/g" \
        -e "s/__SERVICE_TITLE__/${service_title}/g" \
        -e "s/__DB_NAME__/${db_name}/g" \
        "$file"
    done

cat <<EOF

[OK] Created ${service_dir}

Next steps (manual — add only when the service should run):

1) .env.example — add:
   ${env_key}=${db_name}

2) scripts/init-databases.sh — add inside the psql block:
   CREATE DATABASE ${db_name};

3) Makefile — add init target and append to SERVICES:
   init-${slug}-db:
   	docker compose exec db sh -c 'psql -U "\$\$POSTGRES_USER" -d "\$\$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname='"'"'${db_name}'"'"'" | grep -q 1 \\
   		|| psql -U "\$\$POSTGRES_USER" -d "\$\$POSTGRES_DB" -c "CREATE DATABASE ${db_name};"'

   SERVICES := ... ${compose_service}

4) docker-compose.yml — add service (copy task-service block, adjust names/ports):
   ${compose_service}:
     build:
       context: ./services/${slug}-service
     container_name: ${container_name}
     ports:
       - "${port}:8000"
     environment:
       DB_NAME: \${${env_key}:-${db_name}}

5) security/nginx/nginx.conf — upstream + locations BEFORE location /api/ :
   upstream ${slug}_api { server ${compose_service}:8000; }
EOF

if [[ -n "$nginx_prefixes" ]]; then
  IFS=',' read -ra prefixes <<< "$nginx_prefixes"
  for prefix in "${prefixes[@]}"; do
    prefix="$(echo "$prefix" | xargs)"
    [[ -n "$prefix" ]] || continue
    echo "   location ${prefix} {"
    echo "       proxy_pass http://${slug}_api${prefix};"
    echo "   }"
  done
else
  cat <<EOF

   # Example (set 4th argument to auto-print):
   # location /api/your-prefix/ {
   #     proxy_pass http://${slug}_api/api/your-prefix/;
   # }
EOF
fi

cat <<EOF

6) Add Django app + routes:
   docker compose exec ${compose_service} python manage.py startapp <app_name>
   # Add to INSTALLED_APPS, include urls in core/urls.py

7) Start and migrate:
   docker compose up -d --build ${compose_service}
   make init-${slug}-db    # after adding Makefile target
   docker compose exec ${compose_service} python manage.py migrate

8) Verify:
   curl -k https://localhost/api/health/   # if nginx routes health to this service
   # or: curl http://localhost:${port}/api/health/

EOF
