import {
  LayoutDashboard,
  FileText,
  ListChecks,
  BarChart3,
  Users,
  Building2,
  Siren,
  ShieldCheck,
  ScrollText,
  Trash2,
  MessageSquare,
  ArrowUpCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Permission slug required to see this item — omit for always-visible items. */
  permission?: string;
  /** Marks the item active on an exact path match only (e.g. "/" shouldn't stay lit for every sub-route). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for sidebar navigation, gated by the same 7
 * permission slugs App.tsx already declares per-route (RequireAuth
 * requirePermission) — this array doesn't reimplement that gating, it just
 * reads the same user.permissions list a route guard already checks.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, exact: true },
      { label: 'My reports', path: '/reports/mine', icon: FileText, permission: 'create_report' },
      { label: 'Report queue', path: '/admin', icon: ListChecks, permission: 'view_admin_dashboard' },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Analytics', path: '/admin/analytics', icon: BarChart3, permission: 'view_admin_dashboard' }],
  },
  {
    label: 'Management',
    items: [
      { label: 'Users', path: '/admin/users', icon: Users, permission: 'manage_users' },
      { label: 'Departments', path: '/admin/departments', icon: Building2, permission: 'manage_departments' },
      {
        label: 'Emergency categories',
        path: '/admin/emergency-categories',
        icon: Siren,
        permission: 'manage_emergency_categories',
      },
      { label: 'Roles', path: '/admin/roles', icon: ShieldCheck, permission: 'manage_roles' },
    ],
  },
  {
    label: 'Oversight',
    items: [
      { label: 'Audit log', path: '/admin/audit', icon: ScrollText, permission: 'view_admin_dashboard' },
      { label: 'Deleted reports', path: '/admin/reports/deleted', icon: Trash2, permission: 'delete_report' },
      { label: 'Feedback', path: '/admin/feedback', icon: MessageSquare, permission: 'view_all_reports' },
      { label: 'Escalated to you', path: '/admin/escalated', icon: ArrowUpCircle, permission: 'view_all_reports' },
    ],
  },
];

export function isNavItemVisible(item: NavItem, permissions: string[]): boolean {
  return !item.permission || permissions.includes(item.permission);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);
}
