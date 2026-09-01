'use client';

import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  Home,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type EntryState = 'Approved' | 'Needs attention' | 'Ready for review' | 'Returned';
type RecordSource = 'submission' | 'sample';
type RecordMode = 'connecting' | 'live' | 'preview';

type ApiTimeEntry = {
  id: string;
  clientId: string;
  timesheetId: string;
  employeeId: string;
  workDate: string;
  regularMinutes: number;
  overtimeMinutes: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  note: string | null;
  status: 'synced' | 'needs_attention' | 'confirmed';
  requiresReview: boolean;
  reviewReason: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type ApiRevision = {
  id: string;
  revision: number;
  status: 'draft' | 'needs_attention' | 'approved' | 'returned';
  action: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
};

type ApiTimesheet = {
  id: string;
  employee: { id: string; name: string };
  period: { start: string; end: string; label: string };
  status: 'draft' | 'needs_attention' | 'approved' | 'returned';
  totals: { regular: number; overtime: number; all: number };
  entries: ApiTimeEntry[];
  events: Array<{ id: string; type: string; createdAt: string }>;
  revisions: ApiRevision[];
  revision: number;
  receiptId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiTimesheetSummary = Pick<
  ApiTimesheet,
  'id' | 'employee' | 'period' | 'status' | 'totals' | 'createdAt' | 'updatedAt'
> & { entryCount: number };

type ApiHealth = {
  reviewerAccessRequired?: boolean;
};

type ReviewEntry = {
  source: ApiTimeEntry;
  id: string;
  day: string;
  date: string;
  hours: string;
  state: EntryState;
  note: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://shiftproof.swoop.video/api';
const reviewerTokenSessionKey = 'shiftproof.reviewerToken';

function makePreviewEntry(
  id: string,
  workDate: string,
  totalHours: number,
  note: string | null = null,
  requiresReview = false,
): ApiTimeEntry {
  return {
    id,
    clientId: id,
    timesheetId: '82f14000-0000-4000-8000-000000000001',
    employeeId: '82f14000-0000-4000-8000-000000000002',
    workDate,
    regularMinutes: totalHours * 60,
    overtimeMinutes: 0,
    regularHours: totalHours,
    overtimeHours: 0,
    totalHours,
    note,
    status: requiresReview ? 'needs_attention' : 'synced',
    requiresReview,
    reviewReason: requiresReview ? 'DEMO_HEURISTIC_16_HOURS' : null,
    revision: 1,
    createdAt: `${workDate}T20:08:00.000Z`,
    updatedAt: `${workDate}T20:08:00.000Z`,
  };
}

const samplePreview: ApiTimesheet = {
  id: '82f14000-0000-4000-8000-000000000001',
  employee: { id: '82f14000-0000-4000-8000-000000000002', name: 'Sarah Chen' },
  period: { start: '2026-08-24', end: '2026-09-06', label: 'Aug 24 — Sep 06' },
  status: 'needs_attention',
  totals: { regular: 39.5, overtime: 0, all: 39.5 },
  entries: [
    makePreviewEntry('82f14000-0000-4000-8000-000000000011', '2026-08-24', 8),
    makePreviewEntry(
      '82f14000-0000-4000-8000-000000000014',
      '2026-08-25',
      16,
      'Emergency inventory count after closing.',
      true,
    ),
    makePreviewEntry('82f14000-0000-4000-8000-000000000012', '2026-08-26', 8),
    makePreviewEntry('82f14000-0000-4000-8000-000000000013', '2026-08-27', 7.5),
  ],
  events: [],
  revisions: [
    {
      id: '82f14000-0000-4000-8000-000000000021',
      revision: 2,
      status: 'needs_attention',
      action: 'EMPLOYEE_CONFIRMED',
      actorId: '82f14000-0000-4000-8000-000000000002',
      note: 'Employee submitted the sample timesheet',
      createdAt: '2026-08-25T21:31:00.000Z',
    },
    {
      id: '82f14000-0000-4000-8000-000000000022',
      revision: 1,
      status: 'draft',
      action: 'TIME_ENTRY_RECORDED',
      actorId: '82f14000-0000-4000-8000-000000000002',
      note: null,
      createdAt: '2026-08-24T20:08:00.000Z',
    },
  ],
  revision: 2,
  receiptId: null,
  approvedAt: null,
  createdAt: '2026-08-24T20:08:00.000Z',
  updatedAt: '2026-08-25T21:31:00.000Z',
};

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Timesheets', icon: CalendarDays, active: true },
  { label: 'Employees', icon: UsersRound },
  { label: 'Reports', icon: ChartNoAxesColumn },
  { label: 'Settings', icon: Settings },
];

const actionLabels: Record<string, string> = {
  REVIEWER_RUN_CREATED: 'Mobile submission created',
  TIME_ENTRY_CREATED: 'Time entry recorded',
  TIME_ENTRY_RECORDED: 'Time entry recorded',
  TIME_ENTRY_CONFIRMED: 'Employee confirmed',
  EMPLOYEE_CONFIRMED: 'Employee confirmed',
  TIMESHEET_APPROVED: 'Manager approved',
  TIMESHEET_RETURNED: 'Returned to employee',
};

function formatDateOnly(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    ...options,
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function periodLabel(timesheet: ApiTimesheet) {
  if (timesheet.period.start === timesheet.period.end) {
    return formatDateOnly(timesheet.period.start, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return `${formatDateOnly(timesheet.period.start, { month: 'short', day: 'numeric' })} — ${formatDateOnly(timesheet.period.end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function statusLabel(status: ApiTimesheet['status']) {
  if (status === 'needs_attention') return 'Needs attention';
  if (status === 'approved') return 'Approved';
  if (status === 'returned') return 'Returned';
  return 'Ready for review';
}

function entryState(timesheet: ApiTimesheet, entry: ApiTimeEntry): EntryState {
  if (timesheet.status === 'approved') return 'Approved';
  if (timesheet.status === 'returned') return 'Returned';
  if (entry.requiresReview || entry.status === 'needs_attention') return 'Needs attention';
  return 'Ready for review';
}

function entriesFromTimesheet(timesheet: ApiTimesheet): ReviewEntry[] {
  return timesheet.entries
    .slice()
    .sort((left, right) => left.workDate.localeCompare(right.workDate))
    .map((entry) => ({
      source: entry,
      id: entry.id,
      day: formatDateOnly(entry.workDate, { weekday: 'short' }),
      date: formatDateOnly(entry.workDate, { month: 'short', day: 'numeric' }),
      hours: entry.totalHours.toFixed(1),
      state: entryState(timesheet, entry),
      note: entry.note || '—',
    }));
}

function StatusMark({ state }: { state: EntryState }) {
  const modifier =
    state === 'Approved'
      ? 'verified'
      : state === 'Needs attention'
        ? 'attention'
        : state === 'Returned'
          ? 'returned'
          : 'local';
  return (
    <span className={`web-status web-status--${modifier}`} aria-label={state}>
      <span className={`proof-mark proof-mark--${modifier}`} aria-hidden="true">
        {state === 'Needs attention' ? '!' : state === 'Returned' ? '↩' : state === 'Approved' ? '✓' : ''}
      </span>
      {state}
    </span>
  );
}

function summaryFromTimesheet(timesheet: ApiTimesheet): ApiTimesheetSummary {
  return {
    id: timesheet.id,
    employee: timesheet.employee,
    period: timesheet.period,
    status: timesheet.status,
    totals: timesheet.totals,
    entryCount: timesheet.entries.length,
    createdAt: timesheet.createdAt,
    updatedAt: timesheet.updatedAt,
  };
}

function recordLabel(timesheet: ApiTimesheet | ApiTimesheetSummary) {
  return `${timesheet.employee.name} · ${formatDateOnly(timesheet.period.start, { month: 'short', day: 'numeric' })} · ${timesheet.totals.all.toFixed(1)} h · ${statusLabel(timesheet.status)}`;
}

export function ReviewLedger() {
  const [submissions, setSubmissions] = useState<ApiTimesheetSummary[]>([]);
  const [sample, setSample] = useState<ApiTimesheet>(samplePreview);
  const [timesheet, setTimesheet] = useState<ApiTimesheet>(samplePreview);
  const [source, setSource] = useState<RecordSource>('sample');
  const [selectedId, setSelectedId] = useState(samplePreview.entries[1]?.id ?? '');
  const [mode, setMode] = useState<'idle' | 'returning'>('idle');
  const [returnNote, setReturnNote] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [recordMode, setRecordMode] = useState<RecordMode>('connecting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [reviewerToken, setReviewerToken] = useState<string | null>(null);
  const [reviewerAccessRequired, setReviewerAccessRequired] = useState(false);
  const [reviewerAccessChecked, setReviewerAccessChecked] = useState(false);
  const [reviewerAuthError, setReviewerAuthError] = useState(false);
  const followNewestSubmission = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const currentUrl = new URL(window.location.href);
      const queryId = currentUrl.searchParams.get('timesheetId');
      const suppliedReviewerToken = currentUrl.searchParams.get('reviewerToken')?.trim();
      let sessionReviewerToken: string | null = null;
      try {
        if (suppliedReviewerToken) {
          window.sessionStorage.setItem(reviewerTokenSessionKey, suppliedReviewerToken);
          sessionReviewerToken = suppliedReviewerToken;
        } else {
          sessionReviewerToken = window.sessionStorage.getItem(reviewerTokenSessionKey);
        }
      } catch {
        sessionReviewerToken = suppliedReviewerToken || null;
      }
      setReviewerToken(sessionReviewerToken);
      setReviewerAuthError(false);
      if (currentUrl.searchParams.has('reviewerToken')) {
        currentUrl.searchParams.delete('reviewerToken');
        window.history.replaceState(
          {},
          '',
          `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
        );
      }
      followNewestSubmission.current = !queryId;
      try {
        const [healthResult, inboxResult, sampleResult] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/health`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/v1/reviewer/timesheets`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/v1/timesheets/demo`, { signal: controller.signal }),
        ]);

        if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
          const health = (await healthResult.value.json()) as ApiHealth;
          setReviewerAccessRequired(health.reviewerAccessRequired === true);
        }
        setReviewerAccessChecked(true);

        let liveSubmissions: ApiTimesheetSummary[] = [];
        if (inboxResult.status === 'fulfilled' && inboxResult.value.ok) {
          const payload = (await inboxResult.value.json()) as { data: ApiTimesheetSummary[] };
          liveSubmissions = payload.data
            .slice()
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
          setSubmissions(liveSubmissions);
        }

        let connectedSample = samplePreview;
        if (sampleResult.status === 'fulfilled' && sampleResult.value.ok) {
          connectedSample = ((await sampleResult.value.json()) as { data: ApiTimesheet }).data;
          setSample(connectedSample);
        }

        const isSampleQuery = queryId === 'demo' || queryId === connectedSample.id;
        const targetSource: RecordSource = isSampleQuery
          ? 'sample'
          : queryId || liveSubmissions.length > 0
            ? 'submission'
            : 'sample';
        const targetId = isSampleQuery
          ? connectedSample.id
          : queryId ?? liveSubmissions[0]?.id ?? connectedSample.id;

        let target: ApiTimesheet | undefined;
        if (targetSource === 'sample') {
          if (sampleResult.status !== 'fulfilled' || !sampleResult.value.ok) {
            throw new Error('The sample record could not be loaded');
          }
          target = connectedSample;
        } else {
          const exactResponse = await fetch(
            `${apiBaseUrl}/v1/timesheets/${encodeURIComponent(targetId)}`,
            { signal: controller.signal },
          );
          if (exactResponse.ok) {
            target = ((await exactResponse.json()) as { data: ApiTimesheet }).data;
          }
        }
        if (!target) throw new Error('The requested timesheet could not be loaded');

        if (targetSource === 'submission' && !liveSubmissions.some((item) => item.id === target.id)) {
          setSubmissions((current) => [summaryFromTimesheet(target as ApiTimesheet), ...current]);
        }
        setTimesheet(target);
        setSource(targetSource);
        setSelectedId(
          target.entries.find((entry) => entry.requiresReview)?.id ?? target.entries[0]?.id ?? '',
        );
        setRecordMode('live');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setReviewerAccessChecked(true);
        setTimesheet(samplePreview);
        setSample(samplePreview);
        setSource('sample');
        setSelectedId(samplePreview.entries[1]?.id ?? samplePreview.entries[0]?.id ?? '');
        setRecordMode('preview');
        setActionMessage('The connected API is unavailable. Showing the labeled sample without recording decisions.');
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (recordMode !== 'live') return;
    const controller = new AbortController();
    const refreshInbox = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/v1/reviewer/timesheets`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { data: ApiTimesheetSummary[] };
        const nextSubmissions = payload.data
          .slice()
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        setSubmissions(nextSubmissions);

        const targetId = followNewestSubmission.current
          ? nextSubmissions[0]?.id
          : source === 'submission'
            ? timesheet.id
            : undefined;
        if (targetId) {
          const detailResponse = await fetch(
            `${apiBaseUrl}/v1/timesheets/${encodeURIComponent(targetId)}`,
            { signal: controller.signal },
          );
          if (!detailResponse.ok) return;
          const refreshed = ((await detailResponse.json()) as { data: ApiTimesheet }).data;
          if (timesheet.id !== refreshed.id) {
            setSource('submission');
            setSelectedId(
              refreshed.entries.find((entry) => entry.requiresReview)?.id ??
                refreshed.entries[0]?.id ??
                '',
            );
            setMode('idle');
            setReturnNote('');
            setActionMessage('New mobile submission received automatically.');
            const url = new URL(window.location.href);
            url.searchParams.set('timesheetId', refreshed.id);
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          }
          setTimesheet(refreshed);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // Keep the currently loaded record; the connection badge remains truthful.
        }
      }
    };
    const timer = window.setInterval(() => void refreshInbox(), 12_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [recordMode, source, timesheet.id]);

  const entries = useMemo(() => entriesFromTimesheet(timesheet), [timesheet]);
  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId],
  );
  const orderedRevisions = useMemo(
    () => timesheet.revisions.slice().sort((left, right) => right.revision - left.revision),
    [timesheet.revisions],
  );
  const isTerminal = timesheet.status === 'approved' || timesheet.status === 'returned';
  const inboxPending = submissions.filter(
    (item) => item.status === 'draft' || item.status === 'needs_attention',
  ).length;
  const initials = timesheet.employee.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const selectorValue = `${source}:${timesheet.id}`;
  const reviewerAccessDenied =
    reviewerAccessRequired && (!reviewerToken || reviewerAuthError);

  const selectRecord = async (value: string) => {
    const separator = value.indexOf(':');
    const nextSource = value.slice(0, separator) as RecordSource;
    const nextId = value.slice(separator + 1);
    followNewestSubmission.current = false;
    setIsSelecting(true);
    setActionMessage('');
    setMode('idle');
    setReturnNote('');
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/timesheets/${encodeURIComponent(nextSource === 'sample' ? 'demo' : nextId)}`,
      );
      if (!response.ok) throw new Error('Timesheet could not be loaded');
      const nextTimesheet = ((await response.json()) as { data: ApiTimesheet }).data;
      setTimesheet(nextTimesheet);
      setSource(nextSource);
      setSelectedId(
        nextTimesheet.entries.find((entry) => entry.requiresReview)?.id ??
          nextTimesheet.entries[0]?.id ??
          '',
      );
      setRecordMode('live');
      if (nextSource === 'submission') {
        setSubmissions((current) =>
          current.some((item) => item.id === nextTimesheet.id)
            ? current.map((item) =>
                item.id === nextTimesheet.id ? summaryFromTimesheet(nextTimesheet) : item,
              )
            : [summaryFromTimesheet(nextTimesheet), ...current],
        );
      } else {
        setSample(nextTimesheet);
      }
      const url = new URL(window.location.href);
      url.searchParams.set('timesheetId', nextSource === 'sample' ? 'demo' : nextTimesheet.id);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      setActionMessage('That record could not be loaded. The current timesheet is unchanged.');
    } finally {
      setIsSelecting(false);
    }
  };

  const submitDecision = async (decision: 'approve' | 'return') => {
    if (source !== 'submission') {
      setActionMessage('The sample scenario is read-only. Select a live mobile submission to record a decision.');
      return;
    }
    if (reviewerAccessDenied) {
      setActionMessage('A valid private reviewer link is required before a manager decision can be recorded.');
      return;
    }
    setIsSubmitting(true);
    setActionMessage('');
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/timesheets/${encodeURIComponent(timesheet.id)}/${decision}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(reviewerToken
              ? { 'X-ShiftProof-Reviewer-Token': reviewerToken }
              : {}),
          },
          body: JSON.stringify(decision === 'approve' ? {} : { note: returnNote.trim() }),
        },
      );
      if (response.status === 401) {
        try {
          window.sessionStorage.removeItem(reviewerTokenSessionKey);
        } catch {
          // The in-memory token is still cleared below when storage is unavailable.
        }
        setReviewerToken(null);
        setReviewerAccessRequired(true);
        setReviewerAccessChecked(true);
        setReviewerAuthError(true);
        setMode('idle');
        setReturnNote('');
        setActionMessage('This private reviewer link was not accepted. Open a fresh private reviewer link and try again.');
        return;
      }
      if (!response.ok) throw new Error('The review API did not accept the decision');
      const updated = ((await response.json()) as { data: ApiTimesheet }).data;
      setTimesheet(updated);
      if (source === 'submission') {
        setSubmissions((current) =>
          current.map((item) =>
            item.id === updated.id ? summaryFromTimesheet(updated) : item,
          ),
        );
      }
      setSelectedId(
        updated.entries.find((entry) => entry.id === selectedId)?.id ??
          updated.entries[0]?.id ??
          '',
      );
      setRecordMode('live');
      setMode('idle');
      setReturnNote('');
      setActionMessage(
        decision === 'approve'
          ? `Approved ${updated.employee.name}'s exact submission. Receipt ${updated.receiptId ?? 'recorded'}.`
          : `Returned to ${updated.employee.name} with your note in the revision history.`,
      );
    } catch {
      setActionMessage('The decision was not recorded. Nothing changed; check the API and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="review-shell min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <aside className="review-nav" aria-label="Manager navigation">
        <Link className="wordmark px-6 py-8" href="/" aria-label="ShiftProof home">
          SHIFT/<span>PROOF</span>
        </Link>
        <nav className="mt-4 flex-1">
          {navItems.map(({ label, icon: Icon, active }) => (
            <button
              type="button"
              className={`review-nav__item ${active ? 'review-nav__item--active' : ''}`}
              key={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="review-profile">
          <UserRound aria-hidden="true" />
          <div>
            <strong>Sarah J.</strong>
            <span>Manager</span>
          </div>
        </div>
      </aside>

      <div className="review-workspace">
        <header className="review-header">
          <div className="flex min-w-0 items-center gap-5">
            <div className="review-monogram" aria-hidden="true">{initials}</div>
            <div className="min-w-0">
              <p className="truncate text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-.04em]">
                {timesheet.employee.name}
              </p>
              <p className="mt-2 flex min-h-8 items-center gap-3 text-[var(--slate)]">
                {periodLabel(timesheet)} <ChevronDown className="size-4" aria-hidden="true" />
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--slate)]">Total hours</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {timesheet.totals.all.toFixed(1)}<span className="text-lg"> h</span>
            </p>
          </div>
        </header>

        <section className="review-inbox" aria-labelledby="manager-inbox-title">
          <div>
            <p className="proof-meta text-[var(--green)]">CONNECTED MANAGER INBOX</p>
            <h1 id="manager-inbox-title" className="mt-2 text-xl font-semibold">Review mobile submissions</h1>
            <p className="mt-1 text-sm text-[var(--slate)]">
              {submissions.length > 0
                ? `${inboxPending} awaiting a decision · ${submissions.length} live ${submissions.length === 1 ? 'submission' : 'submissions'}`
                : 'No mobile submissions yet · the sample remains available'}{' '}
              <span aria-hidden="true">·</span> Updates automatically
            </p>
          </div>
          <label className="review-inbox__selector">
            <span>RECORD</span>
            <select
              value={selectorValue}
              disabled={isSelecting || recordMode === 'connecting'}
              onChange={(event) => void selectRecord(event.target.value)}
            >
              {submissions.length > 0 && (
                <optgroup label="Live mobile submissions">
                  {submissions.map((item) => (
                    <option key={item.id} value={`submission:${item.id}`}>
                      {recordLabel(item)}
                    </option>
                  ))}
                </optgroup>
              )}
              {source === 'submission' && !submissions.some((item) => item.id === timesheet.id) && (
                <option value={`submission:${timesheet.id}`}>{recordLabel(timesheet)}</option>
              )}
              <optgroup label="Reference">
                <option value={`sample:${sample.id}`}>Sample scenario · {recordLabel(sample)}</option>
              </optgroup>
            </select>
          </label>
        </section>

        <div className="review-layout">
          <section className="review-ledger-panel" aria-labelledby="review-title">
            <div className="review-ledger-heading">
              <div>
                <p className="proof-meta text-[var(--green)]">
                  {source === 'submission' ? 'LIVE MOBILE SUBMISSION' : 'SAMPLE SCENARIO'}
                </p>
                <h2 id="review-title" className="mt-2 text-2xl font-semibold">Manager review</h2>
                <p className="mt-2 font-mono text-[0.68rem] tracking-[.06em] text-[var(--slate)]">
                  TS/SP-{timesheet.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="grid justify-items-end gap-2">
                <span className={`review-sheet-status review-sheet-status--${timesheet.status}`}>
                  {statusLabel(timesheet.status)}
                </span>
                <span className="connectivity-status">
                  <span
                    className={`status-dot ${recordMode === 'live' ? 'bg-[var(--green)]' : 'border border-[var(--slate)]'}`}
                    aria-hidden="true"
                  />
                  {recordMode === 'live'
                    ? 'Connected record'
                    : recordMode === 'connecting'
                      ? 'Connecting'
                      : 'Read-only preview'}
                </span>
              </div>
            </div>

            {entries.length > 0 ? (
              <Table className="review-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>DAY</TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>HOURS</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>NOTE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      data-state={entry.id === selectedId ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedId(entry.id);
                        setActionMessage('');
                        setMode('idle');
                      }}
                    >
                      <TableCell className="font-medium">{entry.day}</TableCell>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell className="tabular-nums">{entry.hours}</TableCell>
                      <TableCell><StatusMark state={entry.state} /></TableCell>
                      <TableCell className="max-w-[260px] whitespace-normal">{entry.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="review-empty">
                <p className="font-semibold">No entries in this timesheet</p>
                <p className="mt-2 text-sm text-[var(--slate)]">The record exists, but there is nothing for a manager to approve yet.</p>
              </div>
            )}
          </section>

          <aside className="review-detail" aria-label="Selected entry details">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Entry details</p>
                <p className="mt-1 text-[var(--slate)]">
                  {selected ? `Entry revision ${String(selected.source.revision).padStart(2, '0')}` : 'No entry selected'}
                </p>
              </div>
              {timesheet.receiptId && (
                <span className="review-receipt">{timesheet.receiptId}</span>
              )}
            </div>

            <div className="border-b border-[var(--line)] py-7">
              <p className="text-5xl font-semibold tracking-[-.05em] tabular-nums">
                {selected?.hours ?? '—'}<span className="ml-2 text-lg font-normal">hours</span>
              </p>
              <p className="mt-6 max-w-[280px] leading-7">{selected?.note ?? 'No entry note.'}</p>
            </div>

            <div className="border-b border-[var(--line)] py-6">
              <p className="font-semibold">
                {selected?.source.status === 'confirmed' ? 'Employee confirmed' : 'Recorded from mobile'}
              </p>
              <p className="mt-1 text-[var(--slate)]">
                {selected ? formatDateTime(selected.source.updatedAt) : '—'}
              </p>
            </div>

            <div className="py-6">
              <p className="proof-meta">REVISION HISTORY</p>
              {orderedRevisions.length > 0 ? (
                <ol className="revision-list mt-5">
                  {orderedRevisions.map((revision, index) => (
                    <li key={revision.id}>
                      <span />
                      <strong>{String(revision.revision).padStart(2, '0')}</strong>
                      <span className="revision-list__event">
                        <b>{actionLabels[revision.action] ?? revision.action.replaceAll('_', ' ').toLowerCase()}</b>
                        <small>{formatDateTime(revision.createdAt)}</small>
                        {revision.note && <small>{revision.note}</small>}
                      </span>
                      {index === 0 && <em>Current</em>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-[var(--slate)]">No revision history was returned.</p>
              )}
            </div>

            {source === 'submission' && mode === 'returning' && !isTerminal && (
              <div className="mb-3">
                <label htmlFor="return-note" className="proof-meta">RETURN NOTE</label>
                <Textarea
                  id="return-note"
                  className="mt-2 min-h-24 rounded-[4px] bg-[var(--surface)]"
                  value={returnNote}
                  onChange={(event) => setReturnNote(event.target.value)}
                  placeholder="Explain what needs changing."
                />
              </div>
            )}

            <div className="mt-auto grid gap-3 pt-3">
              {source === 'sample' ? (
                <div className="review-decision">
                  <strong>Reference only</strong>
                  <span>The shared sample is read-only. Select a live mobile submission to approve or return an exact record.</span>
                </div>
              ) : !reviewerAccessChecked ? (
                <div className="review-decision">
                  <strong>Checking reviewer access</strong>
                  <span>The submission remains readable while ShiftProof checks whether decisions require a private reviewer link.</span>
                </div>
              ) : reviewerAccessDenied ? (
                <div className="review-decision review-decision--restricted">
                  <strong>Private reviewer link required</strong>
                  <span>
                    {reviewerAuthError
                      ? 'This session’s reviewer link was not accepted. Open a fresh private reviewer link to approve or return this submission.'
                      : 'This submission is publicly inspectable, but approval and return controls are available only through a private reviewer link.'}
                  </span>
                </div>
              ) : isTerminal ? (
                <div className={`review-decision review-decision--${timesheet.status}`}>
                  <strong>{statusLabel(timesheet.status)}</strong>
                  <span>
                    {timesheet.status === 'approved'
                      ? `Decision recorded${timesheet.approvedAt ? ` ${formatDateTime(timesheet.approvedAt)}` : ''}.`
                      : 'The manager note and returned status are preserved in the record.'}
                  </span>
                </div>
              ) : mode === 'returning' ? (
                <Button
                  className="min-h-12 rounded-[4px] bg-[var(--amber)] text-white hover:bg-[var(--amber)]/90"
                  disabled={!returnNote.trim() || isSubmitting || recordMode !== 'live'}
                  onClick={() => void submitDecision('return')}
                >
                  {isSubmitting ? 'Recording…' : 'Confirm return'}
                </Button>
              ) : (
                <Button
                  className="min-h-12 rounded-[4px] bg-[var(--green)] text-white hover:bg-[var(--green-deep)]"
                  disabled={isSubmitting || recordMode !== 'live' || entries.length === 0}
                  onClick={() => void submitDecision('approve')}
                >
                  {isSubmitting ? 'Recording…' : 'Approve exact submission'}
                </Button>
              )}
              {source === 'submission' && reviewerAccessChecked && !reviewerAccessDenied && !isTerminal && (
                <Button
                  variant="outline"
                  className="min-h-12 rounded-[4px] border-[var(--ink)] bg-transparent"
                  disabled={recordMode !== 'live'}
                  onClick={() => {
                    setMode((current) => (current === 'returning' ? 'idle' : 'returning'));
                    setActionMessage('');
                  }}
                >
                  {mode === 'returning' ? 'Cancel' : 'Return with note'}
                </Button>
              )}
              <p className="min-h-10 pt-2 text-sm leading-5 text-[var(--slate)]" aria-live="polite">
                {actionMessage}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
