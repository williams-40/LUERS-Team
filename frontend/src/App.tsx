import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ToastProvider } from './lib/toast-context';
import { ThemeProvider } from './lib/theme-context';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/auth/RequireAuth';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const LoginPage = lazy(() => import('./routes/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./routes/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import('./routes/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./routes/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const DashboardPage = lazy(() => import('./routes/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TriageQueuePage = lazy(() =>
  import('./routes/TriageQueuePage').then((m) => ({ default: m.TriageQueuePage })),
);
const AuditLogPage = lazy(() => import('./routes/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const ReportCreatePage = lazy(() =>
  import('./routes/ReportCreatePage').then((m) => ({ default: m.ReportCreatePage })),
);
const EmergencyPage = lazy(() => import('./routes/EmergencyPage').then((m) => ({ default: m.EmergencyPage })));
const MyReportsPage = lazy(() => import('./routes/MyReportsPage').then((m) => ({ default: m.MyReportsPage })));
const ReportDetailPage = lazy(() =>
  import('./routes/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })),
);
const StyleGuidePage = lazy(() => import('./routes/StyleGuidePage').then((m) => ({ default: m.StyleGuidePage })));
const ForbiddenPage = lazy(() => import('./routes/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })));
const NotFoundPage = lazy(() => import('./routes/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const ProfilePage = lazy(() => import('./routes/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ChangePasswordRequiredPage = lazy(() =>
  import('./routes/ChangePasswordRequiredPage').then((m) => ({ default: m.ChangePasswordRequiredPage })),
);
const AdminUsersPage = lazy(() =>
  import('./routes/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminUserFormPage = lazy(() =>
  import('./routes/AdminUserFormPage').then((m) => ({ default: m.AdminUserFormPage })),
);
const DepartmentsPage = lazy(() =>
  import('./routes/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })),
);
const DepartmentFormPage = lazy(() =>
  import('./routes/DepartmentFormPage').then((m) => ({ default: m.DepartmentFormPage })),
);
const AdminDeletedReportsPage = lazy(() =>
  import('./routes/AdminDeletedReportsPage').then((m) => ({ default: m.AdminDeletedReportsPage })),
);
const AdminFeedbackPage = lazy(() =>
  import('./routes/AdminFeedbackPage').then((m) => ({ default: m.AdminFeedbackPage })),
);
const EscalatedReportsPage = lazy(() =>
  import('./routes/EscalatedReportsPage').then((m) => ({ default: m.EscalatedReportsPage })),
);
const RolesPage = lazy(() => import('./routes/RolesPage').then((m) => ({ default: m.RolesPage })));
const RoleFormPage = lazy(() => import('./routes/RoleFormPage').then((m) => ({ default: m.RoleFormPage })));

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireAuth requirePermission="view_admin_dashboard">
            <TriageQueuePage />
          </RequireAuth>
        ),
      },
      {
        // Phase 4: manage_audit_logs was removed as a standalone
        // permission — the backend now scopes /api/v1/audit/ purely by
        // department/actor (get_accessible_audit_logs), no permission
        // gate at all. Reusing view_admin_dashboard here just keeps this
        // route reachable by the same admin-tier population that can
        // already see the triage queue; the real scoping happens
        // server-side regardless of this check.
        path: 'admin/audit',
        element: (
          <RequireAuth requirePermission="view_admin_dashboard">
            <AuditLogPage />
          </RequireAuth>
        ),
      },
      {
        path: 'reports/new',
        element: (
          <RequireAuth requirePermission="create_report">
            <ReportCreatePage />
          </RequireAuth>
        ),
      },
      {
        path: 'emergency',
        element: (
          <RequireAuth requirePermission="create_report">
            <EmergencyPage />
          </RequireAuth>
        ),
      },
      {
        path: 'reports/mine',
        element: (
          <RequireAuth requirePermission="create_report">
            <MyReportsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'reports/:id',
        element: (
          <RequireAuth>
            <ReportDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: 'change-password-required',
        element: (
          <RequireAuth>
            <ChangePasswordRequiredPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RequireAuth requirePermission="manage_users">
            <AdminUsersPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users/new',
        element: (
          <RequireAuth requirePermission="manage_users">
            <AdminUserFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users/:id/edit',
        element: (
          <RequireAuth requirePermission="manage_users">
            <AdminUserFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/departments',
        element: (
          <RequireAuth requirePermission="manage_departments">
            <DepartmentsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/departments/new',
        element: (
          <RequireAuth requirePermission="manage_departments">
            <DepartmentFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/departments/:id/edit',
        element: (
          <RequireAuth requirePermission="manage_departments">
            <DepartmentFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/reports/deleted',
        element: (
          <RequireAuth requirePermission="delete_report">
            <AdminDeletedReportsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/feedback',
        element: (
          <RequireAuth requirePermission="view_all_reports">
            <AdminFeedbackPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/escalated',
        element: (
          <RequireAuth requirePermission="view_all_reports">
            <EscalatedReportsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <RequireAuth requirePermission="manage_roles">
            <RolesPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/roles/new',
        element: (
          <RequireAuth requirePermission="manage_roles">
            <RoleFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/roles/:id/edit',
        element: (
          <RequireAuth requirePermission="manage_roles">
            <RoleFormPage />
          </RequireAuth>
        ),
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'style-guide', element: <StyleGuidePage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
