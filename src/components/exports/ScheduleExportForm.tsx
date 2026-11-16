import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarClock, Loader2, Mail, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { DayOfWeek, ScheduledExport, ScheduledExportInput } from '@/types/exports';

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const SCHEMA = z.object({
  name: z.string().trim().min(3, 'Use pelo menos 3 caracteres.'),
  description: z.string().max(500).optional(),
  format: z.enum(['csv', 'xlsx', 'pdf']),
  frequency: z.enum(['diario', 'semanal', 'mensal']),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  day_of_week: z.enum(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']).nullable(),
  day_of_month: z.number().int().min(1).max(31).nullable(),
  email_recipients: z.string().trim().min(1, 'Informe pelo menos um e-mail.').refine(
    (value) => value.split(',').map((email) => email.trim()).filter(Boolean)
      .every((email) => z.string().email().safeParse(email).success),
    'Confira os endereços de e-mail informados.',
  ),
  is_active: z.boolean(),
}).superRefine((values, context) => {
  if (values.frequency === 'semanal' && !values.day_of_week) {
    context.addIssue({ code: 'custom', path: ['day_of_week'], message: 'Escolha o dia da semana.' });
  }
  if (values.frequency === 'mensal' && !values.day_of_month) {
    context.addIssue({ code: 'custom', path: ['day_of_month'], message: 'Escolha o dia do mês.' });
  }
});

type FormValues = z.infer<typeof SCHEMA>;

interface ScheduleExportFormProps {
  initialData?: ScheduledExport;
  onSubmit: (data: ScheduledExportInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const ScheduleExportForm: React.FC<ScheduleExportFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { control, register, handleSubmit, watch, formState: { errors, isValid } } = useForm<FormValues>({
    resolver: zodResolver(SCHEMA),
    mode: 'onChange',
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      format: initialData?.format || 'pdf',
      frequency: initialData?.frequency || 'diario',
      hour: initialData?.hour ?? 8,
      minute: initialData?.minute ?? 0,
      day_of_week: initialData?.day_of_week || 'segunda',
      day_of_month: initialData?.day_of_month ?? 1,
      email_recipients: initialData?.email_recipients.join(', ') || '',
      is_active: initialData?.is_active ?? true,
    },
  });

  const frequency = watch('frequency');

  const submit = async (values: FormValues) => {
    const recipients = values.email_recipients.split(',').map((email) => email.trim()).filter(Boolean);
    await onSubmit({
      name: values.name,
      description: values.description?.trim() || null,
      format: values.format,
      frequency: values.frequency,
      hour: values.hour,
      minute: values.minute,
      day_of_week: values.frequency === 'semanal' ? values.day_of_week : null,
      day_of_month: values.frequency === 'mensal' ? values.day_of_month : null,
      email_recipients: recipients,
      is_active: values.is_active,
      filters: initialData?.filters || null,
    });
  };

  return (
    <Card className="border-blue-200 shadow-sm">
      <CardHeader className="border-b bg-blue-50/60">
        <div className="flex items-center gap-3">
          <CalendarClock className="text-blue-600" />
          <div>
            <CardTitle>{initialData ? 'Editar agendamento' : 'Novo agendamento'}</CardTitle>
            <CardDescription>Defina quando os relatórios devem ser preparados e enviados.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(submit)} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="schedule-name" className="text-sm font-medium">Nome</label>
              <Input id="schedule-name" {...register('name')} disabled={isLoading} placeholder="Relatório semanal da unidade" />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Formato</label>
              <Controller name="format" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="schedule-description" className="text-sm font-medium">Descrição</label>
            <Textarea id="schedule-description" {...register('description')} rows={2} disabled={isLoading} />
            {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
          </div>

          <div className="grid gap-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Frequência</label>
              <Controller name="frequency" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Horário</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={23} aria-label="Hora" {...register('hour', { valueAsNumber: true })} disabled={isLoading} />
                <span>:</span>
                <Input type="number" min={0} max={59} aria-label="Minuto" {...register('minute', { valueAsNumber: true })} disabled={isLoading} />
              </div>
              {(errors.hour || errors.minute) && <p className="text-xs text-red-600">Informe um horário válido.</p>}
            </div>

            {frequency === 'semanal' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Dia da semana</label>
                <Controller name="day_of_week" control={control} render={({ field }) => (
                  <Select value={field.value || 'segunda'} onValueChange={field.onChange} disabled={isLoading}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS.map((day) => <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
            )}

            {frequency === 'mensal' && (
              <div className="space-y-2">
                <label htmlFor="schedule-day-of-month" className="text-sm font-medium">Dia do mês</label>
                <Input id="schedule-day-of-month" type="number" min={1} max={31} {...register('day_of_month', { setValueAs: (value) => value === '' ? null : Number(value) })} disabled={isLoading} />
                {errors.day_of_month && <p className="text-xs text-red-600">Escolha um dia entre 1 e 31.</p>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="schedule-emails" className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-blue-600" /> Destinatários
            </label>
            <Input id="schedule-emails" {...register('email_recipients')} disabled={isLoading} placeholder="obra@empresa.com, engenharia@empresa.com" />
            <p className="text-xs text-gray-500">Separe os endereços por vírgula.</p>
            {errors.email_recipients && <p className="text-xs text-red-600">{errors.email_recipients.message}</p>}
          </div>

          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" {...register('is_active')} disabled={isLoading} className="h-4 w-4 accent-blue-600" />
            Agendamento ativo
          </label>

          <div className="flex flex-col-reverse justify-end gap-3 border-t pt-5 sm:flex-row">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={!isValid || isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {initialData ? 'Salvar alterações' : 'Criar agendamento'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ScheduleExportForm;
