<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { db, clearTestDatabase, seedPopulatedDatabase } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import { useAuth } from '@/adapters/in/ui/composables/useAuth';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import { CareerRecord } from '@/core/domain/career.entity';
import AuthScreen from './adapters/in/ui/screens/AuthScreen.vue';
import HomeScreen from './adapters/in/ui/screens/HomeScreen.vue';
import TimelineScreen from './adapters/in/ui/screens/TimelineScreen.vue';
import InvestmentsScreen from './adapters/in/ui/screens/InvestmentsScreen.vue';
import CareerScreen from './adapters/in/ui/screens/CareerScreen.vue';
import PhaseSimulatorScreen from './adapters/in/ui/screens/PhaseSimulatorScreen.vue';
import AddTransactionModal from './adapters/in/ui/components/AddTransactionModal.vue';

export type ActiveTab = 'home' | 'timeline' | 'invest' | 'career' | 'phase-simulator';

const {
  currentUser,
  isDemoSession,
  isAuthLoading,
  isAuthenticated,
  userDisplayName,
  userEmail,
  userInitials,
  initAuth,
  signOut,
} = useAuth();

const activeTab = ref<ActiveTab>('home');
const isPrivacyActive = ref(false);
const isAddModalOpen = ref(false);
const isUserMenuOpen = ref(false);
const isSyncingCloud = ref(false);
const transactionToEdit = ref<Transaction | null>(null);
const appMode = ref<'empty' | 'populated'>('populated');

const navItems: Array<{ key: ActiveTab; icon: string; label: string; shortLabel: string; testId: string }> = [
  { key: 'home', icon: '🏠', label: 'Dashboard', shortLabel: 'Início', testId: 'nav-tab-home' },
  {
    key: 'timeline',
    icon: '📜',
    label: 'Extrato / Timeline',
    shortLabel: 'Extrato',
    testId: 'nav-tab-timeline',
  },
  {
    key: 'invest',
    icon: '📈',
    label: 'Investimentos',
    shortLabel: 'Investir',
    testId: 'nav-tab-invest',
  },
  {
    key: 'career',
    icon: '💼',
    label: 'Carreira & Total Cash',
    shortLabel: 'Carreira',
    testId: 'nav-tab-career',
  },
  {
    key: 'phase-simulator',
    icon: '🎯',
    label: 'Simulador de Fases',
    shortLabel: 'Fases',
    testId: 'nav-tab-phase-simulator',
  },
];

function handleOpenAddModal() {
  transactionToEdit.value = null;
  isAddModalOpen.value = true;
}

function handleOpenEditModal(tx: Transaction) {
  transactionToEdit.value = tx;
  isAddModalOpen.value = true;
}

// Estados sincronizados com IndexedDB + Supabase Cloud
const transactions = ref<Transaction[]>([]);
const assets = ref<Asset[]>([]);
const careerRecords = ref<CareerRecord[]>([]);

async function loadDatabaseData() {
  await db.ensureDefaultCategories();
  const txs = await db.transactions.toArray();
  const asts = await db.assets.toArray();
  const crs = await db.careerRecords.toArray();

  transactions.value = txs;
  assets.value = asts;
  careerRecords.value = crs;
}

async function syncAndLoadWorkspace() {
  isSyncingCloud.value = true;
  try {
    const localCount = await db.transactions.count();
    if (localCount === 0 && appMode.value === 'populated') {
      await seedPopulatedDatabase();
    }

    if (currentUser.value) {
      await cloudSyncService.pullFromCloudToLocal();
    }

    await loadDatabaseData();
  } finally {
    isSyncingCloud.value = false;
  }
}

onMounted(async () => {
  await seedPopulatedDatabase();
  await loadDatabaseData();
  await initAuth();
  if (currentUser.value) {
    await syncAndLoadWorkspace();
  }
});

watch(
  () => currentUser.value?.id,
  async (newUserId) => {
    if (newUserId) {
      await syncAndLoadWorkspace();
    }
  }
);

// Alternar entre Clean Slate (Vazio) e Populado
async function handleToggleState(mode: 'empty' | 'populated') {
  appMode.value = mode;
  isSyncingCloud.value = true;
  try {
    if (mode === 'empty') {
      await clearTestDatabase();
    } else {
      await seedPopulatedDatabase();
    }
    await cloudSyncService.pushAllLocalToCloud();
    await loadDatabaseData();
  } finally {
    isSyncingCloud.value = false;
    isUserMenuOpen.value = false;
  }
}

async function handleDeleteTransaction(id: string) {
  await db.transactions.delete(id);
  await cloudSyncService.deleteTransaction(id);
  await loadDatabaseData();
}

