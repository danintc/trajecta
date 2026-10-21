<script setup lang="ts">
import { computed } from 'vue';
import { WealthPhase, WealthPhaseGuidelines } from '@/core/domain/wealth-phase.entity';

export interface WealthPhaseGaugeProps {
  currentPhase: WealthPhase;
  currentRatioPercent: number;
  guidelines: WealthPhaseGuidelines;
  savingsRatePercent: number;
}

const props = defineProps<WealthPhaseGaugeProps>();

const emit = defineEmits<{
  (e: 'navigateToInvest'): void;
  (e: 'navigateToCareer'): void;
  (e: 'navigateToTrajectories'): void;
}>();

// Posição percentual do marcador na barra (0 a 100%)
// Zona 1 (Manutenção): 0 a 5% -> ocupa 33.3% da barra
// Zona 2 (Transição): 5 a 20% -> ocupa 33.3% a 66.6% da barra
// Zona 3 (Construção): > 20% -> ocupa 66.6% a 100% da barra (saturando em 60%)
const pinPositionPercent = computed(() => {
  const r = props.currentRatioPercent;
  if (r <= 5) {
    return Math.max(3, Math.min(33, (r / 5) * 33));
  }
  if (r <= 20) {
    return 33.3 + ((r - 5) / 15) * 33.3;
  }
  const excess = Math.min(40, r - 20);
  return Math.min(97, 66.6 + (excess / 40) * 33.4);
});

const phaseTheme = computed(() => {
  switch (props.currentPhase) {
    case 'CONSTRUCTION':
      return {
        border: 'border-finance-invest/40',
        bg: 'bg-finance-invest/10',
        text: 'text-finance-invest',
        badge: 'bg-finance-invest text-black',
        accentBar: 'bg-finance-invest',
      };
    case 'TRANSITION':
      return {
        border: 'border-accent-yellow/40',
        bg: 'bg-accent-yellow/10',
        text: 'text-accent-yellow',
        badge: 'bg-accent-yellow text-black',
        accentBar: 'bg-accent-yellow',
      };
    case 'MAINTENANCE':
      return {
        border: 'border-finance-pos/40',
        bg: 'bg-finance-pos/10',
        text: 'text-finance-pos',
        badge: 'bg-finance-pos text-black',
        accentBar: 'bg-finance-pos',
      };
  }
});
</script>

