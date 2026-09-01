import Link from 'next/link';

const proofRows = [
  { day: 'MON', date: '24', hours: '8.0 h', state: 'verified' },
  { day: 'TUE', date: '25', hours: '16.0 h', state: 'attention' },
  { day: 'WED', date: '26', hours: '8.0 h', state: 'verified' },
  { day: 'THU', date: '27', hours: '7.5 h', state: 'local' },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between border-b border-[var(--line)] px-6 py-6 sm:px-10">
        <Link href="/" className="wordmark" aria-label="ShiftProof home">
          SHIFT/<span>PROOF</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm" aria-label="Primary navigation">
          <Link className="link-underline hidden sm:inline" href="#engineering">
            Engineering notes
          </Link>
          <Link className="link-underline" href="/review">
            Manager review
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1180px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:py-24">
        <div>
          <p className="proof-meta mb-6">OFFLINE-FIRST TIME EVIDENCE / BUILD 01</p>
          <h1 className="max-w-[720px] text-[clamp(3.6rem,8vw,7.4rem)] font-semibold leading-[.84] tracking-[-.065em]">
            Hours worked.
            <br />
            <span className="text-[var(--green)]">Proof earned.</span>
          </h1>
          <p className="mt-8 max-w-[590px] text-lg leading-8 text-[var(--slate)] sm:text-xl">
            A native timecard that saves work before the network returns, retries
            safely, and turns every approval into a durable receipt.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link className="primary-action" href="/review">
              Open manager review <span aria-hidden="true">→</span>
            </Link>
            <a className="secondary-action" href="#engineering">
              Read the system notes
            </a>
          </div>
        </div>

        <div className="proof-sheet" aria-label="Example ShiftProof employee record">
          <div className="flex items-center justify-between border-b border-dashed border-[var(--line-strong)] pb-5">
            <div>
              <p className="proof-meta">CURRENT PERIOD</p>
              <p className="mt-2 text-2xl font-semibold">Aug 24 — Sep 06</p>
            </div>
            <div className="connectivity-status">
              <span className="status-dot bg-[var(--amber)]" aria-hidden="true" />
              Saved offline
            </div>
          </div>

          <div className="flex items-end justify-between py-7">
            <div>
              <p className="proof-meta">RECORDED</p>
              <p className="hours-display mt-1">39.5<span> h</span></p>
            </div>
            <p className="proof-id">SP/L-01928</p>
          </div>

          <div className="ledger" role="list" aria-label="Recent time entries">
            {proofRows.map((row) => (
              <div className="ledger-row" role="listitem" key={row.day}>
                <span className="proof-meta w-12">{row.day}</span>
                <span className="text-[var(--slate)]">{row.date}</span>
                <span className="ml-auto tabular-nums">{row.hours}</span>
                <span
                  className={`proof-mark proof-mark--${row.state}`}
                  aria-label={
                    row.state === 'verified'
                      ? 'Verified'
                      : row.state === 'attention'
                        ? 'Needs attention'
                        : 'Saved locally, pending sync'
                  }
                >
                  {row.state === 'attention' ? '!' : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-dashed border-[var(--line-strong)] pt-5">
            <p className="text-sm text-[var(--slate)]">Queued safely on this device</p>
            <p className="proof-meta text-[var(--green)]">○ → ●</p>
          </div>
        </div>
      </section>

      <section id="engineering" className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-[1180px] gap-px bg-[var(--line)] sm:grid-cols-3">
          {[
            ['01', 'LOCAL-FIRST', 'SQLite commits the entry and its sync operation together.'],
            ['02', 'SAFE RETRIES', 'One stable key means retries return one record, never a duplicate.'],
            ['03', 'VISIBLE REVIEW', 'Unusual hours stay calm, explicit, and reviewable by a manager.'],
          ].map(([number, title, copy]) => (
            <article className="bg-[var(--surface)] p-8 sm:p-10" key={number}>
              <p className="proof-meta text-[var(--green)]">{number} / PROOF</p>
              <h2 className="mt-8 text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-7 text-[var(--slate)]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-10 text-sm text-[var(--slate)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p className="max-w-[720px] leading-6">
          Independent portfolio demo built with synthetic data. ShiftProof is not a
          Wagepoint product and was not commissioned or endorsed by Wagepoint.
        </p>
        <a
          className="proof-meta link-underline w-fit text-[var(--ink)]"
          href="https://github.com/yazanbaker94/shiftproof"
          rel="noreferrer"
          target="_blank"
        >
          SOURCE + DOCUMENTATION →
        </a>
      </footer>
    </main>
  );
}
