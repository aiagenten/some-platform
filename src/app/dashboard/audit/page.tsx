import { redirect } from 'next/navigation'

export default function AuditRedirectPage() {
  redirect('/dashboard/admin/audit')
}
