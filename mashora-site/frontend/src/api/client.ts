import axios from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach JWT from localStorage
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: redirect to /login on 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = String(error.config?.url ?? '')
    const isAuthRequest =
      url.includes('/auth/token') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register')

    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
