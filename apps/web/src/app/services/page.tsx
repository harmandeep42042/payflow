import Link from 'next/link';
import { Card, PageContainer, PageHeader, StatusBadge } from '../components/customer';
import { customerCapabilities } from '../lib/customer-capabilities';

export default function ServicesPage() {
  return <main><PageContainer>
    <PageHeader eyebrow="Payflow services" title="Payments and account tools" description="Available features open directly. Planned capabilities are labelled honestly until their secure backend or provider contract exists." />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {customerCapabilities.map((item) => <Card key={item.name} className="flex min-h-52 flex-col p-5">
        <div><StatusBadge status={item.status} /></div>
        <h2 className="mt-4 text-lg font-bold text-slate-950">{item.name}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{item.description}</p>
        {item.href ? <Link href={item.href} className="mt-5 inline-flex min-h-11 items-center font-bold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Open {item.name}<span aria-hidden="true" className="ml-2">→</span></Link> : <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Not currently actionable</p>}
      </Card>)}
    </div>
  </PageContainer></main>;
}
