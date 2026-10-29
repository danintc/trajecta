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

  it('deve mostrar o valor de cada coordenada ao passar o mouse/dedo ou clicar e atualizar todos os dados abaixo para o ponto selecionado', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Estado inicial (último ponto: De 01/01/2026 Até 09/10/2026, 9,35%)
    expect(wrapper.find('[data-testid="evolution-header-profit-pct"]').text()).toContain('9,35%');
    expect(wrapper.find('[data-testid="details-reference-date"]').text()).toBe('De 01/01/2026 Até 09/10/2026');
    expect(wrapper.find('[data-testid="evolution-point-info"]').text()).toContain('Outubro/26');
    expect(wrapper.find('[data-testid="btn-clear-evolution-point"]').exists()).toBe(false);

    // Passar sobre a coordenada 0 (Jan/26 - Janeiro/26)
    const point0 = wrapper.find('[data-testid="evolution-chart-point-0"]');
    expect(point0.exists()).toBe(true);
    await point0.trigger('mouseenter');

    // Badge flutuante e barra de ponto selecionado devem aparecer com o valor daquele ponto (9.35 * 0.82 = 7.67%)
    expect(wrapper.find('[data-testid="evolution-chart-floating-value"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="evolution-chart-floating-value"]').text()).toContain('Janeiro/26');
    expect(wrapper.find('[data-testid="evolution-chart-floating-value"]').text()).toContain('7,67%');
    expect(wrapper.find('[data-testid="evolution-active-guide-line"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="evolution-point-info"]').exists()).toBe(true);

    // Todos os dados abaixo devem refletir o ponto 0 (Janeiro/26)
    expect(wrapper.find('[data-testid="evolution-header-profit-pct"]').text()).toContain('7,67%');
    expect(wrapper.find('[data-testid="details-reference-date"]').text()).toBe('De 01/01/2026 Até Janeiro/26');
    expect(wrapper.find('[data-testid="details-profit-value"]').text()).toContain('1.579,65');
    expect(wrapper.find('[data-testid="evolution-bar-info"]').text()).toContain('Janeiro/26');

    // Passar para a coordenada 4 (Mai/26 - Maio/26, 9.35 * 0.96 = 8.98%)
    const point4 = wrapper.find('[data-testid="evolution-chart-point-4"]');
    await point4.trigger('mouseenter');

    expect(wrapper.find('[data-testid="evolution-chart-floating-value"]').text()).toContain('Maio/26');
    expect(wrapper.find('[data-testid="evolution-chart-floating-value"]').text()).toContain('8,98%');
    expect(wrapper.find('[data-testid="evolution-header-profit-pct"]').text()).toContain('8,98%');
    expect(wrapper.find('[data-testid="details-reference-date"]').text()).toBe('De 01/01/2026 Até Maio/26');
    expect(wrapper.find('[data-testid="evolution-bar-info"]').text()).toContain('Maio/26');

    // Clicar na coordenada 4 para fixar (pin) o ponto mesmo após tirar o mouse
    await point4.trigger('click');
    await point4.trigger('mouseleave');

    expect(wrapper.find('[data-testid="evolution-header-profit-pct"]').text()).toContain('8,98%');
    expect(wrapper.find('[data-testid="details-reference-date"]').text()).toBe('De 01/01/2026 Até Maio/26');

    // Limpar seleção pelo botão "Limpar seleção"
    const clearBtn = wrapper.find('[data-testid="btn-clear-evolution-point"]');
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger('click');

    expect(wrapper.find('[data-testid="details-reference-date"]').text()).toBe('De 01/01/2026 Até 09/10/2026');
    expect(wrapper.find('[data-testid="evolution-header-profit-pct"]').text()).toContain('9,35%');
  });

  it('deve atualizar a coordenada selecionada ao tocar (touchstart) nos pontos do gráfico e no modo Patrimônio', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Alternar para modo Patrimônio
    const patBtn = wrapper.findAll('button').find((b) => b.text() === 'Patrimônio');
    await patBtn!.trigger('click');

    // Tocar na coordenada 2 (Mar/26 - Março/26, 2252959 * 0.81 = 1824897 -> R$ 18.248,97)
    const point2 = wrapper.find('[data-testid="evolution-chart-point-2"]');
    await point2.trigger('touchstart');

    expect(wrapper.find('[data-testid="details-reference-date"]').text()).toBe('De 01/01/2026 Até Março/26');
    expect(wrapper.find('[data-testid="evolution-chart-floating-value"]').text()).toContain('18.248,97');
    expect(wrapper.find('[data-testid="evolution-header-primary-value"]').text()).toContain('18.248,97');
  });

  it('deve atualizar Detalhes da Evolução e Patrimônio Final ao selecionar qualquer mês no gráfico de barras', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Inicialmente Maio está pré-selecionado (index 4: +12,07%, +R$ 2.710,00)
    expect(wrapper.text()).toContain('Detalhes da evolução');
    expect(wrapper.text()).toContain('Maio/26');
    expect(wrapper.text()).toContain('2.710,00');
    expect(wrapper.text()).toContain('12,07%');

    // Clicar na barra do mês de Janeiro (index 0: -4.1%, -R$ 920,00)
    const bar0 = wrapper.find('[data-testid="evolution-bar-0"]');
    expect(bar0.exists()).toBe(true);
    await bar0.trigger('click');

    // Deve atualizar os detalhes da evolução e patrimônio final para Janeiro/26
    expect(wrapper.text()).toContain('Janeiro/26');
    expect(wrapper.text()).toContain('920,00');
    expect(wrapper.text()).toContain('4,10%');

    // Clicar na barra do mês de Outubro (index 9: -1.9%, -R$ 420,00)
    const bar9 = wrapper.find('[data-testid="evolution-bar-9"]');
    expect(bar9.exists()).toBe(true);
    await bar9.trigger('click');

    expect(wrapper.text()).toContain('Outubro/26');
    expect(wrapper.text()).toContain('420,00');
    expect(wrapper.text()).toContain('1,90%');
  });

  it('deve possuir transparência e evitar quebra de strings na informação flutuante do gráfico', async () => {
    const wrapper = mount(XpEvolutionTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Passar o mouse no ponto 4
    const point4 = wrapper.find('[data-testid="evolution-chart-point-4"]');
    await point4.trigger('mouseenter');

    const floatingBox = wrapper.find('[data-testid="evolution-chart-floating-value"]');
    expect(floatingBox.exists()).toBe(true);

    // Deve possuir classes de transparência (bg com opacidade reduzida e backdrop-blur)
    expect(floatingBox.classes()).toContain('backdrop-blur-md');
    // Deve conter classes para evitar quebras inadequadas de strings
    const pinSpan = floatingBox.find('span');
    expect(pinSpan.classes()).toContain('whitespace-nowrap');
  });
});
