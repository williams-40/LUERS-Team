import { useState } from 'react';
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
import { useToast } from '../lib/toast-context';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

const reportSchema = z
  .object({
    department: z.string().min(1, 'Please select a department'),
    description: z
      .string()
      .trim()
      .min(10, 'Please add a few more details (at least 10 characters)')
      .max(2000),
    is_anonymous: z.boolean(),
    phone_number: z.string().trim().max(15).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (!data.is_anonymous && !data.phone_number?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone number is required so responders can reach you',
        path: ['phone_number'],
      });
    }
  });

type ReportFormValues = z.infer<typeof reportSchema>;

type Mode = 'panic' | 'detailed';

export function ReportCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('detailed');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceErrors, setEvidenceErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState<{ hadEvidence: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { is_anonymous: false, phone_number: user?.phone_number ?? '' },
  });

  const department = watch('department');
  const isAnonymous = watch('is_anonymous');

  const createMutation = useMutation({ mutationFn: createReport });
  const evidenceMutation = useMutation({
    mutationFn: (args: { reportId: string; file: File }) => uploadEvidence(args.reportId, args.file),
  });

  function selectMode(next: Mode) {
    setMode(next);
    setSubmitError(null);
  }

  async function onSubmit(values: ReportFormValues) {
    setSubmitError(null);
    setLocating(true);
    const location = await getCurrentLocation();
    setLocating(false);

    const payload: CreateReportInput = {
      department: values.department,
      description: values.description,
      urgency: mode === 'panic' ? Urgency.PANIC : Urgency.NORMAL,
      is_anonymous: values.is_anonymous,
      ...(values.is_anonymous ? {} : { phone_number: values.phone_number?.trim() }),
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
        await enqueueReport(payload, evidenceFiles.length > 0);
        await queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_KEY });
        setQueuedOffline({ hadEvidence: evidenceFiles.length > 0 });
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

    if (mode === 'detailed' && evidenceFiles.length > 0) {
      for (const file of evidenceFiles) {
        try {
          // Sequential, not parallel — keeps evidence order predictable and
          // avoids hammering the same endpoint with a burst of large uploads.
          // eslint-disable-next-line no-await-in-loop
          await evidenceMutation.mutateAsync({ reportId: report.id, file });
        } catch {
          // The report itself already exists — don't block navigation on a
          // failed attachment; it can be added again from the detail page.
          show('Report submitted, but evidence could not be uploaded — add it from the report page.', 'error');
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
            The evidence you attached wasn't included — add it from the report once it's sent.
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
        In immediate danger? Use the panic report below — it's faster and skips the extra questions.
      </p>

      {mode === 'detailed' && (
        <PanicButton type="button" onClick={() => selectMode('panic')} className="mb-6">
          This is an emergency
        </PanicButton>
      )}

      {mode === 'panic' && (
        <div
          role="alert"
          className="bg-status-critical/10 border-status-critical/30 mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <span className="text-status-critical text-sm font-semibold">Panic report — sent as urgent</span>
          <button
            type="button"
            onClick={() => selectMode('detailed')}
            className="text-ink-secondary shrink-0 text-xs font-semibold underline"
          >
            Switch to detailed report
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-secondary text-[12.5px] font-semibold">Department</span>
          <DepartmentPicker
            value={department}
            onChange={(d) => setValue('department', d, { shouldValidate: true })}
          />
          <p className="text-ink-muted text-xs">
            Not sure? Pick "Other" — we'll try to route it automatically based on your description.
          </p>
          {errors.department && <p className="text-status-critical text-xs">{errors.department.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-ink-secondary text-[12.5px] font-semibold">
            What's happening?
          </label>
          <textarea
            id="description"
            rows={mode === 'panic' ? 2 : 4}
            className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
            {...register('description')}
          />
          {errors.description && <p className="text-status-critical text-xs">{errors.description.message}</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="accent-brand h-4 w-4" {...register('is_anonymous')} />
          <span className="text-sm">Submit anonymously</span>
        </label>
        <p className="text-ink-muted -mt-3 text-xs">
          Your name will not be shown to responders. Only the escrow authority can ever unmask an anonymous
          report, and only through a formal process.
        </p>

        {!isAnonymous && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone_number" className="text-ink-secondary text-[12.5px] font-semibold">
              Phone number
            </label>
            <input
              id="phone_number"
              type="tel"
              className="focus:outline-brand rounded-[9px] border-[1.5px] border-ink/15 px-3 py-2.5 text-sm outline-2 outline-offset-1 focus:border-transparent"
              aria-invalid={Boolean(errors.phone_number)}
              {...register('phone_number')}
            />
            <p className="text-ink-muted text-xs">So a responder can reach you if they need more information.</p>
            {errors.phone_number && <p className="text-status-critical text-xs">{errors.phone_number.message}</p>}
          </div>
        )}

        {mode === 'detailed' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-ink-secondary text-[12.5px] font-semibold">Evidence (optional)</span>
            <EvidencePicker
              files={evidenceFiles}
              onChange={setEvidenceFiles}
              errors={evidenceErrors}
              onErrorsChange={setEvidenceErrors}
            />
          </div>
        )}

        {submitError && (
          <p role="alert" className="bg-status-critical/10 text-status-critical rounded-lg px-3 py-2 text-sm">
            {submitError}
          </p>
        )}

        {mode === 'panic' ? (
          <PanicButton type="submit" disabled={isSubmitting} className={cn(isSubmitting && 'opacity-70')}>
            {isSubmitting ? (locating ? 'Getting your location…' : 'Sending…') : 'Send Panic Report Now'}
          </PanicButton>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (locating ? 'Getting your location…' : 'Submitting…') : 'Submit report'}
          </Button>
        )}
      </form>
    </div>
  );
}
