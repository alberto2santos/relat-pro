// src/components/rdos/FilterPanel.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import type { UnidadesRow } from '@/types/database';
import type { FilterState } from '@/hooks/useRdoFilter';

// 
// TIPOS
// 

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
  unidades?: UnidadesRow[];
  filterCount: number;
  isFiltered: boolean;
}

// 
// COMPONENTE
// 

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  onReset,
  unidades = [],
  filterCount,
  isFiltered,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
        aria-controls="filter-content"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-900">Filtros</span>
          {filterCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {filterCount}
            </span>
          )}
        </div>

        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {isExpanded && (
        <div
          id="filter-content"
          className="bg-white border border-gray-300 rounded-lg p-6 space-y-6"
        >
          {/* Status Filter */}
          <div>
            <label
              htmlFor="filter-status"
              className="block text-sm font-semibold text-gray-900 mb-3"
            >
              Status
            </label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              aria-label="Filtrar por status do RDO"
            >
              <option value="todos">Todos os Status</option>
              <option value="draft">Rascunho</option>
              <option value="submitted">Enviado para aprovação</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
            </select>
          </div>

          {/* Disciplina Filter */}
          <div>
            <label
              htmlFor="filter-disciplina"
              className="block text-sm font-semibold text-gray-900 mb-3"
            >
              Disciplina
            </label>
            <select
              id="filter-disciplina"
              value={filters.disciplina}
              onChange={(e) => onFilterChange('disciplina', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              aria-label="Filtrar por disciplina"
            >
              <option value="todos">Todas</option>
              <option value="automacao">Automação</option>
              <option value="instrumentacao">Instrumentação</option>
              <option value="eletrica">Elétrica</option>
              <option value="civil">Construção e Montagem</option>
            </select>
          </div>

          {/* Unidade Filter */}
          <div>
            <label
              htmlFor="filter-unidade"
              className="block text-sm font-semibold text-gray-900 mb-3"
            >
              Unidade
            </label>
            <select
              id="filter-unidade"
              value={filters.unidade_id}
              onChange={(e) => onFilterChange('unidade_id', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              aria-label="Filtrar por unidade"
            >
              <option value="todos">Todas as Unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.codigo})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <fieldset className="border-t pt-6">
            <legend className="text-sm font-semibold text-gray-900 mb-4">
              Intervalo de Datas
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="filter-date-from"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Data De
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onFilterChange('dateFrom', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  aria-label="Data inicial do filtro"
                />
              </div>

              <div>
                <label
                  htmlFor="filter-date-to"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Data Até
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onFilterChange('dateTo', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  aria-label="Data final do filtro"
                />
              </div>
            </div>
          </fieldset>

          {/* Sort Options */}
          <fieldset className="border-t pt-6">
            <legend className="text-sm font-semibold text-gray-900 mb-4">
              Ordenação
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="filter-sort-by"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  Ordenar Por
                </label>
                <select
                  id="filter-sort-by"
                  value={filters.sortBy}
                  onChange={(e) => onFilterChange('sortBy', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  aria-label="Campo para ordenação"
                >
                  <option value="data">Data</option>
                  <option value="numero">Número RDO</option>
                  <option value="hh_planejado">HH Planejado</option>
                  <option value="hh_realizado">HH Realizado</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-sort-order"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  Ordem
                </label>
                <select
                  id="filter-sort-order"
                  value={filters.sortOrder}
                  onChange={(e) => onFilterChange('sortOrder', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  aria-label="Direção da ordenação"
                >
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Action Buttons */}
          {isFiltered && (
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
              aria-label="Limpar todos os filtros aplicados"
            >
              <X className="w-4 h-4" />
              Limpar Todos os Filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
