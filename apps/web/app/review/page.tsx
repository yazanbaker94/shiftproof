import type { Metadata } from 'next';
import { ReviewLedger } from './review-ledger';

export const metadata: Metadata = {
  title: 'Manager review — ShiftProof',
  description: 'Review connected mobile timesheet submissions and record an auditable manager decision.',
};

export default function ReviewPage() {
  return <ReviewLedger />;
}
