import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient, useQueryClient } from '@tanstack/react-query';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import NotificationContainer from '@/components/notifications/NotificationContainer';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { syncPendingRdos } from '@/services/offlineRdoSync';

// Pages - Fluxo Principal
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));
const ChangePasswordPage = lazy(() => import('@/pages/ChangePasswordPage'));
const FormRdo = lazy(() => import('@/pages/FormRdo'));
const ReadRdo = lazy(() => import('@/pages/ReadRdo'));
const EditRdo = lazy(() => import('@/pages/EditRdo'));
const DashboardRdos = lazy(() => import('@/pages/DashboardRdos'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Pages - Administração e Gestão
const DashboardExecutivo = lazy(() => import('@/pages/admin/DashboardExecutivo'));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'));
const UnitManagement = lazy(() => import('@/pages/admin/UnitManagement'));
const RdoCatalogManagement = lazy(() => import('@/pages/admin/RdoCatalogManagement'));
const ScheduledExportsPage = lazy(() => import('@/pages/ScheduledExportsPage'));
const ExportHistoryPage = lazy(() => import('@/pages/admin/ExportHistoryPage'));
const CronMonitorPage = lazy(() => import('@/pages/admin/CronMonitorPage'));
const ProtheusIntegrationPage = lazy(() => import('@/pages/admin/ProtheusIntegrationPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));

import { ShieldAlert, Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const OfflineRdoSyncManager: React.FC = () => {
  const { user, profile } = useAuth();
  const { success, warning } = useNotification();
  const client = useQueryClient();

  useEffect(() => {
    if (!user || !profile) return;
    let active = true;

    const synchronize = async () => {
      if (!navigator.onLine || !active) return;

      try {
        const result = await syncPendingRdos(user.id);
        if (!active) return;

        for (const submission of result.synced) {
          window.dispatchEvent(new CustomEvent('offline-rdo-synced', { detail: submission }));
        }

        if (result.synced.length > 0) {
          await client.invalidateQueries({ queryKey: ['rdos'] });
          success(
            result.synced.length === 1 ? 'RDO sincronizado' : 'RDOs sincronizados',
            result.synced.length === 1
              ? 'O relatório foi enviado para revisão.'
              : `${result.synced.length} relatórios foram enviados para revisão.`,
          );
        }

        if (result.failed.length > 0) {
          warning('Sincronização pendente', result.failed[0].message);
        }
      } catch (cause) {
        console.error('[OfflineRdoSyncManager] Não foi possível sincronizar a fila:', cause);
        if (active) {
          warning(
            'Sincronização pendente',
            cause instanceof Error ? cause.message : 'Os RDOs serão tentados novamente quando a conexão estiver disponível.',
          );
        }
      }
    };

    const handleOnline = () => void synchronize();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void synchronize();
    };

    void synchronize();
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [client, profile, success, user, warning]);

  return null;
};

// ============================================================================
// COMPONENTE DE LOADING GLOBAL
// ============================================================================

const LoadingScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
    <p className="text-gray-600 font-bold tracking-tight uppercase text-[10px]">
      Sincronizando Relat Pro RDO...
    </p>
  </div>
);

// ============================================================================
// LÓGICA DE REDIRECIONAMENTO POR PERFIL
// ============================================================================

const getRedirectPath = (profileType: string | undefined): string => {
  switch (profileType) {
    case 'admin':
      return '/admin/dashboard';
    case 'supervisor':
    case 'engenheiro':
    case 'encarregado':
      return '/rdos';
    default:
      return '/nao-autorizado';
  }
};

// ============================================================================
// COMPONENTES DE PROTEÇÃO DE ROTAS (RBAC)
// ============================================================================

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({
  children,
  allowedRoles 
}) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(profile.profile)) return <Navigate to="/nao-autorizado" replace />;

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && profile) return <Navigate to={getRedirectPath(profile.profile)} replace />;

  return <>{children}</>;
};

const HomeRedirect: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (profile.invitation_pending) return <Navigate to="/aceitar-convite" replace />;

  return <Navigate to={getRedirectPath(profile.profile)} replace />;
};

const InvitationCompletionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (
    user &&
    profile?.invitation_pending &&
    location.pathname !== '/aceitar-convite'
  ) {
    return <Navigate to="/aceitar-convite" replace />;
  }

  return <>{children}</>;
};

// ============================================================================
// PÁGINA DE ACESSO NEGADO
// ============================================================================

const NotAuthorized: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Acesso Restrito</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Seu perfil não possui permissão para esta área.
        </p>
        <button
          onClick={async () => {
            try {
              await signOut();
            } catch {
              // O redirecionamento também permite tentar outra conta se a rede falhar.
            }
            navigate('/login', { replace: true });
          }}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
        >
          Trocar de Conta
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// DEFINIÇÃO DAS ROTAS
// ============================================================================

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <InvitationCompletionGate>
        <Routes>
      {/* Rotas Públicas */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/aceitar-convite" element={<AcceptInvitationPage />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* RDOs: Todos os perfis */}
      <Route
        path="/rdos"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'engenheiro', 'encarregado']}>
            <DashboardRdos />
          </ProtectedRoute>
        }
      />

      {/* Operações RDO: todos os perfis */}
      <Route
        path="/rdo/novo"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'engenheiro', 'encarregado']}>
            <FormRdo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/rdo/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'engenheiro', 'encarregado']}>
            <ReadRdo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/rdo/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'engenheiro', 'encarregado']}>
            <EditRdo />
          </ProtectedRoute>
        }
      />

      {/* Administração: Apenas Admin */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardExecutivo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/usuarios"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/unidades"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UnitManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/cadastros-rdo"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <RdoCatalogManagement />
          </ProtectedRoute>
        }
      />

      {/* Monitoramento do Servidor e Cron (Nova Rota) */}
      <Route
        path="/admin/monitoramento"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <CronMonitorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/integracoes/protheus"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtheusIntegrationPage />
          </ProtectedRoute>
        }
      />

      {/* Exportações: Admin e Supervisor */}
      <Route
        path="/admin/exportacoes-agendadas"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
            <ScheduledExportsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/historico-exportacoes"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
            <ExportHistoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/conta/senha"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'engenheiro', 'encarregado']}>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ajuda"
        element={
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'engenheiro', 'encarregado']}>
            <HelpPage />
          </ProtectedRoute>
        }
      />

      {/* Sistema */}
      <Route path="/nao-autorizado" element={<NotAuthorized />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </InvitationCompletionGate>
    </Suspense>
  );
};

// ============================================================================
// COMPONENTE ROOT
// ============================================================================

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <OfflineRdoSyncManager />
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <div className="min-h-screen bg-gray-50 selection:bg-blue-100 selection:text-blue-900">
                <AppRoutes />
                <NotificationContainer />
              </div>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
