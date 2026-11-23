from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_migrate_user_role_values'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='user',
            name='users_role_0ace22_idx',
        ),
        migrations.RemoveField(
            model_name='user',
            name='role',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='role_new',
            new_name='role',
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.ForeignKey(
                null=False, on_delete=django.db.models.deletion.PROTECT,
                related_name='users', to='accounts.role',
            ),
        ),
    ]
