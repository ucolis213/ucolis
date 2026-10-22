import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { CodeInput } from '../src/components/CodeInput';

function Harness({ length, onComplete }: { length: number; onComplete: (code: string) => void }) {
  const [code, setCode] = useState('');
  return <CodeInput label="Code" length={length} value={code} onChange={setCode} onComplete={onComplete} />;
}

describe('CodeInput', () => {
  it('affiche une case par chiffre et ne garde que les chiffres', () => {
    const onComplete = jest.fn();
    render(<Harness length={6} onComplete={onComplete} />);
    const input = screen.getByLabelText('Code');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.maxLength).toBe(6);

    fireEvent.changeText(input, '32a4');
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('4')).toBeOnTheScreen();
    expect(onComplete).not.toHaveBeenCalled();

    // Code collé ou proposé par le clavier : tronqué à la longueur attendue.
    fireEvent.changeText(input, '32467598');
    expect(onComplete).toHaveBeenCalledWith('324675');
    expect(screen.getByText('5')).toBeOnTheScreen();
    expect(screen.queryByText('9')).toBeNull();
  });

  it('s’adapte à la longueur du code de remise', () => {
    const onComplete = jest.fn();
    render(<Harness length={4} onComplete={onComplete} />);
    fireEvent.changeText(screen.getByLabelText('Code'), '1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
    expect(screen.getByLabelText('Code').props.maxLength).toBe(4);
  });
});
