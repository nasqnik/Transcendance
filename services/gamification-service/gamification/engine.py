from .models import KidProfile, KidStat, CompletionEvent
from django.db import transaction
from django.conf import settings

def apply_completion(kid_id, completion_id, category_points):
    # all or nothing transaction
    # if any step fails, the entire transaction is rolled back
    with transaction.atomic():
        if CompletionEvent.objects.filter(completion_id=completion_id).exists():
            return

        completion_event = CompletionEvent.objects.create(
            completion_id=completion_id,
            kid_id=kid_id,
            payload=category_points,
        )

        # _ is used to ignore
        # select_for_update() is used to lock the row for the duration of the transaction
        # get_or_create() is used to create the row if it doesn't exist
        kid_profile, _ = KidProfile.objects.select_for_update().get_or_create(kid_id=kid_id)

        for item in category_points:
            kid_stat, _ = KidStat.objects.select_for_update().get_or_create(
                kid_id=kid_id,
                category=item['category'],
            )

            kid_stat.xp_percent += item['points']
            while kid_stat.xp_percent >= settings.STAT_XP_PER_LEVEL:
                kid_stat.xp_percent -= settings.STAT_XP_PER_LEVEL
                kid_stat.level += 1
                kid_profile.overall_xp += settings.OVERALL_XP_PER_STAT_LEVEL
            kid_stat.save()

        while kid_profile.overall_xp >= settings.MAIN_XP_PER_LEVEL:
            kid_profile.overall_xp -= settings.MAIN_XP_PER_LEVEL
            kid_profile.main_level += 1
            kid_profile.coins += settings.COINS_PER_MAIN_LEVEL
        kid_profile.save()

    return kid_profile, completion_event

