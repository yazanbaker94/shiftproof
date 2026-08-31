import type { Metadata } from 'next';
import { ReviewLedger } from './review-ledger';

export const metadata: Metadata = {
  title: 'Manager review — ShiftProof',
  description: 'Review the evidence behind Sarah Chen’s current timesheet.',
};

export default function ReviewPage() {
  return <ReviewLedger />;
}
