import { rpc } from '@/services/erp/client'

export interface SessionInfo {
  uid?: number
  db?: string
  name?: string
  username?: string
  partner_id?: number
  user_context?: {
    lang?: string
    tz?: string
    allowed_company_ids?: number[]
  }
  user_companies?: {
    current_company?: number
    allowed_companies?: Record<string, { id: number; name: string }>
  }
}

export interface LoginPayload {
  db: string
  login: string
  password: string
}

export async function authenticate(payload: LoginPayload) {
  return rpc<SessionInfo>('/web/session/authenticate', payload)
}

export async function getSessionInfo() {
  return rpc<SessionInfo>('/web/session/get_session_info', {})
}

export async function destroySession() {
  return rpc<boolean>('/web/session/destroy', {})
}

export async function listDatabases() {
  return rpc<string[]>('/web/database/list', {})
}
