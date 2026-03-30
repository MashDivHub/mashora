import client from './client'

export interface TicketResponse {
  id: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
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
  created_at: string
}

export interface CreateTicketData {
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
}

export async function createTicket(data: CreateTicketData): Promise<TicketResponse> {
  const response = await client.post<TicketResponse>('/support/tickets', data)
  return response.data
}

export async function listTickets(): Promise<{ tickets: TicketResponse[]; total: number }> {
  const response = await client.get<{ tickets: TicketResponse[]; total: number }>('/support/tickets')
  return response.data
}

export async function getTicket(id: string): Promise<TicketResponse & { messages: TicketMessageResponse[] }> {
  const response = await client.get<TicketResponse & { messages: TicketMessageResponse[] }>(`/support/tickets/${id}`)
  return response.data
}

export async function addMessage(ticketId: string, message: string): Promise<TicketMessageResponse> {
  const response = await client.post<TicketMessageResponse>(`/support/tickets/${ticketId}/messages`, { message })
  return response.data
}
