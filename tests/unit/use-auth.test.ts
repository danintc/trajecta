import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '@/adapters/in/ui/composables/useAuth';
import { supabase } from '@/adapters/out/supabase/supabase-client';

describe('useAuth Composable', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    const auth = useAuth();
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });
    await auth.signOut();
  });

  it('deve ativar o modo demonstração local e exibir dados de visitante', () => {
    const auth = useAuth();

    expect(auth.isDemoSession.value).toBe(false);
    expect(auth.userInitials.value).toBe('TJ');

    auth.enterDemoMode();

    expect(auth.isDemoSession.value).toBe(true);
    expect(auth.userDisplayName.value).toBe('Visitante (Modo Local)');
    expect(auth.userEmail.value).toBe('Dados salvos apenas neste aparelho');
    expect(auth.userInitials.value).toBe('VL');
  });

  it('deve traduzir mensagens de erro de autenticação do Supabase para português', async () => {
    const auth = useAuth();

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as any,
    });

    const res1 = await auth.signInWithEmail('user@example.com', 'wrongpass');
    expect(res1.error).toBe(
      'E-mail ou senha incorretos. Verifique seus dados ou crie uma conta.'
    );

    vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered' } as any,
    });

    const res2 = await auth.signUpWithEmail('user@example.com', '123456', 'Daniel');
    expect(res2.error).toBe('Este e-mail já está cadastrado. Tente fazer login.');
  });

  it('deve bloquear provedores sociais ainda não suportados (Apple, Microsoft, LinkedIn)', async () => {
    const auth = useAuth();

    const appleRes = await auth.signInWithSocial('apple');
    expect(appleRes.error).toContain('O login com Apple ainda não está disponível.');

    const msRes = await auth.signInWithSocial('azure');
    expect(msRes.error).toContain('O login com Microsoft ainda não está disponível.');
  });
});
