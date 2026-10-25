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
    expect(wrapper.text()).toContain('Produto');
    expect(wrapper.text()).toContain('Liquidez');
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

  it('deve permitir alternar para as pills Produto, Liquidez, Ativos e Objetivos', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    // Clicar em Produto
    const produtoBtn = wrapper.findAll('button').find((b) => b.text() === 'Produto');
    expect(produtoBtn).toBeDefined();
    await produtoBtn!.trigger('click');
    expect(wrapper.text()).toContain('ETFs & Fundos Internacionais');
    expect(wrapper.text()).toContain('Ações Nacionais (B3)');

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

  it('deve expandir o detalhamento de ativos ao clicar na classe ou em determinado produto (ex: Fundos Imobiliários)', async () => {
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

    // Mudar para a aba Produto e clicar em Fundos Imobiliários (FIIs) para expandir seus ativos
    const produtoBtn = wrapper.findAll('button').find((b) => b.text() === 'Produto');
    await produtoBtn!.trigger('click');

    expect(wrapper.text()).not.toContain('HGLG11');
    const fiisProdRow = wrapper.find('[data-testid="portfolio-category-fiis_prod"]');
    expect(fiisProdRow.exists()).toBe(true);
    await fiisProdRow.trigger('click');

    expect(wrapper.text()).toContain('HGLG11');
    expect(wrapper.text()).toContain('10 cotas');
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

  it('deve explicar como funcionam os Objetivos e permitir criar, editar e excluir objetivos', async () => {
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

    // Criar novo objetivo
    await wrapper.find('[data-testid="btn-add-objective"]').trigger('click');
    await wrapper.find('[data-testid="input-objective-name"]').setValue('Compra de Imóvel');
    await wrapper.find('[data-testid="input-objective-target"]').setValue('15');
    await wrapper.find('[data-testid="btn-save-objective"]').trigger('click');

    expect(wrapper.text()).toContain('Compra de Imóvel');

    // Editar objetivo existente
    await wrapper.find('[data-testid="btn-edit-objective-aposentadoria"]').trigger('click');
    await wrapper.find('[data-testid="input-objective-name"]').setValue('Aposentadoria Global');
    await wrapper.find('[data-testid="btn-save-objective"]').trigger('click');

    expect(wrapper.text()).toContain('Aposentadoria Global');

    // Excluir objetivo
    await wrapper.find('[data-testid="btn-delete-objective-seguranca"]').trigger('click');
    expect(wrapper.text()).not.toContain('Colchão de Oportunidade');
  });
});
