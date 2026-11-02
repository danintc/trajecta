<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import { db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';
import { CareerRecord, CareerChangeReason } from '@/core/domain/career.entity';
import { parseBrlToCents, formatCentsToBrl } from '@/shared/utils/currency';

export interface AddCareerModalProps {
  isOpen: boolean;
  recordToEdit?: CareerRecord | null;
  existingRecords?: CareerRecord[];
}

const props = withDefaults(defineProps<AddCareerModalProps>(), {
  recordToEdit: null,
  existingRecords: () => [],
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const RECENT_COMPANIES_STORAGE_KEY = 'trajecta_recent_career_companies';
const GENERIC_COMPANY_NAMES = new Set([
  'tech & qa engineering',
  'laboratório clínico',
  'laboratorio clinico',
  'carreira profissional',
  'empresa',
  'empresa atual',
  'não informada',
  'nao informada',
]);

function isGenericCompanyName(name?: string | null): boolean {
  if (!name) return true;
  const normalized = name.trim().toLowerCase();
  return !normalized || GENERIC_COMPANY_NAMES.has(normalized);
}

function loadStoredRecentCompanies(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COMPANIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c) => typeof c === 'string' && c.trim().length > 0);
    }
  } catch {
    // Fallback seguro
  }
  return [];
}

function saveRecentCompanyToStorage(companyName: string) {
  const trimmed = companyName.trim();
  if (!trimmed || isGenericCompanyName(trimmed)) return;
  const current = loadStoredRecentCompanies();
  const deduped = [
    trimmed,
    ...current.filter((c) => c.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, 8);
  storedRecentCompanies.value = deduped;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(RECENT_COMPANIES_STORAGE_KEY, JSON.stringify(deduped));
    } catch {
      // Ignora erro de quota
    }
  }
}

const storedRecentCompanies = ref<string[]>(loadStoredRecentCompanies());
const dbRecordsFallback = ref<CareerRecord[]>([]);
const companyInputRef = ref<HTMLInputElement | null>(null);
const isChoosingOtherCompany = ref(false);

const company = ref('');
const role = ref('');
const startDate = ref(new Date().toISOString().slice(0, 7));
const isCurrent = ref(true);
const endDate = ref('');
const grossSalaryStr = ref('');
const netSalaryStr = ref('');
const changeReason = ref<CareerChangeReason>('promocao');
const mealAllowanceStr = ref('');
const annualBonusStr = ref('');
const errorMessage = ref<string | null>(null);

const isEditMode = computed(() => Boolean(props.recordToEdit));

// Lista ordenada das últimas empresas reais preenchidas pelo usuário (sem duplicatas e sem nomes genéricos)
const recentCustomCompanies = computed<string[]>(() => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const name of storedRecentCompanies.value) {
    const clean = name.trim();
    const lower = clean.toLowerCase();
    if (clean && !isGenericCompanyName(clean) && !seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }

  const allRecords =
    props.existingRecords.length > 0 ? props.existingRecords : dbRecordsFallback.value;
  const sortedByRecentUpdate = [...allRecords].sort((a, b) =>
    (b.updatedAt || b.startDate).localeCompare(a.updatedAt || a.startDate)
  );

  for (const rec of sortedByRecentUpdate) {
    const clean = (rec.company || '').trim();
    const lower = clean.toLowerCase();
    if (clean && !isGenericCompanyName(clean) && !seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }

  return result.slice(0, 6);
});

const wasAutoSuggestedFromGeneric = computed(() => {
  if (!props.recordToEdit) return false;
  return (
    isGenericCompanyName(props.recordToEdit.company) &&
    recentCustomCompanies.value.length > 0 &&
    company.value === recentCustomCompanies.value[0]
  );
});

async function selectCompanyOption(compName: string) {
  isChoosingOtherCompany.value = false;
  company.value = compName;
}

async function selectOtherCompanyOption() {
  isChoosingOtherCompany.value = true;
  company.value = '';
  await nextTick();
  companyInputRef.value?.focus();
}

