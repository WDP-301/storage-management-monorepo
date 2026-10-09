import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/** Carries a customer-facing Vietnamese message; every failure of a GPS lookup ends up here. */
export class LocationError extends Error {}

const LOOKUP_TIMEOUT_MS = 10_000;
// A fix from the last two minutes is close enough for a 5 km search and returns instantly.
const LAST_KNOWN_MAX_AGE_MS = 120_000;

/** Foreground-only GPS lookup for "Gần tôi"; asks for permission on first use. */
export async function getCurrentCoords(): Promise<Coords> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new LocationError(
      'Bạn chưa cho phép dùng vị trí. Hãy bật quyền vị trí cho app, hoặc tìm theo địa điểm.',
    );
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationError('Vị trí (GPS) đang tắt. Bật vị trí rồi thử lại.');
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
  }).catch(() => null);
  const position =
    lastKnown ??
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })));
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new LocationError('Không lấy được vị trí. Hãy thử lại ở nơi thoáng hơn.')),
      LOOKUP_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout])
    .catch((cause: unknown) => {
      throw cause instanceof LocationError
        ? cause
        : new LocationError('Không lấy được vị trí. Hãy thử lại.');
    })
    .finally(() => clearTimeout(timer));
}
