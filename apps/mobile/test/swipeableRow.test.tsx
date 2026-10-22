import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SwipeableRow } from '../src/components/SwipeableRow';

describe('SwipeableRow', () => {
  it('déclenche l’action depuis le bouton révélé et depuis l’action d’accessibilité', () => {
    const onAction = jest.fn();
    render(
      <SwipeableRow actionLabel="Supprimer la discussion" actionIcon="trash-outline" onAction={onAction}>
        <Text>Up O.</Text>
      </SwipeableRow>,
    );
    expect(screen.getByText('Up O.')).toBeOnTheScreen();
    // Ligne fermée : le bouton est caché aux lecteurs d'écran, qui passent par l'action d'accessibilité.
    fireEvent.press(screen.getByText('Supprimer la discussion', { includeHiddenElements: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
    // La racine rendue est la ligne, qui porte l'action d'accessibilité.
    fireEvent(screen.root, 'accessibilityAction', { nativeEvent: { actionName: 'action' } });
    expect(onAction).toHaveBeenCalledTimes(2);
  });
});
