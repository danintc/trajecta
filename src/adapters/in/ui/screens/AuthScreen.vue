<script setup lang="ts">
import { ref } from 'vue';
import { useAuth, type SocialAuthProvider } from '@/adapters/in/ui/composables/useAuth';

const emit = defineEmits<{
  (e: 'authenticated'): void;
}>();

const { signInWithEmail, signUpWithEmail, signInWithSocial, resetPassword, enterDemoMode } =
  useAuth();

type AuthMode = 'login' | 'register' | 'forgot';

const mode = ref<AuthMode>('login');
const fullName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isSubmitting = ref(false);
const activeSocialLoading = ref<SocialAuthProvider | null>(null);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

function switchMode(newMode: AuthMode) {
  mode.value = newMode;
  errorMessage.value = null;
  successMessage.value = null;
}

async function handleEmailSubmit() {
  errorMessage.value = null;
  successMessage.value = null;

  if (!email.value.trim() || !email.value.includes('@')) {
    errorMessage.value = 'Informe um endereço de e-mail válido.';
    return;
  }

  if (mode.value === 'forgot') {
    isSubmitting.value = true;
    try {
      const { error } = await resetPassword(email.value);
      if (error) {
        errorMessage.value = error;
      } else {
        successMessage.value =
          'Enviamos um link de recuperação para o seu e-mail. Verifique sua caixa de entrada.';
      }
    } finally {
      isSubmitting.value = false;
    }
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = 'A senha deve possuir no mínimo 6 caracteres.';
    return;
  }

  if (mode.value === 'register' && !fullName.value.trim()) {
    errorMessage.value = 'Informe seu nome para personalizar sua trajetória.';
    return;
  }

  isSubmitting.value = true;
  try {
    if (mode.value === 'login') {
      const { error } = await signInWithEmail(email.value, password.value);
      if (error) {
        errorMessage.value = error;
      } else {
        emit('authenticated');
      }
    } else {
      const { error, needsEmailConfirmation } = await signUpWithEmail(
        email.value,
        password.value,
        fullName.value
      );
      if (error) {
        errorMessage.value = error;
      } else if (needsEmailConfirmation) {
        successMessage.value =
          'Conta criada! Enviamos um link de confirmação para o seu e-mail antes do primeiro acesso.';
        mode.value = 'login';
      } else {
        emit('authenticated');
      }
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function handleSocialLogin(provider: SocialAuthProvider) {
  errorMessage.value = null;
  successMessage.value = null;
  activeSocialLoading.value = provider;

  try {
    const { error } = await signInWithSocial(provider);
    if (error) {
      errorMessage.value = error;
    }
  } finally {
    activeSocialLoading.value = null;
  }
}

function handleDemoAccess() {
  enterDemoMode();
  emit('authenticated');
}
</script>

<template>
  <div
    data-testid="screen-auth"
    class="min-h-[100dvh] bg-background text-[#F4F4F5] flex flex-col justify-between px-4 py-6 sm:px-6 lg:px-8 pt-safe pb-safe relative overflow-x-hidden"
  >
    <!-- Glow Decorativo Superior -->
    <div
      class="pointer-events-none fixed top-[-120px] left-1/2 -translate-x-1/2 w-[360px] h-[240px] bg-accent-yellow/10 blur-[110px] rounded-full"
    />

    <!-- Container Central Mobile-First -->
    <div class="w-full max-w-md mx-auto my-auto space-y-6 relative z-10">
      <!-- Identidade da Marca -->
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center gap-3 mb-1">
          <div
            class="w-11 h-11 rounded-2xl bg-accent-yellow flex items-center justify-center font-extrabold text-black text-2xl shadow-lg shadow-accent-yellow/25"
          >
            T
          </div>
          <div class="text-left">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-xl tracking-tight text-white">Trajecta</span>
              <span
                class="text-[10px] font-bold bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/30 px-2 py-0.5 rounded-full uppercase tracking-wider"
              >
                Cloud & Mobile
              </span>
            </div>
            <p class="text-xs text-[#A1A1AA]">Da sua evolução profissional à liberdade patrimonial</p>
          </div>
        </div>
      </div>

      <!-- Card Principal de Autenticação -->
      <div
        class="bg-surface/95 backdrop-blur-md border border-border-subtle rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5"
      >
        <!-- Seletor Entrar / Criar Conta -->
        <div
          v-if="mode !== 'forgot'"
          class="grid grid-cols-2 gap-1.5 p-1 bg-background rounded-2xl border border-border-subtle"
        >
          <button
            type="button"
            data-testid="auth-tab-login"
            class="py-2.5 text-xs sm:text-sm font-bold rounded-xl transition"
            :class="
              mode === 'login'
                ? 'bg-accent-yellow text-black shadow-sm'
                : 'text-finance-neutral hover:text-white'
            "
            @click="switchMode('login')"
          >
            Entrar na Conta
          </button>
          <button
            type="button"
            data-testid="auth-tab-register"
            class="py-2.5 text-xs sm:text-sm font-bold rounded-xl transition"
            :class="
              mode === 'register'
                ? 'bg-accent-yellow text-black shadow-sm'
                : 'text-finance-neutral hover:text-white'
            "
            @click="switchMode('register')"
          >
            Criar Conta Grátis
          </button>
        </div>

        <!-- Cabeçalho de Recuperação de Senha -->
        <div v-else class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h2 class="text-base font-bold text-white">Recuperar Senha</h2>
            <p class="text-xs text-finance-neutral">
              Enviaremos um link seguro para redefinir seu acesso
            </p>
          </div>
          <button
            type="button"
            class="text-xs font-semibold text-accent-yellow hover:underline"
            @click="switchMode('login')"
          >
            ← Voltar
          </button>
        </div>

        <!-- BOTÕES DE LOGIN SOCIAL (GOOGLE, APPLE, MICROSOFT, LINKEDIN) -->
        <div v-if="mode !== 'forgot'" class="space-y-2.5">
          <div class="grid grid-cols-1 gap-2.5">
            <!-- Continuar com Google -->
            <button
              type="button"
              data-testid="btn-social-google"
              :disabled="activeSocialLoading !== null"
              class="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white hover:bg-zinc-100 active:scale-[0.99] text-zinc-900 font-bold text-sm flex items-center justify-center gap-3 shadow-sm transition disabled:opacity-60"
              @click="handleSocialLogin('google')"
            >
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>
                {{ activeSocialLoading === 'google' ? 'Conectando ao Google...' : 'Continuar com Google' }}
              </span>
            </button>

            <!-- Continuar com Apple -->
            <button
              type="button"
              data-testid="btn-social-apple"
              :disabled="activeSocialLoading !== null"
              class="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#000000] hover:bg-zinc-900 border border-zinc-700 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-3 shadow-sm transition disabled:opacity-60"
              @click="handleSocialLogin('apple')"
            >
              <svg class="w-5 h-5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              <span>
                {{ activeSocialLoading === 'apple' ? 'Conectando à Apple...' : 'Continuar com Apple' }}
              </span>
            </button>
          </div>

          <!-- Linha Secundária: Microsoft & LinkedIn -->
          <div class="grid grid-cols-2 gap-2.5">
            <!-- Microsoft -->
            <button
              type="button"
              data-testid="btn-social-microsoft"
              :disabled="activeSocialLoading !== null"
              class="min-h-[46px] px-3 py-2.5 rounded-xl bg-background hover:bg-surface-hover border border-border-subtle active:scale-[0.99] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition disabled:opacity-60"
              @click="handleSocialLogin('azure')"
            >
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>{{ activeSocialLoading === 'azure' ? 'Abrindo...' : 'Microsoft' }}</span>
            </button>

            <!-- LinkedIn -->
            <button
              type="button"
              data-testid="btn-social-linkedin"
              :disabled="activeSocialLoading !== null"
              class="min-h-[46px] px-3 py-2.5 rounded-xl bg-background hover:bg-surface-hover border border-border-subtle active:scale-[0.99] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition disabled:opacity-60"
              @click="handleSocialLogin('linkedin_oidc')"
            >
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
                <path
                  d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"
                />
              </svg>
              <span>{{ activeSocialLoading === 'linkedin_oidc' ? 'Abrindo...' : 'LinkedIn' }}</span>
            </button>
          </div>
        </div>

        <!-- Divisor -->
        <div v-if="mode !== 'forgot'" class="relative flex items-center py-1">
          <div class="flex-grow border-t border-border-subtle"></div>
          <span class="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
            ou com seu e-mail
          </span>
          <div class="flex-grow border-t border-border-subtle"></div>
        </div>

        <!-- Alertas de Erro ou Sucesso -->
        <div
          v-if="errorMessage"
          data-testid="auth-error-banner"
          class="p-3.5 rounded-xl bg-finance-neg/10 border border-finance-neg/30 text-finance-neg text-xs font-medium leading-relaxed"
        >
          ⚠️ {{ errorMessage }}
        </div>

        <div
          v-if="successMessage"
          data-testid="auth-success-banner"
          class="p-3.5 rounded-xl bg-finance-pos/10 border border-finance-pos/30 text-finance-pos text-xs font-medium leading-relaxed"
        >
          ✅ {{ successMessage }}
        </div>

        <!-- Formulário de E-mail e Senha (font-size 16px no mobile para evitar auto-zoom no iOS) -->
        <form class="space-y-4" @submit.prevent="handleEmailSubmit">
          <div v-if="mode === 'register'">
            <label class="block text-xs font-semibold text-finance-neutral mb-1.5">
              Seu Nome ou Apelido
            </label>
            <input
              v-model="fullName"
              type="text"
              autocomplete="name"
              data-testid="input-auth-name"
              placeholder="Ex: Daniel Silva"
              class="w-full min-h-[46px] bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white outline-none transition"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-finance-neutral mb-1.5">
              E-mail
            </label>
            <input
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              data-testid="input-auth-email"
              placeholder="voce@exemplo.com.br"
              class="w-full min-h-[46px] bg-background border border-border-subtle focus:border-accent-yellow rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white outline-none transition"
            />
          </div>

          <div v-if="mode !== 'forgot'">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold text-finance-neutral">
                Senha
              </label>
              <button
                v-if="mode === 'login'"
                type="button"
                class="text-xs font-semibold text-accent-yellow hover:underline"
                @click="switchMode('forgot')"
              >
                Esqueceu a senha?
              </button>
            </div>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                data-testid="input-auth-password"
                placeholder="Mínimo de 6 caracteres"
                class="w-full min-h-[46px] bg-background border border-border-subtle focus:border-accent-yellow rounded-xl pl-3.5 pr-11 py-2.5 text-base sm:text-sm text-white outline-none transition"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-finance-neutral hover:text-white text-sm p-1"
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <button
            type="submit"
            data-testid="btn-auth-submit"
            :disabled="isSubmitting"
            class="w-full min-h-[48px] py-3 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover active:scale-[0.99] text-black font-extrabold text-sm shadow-lg shadow-accent-yellow/20 transition disabled:opacity-60"
          >
            <span v-if="isSubmitting">Processando...</span>
            <span v-else-if="mode === 'login'">Entrar no Trajecta</span>
            <span v-else-if="mode === 'register'">Criar Minha Conta</span>
            <span v-else>Enviar Link de Recuperação</span>
          </button>
        </form>
      </div>

      <!-- Acesso Rápido Modo Local / Demo -->
      <div class="text-center space-y-3">
        <button
          type="button"
          data-testid="btn-auth-demo"
          class="w-full py-3 px-4 rounded-2xl border border-border-subtle bg-surface/60 hover:bg-surface text-xs font-semibold text-finance-neutral hover:text-white transition flex items-center justify-center gap-2"
          @click="handleDemoAccess"
        >
          <span>⚡</span>
          <span>Explorar no Modo Local / Demonstração (Sem Login)</span>
        </button>

        <p class="text-[11px] text-[#71717A] px-4 leading-relaxed">
          Seus dados são protegidos com criptografia e isolamento por usuário (Row Level Security).
        </p>
      </div>
    </div>
  </div>
</template>
