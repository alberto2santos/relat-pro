import { useState, useCallback, useMemo } from 'react';
import type { RdosRow } from '@/types/database';
import type { Disciplina, StatusRdo } from '@/types/database';

// ============================================================================
// TIPOS
// ============================================================================

export interface FilterState {
  searchTerm: string;
  status: StatusRdo | 'todos';
  disciplina: Disciplina | 'todos';
  unidade_id: string | 'todos';
  dateFrom: string;
  dateTo: string;
  sortBy: 'data' | 'numero' | 'hh_planejado' | 'hh_realizado';
  sortOrder: 'asc' | 'desc';
}

export interface UseRdoFilterReturn {
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  filteredRdos: RdosRow[];
  isFiltered: boolean;
  filterCount: number;
}

// ============================================================================
// HOOK
// ============================================================================

const DEFAULT_FILTERS: FilterState = {
  searchTerm: '',
  status: 'todos',
  disciplina: 'todos',
  unidade_id: 'todos',
  dateFrom: '',
  dateTo: '',
  sortBy: 'data',
  sortOrder: 'desc',
};

export const useRdoFilter = (rdos: RdosRow[] | undefined): UseRdoFilterReturn => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value as FilterState[keyof FilterState],
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Lógica de filtro complexa
  const filteredRdos = useMemo(() => {
    if (!rdos) return [];

    let result = [...rdos];

    // Filtro de busca (número RDO)
    if (filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(
        (rdo) =>
          rdo.numero?.toLowerCase().includes(searchLower) ||
          rdo.disciplina?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro de status
    if (filters.status !== 'todos') {
      result = result.filter((rdo) => rdo.status === filters.status);
    }

    // Filtro de disciplina
    if (filters.disciplina !== 'todos') {
      result = result.filter((rdo) => rdo.disciplina === filters.disciplina);
    }

    // Filtro de unidade
    if (filters.unidade_id !== 'todos') {
      result = result.filter((rdo) => rdo.unidade_id === filters.unidade_id);
    }

    // Filtro de data (from)
    if (filters.dateFrom) {
      result = result.filter((rdo) => rdo.data >= filters.dateFrom);
    }

    // Filtro de data (to)
    if (filters.dateTo) {
      result = result.filter((rdo) => rdo.data <= filters.dateTo);
    }

    // Ordenação
    result.sort((a, b) => {
      const aValue = a[filters.sortBy];
      const bValue = b[filters.sortBy];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return filters.sortOrder === 'asc'
          ? aValue.localeCompare(bValue, 'pt-BR', { numeric: true })
          : bValue.localeCompare(aValue, 'pt-BR', { numeric: true });
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return filters.sortOrder === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      if (aValue == null || bValue == null) {
        if (aValue == null && bValue == null) return 0;
        return aValue == null ? 1 : -1;
      }

      return 0;
    });

    return result;
  }, [rdos, filters]);

  const isFiltered = useMemo(() => {
    return (
      filters.searchTerm.trim() !== '' ||
      filters.status !== 'todos' ||
      filters.disciplina !== 'todos' ||
      filters.unidade_id !== 'todos' ||
      filters.dateFrom !== '' ||
      filters.dateTo !== ''
    );
  }, [filters]);

  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm.trim()) count++;
    if (filters.status !== 'todos') count++;
    if (filters.disciplina !== 'todos') count++;
    if (filters.unidade_id !== 'todos') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    return count;
  }, [filters]);

  return {
    filters,
    setFilter,
    resetFilters,
    filteredRdos,
    isFiltered,
    filterCount,
  };
};
