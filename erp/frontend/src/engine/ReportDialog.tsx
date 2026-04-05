import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@mashora/design-system'
import { Download, Eye, EyeOff, Loader2 } from 'lucide-react'
import { generateReport, downloadBase64 } from './ActionResultHandler'

interface ReportDialogProps {
  open: boolean
  onClose: () => void
  reportName: string
  recordIds: number[]
}

export default function ReportDialog({ open, onClose, reportName, recordIds }: ReportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateReport(reportName, recordIds)
      setContent(result.content)
      setFilename(result.filename)
    } catch (e) {
      setError('Failed to generate report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (content) downloadBase64(content, filename)
  }

  // Auto-generate on open
  if (open && !content && !loading && !error) {
    handleGenerate()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setContent(null); setError(null) } }}>
      <DialogContent className="max-w-4xl rounded-3xl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg">{reportName.replace(/_/g, ' ').replace(/\./g, ' ')}</DialogTitle>
          <div className="flex items-center gap-2">
            {content && (
              <>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
                <Button size="sm" className="rounded-xl gap-1.5" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating report...</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            <Button variant="outline" size="sm" className="ml-4 rounded-lg" onClick={handleGenerate}>
              Retry
            </Button>
          </div>
        )}

        {content && showPreview && (
          <div className="mt-2 rounded-2xl border bg-white overflow-hidden" style={{ height: '70vh' }}>
            <iframe
              src={`data:application/pdf;base64,${content}`}
              className="h-full w-full"
              title="Report Preview"
            />
          </div>
        )}

        {content && !showPreview && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <p>Preview hidden. Click "Show Preview" or download the PDF.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
