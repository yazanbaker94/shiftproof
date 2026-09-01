import Image from 'next/image';
import Link from 'next/link';

const androidApkUrl =
  'https://github.com/yazanbaker94/shiftproof/releases/latest/download/shiftproof-release-arm64-v8a.apk';

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
          <a className="link-underline font-semibold text-[var(--green)]" href={androidApkUrl}>
            Download Android
          </a>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1180px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:py-24">
        <div>
          <p className="proof-meta mb-6">REACT NATIVE ANDROID + MANAGER WEB / BUILD 01</p>
          <h1 className="max-w-[720px] text-[clamp(3.6rem,8vw,7.4rem)] font-semibold leading-[.84] tracking-[-.065em]">
            Hours worked.
            <br />
            <span className="text-[var(--green)]">Proof earned.</span>
          </h1>
          <p className="mt-8 max-w-[590px] text-lg leading-8 text-[var(--slate)] sm:text-xl">
            A working React Native Android timecard that saves work before the network
            returns, synchronizes safely, and reflects manager approval back on the device.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a className="primary-action" href={androidApkUrl}>
              Download Android APK <span aria-hidden="true">↓</span>
            </a>
            <Link className="secondary-action" href="/review">
              Open manager web <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--slate)]">
            ARM64 reviewer build for modern Android devices.{' '}
            <a
              className="link-underline font-semibold text-[var(--ink)]"
              href="https://github.com/yazanbaker94/shiftproof"
              rel="noreferrer"
              target="_blank"
            >
              View source + documentation
            </a>
          </p>
        </div>

        <div className="mobile-proof" aria-label="ShiftProof Android app preview">
          <div className="mobile-proof__caption">
            <span className="proof-meta text-[var(--green)]">ANDROID APP / LIVE BUILD</span>
            <span className="proof-meta">APPROVAL RECONCILED</span>
          </div>
          <div className="mobile-proof__device">
            <Image
              alt="ShiftProof Android timesheet showing an approved entry as payroll ready"
              className="mobile-proof__screen"
              height={2424}
              priority
              src="/shiftproof-android-timesheet-approved.png"
              unoptimized
              width={1080}
            />
          </div>
          <p className="mobile-proof__note">
            The manager decision above is returned to the React Native app—not simulated as a web-only state.
          </p>
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