<template>
  <div class="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6 space-y-5 h-full flex flex-col justify-between">
    <!-- TOPO: DIAGNÓSTICO & BADGE SEM QUEBRA DE LINHA -->
    <div class="space-y-3 border-b border-border-subtle pb-4">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-bold text-finance-neutral uppercase tracking-wider whitespace-nowrap">
          Diagnóstico de Alavanca
        </span>
        <span
          class="text-[11px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wide transition whitespace-nowrap shrink-0 shadow-sm"
          :class="phaseTheme.badge"
        >
          Fase: {{ guidelines.name }}
        </span>
      </div>

      <h2 class="text-base sm:text-lg font-extrabold text-white leading-snug">
        {{ guidelines.tagline }}
      </h2>

      <!-- KPIs de Diagnóstico Lado a Lado Aproveitando 100% da Largura -->
      <div class="grid grid-cols-2 gap-2.5 pt-1">
        <div class="bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
          <span class="text-[10px] text-[#71717A] font-semibold uppercase tracking-wide whitespace-nowrap truncate">
            Razão Aporte / Patrimônio
          </span>
          <div class="text-lg sm:text-xl font-extrabold font-mono text-white mt-0.5 whitespace-nowrap">
            {{ currentRatioPercent }}%
          </div>
        </div>

        <div class="bg-background border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
          <span class="text-[10px] text-[#71717A] font-semibold uppercase tracking-wide whitespace-nowrap truncate">
            Taxa de Poupança
          </span>
          <div class="text-lg sm:text-xl font-extrabold font-mono text-accent-yellow mt-0.5 whitespace-nowrap">
            {{ savingsRatePercent }}% <span class="text-[11px] text-[#71717A] font-sans font-normal">da renda</span>
          </div>
        </div>
      </div>
    </div>

    <!-- RÉGUA / GAUGE VISUAL DAS 3 FASES (ALINHAMENTO PRECISO SEM COLISÃO DE LABELS) -->
    <div class="space-y-2">
      <!-- Marcadores de Fronteira alinhados às divisões de 33.3% e 66.6% -->
      <div class="relative h-4 text-[10px] font-mono font-bold text-[#A1A1AA] select-none">
        <span class="absolute left-0 whitespace-nowrap">0%</span>
        <span class="absolute left-1/3 -translate-x-1/2 whitespace-nowrap text-finance-pos">5% (Manutenção)</span>
        <span class="absolute left-2/3 -translate-x-1/2 whitespace-nowrap text-accent-yellow">20% (Transição)</span>
        <span class="absolute right-0 whitespace-nowrap text-finance-invest">+40%</span>
      </div>

      <div class="relative w-full h-6 bg-background rounded-full overflow-visible border border-border-subtle flex shadow-inner">
        <!-- Zona Manutenção (< 5%) -->
        <div
          class="h-full rounded-l-full bg-finance-pos/25 border-r border-border-subtle/80 transition flex items-center justify-center text-[10px] font-extrabold text-finance-pos whitespace-nowrap"
          style="width: 33.33%"
          title="Manutenção (< 5%)"
        >
          Manutenção
        </div>

        <!-- Zona Transição (5% a 20%) -->
        <div
          class="h-full bg-accent-yellow/25 border-r border-border-subtle/80 transition flex items-center justify-center text-[10px] font-extrabold text-accent-yellow whitespace-nowrap"
          style="width: 33.33%"
          title="Transição (5% a 20%)"
        >
          Transição
        </div>

        <!-- Zona Construção (> 20%) -->
        <div
          class="h-full rounded-r-full bg-finance-invest/25 transition flex items-center justify-center text-[10px] font-extrabold text-finance-invest whitespace-nowrap"
          style="width: 33.34%"
          title="Construção (> 20%)"
        >
          Construção
        </div>

        <!-- Marcador / Pino da Posição Atual -->
        <div
          class="absolute -top-1.5 -bottom-1.5 w-5 -ml-2.5 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-500 z-10"
          :class="phaseTheme.accentBar"
          :style="{ left: `${pinPositionPercent}%` }"
        >
          <div class="w-1.5 h-1.5 bg-black rounded-full" />
        </div>
      </div>

      <!-- Subtítulos das 3 Zonas em Grid Simétrico de 3 Colunas -->
      <div class="grid grid-cols-3 gap-1 text-[10px] text-[#71717A] pt-1 text-center">
        <span class="truncate">Piloto Automático</span>
        <span class="truncate">Equilíbrio & Qualidade</span>
        <span class="truncate">Foco em Aporte</span>
      </div>
    </div>

    <!-- MATRIZ DOS 3 PILARES INTERATIVOS -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
      <!-- Pilar 1: Aporte -->
      <div
        role="button"
        tabindex="0"
        class="bg-background rounded-xl p-3.5 border transition cursor-pointer hover:border-finance-career/60 group flex flex-col justify-between gap-2"
        :class="guidelines.aportePriority === 'MUITO_ALTA' ? 'border-finance-invest/60 bg-finance-invest/5' : 'border-border-subtle'"
        @click="emit('navigateToCareer')"
      >
        <div class="flex justify-between items-center gap-1.5">
          <span class="text-xs text-[#A1A1AA] font-semibold whitespace-nowrap">1. Aumentar Aportes</span>
          <span
            class="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase whitespace-nowrap shrink-0"
            :class="{
              'bg-finance-invest/20 text-finance-invest': guidelines.aportePriority === 'MUITO_ALTA',
              'bg-accent-yellow/20 text-accent-yellow': guidelines.aportePriority === 'MEDIA',
              'bg-[#27272A] text-finance-neutral': guidelines.aportePriority === 'QUASE_NULA',
            }"
          >
            {{ guidelines.aportePriority.replace('_', ' ') }}
          </span>
        </div>
        <p class="text-xs text-white/90 font-medium leading-relaxed">
          {{
            currentPhase === 'CONSTRUCTION'
              ? 'Alavanca principal: ganhe mais e poupe com disciplina.'
              : currentPhase === 'TRANSITION'
              ? 'Importância média: continue poupando sem exageros.'
              : 'Impacto quase nulo: novos aportes não mudam o futuro.'
          }}
        </p>
        <span class="text-[10px] text-finance-career font-semibold group-hover:underline flex items-center gap-1">
          Ver Carreira & Renda →
        </span>
      </div>

      <!-- Pilar 2: Rentabilidade / Investir Melhor -->
      <div
        role="button"
        tabindex="0"
        class="bg-background rounded-xl p-3.5 border transition cursor-pointer hover:border-finance-invest/60 group flex flex-col justify-between gap-2"
        :class="guidelines.investingBetterPriority === 'MUITO_ALTA' || guidelines.investingBetterPriority === 'ALTA' ? 'border-accent-yellow/60 bg-accent-yellow/5' : 'border-border-subtle'"
        @click="emit('navigateToInvest')"
      >
        <div class="flex justify-between items-center gap-1.5">
          <span class="text-xs text-[#A1A1AA] font-semibold whitespace-nowrap">2. Investir Melhor</span>
          <span
            class="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase whitespace-nowrap shrink-0"
            :class="{
              'bg-accent-yellow/20 text-accent-yellow': guidelines.investingBetterPriority === 'ALTA',
              'bg-finance-pos/20 text-finance-pos': guidelines.investingBetterPriority === 'MUITO_ALTA',
              'bg-[#27272A] text-finance-neutral': guidelines.investingBetterPriority === 'MEDIA',
            }"
          >
            {{ guidelines.investingBetterPriority.replace('_', ' ') }}
          </span>
        </div>
        <p class="text-xs text-white/90 font-medium leading-relaxed">
          {{
            currentPhase === 'CONSTRUCTION'
              ? 'Simplicidade: evite erros graves; alfa gera pouco dinheiro.'
              : currentPhase === 'TRANSITION'
              ? 'Alta relevância: balanceamento e diversificação global.'
              : 'Prioridade máxima: preservação contra inflação e volatilidade.'
          }}
        </p>
        <span class="text-[10px] text-finance-invest font-semibold group-hover:underline flex items-center gap-1">
          Ver Carteira →
        </span>
      </div>

      <!-- Pilar 3: Usufruir / Consumir a Renda -->
      <div
        role="button"
        tabindex="0"
        class="bg-background rounded-xl p-3.5 border transition cursor-pointer hover:border-finance-pos/60 group flex flex-col justify-between gap-2"
        :class="guidelines.enjoymentPriority === 'MUITO_ALTA' ? 'border-finance-pos/60 bg-finance-pos/5' : 'border-border-subtle'"
        @click="emit('navigateToTrajectories')"
      >
        <div class="flex justify-between items-center gap-1.5">
          <span class="text-xs text-[#A1A1AA] font-semibold whitespace-nowrap">3. Usufruir da Renda</span>
          <span
            class="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase whitespace-nowrap shrink-0"
            :class="{
              'bg-finance-pos/20 text-finance-pos': guidelines.enjoymentPriority === 'MUITO_ALTA',
              'bg-accent-yellow/20 text-accent-yellow': guidelines.enjoymentPriority === 'MEDIA',
              'bg-[#27272A] text-finance-neutral': guidelines.enjoymentPriority === 'BAIXA',
            }"
          >
            {{ guidelines.enjoymentPriority.replace('_', ' ') }}
          </span>
        </div>
        <p class="text-xs text-white/90 font-medium leading-relaxed">
          {{
            currentPhase === 'CONSTRUCTION'
              ? 'Consumo dosado: poupar agora compra sua liberdade futura.'
              : currentPhase === 'TRANSITION'
              ? 'Dose tempo e dinheiro: não abra mão de família e saúde.'
              : 'Liberdade plena: consuma e viva sem culpa!'
          }}
        </p>
        <span class="text-[10px] text-finance-pos font-semibold group-hover:underline flex items-center gap-1">
          Simular Curvas →
        </span>
      </div>
    </div>

    <!-- REFLEXÃO CENTRAL -->
    <div class="bg-background/80 border border-border-subtle rounded-xl p-3.5 flex items-start gap-3">
      <div class="text-xl select-none shrink-0">💧</div>
      <div class="space-y-1 min-w-0">
        <h4 class="text-[11px] font-bold text-accent-yellow uppercase tracking-wider">
          A Analogia do Copo d'Água & Utilidade Marginal
        </h4>
        <p class="text-xs text-white/90 leading-relaxed">
          {{ guidelines.waterGlassAnalogy }}
        </p>
      </div>
    </div>
  </div>
</template>
