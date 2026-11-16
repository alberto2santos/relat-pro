import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas.');
}

const authStorageKey = 'relat-pro-rdo-auth-token';
const legacyAuthStorageKey = 'voltseit-auth-token';

if (typeof window !== 'undefined') {
  try {
    if (!window.localStorage.getItem(authStorageKey)) {
      const legacySession = window.localStorage.getItem(legacyAuthStorageKey);
      if (legacySession) window.localStorage.setItem(authStorageKey, legacySession);
    }
  } catch (cause) {
    console.warn('[Supabase] Não foi possível migrar a sessão local antiga; talvez seja necessário entrar novamente.', cause);
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: authStorageKey,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Exportação de tipos
export type ProfilesRow = Database['public']['Tables']['profiles']['Row'];
export type RdosRow = Database['public']['Tables']['rdos']['Row'];
export type UnidadesRow = Database['public']['Tables']['unidades']['Row'];
export type InstrumentoRow = Database['public']['Tables']['instrumentos']['Row'];
export type MateriaisRdoRow = Database['public']['Tables']['materiais_rdo']['Row'];
export type EvidenciasRdoRow = Database['public']['Tables']['evidencias_rdo']['Row'];
export type AuditoriasRdoRow = Database['public']['Tables']['auditorias_rdo']['Row'];

export async function getProfile(userId: string): Promise<ProfilesRow | null> {
  if (!userId) {
    console.warn('[getProfile] userId vazio');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[getProfile] Erro ao buscar perfil:', error.message);
      return null;
    }

    if (!data) {
      console.warn('[getProfile] Nenhum perfil encontrado para userId:', userId);
      return null;
    }

    return data as ProfilesRow;
  } catch (err) {
    console.error('[getProfile] Exceção não tratada:', err);
    return null;
  }
}

export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[getCurrentSession] Erro ao obter sessão:', error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.error('[getCurrentSession] Exceção não tratada:', err);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[getCurrentUser] Erro ao obter usuário:', error.message);
      return null;
    }
    return user;
  } catch (err) {
    console.error('[getCurrentUser] Exceção não tratada:', err);
    return null;
  }
}
