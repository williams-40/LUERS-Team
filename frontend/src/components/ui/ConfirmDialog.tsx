import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Built on the existing Modal primitive — replaces the three window.confirm()
 * call sites (RoleFormPage, DepartmentFormPage, ReportDetailPage delete)
 * with an accessible, styled equivalent. No new confirmations are added
 * beyond those three.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-ink-secondary mb-5 text-sm">{description}</p>
      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
