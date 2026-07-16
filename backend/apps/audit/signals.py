from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from apps.reports.models import Report
from apps.audit.models import AuditLog
from apps.core.choices import Action

@receiver(pre_save, sender=Report)
def log_report_change(sender, instance, **kwargs):
    if instance.pk:
        old = sender.objects.get(pk=instance.pk)
        # Detect status change
        if old.status != instance.status:
            AuditLog.objects.create(
                report=instance,
                actor=None,  # Will need request user – tricky in signals
                action=Action.STATUS_UPDATE,
                before_state={'status': old.status},
                after_state={'status': instance.status}
            )