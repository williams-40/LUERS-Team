import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Urgency } from '../types/domain';
import type { CreateReportInput } from '../types/domain';
import { createReport, uploadEvidence } from '../lib/reports-api';
import { getCurrentLocation } from '../lib/geolocation';
import type { ApiError } from '../lib/api-client';
import { enqueueReport, OFFLINE_QUEUE_KEY } from '../lib/offline-queue';
import { Button } from '../components/ui/Button';
import { PanicButton } from '../components/ui/PanicButton';
import { DepartmentPicker } from '../components/reports/DepartmentPicker';
import { EvidencePicker } from '../components/reports/EvidencePicker';
import { MediaRecorderControl } from '../components/reports/MediaRecorderControl';
import { PhotoCaptureControl } from '../components/reports/PhotoCaptureControl';
import { useToast } from '../lib/toast-context';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

function buildReportSchema(phoneRequired: boolean) {
  return z.object({
    department: z.string().min(1, 'Please select a department'),
    description: z
      .string()
      .trim()
      .min(10, 'Please add a few more details (at least 10 characters)')
      .max(2000),
    phone_number: phoneRequired
      ? z.string().trim().min(1, 'A phone number is required so a responder can reach you').max(15)
      : z.string().trim().max(15).optional().or(z.literal('')),
  });
}

type ReportFormValues = z.infer<ReturnType<typeof buildReportSchema>>;
type DescriptionMode = 'text' | 'voice' | 'video';

const RECORDING_PLACEHOLDER: Record<'voice' | 'video', string> = {
  voice: 'Voice note attached.',
  video: 'Video note attached.',
};

/**
 * The non-urgent report path — department, full description, evidence.
 * Panic reports have their own dedicated /emergency flow (EmergencyPage),
 * not a mode toggle on this form: the red button below navigates there
 * instead of switching this page's local state.
 */
