import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import InvestmentsScreen from '@/adapters/in/ui/screens/InvestmentsScreen.vue';
import { Asset } from '@/core/domain/asset.entity';

describe('InvestmentsScreen Component', () => {
  const mockAssets: Asset[] = [
    {
      id: 'asset-1',
      tickerOrName: 'TESOURO IPCA+ 2035',
      assetClass: 'renda_fixa',
      institution: 'BTG Pactual',
      totalQuantity: 10,
      averagePriceInCents: 300000,
      currentPriceInCents: 320000,
      targetPercent: 50,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'asset-2',
      tickerOrName: 'HGLG11',
      assetClass: 'fiis',
      institution: 'XP Investimentos',
      totalQuantity: 100,
      averagePriceInCents: 15000,
      currentPriceInCents: 16000,
      targetPercent: 50,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ];

  it('deve exibir EmptyState quando não houver ativos cadastrados', () => {
    const wrapper = mount(InvestmentsScreen, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="screen-invest"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Nenhum ativo na carteira');
  });

  it('deve renderizar KPIs, custódia por corretora, simulador de rebalanceamento e filtrar por classe', async () => {
    const wrapper = mount(InvestmentsScreen, {
      props: {
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('TESOURO IPCA+ 2035');
    expect(wrapper.text()).toContain('HGLG11');
    expect(wrapper.text()).toContain('BTG Pactual');
    expect(wrapper.text()).toContain('XP Investimentos');
    expect(wrapper.text()).toContain('Simulador de Aporte Inteligente');

    // Filtrar apenas FIIs clicando na pill "FIIs"
    const fiisBtn = wrapper.findAll('button').find((b) => b.text() === 'FIIs');
    expect(fiisBtn).toBeDefined();
    await fiisBtn!.trigger('click');

    expect(wrapper.text()).toContain('1 ativos listados');
    expect(wrapper.text()).toContain('HGLG11');
    expect(wrapper.text()).not.toContain('TESOURO IPCA+ 2035');
  });

  it('deve emitir navigateToSimulator ao clicar no banner do Simulador de Fases', async () => {
    const wrapper = mount(InvestmentsScreen, {
      props: {
        assets: mockAssets,
        isPrivacyActive: false,
      },
    });

    const simBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Abrir Simulador'));
    expect(simBtn).toBeDefined();
    await simBtn!.trigger('click');

    expect(wrapper.emitted('navigateToSimulator')).toBeTruthy();
  });
});
