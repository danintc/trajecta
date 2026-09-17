import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KpiCard from '@/adapters/in/ui/components/KpiCard.vue';

describe('KpiCard Component & Modo Privacidade', () => {
  it('deve exibir o valor nominal formatado quando o modo privacidade estiver inativo', () => {
    const wrapper = mount(KpiCard, {
      props: {
        testId: 'kpi-test',
        title: 'Saldo Total',
        formattedValue: 'R$ 1.500,00',
        variant: 'positive',
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="kpi-test"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('R$ 1.500,00');
    expect(wrapper.text()).not.toContain('R$ •••••');
  });

  it('deve substituir o valor nominal no DOM por "R$ •••••" quando o modo privacidade for ativado', () => {
    const wrapper = mount(KpiCard, {
      props: {
        testId: 'kpi-test-priv',
        title: 'Saldo Oculto',
        formattedValue: 'R$ 50.000,00',
        variant: 'positive',
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).not.toContain('R$ 50.000,00');
    expect(wrapper.text()).toContain('R$ •••••');
  });
});
