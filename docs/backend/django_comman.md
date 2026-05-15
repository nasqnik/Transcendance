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