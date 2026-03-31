import { useEffect, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'
import { listTenants, type Tenant } from '../api/tenants'
import { checkAvailableUpgrade, listUpgrades, startUpgrade, type AvailableUpgradeResponse, type UpgradeResponse } from '../api/upgrades'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface TenantUpgradeState {
  tenant: Tenant
  checkResult: AvailableUpgradeResponse | null
  checking: boolean
  upgrading: boolean
  error: string
  history: UpgradeResponse[]
  historyLoading: boolean
}

export default function Upgrades() {
  const [states, setStates] = useState<TenantUpgradeState[]>([])
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    listTenants()
      .then((tenants) => {
        const initial = tenants.map((tenant) => ({
          tenant,
          checkResult: null,
          checking: false,
          upgrading: false,
          error: '',
          history: [],
          historyLoading: true,
        }))
        setStates(initial)
        tenants.forEach((tenant, index) => {
          listUpgrades(String(tenant.id))
            .then((history) => {
              setStates((prev) =>
                prev.map((state, stateIndex) => (stateIndex === index ? { ...state, history, historyLoading: false } : state))
              )
            })
            .catch(() => {
              setStates((prev) =>
                prev.map((state, stateIndex) => (stateIndex === index ? { ...state, historyLoading: false } : state))
              )
            })
        })
      })
      .catch(() => setGlobalError('Failed to load tenants.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCheck(index: number) {
    const tenantId = String(states[index].tenant.id)
    setStates((prev) => prev.map((state, i) => (i === index ? { ...state, checking: true, error: '', checkResult: null } : state)))
    try {
      const result = await checkAvailableUpgrade(tenantId)
      setStates((prev) => prev.map((state, i) => (i === index ? { ...state, checking: false, checkResult: result } : state)))
    } catch {
      setStates((prev) => prev.map((state, i) => (i === index ? { ...state, checking: false, error: 'Failed to check for updates.' } : state)))
    }
  }

  async function handleUpgrade(index: number) {
    const state = states[index]
    if (!state.checkResult?.latest_version) return
    const tenantId = String(state.tenant.id)
    setStates((prev) => prev.map((item, i) => (i === index ? { ...item, upgrading: true, error: '' } : item)))
    try {
      const result = await startUpgrade(tenantId, state.checkResult.latest_version)
      setStates((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                upgrading: false,
                checkResult: null,
                history: [result, ...item.history],
              }
            : item
        )
      )
    } catch {
      setStates((prev) => prev.map((item, i) => (i === index ? { ...item, upgrading: false, error: 'Failed to start upgrade.' } : item)))
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Upgrades"
        title="Release and upgrade control"
        description="Check each tenant for available releases, start upgrade jobs, and review history in one place."
      />

      {globalError ? <Notice tone="danger">{globalError}</Notice> : null}

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6 text-sm text-muted-foreground">
          Loading tenants...
        </div>
      ) : states.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6 text-sm text-muted-foreground">
          No tenant instances found.
        </div>
      ) : (
        states.map((state, index) => (
          <div key={state.tenant.id} className="rounded-3xl border border-border/70 bg-card/90 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{state.tenant.db_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {state.checkResult ? `Current version ${state.checkResult.current_version}` : 'Check for updates to see the current version.'}
                </p>
                {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {state.checkResult?.available ? (
                  <Button onClick={() => handleUpgrade(index)} disabled={state.upgrading}>
                    <ArrowUpCircle className="size-4" />
                    {state.upgrading ? 'Upgrading...' : `Upgrade to ${state.checkResult.latest_version}`}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => handleCheck(index)} disabled={state.checking}>
                  {state.checking ? 'Checking...' : 'Check for updates'}
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {state.checkResult?.available ? (
                <Notice tone="success" className="w-fit">
                  Version {state.checkResult.latest_version} is available.
                </Notice>
              ) : state.checkResult ? (
                <Notice tone="info" className="w-fit">
                  This tenant is already up to date.
                </Notice>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="mb-3 text-sm font-medium">Upgrade history</div>
              {state.historyLoading ? (
                <div className="text-sm text-muted-foreground">Loading history...</div>
              ) : state.history.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  No upgrades yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.history.map((upgrade) => (
                      <TableRow key={upgrade.id}>
                        <TableCell>{upgrade.from_version || '-'}</TableCell>
                        <TableCell className="font-medium">{upgrade.to_version}</TableCell>
                        <TableCell><StatusBadge value={upgrade.status} /></TableCell>
                        <TableCell className="text-muted-foreground">
                          {upgrade.started_at ? new Date(upgrade.started_at).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {upgrade.completed_at ? new Date(upgrade.completed_at).toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
