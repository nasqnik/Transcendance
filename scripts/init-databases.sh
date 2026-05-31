#!/bin/bash
# Runs once on first Postgres volume init (docker-entrypoint-initdb.d).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE auth_db;
    CREATE DATABASE task_db;
    CREATE DATABASE gamification_db;
EOSQL
