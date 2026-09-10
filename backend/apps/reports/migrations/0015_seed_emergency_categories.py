from django.db import migrations
from apps.reports.emergency_category_seed_data import seed, DEFAULT_CATEGORIES


def seed_forward(apps, schema_editor):
    """
    Seeds the 5 default EmergencyCategory rows, reproducing exactly what
    used to be the hardcoded EMERGENCY_TYPE_DEPARTMENT_MAP dict (still in
    luers_backend/settings/base.py at this point in the migration history —
    it's deleted only once this and the routing-logic changes that read
    from EmergencyCategory instead are verified live, per the project plan).

    Assumes the standard Department rows ('Security', 'Health & Safety')
    already exist in this environment — true for any already-deployed
    database (Department has existed since migration 0002) and true for a
    fresh dev install once `seed_data` has been run. If a named department
    doesn't resolve, the category is created with department=None rather
    than blocking this migration — see emergency_category_seed_data.seed's
    own docstring.
    """
    Department = apps.get_model('reports', 'Department')
    EmergencyCategory = apps.get_model('reports', 'EmergencyCategory')
    seed(Department, EmergencyCategory)


def seed_backward(apps, schema_editor):
    EmergencyCategory = apps.get_model('reports', 'EmergencyCategory')
    EmergencyCategory.objects.filter(slug__in=[c[0] for c in DEFAULT_CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0014_emergency_category'),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
