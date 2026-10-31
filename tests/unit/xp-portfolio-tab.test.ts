import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import XpPortfolioTab from '@/adapters/in/ui/components/XpPortfolioTab.vue';

describe('XpPortfolioTab Component (Estilo XP Print 4)', () => {
  it('deve renderizar o cabeçalho da carteira com título e pills de visualização', () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="xp-portfolio-tab"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Minha carteira');

    // Sub-nav pills
    expect(wrapper.text()).toContain('Classe');
    expect(wrapper.text()).toContain('Liquidez');
    expect(wrapper.text()).toContain('Instituição');
    expect(wrapper.text()).toContain('Ativos');
    expect(wrapper.text()).toContain('Objetivos');
  });

  it('deve renderizar o anel donut svg e o total investido', () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('svg circle').exists()).toBe(true);
    expect(wrapper.text()).toContain('Total investido');
    expect(wrapper.text()).toContain('Atualizado em 21/10/2026');
  });

  it('deve listar as classes de ativos com valores, percentuais e rentabilidades positivas ▲', () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('Renda Variável Global');
    expect(wrapper.text()).toContain('74%');
    expect(wrapper.text()).toContain('21,37%');

    expect(wrapper.text()).toContain('Renda Variável Brasil');
    expect(wrapper.text()).toContain('22%');
    expect(wrapper.text()).toContain('10,03%');

    expect(wrapper.text()).toContain('Pós-Fixado');
    expect(wrapper.text()).toContain('1,5%');
    expect(wrapper.text()).toContain('12,47%');

    expect(wrapper.text()).toContain('Proventos');
    expect(wrapper.text()).toContain('< 1%');
  });

  it('deve permitir alternar para as pills Liquidez, Instituição, Ativos e Objetivos', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Clicar em Instituição
    const instBtn = wrapper.findAll('button').find((b) => b.text() === 'Instituição');
    expect(instBtn).toBeDefined();
    await instBtn!.trigger('click');
    expect(wrapper.text()).toContain('XP Investimentos');

    // Clicar em Liquidez
    const liquidezBtn = wrapper.findAll('button').find((b) => b.text() === 'Liquidez');
    expect(liquidezBtn).toBeDefined();
    await liquidezBtn!.trigger('click');
    expect(wrapper.text()).toContain('D+0 (Reserva / Imediata)');
    expect(wrapper.text()).toContain('D+1 / D+2');

    // Clicar em Objetivos
    const objBtn = wrapper.findAll('button').find((b) => b.text() === 'Objetivos');
    expect(objBtn).toBeDefined();
    await objBtn!.trigger('click');
    expect(wrapper.text()).toContain('Independência Financeira (FIRE)');
  });

  it('deve expandir o detalhamento de ativos ao clicar na classe', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).not.toContain('IVVB11');

    // Clicar na primeira linha (Renda Variável Global)
    const globalRow = wrapper.findAll('.cursor-pointer').find((el) => el.text().includes('Renda Variável Global'));
    expect(globalRow).toBeDefined();
    await globalRow!.trigger('click');

    expect(wrapper.text()).toContain('IVVB11');
    expect(wrapper.text()).toContain('54 cotas');

    // Clicar em Renda Variável Brasil para expandir seus ativos
    const brasilRow = wrapper.find('[data-testid="portfolio-category-brasil"]');
    expect(brasilRow.exists()).toBe(true);
    await brasilRow.trigger('click');

    expect(wrapper.text()).toContain('HGLG11');
    expect(wrapper.text()).toContain('PETR4');
  });

  it('não deve exibir cabeçalho de nome/busca/bandeira nem card de assessoria desnecessários', () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).not.toContain('Assessoria de investimentos');
    expect(wrapper.text()).not.toContain('Liberta Digital');
  });

  it('deve mascarar os valores quando a privacidade estiver ativa', () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: true,
      },
    });

    expect(wrapper.text()).toContain('R$ •••••');
  });

  it('deve explicar como funcionam os Objetivos através de uma dica clicável (hint) e permitir criar, editar e excluir objetivos', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    const objBtn = wrapper.findAll('button').find((b) => b.text() === 'Objetivos');
    await objBtn!.trigger('click');

    expect(wrapper.find('[data-testid="objectives-explainer-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Como funcionam seus Objetivos?');

    // O texto explicativo deve começar recolhido (hint fechada) e abrir ao clicar
    expect(wrapper.find('[data-testid="objectives-hint-content"]').exists()).toBe(false);
    const hintBtn = wrapper.find('[data-testid="btn-toggle-objectives-hint"]');
    expect(hintBtn.exists()).toBe(true);
    await hintBtn.trigger('click');
    expect(wrapper.find('[data-testid="objectives-hint-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="objectives-hint-content"]').text()).toContain('classes vinculadas');

    // Clicar novamente fecha a hint
    await hintBtn.trigger('click');
    expect(wrapper.find('[data-testid="objectives-hint-content"]').exists()).toBe(false);

    // Criar novo objetivo
    await wrapper.find('[data-testid="btn-add-objective"]').trigger('click');
    await wrapper.find('[data-testid="input-objective-name"]').setValue('Compra de Imóvel Residencial Familiar');
    await wrapper.find('[data-testid="input-objective-target"]').setValue('15');
    await wrapper.find('[data-testid="btn-save-objective"]').trigger('click');

    expect(wrapper.text()).toContain('Compra de Imóvel Residencial Familiar');

    // Editar objetivo existente
    await wrapper.find('[data-testid="btn-edit-objective-aposentadoria"]').trigger('click');
    await wrapper.find('[data-testid="input-objective-name"]').setValue('Aposentadoria Global');
    await wrapper.find('[data-testid="btn-save-objective"]').trigger('click');

    expect(wrapper.text()).toContain('Aposentadoria Global');

    // Excluir objetivo
    await wrapper.find('[data-testid="btn-delete-objective-seguranca"]').trigger('click');
    expect(wrapper.text()).not.toContain('Colchão de Oportunidade');
  });

  it('deve exibir o título completo de cada objetivo na primeira linha (sem reticências/truncate) e valor total + quantidade de ativos na segunda linha', async () => {
    window.localStorage.clear();
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    const objBtn = wrapper.findAll('button').find((b) => b.text() === 'Objetivos');
    await objBtn!.trigger('click');

    const titleEl = wrapper.find('[data-testid="category-title-aposentadoria"]');
    expect(titleEl.exists()).toBe(true);
    expect(titleEl.text()).toBe('Independência Financeira (FIRE)');
    expect(titleEl.classes()).not.toContain('truncate');

    const totalEl = wrapper.find('[data-testid="category-total-aposentadoria"]');
    const countEl = wrapper.find('[data-testid="category-count-aposentadoria"]');
    expect(totalEl.exists()).toBe(true);
    expect(totalEl.text()).toContain('R$');
    expect(countEl.exists()).toBe(true);
    expect(countEl.text()).toContain('ativos');

    // Botões de editar e excluir permanecem presentes no cabeçalho do objetivo
    expect(wrapper.find('[data-testid="btn-edit-objective-aposentadoria"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-delete-objective-aposentadoria"]').exists()).toBe(true);
  });

  it('deve garantir seleção única ao clicar em uma categoria e depois em outra (sem deixar duas com highlight)', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    const chipGlobal = wrapper.find('[data-testid="donut-chip-global"]');
    const chipBrasil = wrapper.find('[data-testid="donut-chip-brasil"]');
    const rowGlobal = wrapper.find('[data-testid="portfolio-category-global"]');
    const rowBrasil = wrapper.find('[data-testid="portfolio-category-brasil"]');

    // Inicialmente nenhuma categoria selecionada
    expect(chipGlobal.attributes('data-selected')).toBe('false');
    expect(chipBrasil.attributes('data-selected')).toBe('false');
    expect(rowGlobal.attributes('data-selected')).toBe('false');
    expect(rowBrasil.attributes('data-selected')).toBe('false');

    // Clicar na primeira categoria (Renda Variável Global)
    await chipGlobal.trigger('click');
    expect(chipGlobal.attributes('data-selected')).toBe('true');
    expect(rowGlobal.attributes('data-selected')).toBe('true');
    expect(chipBrasil.attributes('data-selected')).toBe('false');
    expect(rowBrasil.attributes('data-selected')).toBe('false');
    expect(wrapper.text()).toContain('IVVB11');

    // Mesmo se o mouse passar por cima de outra categoria, apenas uma pode ter data-selected="true"
    await chipBrasil.trigger('mouseenter');
    const selectedChipsAfterHover = wrapper
      .findAll('[data-testid^="donut-chip-"]')
      .filter((el) => el.attributes('data-selected') === 'true');
    expect(selectedChipsAfterHover.length).toBe(1);

    // Clicar na segunda categoria (Renda Variável Brasil): deve desmarcar a primeira e marcar apenas a segunda
    await chipBrasil.trigger('click');
    expect(chipGlobal.attributes('data-selected')).toBe('false');
    expect(rowGlobal.attributes('data-selected')).toBe('false');
    expect(chipBrasil.attributes('data-selected')).toBe('true');
    expect(rowBrasil.attributes('data-selected')).toBe('true');

    // Os ativos da primeira categoria fecham e abrem apenas os da segunda
    expect(wrapper.text()).not.toContain('IVVB11');
    expect(wrapper.text()).toContain('PETR4');

    // Clicar novamente na segunda categoria desmarca tudo
    await rowBrasil.trigger('click');
    expect(chipBrasil.attributes('data-selected')).toBe('false');
    expect(rowBrasil.attributes('data-selected')).toBe('false');
    expect(wrapper.text()).not.toContain('PETR4');
  });

  it('deve sincronizar filtros de classe, instituição e pills sem manter estados conflitantes', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [
          {
            id: 'a-1',
            tickerOrName: 'IVVB11',
            assetClass: 'internacional',
            institution: 'XP Investimentos',
            totalQuantity: 10,
            averagePriceInCents: 25000,
            currentPriceInCents: 30000,
            targetPercent: 50,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'a-2',
            tickerOrName: 'WEGE3',
            assetClass: 'acoes_br',
            institution: 'BTG Pactual',
            totalQuantity: 20,
            averagePriceInCents: 3500,
            currentPriceInCents: 4000,
            targetPercent: 50,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        isPrivacyActive: false,
      },
    });

    // Selecionar uma categoria na aba Classe
    await wrapper.find('[data-testid="portfolio-category-internacional"]').trigger('click');
    expect(wrapper.find('[data-testid="portfolio-category-internacional"]').attributes('data-selected')).toBe('true');

    // Trocar para a pill Liquidez deve limpar a seleção anterior
    await wrapper.find('[data-testid="portfolio-pill-liquidez"]').trigger('click');
    const selectedInLiquidez = wrapper
      .findAll('[data-testid^="portfolio-category-"]')
      .filter((el) => el.attributes('data-selected') === 'true');
    expect(selectedInLiquidez.length).toBe(0);

    // Ir para a pill Ativos e testar filtros de classe
    await wrapper.find('[data-testid="portfolio-pill-ativos"]').trigger('click');
    expect(wrapper.find('[data-testid="class-filter-btn-ALL"]').attributes('data-selected')).toBe('true');

    // Filtrar por Ações BR (acoes_br) via botão de filtro
    await wrapper.find('[data-testid="class-filter-btn-acoes_br"]').trigger('click');
    expect(wrapper.find('[data-testid="class-filter-btn-ALL"]').attributes('data-selected')).toBe('false');
    expect(wrapper.find('[data-testid="class-filter-btn-acoes_br"]').attributes('data-selected')).toBe('true');
    expect(wrapper.find('[data-testid="donut-chip-acoes_br"]').attributes('data-selected')).toBe('true');
    expect(wrapper.find('[data-testid="donut-chip-internacional"]').attributes('data-selected')).toBe('false');
    expect(wrapper.text()).toContain('WEGE3');
    expect(wrapper.text()).not.toContain('IVVB11');

    // Clicar em outro card do donut (internacional) enquanto na aba Ativos deve trocar o filtro único
    await wrapper.find('[data-testid="donut-chip-internacional"]').trigger('click');
    expect(wrapper.find('[data-testid="class-filter-btn-internacional"]').attributes('data-selected')).toBe('true');
    expect(wrapper.find('[data-testid="class-filter-btn-acoes_br"]').attributes('data-selected')).toBe('false');
    expect(wrapper.find('[data-testid="donut-chip-internacional"]').attributes('data-selected')).toBe('true');
    expect(wrapper.find('[data-testid="donut-chip-acoes_br"]').attributes('data-selected')).toBe('false');
    expect(wrapper.text()).toContain('IVVB11');
    expect(wrapper.text()).not.toContain('WEGE3');
  });
});
