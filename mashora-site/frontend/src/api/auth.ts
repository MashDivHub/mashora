import client from './client'

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: string
  email: string
  role: string
  org_id: string
  org_name: string
  is_active: boolean
  created_at: string
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const params = new URLSearchParams()
  params.append('username', email)
  params.append('password', password)
  const response = await client.post<AuthResponse>('/auth/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return response.data
}

export async function register(
  email: string,
  password: string,
  orgName: string
): Promise<AuthResponse> {
  const response = await client.post<AuthResponse>('/auth/register', {
    email,
    password,
    org_name: orgName,
  })
  return response.data
}

export async function getMe(): Promise<User> {
  const response = await client.get<User>('/auth/me')
  return response.data
}

export async function refreshToken(refreshTokenValue: string): Promise<AuthResponse> {
  const response = await client.post<AuthResponse>('/auth/refresh', null, {
    params: { refresh_token: refreshTokenValue },
  })
  return response.data
}
