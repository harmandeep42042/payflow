import { AdminFeatureList } from '../components/admin/admin-feature-list';

export default function RegulatedPaymentsPage() {
  return <AdminFeatureList title="Payment operations" description="Read-only UPI, merchant, masked bank-link and recurring-payment operational visibility. Provider credentials and full account identifiers are excluded." endpoint="/regulated-payments" />;
}
