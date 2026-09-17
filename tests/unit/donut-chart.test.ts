import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DonutChart, { DonutSlice } from '@/adapters/in/ui/components/DonutChart.vue';

describe('DonutChart Component', () => {
  const mockSlices: DonutSlice[] = [
    { label: 'Contas & Caixa', valueInCents: 85000, color: '#38BDF8', percent: 5.3 },
    { label: 'Renda Fixa & Tesouro', valueInCents: 660000, color: '#10B981', percent: 41 },
    { label: 'Fundos Imobiliários', valueInCents: 405000, color: '#A855F7', percent: 25.2 },
    { label: 'Ações Brasileiras', valueInCents: 458400, color: '#6366F1', percent: 28.5 },
  ];

  it('deve renderizar o gráfico rosquinha com fatias, legenda e total no centro', () => {
    const wrapper = mount(DonutChart, {
      props: {
        testId: 'test-donut',
        slices: mockSlices,
        totalFormatted: 'R$ 160.840,00',
        emptyText: 'Sem registros',
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="test-donut"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="donut-center-label"]').text()).toBe('TOTAL');
    expect(wrapper.find('[data-testid="donut-center-value"]').text()).toBe('R$ 160.840,00');
    expect(wrapper.text()).toContain('Contas & Caixa');
    expect(wrapper.text()).toContain('Renda Fixa & Tesouro');
    expect(wrapper.text()).toContain('Fundos Imobiliários');
    expect(wrapper.text()).toContain('Ações Brasileiras');
  });

  it('deve garantir que o hover na fatia Renda Fixa ativa Renda Fixa e NÃO Ações Brasileiras', async () => {
    const wrapper = mount(DonutChart, {
      props: {
        testId: 'slice-hover-donut',
        slices: mockSlices,
        totalFormatted: 'R$ 160.840,00',
        emptyText: 'Sem registros',
        isPrivacyActive: false,
      },
    });

    // Fatia 1 é Renda Fixa & Tesouro
    const rendaFixaPath = wrapper.find('[data-testid="donut-slice-1"]');
    expect(rendaFixaPath.exists()).toBe(true);

    // Dispara hover na fatia 1 (Renda Fixa & Tesouro)
    await rendaFixaPath.trigger('mouseenter');

    // O centro DEVE exibir Renda Fixa & Tesouro (e seu valor), NUNCA Ações Brasileiras
    expect(wrapper.find('[data-testid="donut-center-label"]').text()).toMatch(/Renda Fixa/i);
    expect(wrapper.find('[data-testid="donut-center-value"]').text().replace(/\u00a0/g, ' ')).toBe('R$ 6.600,00');

    // Ao sair com o mouse, deve voltar ao TOTAL
    await rendaFixaPath.trigger('mouseleave');
    expect(wrapper.find('[data-testid="donut-center-label"]').text()).toBe('TOTAL');
    expect(wrapper.find('[data-testid="donut-center-value"]').text().replace(/\u00a0/g, ' ')).toBe('R$ 160.840,00');

    // Agora hover na fatia 3 (Ações Brasileiras)
    const acoesPath = wrapper.find('[data-testid="donut-slice-3"]');
    await acoesPath.trigger('mouseenter');
    expect(wrapper.find('[data-testid="donut-center-label"]').text()).toMatch(/Ações Brasile/i);
    expect(wrapper.find('[data-testid="donut-center-value"]').text().replace(/\u00a0/g, ' ')).toBe('R$ 4.584,00');
  });

  it('deve renderizar o mesmo donut em cinza com R$ 0,00 no estado zero-data (clean slate)', () => {
    const wrapper = mount(DonutChart, {
      props: {
        testId: 'empty-donut',
        slices: [],
        totalFormatted: 'R$ 0,00',
        emptyText: 'Nenhum ativo ou saldo registrado',
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="empty-donut"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="donut-center-label"]').text()).toBe('TOTAL');
    expect(wrapper.text()).toContain('R$ 0,00');
    expect(wrapper.text()).toContain('Nenhum ativo ou saldo registrado');
    expect(wrapper.text()).toContain('0%');
  });

  it('deve ocultar valores em modo privacidade', () => {
    const wrapper = mount(DonutChart, {
      props: {
        testId: 'privacy-donut',
        slices: mockSlices,
        totalFormatted: 'R$ •••••',
        emptyText: 'Sem registros',
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
  });
});
