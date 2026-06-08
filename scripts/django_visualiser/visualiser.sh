# One HTML per service:
# python3 model_visualiser.py ../../services/gamification-service/gamification/models.py
# python3 model_visualiser.py ../../services/task-service/tasks/models.py
# python3 model_visualiser.py ../../services/auth-service/users/models.py

# All services in one HTML:
python3 model_visualiser.py \
  ../../services/gamification-service/gamification/models.py \
  ../../services/task-service/tasks/models.py \
  ../../services/auth-service/users/models.py \
  --open