// Mirrors backend/apps/core/choices.py — keep these in sync with the Django TextChoices.

export const Role = {
  STUDENT: 'student',
  STAFF: 'staff',
  SECURITY: 'security',
  ICT_ADMIN: 'ict_admin',
  MANAGEMENT: 'management',
  SYSTEM_ADMIN: 'system_admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Matches ADMIN_ROLES in backend/apps/notifications/consumers.py and get_accessible_reports. */
export const ADMIN_ROLES: Role[] = [Role.SECURITY, Role.ICT_ADMIN, Role.MANAGEMENT, Role.SYSTEM_ADMIN];

/** Matches IsStudentOrStaff in backend/apps/accounts/permissions.py — who can create reports. */
export const REPORTER_ROLES: Role[] = [Role.STUDENT, Role.STAFF];

export const Category = {
  THEFT: 'theft',
  ASSAULT: 'assault',
  MEDICAL: 'medical',
  FIRE: 'fire',
  HARASSMENT_GBV: 'harassment_gbv',
  ACADEMIC: 'academic',
  OTHER: 'other',
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const Urgency = {
  PANIC: 'panic',
  NORMAL: 'normal',
} as const;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

export const Status = {
  NEW: 'new',
  ACKNOWLEDGED: 'acknowledged',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;
export type Status = (typeof Status)[keyof typeof Status];

export const FileType = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  OTHER: 'other',
} as const;
export type FileType = (typeof FileType)[keyof typeof FileType];

export interface User {
  id: string;
  username: string;
  email: string;
  phone_number: string | null;
  role: Role;
  university_id: string | null;
}

export interface Department {
  id: string;
  name: string;
}

export interface Officer {
  id: string;
  username: string;
}

export interface Evidence {
  id: string;
  file: string;
  file_url: string | null;
  file_type: FileType;
  created_at: string;
}

export interface ReportListItem {
  id: string;
  category: Category;
  category_display: string;
  description: string;
  urgency: Urgency;
  urgency_display: string;
  status: Status;
  status_display: string;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  assigned_to: string | null;
  assigned_to_username: string | null;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  evidence_count: number;
  department_id: string | null;
  department_name: string | null;
}

export interface ReportDetail extends Omit<ReportListItem, 'evidence_count'> {
  metadata: Record<string, unknown>;
  evidence: Evidence[];
}

export interface CreateReportInput {
  category: Category;
  description: string;
  urgency: Urgency;
  is_anonymous: boolean;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  custom_department?: string;
  idempotency_key?: string;
  client_created_at?: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DashboardSummary {
  total: number;
  category_counts: { category: Category; count: number }[];
  status_counts: { status: Status; count: number }[];
  urgency_counts: { urgency: Urgency; count: number }[];
  average_response_time_hours: number | null;
}
