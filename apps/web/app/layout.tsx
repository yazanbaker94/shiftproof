import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shiftproof.swoop.video',
  ),
  title: 'ShiftProof — Hours worked. Proof earned.',
  description:
    'An offline-first React Native timecard demo with safe synchronization and manager approval evidence.',
  openGraph: {
    title: 'ShiftProof — Hours worked. Proof earned.',
    description:
      'An offline-first React Native timecard demo with safe synchronization and manager approval evidence.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ShiftProof — Hours worked. Proof earned.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShiftProof — Hours worked. Proof earned.',
    description:
      'An offline-first React Native timecard demo with safe synchronization and manager approval evidence.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
