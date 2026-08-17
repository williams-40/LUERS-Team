export interface Coordinates {
  latitude: number;
  longitude: number;
  location_accuracy: number;
}

/** Resolves to null on denial/timeout/unsupported — location is always optional, never blocks submission. */
export function getCurrentLocation(timeoutMs = 8000): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          // Rounded to 6 decimal places (~11cm precision) to match the
          // backend's DecimalField(max_digits=9, decimal_places=6) — raw
          // GPS coordinates commonly carry more significant digits than
          // that and get rejected outright otherwise.
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          location_accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
