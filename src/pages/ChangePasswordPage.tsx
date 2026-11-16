import { useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const ChangePasswordPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      notifyError('Senha muito curta', 'Use pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmation) {
      notifyError('As senhas não conferem', 'Confira a nova senha e a confirmação.');
      return;
    }

    if (newPassword === currentPassword) {
      notifyError('Escolha outra senha', 'A nova senha precisa ser diferente da atual.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    setSaving(false);

    if (updateError) {
      notifyError('Não foi possível trocar a senha', 'Confira sua senha atual e tente novamente.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    success('Senha atualizada', 'A nova senha já está valendo para os próximos acessos.');
  };

  return (
    <MainLayout>
      <div className="app-page app-page--narrow">
        <header>
          <p className="text-sm font-semibold text-blue-700">Minha conta</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Trocar senha</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Atualize sua senha de acesso com segurança.</p>
        </header>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <KeyRound aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-lg">Dados de segurança</CardTitle>
                <CardDescription className="mt-1 break-all">Conta: {user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="max-w-xl space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="current-password">Senha atual</Label>
                  <HelpTooltip label="Senha atual" content="Confirme sua senha atual para autorizar a alteração." />
                </div>
                <Input
                  id="current-password"
                  autoComplete="current-password"
                  className="h-11"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <HelpTooltip label="Nova senha" content="Use pelo menos 8 caracteres. Uma senha exclusiva ajuda a proteger sua conta." />
                </div>
                <Input
                  id="new-password"
                  autoComplete="new-password"
                  className="h-11"
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  autoComplete="new-password"
                  className="h-11"
                  minLength={8}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </div>

              <Button className="w-full sm:w-auto" disabled={saving} size="lg" type="submit">
                {saving && <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Atualizando…' : 'Salvar nova senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ChangePasswordPage;
