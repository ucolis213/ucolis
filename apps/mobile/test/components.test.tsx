import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { PhotoViewer } from '../src/components/PhotoViewer';
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

describe('PhotoViewer', () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
  const renderWithInsets = (ui: ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
  const photos = [
    { url: 'https://res.cloudinary.com/x/image/upload/a.jpg', publicId: 'a', kind: 'image' as const },
    { url: 'https://res.cloudinary.com/x/image/upload/b.jpg', publicId: 'b', kind: 'image' as const },
  ];

  it('se ferme par le bouton Fermer', () => {
    const onClose = jest.fn();
    renderWithInsets(<PhotoViewer photos={photos} index={0} onClose={onClose} />);
    fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('n’affiche rien quand aucune photo n’est ouverte', () => {
    renderWithInsets(<PhotoViewer photos={photos} index={null} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull();
  });
});
