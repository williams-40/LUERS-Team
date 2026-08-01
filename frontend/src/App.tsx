import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ToastProvider } from './lib/toast-context';
import { ThemeProvider } from './lib/theme-context';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/auth/RequireAuth';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { ACCOUNT_ADMIN_ROLES, ADMIN_ROLES, REPORTER_ROLES } from './types/domain';

const LoginPage = lazy(() => import('./routes/LoginPage').then((m) => ({ default: m.LoginPage })));
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
const MyReportsPage = lazy(() => import('./routes/MyReportsPage').then((m) => ({ default: m.MyReportsPage })));
const ReportDetailPage = lazy(() =>
  import('./routes/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })),
);
const StyleGuidePage = lazy(() => import('./routes/StyleGuidePage').then((m) => ({ default: m.StyleGuidePage })));
const ForbiddenPage = lazy(() => import('./routes/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })));
const NotFoundPage = lazy(() => import('./routes/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const ProfilePage = lazy(() => import('./routes/ProfilePage').then((m) => ({ default: m.ProfilePage })));
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
          <RequireAuth roles={ADMIN_ROLES}>
            <TriageQueuePage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <AuditLogPage />
          </RequireAuth>
        ),
      },
      {
        path: 'reports/new',
        element: (
          <RequireAuth roles={REPORTER_ROLES}>
            <ReportCreatePage />
          </RequireAuth>
        ),
      },
      {
        path: 'reports/mine',
        element: (
          <RequireAuth roles={REPORTER_ROLES}>
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
        path: 'admin/users',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <AdminUsersPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users/new',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <AdminUserFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users/:id/edit',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <AdminUserFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/departments',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <DepartmentsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/departments/new',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <DepartmentFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/departments/:id/edit',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <DepartmentFormPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/reports/deleted',
        element: (
          <RequireAuth roles={ACCOUNT_ADMIN_ROLES}>
            <AdminDeletedReportsPage />
          </RequireAuth>
        ),
      },
      { path: 'login', element: <LoginPage /> },
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
