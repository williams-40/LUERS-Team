import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PanicButton } from '../components/ui/PanicButton';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Tooltip } from '../components/ui/Tooltip';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ReportCard } from '../components/ReportCard';
import { Category, Status, Urgency } from '../types/domain';
import type { ReportListItem } from '../types/domain';

const DEMO_REPORTS: ReportListItem[] = [
  {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    category: Category.MEDICAL,
    category_display: 'Medical Emergency',
    description:
      'Student collapsed near the East Wing library entrance, reportedly conscious but disoriented.',
    urgency: Urgency.PANIC,
    urgency_display: 'Panic',
    status: Status.NEW,
    status_display: 'New',
    latitude: 2.2333,
    longitude: 32.8999,
    location_accuracy: 12,
    assigned_to: null,
    assigned_to_username: null,
    created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    evidence_count: 0,
    deleted_at: null,
    department_id: null,
    department_name: 'Security',
    department_head_id: null,
    emergency_dispatch: null,
  },
  {
    id: 'a1b2c3d4-0000-0000-0000-000000000002',
    category: Category.THEFT,
    category_display: 'Theft',
    description: 'Laptop reported missing from the ICT computer lab, last seen around 3pm.',
    urgency: Urgency.NORMAL,
    urgency_display: 'Normal',
    status: Status.ACKNOWLEDGED,
    status_display: 'Acknowledged',
    latitude: null,
    longitude: null,
    location_accuracy: null,
    assigned_to: null,
    assigned_to_username: null,
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    evidence_count: 2,
    deleted_at: null,
    department_id: null,
    department_name: 'ICT',
    department_head_id: null,
    emergency_dispatch: null,
  },
  {
    id: 'a1b2c3d4-0000-0000-0000-000000000003',
    category: Category.FIRE,
    category_display: 'Fire',
    description:
      'Small electrical fire in a dormitory kitchen, extinguished by facilities staff without injury.',
    urgency: Urgency.NORMAL,
    urgency_display: 'Normal',
    status: Status.RESOLVED,
    status_display: 'Resolved',
    latitude: null,
    longitude: null,
    location_accuracy: null,
    assigned_to: null,
    assigned_to_username: null,
    created_at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    evidence_count: 1,
    deleted_at: null,
    department_id: null,
    department_name: 'Facilities',
    department_head_id: null,
    emergency_dispatch: null,
  },
];

/** Component showcase / living style guide — reachable at /style-guide. */
export function StyleGuidePage() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="mx-auto max-w-xl space-y-8 px-5 py-8">
      <section>
        <h1 className="mb-1 text-2xl">LUERS Foundations</h1>
        <p className="text-ink-secondary text-sm">
          Design tokens and component primitives, a living reference, not a real screen. Real screens start
          at <code className="font-data">/login</code> and <code className="font-data">/</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Panic action</h2>
        <PanicButton />
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Submit report</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete evidence</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Icon buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="icon" aria-label="Remove">
            <X className="h-4 w-4" />
          </Button>
          <Tooltip label="Remove item">
            <Button variant="ghost" size="icon" aria-label="Remove item">
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Form fields</h2>
        <Card className="flex flex-col gap-4">
          <Input label="Full name" placeholder="Jane Doe" required />
          <Input label="Email" error="Enter a valid email address." defaultValue="not-an-email" />
          <Select label="Department" helperText="Routes the report to the right team." defaultValue="">
            <option value="" disabled>
              Choose a department
            </option>
            <option value="security">Security</option>
            <option value="health">Health &amp; Safety</option>
          </Select>
          <Textarea label="Description" placeholder="What happened?" rows={3} />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Status badges</h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={Status.NEW} />
          <StatusBadge status={Status.ACKNOWLEDGED} />
          <StatusBadge status={Status.IN_PROGRESS} />
          <StatusBadge status={Status.RESOLVED} />
          <StatusBadge status={Status.CLOSED} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Empty / error states</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="p-0">
            <EmptyState
              title="No reports yet"
              description="You haven't submitted any reports."
              action={<Button size="sm">Report an incident</Button>}
            />
          </Card>
          <ErrorState description="Please check your connection and try again." action={<Button size="sm" variant="secondary">Retry</Button>} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Confirm dialog</h2>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Delete report
        </Button>
        {confirmOpen && (
          <ConfirmDialog
            title="Delete this report?"
            description="It will be removed from the queue and can be restored by an admin later."
            confirmLabel="Delete"
            destructive
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base">Report cards: severity rail</h2>
        <div className="flex flex-col gap-2.5">
          {DEMO_REPORTS.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </section>
    </div>
  );
}
