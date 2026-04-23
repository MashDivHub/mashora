import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@mashora/design-system'
import { Menu, Plus } from 'lucide-react'
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
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['website-menus'],
    queryFn: () =>
      erpClient.raw
        .post('/website/menus', { website_id: false, parent_id: false })
        .then((r) => r.data as { records: MenuRecord[]; total: number }),
  })

  const records = [...(data?.records ?? [])].sort((a, b) => a.sequence - b.sequence)
  const showEmptyCta = !isLoading && !isError && records.length === 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website Menus"
        subtitle="website"
        onNew={() => navigate('/admin/model/website.menu/new')}
        newLabel="New Menu Item"
      />

      {showEmptyCta ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-12 text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-primary/10 p-3 w-fit text-primary">
            <Menu className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">No menu items yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Menus define your site navigation. Create your first menu entry to get started.
            </p>
          </div>
          <Button onClick={() => navigate('/admin/model/website.menu/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Menu
          </Button>
        </div>
      ) : (
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
              ) : (
                records.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/admin/model/website.menu/${row.id}`)}
                    className={`${i % 2 === 0 ? 'bg-card' : 'bg-muted/10'} cursor-pointer hover:bg-muted/30 transition-colors`}
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
      )}
    </div>
  )
}
