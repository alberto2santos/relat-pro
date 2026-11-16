import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardHat, LoaderCircle, MailPlus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { ProfilesRow } from '@/lib/supabase';
import type { Disciplina, UserProfile } from '@/types/database';

type ProfileFormData = {
  profile: UserProfile;
  disciplina: Disciplina | null;
};

type InviteFormData = {
  email: string;
  profile: UserProfile;
};

const perfis: { value: UserProfile; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'engenheiro', label: 'Engenheiro' },
  { value: 'encarregado', label: 'Encarregado' },
];

const UserManagement = () => {
  const { user, profile } = useAuth();
  const { success, error: notifyError } = useNotification();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<ProfilesRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<ProfilesRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: users = [], isLoading, isError, refetch } = useQuery<ProfilesRow[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const editForm = useForm<ProfileFormData>();
  const inviteForm = useForm<InviteFormData>({ defaultValues: { profile: 'encarregado' } });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const { data: response, error } = await supabase.functions.invoke('invite-employee', {
        body: { email: data.email.trim().toLowerCase(), profile: data.profile },
      });

      if (error) {
        if ('context' in error && error.context instanceof Response) {
          const responseBody = await error.context.clone().json().catch(() => null) as { error?: string } | null;
          throw new Error(responseBody?.error ?? error.message);
        }
        throw error;
      }

      if (response?.error) throw new Error(response.error);
    },
    onSuccess: () => {
      success('Convite enviado', 'O colaborador receberá um link para concluir o cadastro.');
      inviteForm.reset({ email: '', profile: 'encarregado' });
      setInviteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: (cause) => {
      notifyError('Não foi possível enviar o convite', cause instanceof Error ? cause.message : 'Tente novamente.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData & { id: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ profile: data.profile, disciplina: data.disciplina })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      success('Acesso atualizado', 'As alterações já foram aplicadas.');
      setEditingUser(null);
      void queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: (cause) => {
      notifyError('Não foi possível atualizar o acesso', cause instanceof Error ? cause.message : 'Tente novamente.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id === user?.id) throw new Error('Você não pode remover o próprio acesso.');
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      success('Acesso removido', 'A conta de autenticação continua no Supabase, mas não terá perfil para acessar o sistema.');
      setDeleteUser(null);
      void queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: (cause) => {
      notifyError('Não foi possível remover o acesso', cause instanceof Error ? cause.message : 'Tente novamente.');
    },
  });

  const filteredUsers = users.filter((item) => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    if (!search) return true;
    return [item.full_name, item.email, item.id, labelPerfil(item.profile)]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(search));
  });

  if (!user || profile?.profile !== 'admin') {
    return (
      <MainLayout>
        <div className="app-page app-page--medium items-center text-center text-red-700">Apenas administradores podem acessar esta página.</div>
      </MainLayout>
    );
  }

  const openEditor = (item: ProfilesRow) => {
    setEditingUser(item);
    editForm.reset({ profile: item.profile, disciplina: item.disciplina });
  };

  const submitEdit = editForm.handleSubmit((data) => {
    if (editingUser) updateMutation.mutate({ id: editingUser.id, ...data });
  });

  const submitInvite = inviteForm.handleSubmit((data) => inviteMutation.mutate(data));

  const usersByProfile = perfis.map(({ value, label }) => ({
    value,
    label,
    count: users.filter((item) => item.profile === value).length,
  }));

  return (
    <MainLayout>
      <div className="app-page app-page--wide">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Administração</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Gestão de usuários</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Convide colaboradores, defina as funções de acesso e mantenha os dados da equipe atualizados.
            </p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setInviteOpen(true)} size="lg">
            <MailPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            Convidar funcionário
          </Button>
        </header>

        <section aria-label="Resumo de usuários" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard title="Total" value={users.length} icon={<Users className="h-5 w-5" />} />
          {usersByProfile.map(({ value, label, count }) => (
            <StatCard key={value} title={label} value={count} icon={value === 'admin' ? <ShieldCheck className="h-5 w-5" /> : <HardHat className="h-5 w-5" />} />
          ))}
        </section>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Pessoas com acesso</CardTitle>
              <CardDescription className="mt-1">Convites pendentes aparecem com o status “Aguardando cadastro”.</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Buscar usuário"
                className="h-11 bg-white pl-9"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nome, e-mail ou ID"
                value={searchTerm}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-slate-600">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-blue-700" />
                Carregando usuários…
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
                <p className="text-sm text-red-800">Não foi possível carregar os usuários.</p>
                <Button className="mt-3" onClick={() => void refetch()} variant="outline">Tentar novamente</Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center">
                <Users aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-700">Nenhum usuário encontrado.</p>
                <p className="mt-1 text-sm text-slate-500">Confira a busca ou envie um convite para começar.</p>
              </div>
            ) : (
              <>
                <ul className="space-y-3 lg:hidden">
                  {filteredUsers.map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{item.full_name || 'Cadastro sem nome'}</p>
                          <p className="mt-1 break-all text-sm text-slate-600">{item.email || item.id}</p>
                        </div>
                        <ProfileBadge profile={item.profile} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className={`rounded-full px-2.5 py-1 font-medium ${item.invitation_pending ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                          {item.invitation_pending ? 'Aguardando cadastro' : 'Ativo'}
                        </span>
                        <span>{item.disciplina ? labelDisciplina(item.disciplina) : 'Sem disciplina'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : 'Data indisponível'}</span>
                      </div>
                      <UserActions item={item} isCurrentUser={item.id === user.id} onEdit={openEditor} onDelete={setDeleteUser} />
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Colaborador</th>
                        <th className="px-3 py-3 font-semibold">Função</th>
                        <th className="px-3 py-3 font-semibold">
                          <span className="inline-flex items-center gap-1">Situação<HelpTooltip label="Situação do usuário" content="Aguardando cadastro significa que o convite foi enviado, mas a pessoa ainda não concluiu o acesso." /></span>
                        </th>
                        <th className="px-3 py-3 font-semibold">Disciplina</th>
                        <th className="px-3 py-3 font-semibold">Unidade</th>
                        <th className="px-3 py-3 font-semibold">Criado em</th>
                        <th className="px-3 py-3 text-right font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="max-w-64 px-3 py-4">
                            <p className="truncate font-semibold text-slate-900">{item.full_name || 'Cadastro sem nome'}</p>
                            <p className="truncate text-xs text-slate-500">{item.email || item.id}</p>
                          </td>
                          <td className="px-3 py-4"><ProfileBadge profile={item.profile} /></td>
                          <td className="px-3 py-4 text-slate-600">{item.invitation_pending ? 'Aguardando cadastro' : 'Ativo'}</td>
                          <td className="px-3 py-4 text-slate-600">{item.disciplina ? labelDisciplina(item.disciplina) : '—'}</td>
                          <td className="px-3 py-4 font-mono text-xs text-slate-600">{item.unidade_id ? item.unidade_id.slice(0, 8) : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-slate-600">{item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="px-3 py-4"><UserActions item={item} isCurrentUser={item.id === user.id} onEdit={openEditor} onDelete={setDeleteUser} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {inviteOpen && (
        <Modal title="Convidar funcionário" onClose={() => setInviteOpen(false)}>
          <CardDescription className="mb-5 leading-6">
            O Supabase enviará um link para este endereço. A pessoa informa o nome e cria a senha; a função fica definida por você.
          </CardDescription>
          <form className="space-y-5" onSubmit={submitInvite}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="employee-email">E-mail do funcionário</Label>
                <HelpTooltip label="E-mail de convite" content="O convite só pode ser aceito usando este endereço de e-mail." />
              </div>
              <Input
                id="employee-email"
                autoComplete="email"
                className="h-11"
                type="email"
                {...inviteForm.register('email', { required: 'Informe o e-mail.', maxLength: 254 })}
              />
              {inviteForm.formState.errors.email && <p className="text-sm text-red-700">{inviteForm.formState.errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Função de acesso</Label>
                <HelpTooltip label="Função de acesso" content="A função determina quais áreas do sistema ficam disponíveis. A pessoa convidada não poderá alterá-la ao criar a conta." />
              </div>
              <Controller
                control={inviteForm.control}
                name="profile"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                    <SelectContent>
                      {perfis.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setInviteOpen(false)} type="button" variant="outline">Cancelar</Button>
              <Button className="w-full sm:w-auto" disabled={inviteMutation.isPending} type="submit">
                {inviteMutation.isPending && <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                {inviteMutation.isPending ? 'Enviando…' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal title="Editar acesso" onClose={() => setEditingUser(null)}>
          <p className="mb-5 break-all text-sm text-slate-600">{editingUser.email || editingUser.id}</p>
          <form className="space-y-5" onSubmit={submitEdit}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Função</Label>
                <HelpTooltip label="Função" content="A função controla as permissões no sistema. Somente administradores podem mudar este valor." />
              </div>
              <Controller
                control={editForm.control}
                name="profile"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{perfis.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Controller
                control={editForm.control}
                name="disciplina"
                render={({ field }) => (
                  <Select onValueChange={(value) => field.onChange(value === 'nenhuma' ? null : value as Disciplina)} value={field.value ?? 'nenhuma'}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      <SelectItem value="eletrica">Elétrica</SelectItem>
                      <SelectItem value="civil">Construção e montagem</SelectItem>
                      <SelectItem value="instrumentacao">Instrumentação</SelectItem>
                      <SelectItem value="automacao">Automação</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setEditingUser(null)} type="button" variant="outline">Cancelar</Button>
              <Button className="w-full sm:w-auto" disabled={updateMutation.isPending} type="submit">{updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteUser && (
        <Modal title="Remover acesso?" onClose={() => setDeleteUser(null)}>
          <p className="mb-6 text-sm leading-6 text-slate-600">
            O perfil será removido e a conta do Supabase permanecerá cadastrada, mas sem acesso ao projeto. Para liberar novamente, um administrador precisará atribuir um perfil.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" onClick={() => setDeleteUser(null)} variant="outline">Cancelar</Button>
            <Button className="w-full sm:w-auto" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteUser.id)} variant="destructive">
              {deleteMutation.isPending && <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              Remover acesso
            </Button>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
};

const labelPerfil = (profile: UserProfile) => perfis.find((item) => item.value === profile)?.label ?? profile;

const labelDisciplina = (disciplina: Disciplina) => ({
  eletrica: 'Elétrica',
  civil: 'Construção e montagem',
  instrumentacao: 'Instrumentação',
  automacao: 'Automação',
})[disciplina];

const StatCard = ({ title, value, icon }: { title: string; value: number; icon: ReactNode }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardContent className="flex min-h-24 items-center justify-between gap-2 p-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">{icon}</span>
    </CardContent>
  </Card>
);

const ProfileBadge = ({ profile }: { profile: UserProfile }) => {
  const styles: Record<UserProfile, string> = {
    admin: 'bg-red-50 text-red-800 ring-red-200',
    supervisor: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    engenheiro: 'bg-violet-50 text-violet-800 ring-violet-200',
    encarregado: 'bg-amber-50 text-amber-800 ring-amber-200',
  };

  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[profile]}`}>{labelPerfil(profile)}</span>;
};

const UserActions = ({
  item,
  isCurrentUser,
  onEdit,
  onDelete,
}: {
  item: ProfilesRow;
  isCurrentUser: boolean;
  onEdit: (item: ProfilesRow) => void;
  onDelete: (item: ProfilesRow) => void;
}) => (
  <div className="mt-3 flex justify-end gap-2 lg:mt-0">
    <Button aria-label={`Editar acesso de ${item.email ?? item.id}`} className="min-h-10" onClick={() => onEdit(item)} type="button" variant="outline">
      Editar
    </Button>
    <Button
      aria-label={`Remover acesso de ${item.email ?? item.id}`}
      className="min-h-10"
      disabled={isCurrentUser}
      onClick={() => onDelete(item)}
      title={isCurrentUser ? 'Você não pode remover o próprio acesso.' : 'Remover acesso'}
      type="button"
      variant="destructive"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4 lg:mr-2" />
      <span className="hidden lg:inline">Remover</span>
    </Button>
  </div>
);

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4" role="presentation">
    <div className="flex min-h-full items-center justify-center">
      <Card aria-labelledby="user-management-modal-title" aria-modal="true" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto shadow-xl" role="dialog">
        <CardHeader className="sticky top-0 z-10 flex flex-row items-start justify-between gap-3 border-b border-slate-100 bg-white">
          <CardTitle id="user-management-modal-title" className="text-xl">{title}</CardTitle>
          <Button aria-label="Fechar" className="-mr-2 -mt-2 shrink-0" onClick={onClose} size="icon" type="button" variant="ghost">
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">{children}</CardContent>
      </Card>
    </div>
  </div>
);

export default UserManagement;
