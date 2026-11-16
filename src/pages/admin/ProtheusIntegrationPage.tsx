import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCw, Workflow } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';

type SyncStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

interface IntegrationStatus {
  configured: boolean;
}

const STATUS_LABELS: Record<SyncStatus, string> = {
  pending: 'Aguardando envio',
  processing: 'Enviando',
  succeeded: 'Sincronizado',
  failed: 'Falha no envio',
};

const STATUS_VARIANTS: Record<SyncStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  processing: 'outline',
  succeeded: 'default',
  failed: 'destructive',
};

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

const ProtheusIntegrationPage = () => {
  const queryClient = useQueryClient();
  const { success, error: notifyError } = useNotification();

  const { data: integration, isLoading: isLoadingIntegration, error: integrationError } = useQuery({
    queryKey: ['protheus-integration-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<IntegrationStatus>('sync-approved-rdo', {
        body: { action: 'status' },
      });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const { data: events, isLoading: isLoadingEvents, error: eventsError, refetch } = useQuery({
    queryKey: ['protheus-rdo-sync-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rdo_erp_sync_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.functions.invoke('sync-approved-rdo', {
        body: { action: 'sync', eventId, retry: true },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      success('Evento reenviado ao Protheus.');
      await queryClient.invalidateQueries({ queryKey: ['protheus-rdo-sync-events'] });
    },
    onError: (cause) => {
      notifyError('Não foi possível reenviar o RDO.', cause instanceof Error ? cause.message : undefined);
      void queryClient.invalidateQueries({ queryKey: ['protheus-rdo-sync-events'] });
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['protheus-integration-status'] });
    void refetch();
  };

  return (
    <MainLayout>
      <section aria-labelledby="protheus-page-title" className="app-page app-page--wide">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Integrações</p>
            <h1 id="protheus-page-title" className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-950">
              <Workflow aria-hidden="true" className="h-8 w-8 text-blue-600" />
              TOTVS Protheus
            </h1>
            <p className="mt-2 text-sm text-slate-600">Envio de RDOs aprovados e acompanhamento das tentativas de sincronização.</p>
          </div>
          <Button type="button" variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Atualizar
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isLoadingIntegration ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-blue-600" />
              ) : integration?.configured ? (
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600" />
              )}
              {integration?.configured ? 'Conector configurado' : 'Configuração necessária'}
            </CardTitle>
            <CardDescription>
              {integrationError
                ? 'Não foi possível consultar a configuração. Confirme se a Edge Function sync-approved-rdo está implantada.'
                : integration?.configured
                  ? 'O endpoint e a credencial estão cadastrados como segredos no servidor.'
                  : 'Configure o endpoint e a credencial do serviço REST do Protheus nos segredos do Supabase. Consulte o README para os nomes e o formato esperado.'}
            </CardDescription>
          </CardHeader>
          {integration?.configured && (
            <CardContent className="text-sm leading-6 text-slate-600">
              A integração envia o cabeçalho do RDO aprovado, os dados da unidade e os materiais. Fotos, assinatura e links privados não são enviados.
              O Protheus precisa expor um endpoint HTTPS compatível com o contrato JSON documentado no README.
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de sincronização</CardTitle>
            <CardDescription>Últimos 100 eventos. Falhas podem ser reenviadas pelo administrador após corrigir a configuração ou o serviço ERP.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <div className="flex min-h-40 items-center justify-center">
                <Loader2 aria-label="Carregando eventos de integração" className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : eventsError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Não foi possível carregar o histórico de integração. {eventsError.message}
              </p>
            ) : events?.length ? (
              <div className="space-y-3">
                {events.map((event) => {
                  const processingIsStale = event.status === 'processing'
                    && Date.now() - new Date(event.updated_at).getTime() > PROCESSING_TIMEOUT_MS;
                  const canRetry = event.status === 'failed' || event.status === 'pending' || processingIsStale;

                  return (
                    <article key={event.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">RDO {event.rdo_id}</span>
                          <Badge variant={STATUS_VARIANTS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          Criado {new Date(event.created_at).toLocaleString('pt-BR')} · {event.attempts} {event.attempts === 1 ? 'tentativa' : 'tentativas'}
                          {event.response_status ? ` · HTTP ${event.response_status}` : ''}
                        </p>
                        {event.synced_at && (
                          <p className="text-sm text-green-700">
                            Sincronizado em {new Date(event.synced_at).toLocaleString('pt-BR')}
                            {event.erp_reference ? ` · Referência ERP: ${event.erp_reference}` : ''}
                          </p>
                        )}
                        {event.error_message && <p role="status" className="text-sm text-red-700">{event.error_message}</p>}
                      </div>
                      {canRetry && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-2"
                          onClick={() => retryMutation.mutate(event.id)}
                          disabled={!integration?.configured || retryMutation.isPending}
                          title={!integration?.configured ? 'Configure o endpoint e a credencial primeiro' : 'Tentar novamente'}
                        >
                          <RotateCw aria-hidden="true" className="h-4 w-4" />
                          Tentar novamente
                        </Button>
                      )}
                      {event.status === 'processing' && !processingIsStale && (
                        <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                          <Clock3 aria-hidden="true" className="h-4 w-4" />
                          Processando
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">Nenhum RDO aprovado foi enviado para o Protheus ainda.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </MainLayout>
  );
};

export default ProtheusIntegrationPage;
