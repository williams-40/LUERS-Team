import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Urgency } from '../types/domain';
import type { CreateReportInput } from '../types/domain';
import { createReport, uploadEvidence, updateReportLocation } from '../lib/reports-api';
import { fetchEmergencyCategories } from '../lib/emergency-categories-api';
import { getCurrentLocation, type Coordinates } from '../lib/geolocation';
import type { ApiError } from '../lib/api-client';
import { enqueueReport, OFFLINE_QUEUE_KEY } from '../lib/offline-queue';
import { PanicButton } from '../components/ui/PanicButton';
import { ActionBar } from '../components/reports/ActionBar';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { DepartmentPicker } from '../components/reports/DepartmentPicker';
import { EvidencePicker } from '../components/reports/EvidencePicker';
import { MediaRecorderControl } from '../components/reports/MediaRecorderControl';
import { PhotoCaptureControl } from '../components/reports/PhotoCaptureControl';
import { useToast } from '../lib/toast-context';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { handleRadiogroupKeyDown, radioTabIndex } from '../lib/roving-radiogroup';

type DescriptionMode = 'text' | 'voice' | 'video';

const RECORDING_PLACEHOLDER: Record<'voice' | 'video', string> = {
  voice: 'Voice note attached.',
  video: 'Video note attached.',
};

/**
 * The one report-creation flow. Every submission is urgency='panic' — full
 * SLA tracking and escalation apply regardless of how much optional detail
 * a reporter adds. Only the category is required; everything else (rich
 * description, department override, photo, phone, evidence) lives behind
 * "+ Add details" and is optional, except a description when the selected
 * category is flagged as needing one to route (requires_description_and_routing).
 */
