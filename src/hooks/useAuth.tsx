import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getProfile, supabase } from '@/lib/supabase';
import type { ProfilesRow } from '@/lib/supabase';
import { cacheProfile, getCachedProfile } from '@/services/offlineRdoStorage';

interface AuthContextValue {
  user: User | null;
  profile: ProfilesRow | null;
  loading: boolean;
  error: string | null;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfilesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileRequest = useRef(0);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;

        if (event === 'TOKEN_REFRESHED' && currentUser) {
          setUser(currentUser);
          return;
        }

        const request = ++profileRequest.current;

        if (!mounted) return;
        setUser(currentUser);
        setError(null);

        if (!currentUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        // A consulta fica fora do callback para não prender a fila de autenticação.
        window.setTimeout(() => {
          void (async () => {
            let nextProfile: ProfilesRow | null;
            if (navigator.onLine) {
              nextProfile = await getProfile(currentUser.id);
              if (nextProfile) {
                try {
                  await cacheProfile(currentUser.id, nextProfile);
                } catch (cacheError) {
                  console.warn('[AuthProvider] Não foi possível atualizar o perfil offline:', cacheError);
                }
              }
            } else {
              nextProfile = await getCachedProfile(currentUser.id);
            }
            if (!nextProfile && navigator.onLine) {
              nextProfile = await getCachedProfile(currentUser.id);
              if (nextProfile) {
                console.warn('[AuthProvider] Usando perfil local porque não foi possível confirmar o perfil no servidor.');
              }
            }

            if (mounted && request === profileRequest.current) {
              setProfile(nextProfile);
              if (!nextProfile) {
                setError(navigator.onLine
                  ? 'Sua conta ainda não tem um perfil de acesso. Peça ajuda a um administrador.'
                  : 'Não há um perfil salvo neste dispositivo. Conecte-se à internet para entrar.');
              }
            }
          })().catch((cause: unknown) => {
            console.error('[AuthProvider] Não foi possível carregar o perfil:', cause);
            if (mounted && request === profileRequest.current) {
              setProfile(null);
              setError('Não foi possível carregar seu perfil de acesso.');
            }
          }).finally(() => {
            if (mounted && request === profileRequest.current) {
              setLoading(false);
            }
          });
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextValue['signIn'] = async ({ email, password }) => {
    setLoading(true);
    setError(null);
    let authenticated = false;

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      authenticated = true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Erro ao fazer login';
      const friendlyMessage = message === 'Invalid login credentials'
        ? 'E-mail ou senha inválidos'
        : message;
      setError(friendlyMessage);
      throw new Error(friendlyMessage);
    } finally {
      if (!authenticated) setLoading(false);
    }
  };

  const refreshProfile: AuthContextValue['refreshProfile'] = async () => {
    if (!user) return;

    const nextProfile = await getProfile(user.id);
    setProfile(nextProfile);
    setError(nextProfile ? null : 'Não foi possível atualizar seu perfil de acesso.');
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
      setUser(null);
      setProfile(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Erro ao encerrar a sessão';
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
