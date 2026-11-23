from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_seed_roles_and_permissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role_new',
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name='users_new', to='accounts.role',
            ),
        ),
    ]
