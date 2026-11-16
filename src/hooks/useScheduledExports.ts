import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { ExportHistory, ScheduledExport, ScheduledExportInput } from '@/types/exports';

export const useScheduledExportsList = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled-exports', user?.id],
    queryFn: async (): Promise<ScheduledExport[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('scheduled_exports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ScheduledExport[];
    },
    enabled: !!user,
  });
};

export const useExportHistory = (scheduledExportId: string) => {
  return useQuery({
    queryKey: ['export-history', scheduledExportId],
    queryFn: async (): Promise<ExportHistory[]> => {
      if (!scheduledExportId) return [];

      const { data, error } = await supabase
        .from('export_history')
        .select('*')
        .eq('scheduled_export_id', scheduledExportId)
        .order('executed_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ExportHistory[];
    },
    enabled: !!scheduledExportId,
  });
};

export const useScheduledExportsActions = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (exportData: ScheduledExportInput) => {
      if (!user) throw new Error('Usuário não autenticado.');

      const { data, error } = await supabase
        .from('scheduled_exports')
        .insert({ ...exportData, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
      success('Agendamento criado.');
    },
    onError: (cause) => {
      notifyError('Não foi possível criar o agendamento.', cause instanceof Error ? cause.message : undefined);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledExportInput> & { id: string }) => {
      if (!user) throw new Error('Usuário não autenticado.');

      const { data, error } = await supabase
        .from('scheduled_exports')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
      success('Agendamento atualizado.');
    },
    onError: (cause) => {
      notifyError('Não foi possível atualizar o agendamento.', cause instanceof Error ? cause.message : undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const { error } = await supabase
        .from('scheduled_exports')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
      success('Agendamento removido.');
    },
    onError: (cause) => {
      notifyError('Não foi possível remover o agendamento.', cause instanceof Error ? cause.message : undefined);
    },
  });

  return {
    createScheduledExport: createMutation.mutateAsync,
    updateScheduledExport: updateMutation.mutateAsync,
    deleteScheduledExport: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
