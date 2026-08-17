import { Button } from '../components/ui/Button';
import { PanicButton } from '../components/ui/PanicButton';
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
  },
];

/** Component showcase / living style guide — reachable at /style-guide. */
export function StyleGuidePage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 px-5 py-8">
      <section>
        <h1 className="mb-1 text-2xl">LUERS Foundations</h1>
        <p className="text-ink-secondary text-sm">
          Design tokens and component primitives — a living reference, not a real screen. Real screens start
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
