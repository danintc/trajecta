<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, clearTestDatabase, seedPopulatedDatabase } from '@/adapters/out/storage/dexie-db';
import { Transaction } from '@/core/domain/transaction.entity';
import { Asset } from '@/core/domain/asset.entity';
import { CareerRecord } from '@/core/domain/career.entity';
import HomeScreen from './adapters/in/ui/screens/HomeScreen.vue';
import TimelineScreen from './adapters/in/ui/screens/TimelineScreen.vue';
import InvestmentsScreen from './adapters/in/ui/screens/InvestmentsScreen.vue';
import CareerScreen from './adapters/in/ui/screens/CareerScreen.vue';
import AddTransactionModal from './adapters/in/ui/components/AddTransactionModal.vue';

export type ActiveTab = 'home' | 'timeline' | 'invest' | 'career';

const activeTab = ref<ActiveTab>('home');
const isPrivacyActive = ref(false);
const isAddModalOpen = ref(false);
const appMode = ref<'empty' | 'populated'>('populated');

// Estados sincronizados com IndexedDB
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

onMounted(async () => {
  await seedPopulatedDatabase();
  await loadDatabaseData();
});

// Alternar entre Clean Slate (Vazio) e Populado
async function handleToggleState(mode: 'empty' | 'populated') {
  appMode.value = mode;
  if (mode === 'empty') {
    await clearTestDatabase();
  } else {
    await seedPopulatedDatabase();
  }
  await loadDatabaseData();
}

async function handleDeleteTransaction(id: string) {
  await db.transactions.delete(id);
  await loadDatabaseData();
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-[#F4F4F5]">
    <!-- TOP BAR -->
    <header
      class="border-b border-border-subtle bg-surface/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-lg bg-accent-yellow flex items-center justify-center font-extrabold text-black text-lg shadow-sm shadow-accent-yellow/20"
        >
          T
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-base tracking-tight text-white">Trajecta</span>
            <span
              class="text-[10px] font-semibold bg-[#27272A] text-finance-neutral px-2 py-0.5 rounded-full uppercase tracking-wider"
            >
              Local-First
            </span>
          </div>
          <p class="text-xs text-[#71717A] hidden sm:block">
            Sua trajetória da carreira ao patrimônio
          </p>
        </div>
      </div>

      <!-- CONTROLES GLOBAIS -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Seletor Estado Cru vs Populado -->
        <div
          class="bg-background p-1 rounded-lg border border-border-subtle flex items-center text-xs"
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
          class="px-3 py-1.5 rounded-lg border border-border-subtle bg-background text-xs font-medium flex items-center gap-1.5 transition"
          :class="
            isPrivacyActive
              ? 'border-accent-yellow text-accent-yellow'
              : 'text-finance-neutral hover:text-white hover:border-[#3F3F46]'
          "
          @click="isPrivacyActive = !isPrivacyActive"
        >
          <span>{{ isPrivacyActive ? '🔒' : '👁️' }}</span>
          <span class="hidden sm:inline">
            {{ isPrivacyActive ? 'Privacidade Ativa' : 'Modo Privacidade' }}
          </span>
        </button>

        <!-- Botão Global (+) -->
        <button
          data-testid="fab-add-transaction"
          type="button"
          class="px-3.5 py-1.5 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-accent-yellow/20 transition transform active:scale-95"
          @click="isAddModalOpen = true"
        >
          <span class="text-sm font-black">+</span>
          <span>Lançar</span>
        </button>
      </div>
    </header>

    <!-- NAVEGAÇÃO DE 4 ABAS -->
    <nav
      class="bg-[#121215] border-b border-border-subtle px-4 lg:px-8 flex items-center gap-1 overflow-x-auto"
      role="tablist"
    >
      <button
        data-testid="nav-tab-home"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'home'"
        class="px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition"
        :class="
          activeTab === 'home'
            ? 'border-accent-yellow text-accent-yellow'
            : 'border-transparent text-finance-neutral hover:text-white'
        "
        @click="activeTab = 'home'"
      >
        <span>🏠</span> Dashboard
      </button>
      <button
        data-testid="nav-tab-timeline"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'timeline'"
        class="px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition"
        :class="
          activeTab === 'timeline'
            ? 'border-accent-yellow text-accent-yellow'
            : 'border-transparent text-finance-neutral hover:text-white'
        "
        @click="activeTab = 'timeline'"
      >
        <span>📜</span> Extrato / Timeline
      </button>
      <button
        data-testid="nav-tab-invest"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'invest'"
        class="px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition"
        :class="
          activeTab === 'invest'
            ? 'border-accent-yellow text-accent-yellow'
            : 'border-transparent text-finance-neutral hover:text-white'
        "
        @click="activeTab = 'invest'"
      >
        <span>📈</span> Investimentos
      </button>
      <button
        data-testid="nav-tab-career"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'career'"
        class="px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition"
        :class="
          activeTab === 'career'
            ? 'border-accent-yellow text-accent-yellow'
            : 'border-transparent text-finance-neutral hover:text-white'
        "
        @click="activeTab = 'career'"
      >
        <span>💼</span> Carreira & Total Cash
      </button>
    </nav>

    <!-- CONTEÚDO DA ABA ATIVA -->
    <main class="flex-1 p-4 lg:p-8 max-w-6xl mx-auto w-full">
      <HomeScreen
        v-if="activeTab === 'home'"
        :transactions="transactions"
        :assets="assets"
        :is-privacy-active="isPrivacyActive"
        @open-add-modal="isAddModalOpen = true"
        @navigate-to-timeline="activeTab = 'timeline'"
      />

      <TimelineScreen
        v-else-if="activeTab === 'timeline'"
        :transactions="transactions"
        :is-privacy-active="isPrivacyActive"
        @open-add-modal="isAddModalOpen = true"
        @delete-transaction="handleDeleteTransaction"
      />

      <InvestmentsScreen
        v-else-if="activeTab === 'invest'"
        :assets="assets"
        :is-privacy-active="isPrivacyActive"
        @refresh-data="loadDatabaseData"
      />

      <CareerScreen
        v-else-if="activeTab === 'career'"
        :career-records="careerRecords"
        :is-privacy-active="isPrivacyActive"
        @refresh-data="loadDatabaseData"
      />
    </main>

    <!-- MODAL GLOBAL (+) DE TRANSAÇÕES -->
    <AddTransactionModal
      :is-open="isAddModalOpen"
      @close="isAddModalOpen = false"
      @success="loadDatabaseData"
    />
  </div>
</template>
