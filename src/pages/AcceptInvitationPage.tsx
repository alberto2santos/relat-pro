import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, HardHat, LoaderCircle } from 'lucide-react';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const nomesPerfis: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  engenheiro: 'Engenheiro',
  encarregado: 'Encarregado',
};

const AcceptInvitationPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-50 p-4">
        <LoaderCircle aria-label="Carregando convite" className="h-8 w-8 animate-spin text-blue-700" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-50 p-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <HardHat className="mx-auto mb-4 h-10 w-10 text-blue-700" />
          <h1 className="text-xl font-bold text-slate-900">Abra o convite recebido por e-mail</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Este endereço precisa ser aberto pelo link enviado pelo administrador para confirmar sua conta.
          </p>
          <Button asChild className="mt-6 w-full" size="lg">
            <Link to="/login">Ir para o acesso</Link>
          </Button>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-50 p-4">
        <section className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Não encontramos seu convite</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Peça ao administrador para conferir o endereço de e-mail e enviar um novo convite.
          </p>
          <Button asChild className="mt-6 w-full" size="lg" variant="outline">
            <Link to="/login">Voltar ao acesso</Link>
          </Button>
        </section>
      </main>
    );
  }

  if (!profile.invitation_pending) {
    return <Navigate to={profile.profile === 'admin' ? '/admin/dashboard' : '/rdos'} replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (fullName.trim().length < 2) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage('As senhas não conferem.');
      return;
    }

    setSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;

      const { error: inviteError } = await supabase.rpc('complete_employee_invitation', {
        p_full_name: fullName.trim(),
      });
      if (inviteError) throw inviteError;

      await refreshProfile();
      navigate(profile.profile === 'admin' ? '/admin/dashboard' : '/rdos', { replace: true });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Não foi possível concluir seu cadastro. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-50 p-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo-relat-pro-rdo-header.png" alt="" className="h-11 w-11 shrink-0 object-contain" />
          <div>
            <p className="text-sm font-semibold text-blue-700">Relat Pro RDO</p>
            <h1 className="text-xl font-bold text-slate-900">Concluir cadastro</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-slate-600">
          Complete seus dados para acessar o projeto. A função foi definida pelo administrador e não pode ser alterada nesta etapa.
        </p>

        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <HelpTooltip label="E-mail do convite" content="Este é o endereço para o qual o administrador enviou o convite. Ele não pode ser trocado nesta tela." />
            </div>
            <Input id="invite-email" autoComplete="email" className="h-11" readOnly value={user.email ?? ''} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="invite-name">Nome completo</Label>
              <HelpTooltip label="Nome completo" content="Seu nome será mostrado na gestão de usuários e nos registros vinculados à sua conta." />
            </div>
            <Input
              id="invite-name"
              autoComplete="name"
              className="h-11"
              maxLength={150}
              onChange={(event) => setFullName(event.target.value)}
              required
              value={fullName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="invite-profile">Função</Label>
              <HelpTooltip label="Função de acesso" content="O administrador escolheu esta função ao enviar o convite. Somente um administrador pode alterá-la." />
            </div>
            <Input id="invite-profile" className="h-11 bg-slate-50" readOnly value={nomesPerfis[profile.profile] ?? profile.profile} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="invite-password">Senha</Label>
              <HelpTooltip label="Senha" content="Crie uma senha com pelo menos 8 caracteres e evite reutilizar uma senha de outro serviço." />
            </div>
            <Input
              id="invite-password"
              autoComplete="new-password"
              className="h-11"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-password-confirmation">Confirmar senha</Label>
            <Input
              id="invite-password-confirmation"
              autoComplete="new-password"
              className="h-11"
              minLength={8}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
          </div>

          {errorMessage && (
            <p aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </p>
          )}

          <Button className="w-full" disabled={saving} size="lg" type="submit">
            {saving ? <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />}
            {saving ? 'Salvando cadastro…' : 'Criar conta e continuar'}
          </Button>
        </form>
      </section>
    </main>
  );
};

export default AcceptInvitationPage;
