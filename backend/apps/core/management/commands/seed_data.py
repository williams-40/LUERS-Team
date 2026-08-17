import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.reports.models import Report, Evidence, Department
from apps.core.choices import Category, Urgency, Status, Role
from apps.accounts.models import Role as RoleModel
from apps.audit.models import AuditLog

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed the database with test users, departments, and reports'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-creation even if data exists',
        )

    def _create_departments(self):
        """Create default departments — headless, see note below."""
        dept_data = [
            {'name': 'Security', 'description': 'Handles theft, assault, harassment, and other security-related incidents'},
            {'name': 'ICT Services', 'description': 'Handles computer, network, and account/access issues'},
            {'name': 'Academic Affairs', 'description': 'Handles academic issues, disputes, and student affairs'},
            {'name': 'Student Affairs', 'description': 'Handles accommodation, welfare, and student support matters'},
            {'name': 'Finance', 'description': 'Handles fees, tuition, refunds, and payment issues'},
            {'name': 'Health & Safety', 'description': 'Handles medical emergencies, fire, and safety hazards'},
            {'name': 'Estates / Maintenance', 'description': 'Handles facilities, plumbing, electrical, and repair issues'},
            {'name': 'Library', 'description': 'Handles library resources and access issues'},
            {'name': 'Human Resources', 'description': 'Handles staff conduct, employment, and payroll matters'},
            {'name': 'Administration', 'description': 'Handles general administrative matters'},
            {'name': 'Other', 'description': 'Uncategorized reports; routed automatically where possible, otherwise handled by system admin'},
        ]

        departments = []
        for data in dept_data:
            dept, created = Department.objects.get_or_create(
                name=data['name'],
                defaults={'description': data['description']}
            )
            departments.append(dept)
            if created:
                self.stdout.write(f"  Created department: {dept.name}")

        # No seeded heads (2026-08-17): department headship is now a
        # deliberate system_admin action (DepartmentHeadCreateView), not
        # leftover seed state — every department starts headless, same as
        # a fresh production install would.
        return departments

    def handle(self, *args, **options):
        if not options.get('force') and User.objects.exists():
            self.stdout.write(self.style.WARNING('Database already contains users. Use --force to reset.'))
            return

        self.stdout.write('Seeding database...')

        # 1. Create users — only the 3 core, always-present roles
        # (2026-08-17). Responder accounts are no longer seeded: they only
        # come into existence via DepartmentHeadCreateView (system_admin)
        # or DepartmentResponderCreateView (a head), matching the real
        # provisioning chain rather than a shortcut.
        users = {}
        for role in [Role.STUDENT, Role.STAFF, Role.SYSTEM_ADMIN]:
            username = f'{role}_user'
            email = f'{role}@example.com'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'role': RoleModel.objects.get(slug=role),
                }
            )
            if created:
                user.set_password('password123')
                user.save()
            users[role] = user

        self.stdout.write(f'✅ Created {len(users)} users.')

        # 2. Create departments (headless — see _create_departments)
        departments = self._create_departments()
        self.stdout.write(f'✅ Created {len(departments)} departments.')

        # 3. Create reports
        student_user = users.get(Role.STUDENT)
        staff_user = users.get(Role.STAFF)

        reports = []
        categories = [c[0] for c in Category.choices]  # includes 'academic'
        statuses = [s[0] for s in Status.choices]

        # Expanded description pool to include Academic
        description_pool = ["Theft", "Assault", "Medical", "Fire", "Harassment", "Academic"]

        for i in range(10):
            # Choose a random department for the report (for future routing)
            department = random.choice(departments) if departments else None
            reporter = random.choice([student_user, staff_user])
            report = Report.objects.create(
                category=random.choice(categories),
                description=f'Seed report {i+1}: {random.choice(description_pool)}',
                urgency=random.choice([Urgency.NORMAL, Urgency.PANIC]),
                status=random.choice(statuses),
                reporter=reporter,
                latitude=round(random.uniform(2.2, 2.3), 6),
                longitude=round(random.uniform(32.8, 33.0), 6),
                assigned_to=None,  # no responders exist at seed time — see provisioning chain note above
                metadata={'source': 'seed_data'},
                department=department,
                custom_department='' if department and department.name != 'Other' else 'Custom Dept',
            )
            reports.append(report)

        self.stdout.write(f'✅ Created {len(reports)} reports.')

        # 4. Add some evidence to a few reports
        for report in random.sample(reports, min(3, len(reports))):
            Evidence.objects.create(
                report=report,
                file=None,
                file_type='other'
            )

        self.stdout.write('✅ Seed data created successfully!')
        self.stdout.write(self.style.SUCCESS(
            f'Users: {User.objects.count()}, Departments: {Department.objects.count()}, Reports: {Report.objects.count()}, Evidence: {Evidence.objects.count()}'
        ))