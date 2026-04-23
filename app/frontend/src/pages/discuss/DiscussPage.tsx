import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Button, Badge, Skeleton, cn } from '@mashora/design-system'
import { Hash, MessageSquare, Plus, Send, Users, Circle } from 'lucide-react'
import { PageHeader, toast } from '@/components/shared'
import { erpClient } from '@/lib/erp-api'
import { extractErrorMessage } from '@/lib/errors'
import { sanitizedHtml } from '@/lib/sanitize'
import { useBusSubscription } from '@/lib/websocket'

const CHANNEL_FIELDS = ['id', 'name', 'channel_type', 'description']
const MSG_FIELDS = ['id', 'body', 'author_id', 'date', 'message_type', 'subtype_id']

interface Channel {
  id: number
  name: string
  channel_type?: string
  description?: string | false
}

interface ChannelMessage {
  id: number
  body: string
  author_id?: [number, string] | false
  date?: string | false
  message_type?: string
  subtype_id?: [number, string] | false
}

export default function DiscussPage() {
  const queryClient = useQueryClient()
  const [activeChannel, setActiveChannel] = useState<number | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Load channels
  const { data: channels, isLoading: chLoading } = useQuery({
    queryKey: ['discuss-channels'],
    queryFn: async () => {
      const { data } = await erpClient.raw.post('/model/discuss.channel', {
        domain: [['channel_type', 'in', ['channel', 'group']]],
        fields: CHANNEL_FIELDS, order: 'name asc', limit: 50,
      })
      return data.records || []
    },
  })

  // Auto-select first channel
  useEffect(() => {
    if (channels?.length && !activeChannel) setActiveChannel(channels[0].id)
  }, [channels, activeChannel])

  // Load messages for active channel
  const { data: messages, isLoading: msgLoading } = useQuery({
    queryKey: ['discuss-messages', activeChannel],
    queryFn: async () => {
      if (!activeChannel) return []
      const { data } = await erpClient.raw.post('/model/mail.message', {
        domain: [['res_id', '=', activeChannel], ['model', '=', 'discuss.channel'], ['message_type', 'in', ['comment', 'notification']]],
        fields: MSG_FIELDS, order: 'date asc', limit: 100,
      })
      return data.records || []
    },
    enabled: !!activeChannel,
    // Polling fallback (30s) — WebSocket subscription invalidates instantly when connected.
    refetchInterval: 30_000,
  })

  // Realtime: invalidate the active channel's messages when a discuss.message event arrives.
  useBusSubscription('discuss.message', (msg: unknown) => {
    const m = (msg ?? {}) as { channel_id?: number; payload?: { channel_id?: number } }
    const cid = m.channel_id ?? m.payload?.channel_id
    if (!activeChannel) return
    if (cid && cid !== activeChannel) return
    queryClient.invalidateQueries({ queryKey: ['discuss-messages', activeChannel] })
  })

  // Typing indicator
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useBusSubscription('discuss.typing', (msg: unknown) => {
    const m = (msg ?? {}) as { channel_id?: number; author?: string; payload?: { channel_id?: number; author?: string } }
    const cid = m.channel_id ?? m.payload?.channel_id
    const author = m.author ?? m.payload?.author
    if (!activeChannel || cid !== activeChannel || !author) return
    setTypingUser(author)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000)
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const sendMut = useMutation({
    mutationFn: async (body: string) => {
      await erpClient.raw.post('/model/discuss.channel/call', {
        record_ids: [activeChannel], method: 'message_post',
        kwargs: { body, message_type: 'comment', subtype_xmlid: 'mail.mt_comment' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discuss-messages', activeChannel] })
      setNewMsg('')
    },
    onError: (e: unknown) => toast.error('Message failed', extractErrorMessage(e)),
  })

  const handleSend = () => {
    if (!newMsg.trim() || !activeChannel) return
    sendMut.mutate(newMsg.trim())
  }

  const activeCh = (channels as Channel[] | undefined)?.find((c) => c.id === activeChannel)

  return (
    <div className="space-y-4">
      <PageHeader title="Discuss" subtitle="messaging" />

      <div className="grid lg:grid-cols-[260px_1fr] gap-3 h-[calc(100vh-220px)]">
        {/* Channel sidebar */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Channels
          </div>
          <div className="flex-1 overflow-y-auto">
            {chLoading ? (
              <div className="p-2 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {((channels as Channel[] | undefined) || []).map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                      activeChannel === ch.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <Hash className="h-4 w-4 shrink-0" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                ))}
                {channels?.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No channels</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Message area */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col">
          {/* Channel header */}
          <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{activeCh?.name || 'Select a channel'}</span>
            {activeCh?.description && <span className="text-xs text-muted-foreground ml-2 truncate">{activeCh.description}</span>}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : !activeChannel ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Select a channel to start chatting</p>
              </div>
            ) : messages?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              <>
                {((messages as ChannelMessage[] | undefined) || []).map((msg) => {
                  const author = Array.isArray(msg.author_id) ? msg.author_id[1] : 'System'
                  const time = msg.date ? new Date(msg.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''
                  const isNotif = msg.message_type === 'notification'
                  if (isNotif) {
                    return (
                      <div key={msg.id} className="text-xs text-muted-foreground text-center py-1">
                        <span dangerouslySetInnerHTML={sanitizedHtml(msg.body)} />
                      </div>
                    )
                  }
                  return (
                    <div key={msg.id} className="flex gap-3">
                      <div className="relative shrink-0 mt-0.5">
                        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                          {author[0]?.toUpperCase() || '?'}
                        </div>
                        {/* Online presence dot — current user only (v1) */}
                        <Circle className="absolute bottom-0 right-0 h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">{author}</span>
                          <span className="text-[10px] text-muted-foreground">{time}</span>
                        </div>
                        <div className="text-sm mt-0.5 prose prose-sm dark:prose-invert max-w-none [&>p]:m-0" dangerouslySetInnerHTML={sanitizedHtml(msg.body)} />
                      </div>
                    </div>
                  )
                })}
                {typingUser && (
                  <div className="text-xs text-muted-foreground italic px-2 py-1">{typingUser} is typing...</div>
                )}
                <div ref={msgEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {activeChannel && (
            <div className="px-4 py-3 border-t border-border/40">
              <div className="flex gap-2">
                <Input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder={`Message #${activeCh?.name || ''}...`}
                  className="rounded-xl h-9 flex-1"
                  disabled={sendMut.isPending}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !sendMut.isPending) { e.preventDefault(); handleSend() } }}
                />
                <Button size="sm" className="rounded-xl h-9 px-3" onClick={handleSend} disabled={!newMsg.trim() || sendMut.isPending}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
