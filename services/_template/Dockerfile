FROM python:3.12-slim

ARG DOCKER_UID
ARG DOCKER_GID

RUN groupadd --gid "${DOCKER_GID}" app \
    && useradd --uid "${DOCKER_UID}" --gid app --create-home --shell /bin/bash --home-dir /home/app app

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY . /app
RUN if [ -f /app/requirements.txt ]; then pip install --no-cache-dir -r /app/requirements.txt; fi \
    && chown -R app:app /app

EXPOSE 8000

USER app

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
