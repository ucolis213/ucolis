import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DEFAULT_COMMISSION, DEFAULT_SETTINGS, toPublicConfig } from '@ucolis/shared';
import { CommissionBreakdown } from '../src/components/CommissionBreakdown';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function renderWithConfig(ui: ReactElement, enabled: boolean) {
  const client = new QueryClient();
  client.setQueryData(['app-config'], toPublicConfig({ ...DEFAULT_SETTINGS, commission: { ...DEFAULT_COMMISSION, enabled } }));
  return render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe('CommissionBreakdown', () => {
  it('détaille frais de dossier, commission et gains nets', () => {
    renderWithConfig(<CommissionBreakdown grossPrice={2500} />, true);
    expect(screen.getByText("Prix convenu avec l'expéditeur")).toBeOnTheScreen();
    expect(screen.getByText('Commission de service (12 %)')).toBeOnTheScreen();
    expect(screen.getByText(/^- 300/)).toBeOnTheScreen();
    expect(screen.getByText(/^- 50/)).toBeOnTheScreen();
    expect(screen.getByText(/^2.150/)).toBeOnTheScreen();
  });

  it('ouvre la grille depuis l’icône d’information', () => {
    renderWithConfig(<CommissionBreakdown grossPrice={2500} />, true);
    fireEvent.press(screen.getByRole('button', { name: 'Comprendre la commission' }));
    expect(screen.getByText('Grille de commission')).toBeOnTheScreen();
    expect(screen.getByText(/^Moins de 1.000/)).toBeOnTheScreen();
    expect(screen.getByText(/^Plus de 10.000/)).toBeOnTheScreen();
  });

  it('ne s’affiche pas tant que le service est gratuit', () => {
    renderWithConfig(<CommissionBreakdown grossPrice={2500} />, false);
    expect(screen.queryByText('Vos gains nets')).toBeNull();
  });

  it('affiche la commission figée sur le colis et son état', () => {
    const frozen = { grossPrice: 800, fixedFee: 50, ratePercent: 15, variableCommission: 120, totalCommission: 170, netEarnings: 630, status: 'pending' as const, chargedAt: null };
    renderWithConfig(<CommissionBreakdown grossPrice={800} frozen={frozen} />, false);
    expect(screen.getByText('Commission de service (15 %)')).toBeOnTheScreen();
    expect(screen.getByText('Prélevée sur votre portefeuille à la livraison')).toBeOnTheScreen();
  });
});