watch(
  () => [props.isOpen, props.recordToEdit],
  async ([open]) => {
    if (open) {
      errorMessage.value = null;
      storedRecentCompanies.value = loadStoredRecentCompanies();
      if (props.existingRecords.length === 0) {
        try {
          dbRecordsFallback.value = await db.careerRecords.toArray();
        } catch {
          dbRecordsFallback.value = [];
        }
      }

      const latestSuggested = recentCustomCompanies.value[0] || '';

      if (props.recordToEdit) {
        // Se o card tiver empresa genérica e o usuário já preencheu alguma empresa antes, já sugere a última preenchida!
        if (isGenericCompanyName(props.recordToEdit.company) && latestSuggested) {
          company.value = latestSuggested;
          isChoosingOtherCompany.value = false;
        } else {
          company.value = props.recordToEdit.company;
          isChoosingOtherCompany.value = false;
        }
        role.value = props.recordToEdit.role;
        startDate.value = props.recordToEdit.startDate.slice(0, 7);
        isCurrent.value = !props.recordToEdit.endDate;
        endDate.value = props.recordToEdit.endDate ? props.recordToEdit.endDate.slice(0, 7) : '';
        grossSalaryStr.value = formatCentsToBrl(props.recordToEdit.grossSalaryInCents).replace('R$', '').trim();
        netSalaryStr.value = formatCentsToBrl(props.recordToEdit.netSalaryInCents).replace('R$', '').trim();
        changeReason.value = props.recordToEdit.changeReason || 'promocao';
        mealAllowanceStr.value = props.recordToEdit.mealAllowanceInCents
          ? formatCentsToBrl(props.recordToEdit.mealAllowanceInCents).replace('R$', '').trim()
          : '';
        annualBonusStr.value = props.recordToEdit.annualBonusEstimatedInCents
          ? formatCentsToBrl(props.recordToEdit.annualBonusEstimatedInCents).replace('R$', '').trim()
          : '';
      } else {
        company.value = latestSuggested;
        isChoosingOtherCompany.value = !latestSuggested;
        role.value = '';
        startDate.value = new Date().toISOString().slice(0, 7);
        isCurrent.value = true;
        endDate.value = '';
        grossSalaryStr.value = '';
        netSalaryStr.value = '';
        changeReason.value = 'promocao';
        mealAllowanceStr.value = '';
        annualBonusStr.value = '';
      }
    }
  },
  { immediate: true }
);

function handleClose() {
  emit('close');
}

