import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import XpPortfolioTab from '@/adapters/in/ui/components/XpPortfolioTab.vue';

describe('XpPortfolioTab Component (Estilo XP Print 4)', () => {
  it('deve renderizar o cabeçalho no estilo XP com avatar, título e pills', () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
        userName: 'Daniel',
        userInitials: 'DS',
      },
    });

    expect(wrapper.find('[data-testid="xp-portfolio-tab"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('DS');
    expect(wrapper.text()).toContain('Daniel');
    expect(wrapper.text()).toContain('31'); // badge de notificações
    expect(wrapper.text()).toContain('Minha carteira');

    // Sub-nav pills (Print 4)
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
  });

  it('deve renderizar o card de assessoria Liberta Digital com botão de contato e modal', async () => {
    const wrapper = mount(XpPortfolioTab, {
      props: {
        assets: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.text()).toContain('Assessoria de investimentos');
    expect(wrapper.text()).toContain('Sua assessoria');
    expect(wrapper.text()).toContain('Liberta Digital');

    const contatoBtn = wrapper.findAll('button').find((b) => b.text() === 'Contato');
    expect(contatoBtn).toBeDefined();
    await contatoBtn!.trigger('click');

    expect(wrapper.text()).toContain('Chamar no WhatsApp');
    expect(wrapper.text()).toContain('Enviar E-mail');
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
});
