import Link from 'next/link';
import { Card, PageContainer, PageHeader } from '../components/customer';

const guidance = [
  { title: 'A payment looks unfamiliar', body: 'Review the authoritative transaction status and reference first. Secure your account by changing your password and signing out other sessions.', links: [{ label: 'Review transactions', href: '/transactions' }, { label: 'Manage sessions', href: '/sessions' }] },
  { title: 'A transfer is pending or failed', body: 'Do not repeat a payment solely because it appears delayed. Refresh transaction history and rely on the final server status.', links: [{ label: 'Check transaction history', href: '/transactions' }] },
  { title: 'Protect your account', body: 'Payflow will not ask you to share passwords, session cookies or one-time security codes. Keep recipient and amount details under your control.', links: [{ label: 'Change password', href: '/change-password' }, { label: 'Notification settings', href: '/notification-settings' }] },
];

export default function HelpPage() {
  return <main><PageContainer className="max-w-5xl">
    <PageHeader eyebrow="Support foundation" title="Help and payment safety" description="Self-service guidance based on existing Payflow functionality. Formal dispute submission remains unavailable until a secure case-management contract exists." />
    <div className="mt-8 grid gap-5 lg:grid-cols-3">{guidance.map((item) => <Card key={item.title} className="p-6"><h2 className="text-lg font-bold text-slate-950">{item.title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p><div className="mt-5 flex flex-col items-start gap-3">{item.links.map((link) => <Link key={link.href} href={link.href} className="font-bold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{link.label}</Link>)}</div></Card>)}</div>
    <Card className="mt-6 border-amber-200 bg-amber-50 p-6"><h2 className="font-bold text-amber-950">Dispute submission is not enabled</h2><p className="mt-2 text-sm leading-6 text-amber-900">No support-case backend currently guarantees evidence handling, case ownership or status tracking. This interface does not pretend a dispute was submitted.</p></Card>
  </PageContainer></main>;
}
