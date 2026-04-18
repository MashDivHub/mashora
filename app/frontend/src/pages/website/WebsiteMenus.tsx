import { useQuery } from '@tanstack/react-query'
import { Badge } from '@mashora/design-system'
import { Menu } from 'lucide-react'
import { PageHeader, LoadingState, ErrorState } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'

interface MenuRecord {
  id: number
  name: string
  url: string
  sequence: number
  parent_id: [number, string] | false
  new_window: boolean
}

export default function WebsiteMenus() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['website-menus'],
    queryFn: () =>
      erpClient.raw
        .post('/website/menus', { website_id: false, parent_id: false })
        .then((r) => r.data as { records: MenuRecord[]; total: number }),
  })

  const records = [...(data?.records ?? [])].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="space-y-4">
      <PageHeader title="Website Menus" subtitle="website" />

      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">URL</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">New Window</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parent</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sequence</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  <LoadingState label="Loading menus..." />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <ErrorState error={error} onRetry={() => refetch()} />
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Menu className="h-8 w-8 text-muted-foreground/40" />
                    <span>No menus found</span>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 === 0 ? 'bg-card' : 'bg-muted/10'}
                >
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{row.url}</td>
                  <td className="px-4 py-3">
                    {row.new_window ? (
                      <Badge variant="default" className="rounded-full text-xs">Yes</Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-full text-xs">No</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.parent_id ? row.parent_id[1] : 'Root'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.sequence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
