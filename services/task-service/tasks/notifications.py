import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# How long we wait for gamification before giving up. Kept short so a slow or
# down gamification-service never blocks the kid's request.
PUSH_TIMEOUT_SECONDS = 3


def push_completion_confirmed(completion):
    """Notify gamification-service that a completion is confirmed.

    Best-effort: any failure is logged and swallowed. The ingest endpoint is
    idempotent (keyed on completion_id), so a dropped push can be safely
    replayed later without double-counting.
    """
    # Each reward row maps a category to the points the kid earns for it.
    category_points = [
        {'category': reward.category, 'points': reward.points_value}
        for reward in completion.task.category_rewards.all()
    ]

    # Nothing to award (task has no category rewards) -> skip the call entirely.
    if not category_points:
        return

    url = f"{settings.GAMIFICATION_INTERNAL_URL}/api/gamification/internal/completions/"
    payload = {
        # completion.id doubles as the idempotency key on the gamification side.
        'completion_id': str(completion.id),
        'kid_id': str(completion.kid_id),
        'category_points': category_points,
    }
    headers = {
        # Shared secret that proves the request came from a trusted service.
        'X-Internal-Token': settings.INTERNAL_SERVICE_TOKEN,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=PUSH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        # Don't raise: confirming a task must succeed even if gamification is down.
        logger.warning(
            "Failed to push completion %s to gamification: %s",
            completion.id,
            exc,
        )
