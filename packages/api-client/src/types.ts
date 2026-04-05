/**
 * Shared types for the Mashora ERP API.
 */

export interface SearchParams {
  domain?: any[]
  fields?: string[]
  offset?: number
  limit?: number
  order?: string
}

export interface SearchResult<T = Record<string, any>> {
  records: T[]
  total: number
}

export interface MethodCallParams {
  record_ids: number[]
  method: string
  args?: any[]
  kwargs?: Record<string, any>
}

export interface FieldDefinition {
  string: string
  type: string
  required?: boolean
  readonly?: boolean
  help?: string
  selection?: [string, string][]
  relation?: string
  store?: boolean
}

export interface ApiError {
  error: {
    type: string
    message: string
    details?: Record<string, any>
  }
}

export interface MashoraUser {
  id: number
  name: string
  login: string
  email: string
  company_id: [number, string]
  company_ids: number[]
  lang: string
  tz: string
  groups_id: number[]
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: MashoraUser
}
