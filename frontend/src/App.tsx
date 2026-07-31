import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/auth/RequireAuth';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { LoginPage } from './routes/LoginPage';
import { ForgotPasswordPage } from './routes/ForgotPasswordPage';
import { ResetPasswordPage } from './routes/ResetPasswordPage';
import { DashboardPage } from './routes/DashboardPage';
import { TriageQueuePage } from './routes/TriageQueuePage';
import { AuditLogPage } from './routes/AuditLogPage';
import { ReportCreatePage } from './routes/ReportCreatePage';
import { MyReportsPage } from './routes/MyReportsPage';
import { ReportDetailPage } from './routes/ReportDetailPage';
import { StyleGuidePage } from './routes/StyleGuidePage';
import { ForbiddenPage } from './routes/ForbiddenPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { ProfilePage } from './routes/ProfilePage';
import { AdminUsersPage } from './routes/AdminUsersPage';
import { AdminUserFormPage } from './routes/AdminUserFormPage';
import { DepartmentsPage } from './routes/DepartmentsPage';
import { DepartmentFormPage } from './routes/DepartmentFormPage';
import { ACCOUNT_ADMIN_ROLES, ADMIN_ROLES, REPORTER_ROLES } from './types/domain';

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
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
