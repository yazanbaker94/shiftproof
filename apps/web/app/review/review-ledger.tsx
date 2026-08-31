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
import { useEffect, useMemo, useState } from 'react';
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

type EntryState = 'Approved' | 'Needs attention' | 'Pending sync' | 'Returned';

type ReviewEntry = {
  id: string;
  day: string;
  date: string;
  hours: string;
  state: EntryState | null;
  note: string;
};

type ApiTimeEntry = {
  id: string;
  workDate: string;
  totalHours: number;
  note: string | null;
  status: 'synced' | 'needs_attention' | 'confirmed';
  requiresReview: boolean;
};

type ApiTimesheet = {
  id: string;
  status: 'draft' | 'needs_attention' | 'approved' | 'returned';
  totals: { all: number };
  entries: ApiTimeEntry[];
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://shiftproof.swoop.video/api';

function entriesFromTimesheet(timesheet: ApiTimesheet): ReviewEntry[] {
  const formatted = timesheet.entries
    .slice()
    .sort((left, right) => left.workDate.localeCompare(right.workDate))
    .map((entry) => {
      const date = new Date(`${entry.workDate}T12:00:00Z`);
      const state: EntryState =
        timesheet.status === 'approved'
          ? 'Approved'
          : timesheet.status === 'returned'
            ? 'Returned'
            : entry.requiresReview
              ? 'Needs attention'
              : 'Approved';
      return {
        id: entry.id,
        day: date.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }),
        date: date.toLocaleDateString('en-CA', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        hours: entry.totalHours.toFixed(1),
        state,
        note: entry.note || '—',
      };
    });

  if (!formatted.some((entry) => entry.date === 'Aug 28')) {
    formatted.push({
      id: 'fri-28',
      day: 'Fri',
      date: 'Aug 28',
      hours: '—',
      state: null,
      note: '—',
    });
  }
  return formatted;
}

const initialEntries: ReviewEntry[] = [
  { id: 'mon-24', day: 'Mon', date: 'Aug 24', hours: '8.0', state: 'Approved', note: '—' },
  {
    id: 'tue-25',
    day: 'Tue',
    date: 'Aug 25',
    hours: '16.0',
    state: 'Needs attention',
    note: 'Emergency inventory count after closing.',
  },
  { id: 'wed-26', day: 'Wed', date: 'Aug 26', hours: '8.0', state: 'Approved', note: '—' },
  { id: 'thu-27', day: 'Thu', date: 'Aug 27', hours: '7.5', state: 'Approved', note: '—' },
  { id: 'fri-28', day: 'Fri', date: 'Aug 28', hours: '—', state: null, note: '—' },
];

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Timesheets', icon: CalendarDays, active: true },
  { label: 'Employees', icon: UsersRound },
  { label: 'Reports', icon: ChartNoAxesColumn },
  { label: 'Settings', icon: Settings },
];

function StatusMark({ state }: { state: EntryState | null }) {
  if (!state) return <span aria-label="No entry">—</span>;
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
        {state === 'Needs attention' ? '!' : state === 'Returned' ? '↩' : ''}
      </span>
      {state}
    </span>
  );
}

