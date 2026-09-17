import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetWorthLineChart } from '@/adapters/in/ui/components/NetWorthLineChart';

describe('NetWorthLineChart Component', () => {
  it('deve renderizar o gráfico de linha com patrimônio líquido e benchmark CDI', () => {
    render(
      <NetWorthLineChart
        currentNetWorthInCents={15979766}
        isPrivacyActive={false}
      />
    );

    expect(screen.getByTestId('net-worth-line-chart')).toBeInTheDocument();
    expect(screen.getByText('Patrimônio Líquido')).toBeInTheDocument();
    expect(screen.getByText(/100% CDI/i)).toBeInTheDocument();
    expect(screen.getByText(/Superando CDI/i)).toBeInTheDocument();
  });

  it('deve lidar com o estado zero-data (clean slate) sem falhar ou dividir por zero', () => {
    render(
      <NetWorthLineChart
        currentNetWorthInCents={0}
        isPrivacyActive={false}
      />
    );

    expect(screen.getByTestId('net-worth-line-chart')).toBeInTheDocument();
    expect(screen.getAllByText('+0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Superando CDI/i)).not.toBeInTheDocument();
  });

  it('deve ocultar valores em modo privacidade', () => {
    render(
      <NetWorthLineChart
        currentNetWorthInCents={15979766}
        isPrivacyActive={true}
      />
    );

    const maskedValues = screen.getAllByText('R$ •••••');
    expect(maskedValues.length).toBeGreaterThanOrEqual(1);
  });
});
