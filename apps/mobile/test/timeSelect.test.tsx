import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TimeSelect } from '../src/components/FormBits';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe('TimeSelect', () => {
  it('ouvre les roues sur 09:00 sans valeur et confirme l’heure', () => {
    const onChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TimeSelect label="Heure précise (facultatif)" value={null} onChange={onChange} />
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByText('Choisir une heure'));
    fireEvent.press(screen.getByText('Confirmer'));
    expect(onChange).toHaveBeenCalledWith('09:00');
  });

  it('arrondit une heure existante aux 5 minutes et se règle au toucher d’une valeur', () => {
    const onChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TimeSelect label="Heure de départ" value="14:37" onChange={onChange} required />
      </SafeAreaProvider>,
    );
    // Heure obligatoire : pas de bouton pour l'effacer.
    expect(screen.queryByLabelText('Effacer')).toBeNull();
    fireEvent.press(screen.getByText('14:37'));
    fireEvent.press(screen.getByText('Confirmer'));
    expect(onChange).toHaveBeenLastCalledWith('14:35');
    fireEvent.press(screen.getByText('14:37'));
    fireEvent.press(screen.getByText('18'));
    fireEvent.press(screen.getByText('50'));
    fireEvent.press(screen.getByText('Confirmer'));
    expect(onChange).toHaveBeenLastCalledWith('18:50');
  });
});
