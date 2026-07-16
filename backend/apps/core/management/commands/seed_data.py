import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.reports.models import Report, ReportIdentity, Evidence
from apps.core.choices import Category, Urgency, Status, Role
from apps.audit.models import AuditLog

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed the database with test users and reports'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-creation even if data exists',
        )

    def handle(self, *args, **options):
        if not options.get('force') and User.objects.exists():
            self.stdout.write(self.style.WARNING('Database already contains users. Use --force to reset.'))
            return

        self.stdout.write('Seeding database...')

        # 1. Create users
        users = {}
        for role in Role.values:
            username = f'{role}_user'
            email = f'{role}@example.com'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'role': role,
                    'phone_number': f'+2567{random.randint(10000000,99999999)}' if role == Role.SECURITY else None,
                }
            )
            if created:
                user.set_password('password123')
                user.save()
            users[role] = user

        self.stdout.write(f'✅ Created {len(users)} users.')

        # 2. Create reports
        security_user = users.get(Role.SECURITY)
        student_user = users.get(Role.STUDENT)
        staff_user = users.get(Role.STAFF)

        reports = []
        categories = [c[0] for c in Category.choices]
        statuses = [s[0] for s in Status.choices]

        for i in range(10):
            is_anonymous = random.choice([True, False])
            report = Report.objects.create(
                category=random.choice(categories),
                description=f'Seed report {i+1}: {random.choice(["Theft", "Assault", "Medical", "Fire", "Harassment"])}',
                urgency=random.choice([Urgency.NORMAL, Urgency.PANIC]),
                status=random.choice(statuses),
                is_anonymous=is_anonymous,
                latitude=round(random.uniform(2.2, 2.3), 6),
                longitude=round(random.uniform(32.8, 33.0), 6),
                assigned_to=security_user if random.choice([True, False]) else None,
                metadata={'source': 'seed_data'}
            )
            # Create identity (even for anonymous)
            reporter = random.choice([student_user, staff_user])
            ReportIdentity.objects.create(
                report=report,
                encrypted_reporter_ref=f"SEED_{reporter.id}_{random.randint(1000,9999)}"
            )
            reports.append(report)

        self.stdout.write(f'✅ Created {len(reports)} reports.')

        # 3. Add some evidence to a few reports
        for report in random.sample(reports, min(3, len(reports))):
            Evidence.objects.create(
                report=report,
                file=None,
                file_type='other'
            )

        self.stdout.write('✅ Seed data created successfully!')
        self.stdout.write(self.style.SUCCESS(
            f'Users: {User.objects.count()}, Reports: {Report.objects.count()}, Evidence: {Evidence.objects.count()}'
        ))
