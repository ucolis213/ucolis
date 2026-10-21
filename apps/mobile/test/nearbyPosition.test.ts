import * as Location from 'expo-location';
import { api } from '../src/api/client';
import { POSITION_INTERVAL_MS, reportPosition, resetReportedPosition } from '../src/tracking/nearbyPosition';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../src/api/client', () => ({ api: { put: jest.fn() } }));

const loc = Location as jest.Mocked<typeof Location>;
const put = api.put as jest.Mock;
const granted = { status: 'granted', granted: true } as never;
const T0 = 1_000_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  resetReportedPosition();
  loc.getForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 35.7, longitude: -0.63 } } as never);
});

describe('position du transporteur (colis proches)', () => {
  it('envoie la position, puis au plus une fois par quart d’heure', async () => {
    expect(await reportPosition(T0)).toBe(true);
    expect(put).toHaveBeenCalledWith('/me/position', { lat: 35.7, lng: -0.63 });
    expect(await reportPosition(T0 + 5 * 60_000)).toBe(false);
    expect(await reportPosition(T0 + POSITION_INTERVAL_MS)).toBe(true);
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('demande l’autorisation une seule fois et respecte un refus', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', granted: false } as never);
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false } as never);
    expect(await reportPosition(T0)).toBe(false);
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);

    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false } as never);
    expect(await reportPosition(T0 + POSITION_INTERVAL_MS)).toBe(false);
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  });
});
