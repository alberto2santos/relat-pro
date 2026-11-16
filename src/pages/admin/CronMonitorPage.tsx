import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Clock, 
  Terminal,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// TIPAGEM
// ============================================================================

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
}

interface CronLog {
  id: number;
  function_name: string;
  status: string | null;
  executed_at: string;
  error_text: string | null;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const CronMonitorPage: React.FC = () => {
  // Busca os Jobs agendados via RPC (extensão pg_cron do Supabase)
  const { data: jobs, isLoading: loadingJobs, refetch: refetchJobs } = useQuery<CronJob[]>({
    queryKey: ['cron-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cron_jobs');
      if (error) throw error;
      return data || [];
    },
  });

  // Busca o histórico de logs da tabela personalizada de monitoramento
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } = useQuery<CronLog[]>({
    queryKey: ['cron-execution-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cron_execution_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const handleRefresh = () => {
    refetchJobs();
    refetchHistory();
  };

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Activity className="text-blue-600" />
            Monitoramento de Automações
          </h1>
          <p className="text-gray-500">Acompanhe a saúde das tarefas agendadas e disparos de e-mail.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2 bg-white shadow-sm">
          <RefreshCw size={16} className={(loadingJobs || loadingHistory) ? 'animate-spin' : ''} />
          Atualizar Logs
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Lista de Jobs Ativos */}
        <Card className="lg:col-span-2 shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="text-blue-600" size={18} />
              Tarefas Programadas (pg_cron)
            </CardTitle>
            <CardDescription>Agendamentos ativos no servidor de banco de dados.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingJobs ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">ID</TableHead>
                    <TableHead className="font-bold">Nome da Tarefa</TableHead>
                    <TableHead className="font-bold">Cron Expressão</TableHead>
                    <TableHead className="text-right font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs?.map((job) => (
                    <TableRow key={job.jobid}>
                      <TableCell className="font-mono text-xs text-gray-400">{job.jobid}</TableCell>
                      <TableCell className="font-semibold text-gray-700">{job.jobname}</TableCell>
                      <TableCell>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs text-blue-700">{job.schedule}</code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={job.active ? 'default' : 'secondary'} className={job.active ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                          {job.active ? 'ATIVO' : 'INATIVO'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!jobs || jobs.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">Nenhuma tarefa agendada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Execuções */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="text-blue-600" size={18} />
              Últimas Execuções
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
              <div className="space-y-4">
                {history?.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:border-blue-100">
                    {log.status === 'triggered' || log.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate uppercase tracking-tighter">
                        {log.function_name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {new Date(log.executed_at).toLocaleString('pt-BR')}
                      </p>
                      {log.error_text && (
                        <p className="text-[10px] text-red-500 mt-1 italic leading-tight">
                          Erro: {log.error_text}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {(!history || history.length === 0) && (
                  <p className="text-center py-8 text-gray-400 text-sm italic">Nenhum log registrado.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      </div>
    </MainLayout>
  );
};

export default CronMonitorPage;
