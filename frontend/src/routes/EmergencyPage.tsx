import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { EmergencyType, Urgency } from '../types/domain';
import type { CreateReportInput } from '../types/domain';
import { createReport, uploadEvidence, updateReportLocation } from '../lib/reports-api';
import { getCurrentLocation, type Coordinates } from '../lib/geolocation';
import type { ApiError } from '../lib/api-client';
import { enqueueReport, OFFLINE_QUEUE_KEY } from '../lib/offline-queue';
import { useQueryClient } from '@tanstack/react-query';
import { PanicButton } from '../components/ui/PanicButton';
import { PhotoCaptureControl } from '../components/reports/PhotoCaptureControl';
import { useToast } from '../lib/toast-context';

const EMERGENCY_TYPE_OPTIONS: { value: EmergencyType; label: string }[] = [
  { value: EmergencyType.SECURITY, label: 'Security / Threat' },
  { value: EmergencyType.MEDICAL, label: 'Medical Emergency' },
  { value: EmergencyType.FIRE, label: 'Fire' },
  { value: EmergencyType.ACCIDENT, label: 'Accident' },
  { value: EmergencyType.OTHER, label: 'Other' },
];

/**
 * The dedicated fast emergency path — a distinct flow from the ordinary
 * report form, not a mode switch on it. No department picker (routed
 * deterministically server-side from emergency_type) and geolocation is
 * fetched in parallel on mount, never awaited before sending.
 */
export function EmergencyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [emergencyType, setEmergencyType] = useState<EmergencyType | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const locationRef = useRef<Coordinates | null>(null);
  const [locating, setLocating] = useState(true);

  // Fired once, in parallel, the moment this screen opens — SEND EMERGENCY
  // never awaits this, unlike the ordinary report form.
  useEffect(() => {
    let cancelled = false;
    void getCurrentLocation().then((coords) => {
      if (cancelled) return;
      locationRef.current = coords;
      setLocating(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const createMutation = useMutation({ mutationFn: createReport });
  const evidenceMutation = useMutation({
    mutationFn: (args: { reportId: string; file: File }) => uploadEvidence(args.reportId, args.file),
  });

  async function handleSend() {
    if (!emergencyType) {
      setSubmitError('Select what kind of emergency this is.');
      return;
    }
    setSubmitError(null);

    const coords = locationRef.current;
    const payload: CreateReportInput = {
      urgency: Urgency.PANIC,
      emergency_type: emergencyType,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, location_accuracy: coords.location_accuracy } : {}),
    };

    let report;
    try {
      report = await createMutation.mutateAsync(payload);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === null) {
        await enqueueReport(payload, Boolean(photoFile));
        await queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_KEY });
        setQueuedOffline(true);
        return;
      }
      const message = apiError.fieldErrors
        ? Object.values(apiError.fieldErrors).flat().join(' ')
        : (apiError.detail ?? 'Something went wrong. Please try again.');
      setSubmitError(message);
      show(message, 'error');
      return;
    }

    show('Emergency sent.', 'success');

    if (photoFile) {
      try {
        await evidenceMutation.mutateAsync({ reportId: report.id, file: photoFile });
      } catch {
        show('Emergency sent, but the photo could not be uploaded. Add it from the report page.', 'error');
      }
    }

    // Location may still be resolving (or may have just failed) — if it
    // lands after the report already exists, send it as a follow-up
    // rather than losing it.
    if (!coords) {
      void getCurrentLocation().then((late) => {
        if (late) void updateReportLocation(report.id, late).catch(() => undefined);
      });
    }

    navigate(`/reports/${report.id}`, { state: { justCreated: true } });
  }

  if (queuedOffline) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="mb-2 text-xl">Emergency queued</h1>
        <p className="text-status-warning mb-2 text-sm font-semibold">
          You're offline right now. The institutional emergency system has not received this yet — it will send
          automatically the moment you're back online. If this is a real emergency, also use your campus's usual
          offline emergency procedure now.
        </p>
        <button
          type="button"
          onClick={() => {
            setQueuedOffline(false);
            setEmergencyType(null);
          }}
          className="text-brand mt-4 text-sm font-semibold hover:underline"
        >
          Report another emergency
        </button>
      </div>
    );
  }

  const isSubmitting = createMutation.isPending;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="text-status-critical font-heading mb-1 text-2xl font-extrabold">🚨 Report an emergency</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        What's happening? We'll route this immediately — no department to pick.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Emergency type">
        {EMERGENCY_TYPE_OPTIONS.map((option) => {
          const active = emergencyType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setEmergencyType(option.value);
                setSubmitError(null);
              }}
              className={
                'rounded-xl border-2 px-4 py-4 text-left text-[15px] font-bold transition active:scale-[0.98] ' +
                (active
                  ? 'bg-status-critical border-status-critical text-white'
                  : 'border-ink/15 text-ink hover:border-status-critical/50')
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="text-ink-muted mb-6 text-xs">
        {locating ? 'Detecting your location…' : locationRef.current ? 'Location ready.' : 'Location unavailable — sending without it.'}
      </p>

      {!showDetails ? (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="text-brand mb-6 text-sm font-semibold hover:underline"
        >
          + Add details (optional)
        </button>
      ) : (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-ink/10 p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="emergency-description" className="text-ink-secondary text-[12.5px] font-semibold">
              Anything else responders should know? (optional)
            </label>
            <textarea
              id="emergency-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-ink-secondary text-[12.5px] font-semibold">Photo (optional)</span>
            <PhotoCaptureControl onCapture={setPhotoFile} />
          </div>
        </div>
      )}

      {submitError && (
        <p role="alert" className="bg-status-critical/10 text-status-critical mb-4 rounded-lg px-3 py-2 text-sm">
          {submitError}
        </p>
      )}

      <PanicButton type="button" disabled={isSubmitting} onClick={() => void handleSend()}>
        {isSubmitting ? 'Sending…' : 'SEND EMERGENCY'}
      </PanicButton>
    </div>
  );
}
