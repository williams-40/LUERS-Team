from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.core.choices import Role
from apps.core.models import BaseModel

class User(BaseModel, AbstractUser):
    # AbstractUser already provides: username, email, password, first_name, last_name, is_active, date_joined
    # We'll override email to be unique
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    university_id = models.CharField(max_length=50, blank=True, null=True)

    USERNAME_FIELD = 'username'   # default, but we could set email if desired
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['university_id']),
        ]

    def __str__(self):
        return self.username
