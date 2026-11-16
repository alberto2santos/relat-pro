import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { ExportHistoryRow } from '@/types/database';

// ============================================================================
// TIPAGEM E INTERFACES
// ============================================================================

type ExportLog = ExportHistoryRow;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const ExportHistoryPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const isAdmin = profile?.profile === 'admin';
  const canAccessHistory = !!user && (isAdmin || profile?.profile === 'supervisor');

  const {
    data: exportHistory = [],
    isLoading: loadingHistory,
    error: errorHistory,
  } = useQuery<ExportLog[]>({
    queryKey: ['export-history', user?.id, profile?.profile],
    enabled: canAccessHistory,
    queryFn: async () => {
      let query = supabase
        .from('export_history')
        .select('*')
        .order('executed_at', { ascending: false });

      if (!isAdmin && user) query = query.eq('user_id', user.id);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Filtrar dados
  const filteredHistory = exportHistory.filter((log) => {
    const matchesSearch =
      log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.format.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Calcular estatísticas
  const stats = {
    total: exportHistory.length,
    success: exportHistory.filter((l) => l.status === 'success').length,
    failed: exportHistory.filter((l) => l.status === 'failed').length,
    pending: exportHistory.filter((l) => l.status === 'pending').length,
  };

  if (!canAccessHistory) {
    return (
      <MainLayout>
        <div className="app-page app-page--medium min-h-64 items-center justify-center text-center text-red-700">
          Seu perfil não pode acessar este histórico.
        </div>
      </MainLayout>
    );
  }

  // Tela de carregamento
  if (loadingHistory) {
    return (
      <MainLayout>
        <div className="app-page app-page--medium min-h-64 items-center justify-center">
          <svg
            className="w-12 h-12 text-blue-600 animate-spin mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-600 font-semibold">Carregando histórico de exportações...</p>
        </div>
      </MainLayout>
    );
  }

  // Tela de erro
  if (errorHistory) {
    return (
      <MainLayout>
        <div className="app-page app-page--medium min-h-64 items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
            <svg
              className="w-12 h-12 text-red-600 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-lg font-bold text-red-900 mb-2">Erro ao Carregar</h2>
            <p className="text-red-700">Não foi possível carregar o histórico de exportações.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Histórico de Exportações
          </h1>
          <p className="text-gray-600 mt-1">
            Acompanhe todas as exportações agendadas e seus resultados
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total"
            value={stats.total}
            icon={
              <svg
                className="w-6 h-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
            }
          />
          <StatCard
            title="Sucesso"
            value={stats.success}
            icon={
              <svg
                className="w-6 h-6 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
          <StatCard
            title="Falhas"
            value={stats.failed}
            icon={
              <svg
                className="w-6 h-6 text-red-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
          <StatCard
            title="Pendentes"
            value={stats.pending}
            icon={
              <svg
                className="w-6 h-6 text-yellow-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm0 6a1 1 0 11-2 0 1 1 0 012 0z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar por ID ou Formato
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <Input
                placeholder="Buscar..."
                className="pl-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                const status = e.target.value;
                if (status === 'all' || status === 'success' || status === 'failed' || status === 'pending') {
                  setFilterStatus(status);
                }
              }}
              title="Filtrar exportações por status"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="success">Sucesso</option>
              <option value="failed">Falhas</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>
        </div>

        {/* Tabela de Histórico */}
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle>Execuções Registradas</CardTitle>
            <CardDescription>
              {filteredHistory.length} de {exportHistory.length} exportações
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-4 opacity-50"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-600">Nenhuma exportação encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead className="w-[200px]">ID da Exportação</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((log) => (
                      <TableRow key={log.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell className="font-mono text-xs text-gray-700">
                          {log.id.slice(0, 12)}...
                        </TableCell>
                        <TableCell className="font-medium">{log.format.toUpperCase()}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {log.file_size ? `${(log.file_size / 1024).toFixed(2)} KB` : '-'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(log.executed_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                          {log.file_url ? (
                            <a href={log.file_url} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">
                              Baixar arquivo
                            </a>
                          ) : log.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legenda */}
        <Card className="shadow-sm border-gray-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <p>
              Este histórico mostra todas as exportações agendadas que foram executadas. A página é
              atualizada automaticamente a cada 30 segundos.
            </p>
            <p>
              Status <strong>Sucesso</strong> indica que a exportação foi gerada e enviada com sucesso.
            </p>
            <p>
              Status <strong>Falha</strong> indica um erro durante a execução. Verifique a mensagem de erro
              para mais detalhes.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const StatCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) => (
  <Card className="shadow-sm border-gray-200">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-gray-500">
      <CardTitle className="text-xs font-bold uppercase">{title}</CardTitle>
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    success: 'bg-green-100 text-green-700 border-green-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };

  const labels: Record<string, string> = {
    success: 'Sucesso',
    failed: 'Falha',
    pending: 'Pendente',
  };

  const style = styles[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const label = labels[status] || status;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${style}`}>
      {label}
    </span>
  );
};

export default ExportHistoryPage;
