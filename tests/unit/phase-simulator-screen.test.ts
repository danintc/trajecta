import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PhaseSimulatorScreen from '@/adapters/in/ui/screens/PhaseSimulatorScreen.vue';
import { Asset } from '@/core/domain/asset.entity';
import { CareerRecord } from '@/core/domain/career.entity';

describe('PhaseSimulatorScreen Component', () => {
  const mockAssets: Asset[] = [
    {
      id: 'ast-1',
      tickerOrName: 'Tesouro Selic 2029',
      assetClass: 'renda_fixa',
      institution: 'XP Investimentos',
      totalQuantity: 10,
      averagePriceInCents: 1000000,
      currentPriceInCents: 1000000, // 10 * 10.000 = R$ 100.000,00
      targetPercent: 50,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockCareerRecords: CareerRecord[] = [
    {
      id: 'cr-1',
      role: 'Engenheiro de Software Sênior',
      company: 'TechCorp',
      startDate: '2024-01-01',
      grossSalaryInCents: 1500000, // R$ 15.000,00
      netSalaryInCents: 1100000,
      changeReason: 'promocao',
      mealAllowanceInCents: 100000,
      annualBonusEstimatedInCents: 3000000,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  it('deve renderizar a tela com título, metodologia Trajecta, gauge e gráfico', () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: mockAssets,
        careerRecords: mockCareerRecords,
        transactions: [],
        isPrivacyActive: false,
      },
    });

    expect(wrapper.find('[data-testid="screen-phase-simulator"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Simulador de Renda & Fases do Investidor');
    expect(wrapper.text()).toContain('Metodologia Trajecta');
    expect(wrapper.text()).not.toContain('Canal do Holder');
    expect(wrapper.text()).not.toContain('Fábio');
    expect(wrapper.text()).toContain('Construção');
    expect(wrapper.text()).toContain('Transição');
    expect(wrapper.text()).toContain('Manutenção');
    expect(wrapper.text()).toContain('Trajetórias Comparativas de Patrimônio');
    expect(wrapper.text()).toContain('Poder dos Primeiros 5 Anos');
  });

  it('deve controlar a sincronização com dados reais do Trajecta via checkbox e bloquear campos', async () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: mockAssets,
        careerRecords: mockCareerRecords,
        transactions: [],
        isPrivacyActive: false,
      },
    });

    const checkbox = wrapper.find('input[data-testid="sync-trajecta-checkbox"]');
    expect(checkbox.exists()).toBe(true);
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    const incomeInput = wrapper.find('input[placeholder="Ex: 10.000,00"]');
    const netWorthInput = wrapper.find('input[placeholder="Ex: 100.000,00"]');

    // Inicialmente, os campos estão desbloqueados
    expect(incomeInput.attributes('disabled')).toBeUndefined();
    expect(netWorthInput.attributes('disabled')).toBeUndefined();

    // Ativa o checkbox de sincronização
    await checkbox.setValue(true);

    // Campos devem refletir os dados reais da carteira e carreira
    expect((incomeInput.element as HTMLInputElement).value).toBe('15.000,00');
    expect((netWorthInput.element as HTMLInputElement).value).toBe('100.000,00');

    // Campos devem estar bloqueados com o atributo disabled
    expect(incomeInput.attributes('disabled')).toBeDefined();
    expect(netWorthInput.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('🔒 Sincronizado');

    // Desativa o checkbox
    await checkbox.setValue(false);

    // Campos voltam a ser editáveis
    expect(incomeInput.attributes('disabled')).toBeUndefined();
    expect(netWorthInput.attributes('disabled')).toBeUndefined();
  });

  it('deve alternar para a aba Evolução Mês a Mês e exibir tabela e resumo', async () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: mockAssets,
        careerRecords: mockCareerRecords,
        transactions: [],
        isPrivacyActive: false,
      },
    });

    const monthlyTabBtn = wrapper.find('button[data-testid="tab-monthly"]');
    expect(monthlyTabBtn.exists()).toBe(true);

    await monthlyTabBtn.trigger('click');

    expect(wrapper.text()).toContain('Evolução Patrimonial e Renda Passiva Mês a Mês');
    expect(wrapper.text()).toContain('Aportes no Período');
    expect(wrapper.text()).toContain('Juros / Rendimentos Gerados');
    expect(wrapper.text()).toContain('Mês 1');
    expect(wrapper.text()).toContain('Ano 1');
    expect(wrapper.text()).toContain('/mês');
  });

  it('deve alternar para o preset de Transição (R$ 500k) e Manutenção (R$ 5M) ao clicar nos botões de preset', async () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: [],
        careerRecords: [],
        transactions: [],
        isPrivacyActive: false,
      },
    });

    // Clicar no preset 2: Transição
    const transBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('2. Transição'));
    expect(transBtn).toBeDefined();
    await transBtn!.trigger('click');

    expect(wrapper.text()).toContain('Fase: Transição');
    expect(wrapper.text()).toContain('7.2%');

    // Clicar no preset 3: Manutenção
    const manBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('3. Manutenção'));
    expect(manBtn).toBeDefined();
    await manBtn!.trigger('click');

    expect(wrapper.text()).toContain('Fase: Manutenção');
    expect(wrapper.text()).toContain('3.12%');
    expect(wrapper.text()).toContain('Impacto quase nulo: novos aportes não mudam o futuro');
  });

  it('deve ocultar valores numéricos sensíveis quando isPrivacyActive for true', async () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: mockAssets,
        careerRecords: mockCareerRecords,
        transactions: [],
        isPrivacyActive: true,
      },
    });

    // Deve conter marcas de privacidade nas tabelas e cards
    expect(wrapper.text()).toContain('••••');
  });

  it('deve permitir editar valores a qualquer momento deslocando dígitos para a esquerda e mantendo 2 casas decimais e milhar', async () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: [],
        careerRecords: [],
        transactions: [],
        isPrivacyActive: false,
      },
    });

    const incomeInput = wrapper.find('input[placeholder="Ex: 10.000,00"]');
    const aporteInput = wrapper.find('input[placeholder="Ex: 3.000,00"]');
    const netWorthInput = wrapper.find('input[placeholder="Ex: 100.000,00"]');

    // Teste 1: Apagar um dígito de 3.000,00 ("3.000,0") desloca para 300,00 e digitar novo dígito ("300,005") desloca para 3.000,05
    await aporteInput.setValue('3.000,0');
    await aporteInput.trigger('input');
    expect((aporteInput.element as HTMLInputElement).value).toBe('300,00');

    await aporteInput.setValue('300,005');
    await aporteInput.trigger('input');
    expect((aporteInput.element as HTMLInputElement).value).toBe('3.000,05');

    // Teste 2: Digitar 710000 resulta em 7.100,00
    await incomeInput.setValue('710000');
    await incomeInput.trigger('input');
    expect((incomeInput.element as HTMLInputElement).value).toBe('7.100,00');

    // Teste 3: Digitar 2300000 resulta em 23.000,00
    await netWorthInput.setValue('2300000');
    await netWorthInput.trigger('input');
    expect((netWorthInput.element as HTMLInputElement).value).toBe('23.000,00');

    // Teste 4: Slider deve ir de 0 a 100%
    const slider = wrapper.find('input[type="range"]');
    expect(slider.attributes('min')).toBe('0');
    expect(slider.attributes('max')).toBe('100');
    expect(wrapper.text()).toContain('100%');
  });

  it('deve respeitar o valor 0% nos campos de Retorno e Renda Passiva sem cair no fallback de 12% ou 6%', async () => {
    const wrapper = mount(PhaseSimulatorScreen, {
      props: {
        assets: [],
        careerRecords: [],
        transactions: [],
        isPrivacyActive: false,
      },
    });

    const numberInputs = wrapper.findAll('input[type="number"]');
    const returnInput = numberInputs[0];
    const passiveInput = numberInputs[1];

    // Quando Retorno = 0% e Renda Passiva = 0%, Patrimônio Inicial (R$ 100k) + 360 aportes de R$ 3k (R$ 1.080.000) = R$ 1.180.000,00 (sem juros)
    await returnInput.setValue(0);
    await passiveInput.setValue(0);

    expect(wrapper.text()).toContain('Juros Compostos (0% a.a.)');
    expect(wrapper.text()).toContain('1.180.000,00');
    expect(wrapper.text()).toContain('460.000,00');
    expect(wrapper.text()).toContain('280.000,00');
    expect(wrapper.text()).toContain('0,00% a.m.');
  });
});

