import json
import sys

from django.conf import settings
from openai import APIConnectionError, APITimeoutError, OpenAI

MINIMUM_SCORE = 0
MAXIMUM_SCORE = 10


SCORING_SYSTEM_PROMPT = f"""
You are scoring children's tasks for a reward system.

Score range:
- {MINIMUM_SCORE} = minimum
- {MAXIMUM_SCORE} = maximum

Scoring dimensions:
1. Difficulty
2. Time required
3. Physical or mental effort
4. Habit/value for personal growth
5. Creativity (ONLY if truly creative)

Score buckets:
- 0 -> unrelated to category
- 1-2 -> trivial
- 3-4 -> easy
- 5-6 -> moderate
- 7-8 -> difficult
- 9-10 -> exceptional effort

Rules:
- Entertainment-only tasks should not score high.
- Short and simple tasks should usually stay below 5.
- Long-term habit building can increase score slightly.
- Creativity should ONLY score high for artistic or imaginative tasks.
- If the task is unclear or vague, lower the score.
- Do not give all categories similar scores.
- Only score categories relevant to the task.
"""


CLASSIFY_TASK_SYSTEM_PROMPT = f"""
You classify children's tasks into reward categories.

Return ONLY valid JSON.
No markdown.
No explanations outside JSON.

Categories:

1. responsibility
Tasks related to chores, helping others, discipline, organization, or duties.

2. learning
Tasks related to studying, reading, practicing skills, school, coding, or education.

3. health
Tasks related to exercise, hygiene, sleep, healthy habits, or physical activity.

4. creativity
Tasks involving imagination, artistic work, writing stories, drawing, music, etc.

{SCORING_SYSTEM_PROMPT}

Required JSON format:

{{
    "responsibility": 0,
    "learning": 0,
    "health": 0,
    "creativity": 0,
    "summary": "short summary",
    "reasoning": {{
        "difficulty": "",
        "time_required": "",
        "effort": "",
        "habit_value": ""
    }},
    "confidence": "high",
    "needs_parent_review": false,
    "ai_playground": ""
}}

Rules for confidence:
- "high" -> task is clear
- "medium" -> partially clear
- "low" -> vague or ambiguous

Set needs_parent_review to true if:
- task is too vague
- score is uncertain
- task could be interpreted multiple ways
"""


def _get_client():
    return OpenAI(
        base_url='https://openrouter.ai/api/v1',
        api_key=settings.OPENROUTER_API_KEY,
    )


def classify_task(
    task_description,
    system_prompt=CLASSIFY_TASK_SYSTEM_PROMPT,
):
    try:
        response = _get_client().chat.completions.create(
            model='openai/gpt-4o-mini',
            temperature=0.3,
            messages=[
                {
                    'role': 'system',
                    'content': system_prompt,
                },
                {
                    'role': 'user',
                    'content': task_description,
                },
            ],
        )

    except (APIConnectionError, APITimeoutError) as exc:
        raise RuntimeError(
            'Could not reach OpenRouter. '
            'Check your internet connection and try again.'
        ) from exc

    content = response.choices[0].message.content

    try:
        parsed_json = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            'Model returned invalid JSON.'
        ) from exc

    return parsed_json

if __name__ == '__main__':
    import os

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    import django

    django.setup()

    task_description = 'I will play with my dog for 600 minutes'

    try:
        result = classify_task(task_description)

        print(json.dumps(result, indent=4))

    except RuntimeError as exc:
        print(f'Error: {exc}', file=sys.stderr)
        sys.exit(1)
