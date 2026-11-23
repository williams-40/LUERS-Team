from django.db import migrations


def backfill_labels(apps, schema_editor):
    """
    Every pre-existing EmergencyDispatch row gets emergency_type_label
    populated from the matching EmergencyCategory's current name (falling
    back to 'Other' if the slug doesn't match any seeded category — e.g. a
    row from before categories existed at all). Same "backfill so nothing
    downstream has to special-case a null" rationale as 0013's own
    backfill of the EmergencyDispatch rows themselves.
    """
    EmergencyDispatch = apps.get_model('reports', 'EmergencyDispatch')
    EmergencyCategory = apps.get_model('reports', 'EmergencyCategory')

    label_by_slug = dict(EmergencyCategory.objects.values_list('slug', 'name'))
    for dispatch in EmergencyDispatch.objects.exclude(emergency_type_label__gt=''):
        dispatch.emergency_type_label = label_by_slug.get(dispatch.emergency_type, 'Other')
        dispatch.save(update_fields=['emergency_type_label'])


def reverse_noop(apps, schema_editor):
    # Symmetric with 0013's own reverse_noop — reversing would discard a
    # label an operator may already be relying on for display.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0015_seed_emergency_categories'),
    ]

    operations = [
        migrations.RunPython(backfill_labels, reverse_noop),
    ]
