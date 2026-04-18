import { create } from 'zustand'
import { erpClient } from '@/lib/erp-api'

export interface Notification {
  id: string
  title: string
  body: string
  model?: string
  resId?: number
  timestamp: Date
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  markRead: (id: string) => void
  markAllRead: () => void
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
}

// Persist read IDs in localStorage
const READ_KEY = 'mashora_read_notifications'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveReadIds(ids: Set<string>) {
  try {
    // Keep last 200 IDs to avoid unbounded growth
    const arr = [...ids].slice(-200)
    localStorage.setItem(READ_KEY, JSON.stringify(arr))
  } catch { /* localStorage full or unavailable */ }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      const { data } = await erpClient.raw.post('/model/mail.activity', {
        fields: ['id', 'activity_type_id', 'summary', 'note', 'date_deadline', 'res_model', 'res_id', 'res_name', 'user_id', 'state'],
        limit: 20,
        order: 'date_deadline asc',
      }).catch(() => ({ data: { records: [] } }))

      const readIds = getReadIds()

      interface ActivityRow {
        id: number
        activity_type_id?: [number, string] | false
        summary?: string | false
        note?: string | false
        res_model?: string
        res_id?: number
        date_deadline?: string | false
        create_date?: string | false
      }
      const activities: Notification[] = ((data.records || []) as ActivityRow[]).map((a) => {
        const id = `activity_${a.id}`
        return {
          id,
          title: Array.isArray(a.activity_type_id) ? a.activity_type_id[1] : 'Activity',
          body: a.summary || a.note || '',
          model: a.res_model,
          resId: a.res_id,
          timestamp: new Date(a.date_deadline || a.create_date || ''),
          read: readIds.has(id),
        }
      })

      // Keep any live WebSocket notifications already in state
      const existing = get().notifications.filter(n => n.id.startsWith('notif_'))

      const all = [...existing, ...activities]

      set({
        notifications: all,
        unreadCount: all.filter(n => !n.read).length,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  markRead: (id) => set((state) => {
    const readIds = getReadIds()
    readIds.add(id)
    saveReadIds(readIds)

    const notifications = state.notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    )
    return {
      notifications,
      unreadCount: notifications.filter(n => !n.read).length,
    }
  }),

  markAllRead: () => set(prev => {
    const readIds = getReadIds()
    prev.notifications.forEach(n => readIds.add(n.id))
    saveReadIds(readIds)

    return {
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }
  }),

  addNotification: (notif) => set(prev => {
    const newNotif: Notification = {
      ...notif,
      id: `notif_${Date.now()}`,
      timestamp: new Date(),
      read: false,
    }
    return {
      notifications: [newNotif, ...prev.notifications],
      unreadCount: prev.unreadCount + 1,
    }
  }),
}))
