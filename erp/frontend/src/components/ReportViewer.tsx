/**
 * Report viewer component — renders PDF reports from the backend.
 *
 * Usage:
 *   <ReportViewer reportName="account.report_invoice" recordIds={[1, 2]} />
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton, cn } from '@mashora/design-system'
import { Download, FileText, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface ReportViewerProps {
  reportName: string
  recordIds: number[]
  title?: string
  className?: string
}

export default function ReportViewer({ reportName, recordIds, title, className }: ReportViewerProps) {
  const [showPreview, setShowPreview] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['report', reportName, recordIds],
    queryFn: () =>
      erpClient.raw.post(
        `/reports/generate?report_name=${reportName}&record_ids=${recordIds.join(',')}&report_type=pdf`
      ).then((r: any) => r.data),
    enabled: showPreview,
  })

  const handleDownload = () => {
    const url = `/api/v1/reports/download?report_name=${reportName}&record_ids=${recordIds.join(',')}`
    window.open(url, '_blank')
  }

  const pdfDataUrl = data?.content
    ? `data:application/pdf;base64,${data.content}`
    : null

  const displayTitle = title || 'Report'

  return (
    <div
      className={cn(
        'rounded-3xl border border-border/60 bg-card shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/70 bg-muted/20 px-6 py-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 rounded-xl border border-border/70 bg-muted/60 p-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="truncate text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {displayTitle}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-xl gap-1.5"
            aria-expanded={showPreview}
            aria-label={showPreview ? 'Hide report preview' : 'Show report preview'}
          >
            {showPreview ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                Preview
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="rounded-xl gap-1.5"
            aria-label="Download PDF"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Preview panel — only mounted when open */}
      {showPreview && (
        <div className="p-5">
          {isLoading ? (
            /* Skeleton that mimics a PDF page */
            <div className="space-y-3">
              <Skeleton className="h-[600px] w-full rounded-2xl" />
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 animate-pulse" />
                Generating preview…
              </div>
            </div>
          ) : pdfDataUrl ? (
            <iframe
              src={pdfDataUrl}
              className="h-[600px] w-full rounded-2xl border border-border/50 bg-white shadow-inner"
              title={`${displayTitle} preview`}
            />
          ) : (
            /* Error state */
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-muted/20 py-14">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Preview unavailable</p>
                <p className="text-xs text-muted-foreground">
                  Could not load report preview. Try downloading instead.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="rounded-xl gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
