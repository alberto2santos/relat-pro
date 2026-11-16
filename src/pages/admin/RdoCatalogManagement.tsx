import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { EquipamentosRow, FuncoesRow, UnidadesRow } from '@/types/database';

const FUNCTION_SCHEMA = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da função.').max(120),
  descricao: z.string().trim().max(500),
});

const EQUIPMENT_SCHEMA = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do equipamento.').max(160),
  unidade_id: z.string().uuid().nullable(),
  identificador_externo: z.string().trim().max(120),
});

type FunctionForm = z.infer<typeof FUNCTION_SCHEMA>;
type EquipmentForm = z.infer<typeof EQUIPMENT_SCHEMA>;

const RdoCatalogManagement = () => {
  const { user, profile } = useAuth();
  const { success, error: notifyError } = useNotification();
  const queryClient = useQueryClient();
  const [editingFunction, setEditingFunction] = useState<FuncoesRow | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<EquipamentosRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: functions = [], isLoading: loadingFunctions, isError: functionsError } = useQuery({
    queryKey: ['admin-rdo-functions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcoes').select('*').order('nome');
      if (error) throw error;
      return data;
    },
  });
  const { data: equipment = [], isLoading: loadingEquipment, isError: equipmentError } = useQuery({
    queryKey: ['admin-rdo-equipment'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipamentos').select('*').order('nome');
      if (error) throw error;
      return data;
    },
  });
  const { data: units = [] } = useQuery<UnidadesRow[]>({
    queryKey: ['admin-unidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('*').is('deleted_at', null).order('codigo');
      if (error) throw error;
      return data;
    },
  });

  const functionForm = useForm<FunctionForm>({
    resolver: zodResolver(FUNCTION_SCHEMA),
    defaultValues: { nome: '', descricao: '' },
  });
  const equipmentForm = useForm<EquipmentForm>({
    resolver: zodResolver(EQUIPMENT_SCHEMA),
    defaultValues: { nome: '', unidade_id: null, identificador_externo: '' },
  });

  useEffect(() => {
    functionForm.reset(editingFunction
      ? { nome: editingFunction.nome, descricao: editingFunction.descricao || '' }
      : { nome: '', descricao: '' });
  }, [editingFunction, functionForm]);
  useEffect(() => {
    equipmentForm.reset(editingEquipment
      ? {
          nome: editingEquipment.nome,
          unidade_id: editingEquipment.unidade_id,
          identificador_externo: editingEquipment.identificador_externo || '',
        }
      : { nome: '', unidade_id: null, identificador_externo: '' });
  }, [editingEquipment, equipmentForm]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-rdo-functions'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-rdo-equipment'] });
    void queryClient.invalidateQueries({ queryKey: ['funcoes-rdo'] });
    void queryClient.invalidateQueries({ queryKey: ['equipamentos-rdo'] });
  };

  const saveFunction = async (values: FunctionForm) => {
    setSaving(true);
    try {
      const result = editingFunction
        ? await supabase.from('funcoes').update({ nome: values.nome, descricao: values.descricao || null }).eq('id', editingFunction.id)
        : await supabase.from('funcoes').insert({ nome: values.nome, descricao: values.descricao || null });
      if (result.error) throw result.error;
      success(editingFunction ? 'Função atualizada' : 'Função cadastrada');
      setEditingFunction(null);
      functionForm.reset({ nome: '', descricao: '' });
      refresh();
    } catch (cause) {
      notifyError('Não foi possível salvar a função', cause instanceof Error ? cause.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const saveEquipment = async (values: EquipmentForm) => {
    setSaving(true);
    try {
      const payload = {
        nome: values.nome,
        unidade_id: values.unidade_id,
        identificador_externo: values.identificador_externo || null,
      };
      const result = editingEquipment
        ? await supabase.from('equipamentos').update(payload).eq('id', editingEquipment.id)
        : await supabase.from('equipamentos').insert(payload);
      if (result.error) throw result.error;
      success(editingEquipment ? 'Equipamento atualizado' : 'Equipamento cadastrado');
      setEditingEquipment(null);
      equipmentForm.reset({ nome: '', unidade_id: null, identificador_externo: '' });
      refresh();
    } catch (cause) {
      notifyError('Não foi possível salvar o equipamento', cause instanceof Error ? cause.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (table: 'funcoes' | 'equipamentos', row: FuncoesRow | EquipamentosRow) => {
    try {
      const { error } = await supabase.from(table).update({ deleted_at: row.deleted_at ? null : new Date().toISOString() }).eq('id', row.id);
      if (error) throw error;
      success(row.deleted_at ? 'Cadastro reativado' : 'Cadastro arquivado');
      refresh();
    } catch (cause) {
      notifyError('Não foi possível atualizar o cadastro', cause instanceof Error ? cause.message : 'Tente novamente.');
    }
  };

  if (!user || profile?.profile !== 'admin') {
    return <MainLayout><div className="app-page app-page--medium items-center text-center text-destructive">Apenas administradores podem acessar esta página.</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        <header>
          <p className="text-sm font-semibold text-primary">Administração</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Funções e equipamentos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gerencie os cadastros usados nas seções operacionais dos RDOs. Cadastros com histórico são arquivados, não apagados.</p>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{editingFunction ? 'Editar função' : 'Cadastrar função'}</CardTitle>
              <CardDescription>As funções ativas ficam disponíveis no apontamento de efetivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={functionForm.handleSubmit((values) => void saveFunction(values))} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="function-name">Nome *</Label>
                  <Input id="function-name" {...functionForm.register('nome')} />
                  {functionForm.formState.errors.nome && <p className="text-sm text-destructive">{functionForm.formState.errors.nome.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="function-description">Descrição</Label>
                  <Input id="function-description" {...functionForm.register('descricao')} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}><Plus className="size-4" />{editingFunction ? 'Salvar função' : 'Cadastrar função'}</Button>
                  {editingFunction && <Button type="button" variant="outline" onClick={() => setEditingFunction(null)}>Cancelar</Button>}
                </div>
              </form>
              <CatalogList
                title="Funções cadastradas"
                rows={functions}
                loading={loadingFunctions}
                failed={functionsError}
                onEdit={(row) => setEditingFunction(row as FuncoesRow)}
                onArchive={(row) => void toggleArchive('funcoes', row)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editingEquipment ? 'Editar equipamento' : 'Cadastrar equipamento'}</CardTitle>
              <CardDescription>Um equipamento pode ser global ou associado a uma unidade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={equipmentForm.handleSubmit((values) => void saveEquipment(values))} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="equipment-name">Nome *</Label>
                  <Input id="equipment-name" {...equipmentForm.register('nome')} />
                  {equipmentForm.formState.errors.nome && <p className="text-sm text-destructive">{equipmentForm.formState.errors.nome.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipment-unit">Unidade (opcional)</Label>
                  <Select
                    value={equipmentForm.watch('unidade_id') || 'global'}
                    onValueChange={(value) => equipmentForm.setValue('unidade_id', value === 'global' ? null : value, { shouldDirty: true, shouldValidate: true })}
                  >
                    <SelectTrigger id="equipment-unit"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Todas as unidades</SelectItem>
                      {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.codigo} — {unit.nome || 'Sem nome'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipment-external-id">Identificador externo (opcional)</Label>
                  <Input id="equipment-external-id" {...equipmentForm.register('identificador_externo')} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}><Plus className="size-4" />{editingEquipment ? 'Salvar equipamento' : 'Cadastrar equipamento'}</Button>
                  {editingEquipment && <Button type="button" variant="outline" onClick={() => setEditingEquipment(null)}>Cancelar</Button>}
                </div>
              </form>
              <CatalogList
                title="Equipamentos cadastrados"
                rows={equipment}
                loading={loadingEquipment}
                failed={equipmentError}
                onEdit={(row) => setEditingEquipment(row as EquipamentosRow)}
                onArchive={(row) => void toggleArchive('equipamentos', row)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

interface CatalogRow {
  id: string;
  nome: string;
  deleted_at: string | null;
}

interface CatalogListProps<T extends CatalogRow> {
  title: string;
  rows: T[];
  loading: boolean;
  failed: boolean;
  onEdit: (row: T) => void;
  onArchive: (row: T) => void;
}

const CatalogList = <T extends CatalogRow,>({ title, rows, loading, failed, onEdit, onArchive }: CatalogListProps<T>) => (
  <section className="space-y-3 border-t pt-4">
    <h2 className="font-semibold">{title}</h2>
    {loading ? (
      <div role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando...</div>
    ) : failed ? (
      <p role="alert" className="text-sm text-destructive">Não foi possível carregar os cadastros.</p>
    ) : rows.length === 0 ? (
      <p className="py-4 text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
    ) : (
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="break-words font-medium">{row.nome}</p>
              <Badge variant={row.deleted_at ? 'outline' : 'secondary'} className="mt-1">{row.deleted_at ? 'Arquivado' : 'Ativo'}</Badge>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onEdit(row)} aria-label={`Editar ${row.nome}`}><Pencil className="size-4" /></Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onArchive(row)} aria-label={row.deleted_at ? `Reativar ${row.nome}` : `Arquivar ${row.nome}`}>
                {row.deleted_at ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default RdoCatalogManagement;