async function handleLogout() {
  isUserMenuOpen.value = false;
  await signOut();
}
</script>

<template>
  <!-- TELA DE CARREGAMENTO DE SESSÃO -->
  <div
    v-if="isAuthLoading"
    class="min-h-[100dvh] bg-background text-[#F4F4F5] flex flex-col items-center justify-center p-6 gap-3"
  >
    <div
      class="w-11 h-11 rounded-2xl bg-accent-yellow flex items-center justify-center font-extrabold text-black text-xl animate-pulse"
    >
      T
    </div>
    <p class="text-xs font-medium text-finance-neutral">Carregando sua trajetória...</p>
  </div>

  <!-- TELA DE LOGIN / CADASTRO (QUANDO NÃO AUTENTICADO) -->
  <AuthScreen
    v-else-if="!isAuthenticated"
    @authenticated="syncAndLoadWorkspace"
  />

  <!-- APLICAÇÃO PRINCIPAL (MOBILE-FIRST & CLOUD SYNC) -->
  <div v-else class="min-h-[100dvh] flex flex-col bg-background text-[#F4F4F5] overflow-x-hidden">
    <!-- TOP BAR -->
    <header
      class="border-b border-border-subtle bg-surface/95 backdrop-blur-md sticky top-0 z-40 px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 pt-safe flex items-center justify-between gap-2"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-8 h-8 shrink-0 rounded-lg bg-accent-yellow flex items-center justify-center font-extrabold text-black text-base shadow-sm shadow-accent-yellow/20"
        >
          T
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-sm sm:text-base tracking-tight text-white truncate">
              Trajecta
            </span>
            <span
              class="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
              :class="
                currentUser
                  ? 'bg-finance-pos/15 text-finance-pos border border-finance-pos/30'
                  : 'bg-[#27272A] text-finance-neutral'
              "
            >
              {{ isSyncingCloud ? 'Sincronizando...' : currentUser ? 'Cloud Sync' : 'Local Demo' }}
            </span>
          </div>
          <p class="text-xs text-[#71717A] hidden sm:block truncate">
            Sua trajetória da carreira ao patrimônio
          </p>
        </div>
      </div>

      <!-- CONTROLES GLOBAIS -->
      <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <!-- Seletor Estado Cru vs Populado (Visível direto no Desktop; no Mobile fica no menu de perfil) -->
        <div
          class="hidden lg:flex bg-background p-1 rounded-lg border border-border-subtle items-center text-xs"
        >
          <button
            type="button"
            class="px-2.5 py-1 rounded font-medium transition"
            :class="
              appMode === 'populated'
                ? 'bg-surface-hover text-white'
                : 'text-finance-neutral hover:text-white'
            "
            @click="handleToggleState('populated')"
          >
            Populado
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-medium transition"
            :class="
              appMode === 'empty'
                ? 'bg-surface-hover text-white'
                : 'text-finance-neutral hover:text-white'
            "
            @click="handleToggleState('empty')"
          >
            Clean Slate (Vazio)
          </button>
        </div>

        <!-- Toggle Modo Privacidade -->
        <button
          data-testid="privacy-toggle"
          type="button"
          class="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-border-subtle bg-background text-xs font-medium flex items-center gap-1.5 transition"
          :class="
            isPrivacyActive
              ? 'border-accent-yellow text-accent-yellow'
              : 'text-finance-neutral hover:text-white hover:border-[#3F3F46]'
          "
          :aria-label="isPrivacyActive ? 'Desativar modo privacidade' : 'Ativar modo privacidade'"
          @click="isPrivacyActive = !isPrivacyActive"
        >
          <span>{{ isPrivacyActive ? '🔒' : '👁️' }}</span>
          <span class="hidden md:inline">
            {{ isPrivacyActive ? 'Privacidade Ativa' : 'Modo Privacidade' }}
          </span>
        </button>

        <!-- Botão Global (+) — Visível no topo apenas no Desktop (no Mobile fica em destaque na barra inferior estilo Money Tracker) -->
        <button
          data-testid="fab-add-transaction"
          type="button"
          class="hidden md:flex min-h-[36px] px-3.5 py-1.5 rounded-xl bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs items-center gap-1.5 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
          @click="handleOpenAddModal"
        >
          <span class="text-sm font-black leading-none">+</span>
          <span>Lançar</span>
        </button>

        <!-- Menu de Perfil & Opções Mobile -->
        <div class="relative">
          <button
            type="button"
            data-testid="btn-user-menu"
            class="w-9 h-9 rounded-xl bg-background border border-border-subtle hover:border-accent-yellow/60 text-xs font-extrabold text-accent-yellow flex items-center justify-center transition"
            aria-label="Menu da conta"
            @click="isUserMenuOpen = !isUserMenuOpen"
          >
            {{ userInitials }}
          </button>

          <!-- Dropdown / Popover de Conta -->
          <div
            v-if="isUserMenuOpen"
            class="fixed inset-0 z-40"
            @click="isUserMenuOpen = false"
          />
          <div
            v-if="isUserMenuOpen"
            data-testid="user-menu-dropdown"
            class="absolute right-0 mt-2 w-72 rounded-2xl bg-surface border border-border-subtle shadow-2xl p-4 z-50 space-y-3"
          >
            <div class="border-b border-border-subtle pb-3">
              <div class="text-xs font-bold text-white truncate">{{ userDisplayName }}</div>
              <div class="text-[11px] text-finance-neutral truncate">{{ userEmail }}</div>
              <div class="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold">
                <span
                  class="w-2 h-2 rounded-full"
                  :class="currentUser ? 'bg-finance-pos' : 'bg-accent-yellow'"
                />
                <span class="text-finance-neutral">
                  {{
                    currentUser
                      ? 'Sincronizado com Supabase Cloud'
                      : isDemoSession
                        ? 'Sessão de Demonstração Local'
                        : 'Armazenamento Local'
                  }}
                </span>
              </div>
            </div>

            <!-- Controle de Base de Dados (Essencial para Mobile onde o toggle superior fica oculto) -->
            <div class="space-y-1.5">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                Modo da Base de Dados
              </span>
              <div class="grid grid-cols-2 gap-1.5 p-1 bg-background rounded-xl border border-border-subtle text-xs">
                <button
                  type="button"
                  class="py-1.5 rounded-lg font-semibold transition"
                  :class="
                    appMode === 'populated'
                      ? 'bg-surface-hover text-white'
                      : 'text-finance-neutral hover:text-white'
                  "
                  @click="handleToggleState('populated')"
                >
                  Populado
                </button>
                <button
                  type="button"
                  class="py-1.5 rounded-lg font-semibold transition"
                  :class="
                    appMode === 'empty'
                      ? 'bg-surface-hover text-white'
                      : 'text-finance-neutral hover:text-white'
                  "
                  @click="handleToggleState('empty')"
                >
                  Vazio (Zero)
                </button>
              </div>
            </div>

            <div class="pt-2 border-t border-border-subtle">
              <button
                type="button"
                data-testid="btn-logout"
                class="w-full py-2 px-3 rounded-xl bg-finance-neg/10 hover:bg-finance-neg/20 border border-finance-neg/25 text-finance-neg text-xs font-bold flex items-center justify-center gap-2 transition"
                @click="handleLogout"
              >
                <span>🚪</span>
                <span>{{ currentUser ? 'Sair da Conta' : 'Voltar para Tela de Login' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- NAVEGAÇÃO SUPERIOR (APENAS DESKTOP / TABLET >= md) -->
    <nav
      class="hidden md:flex bg-[#121215] border-b border-border-subtle px-4 lg:px-8 items-center gap-1 overflow-x-auto no-scrollbar"
      role="tablist"
      aria-label="Navegação Principal Desktop"
    >
      <button
        v-for="item in navItems"
        :key="item.key"
        :data-testid="item.testId"
        type="button"
        role="tab"
        :aria-selected="activeTab === item.key"
        class="px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition"
        :class="
          activeTab === item.key
            ? 'border-accent-yellow text-accent-yellow'
            : 'border-transparent text-finance-neutral hover:text-white'
        "
        @click="activeTab = item.key"
      >
        <span>{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <!-- CONTEÚDO DA ABA ATIVA (Com espaçamento inferior seguro para a Bottom Bar no iOS Mobile) -->
    <main class="flex-1 px-3 sm:px-5 lg:px-8 py-4 sm:py-6 pb-safe-nav md:pb-8 max-w-7xl mx-auto w-full">
      <HomeScreen
        v-if="activeTab === 'home'"
        :transactions="transactions"
        :assets="assets"
        :is-privacy-active="isPrivacyActive"
        @open-add-modal="handleOpenAddModal"
        @navigate-to-timeline="activeTab = 'timeline'"
        @navigate-to-invest="activeTab = 'invest'"
        @navigate-to-career="activeTab = 'career'"
        @navigate-to-simulator="activeTab = 'phase-simulator'"
      />

      <TimelineScreen
        v-else-if="activeTab === 'timeline'"
        :transactions="transactions"
        :is-privacy-active="isPrivacyActive"
        @open-add-modal="handleOpenAddModal"
        @edit-transaction="handleOpenEditModal"
        @delete-transaction="handleDeleteTransaction"
      />

      <InvestmentsScreen
        v-else-if="activeTab === 'invest'"
        :assets="assets"
        :is-privacy-active="isPrivacyActive"
        @refresh-data="loadDatabaseData"
        @navigate-to-simulator="activeTab = 'phase-simulator'"
        @navigate-to-timeline="activeTab = 'timeline'"
      />

      <CareerScreen
        v-else-if="activeTab === 'career'"
        :career-records="careerRecords"
        :is-privacy-active="isPrivacyActive"
        @refresh-data="loadDatabaseData"
        @navigate-to-simulator="activeTab = 'phase-simulator'"
        @navigate-to-timeline="activeTab = 'timeline'"
      />

      <PhaseSimulatorScreen
        v-else-if="activeTab === 'phase-simulator'"
        :assets="assets"
        :career-records="careerRecords"
        :transactions="transactions"
        :is-privacy-active="isPrivacyActive"
        @navigate-to-invest="activeTab = 'invest'"
        @navigate-to-career="activeTab = 'career'"
        @navigate-to-timeline="activeTab = 'timeline'"
      />
    </main>

    <!-- BOTTOM NAVIGATION BAR NATIVA COM BOTÃO (+) CENTRAL EM EVIDÊNCIA (ESTILO MONEY TRACKER) -->
    <nav
      data-testid="mobile-bottom-nav"
      class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#121215]/95 backdrop-blur-xl border-t border-border-subtle px-1 pt-1.5 pb-safe grid grid-cols-6 items-center"
      role="tablist"
      aria-label="Navegação Mobile"
    >
      <!-- Abas Esquerda (Início, Extrato) -->
      <button
        v-for="item in navItems.slice(0, 2)"
        :key="`mob-${item.key}`"
        :data-testid="`mobile-${item.testId}`"
        type="button"
        role="tab"
        :aria-selected="activeTab === item.key"
        class="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition relative min-w-0"
        :class="
          activeTab === item.key
            ? 'text-accent-yellow font-bold'
            : 'text-finance-neutral hover:text-white font-medium'
        "
        @click="activeTab = item.key"
      >
        <span
          v-if="activeTab === item.key"
          class="absolute top-0 w-5 h-0.5 rounded-full bg-accent-yellow"
        />
        <span class="text-base leading-none mb-1">{{ item.icon }}</span>
        <span class="text-[10px] tracking-tight truncate max-w-full">{{ item.shortLabel }}</span>
      </button>

      <!-- BOTÃO (+) ÚNICO E EVIDENTE DE LANÇAMENTO (ESTILO MONEY TRACKER) -->
      <div class="col-span-1 flex flex-col items-center justify-center relative">
        <button
          data-testid="mobile-fab-add-transaction"
          type="button"
          aria-label="Novo Lançamento"
          title="Novo Lançamento"
          class="w-12 h-12 -mt-5 rounded-full bg-accent-yellow hover:bg-accent-yellow-hover text-black shadow-lg shadow-accent-yellow/30 border-4 border-[#121215] flex items-center justify-center transition transform active:scale-95 cursor-pointer"
          @click="handleOpenAddModal"
        >
          <span class="text-2xl font-light leading-none select-none">+</span>
        </button>
        <span class="text-[9px] font-bold text-accent-yellow tracking-tight mt-0.5">Lançar</span>
      </div>

      <!-- Abas Direita (Investir, Carreira, Fases) -->
      <button
        v-for="item in navItems.slice(2)"
        :key="`mob-${item.key}`"
        :data-testid="`mobile-${item.testId}`"
        type="button"
        role="tab"
        :aria-selected="activeTab === item.key"
        class="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition relative min-w-0"
        :class="
          activeTab === item.key
            ? 'text-accent-yellow font-bold'
            : 'text-finance-neutral hover:text-white font-medium'
        "
        @click="activeTab = item.key"
      >
        <span
          v-if="activeTab === item.key"
          class="absolute top-0 w-5 h-0.5 rounded-full bg-accent-yellow"
        />
        <span class="text-base leading-none mb-1">{{ item.icon }}</span>
        <span class="text-[10px] tracking-tight truncate max-w-full">{{ item.shortLabel }}</span>
      </button>
    </nav>

    <!-- MODAL GLOBAL (+) DE TRANSAÇÕES -->
    <AddTransactionModal
      :is-open="isAddModalOpen"
      :transaction-to-edit="transactionToEdit"
      @close="
        isAddModalOpen = false;
        transactionToEdit = null;
      "
      @success="loadDatabaseData"
    />
  </div>
</template>
