import client from './client'

export interface TicketResponse {
  id: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'normal'
  category: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
}

export interface TicketMessageResponse {
  id: string
  ticket_id: string
  message: string
  sender: 'user' | 'support'
  user_email?: string | null
  is_staff?: boolean
  created_at: string
}

export interface CreateTicketData {
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'normal'
  category: string
}

function normalizeTicket(data: any): TicketResponse {
  const rawPriority = String(data.priority ?? 'medium').toLowerCase()
  const priority = rawPriority === 'normal' ? 'medium' : rawPriority
  return {
    id: String(data.id),
    subject: data.subject ?? '',
    description: data.description ?? '',
    priority: priority as TicketResponse['priority'],
    category: data.category ?? 'general',
    status: data.status ?? 'open',
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? data.created_at ?? new Date().toISOString(),
  }
}

function normalizeMessage(data: any): TicketMessageResponse {
  return {
    id: String(data.id),
    ticket_id: String(data.ticket_id),
    message: data.message ?? '',
    sender: data.sender ?? (data.is_staff ? 'support' : 'user'),
    user_email: data.user_email ?? null,
    is_staff: Boolean(data.is_staff),
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

export async function createTicket(data: CreateTicketData): Promise<TicketResponse> {
  const response = await client.post<TicketResponse>('/support/tickets', data)
  return normalizeTicket(response.data)
}

export async function listTickets(): Promise<{ tickets: TicketResponse[]; total: number }> {
  const response = await client.get<{ tickets: TicketResponse[]; total: number }>('/support/tickets')
  return {
    tickets: (response.data.tickets ?? []).map(normalizeTicket),
    total: Number(response.data.total ?? 0),
  }
}

export async function getTicket(id: string): Promise<TicketResponse & { messages: TicketMessageResponse[] }> {
  const response = await client.get<TicketResponse & { messages: TicketMessageResponse[] }>(`/support/tickets/${id}`)
  return {
    ...normalizeTicket(response.data),
    messages: (response.data.messages ?? []).map(normalizeMessage),
  }
}

export async function addMessage(ticketId: string, message: string): Promise<TicketMessageResponse> {
  const response = await client.post<TicketMessageResponse>(`/support/tickets/${ticketId}/messages`, { message })
  return normalizeMessage(response.data)
}
