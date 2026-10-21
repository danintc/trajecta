import { ref, computed } from 'vue';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/adapters/out/supabase/supabase-client';

export type SocialAuthProvider = 'google' | 'apple' | 'azure' | 'linkedin_oidc';

const currentUser = ref<User | null>(null);
const currentSession = ref<Session | null>(null);
const isDemoSession = ref<boolean>(false);
const isAuthLoading = ref<boolean>(true);
let authSubscriptionInitialized = false;

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(currentUser.value));

  const userDisplayName = computed(() => {
    if (isDemoSession.value) return 'Visitante (Modo Local)';
    if (!currentUser.value) return '';
    const meta = currentUser.value.user_metadata;
    return (
      meta?.full_name ||
      meta?.name ||
      currentUser.value.email?.split('@')[0] ||
      'Investidor Trajecta'
    );
  });

  const userEmail = computed(() => {
    if (isDemoSession.value) return 'Dados salvos apenas neste aparelho';
    return currentUser.value?.email || '';
  });

  const userInitials = computed(() => {
    const name = userDisplayName.value.trim();
    if (!name) return 'TJ';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  async function initAuth(): Promise<void> {
    if (!isSupabaseConfigured) {
      isAuthLoading.value = false;
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      currentSession.value = data.session;
      currentUser.value = data.session?.user ?? null;

      if (!authSubscriptionInitialized) {
        authSubscriptionInitialized = true;
        supabase.auth.onAuthStateChange((_event, session) => {
          currentSession.value = session;
          currentUser.value = session?.user ?? null;
          if (session?.user) {
            isDemoSession.value = false;
          }
        });
      }
    } catch {
      // Em ambiente de testes unitários ou offline, mantém estado seguro
    } finally {
      isAuthLoading.value = false;
    }
  }

  async function signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: translateAuthError(error.message) };
    }

    currentSession.value = data.session;
    currentUser.value = data.user;
    isDemoSession.value = false;
    return { error: null };
  }

  async function signUpWithEmail(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      return { error: translateAuthError(error.message), needsEmailConfirmation: false };
    }

    if (data.session) {
      currentSession.value = data.session;
      currentUser.value = data.user;
      isDemoSession.value = false;
      return { error: null, needsEmailConfirmation: false };
    }

    return { error: null, needsEmailConfirmation: true };
  }

  async function signInWithSocial(provider: SocialAuthProvider): Promise<{ error: string | null }> {
    const providerLabels: Record<SocialAuthProvider, string> = {
      google: 'Google',
      apple: 'Apple',
      azure: 'Microsoft',
      linkedin_oidc: 'LinkedIn',
    };

    if (provider !== 'google') {
      return {
        error: `O login com ${providerLabels[provider]} ainda não está disponível.`,
      };
    }

    // Verifica antes de redirecionar se o provedor está ativo
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

      if (supabaseUrl && supabaseAnonKey) {
        const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: supabaseAnonKey },
        });

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings?.external && settings.external[provider] === false) {
            return {
              error: `O login com ${providerLabels[provider]} ainda não está disponível.`,
            };
          }
        }
      }
    } catch {
      // Prossegue para o fluxo padrão caso offline
    }

    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      return { error: translateAuthError(error.message) };
    }

    return { error: null };
  }

  async function resetPassword(email: string): Promise<{ error: string | null }> {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      return { error: translateAuthError(error.message) };
    }
    return { error: null };
  }

  function enterDemoMode(): void {
    isDemoSession.value = true;
  }

  async function signOut(): Promise<void> {
    isDemoSession.value = false;
    currentUser.value = null;
    currentSession.value = null;
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  }

  return {
    currentUser,
    currentSession,
    isDemoSession,
    isAuthLoading,
    isAuthenticated,
    userDisplayName,
    userEmail,
    userInitials,
    initAuth,
    signInWithEmail,
    signUpWithEmail,
    signInWithSocial,
    resetPassword,
    enterDemoMode,
    signOut,
  };
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados ou crie uma conta.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }
  if (lower.includes('user already registered')) {
    return 'Este e-mail já está cadastrado. Tente fazer login.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (lower.includes('provider is not enabled')) {
    return 'Este método de login ainda não está disponível.';
  }
  return message;
}
