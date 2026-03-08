import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import AdminLayout from '../layouts/AdminLayout';
import Dashboard from '../pages/dashboard/Dashboard';
import UsersList from '../pages/users/UsersList';
import UserDetail from '../pages/users/UserDetail';
import QueriesList from '../pages/queries/QueriesList';
import QueryDetail from '../pages/queries/QueryDetail';
import ReportsList from '../pages/reports/ReportsList';
import ReportDetail from '../pages/reports/ReportDetail';
import RiskList from '../pages/riskDatabase/RiskList';
import RiskEdit from '../pages/riskDatabase/RiskEdit';
import KnowledgeList from '../pages/knowledge/KnowledgeList';
import KnowledgeEdit from '../pages/knowledge/KnowledgeEdit';
import AIProviders from '../pages/aiSettings/AIProviders';
import Settings from '../pages/systemSettings/Settings';
import AnalyticsDashboard from '../pages/analytics/AnalyticsDashboard';
import AdminUsersList from '../pages/adminUsers/AdminUsersList';
import MessagesList from '../pages/messages/MessagesList';
import MembershipPlansList from '../pages/membership/MembershipPlansList';
import Login from '../pages/Login';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AdminLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'users', element: <UsersList /> },
      { path: 'users/:id', element: <UserDetail /> },
      { path: 'queries', element: <QueriesList /> },
      { path: 'queries/:id', element: <QueryDetail /> },
      { path: 'reports', element: <ReportsList /> },
      { path: 'reports/:id', element: <ReportDetail /> },
      { path: 'risk-database', element: <RiskList /> },
      { path: 'risk-database/new', element: <RiskEdit /> },
      { path: 'risk-database/:id/edit', element: <RiskEdit /> },
      { path: 'knowledge', element: <KnowledgeList /> },
      { path: 'knowledge/new', element: <KnowledgeEdit /> },
      { path: 'knowledge/:id/edit', element: <KnowledgeEdit /> },
      { path: 'ai-settings', element: <AIProviders /> },
      { path: 'system-settings', element: <Settings /> },
      { path: 'analytics', element: <AnalyticsDashboard /> },
      { path: 'admin-users', element: <AdminUsersList /> },
      { path: 'messages', element: <MessagesList /> },
      { path: 'membership', element: <MembershipPlansList /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default router;
