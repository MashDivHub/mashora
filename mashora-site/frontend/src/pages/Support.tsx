import { useEffect, useState } from 'react'
import {
  createTicket,
  listTickets,
  getTicket,
  addMessage,
  TicketResponse,
  TicketMessageResponse,
  CreateTicketData,
} from '../api/support'

const ticketStatusColors: Record<string, { bg: string; color: string }> = {
  open: { bg: '#dcfce7', color: '#15803d' },
  in_progress: { bg: '#fef9c3', color: '#a16207' },
  resolved: { bg: '#dbeafe', color: '#1d4ed8' },
  closed: { bg: '#f1f5f9', color: '#64748b' },
}

const priorityColors: Record<string, { bg: string; color: string }> = {
  low: { bg: '#f1f5f9', color: '#475569' },
  medium: { bg: '#fef9c3', color: '#a16207' },
  high: { bg: '#ffedd5', color: '#c2410c' },
  urgent: { bg: '#fee2e2', color: '#b91c1c' },
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const c = map[status] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
      background: c.bg,
      color: c.color,
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

type DetailTicket = TicketResponse & { messages: TicketMessageResponse[] }

export default function Support() {
  const [tickets, setTickets] = useState<TicketResponse[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<CreateTicketData>({
    subject: '',
    description: '',
    priority: 'medium',
    category: 'general',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Detail view
  const [selectedTicket, setSelectedTicket] = useState<DetailTicket | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    loadTickets()
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
      setFormData({ subject: '', description: '', priority: 'medium', category: 'general' })
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
      const msg = await addMessage(selectedTicket.id, replyText)
      setSelectedTicket((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
      setReplyText('')
    } catch {
      setError('Failed to send reply.')
    } finally {
      setReplying(false)
    }
  }

  // Detail view
  if (selectedTicket || detailLoading) {
    return (
      <div>
        <button
          onClick={() => { setSelectedTicket(null); setDetailLoading(false) }}
          style={{
            background: 'none',
            border: 'none',
            color: '#7C3AED',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '0',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          &larr; Back to Tickets
        </button>

        {detailLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading ticket...</div>
        ) : selectedTicket && (
          <div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                    {selectedTicket.subject}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <StatusBadge status={selectedTicket.status} map={ticketStatusColors} />
                    <StatusBadge status={selectedTicket.priority} map={priorityColors} />
                    <span style={{ fontSize: '12px', color: '#94a3b8', alignSelf: 'center' }}>
                      {selectedTicket.category}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Opened {new Date(selectedTicket.created_at).toLocaleString()}
                </div>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                {selectedTicket.description}
              </p>
            </div>

            {/* Message thread */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Messages</span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {selectedTicket.messages.length === 0 ? (
                  <div style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  selectedTicket.messages.map((m) => (
                    <div key={m.id} style={{
                      marginBottom: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '75%',
                        background: m.sender === 'user' ? '#ede9fe' : '#f1f5f9',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        fontSize: '14px',
                        color: '#1e293b',
                        lineHeight: '1.5',
                      }}>
                        {m.message}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        {m.sender === 'user' ? 'You' : 'Support'} &bull; {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply form */}
              {selectedTicket.status !== 'closed' && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    style={{
                      width: '100%',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      color: '#1e293b',
                    }}
                  />
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleReply}
                      disabled={replying || !replyText.trim()}
                      style={{
                        background: '#7C3AED',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 20px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: replying || !replyText.trim() ? 'not-allowed' : 'pointer',
                        opacity: replying || !replyText.trim() ? 0.7 : 1,
                      }}
                    >
                      {replying ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
            Support
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            {total} ticket{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#7C3AED',
            color: '#fff',
            border: 'none',
            padding: '8px 18px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Create Ticket
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '48px', textAlign: 'center', color: '#64748b' }}>
          No tickets yet. Create one to get started.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Subject', 'Category', 'Priority', 'Status', 'Created'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid #e2e8f0',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => handleOpenTicket(t.id)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{t.subject}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{t.category}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={t.priority} map={priorityColors} /></td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={t.status} map={ticketStatusColors} /></td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '10px',
            padding: '28px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Create Support Ticket</h2>
              <button
                onClick={() => { setShowModal(false); setFormError('') }}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {formError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Brief summary of the issue"
                style={{
                  width: '100%',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  color: '#1e293b',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe the issue in detail..."
                rows={4}
                style={{
                  width: '100%',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  color: '#1e293b',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value as CreateTicketData['priority'] }))}
                  style={{
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '9px 12px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1e293b',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  style={{
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '9px 12px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#1e293b',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="upgrade">Upgrade</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowModal(false); setFormError('') }}
                style={{
                  background: '#fff',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                style={{
                  background: '#7C3AED',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
