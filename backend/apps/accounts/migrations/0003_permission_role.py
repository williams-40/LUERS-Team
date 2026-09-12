import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_user_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='Permission',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('slug', models.SlugField(max_length=50, unique=True)),
                ('label', models.CharField(max_length=100)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('category', models.CharField(blank=True, max_length=50)),
            ],
            options={
                'db_table': 'permissions',
                'ordering': ['category', 'slug'],
            },
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('slug', models.SlugField(max_length=30, unique=True)),
                ('label', models.CharField(max_length=50)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('is_builtin', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('permissions', models.ManyToManyField(blank=True, related_name='roles', to='accounts.permission')),
            ],
            options={
                'db_table': 'roles',
                'ordering': ['label'],
            },
        ),
    ]
