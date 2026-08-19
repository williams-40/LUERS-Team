import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { fetchReportQueue } from '../../lib/reports-api';
import { Urgency } from '../../types/domain';

// Distinct from ReportLocationMap's single-report pin — red and pulsing,
// matching ReportCard's urgency treatment, so an active emergency reads as
// urgent on the map the same way it does in the queue list.
const emergencyPinIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="animate-pulse motion-reduce:animate-none">
    <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 6.5 11.15 7.24 11.8a1.15 1.15 0 0 0 1.52 0C13.5 21.15 20 15.25 20 10c0-4.42-3.58-8-8-8Z" fill="#d03b3b" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="10" r="3" fill="white"/>
  </svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function FitToMarkers({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [32, 32] });
    }
  }, [map, positions]);
  return null;
}

/**
 * The first "map of many reports" view in this app — ReportLocationMap only
 * ever shows one report's own detail page. Reuses the same react-leaflet +
 * custom-SVG-pin approach, just with multiple markers.
 */
export function ActiveEmergenciesMap() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'active-emergencies-map'],
    queryFn: () => fetchReportQueue({ urgency: Urgency.PANIC, active: true }),
    refetchInterval: 30_000,
  });

  const reports = data?.page.results ?? [];
  const located = reports.filter(
    (r): r is typeof r & { latitude: number; longitude: number } => r.latitude !== null && r.longitude !== null,
  );
  const positions: [number, number][] = located.map((r) => [Number(r.latitude), Number(r.longitude)]);

  if (isLoading) {
    return <div className="bg-ink/4 mb-6 h-72 animate-pulse rounded-xl" />;
  }

  if (reports.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-ink-secondary text-[12.5px] font-semibold">
          Active emergencies ({reports.length})
        </h2>
        {reports.length > located.length && (
          <span className="text-ink-muted text-xs">
            {reports.length - located.length} without a location
          </span>
        )}
      </div>
      {located.length > 0 ? (
        <div className="overflow-hidden rounded-xl">
          <MapContainer
            center={positions[0]}
            zoom={15}
            scrollWheelZoom={false}
            style={{ height: 288, width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToMarkers positions={positions} />
            {located.map((report) => (
              <Marker key={report.id} position={[Number(report.latitude), Number(report.longitude)]} icon={emergencyPinIcon}>
                <Popup>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{report.department_name ?? 'Unassigned'}</span>
                    <span className="text-xs">{report.status_display}</span>
                    <Link to={`/reports/${report.id}`} className="text-brand text-xs font-semibold hover:underline">
                      Open report →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <p className="text-ink-muted bg-ink/4 rounded-lg px-3 py-2 text-sm">
          No active emergencies have a location yet.
        </p>
      )}
    </div>
  );
}
