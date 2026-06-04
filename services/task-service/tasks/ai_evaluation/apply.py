from ..models import TaskCategoryReward

CATEGORIES = ('responsibility', 'learning', 'health', 'creativity')


def apply_classification(task, result):
    task.ai_summary = result.get('summary', '')
    task.ai_evaluated = True
    task.save(update_fields=['ai_summary', 'ai_evaluated'])

    for category in CATEGORIES:
        score = int(result.get(category, 0))
        if score > 0:
            TaskCategoryReward.objects.create(
                task=task,
                category=category,
                points_value=score,
            )
