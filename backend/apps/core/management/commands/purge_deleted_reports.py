from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.reports.models import Report


class Command(BaseCommand):
    help = (
        'Hard-deletes reports that have been soft-deleted (deleted_at set) '
        'for longer than the retention window. Evidence rows cascade-delete '
        'with the report, but AuditLog rows for it do not (AuditLog.report '
        'is SET_NULL) — a purge erases the report and its files, but the '
        'audit trail of what happened to it survives, with report=None. '
        'Intended to be run manually or via an external scheduler (cron) — '
        'see docs/postgres-backup-runbook.md for how this ties into backup '
        'and retention policy.'
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
