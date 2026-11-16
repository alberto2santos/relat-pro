import { withSupabase } from 'npm:@supabase/server@1';

const perfisPermitidos = ['admin', 'supervisor', 'engenheiro', 'encarregado'] as const;

type PerfilPermitido = (typeof perfisPermitidos)[number];

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Método não permitido.' }, { status: 405 });
    }

    const userId = context.userClaims?.id;
    if (!userId) {
      return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    const { data: perfilAdmin, error: erroPerfil } = await context.supabase
      .from('profiles')
      .select('profile')
      .eq('id', userId)
      .maybeSingle();

    if (erroPerfil || perfilAdmin?.profile !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem enviar convites.' }, { status: 403 });
    }

    let dados: { email?: unknown; profile?: unknown };
    try {
      dados = await request.json();
    } catch {
      return Response.json({ error: 'Os dados do convite são inválidos.' }, { status: 400 });
    }

    const email = typeof dados.email === 'string' ? dados.email.trim().toLowerCase() : '';
    const profile = dados.profile;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }

    if (typeof profile !== 'string' || !perfisPermitidos.includes(profile as PerfilPermitido)) {
      return Response.json({ error: 'Selecione uma função válida.' }, { status: 400 });
    }

    const origem = request.headers.get('origin');
    let redirectTo: string;
    try {
      const urlOrigem = new URL(origem ?? '');
      if (!['http:', 'https:'].includes(urlOrigem.protocol)) throw new Error('Origem inválida');
      redirectTo = new URL('/aceitar-convite', urlOrigem.origin).toString();
    } catch {
      return Response.json({ error: 'Não foi possível identificar o endereço do aplicativo.' }, { status: 400 });
    }

    const { error: erroConvite } = await context.supabaseAdmin
      .from('employee_invitations')
      .insert({ email, profile, created_by: userId });

    if (erroConvite) {
      const conflito = erroConvite.code === '23505';
      return Response.json(
        { error: conflito ? 'Já existe um convite pendente para este e-mail.' : 'Não foi possível preparar o convite.' },
        { status: conflito ? 409 : 500 },
      );
    }

    const { data, error: erroEnvio } = await context.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (erroEnvio) {
      await context.supabaseAdmin
        .from('employee_invitations')
        .delete()
        .eq('email', email)
        .eq('status', 'pending');

      return Response.json(
        { error: 'O Supabase não conseguiu enviar o convite. Confira se o e-mail já está cadastrado e se o envio de e-mails está configurado.' },
        { status: 400 },
      );
    }

    return Response.json({ userId: data.user?.id, email, profile });
  }),
};
