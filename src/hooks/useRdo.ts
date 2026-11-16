import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  RdosRow,
  RdosInsert,
  RdosUpdate,
  MateriaisRdoRow,
  MateriaisRdoInsert,
  MateriaisRdoUpdate,
  StatusRdo,
} from '@/types/database';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface RdoWithMateriais extends RdosRow {
  materiais?: MateriaisRdoRow[];
}

export interface UseRdoOptions {
  userId?: string;
  staleTime?: number;
  gcTime?: number;
}

export interface UseRdoDetailOptions {
  includeMateriais?: boolean;
  staleTime?: number;
  gcTime?: number;
}

// ============================================================================
// HOOK: useRdo
// ============================================================================

export const useRdo = (options: UseRdoOptions = {}) => {
  const {
    userId,
    staleTime = 1000 * 60 * 5,
    gcTime = 1000 * 60 * 10,
  } = options;

  const queryClient = useQueryClient();

  // ========== QUERY: Listar RDOs ==========

  const {
    data: rdos = [],
    isLoading,
    error: queryError,
    refetch: refetchRdos,
  } = useQuery<RdosRow[]>({
    queryKey: userId ? ['rdos', 'user', userId] : ['rdos'],
    queryFn: async () => {
      try {
        let query = supabase
          .from('rdos')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) throw new Error(error.message);
        return (data || []) as RdosRow[];
      } catch (err) {
        console.error('[useRdo] Query error:', err);
        throw err;
      }
    },
    staleTime,
    gcTime,
    retry: 2,
  });

  // ========== MUTATION: Criar ==========

  const createRdoMutation = useMutation({
    mutationFn: async (newData: RdosInsert) => {
      const { data, error } = await supabase
        .from('rdos')
        .insert([newData])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as RdosRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdos'] });
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: ['rdos', 'user', userId],
        });
      }
    },
  });

  // ========== MUTATION: Atualizar ==========

  const updateRdoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RdosUpdate }) => {
      const { error } = await supabase
        .from('rdos')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return { id };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rdos'] });
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', res.id] });
    },
  });

  // ========== MUTATION: Deletar (Soft Delete) ==========

  const deleteRdoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rdos')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return { id };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rdos'] });
      queryClient.removeQueries({ queryKey: ['rdo-detail', res.id] });
    },
  });

  // ========== MUTATION: Atualizar Status ==========

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
    status: StatusRdo;
    }) => {
      const { error } = await supabase.rpc('transition_rdo_status', {
        p_rdo_id: id,
        p_status: status,
        p_comment: null,
      });

      if (error) throw new Error(error.message);
      return { id, status };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rdos'] });
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', res.id] });
    },
  });

  return {
    rdos,
    isLoading,
    error: queryError instanceof Error ? queryError.message : null,
    refetchRdos,
    createRdo: createRdoMutation.mutateAsync,
    updateRdo: updateRdoMutation.mutateAsync,
    deleteRdo: deleteRdoMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    isCreating: createRdoMutation.isPending,
    isUpdating: updateRdoMutation.isPending,
    isDeleting: deleteRdoMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
};

// ============================================================================
// HOOK: useRdoDetail
// ============================================================================

export const useRdoDetail = (id: string, options: UseRdoDetailOptions = {}) => {
  const {
    includeMateriais = true,
    staleTime = 1000 * 60 * 5,
    gcTime = 1000 * 60 * 10,
  } = options;

  const queryClient = useQueryClient();

  // ========== QUERY: Buscar RDO com Materiais ==========

  const {
    data: rdo,
    isLoading,
    error: queryError,
    refetch: refetchRdo,
  } = useQuery<RdoWithMateriais | null>({
    queryKey: ['rdo-detail', id, { includeMateriais }],
    queryFn: async () => {
      if (!id) return null;

      const { data: rdoData, error: rdoError } = await supabase
        .from('rdos')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (rdoError) throw new Error(rdoError.message);

      if (!rdoData) return null;

      let materiais: MateriaisRdoRow[] = [];
      if (includeMateriais) {
        const { data: materiaisData } = await supabase
          .from('materiais_rdo')
          .select('*')
          .eq('rdo_id', id)
          .is('deleted_at', null);

        materiais = (materiaisData || []) as MateriaisRdoRow[];
      }

      return {
        ...(rdoData as RdosRow),
        materiais,
      } as RdoWithMateriais;
    },
    enabled: !!id,
    staleTime,
    gcTime,
    retry: 2,
  });

  // ========== MUTATION: Adicionar Material ==========

  const addMaterialMutation = useMutation({
    mutationFn: async (material: MateriaisRdoInsert) => {
      const { data, error } = await supabase
        .from('materiais_rdo')
        .insert([material])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as MateriaisRdoRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', id] });
    },
  });

  // ========== MUTATION: Deletar Material ==========

  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase
        .from('materiais_rdo')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', materialId);

      if (error) throw new Error(error.message);
      return { materialId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', id] });
    },
  });

  // ========== MUTATION: Atualizar Material ==========

  const updateMaterialMutation = useMutation({
    mutationFn: async ({
      materialId,
      data,
    }: {
      materialId: string;
      data: MateriaisRdoUpdate;
    }) => {
      const { error } = await supabase
        .from('materiais_rdo')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId);

      if (error) throw new Error(error.message);
      return { materialId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdo-detail', id] });
    },
  });

  return {
    rdo,
    isLoading,
    error: queryError instanceof Error ? queryError.message : null,
    refetchRdo,
    addMaterial: addMaterialMutation.mutateAsync,
    deleteMaterial: deleteMaterialMutation.mutateAsync,
    updateMaterial: updateMaterialMutation.mutateAsync,
    isAddingMaterial: addMaterialMutation.isPending,
    isDeletingMaterial: deleteMaterialMutation.isPending,
    isUpdatingMaterial: updateMaterialMutation.isPending,
  };
};

// ============================================================================
// HOOK: useRdoStats
// ============================================================================

export interface RdoStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  aderencia: number;
}

export const useRdoStats = (userId?: string) => {
  const { rdos, isLoading } = useRdo({ userId });

  const stats: RdoStats = {
    total: rdos.length,
    draft: rdos.filter((r) => r.status === 'draft').length,
    submitted: rdos.filter((r) => r.status === 'submitted').length,
    approved: rdos.filter((r) => r.status === 'approved').length,
    rejected: rdos.filter((r) => r.status === 'rejected').length,
    aderencia:
      rdos.length > 0
        ? Math.round(
            (rdos.filter((r) => r.status === 'approved').length / rdos.length) *
              100
          )
        : 0,
  };

  return { stats, isLoading };
};
