import { useQuery } from '@tanstack/react-query'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@mashora/design-system'
import { Printer } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface PrintMenuProps {
  model: string
  recordIds: number[]
  onSelectReport: (reportName: string) => void
}

export default function PrintMenu({ model, recordIds: _recordIds, onSelectReport }: PrintMenuProps) {
  const { data: reports } = useQuery({
    queryKey: ['reports', model],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/reports/available?model=${model}`)
      return data.reports || data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  if (!reports || reports.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {reports.map((report: any) => (
          <DropdownMenuItem
            key={report.report_name || report.id}
            className="cursor-pointer rounded-lg"
            onClick={() => onSelectReport(report.report_name || report.name)}
          >
            {report.name || report.report_name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
