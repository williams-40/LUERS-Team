"""
Single source of truth for the default EmergencyCategory rows — used by
both migration 0015 (real deploys) and apps/core/factories.py-driven tests
(pytest.ini's --nomigrations skips RunPython data migrations entirely, so
tests seed via EmergencyCategoryFactory instead — see that factory's own
comment). Reproduces exactly what used to be the hardcoded
EMERGENCY_TYPE_DEPARTMENT_MAP in luers_backend/settings/base.py, as real,
admin-editable rows.
"""

# slug, name, department_name, requires_description_and_routing, sort_order
DEFAULT_CATEGORIES = [
    ('security', 'Security / Threat', 'Security', False, 0),
    ('medical', 'Medical Emergency', 'Health & Safety', False, 1),
    ('fire', 'Fire', 'Health & Safety', False, 2),
    ('accident', 'Accident', 'Health & Safety', False, 3),
    ('other', 'Other', 'Security', True, 4),
]


def seed(department_model, category_model):
    """
    Idempotent — safe to call from both a migration (historical models via
    apps.get_model) and a management command. Never invents a Department
    row: if the named department doesn't exist yet in this environment,
    the category is created with department=None (SET_NULL-safe) rather
    than blocking — an admin can fix the mapping later via the
    EmergencyCategory admin UI.
    """
    for slug, name, department_name, requires_routing, sort_order in DEFAULT_CATEGORIES:
        department = department_model.objects.filter(name=department_name).first()
        category_model.objects.get_or_create(
            slug=slug,
            defaults={
                'name': name,
                'department': department,
                'requires_description_and_routing': requires_routing,
                'sort_order': sort_order,
            },
        )
