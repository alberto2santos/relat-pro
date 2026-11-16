import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email({ message: 'E-mail inválido' }),
  password: z.string().min(1, { message: 'Senha é obrigatória' }),
});

type FormData = z.infer<typeof schema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading, error, signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Redirecionar apenas quando autenticação estiver completa
  useEffect(() => {
    if (user && profile && !loading) {
      navigate(profile.profile === 'admin' ? '/admin/dashboard' : '/rdos', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await signIn(data);
      // O redirecionamento acontecerá automaticamente via useEffect acima
    } catch (err) {
      console.error('[LoginPage] Falha na autenticação:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tela de carregamento durante inicialização
  if (loading && !user) {
    return (
      <main className="auth-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="w-12 h-12 text-white animate-spin"
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
          <p className="text-white font-semibold text-sm tracking-wide">
            Sincronizando Relat Pro RDO...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-screen flex items-center justify-center p-4">
      <section aria-labelledby="login-title" className="auth-panel w-full max-w-md">
        {/* Logo/Título */}
        <div className="text-center mb-8">
          <img
            src="/logo-relat-pro-rdo-login.png"
            alt=""
            className="mx-auto mb-4 h-36 w-36 object-contain"
          />
          <h1 id="login-title" className="text-3xl font-bold tracking-tight text-gray-900">Relat Pro RDO</h1>
          <p className="text-gray-500 text-sm mt-2">Gestão de Relatórios Diários de Obra</p>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm flex gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
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
            <span>{error}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Campo Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              E-mail Corporativo
            </label>
            <input
              id="email"
              {...register('email')}
              type="email"
              placeholder="seu.email@empresa.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Campo Senha */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              id="password"
              {...register('password')}
              type="password"
              placeholder="Sua senha"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Botão Submit */}
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin"
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
                Entrando...
              </>
            ) : (
              'Entrar no Sistema'
            )}
          </button>
        </form>

        {/* Rodapé */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 text-xs">
            Relat Pro RDO v1.0.0 | Automação e Controle Industrial
          </p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
