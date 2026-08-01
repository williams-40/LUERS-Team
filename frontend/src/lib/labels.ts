import { Action, Category, Role } from '../types/domain';

export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.THEFT]: 'Theft',
  [Category.ASSAULT]: 'Assault',
  [Category.MEDICAL]: 'Medical',
  [Category.FIRE]: 'Fire',
  [Category.HARASSMENT_GBV]: 'Harassment / GBV',
  [Category.ACADEMIC]: 'Academic',
  [Category.OTHER]: 'Other',
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.STUDENT]: 'Student',
  [Role.STAFF]: 'Staff',
  [Role.SECURITY]: 'Security Officer',
  [Role.ICT_ADMIN]: 'ICT Admin',
  [Role.MANAGEMENT]: 'Management',
  [Role.SYSTEM_ADMIN]: 'System Admin',
};

export const ACTION_LABELS: Record<Action, string> = {
  [Action.CREATE]: 'Create',
  [Action.STATUS_UPDATE]: 'Status Update',
  [Action.ASSIGN]: 'Assign',
  [Action.EVIDENCE_UPLOAD]: 'Evidence Upload',
  [Action.DEANONYMIZE]: 'Deanonymize',
  [Action.SOFT_DELETE]: 'Soft Delete',
  [Action.RESTORE]: 'Restore',
};
