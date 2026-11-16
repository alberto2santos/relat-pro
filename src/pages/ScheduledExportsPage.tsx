import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  ExportFormat,
  ExportFrequency,
  ScheduledExportsInsert,
  ScheduledExportsRow,
  ScheduledExportsUpdate,
} from '@/types/database';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface FormData {
  name: string;
  description: string | null;
  format: ExportFormat;
  frequency: ExportFrequency;
  hour: number;
  minute: number;
  day_of_week: string | null;
  day_of_month: number | null;
  email_recipients: string[];
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const ScheduledExportsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: null,
    format: 'csv',
    frequency: 'diario',
    hour: 8,
    minute: 0,
    day_of_week: null,
    day_of_month: null,
    email_recipients: [],
  });

  const [emailInput, setEmailInput] = useState('');

  // ========== QUERIES ==========

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<
    ScheduledExportsRow[]
  >({
    queryKey: ['scheduled-exports', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('scheduled_exports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ScheduledExports] Erro ao buscar agendamentos:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
  });

  // ========== MUTATIONS ==========

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const newSchedule: ScheduledExportsInsert = {
        user_id: user.id,
        name: data.name,
        description: data.description,
        format: data.format,
        frequency: data.frequency,
        hour: data.hour,
        minute: data.minute,
        day_of_week: data.day_of_week,
        day_of_month: data.day_of_month,
        email_recipients: data.email_recipients,
        is_active: true,
      };

      const { error } = await supabase
        .from('scheduled_exports')
        .insert(newSchedule);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
      showNotification('Agendamento criado com sucesso!', 'success');
      resetForm();
    },
    onError: (error: Error) => {
      showNotification(
        error.message || 'Erro ao criar agendamento',
        'error'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!editingId) throw new Error('ID não encontrado');

      const updateData: ScheduledExportsUpdate = {
        name: data.name,
        description: data.description,
        format: data.format,
        frequency: data.frequency,
        hour: data.hour,
        minute: data.minute,
        day_of_week: data.day_of_week,
        day_of_month: data.day_of_month,
        email_recipients: data.email_recipients,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('scheduled_exports')
        .update(updateData)
        .eq('id', editingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
      showNotification('Agendamento atualizado com sucesso!', 'success');
      resetForm();
    },
    onError: (error: Error) => {
      showNotification(
        error.message || 'Erro ao atualizar agendamento',
        'error'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_exports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
      showNotification('Agendamento deletado com sucesso!', 'success');
    },
    onError: (error: Error) => {
      showNotification(
        error.message || 'Erro ao deletar agendamento',
        'error'
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (schedule: ScheduledExportsRow) => {
      const { error } = await supabase
        .from('scheduled_exports')
        .update({ is_active: !schedule.is_active })
        .eq('id', schedule.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports', user?.id] });
    },
    onError: (error: Error) => {
      showNotification(
        error.message || 'Erro ao atualizar status',
        'error'
      );
    },
  });

  // ========== HANDLERS ==========

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === 'frequency') {
      if (
        value !== 'diario' &&
        value !== 'semanal' &&
        value !== 'mensal'
      ) {
        return;
      }
      setFormData((prev) => ({
        ...prev,
        frequency: value,
        day_of_week: value === 'semanal' ? prev.day_of_week || 'segunda' : null,
        day_of_month: value === 'mensal' ? prev.day_of_month || 1 : null,
      }));
      return;
    }

    switch (name) {
      case 'name':
        setFormData((previous) => ({ ...previous, name: value }));
        break;
      case 'description':
        setFormData((previous) => ({ ...previous, description: value || null }));
        break;
      case 'format':
        if (value === 'csv' || value === 'xlsx' || value === 'pdf') {
          setFormData((previous) => ({ ...previous, format: value }));
        }
        break;
      case 'day_of_week':
        setFormData((previous) => ({ ...previous, day_of_week: value || null }));
        break;
      case 'day_of_month':
        setFormData((previous) => ({ ...previous, day_of_month: value === '' ? null : Number(value) }));
        break;
      case 'hour':
        setFormData((previous) => ({ ...previous, hour: value === '' ? Number.NaN : Number(value) }));
        break;
      case 'minute':
        setFormData((previous) => ({ ...previous, minute: value === '' ? Number.NaN : Number(value) }));
        break;
      default:
        break;
    }
  };

  const handleAddEmail = () => {
    const email = emailInput.trim();

    if (!email) {
      showNotification('Digite um email válido', 'error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showNotification('Email inválido', 'error');
      return;
    }

    if (formData.email_recipients.includes(email)) {
      showNotification('Email já adicionado', 'error');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      email_recipients: [...prev.email_recipients, email],
    }));

    setEmailInput('');
  };

  const handleRemoveEmail = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      email_recipients: prev.email_recipients.filter((e) => e !== email),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showNotification('Nome é obrigatório', 'error');
      return;
    }

    if (formData.email_recipients.length === 0) {
      showNotification('Adicione pelo menos um email', 'error');
      return;
    }

    if (formData.frequency === 'semanal' && !formData.day_of_week) {
      showNotification('Escolha o dia da semana.', 'error');
      return;
    }

    if (formData.frequency === 'mensal' && (!formData.day_of_month || formData.day_of_month < 1 || formData.day_of_month > 31)) {
      showNotification('Informe um dia do mês entre 1 e 31.', 'error');
      return;
    }

    if (!Number.isInteger(formData.hour) || formData.hour < 0 || formData.hour > 23
      || !Number.isInteger(formData.minute) || formData.minute < 0 || formData.minute > 59) {
      showNotification('Informe um horário válido.', 'error');
      return;
    }

    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (schedule: ScheduledExportsRow) => {
    const frequency = schedule.frequency || 'diario';
    setFormData({
      name: schedule.name,
      description: schedule.description,
      format: schedule.format,
      frequency,
      hour: schedule.hour,
      minute: schedule.minute,
      day_of_week: frequency === 'semanal' ? schedule.day_of_week || 'segunda' : null,
      day_of_month: frequency === 'mensal' ? schedule.day_of_month || 1 : null,
      email_recipients: schedule.email_recipients || [],
    });
    setEditingId(schedule.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (
      window.confirm(
        'Tem certeza que deseja deletar este agendamento? Esta ação não pode ser desfeita.'
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: null,
      format: 'csv',
      frequency: 'diario',
      hour: 8,
      minute: 0,
      day_of_week: null,
      day_of_month: null,
      email_recipients: [],
    });
    setEditingId(null);
    setShowForm(false);
    setEmailInput('');
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ========== VALIDAÇÕES DE ACESSO ==========

  if (authLoading) {
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
          <p className="text-gray-600 font-semibold">Carregando...</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
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
            <h2 className="text-lg font-bold text-red-900 mb-2">
              Erro de Autenticação
            </h2>
            <p className="text-red-700">Você precisa estar autenticado.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ========== RENDER ==========

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-4xl">
            Exportações Agendadas
          </h1>
          <p className="text-gray-600">
            Gerencie exportações automáticas de RDOs para seus emails
          </p>
        </div>

        {/* Notificação */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {notification.type === 'success' ? (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              )}
            </svg>
            <p className="font-medium">{notification.message}</p>
          </div>
        )}

        {/* Formulário */}
        {showForm && (
          <Card className="shadow-sm border-blue-200 bg-blue-50/30">
            <CardHeader className="border-b bg-blue-50">
              <CardTitle className="text-xl">
                {editingId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Nome */}
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Label htmlFor="name">Nome do Agendamento *</Label><HelpTooltip label="Nome do agendamento" content="Escolha um nome que ajude a reconhecer o objetivo deste envio automático." /></div>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Exportação Diária de RDOs"
                  className="bg-white"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Label htmlFor="description">Descrição</Label><HelpTooltip label="Descrição" content="Adicione uma observação opcional sobre o conteúdo ou o uso do relatório enviado." /></div>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  placeholder="Descrição do agendamento (opcional)"
                  rows={3}
                  className="bg-white"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                />
              </div>

              {/* Grid: Formato e Frequência */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="format">Formato *</Label><HelpTooltip label="Formato do arquivo" content="Escolha PDF para leitura, Excel para análise ou CSV para importar dados em outras ferramentas." /></div>
                  <select
                    title="Selecione o formato do arquivo"
                    id="format"
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel (XLSX)</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="frequency">Frequência *</Label><HelpTooltip label="Frequência" content="Define se o relatório será preparado todos os dias, uma vez por semana ou uma vez por mês." /></div>
                  <select
                    title="Selecione a frequência do agendamento"
                    id="frequency"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    <option value="diario">Diário</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
              </div>

              {formData.frequency === 'semanal' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="day_of_week">Dia da semana *</Label><HelpTooltip label="Dia da semana" content="Escolha o dia em que o envio semanal deve ser executado." /></div>
                  <select
                    id="day_of_week"
                    name="day_of_week"
                    value={formData.day_of_week || 'segunda'}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    <option value="segunda">Segunda-feira</option>
                    <option value="terca">Terça-feira</option>
                    <option value="quarta">Quarta-feira</option>
                    <option value="quinta">Quinta-feira</option>
                    <option value="sexta">Sexta-feira</option>
                    <option value="sabado">Sábado</option>
                    <option value="domingo">Domingo</option>
                  </select>
                </div>
              )}

              {formData.frequency === 'mensal' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="day_of_month">Dia do mês *</Label><HelpTooltip label="Dia do mês" content="Escolha um dia entre 1 e 31 para executar o envio mensal." /></div>
                  <Input
                    id="day_of_month"
                    name="day_of_month"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day_of_month ?? ''}
                    onChange={handleInputChange}
                    className="bg-white"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  />
                </div>
              )}

              {/* Grid: Hora e Minuto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="hour">Hora (0-23) *</Label><HelpTooltip label="Hora do envio" content="Informe a hora local em que o processo deve preparar o arquivo." /></div>
                  <Input
                    id="hour"
                    name="hour"
                    type="number"
                    min="0"
                    max="23"
                    value={formData.hour}
                    onChange={handleInputChange}
                    className="bg-white"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Label htmlFor="minute">Minuto (0-59) *</Label><HelpTooltip label="Minuto do envio" content="Informe o minuto da hora escolhida para iniciar o processo." /></div>
                  <Input
                    id="minute"
                    name="minute"
                    type="number"
                    min="0"
                    max="59"
                    value={formData.minute}
                    onChange={handleInputChange}
                    className="bg-white"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  />
                </div>
              </div>

              {/* Emails */}
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Label>Destinatários (e-mails) *</Label><HelpTooltip label="Destinatários" content="Adicione os endereços que receberão o arquivo gerado pelo agendamento." /></div>
                <div className="flex gap-2">
                  <Input
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    placeholder="seu@email.com"
                    className="bg-white"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    Adicionar
                  </button>
                </div>

                {formData.email_recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.email_recipients.map((email) => (
                      <Badge
                        key={email}
                        className="bg-blue-100 text-blue-800 flex items-center gap-2 px-3 py-1"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="ml-1 hover:text-blue-900"
                        >
                          ✕
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    !formData.name.trim()
                  }
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
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
                      Salvando...
                    </>
                  ) : editingId ? (
                    'Atualizar'
                  ) : (
                    'Criar Agendamento'
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold border border-gray-300 rounded-lg transition-all"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  Cancelar
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão Novo Agendamento */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                clipRule="evenodd"
              />
            </svg>
            Novo Agendamento
          </button>
        )}

        {/* Lista de Agendamentos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Agendamentos ({schedules.length})
            </h2>
            {loadingSchedules && (
              <svg
                className="w-5 h-5 text-blue-600 animate-spin"
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
            )}
          </div>

          {schedules.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="pt-12 pb-12 text-center">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-600 font-medium mb-4">
                  Nenhum agendamento criado
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                >
                  Criar Primeiro Agendamento
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg text-gray-900">
                          {schedule.name}
                        </CardTitle>
                        {schedule.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {schedule.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleMutation.mutate(schedule)}
                        disabled={toggleMutation.isPending}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          schedule.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {schedule.is_active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Detalhes */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Formato:</span>
                        <Badge className="bg-blue-100 text-blue-800 uppercase">
                          {schedule.format}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Frequência:</span>
                        <span className="font-semibold text-gray-900 capitalize">
                          {schedule.frequency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Horário:</span>
                        <span className="font-mono font-semibold text-gray-900">
                          {String(schedule.hour).padStart(2, '0')}:
                          {String(schedule.minute).padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    {/* Emails */}
                    {schedule.email_recipients && schedule.email_recipients.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-600 uppercase">
                          Destinatários ({schedule.email_recipients.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {schedule.email_recipients.slice(0, 2).map((email) => (
                            <Badge
                              key={email}
                              className="bg-gray-100 text-gray-800 text-xs"
                            >
                              {email}
                            </Badge>
                          ))}
                          {schedule.email_recipients.length > 2 && (
                            <Badge className="bg-gray-100 text-gray-800 text-xs">
                              +{schedule.email_recipients.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="space-y-1 text-xs text-gray-500 border-t pt-3">
                      {schedule.created_at && (
                        <p>
                          Criado:{' '}
                          {new Date(schedule.created_at).toLocaleDateString(
                            'pt-BR'
                          )}
                        </p>
                      )}
                      {schedule.last_executed_at && (
                        <p>
                          Última execução:{' '}
                          {new Date(schedule.last_executed_at).toLocaleString(
                            'pt-BR'
                          )}
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 pt-3 border-t">
                      <button
                        onClick={() => handleEdit(schedule)}
                        disabled={
                          createMutation.isPending ||
                          updateMutation.isPending ||
                          deleteMutation.isPending
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg transition-all text-sm disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={
                          createMutation.isPending ||
                          updateMutation.isPending ||
                          deleteMutation.isPending
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg transition-all text-sm disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Deletar
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ScheduledExportsPage;
