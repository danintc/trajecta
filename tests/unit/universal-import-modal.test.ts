import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import UniversalImportModal from '@/adapters/in/ui/components/UniversalImportModal.vue';
import { clearTestDatabase, db } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';

describe('UniversalImportModal Component', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
    vi.spyOn(cloudSyncService, 'upsertTransactions').mockResolvedValue();
    vi.spyOn(cloudSyncService, 'upsertAsset').mockResolvedValue();
    vi.spyOn(cloudSyncService, 'upsertCareerRecord').mockResolvedValue();
  });

  it('deve renderizar o modal, carregar o preset completo das 2 planilhas Google Sheets, alternar abas de revisão e confirmar a importação', async () => {
    const wrapper = mount(UniversalImportModal, {
      props: {
        isOpen: true,
        initialTargetModule: 'all',
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="universal-import-modal"]').exists()).toBe(true);

    // Clica no botão 1-click para sincronizar as 2 planilhas principais
    const presetBtn = wrapper.find('[data-testid="btn-preset-both-sheets"]');
    expect(presetBtn.exists()).toBe(true);
    await presetBtn.trigger('click');

    // Aguarda conclusão do parse no IndexedDB
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="universal-staging-area"]').exists()).toBe(true);
    });

    // Alterna entre as 4 abas de revisão (Transações, Investimentos, Carreira, Rentabilidade)
    await wrapper.find('[data-testid="review-tab-assets"]').trigger('click');
    expect(wrapper.text()).toContain('PSSA3');
    expect(wrapper.text()).toContain('AAPL34');

    await wrapper.find('[data-testid="review-tab-career"]').trigger('click');
    expect(wrapper.text()).toContain('Mid level QA Analyst');

    await wrapper.find('[data-testid="review-tab-snapshots"]').trigger('click');
    expect(wrapper.text()).toContain('2020-07');

    // Confirma a importação
    const commitBtn = wrapper.find('[data-testid="btn-commit-universal-import"]');
    await commitBtn.trigger('click');

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="import-commit-summary"]').exists()).toBe(true);
    });
    expect(wrapper.emitted('success')).toBeTruthy();

    expect(await db.careerRecords.count()).toBe(18);
    expect(await db.snapshots.count()).toBe(76);
  });

  it('deve permitir colar extrato de corretora/banco em texto, analisar e importar', async () => {
    const wrapper = mount(UniversalImportModal, {
      props: {
        isOpen: true,
        initialTargetModule: 'transactions',
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    await wrapper.find('[data-testid="source-tab-statement"]').trigger('click');
    await wrapper.find('[data-testid="btn-sample-statement"]').trigger('click');
    await wrapper.find('[data-testid="btn-parse-statement"]').trigger('click');

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="universal-staging-area"]').exists()).toBe(true);
    });
    expect(wrapper.text()).toContain('Salário Líquido Mensal');
  });

  it('deve ocultar os atalhos das planilhas pessoais do Daniel quando isOwnerProfile for false (outro usuário logado)', () => {
    const wrapper = mount(UniversalImportModal, {
      props: {
        isOpen: true,
        initialTargetModule: 'all',
        isOwnerProfile: false,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="btn-preset-both-sheets"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="btn-preset-finance-sheet"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="btn-preset-career-sheet"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-google-sheet-url"]').exists()).toBe(true);
  });
});
