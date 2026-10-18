import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';

describe('Button', () => {
  it('déclenche onPress', () => {
    const onPress = jest.fn();
    render(<Button label="Publier" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Publier' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('est désactivé pendant le chargement', () => {
    const onPress = jest.fn();
    render(<Button label="Publier" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Publier' });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('traduit la clé d’erreur sous le champ', () => {
    render(<TextField label="Téléphone" error="validation.phone" />);
    expect(screen.getByText(/Numéro algérien invalide/)).toBeOnTheScreen();
  });

  it('affiche l’aide en l’absence d’erreur', () => {
    render(<TextField label="Téléphone" hint="Ex. 0551 23 45 67" />);
    expect(screen.getByText('Ex. 0551 23 45 67')).toBeOnTheScreen();
  });
});
