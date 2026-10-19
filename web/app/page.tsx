import { Dashboard } from '@/components/Dashboard'
import { Login } from '@/components/Login'
import { isViewerAuthenticated } from '@/lib/auth'
import { loadSnapshot } from '@/lib/snapshot'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isViewerAuthenticated())) {
    const params = await searchParams
    return <Login invalid={params.error === 'senha'}/>
  }
  const snapshot = await loadSnapshot()
  return <Dashboard snapshot={snapshot}/>
}