async function handleSubmit() {
  errorMessage.value = null;

  if (!company.value.trim()) {
    errorMessage.value = 'O nome da empresa é obrigatório.';
    return;
  }
  if (!role.value.trim()) {
    errorMessage.value = 'O cargo é obrigatório.';
    return;
  }

  const grossSalaryInCents = parseBrlToCents(grossSalaryStr.value);
  const netSalaryInCents = parseBrlToCents(netSalaryStr.value);

  if (grossSalaryInCents <= 0) {
    errorMessage.value = 'O salário bruto deve ser maior que zero.';
    return;
  }

  const mealAllowanceInCents = parseBrlToCents(mealAllowanceStr.value);
  const annualBonusEstimatedInCents = parseBrlToCents(annualBonusStr.value);

  try {
    const now = new Date().toISOString();

    if (props.recordToEdit) {
      const updatedRecord: CareerRecord = {
        ...props.recordToEdit,
        company: company.value.trim(),
        role: role.value.trim(),
        startDate: startDate.value,
        endDate: isCurrent.value ? undefined : (endDate.value || undefined),
        grossSalaryInCents,
        netSalaryInCents: netSalaryInCents || Math.round(grossSalaryInCents * 0.75),
        changeReason: changeReason.value,
        mealAllowanceInCents,
        annualBonusEstimatedInCents,
        updatedAt: now,
      };

      await db.careerRecords.update(props.recordToEdit.id, {
        company: updatedRecord.company,
        role: updatedRecord.role,
        startDate: updatedRecord.startDate,
        endDate: updatedRecord.endDate,
        grossSalaryInCents: updatedRecord.grossSalaryInCents,
        netSalaryInCents: updatedRecord.netSalaryInCents,
        changeReason: updatedRecord.changeReason,
        mealAllowanceInCents: updatedRecord.mealAllowanceInCents,
        annualBonusEstimatedInCents: updatedRecord.annualBonusEstimatedInCents,
        updatedAt: now,
      });
      await cloudSyncService.upsertCareerRecord(updatedRecord);
    } else {
      const newRecord: CareerRecord = {
        id: `career-${Date.now()}`,
        company: company.value.trim(),
        role: role.value.trim(),
        startDate: startDate.value,
        endDate: isCurrent.value ? undefined : (endDate.value || undefined),
        grossSalaryInCents,
        netSalaryInCents: netSalaryInCents || Math.round(grossSalaryInCents * 0.75),
        changeReason: changeReason.value,
        mealAllowanceInCents,
        annualBonusEstimatedInCents,
        createdAt: now,
        updatedAt: now,
      };

      await db.careerRecords.add(newRecord);
      await cloudSyncService.upsertCareerRecord(newRecord);
    }

    saveRecentCompanyToStorage(company.value);

    emit('success');
    emit('close');

    company.value = '';
    role.value = '';
    grossSalaryStr.value = '';
    netSalaryStr.value = '';
    mealAllowanceStr.value = '';
    annualBonusStr.value = '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar marco de carreira.';
    errorMessage.value = msg;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        data-testid="modal-add-career"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-career-title"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="bg-surface border-t sm:border border-border-subtle rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[92dvh] sm:my-8 pb-safe transform transition-all"
        >
          <!-- Alça de Arraste Mobile -->
          <div class="w-10 h-1 bg-[#3F3F46] rounded-full mx-auto mt-3 mb-1 sm:hidden" />
          <!-- Header do Diálogo -->
          <div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h3 id="modal-career-title" class="font-bold text-base text-white flex items-center gap-2">
              <span>{{ isEditMode ? 'Editar Marco Profissional' : 'Novo Marco Profissional' }}</span>
              <span
                class="text-[10px] bg-finance-career/10 text-finance-career px-2 py-0.5 rounded font-bold uppercase"
              >
                Total Cash
              </span>
            </h3>
            <button
              type="button"
              class="text-finance-neutral hover:text-white text-lg transition p-1 rounded-md"
              @click="handleClose"
            >
              ✕
            </button>
          </div>

          <!-- Formulário -->
          <form class="p-6 space-y-4" @submit.prevent="handleSubmit">
            <div
              v-if="errorMessage"
              class="p-3 rounded-lg bg-finance-neg/10 border border-finance-neg/30 text-finance-neg text-xs font-medium"
            >
              {{ errorMessage }}
            </div>

            <div class="space-y-3">
              <div>
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <label class="block text-xs font-semibold text-finance-neutral">
                    Empresa
                  </label>
                  <span
                    v-if="wasAutoSuggestedFromGeneric"
                    data-testid="badge-company-autosuggested"
                    class="text-[10px] font-bold text-finance-career bg-finance-career/10 border border-finance-career/25 px-2 py-0.5 rounded-full"
                  >
                    ✨ Sugerida das últimas preenchidas
                  </span>
                </div>

                <!-- Sugestões Rápidas das Últimas Empresas Preenchidas + Opção "Outra" -->
                <div
                  data-testid="career-company-suggestions"
                  class="flex flex-wrap items-center gap-1.5 mb-2"
                >
                  <button
                    v-for="(compName, idx) in recentCustomCompanies"
                    :key="compName"
                    type="button"
                    :data-testid="`btn-suggest-company-${idx}`"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1"
                    :class="
                      company.trim().toLowerCase() === compName.toLowerCase() && !isChoosingOtherCompany
                        ? 'bg-finance-career text-black font-bold border-finance-career shadow-sm'
                        : 'bg-background text-[#A1A1AA] border-border-subtle hover:text-white hover:border-finance-career/40'
                    "
                    @click="selectCompanyOption(compName)"
                  >
                    <span v-if="company.trim().toLowerCase() === compName.toLowerCase() && !isChoosingOtherCompany">✓</span>
                    <span>{{ compName }}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-career-company-other"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1"
                    :class="
                      isChoosingOtherCompany || (!company.trim() && recentCustomCompanies.length > 0)
                        ? 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow font-bold'
                        : 'bg-background/60 text-[#71717A] border-border-subtle hover:text-white'
                    "
                    @click="selectOtherCompanyOption"
                  >
                    <span>+ Escolher outra</span>
                  </button>
                </div>

                <input
                  ref="companyInputRef"
                  v-model="company"
                  type="text"
                  data-testid="input-career-company"
                  placeholder="Digite o nome da empresa (Ex: Nubank)"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white outline-none transition"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Cargo / Posição
                </label>
                <input
                  v-model="role"
                  type="text"
                  data-testid="input-career-role"
                  placeholder="Ex: Engenheiro"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white outline-none transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Data de Início
                </label>
                <input
                  v-model="startDate"
                  type="month"
                  data-testid="input-career-start-date"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white font-mono outline-none transition appearance-none"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Vínculo Atual?
                </label>
                <div class="flex items-center h-10 px-3 bg-background border border-border-subtle rounded-lg">
                  <label class="flex items-center gap-2 cursor-pointer text-xs text-white w-full">
                    <input
                      v-model="isCurrent"
                      type="checkbox"
                      class="w-4 h-4 accent-accent-yellow rounded cursor-pointer"
                    />
                    <span>Sim, emprego ativo</span>
                  </label>
                </div>
              </div>
              <div v-if="!isCurrent" class="expand-item-smooth">
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Data de Término
                </label>
                <input
                  v-model="endDate"
                  type="month"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white font-mono outline-none transition appearance-none"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Salário Bruto Mensal (R$)
                </label>
                <input
                  v-model="grossSalaryStr"
                  type="text"
                  data-testid="input-career-gross"
                  placeholder="Ex: 12.000,00"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white font-mono outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Salário Líquido Mensal (R$)
                </label>
                <input
                  v-model="netSalaryStr"
                  type="text"
                  data-testid="input-career-net"
                  placeholder="Ex: 9.000,00"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white font-mono outline-none transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Motivo da Mudança
                </label>
                <select
                  v-model="changeReason"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white outline-none transition"
                >
                  <option value="promocao">Promoção</option>
                  <option value="merito">Mérito</option>
                  <option value="mudanca_empresa">Troca de Empresa</option>
                  <option value="contratacao">Contratação Inicial</option>
                  <option value="dissidio">Dissídio Coletivo</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  VR / VA Mensal (R$)
                </label>
                <input
                  v-model="mealAllowanceStr"
                  type="text"
                  placeholder="Ex: 1.500,00"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white font-mono outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-finance-neutral mb-1">
                  Bônus Anual / PLR (R$)
                </label>
                <input
                  v-model="annualBonusStr"
                  type="text"
                  placeholder="Ex: 25.000,00"
                  class="w-full h-10 bg-background border border-border-subtle focus:border-accent-yellow rounded-lg px-3 text-xs text-white font-mono outline-none transition"
                />
              </div>
            </div>

            <div class="pt-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
              <button
                type="button"
                class="px-3.5 py-1.5 text-xs text-finance-neutral hover:text-white font-medium transition"
                @click="handleClose"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="btn-submit-career"
                class="px-4 py-2 rounded-lg bg-finance-career hover:bg-[#6366F1] text-black font-bold text-xs transition transform active:scale-95 shadow-sm shadow-finance-career/20"
              >
                {{ isEditMode ? 'Salvar Alterações' : 'Salvar Marco' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
