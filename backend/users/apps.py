from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'


# example of a custom app config
# label -> used to reference the app in the project
# verbose_name -> used to display the app in the admin site
# ready -> used to run code when the app is loaded