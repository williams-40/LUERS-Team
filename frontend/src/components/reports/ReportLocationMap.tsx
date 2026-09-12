import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// Leaflet's default marker image paths break under Vite's asset bundling —
// sidestepping that with an inline SVG divIcon instead of patching
// L.Icon.Default.mergeOptions, which also lets the pin match the brand color.
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 6.5 11.15 7.24 11.8a1.15 1.15 0 0 0 1.52 0C13.5 21.15 20 15.25 20 10c0-4.42-3.58-8-8-8Z" fill="#2d5dc2" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="10" r="3" fill="white"/>
  </svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

interface ReportLocationMapProps {
  // The backend's latitude/longitude are DRF DecimalFields, which serialize
  // as strings over the wire despite the domain type claiming `number` —
  // accept both here and coerce below rather than trusting the type.
  latitude: number | string | null;
  longitude: number | string | null;
  locationAccuracy: number | null;
}

export function ReportLocationMap({ latitude, longitude, locationAccuracy }: ReportLocationMapProps) {
  const lat = latitude === null ? NaN : Number(latitude);
  const lng = longitude === null ? NaN : Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <p className="text-ink-muted bg-ink/4 mb-5 rounded-lg px-3 py-2 text-sm">Location not available</p>
    );
  }

  const position: [number, number] = [lat, lng];
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl">
        <MapContainer
          center={position}
          zoom={15}
          scrollWheelZoom={false}
          style={{ height: 320, width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locationAccuracy !== null && locationAccuracy > 0 && (
            <Circle center={position} radius={locationAccuracy} pathOptions={{ color: '#2d5dc2', fillOpacity: 0.1 }} />
          )}
          <Marker position={position} icon={pinIcon}>
            <Popup>
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-muted font-mono text-xs">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </span>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand shrink-0 text-xs font-semibold hover:underline"
        >
          Open in Google Maps ↗
        </a>
      </div>
    </div>
  );
}
