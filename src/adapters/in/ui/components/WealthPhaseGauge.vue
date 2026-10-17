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

// Posição percentual do marcador na barra (0 a 100%)
// Zona 1 (Manutenção): 0 a 5% -> ocupa 33% da barra
// Zona 2 (Transição): 5 a 20% -> ocupa 33% a 66% da barra
// Zona 3 (Construção): > 20% -> ocupa 66% a 100% da barra (saturando em 60%)
const pinPositionPercent = computed(() => {
  const r = props.currentRatioPercent;
  if (r <= 5) {
    return Math.min(33, (r / 5) * 33);
  }
  if (r <= 20) {
    return 33 + ((r - 5) / 15) * 33;
  }
  // r > 20
  const excess = Math.min(40, r - 20); // de 20% até 60%
  return 66 + (excess / 40) * 34;
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
  <div class="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-finance-neutral uppercase tracking-wider">
            Diagnóstico de Alavanca
          </span>
          <span
            class="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide transition"
            :class="phaseTheme.badge"
          >
            Fase: {{ guidelines.name }}
          </span>
        </div>
        <h2 class="text-lg font-bold text-white mt-1">
          {{ guidelines.tagline }}
        </h2>
      </div>

      <div class="flex items-center gap-3 bg-background border border-border-subtle rounded-xl px-3.5 py-2">
        <div class="text-right">
          <span class="text-[10px] text-[#71717A] block">Razão Aporte / Patrimônio</span>
          <span class="text-base font-bold font-mono text-white">
            {{ currentRatioPercent }}%
          </span>
        </div>
        <div class="w-px h-8 bg-border-subtle" />
        <div>
          <span class="text-[10px] text-[#71717A] block">Taxa de Poupança</span>
          <span class="text-base font-bold font-mono text-accent-yellow">
            {{ savingsRatePercent }}% <span class="text-[10px] text-[#71717A] font-normal">da renda</span>
          </span>
        </div>
      </div>
    </div>

    <!-- RÉGUA / GAUGE VISUAL DAS 3 FASES -->
    <div class="space-y-2">
      <div class="flex justify-between text-[11px] font-semibold text-[#71717A]">
        <span>0%</span>
        <span>5% (Fronteira Manutenção)</span>
        <span>20% (Fronteira Transição)</span>
        <span>+40%</span>
      </div>

      <div class="relative w-full h-4 bg-background rounded-full overflow-visible border border-border-subtle flex">
        <!-- Zona Manutenção (< 5%) -->
        <div
          class="h-full rounded-l-full bg-finance-pos/30 border-r border-border-subtle transition flex items-center justify-center text-[9px] font-bold text-finance-pos"
          style="width: 33.3%"
          title="Manutenção (< 5%)"
        >
          Manutenção
        </div>

        <!-- Zona Transição (5% a 20%) -->
        <div
          class="h-full bg-accent-yellow/30 border-r border-border-subtle transition flex items-center justify-center text-[9px] font-bold text-accent-yellow"
          style="width: 33.3%"
          title="Transição (5% a 20%)"
        >
          Transição
        </div>

        <!-- Zona Construção (> 20%) -->
        <div
          class="h-full rounded-r-full bg-finance-invest/30 transition flex items-center justify-center text-[9px] font-bold text-finance-invest"
          style="width: 33.4%"
          title="Construção (> 20%)"
        >
          Construção
        </div>

        <!-- Marcador / Pino da Posição Atual -->
        <div
          class="absolute -top-1.5 -bottom-1.5 w-4 -ml-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-500"
          :class="phaseTheme.accentBar"
          :style="{ left: `${pinPositionPercent}%` }"
        >
          <div class="w-1.5 h-1.5 bg-black rounded-full" />
        </div>
      </div>

      <div class="flex justify-between text-[10px] text-[#71717A] pt-1">
        <span>Usufruto & Piloto Automático</span>
        <span>Equilíbrio & Qualidade</span>
        <span>Foco Máximo em Aporte</span>
      </div>
    </div>

    <!-- MATRIZ DOS 3 PILARES: APORTE vs INVESTIR MELHOR vs USUFRUTO -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
      <!-- Pilar 1: Aporte -->
      <div
        class="bg-background rounded-xl p-3.5 border transition"
        :class="guidelines.aportePriority === 'MUITO_ALTA' ? 'border-finance-invest/60 bg-finance-invest/5' : 'border-border-subtle'"
      >
        <div class="flex justify-between items-center text-xs">
          <span class="text-[#71717A] font-medium">1. Aumentar Aportes</span>
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
            :class="{
              'bg-finance-invest/20 text-finance-invest': guidelines.aportePriority === 'MUITO_ALTA',
              'bg-accent-yellow/20 text-accent-yellow': guidelines.aportePriority === 'MEDIA',
              'bg-[#27272A] text-finance-neutral': guidelines.aportePriority === 'QUASE_NULA',
            }"
          >
            {{ guidelines.aportePriority.replace('_', ' ') }}
          </span>
        </div>
        <p class="text-xs text-white font-semibold mt-2">
          {{
            currentPhase === 'CONSTRUCTION'
              ? 'Alavanca principal: ganhe mais e poupe com disciplina.'
              : currentPhase === 'TRANSITION'
              ? 'Importância média: continue poupando sem exageros.'
              : 'Impacto quase nulo: novos aportes não mudam o futuro.'
          }}
        </p>
      </div>

      <!-- Pilar 2: Rentabilidade / Investir Melhor -->
      <div
        class="bg-background rounded-xl p-3.5 border transition"
        :class="guidelines.investingBetterPriority === 'MUITO_ALTA' || guidelines.investingBetterPriority === 'ALTA' ? 'border-accent-yellow/60 bg-accent-yellow/5' : 'border-border-subtle'"
      >
        <div class="flex justify-between items-center text-xs">
          <span class="text-[#71717A] font-medium">2. Investir Melhor</span>
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
            :class="{
              'bg-accent-yellow/20 text-accent-yellow': guidelines.investingBetterPriority === 'ALTA',
              'bg-finance-pos/20 text-finance-pos': guidelines.investingBetterPriority === 'MUITO_ALTA',
              'bg-[#27272A] text-finance-neutral': guidelines.investingBetterPriority === 'MEDIA',
            }"
          >
            {{ guidelines.investingBetterPriority.replace('_', ' ') }}
          </span>
        </div>
        <p class="text-xs text-white font-semibold mt-2">
          {{
            currentPhase === 'CONSTRUCTION'
              ? 'Simplicidade: evite erros graves; alfa gera pouco dinheiro.'
              : currentPhase === 'TRANSITION'
              ? 'Alta relevância: balanceamento e diversificação global.'
              : 'Prioridade máxima: preservação contra inflação e volatilidade.'
          }}
        </p>
      </div>

      <!-- Pilar 3: Usufruir / Consumir a Renda -->
      <div
        class="bg-background rounded-xl p-3.5 border transition"
        :class="guidelines.enjoymentPriority === 'MUITO_ALTA' ? 'border-finance-pos/60 bg-finance-pos/5' : 'border-border-subtle'"
      >
        <div class="flex justify-between items-center text-xs">
          <span class="text-[#71717A] font-medium">3. Usufruir da Renda</span>
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
            :class="{
              'bg-finance-pos/20 text-finance-pos': guidelines.enjoymentPriority === 'MUITO_ALTA',
              'bg-accent-yellow/20 text-accent-yellow': guidelines.enjoymentPriority === 'MEDIA',
              'bg-[#27272A] text-finance-neutral': guidelines.enjoymentPriority === 'BAIXA',
            }"
          >
            {{ guidelines.enjoymentPriority.replace('_', ' ') }}
          </span>
        </div>
        <p class="text-xs text-white font-semibold mt-2">
          {{
            currentPhase === 'CONSTRUCTION'
              ? 'Consumo dosado: poupar agora compra sua liberdade futura.'
              : currentPhase === 'TRANSITION'
              ? 'Dose tempo e dinheiro: não abra mão de família e saúde.'
              : 'Liberdade plena: consuma e viva sem culpa!'
          }}
        </p>
      </div>
    </div>

    <!-- REFLEXÃO CENTRAL -->
    <div class="bg-background/80 border border-border-subtle rounded-xl p-4 flex items-start gap-3.5">
      <div class="text-2xl select-none">💧</div>
      <div class="space-y-1">
        <h4 class="text-xs font-bold text-accent-yellow uppercase tracking-wider">
          A Analogia do Copo d'Água & Utilidade Marginal
        </h4>
        <p class="text-xs text-white/90 leading-relaxed">
          {{ guidelines.waterGlassAnalogy }}
        </p>
      </div>
    </div>
  </div>
</template>
