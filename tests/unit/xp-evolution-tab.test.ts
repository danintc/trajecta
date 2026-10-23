import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import XpEvolutionTab from '@/adapters/in/ui/components/XpEvolutionTab.vue';

describe('XpEvolutionTab Component (Estilo XP Prints 1, 2 e 3)', () => {
  it('deve renderizar a estrutura completa de Rentabilidade e Evolução Patrimonial', () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="xp-evolution-tab"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Rentabilidade e evolução patrimonial');
    expect(wrapper.text()).toContain('Rentabilidade');
    expect(wrapper.text()).toContain('Patrimônio');
    expect(wrapper.text()).toContain('Detalhes da rentabilidade');
    expect(wrapper.text()).toContain('Evolução');
    expect(wrapper.text()).toContain('Detalhes da evolução');
    expect(wrapper.text()).toContain('Estatísticas no ano');
  });

  it('deve renderizar o gráfico de montanha com gradiente linear e crista', () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('linearGradient#xpMountainGradient').exists()).toBe(true);
    expect(wrapper.find('filter#xpMountainGlow').exists()).toBe(true);
    const paths = wrapper.findAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('deve permitir alternar entre Rentabilidade e Patrimônio', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Padrão é rentabilidade
    expect(wrapper.text()).toContain('Rentabilidade • De 01/01/2026');

    // Alternar para Patrimônio
    const patBtn = wrapper.findAll('button').find((b) => b.text() === 'Patrimônio');
    expect(patBtn).toBeDefined();
    await patBtn!.trigger('click');

    expect(wrapper.text()).toContain('Patrimônio • De 01/01/2026');
  });

  it('deve disponibilizar e permitir trocar entre múltiplos benchmarks (IBOV, SP500, NASDAQ, IPCA, Dólar, etc.)', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    const selects = wrapper.findAll('select');
    // Segundo select é o seletor de benchmark
    const benchmarkSelect = selects.at(1);
    expect(benchmarkSelect).toBeDefined();

    // Mudar para Ibovespa
    await benchmarkSelect!.setValue('ibov');
    expect(wrapper.text()).toContain('IBOV');
    expect(wrapper.text()).toContain('12,40%');

    // Mudar para S&P 500
    await benchmarkSelect!.setValue('sp500');
    expect(wrapper.text()).toContain('SP500');
    expect(wrapper.text()).toContain('17,80%');

    // Mudar para Nasdaq
    await benchmarkSelect!.setValue('nasdaq');
    expect(wrapper.text()).toContain('NASDAQ');
    expect(wrapper.text()).toContain('21,50%');

    // Mudar para IPCA + 6%
    await benchmarkSelect!.setValue('ipca_plus_6');
    expect(wrapper.text()).toContain('IPCA+6');
    expect(wrapper.text()).toContain('10,40%');

    // Mudar para Poupança
    await benchmarkSelect!.setValue('poupanca');
    expect(wrapper.text()).toContain('POUPANÇA');
    expect(wrapper.text()).toContain('6,15%');
  });

  it('deve exibir a tabela completa de Detalhes da Evolução e Estatísticas no ano', () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Detalhes da evolução (Print 2)
    expect(wrapper.text()).toContain('Patrimônio inicial');
    expect(wrapper.text()).toContain('Movimentações');
    expect(wrapper.text()).toContain('Variação em R$');
    expect(wrapper.text()).toContain('Imposto de Renda pago');
    expect(wrapper.text()).toContain('Patrimônio Final');
    expect(wrapper.text()).toContain('Variação em %');
    expect(wrapper.text()).toContain('Variação em % do CDI');
    expect(wrapper.text()).toContain('Var. líquida de IR em % do CDI');

    // Estatísticas no ano (Print 3)
    expect(wrapper.text()).toContain('Meses positivos');
    expect(wrapper.text()).toContain('Meses negativos');
    expect(wrapper.text()).toContain('Rentabilidade mensal max.');
    expect(wrapper.text()).toContain('Rentabilidade mensal min.');
    expect(wrapper.text()).toContain('Meses acima do CDI');
    expect(wrapper.text()).toContain('Meses abaixo do CDI');
    expect(wrapper.text()).toContain('Volatilidade');
    expect(wrapper.text()).toContain('23,01%');
  });

  it('deve abrir o modal educativo "Entenda o cálculo da evolução patrimonial"', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    const infoBtn = wrapper.findAll('button').find((b) => b.text().includes('Entenda o cálculo'));
    expect(infoBtn).toBeDefined();
    await infoBtn!.trigger('click');

    expect(wrapper.text()).toContain('Cálculo da Evolução Patrimonial');
    expect(wrapper.text()).toContain('TWR (Time-Weighted Rate of Return)');
    expect(wrapper.text()).toContain('Neutralização de Fluxo de Caixa');
  });
});
