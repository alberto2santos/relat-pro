import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
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
import type { Disciplina, UnidadesRow } from '@/types/database';

const UNIT_SCHEMA = z.object({
  codigo: z.string().trim().min(1, 'Informe o código da unidade.').max(40, 'O código deve ter no máximo 40 caracteres.'),
  nome: z.string().trim().max(120, 'O nome deve ter no máximo 120 caracteres.'),
  disciplina: z.enum(['automacao', 'instrumentacao', 'eletrica', 'civil', 'nenhuma']),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
}).superRefine((unit, context) => {
  if ((unit.latitude === null) !== (unit.longitude === null)) {
    context.addIssue({
      code: 'custom',
      path: ['longitude'],
      message: 'Informe latitude e longitude juntas.',
    });
  }
});

type UnitFormData = z.infer<typeof UNIT_SCHEMA>;

const DISCIPLINES: { value: UnitFormData['disciplina']; label: string }[] = [
  { value: 'nenhuma', label: 'Não definida' },
  { value: 'automacao', label: 'Automação' },
  { value: 'instrumentacao', label: 'Instrumentação' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'civil', label: 'Construção e Montagem' },
];

const UnitManagement = () => {
  const { user, profile } = useAuth();
  const { success, error: notifyError } = useNotification();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUnit, setEditingUnit] = useState<UnidadesRow | null>(null);

  const { data: units = [], isLoading, isError, refetch } = useQuery<UnidadesRow[]>({
    queryKey: ['admin-unidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .order('codigo', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<UnitFormData>({
    resolver: zodResolver(UNIT_SCHEMA),
    defaultValues: { codigo: '', nome: '', disciplina: 'nenhuma', latitude: null, longitude: null },
  });

  useEffect(() => {
    form.reset(editingUnit
      ? {
          codigo: editingUnit.codigo,
          nome: editingUnit.nome || '',
          disciplina: editingUnit.disciplina || 'nenhuma',
          latitude: editingUnit.latitude,
          longitude: editingUnit.longitude,
        }
      : { codigo: '', nome: '', disciplina: 'nenhuma', latitude: null, longitude: null });
  }, [editingUnit, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      const payload = {
        codigo: data.codigo.trim(),
        nome: data.nome.trim() || null,
        disciplina: data.disciplina === 'nenhuma' ? null : data.disciplina as Disciplina,
        latitude: data.latitude,
        longitude: data.longitude,
      };
      const result = editingUnit
        ? await supabase.from('unidades').update(payload).eq('id', editingUnit.id)
        : await supabase.from('unidades').insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      success(editingUnit ? 'Unidade atualizada' : 'Unidade cadastrada');
      setEditingUnit(null);
      form.reset({ codigo: '', nome: '', disciplina: 'nenhuma', latitude: null, longitude: null });
      void queryClient.invalidateQueries({ queryKey: ['admin-unidades'] });
      void queryClient.invalidateQueries({ queryKey: ['unidades'] });
    },
    onError: (cause) => {
      notifyError('Não foi possível salvar a unidade', cause instanceof Error ? cause.message : 'Tente novamente.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (unit: UnidadesRow) => {
      const { error } = await supabase
        .from('unidades')
        .update({ deleted_at: unit.deleted_at ? null : new Date().toISOString() })
        .eq('id', unit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      success('Cadastro da unidade atualizado');
      void queryClient.invalidateQueries({ queryKey: ['admin-unidades'] });
      void queryClient.invalidateQueries({ queryKey: ['unidades'] });
    },
    onError: (cause) => {
      notifyError('Não foi possível atualizar a unidade', cause instanceof Error ? cause.message : 'Tente novamente.');
    },
  });

  const filteredUnits = units.filter((unit) =>
    `${unit.codigo} ${unit.nome || ''} ${unit.disciplina || ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );

  if (!user || profile?.profile !== 'admin') {
    return <MainLayout><div className="app-page app-page--medium items-center text-center text-destructive">Apenas administradores podem acessar esta página.</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="app-page app-page--medium">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Administração</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Unidades da obra</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Cadastre as frentes, plantas ou unidades que serão selecionadas nos relatórios.
            </p>
          </div>
          <Badge variant="secondary">{units.filter((unit) => !unit.deleted_at).length} ativas</Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{editingUnit ? 'Editar unidade' : 'Cadastrar unidade'}</CardTitle>
            <CardDescription>O código deve ser único e aparecerá junto ao nome na busca do formulário de RDO.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(8rem,0.7fr)_minmax(12rem,1.3fr)_minmax(12rem,1fr)_auto]"
            >
              <div className="space-y-2">
                <Label htmlFor="unit-code">Código *</Label>
                <Input id="unit-code" placeholder="Ex.: UN-01" {...form.register('codigo')} aria-invalid={!!form.formState.errors.codigo} />
                {form.formState.errors.codigo && <p className="text-sm text-destructive">{form.formState.errors.codigo.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-name">Nome</Label>
                <Input id="unit-name" placeholder="Ex.: Subestação principal" {...form.register('nome')} aria-invalid={!!form.formState.errors.nome} />
                {form.formState.errors.nome && <p className="text-sm text-destructive">{form.formState.errors.nome.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-discipline">Disciplina</Label>
                <Select
                  value={form.watch('disciplina')}
                  onValueChange={(value) => form.setValue('disciplina', value as UnitFormData['disciplina'], { shouldDirty: true })}
                >
                  <SelectTrigger id="unit-discipline" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((discipline) => <SelectItem key={discipline.value} value={discipline.value}>{discipline.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : editingUnit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {editingUnit ? 'Salvar' : 'Cadastrar'}
                </Button>
                {editingUnit && (
                  <Button type="button" variant="outline" onClick={() => setEditingUnit(null)}>
                    <X className="size-4" /> Cancelar
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-latitude">Latitude (opcional)</Label>
                  <Input
                    id="unit-latitude"
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    placeholder="-23.5505"
                    {...form.register('latitude', { setValueAs: (value) => value === '' ? null : Number(value) })}
                  />
                  {form.formState.errors.latitude && <p className="text-sm text-destructive">Use um valor entre -90 e 90.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit-longitude">Longitude (opcional)</Label>
                  <Input
                    id="unit-longitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    placeholder="-46.6333"
                    {...form.register('longitude', { setValueAs: (value) => value === '' ? null : Number(value) })}
                  />
                  {form.formState.errors.longitude && <p className="text-sm text-destructive">{form.formState.errors.longitude.message || 'Use um valor entre -180 e 180.'}</p>}
                </div>
                <p className="text-sm text-muted-foreground sm:col-span-2">Informe as coordenadas para sugerir automaticamente o clima nos novos RDOs. Ambas são opcionais.</p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Unidades cadastradas</CardTitle>
              <CardDescription>Unidades arquivadas deixam de aparecer nos novos relatórios, mas permanecem vinculadas aos RDOs anteriores.</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar unidade..." className="pl-9" aria-label="Buscar unidade cadastrada" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Carregando unidades...</div>
            ) : isError ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-sm text-destructive">
                <p>Não foi possível carregar as unidades.</p>
                <Button type="button" variant="outline" onClick={() => void refetch()}><RotateCcw className="size-4" /> Tentar novamente</Button>
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Building2 className="size-9 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium text-foreground">{units.length ? 'Nenhuma unidade corresponde à busca.' : 'Nenhuma unidade cadastrada ainda.'}</p>
                <p className="max-w-md text-sm text-muted-foreground">Cadastre os códigos e nomes usados pela sua obra. Não há unidades de exemplo porque esses dados variam por empresa.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredUnits.map((unit) => (
                  <li key={unit.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{unit.codigo}</span>
                        <Badge variant={unit.deleted_at ? 'outline' : 'secondary'}>{unit.deleted_at ? 'Arquivada' : 'Ativa'}</Badge>
                      </div>
                      <p className="mt-1 break-words text-sm text-muted-foreground">{unit.nome || 'Sem nome'}</p>
                      {unit.disciplina && <p className="mt-1 text-xs text-muted-foreground">{DISCIPLINES.find((item) => item.value === unit.disciplina)?.label}</p>}
                      {unit.latitude !== null && unit.longitude !== null && <p className="mt-1 text-xs text-muted-foreground">Coordenadas cadastradas para consulta do clima</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingUnit(unit)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={archiveMutation.isPending}
                        onClick={() => archiveMutation.mutate(unit)}
                        aria-label={unit.deleted_at ? `Reativar ${unit.codigo}` : `Arquivar ${unit.codigo}`}
                      >
                        {unit.deleted_at ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                        {unit.deleted_at ? 'Reativar' : 'Arquivar'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default UnitManagement;
