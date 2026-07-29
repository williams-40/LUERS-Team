import { Category, Role } from '../types/domain';

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