export function ReviewLedger() {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedId, setSelectedId] = useState('tue-25');
  const [mode, setMode] = useState<'idle' | 'returning'>('idle');
  const [returnNote, setReturnNote] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [recordMode, setRecordMode] = useState<'connecting' | 'live' | 'preview'>('connecting');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/v1/timesheets/demo`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Timesheet could not be loaded');
        const payload = (await response.json()) as { data: ApiTimesheet };
        const liveEntries = entriesFromTimesheet(payload.data);
        setEntries(liveEntries);
        setSelectedId(
          liveEntries.find((entry) => entry.state === 'Needs attention')?.id ??
            liveEntries[0]?.id ??
            'tue-25',
        );
        setRecordMode('live');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRecordMode('preview');
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? entries[1],
    [entries, selectedId],
  );

  const updateSelected = (state: EntryState, message: string) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === selectedId ? { ...entry, state } : entry)),
    );
    setMode('idle');
    setActionMessage(message);
  };

  const submitDecision = async (decision: 'approve' | 'return') => {
    setIsSubmitting(true);
    setActionMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/v1/timesheets/demo/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          decision === 'approve'
            ? {}
            : { note: returnNote.trim() },
        ),
      });
      if (!response.ok) throw new Error('The review API did not accept the decision');
      const payload = (await response.json()) as { data: ApiTimesheet };
      const liveEntries = entriesFromTimesheet(payload.data);
      setEntries(liveEntries);
      setSelectedId(
        liveEntries.find((entry) => entry.id === selectedId)?.id ??
          liveEntries[0]?.id ??
          selectedId,
      );
      setRecordMode('live');
      setMode('idle');
      setActionMessage(
        decision === 'approve'
          ? 'Approved. The decision is now part of the revision history.'
          : 'Returned to Sarah with a recorded note.',
      );
    } catch {
      setRecordMode('preview');
      updateSelected(
        decision === 'approve' ? 'Approved' : 'Returned',
        decision === 'approve'
          ? 'Approved in this isolated preview. The connected demo records the same decision in the API.'
          : 'Returned in this isolated preview with a recorded note.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="review-shell min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <aside className="review-nav" aria-label="Manager navigation">
        <a className="wordmark px-6 py-8" href="/" aria-label="ShiftProof home">
          SHIFT/<span>PROOF</span>
        </a>
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
          <div className="flex items-center gap-5">
            <div className="review-monogram" aria-hidden="true">SP</div>
            <div>
              <p className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-.04em]">Sarah Chen</p>
              <button type="button" className="mt-2 flex min-h-12 items-center gap-3 text-[var(--slate)]">
                Aug 24 — Sep 06 <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--slate)]">Total hours</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">39.5<span className="text-lg"> h</span></p>
          </div>
        </header>

        <div className="review-layout">
          <section className="review-ledger-panel" aria-labelledby="review-title">
            <div className="flex items-center justify-between px-6 pb-5 pt-7 sm:px-8">
              <div>
                <p className="proof-meta text-[var(--green)]">TS/SP-82F14</p>
                <h1 id="review-title" className="mt-2 text-2xl font-semibold">Manager review</h1>
              </div>
              <span className="connectivity-status">
                <span
                  className={`status-dot ${recordMode === 'live' ? 'bg-[var(--green)]' : 'border border-[var(--slate)]'}`}
                  aria-hidden="true"
                />
                {recordMode === 'live'
                  ? 'Live record'
                  : recordMode === 'connecting'
                    ? 'Connecting'
                    : 'Isolated preview'}
              </span>
            </div>

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
                    <TableCell className="max-w-[240px] whitespace-normal">{entry.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <aside className="review-detail" aria-label="Selected entry details">
            <div>
              <p className="text-lg font-semibold">Entry details</p>
              <p className="mt-1 text-[var(--slate)]">Revision 02</p>
            </div>

            <div className="border-b border-[var(--line)] py-7">
              <p className="text-5xl font-semibold tracking-[-.05em] tabular-nums">{selected?.hours}<span className="ml-2 text-lg font-normal">hours</span></p>
              <p className="mt-6 max-w-[260px] leading-7">{selected?.note}</p>
            </div>

            <div className="border-b border-[var(--line)] py-6">
              <p className="font-semibold">Employee confirmed</p>
              <p className="mt-1 text-[var(--slate)]">Aug 25 at 9:31 PM</p>
            </div>

            <div className="py-6">
              <p className="proof-meta">REVISION HISTORY</p>
              <ol className="revision-list mt-5">
                <li><span /> <strong>02</strong> Aug 25 at 9:31 PM <em>Current</em></li>
                <li><span /> <strong>01</strong> Aug 25 at 7:12 PM</li>
                <li><span /> <strong>00</strong> Aug 24 at 8:08 PM</li>
              </ol>
            </div>

            {mode === 'returning' && (
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
              {mode === 'returning' ? (
                <Button
                  className="min-h-12 rounded-[4px] bg-[var(--amber)] text-white hover:bg-[var(--amber)]/90"
                  disabled={!returnNote.trim() || isSubmitting}
                  onClick={() => void submitDecision('return')}
                >
                  {isSubmitting ? 'Recording…' : 'Confirm return'}
                </Button>
              ) : (
                <Button
                  className="min-h-12 rounded-[4px] bg-[var(--green)] text-white hover:bg-[var(--green-deep)]"
                  disabled={isSubmitting}
                  onClick={() => void submitDecision('approve')}
                >
                  {isSubmitting ? 'Recording…' : 'Approve'}
                </Button>
              )}
              <Button
                variant="outline"
                className="min-h-12 rounded-[4px] border-[var(--ink)] bg-transparent"
                onClick={() => {
                  setMode((current) => (current === 'returning' ? 'idle' : 'returning'));
                  setActionMessage('');
                }}
              >
                {mode === 'returning' ? 'Cancel' : 'Return'}
              </Button>
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
