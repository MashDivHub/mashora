let rpcId = 0

const explicitBaseUrl = import.meta.env.VITE_ERP_BASE_URL?.trim()

interface RpcErrorPayload {
  code?: number
  message?: string
  data?: {
    message?: string
    name?: string
  }
}

interface RpcSuccess<T> {
  result?: T
  error?: RpcErrorPayload
}

export class ErpRpcError extends Error {
  code?: number
  exceptionName?: string

  constructor(message: string, payload?: RpcErrorPayload) {
    super(message)
    this.name = 'ErpRpcError'
    this.code = payload?.code
    this.exceptionName = payload?.data?.name
  }
}

function resolveUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!explicitBaseUrl) {
    return normalizedPath
  }
  return `${explicitBaseUrl.replace(/\/$/, '')}${normalizedPath}`
}

export function resolveErpAssetUrl(path?: string | null) {
  if (!path) {
    return ''
  }
  if (/^(?:https?:\/\/|data:)/.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (explicitBaseUrl) {
    return `${explicitBaseUrl.replace(/\/$/, '')}${normalizedPath}`
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    if (port === '3001') {
      return `${protocol}//${hostname}:8069${normalizedPath}`
    }
  }

  return normalizedPath
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T
}

export async function getJson<T>(path: string) {
  const response = await fetch(resolveUrl(path), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }

  return readJson<T>(response)
}

export async function rpc<T>(path: string, params: unknown = {}) {
  const response = await fetch(resolveUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      id: rpcId++,
      jsonrpc: '2.0',
      method: 'call',
      params,
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC ${path} failed with ${response.status}`)
  }

  const payload = await readJson<RpcSuccess<T>>(response)
  if (payload.error) {
    throw new ErpRpcError(
      payload.error.data?.message || payload.error.message || `RPC ${path} failed`,
      payload.error
    )
  }

  return payload.result as T
}
