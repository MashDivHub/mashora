import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Badge, Input,
  Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  CardTitle, CardDescription,
} from '@mashora/design-system'
import { Plus, Search, Globe, Globe2, SlidersHorizontal, Home } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CmsPage {
  id: number
  name: string
  url: string
  website_published: boolean
  is_homepage: boolean
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'published' | 'draft'

const tabConfig: { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CmsPages() {
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')

  const params: Record<string, any> = { limit: 100, search: search || undefined }
  if (tab === 'published') params.published = true
  else if (tab === 'draft') params.published = false

  const { data, isLoading } = useQuery({
    queryKey: ['cms-pages', tab, search],
    queryFn: () => erpClient.raw.post('/website/pages', params).then((r) => r.data),
  })

  const records: CmsPage[] = data?.records ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Website
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Website Pages</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${data?.total ?? 0} pages`}
          </p>
        </div>
        <Button className="rounded-2xl">
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList className="rounded-xl">
          {tabConfig.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="rounded-lg">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 px-6 py-4 flex items-center justify-between">
          <div>
            <CardTitle>Pages</CardTitle>
            <CardDescription className="mt-0.5">
              {isLoading ? 'Loading...' : `${records.length} result${records.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-2xl border border-border/70 bg-muted/60 p-4">
              <SlidersHorizontal className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No pages found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your filters or create a new page.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Page Name
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  URL
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border/40 hover:bg-muted/50 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{row.name}</span>
                      {row.is_homepage && (
                        <Badge variant="info" className="flex items-center gap-1 text-[10px]">
                          <Home className="h-2.5 w-2.5" />
                          Homepage
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{row.url}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.website_published ? 'success' : 'secondary'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {row.website_published ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Globe2 className="h-3 w-3" />
                      )}
                      {row.website_published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
