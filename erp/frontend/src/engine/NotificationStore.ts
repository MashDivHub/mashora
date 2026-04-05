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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: 'system_1',
      title: 'System Ready',
      body: 'Mashora ERP backend is connected and operational.',
      timestamp: new Date(),
      read: false,
    },
    {
      id: 'system_2',
      title: 'View Engine Active',
      body: 'Dynamic view rendering engine is loaded with form, list, kanban, calendar, graph, and pivot views.',
      timestamp: new Date(),
      read: false,
    },
  ],
  unreadCount: 2,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      // Fetch activities via generic model endpoint
      const { data } = await erpClient.raw.post('/model/mail.activity', {
        fields: ['id', 'activity_type_id', 'summary', 'note', 'date_deadline', 'res_model', 'res_id', 'res_name', 'user_id', 'state'],
        limit: 20,
        order: 'date_deadline asc',
      }).catch(() => ({ data: { records: [] } }))

      const activities = (data.records || []).map((a: any) => ({
        id: `activity_${a.id}`,
        title: a.activity_type_id?.[1] || 'Activity',
        body: a.summary || a.note || '',
        model: a.res_model,
        resId: a.res_id,
        timestamp: new Date(a.date_deadline || a.create_date),
        read: false,
      }))

      set(prev => ({
        notifications: [...prev.notifications.filter(n => n.id.startsWith('system_')), ...activities],
        unreadCount: prev.notifications.filter(n => !n.read && n.id.startsWith('system_')).length + activities.length,
        loading: false,
      }))
    } catch {
      set({ loading: false })
    }
  },

  markRead: (id) => set(prev => ({
    notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    unreadCount: Math.max(0, prev.unreadCount - 1),
  })),

  markAllRead: () => set(prev => ({
    notifications: prev.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

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
