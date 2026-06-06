import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY environment variable is required.")

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'gamification-service']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_spectacular',
    'gamification',
    'common',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.getenv('DB_NAME', 'gamification_db'),
        'USER': os.getenv('DB_USER', 'transcendence'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'transcendence'),
        'HOST': os.getenv('DB_HOST', 'db'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

APP_NAME = os.getenv('APP_NAME', 'KiddoPath')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'common.authentication.KidJWTAuthentication',
        'common.authentication.ParentJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'UNAUTHENTICATED_USER': None,
}

SPECTACULAR_SETTINGS = {
    'TITLE': f'{APP_NAME} Gamification API',
    'DESCRIPTION': 'Gamification service for KiddoPath.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'BearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            },
        },
    },
    'SECURITY': [{'BearerAuth': []}],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '60'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}


STAT_XP_PER_LEVEL = 100
OVERALL_XP_PER_STAT_LEVEL = 50
MAIN_XP_PER_LEVEL = 200
COINS_PER_MAIN_LEVEL = 25

INTERNAL_SERVICE_TOKEN = os.getenv('INTERNAL_SERVICE_TOKEN')
if not INTERNAL_SERVICE_TOKEN:
    raise ImproperlyConfigured("INTERNAL_SERVICE_TOKEN environment variable is required.")