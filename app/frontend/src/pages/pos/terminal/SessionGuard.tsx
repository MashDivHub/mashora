import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label,
} from '@mashora/design-system'
import { ArrowLeft, DoorOpen, PlayCircle } from 'lucide-react'
import { erpClient } from '@/lib/erp-api'
import { toast } from '@/components/shared'
import { extractErrorMessage } from '@/lib/errors'

interface SessionGuardProps {
  configId: number
  configName?: string
  onOpened: () => void
}

export default function SessionGuard({ configId, configName, onOpened }: SessionGuardProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [openingCash, setOpeningCash] = useState('0.00')
  const [openingNotes, setOpeningNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function openSession() {
    setSubmitting(true)
    try {
      await erpClient.raw.post('/pos/sessions', {
        config_id: configId,
        opening_cash: Number(openingCash) || 0,
        opening_notes: openingNotes,
      })
      toast.success('Session opened', configName ?? `Register #${configId}`)
      setOpen(false)
      onOpened()
    } catch (err) {
      toast.error('Unable to open session', extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Hero blocker */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-background to-background" />

      <button
        onClick={() => navigate('/admin/pos')}
        className="absolute top-6 left-6 h-10 w-10 rounded-full border border-border/50 bg-card/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-200"
        aria-label="Back to POS"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="relative w-full max-w-lg mx-4 rounded-3xl border border-border/40 bg-card/90 backdrop-blur p-10 text-center space-y-6 shadow-2xl">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
          <DoorOpen className="h-10 w-10 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">No active session</h1>
          <p className="text-sm text-muted-foreground">
            Open a new session to start taking orders
            {configName ? <> on <span className="font-medium text-foreground">{configName}</span></> : null}.
          </p>
        </div>

        <div className="flex gap-2 justify-center pt-2">
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => navigate('/admin/pos')}
          >
            Back to registers
          </Button>
          <Button
            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white gap-2 h-11 px-6 transition-all duration-200"
            onClick={() => setOpen(true)}
          >
            <PlayCircle className="h-4 w-4" />
            Open Session
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={v => !submitting && setOpen(v)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Open a new session</DialogTitle>
            <DialogDescription>
              Enter opening cash and any notes for this shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="opening-cash">Opening cash</Label>
              <Input
                id="opening-cash"
                type="number"
                step="0.01"
                min="0"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="h-11 text-right tabular-nums font-mono rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening-notes">Notes (optional)</Label>
              <Input
                id="opening-notes"
                value={openingNotes}
                onChange={e => setOpeningNotes(e.target.value)}
                placeholder="e.g. Morning shift, cashier Alex"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={openSession}
              disabled={submitting}
            >
              {submitting ? 'Opening…' : 'Open Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
