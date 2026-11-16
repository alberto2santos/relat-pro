// ============================================================================
// TIPOS PRIMITIVOS E ENUMS
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Disciplina = 'automacao' | 'instrumentacao' | 'eletrica' | 'civil'
export type StatusRdo = 'draft' | 'submitted' | 'approved' | 'rejected'
export type UserProfile = 'admin' | 'engenheiro' | 'supervisor' | 'encarregado'
export type ExportFormat = 'csv' | 'xlsx' | 'pdf'
export type ExportFrequency = 'diario' | 'semanal' | 'mensal'
export type ExportStatus = 'success' | 'failed' | 'pending'
export type EvidenciaType = 'foto' | 'assinatura'
export type RdoOccurrenceType = 'chuva' | 'falta_material' | 'falta_acesso' | 'seguranca' | 'retrabalho' | 'outro'

// ============================================================================
// INTERFACE DO BANCO DE DADOS
// ============================================================================

export interface Database {
  public: {
    Tables: {
      // ===== PROFILES (Usuários) =====
      profiles: {
        Row: {
          id: string
          profile: UserProfile
          email: string | null
          full_name: string | null
          invitation_pending: boolean
          unidade_id: string | null
          disciplina: Disciplina | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          profile: UserProfile
          email?: string | null
          full_name?: string | null
          invitation_pending?: boolean
          unidade_id?: string | null
          disciplina?: Disciplina | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile?: UserProfile
          email?: string | null
          full_name?: string | null
          invitation_pending?: boolean
          unidade_id?: string | null
          disciplina?: Disciplina | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_invitations: {
        Row: {
          id: string
          email: string
          profile: UserProfile
          status: 'pending' | 'accepted' | 'cancelled'
          created_by: string | null
          auth_user_id: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          email: string
          profile: UserProfile
          status?: 'pending' | 'accepted' | 'cancelled'
          created_by?: string | null
          auth_user_id?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          email?: string
          profile?: UserProfile
          status?: 'pending' | 'accepted' | 'cancelled'
          auth_user_id?: string | null
          accepted_at?: string | null
        }
        Relationships: []
      }

      // ===== RDOS (Relatórios Diários de Obra) =====
      rdos: {
        Row: {
          id: string
          user_id: string
          unidade_id: string
          numero: string | null
          data: string
          hh_planejado: number
          hh_realizado: number | null
          status: StatusRdo
          disciplina: Disciplina | null
          engenheiro_obs: string | null
          coordenador_obs: string | null
          clima_condicao: string | null
          clima_temperatura: number | null
          clima_origem: 'automatico' | 'manual' | null
          version: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          unidade_id: string
          numero?: string | null
          data: string
          hh_planejado: number
          hh_realizado?: number | null
          status?: StatusRdo
          disciplina?: Disciplina | null
          engenheiro_obs?: string | null
          coordenador_obs?: string | null
          clima_condicao?: string | null
          clima_temperatura?: number | null
          clima_origem?: 'automatico' | 'manual' | null
          version?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          unidade_id?: string
          numero?: string | null
          data?: string
          hh_planejado?: number
          hh_realizado?: number | null
          disciplina?: Disciplina | null
          engenheiro_obs?: string | null
          coordenador_obs?: string | null
          clima_condicao?: string | null
          clima_temperatura?: number | null
          clima_origem?: 'automatico' | 'manual' | null
          version?: number
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [{
          foreignKeyName: 'rdos_unidade_id_fkey'
          columns: ['unidade_id']
          referencedRelation: 'unidades'
          referencedColumns: ['id']
        }]
      }

      // ===== RDO_ERP_SYNC_EVENTS (Fila e histórico de integração ERP) =====
      rdo_erp_sync_events: {
        Row: {
          id: string
          rdo_id: string
          integration: 'totvs_protheus'
          status: 'pending' | 'processing' | 'succeeded' | 'failed'
          attempts: number
          response_status: number | null
          erp_reference: string | null
          error_message: string | null
          created_at: string
          updated_at: string
          synced_at: string | null
        }
        Insert: {
          id?: string
          rdo_id: string
          integration?: 'totvs_protheus'
          status?: 'pending' | 'processing' | 'succeeded' | 'failed'
          attempts?: number
          response_status?: number | null
          erp_reference?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
        Update: {
          status?: 'pending' | 'processing' | 'succeeded' | 'failed'
          attempts?: number
          response_status?: number | null
          erp_reference?: string | null
          error_message?: string | null
          updated_at?: string
          synced_at?: string | null
        }
        Relationships: [{
          foreignKeyName: 'rdo_erp_sync_events_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }]
      }

      // ===== MATERIAIS_RDO (Materiais por RDO) =====
      materiais_rdo: {
        Row: {
          id: string
          rdo_id: string
          material: string
          quantidade: number
          unidade_medida: string | null
          created_at: string
          updated_at: string
          version: number
          deleted_at: string | null
        }
        Insert: {
          id?: string
          rdo_id: string
          material: string
          quantidade: number
          unidade_medida?: string | null
          created_at?: string
          updated_at?: string
          version?: number
          deleted_at?: string | null
        }
        Update: {
          material?: string
          quantidade?: number
          unidade_medida?: string | null
          updated_at?: string
          version?: number
          deleted_at?: string | null
        }
        Relationships: [{
          foreignKeyName: 'materiais_rdo_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }]
      }

      funcoes: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          nome?: string
          descricao?: string | null
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      equipamentos: {
        Row: {
          id: string
          nome: string
          unidade_id: string | null
          identificador_externo: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          unidade_id?: string | null
          identificador_externo?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          nome?: string
          unidade_id?: string | null
          identificador_externo?: string | null
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: [{
          foreignKeyName: 'equipamentos_unidade_id_fkey'
          columns: ['unidade_id']
          referencedRelation: 'unidades'
          referencedColumns: ['id']
        }]
      }

      tipos_ocorrencia: {
        Row: {
          codigo: RdoOccurrenceType
          nome: string
          ordem: number
          created_at: string
          updated_at: string
        }
        Insert: {
          codigo: RdoOccurrenceType
          nome: string
          ordem: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          codigo?: RdoOccurrenceType
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }

      rdo_efetivo: {
        Row: {
          id: string
          rdo_id: string
          funcao_id: string
          quantidade: number
          horas_trabalhadas: number
          matricula: string | null
          nome: string | null
          identificador_externo: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          rdo_id: string
          funcao_id: string
          quantidade: number
          horas_trabalhadas?: number
          matricula?: string | null
          nome?: string | null
          identificador_externo?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          funcao_id?: string
          quantidade?: number
          horas_trabalhadas?: number
          matricula?: string | null
          nome?: string | null
          identificador_externo?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [{
          foreignKeyName: 'rdo_efetivo_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }, {
          foreignKeyName: 'rdo_efetivo_funcao_id_fkey'
          columns: ['funcao_id']
          referencedRelation: 'funcoes'
          referencedColumns: ['id']
        }]
      }

      rdo_equipamentos: {
        Row: {
          id: string
          rdo_id: string
          equipamento_id: string
          horas_uso: number
          observacao: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          rdo_id: string
          equipamento_id: string
          horas_uso?: number
          observacao?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          equipamento_id?: string
          horas_uso?: number
          observacao?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [{
          foreignKeyName: 'rdo_equipamentos_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }, {
          foreignKeyName: 'rdo_equipamentos_equipamento_id_fkey'
          columns: ['equipamento_id']
          referencedRelation: 'equipamentos'
          referencedColumns: ['id']
        }]
      }

      rdo_ocorrencias: {
        Row: {
          id: string
          rdo_id: string
          tipo: RdoOccurrenceType
          descricao: string
          inicio: string | null
          fim: string | null
          horas_impacto: number
          responsavel: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          rdo_id: string
          tipo: RdoOccurrenceType
          descricao: string
          inicio?: string | null
          fim?: string | null
          horas_impacto?: number
          responsavel?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          tipo?: RdoOccurrenceType
          descricao?: string
          inicio?: string | null
          fim?: string | null
          horas_impacto?: number
          responsavel?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [{
          foreignKeyName: 'rdo_ocorrencias_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }, {
          foreignKeyName: 'rdo_ocorrencias_tipo_fkey'
          columns: ['tipo']
          referencedRelation: 'tipos_ocorrencia'
          referencedColumns: ['codigo']
        }]
      }

      // ===== UNIDADES (Unidades de Trabalho) =====
      unidades: {
        Row: {
          id: string
          codigo: string
          nome: string | null
          disciplina: Disciplina | null
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          codigo: string
          nome?: string | null
          disciplina?: Disciplina | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          codigo?: string
          nome?: string | null
          disciplina?: Disciplina | null
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }

      // ===== EVIDENCIAS_RDO (Fotos e Assinaturas) =====
      evidencias_rdo: {
        Row: {
          id: string
          rdo_id: string
          tipo: EvidenciaType
          url: string
          descricao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rdo_id: string
          tipo: EvidenciaType
          url: string
          descricao?: string | null
          created_at?: string
        }
        Update: {
          tipo?: EvidenciaType
          url?: string
          descricao?: string | null
        }
        Relationships: [{
          foreignKeyName: 'evidencias_rdo_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }]
      }

      // ===== AUDITORIAS_RDO (Histórico de Ações) =====
      auditorias_rdo: {
        Row: {
          id: string
          rdo_id: string
          auditor_user_id: string | null
          acao: string
          comentario: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rdo_id: string
          auditor_user_id?: string | null
          acao: string
          comentario?: string | null
          created_at?: string
        }
        Update: {
          rdo_id?: string
          auditor_user_id?: string | null
          acao?: string
          comentario?: string | null
        }
        Relationships: [{
          foreignKeyName: 'auditorias_rdo_rdo_id_fkey'
          columns: ['rdo_id']
          referencedRelation: 'rdos'
          referencedColumns: ['id']
        }]
      }

      // ===== INSTRUMENTOS (Instrumentação) =====
      instrumentos: {
        Row: {
          id: string
          tag_name: string
          descricao: string | null
          unidade_id: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tag_name: string
          descricao?: string | null
          unidade_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          tag_name?: string
          descricao?: string | null
          unidade_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [{
          foreignKeyName: 'instrumentos_unidade_id_fkey'
          columns: ['unidade_id']
          referencedRelation: 'unidades'
          referencedColumns: ['id']
        }]
      }

      // ===== CRON_EXECUTION_LOG (Log de Execuções) =====
      cron_execution_log: {
        Row: {
          id: number
          function_name: string
          status: string | null
          response: string | null
          executed_at: string
          request_body: Json | null
          response_status: number | null
          response_content: Json | null
          error_text: string | null
        }
        Insert: {
          id?: number
          function_name: string
          status?: string | null
          response?: string | null
          executed_at?: string
          request_body?: Json | null
          response_status?: number | null
          response_content?: Json | null
          error_text?: string | null
        }
        Update: {
          function_name?: string
          status?: string | null
          response?: string | null
          executed_at?: string
          request_body?: Json | null
          response_status?: number | null
          response_content?: Json | null
          error_text?: string | null
        }
        Relationships: []
      }

      // ===== EXPORT_HISTORY (Histórico de Exportações) =====
      export_history: {
        Row: {
          id: string
          scheduled_export_id: string | null
          user_id: string | null
          format: ExportFormat
          file_size: number | null
          status: ExportStatus
          error_message: string | null
          executed_at: string
          file_url: string | null
        }
        Insert: {
          id?: string
          scheduled_export_id?: string | null
          user_id?: string | null
          format: ExportFormat
          file_size?: number | null
          status: ExportStatus
          error_message?: string | null
          executed_at?: string
          file_url?: string | null
        }
        Update: {
          scheduled_export_id?: string | null
          user_id?: string | null
          format?: ExportFormat
          file_size?: number | null
          status?: ExportStatus
          error_message?: string | null
          file_url?: string | null
        }
        Relationships: [{
          foreignKeyName: 'export_history_scheduled_export_id_fkey'
          columns: ['scheduled_export_id']
          referencedRelation: 'scheduled_exports'
          referencedColumns: ['id']
        }]
      }

      // ===== SCHEDULED_EXPORTS (Exportações Agendadas) =====
      scheduled_exports: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          format: ExportFormat
          frequency: ExportFrequency
          hour: number
          minute: number
          day_of_week: string | null
          day_of_month: number | null
          filters: Json | null
          email_recipients: string[]
          is_active: boolean
          last_executed_at: string | null
          next_execution_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          format: ExportFormat
          frequency: ExportFrequency
          hour: number
          minute: number
          day_of_week?: string | null
          day_of_month?: number | null
          filters?: Json | null
          email_recipients?: string[]
          is_active?: boolean
          last_executed_at?: string | null
          next_execution_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          format?: ExportFormat
          frequency?: ExportFrequency
          hour?: number
          minute?: number
          day_of_week?: string | null
          day_of_month?: number | null
          filters?: Json | null
          email_recipients?: string[]
          is_active?: boolean
          last_executed_at?: string | null
          next_execution_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      get_cron_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          jobid: number
          jobname: string
          schedule: string
          active: boolean
          command: string
        }[]
      }
      transition_rdo_status: {
        Args: {
          p_rdo_id: string
          p_status: StatusRdo
          p_comment?: string | null
        }
        Returns: string
      }
      salvar_rdo_completo: {
        Args: {
          rdo_id: string
          versao_base: number
          payload: Json
        }
        Returns: Json | null
      }
      complete_employee_invitation: {
        Args: { p_full_name: string }
        Returns: undefined
      }
    }
  }
}

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - PROFILES
// ============================================================================

export type ProfilesRow = Database['public']['Tables']['profiles']['Row']
export type ProfilesInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfilesUpdate = Database['public']['Tables']['profiles']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - RDOS
// ============================================================================

export type RdosRow = Database['public']['Tables']['rdos']['Row']
export type RdosInsert = Database['public']['Tables']['rdos']['Insert']
export type RdosUpdate = Database['public']['Tables']['rdos']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - MATERIAIS_RDO
// ============================================================================

export type MateriaisRdoRow = Database['public']['Tables']['materiais_rdo']['Row']
export type MateriaisRdoInsert = Database['public']['Tables']['materiais_rdo']['Insert']
export type MateriaisRdoUpdate = Database['public']['Tables']['materiais_rdo']['Update']

export type FuncoesRow = Database['public']['Tables']['funcoes']['Row']
export type FuncoesInsert = Database['public']['Tables']['funcoes']['Insert']
export type FuncoesUpdate = Database['public']['Tables']['funcoes']['Update']

export type EquipamentosRow = Database['public']['Tables']['equipamentos']['Row']
export type EquipamentosInsert = Database['public']['Tables']['equipamentos']['Insert']
export type EquipamentosUpdate = Database['public']['Tables']['equipamentos']['Update']

export type TiposOcorrenciaRow = Database['public']['Tables']['tipos_ocorrencia']['Row']
export type TiposOcorrenciaInsert = Database['public']['Tables']['tipos_ocorrencia']['Insert']
export type TiposOcorrenciaUpdate = Database['public']['Tables']['tipos_ocorrencia']['Update']

export type RdoEfetivoRow = Database['public']['Tables']['rdo_efetivo']['Row']
export type RdoEfetivoInsert = Database['public']['Tables']['rdo_efetivo']['Insert']
export type RdoEfetivoUpdate = Database['public']['Tables']['rdo_efetivo']['Update']

export type RdoEquipamentosRow = Database['public']['Tables']['rdo_equipamentos']['Row']
export type RdoEquipamentosInsert = Database['public']['Tables']['rdo_equipamentos']['Insert']
export type RdoEquipamentosUpdate = Database['public']['Tables']['rdo_equipamentos']['Update']

export type RdoOcorrenciasRow = Database['public']['Tables']['rdo_ocorrencias']['Row']
export type RdoOcorrenciasInsert = Database['public']['Tables']['rdo_ocorrencias']['Insert']
export type RdoOcorrenciasUpdate = Database['public']['Tables']['rdo_ocorrencias']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - UNIDADES
// ============================================================================

export type UnidadesRow = Database['public']['Tables']['unidades']['Row']
export type UnidadesInsert = Database['public']['Tables']['unidades']['Insert']
export type UnidadesUpdate = Database['public']['Tables']['unidades']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - EVIDENCIAS_RDO
// ============================================================================

export type EvidenciasRdoRow = Database['public']['Tables']['evidencias_rdo']['Row']
export type EvidenciasRdoInsert = Database['public']['Tables']['evidencias_rdo']['Insert']
export type EvidenciasRdoUpdate = Database['public']['Tables']['evidencias_rdo']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - AUDITORIAS_RDO
// ============================================================================

export type AuditoriasRdoRow = Database['public']['Tables']['auditorias_rdo']['Row']
export type AuditoriasRdoInsert = Database['public']['Tables']['auditorias_rdo']['Insert']
export type AuditoriasRdoUpdate = Database['public']['Tables']['auditorias_rdo']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - INSTRUMENTOS
// ============================================================================

export type InstrumentosRow = Database['public']['Tables']['instrumentos']['Row']
export type InstrumentosInsert = Database['public']['Tables']['instrumentos']['Insert']
export type InstrumentosUpdate = Database['public']['Tables']['instrumentos']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - CRON_EXECUTION_LOG
// ============================================================================

export type CronExecutionLogRow = Database['public']['Tables']['cron_execution_log']['Row']
export type CronExecutionLogInsert = Database['public']['Tables']['cron_execution_log']['Insert']
export type CronExecutionLogUpdate = Database['public']['Tables']['cron_execution_log']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - EXPORT_HISTORY
// ============================================================================

export type ExportHistoryRow = Database['public']['Tables']['export_history']['Row']
export type ExportHistoryInsert = Database['public']['Tables']['export_history']['Insert']
export type ExportHistoryUpdate = Database['public']['Tables']['export_history']['Update']

// ============================================================================
// EXPORTAÇÕES DE TIPOS DE CONVENIÊNCIA - SCHEDULED_EXPORTS
// ============================================================================

export type ScheduledExportsRow = Database['public']['Tables']['scheduled_exports']['Row']
export type ScheduledExportsInsert = Database['public']['Tables']['scheduled_exports']['Insert']
export type ScheduledExportsUpdate = Database['public']['Tables']['scheduled_exports']['Update']
