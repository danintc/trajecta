<script setup lang="ts">
export interface EmptyStateProps {
  module: string;
  icon?: string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}

withDefaults(defineProps<EmptyStateProps>(), {
  icon: '📝',
});

const emit = defineEmits<{
  (e: 'primaryAction'): void;
  (e: 'secondaryAction'): void;
}>();
</script>

<template>
  <div
    :data-testid="`empty-state-${module}`"
    class="py-14 px-4 text-center bg-surface border border-border-subtle rounded-2xl"
  >
    <div
      class="w-16 h-16 rounded-2xl bg-surface-hover border border-border-subtle mx-auto flex items-center justify-center text-3xl mb-4 text-accent-yellow shadow-inner"
    >
      {{ icon }}
    </div>
    <h3 class="text-base font-bold text-white mb-1.5">{{ title }}</h3>
    <p class="text-xs text-finance-neutral max-w-md mx-auto mb-6 leading-relaxed">
      {{ description }}
    </p>

    <div class="flex flex-wrap items-center justify-center gap-3">
      <button
        v-if="primaryActionLabel"
        :data-testid="`btn-empty-action-${module}`"
        type="button"
        class="px-4 py-2 rounded-lg bg-accent-yellow hover:bg-accent-yellow-hover text-black font-bold text-xs flex items-center gap-2 transition transform active:scale-95 shadow-sm shadow-accent-yellow/20"
        @click="emit('primaryAction')"
      >
        <span>+</span> {{ primaryActionLabel }}
      </button>
      <button
        v-if="secondaryActionLabel"
        :data-testid="`btn-empty-secondary-${module}`"
        type="button"
        class="px-4 py-2 rounded-lg border border-border-subtle hover:border-[#3F3F46] bg-surface-hover text-xs font-semibold text-finance-neutral hover:text-white transition"
        @click="emit('secondaryAction')"
      >
        {{ secondaryActionLabel }}
      </button>
    </div>
  </div>
</template>
