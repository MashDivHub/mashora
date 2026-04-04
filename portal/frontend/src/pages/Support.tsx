import { useEffect, useState } from 'react'
import { ArrowLeft, LifeBuoy, Send } from 'lucide-react'
import {
  addMessage,
  createTicket,
  getTicket,
  listTickets,
  type CreateTicketData,
  type TicketMessageResponse,
  type TicketResponse,
} from '../api/support'
import { Notice } from '@/components/app/notice'
import { PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { StatusBadge } from '@/components/app/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type DetailTicket = TicketResponse & { messages: TicketMessageResponse[] }

export default function Support() {
  const [tickets, setTickets] = useState<TicketResponse[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<CreateTicketData>({
    subject: '',
    description: '',
    priority: 'medium',
    category: 'general',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<DetailTicket | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    void loadTickets()
  }, [])

  async function loadTickets() {
    setLoading(true)
    try {
      const data = await listTickets()
      setTickets(data.tickets)
      setTotal(data.total)
    } catch {
      setError('Failed to load tickets.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!formData.subject.trim() || !formData.description.trim()) {
      setFormError('Subject and description are required.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const ticket = await createTicket(formData)
      setTickets((prev) => [ticket, ...prev])
      setTotal((prev) => prev + 1)
      setShowModal(false)
      setFormData({
        subject: '',
        description: '',
        priority: 'medium',
        category: 'general',
      })
    } catch {
      setFormError('Failed to create ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOpenTicket(id: string) {
    setDetailLoading(true)
    setSelectedTicket(null)
    try {
      const detail = await getTicket(id)
      setSelectedTicket(detail)
    } catch {
      setError('Failed to load ticket details.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleReply() {
    if (!selectedTicket || !replyText.trim()) return
    setReplying(true)
    try {
      const message = await addMessage(selectedTicket.id, replyText)
      setSelectedTicket((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev))
      setReplyText('')
    } catch {
      setError('Failed to send reply.')
    } finally {
      setReplying(false)
    }
  }

  if (selectedTicket || detailLoading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          className="w-fit rounded-full px-0 hover:bg-transparent"
          onClick={() => {
            setSelectedTicket(null)
            setDetailLoading(false)
          }}
        >
          <ArrowLeft className="size-4" />
          Back to tickets
        </Button>

        {detailLoading ? (
          <div className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center text-sm text-muted-foreground">
            Loading ticket...
          </div>
        ) : selectedTicket ? (
          <>
            <SectionCard title={selectedTicket.subject} description={`Opened ${new Date(selectedTicket.created_at).toLocaleString()}`}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={selectedTicket.status} />
                  <StatusBadge value={selectedTicket.priority} />
                  <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {selectedTicket.category}
                  </div>
                </div>
                <p className="text-sm leading-7 text-muted-foreground">{selectedTicket.description}</p>
              </div>
            </SectionCard>

            <SectionCard title="Conversation" description="Messages between your team and support.">
              <div className="space-y-4">
                {selectedTicket.messages.length === 0 ? (
                  <div className="rounded-3xl border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  selectedTicket.messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-2xl rounded-3xl border px-5 py-4 text-sm leading-6 ${
                          message.sender === 'user'
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
                            : 'border-border/70 bg-background/60 text-muted-foreground'
                        }`}
                      >
                        <div>{message.message}</div>
                        <div
                          className={`mt-3 text-xs ${
                            message.sender === 'user' ? 'text-zinc-300 dark:text-zinc-400' : 'text-muted-foreground'
                          }`}
                        >
                          {message.sender === 'user' ? 'You' : 'Support'} • {new Date(message.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {selectedTicket.status !== 'closed' ? (
                  <div className="rounded-3xl border border-border/70 bg-background/60 p-5">
                    <div className="space-y-4">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        rows={4}
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleReply} disabled={replying || !replyText.trim()}>
                          <Send className="size-4" />
                          {replying ? 'Sending...' : 'Send reply'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support"
        title="Customer support and ticketing"
        description={`${total} ticket${total === 1 ? '' : 's'} across billing, technical, and upgrade requests.`}
        actions={
          <Button className="rounded-2xl" onClick={() => setShowModal(true)}>
            <LifeBuoy className="size-4" />
            Create ticket
          </Button>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <SectionCard
        title="Tickets"
        description="Track the state of open, in-progress, and resolved support conversations."
        contentClassName="p-0"
      >
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No tickets yet. Create one to get started.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="cursor-pointer" onClick={() => handleOpenTicket(ticket.id)}>
                  <TableCell className="font-medium">{ticket.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{ticket.category}</TableCell>
                  <TableCell><StatusBadge value={ticket.priority} /></TableCell>
                  <TableCell><StatusBadge value={ticket.status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create support ticket</DialogTitle>
            <DialogDescription>Give the team enough context to resolve the issue quickly.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError ? <Notice tone="danger">{formError}</Notice> : null}
            <div className="space-y-2">
              <Label htmlFor="ticketSubject">Subject</Label>
              <Input
                id="ticketSubject"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Brief summary of the issue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticketDescription">Description</Label>
              <Textarea
                id="ticketDescription"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the issue in detail..."
                rows={5}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, priority: value as CreateTicketData['priority'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="upgrade">Upgrade</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
