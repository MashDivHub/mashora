/**
 * Chatter component — embedded messaging, activities, and followers
 * for any business record.
 *
 * Usage:
 *   <Chatter model="account.move" resId={invoiceId} />
 */
import React, { useState } from 'react'
import { sanitizedHtml } from '@/lib/sanitize'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Badge, Skeleton, Textarea, cn,
} from '@mashora/design-system'
import {
  MessageCircle, Bell, Users, Send, Check, X,
  Clock, AlertTriangle, CalendarDays, UserCircle2,
} from 'lucide-react'
import { erpClient } from '@/lib/erp-api'

interface ChatterProps {
  model: string
  resId: number
  className?: string
}

interface ChatterMessage {
  id: number
  author_id?: [number, string] | false
  date: string
  body: string
  tracking_value_ids?: unknown[]
}

interface ChatterActivity {
  id: number
  state: string
  activity_type_id?: [number, string] | false
  summary?: string | false
  date_deadline?: string | false
  user_id?: [number, string] | false
}

interface ChatterFollower {
  id: number
  partner_id?: [number, string] | false
}

interface AxiosLikeResponse<T> { data: T }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InitialAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = getInitials(name || '?')
  return (
    <div
      className={cn(
        'shrink-0 rounded-full bg-zinc-900 text-white font-semibold flex items-center justify-center dark:border dark:border-zinc-700 dark:bg-zinc-800',
        size === 'md' ? 'size-9 text-xs' : 'size-7 text-[10px]',
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function ActivityStateBadge({ state }: { state: string }) {
  if (state === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-400 ring-1 ring-red-500/20">
        <AlertTriangle className="h-2.5 w-2.5" />
        Overdue
      </span>
    )
  }
  if (state === 'today') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 ring-1 ring-amber-500/20">
        <Clock className="h-2.5 w-2.5" />
        Today
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border/40">
      <CalendarDays className="h-2.5 w-2.5" />
      Planned
    </span>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all',
        active
          ? 'bg-zinc-900 text-white shadow-sm dark:border dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
            active
              ? 'bg-white/20 text-white dark:bg-zinc-700 dark:text-zinc-200'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivitiesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-28 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-40 rounded-full" />
              <Skeleton className="h-3.5 w-32 rounded-full" />
            </div>
            <Skeleton className="size-8 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FollowersSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/50 px-4 py-3">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 w-36 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Chatter({ model, resId, className }: ChatterProps) {
  const queryClient = useQueryClient()
  const [newMessage, setNewMessage] = useState('')
  const [tab, setTab] = useState('messages')

  // Messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chatter-messages', model, resId],
    queryFn: () => erpClient.raw.get(`/chatter/${model}/${resId}/messages`).then((r: AxiosLikeResponse<{ messages: ChatterMessage[]; total: number }>) => r.data).catch(() => ({ messages: [] as ChatterMessage[], total: 0 })),
  })

  // Activities
  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['chatter-activities', model, resId],
    queryFn: () => erpClient.raw.get(`/chatter/${model}/${resId}/activities`).then((r: AxiosLikeResponse<{ activities: ChatterActivity[]; total: number }>) => r.data).catch(() => ({ activities: [] as ChatterActivity[], total: 0 })),
  })

  // Followers
  const { data: followersData, isLoading: followersLoading } = useQuery({
    queryKey: ['chatter-followers', model, resId],
    queryFn: () => erpClient.raw.get(`/chatter/${model}/${resId}/followers`).then((r: AxiosLikeResponse<{ followers: ChatterFollower[]; total: number }>) => r.data).catch(() => ({ followers: [] as ChatterFollower[], total: 0 })),
    retry: false,
  })

  // Post message
  const postMutation = useMutation({
    mutationFn: (body: string) =>
      erpClient.raw.post(`/chatter/${model}/${resId}/messages`, { body }),
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['chatter-messages', model, resId] })
    },
  })

  // Complete activity
  const completeMutation = useMutation({
    mutationFn: (activityId: number) =>
      erpClient.raw.post(`/chatter/activities/${activityId}/done`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatter-activities', model, resId] })
    },
  })

  const messages = messagesData?.messages ?? []
  const activities = activitiesData?.activities ?? []
  const followers = followersData?.followers ?? []

  const handleSend = () => {
    const body = newMessage.trim()
    if (!body || postMutation.isPending) return
    postMutation.mutate(body)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend()
    }
  }

  return (
    <div
      className={cn(
        'rounded-3xl border border-border/60 bg-card shadow-panel overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/20 px-6 py-4">
        <div className="rounded-xl border border-border/70 bg-muted/60 p-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Chatter
        </p>
      </div>

      {/* Pill tab bar */}
      <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/10 px-5 py-3">
        <TabButton
          active={tab === 'messages'}
          onClick={() => setTab('messages')}
          icon={MessageCircle}
          label="Messages"
          count={messages.length}
        />
        <TabButton
          active={tab === 'activities'}
          onClick={() => setTab('activities')}
          icon={Bell}
          label="Activities"
          count={activities.length}
        />
        <TabButton
          active={tab === 'followers'}
          onClick={() => setTab('followers')}
          icon={Users}
          label="Followers"
          count={followers.length}
        />
      </div>

      {/* Tab content */}
      <div className="p-5">

        {/* ---------------------------------------------------------------- */}
        {/* Messages Tab                                                      */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'messages' && (
          <div className="space-y-5">
            {/* Composer */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <Textarea
                placeholder="Write a message... (Ctrl+Enter to send)"
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                className="resize-none rounded-xl border-border/50 bg-background/60 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-zinc-900/40 dark:focus-visible:ring-zinc-400/40"
              />
              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  disabled={!newMessage.trim() || postMutation.isPending}
                  onClick={handleSend}
                  className="rounded-xl gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {postMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>

            {/* Message list */}
            {messagesLoading ? (
              <MessagesSkeleton />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  <MessageCircle className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {messages.map((msg: ChatterMessage) => {
                  const authorName = msg.author_id ? msg.author_id[1] : 'System'
                  const isSystem = !msg.author_id
                  return (
                    <div key={msg.id} className="flex gap-3">
                      {isSystem ? (
                        <div className="size-9 shrink-0 rounded-full border border-border/60 bg-muted/60 flex items-center justify-center">
                          <UserCircle2 className="h-4 w-4 text-muted-foreground/60" />
                        </div>
                      ) : (
                        <InitialAvatar name={authorName} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                          <span className="text-sm font-semibold leading-none">
                            {authorName}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatDateTime(msg.date)}
                          </span>
                        </div>
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-p:my-1 prose-a:text-foreground prose-a:underline-offset-4"
                          dangerouslySetInnerHTML={sanitizedHtml(msg.body)}
                        />
                        {msg.tracking_value_ids && msg.tracking_value_ids.length > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                            <span className="font-medium">{msg.tracking_value_ids.length}</span>
                            field{msg.tracking_value_ids.length === 1 ? '' : 's'} changed
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Activities Tab                                                    */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'activities' && (
          <div className="space-y-3">
            {activitiesLoading ? (
              <ActivitiesSkeleton />
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  <Bell className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">No scheduled activities.</p>
              </div>
            ) : (
              activities.map((act: ChatterActivity) => (
                <div
                  key={act.id}
                  className="rounded-2xl border border-border/50 bg-muted/10 p-4 transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Type + state */}
                      <div className="flex flex-wrap items-center gap-2">
                        <ActivityStateBadge state={act.state} />
                        <span className="text-sm font-semibold">
                          {act.activity_type_id ? act.activity_type_id[1] : 'Activity'}
                        </span>
                      </div>
                      {/* Summary */}
                      {act.summary && (
                        <p className="text-sm text-foreground/80 leading-relaxed">{act.summary}</p>
                      )}
                      {/* Due + assignee */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {act.date_deadline && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            Due {formatDate(act.date_deadline)}
                          </span>
                        )}
                        {act.user_id && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <UserCircle2 className="h-3 w-3 shrink-0" />
                            {act.user_id[1]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action: mark done */}
                    <button
                      onClick={() => completeMutation.mutate(act.id)}
                      disabled={completeMutation.isPending}
                      aria-label="Mark activity as done"
                      className="shrink-0 rounded-xl border border-border/60 bg-background/60 p-2 text-muted-foreground transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Followers Tab                                                     */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'followers' && (
          <div className="space-y-2">
            {followersLoading ? (
              <FollowersSkeleton />
            ) : followers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  <Users className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">No followers.</p>
              </div>
            ) : (
              followers.map((f: ChatterFollower) => {
                const name = f.partner_id ? f.partner_id[1] : 'Unknown'
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/10 px-4 py-2.5 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <InitialAvatar name={name} size="sm" />
                      <span className="truncate text-sm font-medium">{name}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

      </div>
    </div>
  )
}
