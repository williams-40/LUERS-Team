from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.reports.models import Report


class Command(BaseCommand):
    help = (
        'Hard-deletes reports that have been soft-deleted (deleted_at set) '
        'for longer than the retention window. Evidence AND AuditLog rows '
        'for that report all cascade-delete with it (confirmed live: '
        'purging 1 report also removed every AuditLog entry that '
        'referenced it) — so a purge is a genuine, total erasure, '
        'including the report\'s own history, not just its content. '
        'If audit-trail permanence across purges is ever required, that '
        'needs a deliberate follow-up (e.g. AuditLog.report changed to '
        'SET_NULL) — not assumed here. Intended to be run manually or via an '
        'external scheduler (cron) — see docs/postgres-backup-runbook.md for '
        'how this ties into backup and retention policy.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Retention window in days (default: 90). Reports soft-deleted longer ago than this are purged.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only report how many reports would be purged, without deleting anything.',
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        cutoff = timezone.now() - timedelta(days=days)

        queryset = Report.objects.filter(deleted_at__isnull=False, deleted_at__lt=cutoff)
        count = queryset.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'[dry-run] Would purge {count} report(s) soft-deleted before {cutoff.isoformat()}.'
                )
            )
            return

        if count == 0:
            self.stdout.write(f'No reports soft-deleted before {cutoff.isoformat()}. Nothing to purge.')
            return

        deleted_total, deleted_by_model = queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f'Purged {count} report(s) soft-deleted before {cutoff.isoformat()} '
                f'({deleted_total} row(s) total across related tables): {deleted_by_model}'
            )
        )
