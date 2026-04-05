import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PageHeader, Input, Badge, Tabs, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton, CardTitle,
} from '@mashora/design-system'
import { Search, BookOpen, CheckCircle2, Circle } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface Account {
  id: number
  name: string
  code: string
  account_type: string
  internal_group: string
  reconcile: boolean
  used: boolean
}

const groupVariants: Record<string, 'info' | 'warning' | 'default' | 'success' | 'destructive' | 'secondary'> = {
  asset: 'info',
  liability: 'warning',
  equity: 'default',
  income: 'success',
  expense: 'destructive',
  off_balance: 'secondary',
}

const groupLabels: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
  off_balance: 'Off Balance',
}

type GroupTab = 'all' | 'asset' | 'liability' | 'equity' | 'income' | 'expense'

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent border-border/40">
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function ChartOfAccounts() {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<GroupTab>('all')

  const params: Record<string, any> = { limit: 500 }
  if (search) params.search = search
  if (group !== 'all') params.internal_group = [group]

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', search, group],
    queryFn: () => erpClient.raw.post('/accounting/accounts', params).then((r) => r.data),
  })

  const records: Account[] = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description={isLoading ? 'Loading...' : `${data?.total ?? 0} accounts`}
      />

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Group tabs */}
      <Tabs value={group} onValueChange={(v) => setGroup(v as GroupTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="asset">Assets</TabsTrigger>
          <TabsTrigger value="liability">Liabilities</TabsTrigger>
          <TabsTrigger value="equity">Equity</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expense">Expenses</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Accounts table card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Accounts</CardTitle>
          </div>
          {!isLoading && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {records.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/10 hover:bg-muted/10">
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Code</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Group</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reconcile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : records.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No accounts found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-border/40 hover:bg-muted/50 transition-colors"
                  >
                    <TableCell>
                      <span className="font-mono text-sm font-semibold tracking-wide">
                        {row.code}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {row.name}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {row.account_type.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={groupVariants[row.internal_group] ?? 'secondary'}>
                        {groupLabels[row.internal_group] ?? row.internal_group}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.reconcile ? (
                        <div className="flex items-center gap-1.5 text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Yes</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground/50">
                          <Circle className="h-4 w-4" />
                          <span className="text-xs">No</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
