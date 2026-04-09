import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Checkbox, Skeleton } from '@mashora/design-system'
import { useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { downloadBase64 } from './ActionResultHandler'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  model: string
  domain?: any[]
  recordIds?: number[]
}

export default function ExportDialog({ open, onClose, model, domain, recordIds }: ExportDialogProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  const { data: fields, isLoading } = useQuery({
    queryKey: ['fields', model, 'export'],
    queryFn: async () => {
      const { data } = await erpClient.raw.get(`/views/${model}/fields`)
      return data
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const fieldList = fields
    ? Object.entries(fields as Record<string, any>)
        .filter(([, meta]) => meta.type !== 'one2many' && meta.type !== 'binary' && !meta.name?.startsWith('_'))
        .sort(([, a], [, b]) => (a.string || '').localeCompare(b.string || ''))
    : []

  // Select common fields by default when fields load
  if (fieldList.length > 0 && selectedFields.length === 0) {
    const defaults = fieldList.slice(0, 10).map(([name]) => name)
    setSelectedFields(defaults)
  }

  const toggleField = (name: string) => {
    setSelectedFields(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    )
  }

  const selectAll = () => setSelectedFields(fieldList.map(([name]) => name))
  const selectNone = () => setSelectedFields([])

  const handleExport = async () => {
    setExporting(true)
    try {
      // Export endpoint uses query params
      const params = new URLSearchParams({
        model,
        fields: selectedFields.join(','),
        domain: JSON.stringify(domain || []),
        format: 'csv',
      })
      const { data } = await erpClient.raw.post(`/import-export/export?${params.toString()}`, {})
      if (data.content) {
        downloadBase64(data.content, data.filename || `${model}_export.csv`, 'text/csv')
      }
      onClose()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle>Export {model.replace(/\./g, ' ')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{selectedFields.length} fields selected</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs rounded-lg">All</Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs rounded-lg">None</Button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border p-2 space-y-0.5">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)
            ) : (
              fieldList.map(([name, meta]) => (
                <label key={name} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer">
                  <Checkbox
                    checked={selectedFields.includes(name)}
                    onCheckedChange={() => toggleField(name)}
                  />
                  <span className="text-sm flex-1">{(meta as any).string || name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{(meta as any).type}</span>
                </label>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={handleExport}
              disabled={exporting || selectedFields.length === 0}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
