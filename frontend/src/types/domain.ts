// Role/Permission are now backend-managed (Phase 15) — no fixed enum here.
// Authorization checks go through `user.permissions` (a flat slug list),
// not a closed set of role names. See RequireAuth.tsx.

export interface RoleInfo {
  id: string;
  slug: string;
  label: string;
  description: string;
  is_builtin: boolean;
  is_active: boolean;
}

export interface Permission {
  id: string;
  slug: string;
  label: string;
  description: string;
  category: string;
}

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
  first_name: string;
  last_name: string;
  phone_number: string | null;
  role: RoleInfo;
  /** Flat permission slugs granted by `role` — see RequireAuth.tsx. */
  permissions: string[];
  university_id: string | null;
  is_active: boolean;
  date_joined: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  head: string | null;
  head_username: string | null;
  members: string[];
  member_usernames: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentInput {
  name: string;
  description: string;
  head: string | null;
  members: string[];
  is_active: boolean;
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
  // Legacy incident-type classifier — retired as of Phase 14's department-
  // routing rework. Only ever populated on reports created before that;
  // new reports leave it null. Department is the current classification.
  category: Category | null;
  category_display: string | null;
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
  deleted_at: string | null;
  department_id: string | null;
  department_name: string | null;
  /** Lets the frontend decide if the viewer has assign/transfer/escalate authority without a separate lookup. */
  department_head_id: string | null;
}

export interface AssistanceAcknowledgement {
  id: string;
  department: string;
  department_name: string;
  acknowledged_by_username: string | null;
  created_at: string;
}

export interface AssistanceRequest {
  id: string;
  report: string;
  reason: string;
  requested_by: string | null;
  requested_by_username: string | null;
  departments: { id: string; name: string }[];
  acknowledgements: AssistanceAcknowledgement[];
  created_at: string;
}

export interface ReportDetail extends Omit<ReportListItem, 'evidence_count'> {
  metadata: Record<string, unknown>;
  evidence: Evidence[];
  assistance_requests: AssistanceRequest[];
}

export interface ReportFeedback {
  id: string;
  report_id: string;
  department_name: string | null;
  rating: number;
  comments: string;
  submitted_by_username: string | null;
  created_at: string;
}

export interface CreateReportInput {
  department: string;
  description: string;
  urgency: Urgency;
  is_anonymous: boolean;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  idempotency_key?: string;
  client_created_at?: string;
}

export interface RoutingSuggestion {
  suggested_department: string;
  confidence: number;
  matched_keywords: string[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Message {
  id: string;
  sender_id: string;
  sender_username: string;
  content: string;
  created_at: string;
}

export interface DashboardSummary {
  total: number;
  department_counts: { department_name: string | null; count: number }[];
  status_counts: { status: Status; count: number }[];
  urgency_counts: { urgency: Urgency; count: number }[];
  average_response_time_hours: number | null;
}

export interface DashboardTrends {
  daily_counts: { date: string; count: number }[];
}

export interface DashboardAnalytics {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  average_assignment_time_hours: number | null;
  average_resolution_time_hours: number | null;
  overdue: number;
  urgency_counts: { urgency: Urgency; count: number }[];
  monthly_trend: { month: string; count: number }[];
  responder_workload: { responder_id: string; username: string; open_count: number }[];
  responder_performance: {
    responder_id: string;
    username: string;
    resolved_count: number;
    average_resolution_time_hours: number | null;
  }[];
  top_keywords: { keyword: string; count: number }[];
  feedback: { average_rating: number | null; feedback_count: number };
}

export const Action = {
  CREATE: 'create',
  STATUS_UPDATE: 'status_update',
  ASSIGN: 'assign',
  EVIDENCE_UPLOAD: 'evidence_upload',
  DEANONYMIZE: 'deanonymize',
  SOFT_DELETE: 'soft_delete',
  RESTORE: 'restore',
  AUTO_ROUTE: 'auto_route',
  ROUTING_SUGGESTION: 'routing_suggestion',
  DEPARTMENT_TRANSFER: 'department_transfer',
  ESCALATE: 'escalate',
  REQUEST_ASSISTANCE: 'request_assistance',
  ACKNOWLEDGE_ASSISTANCE: 'acknowledge_assistance',
  FEEDBACK_REQUESTED: 'feedback_requested',
  SUBMIT_FEEDBACK: 'submit_feedback',
  VIEW_FEEDBACK: 'view_feedback',
} as const;
export type Action = (typeof Action)[keyof typeof Action];

export interface AuditLogEntry {
  id: string;
  report: string | null;
  report_category: Category | null;
  actor: string | null;
  actor_username: string | null;
  action: Action;
  action_display: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  client_timestamp: string | null;
  sync_origin: 'live' | 'sync';
  sync_origin_display: string;
  created_at: string;
}

export interface RevealedIdentity {
  reporter_id: string;
  username: string;
  email: string;
  university_id: string | null;
}