export function EmergencyReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { show } = useToast();

  const { data: categories, isLoading: isLoadingCategories, isError: isCategoriesError } = useQuery({
    queryKey: ['emergency-categories', { is_active: true, picker: true }],
    queryFn: () => fetchEmergencyCategories({ is_active: true }),
  });

  const [emergencyType, setEmergencyType] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>('text');
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const previousDescriptionRef = useRef('');
  const [department, setDepartment] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? '');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceErrors, setEvidenceErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const selectedCategory = categories?.results.find((c) => c.slug === emergencyType) ?? null;
  // Nothing to route a category like "Other" on without a description —
  // the one case where the normally-optional details section is mandatory
  // and can't be collapsed once a category needing it is picked.
  const descriptionRequired = selectedCategory?.requires_description_and_routing ?? false;

  useEffect(() => {
    if (descriptionRequired) setShowDetails(true);
  }, [descriptionRequired]);

  const locationRef = useRef<Coordinates | null>(null);
  const [locating, setLocating] = useState(true);

  // Fired once, in parallel, the moment this screen opens — the send
  // button never awaits this.
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

  function selectDescriptionMode(next: DescriptionMode) {
    if (next === descriptionMode) return;
    if (next === 'text') {
      setDescription(previousDescriptionRef.current);
    } else {
      if (descriptionMode === 'text') {
        previousDescriptionRef.current = description;
      }
      setDescription(RECORDING_PLACEHOLDER[next]);
      setRecordingFile(null);
    }
    setDescriptionMode(next);
    setRecordingError(null);
    setDescriptionError(null);
  }

  async function handleSend() {
    if (!emergencyType) {
      setSubmitError('Select what kind of emergency this is.');
      return;
    }
    if (descriptionMode !== 'text' && !recordingFile) {
      setRecordingError(
        descriptionMode === 'voice'
          ? 'Record a voice note before submitting, or switch to text.'
          : 'Record a video before submitting, or switch to text.',
      );
      return;
    }
    if (descriptionRequired && descriptionMode === 'text' && !description.trim()) {
      setDescriptionError('Please describe what’s happening so we can route this correctly.');
      return;
    }
    setSubmitError(null);

    const coords = locationRef.current;
    const attachments = [recordingFile, photoFile, ...evidenceFiles].filter(
      (file): file is File => file !== null,
    );

    const payload: CreateReportInput = {
      urgency: Urgency.PANIC,
      emergency_type: emergencyType,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(department ? { department } : {}),
      ...(phoneNumber.trim() ? { phone_number: phoneNumber.trim() } : {}),
      ...(coords
        ? { latitude: coords.latitude, longitude: coords.longitude, location_accuracy: coords.location_accuracy }
        : {}),
    };

    let report;
    try {
      report = await createMutation.mutateAsync(payload);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === null) {
        await enqueueReport(payload, attachments.length > 0);
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

    if (attachments.length > 0) {
      for (const file of attachments) {
        try {
          // Sequential, not parallel — keeps evidence order predictable and
          // avoids hammering the same endpoint with a burst of large uploads.
          // eslint-disable-next-line no-await-in-loop
          await evidenceMutation.mutateAsync({ reportId: report.id, file });
        } catch {
          show('Emergency sent, but an attachment could not be uploaded. Add it from the report page.', 'error');
          break;
        }
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
          You're offline right now. The institutional emergency system has not received this yet, it will send
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
  const phoneOnFile = Boolean(user?.phone_number);

  return (
    // pb-40 clears the fixed ActionBar so the last field is never covered.
    <div className="mx-auto max-w-xl px-5 pt-8 pb-40">
      <h1 className="text-status-critical font-heading mb-1 text-2xl font-extrabold">🚨 Report an emergency</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        What's happening? We'll route this immediately. Add more detail if you have time, or send now.
      </p>

      {isLoadingCategories && <p className="text-ink-muted mb-6 text-sm">Loading categories…</p>}
      {isCategoriesError && (
        <p className="bg-status-critical/10 text-status-critical mb-6 rounded-lg px-3 py-2 text-sm">
          Couldn't load emergency categories. Please try again.
        </p>
      )}

      {categories && (
        <div
          className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Emergency type"
          onKeyDown={handleRadiogroupKeyDown}
        >
          {categories.results.map((category, index) => {
            const active = emergencyType === category.slug;
            return (
              <button
                key={category.id}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={radioTabIndex(active, index === 0, emergencyType !== null)}
                onClick={() => {
                  setEmergencyType(category.slug);
                  setSubmitError(null);
                  setDescriptionError(null);
                }}
                className={cn(
                  'rounded-xl border-2 px-4 py-4 text-left text-[15px] font-bold transition active:scale-[0.98]',
                  active
                    ? 'bg-status-critical border-status-critical text-white'
                    : 'border-ink/15 text-ink hover:border-status-critical/50',
                )}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-ink-muted mb-6 text-xs">
        {locating
          ? 'Detecting your location…'
          : locationRef.current
            ? 'Location ready.'
            : 'Location unavailable, sending without it.'}
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
        <div className="mb-6 flex flex-col gap-5 rounded-xl border border-ink/10 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="description" className="text-ink-secondary text-[12.5px] font-semibold">
                What's happening? {!descriptionRequired && <span className="font-normal">(optional)</span>}
              </label>
              <div
                role="radiogroup"
                aria-label="How to describe what's happening"
                className="inline-flex gap-1"
                onKeyDown={handleRadiogroupKeyDown}
              >
                {(['text', 'voice', 'video'] as const).map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={descriptionMode === option}
                    tabIndex={radioTabIndex(descriptionMode === option, index === 0, true)}
                    onClick={() => selectDescriptionMode(option)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold transition',
                      descriptionMode === option ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-ink/6',
                    )}
                  >
                    {option === 'text' ? 'Text' : option === 'voice' ? 'Voice' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            {descriptionMode === 'text' ? (
              <Textarea
                id="description"
                required={descriptionRequired}
                rows={3}
                value={description}
                error={descriptionError ?? undefined}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (descriptionError) setDescriptionError(null);
                }}
              />
            ) : (
              <MediaRecorderControl
                mode={descriptionMode === 'voice' ? 'audio' : 'video'}
                onRecordingChange={(file) => {
                  setRecordingFile(file);
                  setRecordingError(null);
                }}
              />
            )}
            {recordingError && <p className="text-status-critical text-xs">{recordingError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ink-secondary text-[12.5px] font-semibold">Department (optional)</span>
            <DepartmentPicker value={department} onChange={setDepartment} />
            <p className="text-ink-muted text-xs">Not sure? Leave this, we'll route it for you.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ink-secondary text-[12.5px] font-semibold">Photo (optional)</span>
            <PhotoCaptureControl onCapture={setPhotoFile} />
          </div>

          <Input
            id="phone_number"
            type="tel"
            label="Phone number (optional)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            helperText={
              phoneOnFile
                ? 'So a responder can reach you if they need more information.'
                : "We don't have a phone number on file for you yet. Add one so a responder can reach you."
            }
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-ink-secondary text-[12.5px] font-semibold">Evidence (optional)</span>
            <EvidencePicker
              files={evidenceFiles}
              onChange={setEvidenceFiles}
              errors={evidenceErrors}
              onErrorsChange={setEvidenceErrors}
            />
          </div>
        </div>
      )}

      <ActionBar>
        {submitError && (
          <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
            {submitError}
          </p>
        )}
        <PanicButton type="button" disabled={isSubmitting} onClick={() => void handleSend()}>
          {isSubmitting ? 'Sending…' : 'SEND EMERGENCY'}
        </PanicButton>
      </ActionBar>
    </div>
  );
}