export function ReportCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { user } = useAuth();
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceErrors, setEvidenceErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState<{ hadEvidence: boolean } | null>(null);
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>('text');
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const previousDescriptionRef = useRef('');

  // Only required when the profile has none on file yet — once a number is
  // saved to the profile, the report form's copy of it stays optional/editable.
  const phoneRequired = !user?.phone_number;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(buildReportSchema(phoneRequired)),
    // department starts out '' rather than undefined: DepartmentPicker isn't
    // a registered DOM input (it drives its value entirely through
    // setValue/watch), so without an explicit default, submitting before
    // picking anything hands zod `undefined` for a z.string() field — that
    // fails the base type check before the friendly .min(1, ...) message
    // ever runs, surfacing zod's raw "Invalid input: expected string,
    // received undefined" instead.
    defaultValues: { department: '', description: '', phone_number: user?.phone_number ?? '' },
  });

  const department = watch('department');

  const createMutation = useMutation({ mutationFn: createReport });
  const evidenceMutation = useMutation({
    mutationFn: (args: { reportId: string; file: File }) => uploadEvidence(args.reportId, args.file),
  });

  function selectDescriptionMode(next: DescriptionMode) {
    if (next === descriptionMode) return;
    if (next === 'text') {
      setValue('description', previousDescriptionRef.current, { shouldValidate: true });
    } else {
      // Only snapshot when actually leaving text mode — switching directly
      // between voice and video must not clobber the saved original text
      // with whichever recording placeholder happened to be in the field.
      if (descriptionMode === 'text') {
        previousDescriptionRef.current = getValues('description') ?? '';
      }
      setValue('description', RECORDING_PLACEHOLDER[next], { shouldValidate: true });
      setRecordingFile(null);
    }
    setDescriptionMode(next);
    setRecordingError(null);
  }

  async function onSubmit(values: ReportFormValues) {
    setSubmitError(null);

    if (descriptionMode !== 'text' && !recordingFile) {
      setRecordingError(
        descriptionMode === 'voice'
          ? 'Record a voice note before submitting, or switch to text.'
          : 'Record a video before submitting, or switch to text.',
      );
      return;
    }

    setLocating(true);
    const location = await getCurrentLocation();
    setLocating(false);

    const attachments = [recordingFile, photoFile, ...evidenceFiles].filter(
      (file): file is File => file !== null,
    );

    const payload: CreateReportInput = {
      department: values.department,
      description: values.description,
      urgency: Urgency.NORMAL,
      ...(values.phone_number?.trim() ? { phone_number: values.phone_number.trim() } : {}),
      ...(location ?? {}),
    };

    let report;
    try {
      report = await createMutation.mutateAsync(payload);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === null) {
        // No response at all — genuinely offline, not a rejection. Queue it
        // rather than losing it; useOfflineQueue drains this automatically
        // once connectivity returns.
        await enqueueReport(payload, attachments.length > 0);
        await queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_KEY });
        setQueuedOffline({ hadEvidence: attachments.length > 0 });
        return;
      }
      if (apiError.fieldErrors) {
        const message = Object.values(apiError.fieldErrors).flat().join(' ');
        setSubmitError(message);
        show(message, 'error');
      } else {
        const message = apiError.detail ?? 'Something went wrong. Please try again.';
        setSubmitError(message);
        show(message, 'error');
      }
      return;
    }

    show('Report submitted.', 'success');

    if (attachments.length > 0) {
      for (const file of attachments) {
        try {
          // Sequential, not parallel — keeps evidence order predictable and
          // avoids hammering the same endpoint with a burst of large uploads.
          // eslint-disable-next-line no-await-in-loop
          await evidenceMutation.mutateAsync({ reportId: report.id, file });
        } catch {
          // The report itself already exists — don't block navigation on a
          // failed attachment; it can be added again from the detail page.
          show('Report submitted, but evidence could not be uploaded. Add it from the report page.', 'error');
          break;
        }
      }
    }

    navigate(`/reports/${report.id}`, { state: { justCreated: true } });
  }

  if (queuedOffline) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="mb-2 text-xl">Report queued</h1>
        <p className="text-ink-secondary mb-2 text-sm">
          You're offline right now, so this report is saved on your device and will send automatically as
          soon as you're back online.
        </p>
        {queuedOffline.hadEvidence && (
          <p className="text-status-warning mb-4 text-sm font-semibold">
            The evidence you attached wasn't included. Add it from the report once it's sent.
          </p>
        )}
        <div className="mt-4 flex flex-col items-center gap-3">
          <Button variant="secondary" onClick={() => setQueuedOffline(null)}>
            Report another incident
          </Button>
          <Link to="/" className="text-brand text-sm font-semibold hover:underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="mb-1 text-2xl">Report an incident</h1>
      <p className="text-ink-secondary mb-6 text-sm">
        In immediate danger? Use the emergency button below, it's a separate, faster flow with no department to
        pick.
      </p>

      <PanicButton type="button" onClick={() => navigate('/emergency')} className="mb-6">
        This is an emergency
      </PanicButton>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-secondary text-[12.5px] font-semibold">Department</span>
          <DepartmentPicker
            value={department}
            onChange={(d) => setValue('department', d, { shouldValidate: true })}
          />
          <p className="text-ink-muted text-xs">
            Not sure? Pick "Other", we'll try to route it automatically based on your description.
          </p>
          {errors.department && <p className="text-status-critical text-xs">{errors.department.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="description" className="text-ink-secondary text-[12.5px] font-semibold">
              What's happening?
            </label>
            <div role="radiogroup" aria-label="How to describe what's happening" className="inline-flex gap-1">
              {(['text', 'voice', 'video'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={descriptionMode === option}
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
            <textarea
              id="description"
              rows={4}
              className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
              {...register('description')}
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
          {errors.description && <p className="text-status-critical text-xs">{errors.description.message}</p>}
          {recordingError && <p className="text-status-critical text-xs">{recordingError}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-ink-secondary text-[12.5px] font-semibold">Photo (optional)</span>
          <PhotoCaptureControl onCapture={setPhotoFile} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone_number" className="text-ink-secondary text-[12.5px] font-semibold">
            Phone number {phoneRequired ? '(required)' : '(optional)'}
          </label>
          <input
            id="phone_number"
            type="tel"
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            aria-invalid={Boolean(errors.phone_number)}
            aria-required={phoneRequired}
            {...register('phone_number')}
          />
          <p className="text-ink-muted text-xs">
            {phoneRequired
              ? "We don't have a phone number on file for you yet. Add one so a responder can reach you."
              : 'So a responder can reach you if they need more information.'}
          </p>
          {errors.phone_number && <p className="text-status-critical text-xs">{errors.phone_number.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-ink-secondary text-[12.5px] font-semibold">Evidence (optional)</span>
          <EvidencePicker
            files={evidenceFiles}
            onChange={setEvidenceFiles}
            errors={evidenceErrors}
            onErrorsChange={setEvidenceErrors}
          />
        </div>

        {submitError && (
          <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
            {submitError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (locating ? 'Getting your location…' : 'Submitting…') : 'Submit report'}
        </Button>
      </form>
    </div>
  );
}
