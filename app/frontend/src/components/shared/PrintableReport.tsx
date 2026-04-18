import { useRef } from 'react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@mashora/design-system'
import { Printer } from 'lucide-react'

export interface PrintableReportProps {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

// Print-window colors. The popup window does NOT inherit Tailwind / theme
// tokens from the app, so these are intentional literals consolidated here.
const PRINT_COLORS = {
  ink: '#111',       // body text + strong border
  rule: '#ddd',      // row separators
  zebra: '#f5f5f5',  // table header background
} as const

export default function PrintableReport({ title, open, onClose, children }: PrintableReportProps) {
  const ref = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const html = ref.current?.innerHTML || ''
    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${PRINT_COLORS.ink};padding:40px;line-height:1.5;}
        table{width:100%;border-collapse:collapse;margin:16px 0;}
        th,td{padding:8px;text-align:left;border-bottom:1px solid ${PRINT_COLORS.rule};font-size:13px;}
        th{background:${PRINT_COLORS.zebra};font-weight:600;}
        h1{font-size:24px;margin:0 0 8px;} h2{font-size:18px;margin:24px 0 8px;}
        .header{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid ${PRINT_COLORS.ink};}
        .right{text-align:right;}
        .total{font-weight:700;font-size:15px;}
        @page{margin:1cm;}
        @media print{.no-print{display:none;}}
      </style></head><body>${html}<script>window.onload=()=>window.print();</script></body></html>`)
    w.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden bg-white text-zinc-900">
        <DialogHeader className="flex-row items-center justify-between px-5 py-3 border-b border-zinc-200 space-y-0 pr-14">
          <DialogTitle className="font-semibold text-base">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-lg" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF
            </Button>
          </div>
        </DialogHeader>
        <div ref={ref} className="p-8 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
