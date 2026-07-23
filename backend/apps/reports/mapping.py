# apps/reports/mapping.py
from apps.reports.models import Department
from apps.core.choices import Category

# Map category names (the choice value) to department name strings
CATEGORY_DEPARTMENT_MAP = {
    Category.THEFT: 'Security',
    Category.ASSAULT: 'Security',
    Category.HARASSMENT_GBV: 'Security',
    Category.MEDICAL: 'Health & Safety',
    Category.FIRE: 'Health & Safety',
    Category.ACADEMIC: 'Academic Affairs',
    Category.OTHER: 'Other',   # handled by system admin
}

def get_department_for_category(category_value):
    """
    Return a Department instance for a given category value (e.g., 'theft').
    If the category is 'other', return None (to be handled by system admin).
    If the department name is not found, return None.
    """
    if category_value == Category.OTHER:
        return None
    dept_name = CATEGORY_DEPARTMENT_MAP.get(category_value)
    if dept_name:
        try:
            return Department.objects.get(name=dept_name)
        except Department.DoesNotExist:
            return None
    return None