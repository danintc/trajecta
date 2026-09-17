import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DonutChart, DonutSlice } from '@/adapters/in/ui/components/DonutChart';

describe('DonutChart Component', () => {
  const mockSlices: DonutSlice[] = [
    { label: 'Contas & Caixa', valueInCents: 85000, color: '#38BDF8', percent: 5.3 },
    { label: 'Renda Fixa & Tesouro', valueInCents: 660000, color: '#10B981', percent: 41 },
    { label: 'Fundos Imobiliários', valueInCents: 405000, color: '#A855F7', percent: 25.2 },
    { label: 'Ações Brasileiras', valueInCents: 458400, color: '#6366F1', percent: 28.5 },
  ];

  it('deve renderizar o gráfico rosquinha com fatias, legenda e total no centro', () => {
    render(
      <DonutChart
        testId="test-donut"
        slices={mockSlices}
        totalFormatted="R$ 160.840,00"
        emptyText="Sem registros"
        isPrivacyActive={false}
      />
    );

    expect(screen.getByTestId('test-donut')).toBeInTheDocument();
    expect(screen.getByTestId('donut-center-label')).toHaveTextContent('TOTAL');
    expect(screen.getByTestId('donut-center-value')).toHaveTextContent('R$ 160.840,00');
    expect(screen.getByText('Contas & Caixa')).toBeInTheDocument();
    expect(screen.getByText('Renda Fixa & Tesouro')).toBeInTheDocument();
    expect(screen.getByText('Fundos Imobiliários')).toBeInTheDocument();
    expect(screen.getByText('Ações Brasileiras')).toBeInTheDocument();
  });

  it('deve garantir que o hover na fatia Renda Fixa ativa Renda Fixa e NÃO Ações Brasileiras', () => {
    render(
      <DonutChart
        testId="slice-hover-donut"
        slices={mockSlices}
        totalFormatted="R$ 160.840,00"
        emptyText="Sem registros"
        isPrivacyActive={false}
      />
    );

    // Fatia 1 é Renda Fixa & Tesouro
    const rendaFixaPath = screen.getByTestId('donut-slice-1');
    expect(rendaFixaPath).toBeInTheDocument();

    // Dispara hover na fatia 1 (Renda Fixa & Tesouro)
    fireEvent.mouseEnter(rendaFixaPath);

    // O centro DEVE exibir Renda Fixa & Tesouro (e seu valor), NUNCA Ações Brasileiras
    expect(screen.getByTestId('donut-center-label')).toHaveTextContent(/Renda Fixa/i);
    expect(screen.getByTestId('donut-center-value')).toHaveTextContent('R$ 6.600,00');

    // Ao sair com o mouse, deve voltar ao TOTAL
    fireEvent.mouseLeave(rendaFixaPath);
    expect(screen.getByTestId('donut-center-label')).toHaveTextContent('TOTAL');
    expect(screen.getByTestId('donut-center-value')).toHaveTextContent('R$ 160.840,00');

    // Agora hover na fatia 3 (Ações Brasileiras)
    const acoesPath = screen.getByTestId('donut-slice-3');
    fireEvent.mouseEnter(acoesPath);
    expect(screen.getByTestId('donut-center-label')).toHaveTextContent(/Ações Brasile/i);
    expect(screen.getByTestId('donut-center-value')).toHaveTextContent('R$ 4.584,00');
  });

  it('deve renderizar o mesmo donut em cinza com R$ 0,00 no estado zero-data (clean slate)', () => {
    render(
      <DonutChart
        testId="empty-donut"
        slices={[]}
        totalFormatted="R$ 0,00"
        emptyText="Nenhum ativo ou saldo registrado"
        isPrivacyActive={false}
      />
    );

    expect(screen.getByTestId('empty-donut')).toBeInTheDocument();
    expect(screen.getByTestId('donut-center-label')).toHaveTextContent('TOTAL');
    const zeroTexts = screen.getAllByText('R$ 0,00');
    expect(zeroTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Nenhum ativo ou saldo registrado')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('deve ocultar valores em modo privacidade', () => {
    render(
      <DonutChart
        testId="privacy-donut"
        slices={mockSlices}
        totalFormatted="R$ •••••"
        emptyText="Sem registros"
        isPrivacyActive={true}
      />
    );

    const maskedItems = screen.getAllByText('R$ •••••');
    expect(maskedItems.length).toBeGreaterThanOrEqual(2);
  });
});
