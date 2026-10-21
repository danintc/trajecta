import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AddAssetModal from '@/adapters/in/ui/components/AddAssetModal.vue';
import AddCareerModal from '@/adapters/in/ui/components/AddCareerModal.vue';
import { db, clearTestDatabase } from '@/adapters/out/storage/dexie-db';
import { cloudSyncService } from '@/adapters/out/storage/cloud-sync.service';

describe('Modals Persistence Integration (AddAssetModal & AddCareerModal -> Dexie + CloudSync)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
    vi.spyOn(cloudSyncService, 'upsertAsset').mockResolvedValue();
    vi.spyOn(cloudSyncService, 'upsertCareerRecord').mockResolvedValue();
  });

  it('deve cadastrar novo ativo via AddAssetModal e recalcular preço médio ponderado ao adicionar o mesmo ticker', async () => {
    const wrapper = mount(AddAssetModal, {
      props: { isOpen: true },
      global: {
        stubs: { Teleport: true },
      },
    });

    // 1ª Compra: 100 cotas de PETR4 a R$ 30,00 (3000 centavos)
    await wrapper.find('[data-testid="input-asset-ticker"]').setValue('petr4');
    await wrapper.find('[data-testid="input-asset-qty"]').setValue('100');
    await wrapper.find('[data-testid="input-asset-price"]').setValue('30,00');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    let saved = await db.assets.where('tickerOrName').equals('PETR4').first();
    expect(saved).toBeDefined();
    expect(saved?.totalQuantity).toBe(100);
    expect(saved?.averagePriceInCents).toBe(3000);
    expect(cloudSyncService.upsertAsset).toHaveBeenCalledTimes(1);

    // 2ª Compra do mesmo ativo: +100 cotas de PETR4 a R$ 40,00 (4000 centavos) -> PM esperado: R$ 35,00 (3500 centavos)
    await wrapper.find('[data-testid="input-asset-ticker"]').setValue('PETR4');
    await wrapper.find('[data-testid="input-asset-qty"]').setValue('100');
    await wrapper.find('[data-testid="input-asset-price"]').setValue('40,00');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const allAssets = await db.assets.toArray();
    expect(allAssets).toHaveLength(1);
    saved = allAssets[0];
    expect(saved.totalQuantity).toBe(200);
    expect(saved.averagePriceInCents).toBe(3500);
    expect(saved.currentPriceInCents).toBe(4000);
    expect(cloudSyncService.upsertAsset).toHaveBeenCalledTimes(2);
  });

  it('deve persistir novo marco de carreira via AddCareerModal no Dexie e acionar sincronização na nuvem', async () => {
    const wrapper = mount(AddCareerModal, {
      props: { isOpen: true },
      global: {
        stubs: { Teleport: true },
      },
    });

    await wrapper.find('[data-testid="input-career-company"]').setValue('Nubank');
    await wrapper.find('[data-testid="input-career-role"]').setValue('Staff Software Engineer');
    await wrapper.find('[data-testid="input-career-gross"]').setValue('20.000,00');
    await wrapper.find('[data-testid="input-career-net"]').setValue('15.200,00');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const records = await db.careerRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].company).toBe('Nubank');
    expect(records[0].role).toBe('Staff Software Engineer');
    expect(records[0].grossSalaryInCents).toBe(2000000);
    expect(records[0].netSalaryInCents).toBe(1520000);
    expect(cloudSyncService.upsertCareerRecord).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('success')).toBeTruthy();
  });
});
