import client from './client'

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface User {
  id: number
  email: string
  org_name: string
  is_active: boolean
}

export interface RegisterResponse {
  id: number
  email: string
  org_name: string
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const params = new URLSearchParams()
  params.append('username', email)
  params.append('password', password)
  const response = await client.post<LoginResponse>('/auth/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return response.data
}

export async function register(
  email: string,
  password: string,
  orgName: string
): Promise<RegisterResponse> {
  const response = await client.post<RegisterResponse>('/auth/register', {
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

export async function refreshToken(): Promise<LoginResponse> {
  const response = await client.post<LoginResponse>('/auth/refresh')
  return response.data
}
