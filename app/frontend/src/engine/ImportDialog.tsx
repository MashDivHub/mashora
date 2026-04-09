import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, Skeleton } from '@mashora/design-system'
import { Upload, ArrowRight, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  model: string
  onComplete?: () => void
}

type Step = 'upload' | 'preview' | 'result'

interface PreviewData {
  columns: string[]
  preview_rows: Record<string, string>[]
  model_fields: Record<string, { label: string; type: string; required: boolean }>
  row_count: number
}

interface ImportResult {
  created: number
  errors: { row: number; error: string }[]
  total_rows: number
}

export default function ImportDialog({ open, onClose, model, onComplete }: ImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const readFileAsBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setLoading(true)
    setError(null)

    try {
      const content = await readFileAsBase64(selectedFile)

      const { data } = await erpClient.raw.post('/import-export/import/preview', {
        model,
        file_content: content,
        file_type: 'csv',
      })

      const previewData = data as PreviewData

      // Auto-map: try exact match between CSV column and model field name or label
      const autoMapping: Record<string, string> = {}
      for (const col of previewData.columns) {
        const colLower = col.toLowerCase().trim()
        const match = Object.entries(previewData.model_fields).find(
          ([fieldName, meta]) =>
            fieldName.toLowerCase() === colLower ||
            meta.label.toLowerCase() === colLower
        )
        if (match) autoMapping[col] = match[0]
      }

      setPreview(previewData)
      setMapping(autoMapping)
      setStep('preview')
    } catch (e) {
      setError('Failed to preview file. Make sure it is a valid CSV.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !preview) return
    setLoading(true)
    setError(null)

    try {
      const content = await readFileAsBase64(file)

      const { data } = await erpClient.raw.post('/import-export/import/execute', {
        model,
        file_content: content,
        file_type: 'csv',
        field_mapping: mapping,
      })

      setResult(data as ImportResult)
      setStep('result')
      onComplete?.()
    } catch (e) {
      setError('Import failed. Please check the field mapping and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('upload')
    setFile(null)
    setPreview(null)
    setMapping({})
    setResult(null)
    setError(null)
    onClose()
  }

  const fieldOptions = preview
    ? Object.entries(preview.model_fields).sort(([, a], [, b]) =>
        a.label.localeCompare(b.label)
      )
    : []

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import {model.replace(/\./g, ' ')}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 p-12 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supported format: .csv</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
          </div>
        )}

        {/* Step 2: Preview + Mapping */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{preview.row_count} rows found in {file?.name}</p>

            {/* Field mapping */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Field Mapping</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border p-2">
                {preview.columns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-36 truncate text-sm font-medium">{col}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Select
                      value={mapping[col] || ''}
                      onValueChange={v => setMapping(prev => ({ ...prev, [col]: v }))}
                    >
                      <SelectTrigger className="h-8 flex-1 rounded-lg text-xs">
                        <SelectValue placeholder="Skip this column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="" className="text-xs">-- Skip --</SelectItem>
                        {fieldOptions.map(([name, meta]) => (
                          <SelectItem key={name} value={name} className="text-xs">{meta.label || name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview rows */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {preview.columns.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {preview.columns.map((col, j) => (
                          <td key={j} className="px-3 py-1.5 truncate max-w-[150px]">{row[col] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="rounded-xl">Back</Button>
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={handleImport}
                disabled={loading || Object.values(mapping).filter(Boolean).length === 0}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {loading ? 'Importing...' : `Import ${preview.row_count} rows`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/20 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
              <p className="text-lg font-semibold">{result.created} records imported</p>
              {result.errors.length > 0 && (
                <p className="text-sm text-destructive mt-1">{result.errors.length} errors</p>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-xl border p-2 space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <Badge variant="destructive" className="text-[10px] shrink-0">Row {err.row}</Badge>
                    <span className="text-muted-foreground">{err.error}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose} className="rounded-xl">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
