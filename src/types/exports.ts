import type { Disciplina, StatusRdo } from './database';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ScheduleFrequency = 'diario' | 'semanal' | 'mensal';
export type DayOfWeek = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

export interface ScheduledExport {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  format: ExportFormat;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  day_of_week: DayOfWeek | null;
  day_of_month: number | null;
  filters: {
    status?: StatusRdo;
    disciplina?: Disciplina;
    unidade_id?: string;
  } | null;
  email_recipients: string[];
  is_active: boolean;
  last_executed_at: string | null;
  next_execution_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduledExportInput = Omit<
  ScheduledExport,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_executed_at' | 'next_execution_at'
>;

export interface ExportHistory {
  id: string;
  scheduled_export_id: string | null;
  user_id: string | null;
  format: ExportFormat;
  file_size: number | null;
  status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  executed_at: string;
  file_url: string | null;
}
