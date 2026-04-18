import { useCallback } from 'react'
import {
  Input, Label, Checkbox, cn,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mashora/design-system'
import { Repeat } from 'lucide-react'

export interface RecurrenceValue {
  enabled: boolean
  rule_type?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  end_type?: 'count' | 'until' | 'forever'
  count?: number
  until?: string
  weekdays?: string[]   // ['mon', 'wed', 'fri']
  monthly_type?: 'date' | 'day_of_week'
  /** Day-of-month, used when monthly_type === 'date'. */
  day?: number
  /** Used for "On the [first] [Mon]" pattern when monthly_type === 'day_of_week'. */
  byday?: 'first' | 'second' | 'third' | 'fourth' | 'last'
  weekday?: string
}

export interface RecurrenceFieldProps {
  value: RecurrenceValue
  onChange: (v: RecurrenceValue) => void
  className?: string
}

const WEEKDAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const RULE_TYPES: { key: RecurrenceValue['rule_type']; label: string }[] = [
  { key: 'daily', label: 'day(s)' },
  { key: 'weekly', label: 'week(s)' },
  { key: 'monthly', label: 'month(s)' },
  { key: 'yearly', label: 'year(s)' },
]

const BYDAY: { key: NonNullable<RecurrenceValue['byday']>; label: string }[] = [
  { key: 'first', label: 'first' },
  { key: 'second', label: 'second' },
  { key: 'third', label: 'third' },
  { key: 'fourth', label: 'fourth' },
  { key: 'last', label: 'last' },
]

export default function RecurrenceField({ value, onChange, className }: RecurrenceFieldProps) {
  const v: RecurrenceValue = {
    rule_type: 'weekly',
    interval: 1,
    end_type: 'forever',
    count: 1,
    weekdays: [],
    monthly_type: 'date',
    day: 1,
    byday: 'first',
    weekday: 'mon',
    ...value,
    enabled: value?.enabled ?? false,
  }

  const update = useCallback((patch: Partial<RecurrenceValue>) => {
    onChange({ ...v, ...patch })
  }, [v, onChange])

  const toggleWeekday = (key: string) => {
    const cur = new Set(v.weekdays || [])
    if (cur.has(key)) cur.delete(key); else cur.add(key)
    update({ weekdays: Array.from(cur) })
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Checkbox
          checked={v.enabled}
          onCheckedChange={(checked) => update({ enabled: !!checked })}
        />
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5 text-muted-foreground" /> Recurring
        </span>
      </label>

      {v.enabled && (
        <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-3">
          {/* Repeat every N <unit> */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">Repeat every</Label>
            <Input
              type="number"
              min={1}
              value={v.interval ?? 1}
              onChange={e => update({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="rounded-xl h-8 w-20"
            />
            <Select value={v.rule_type} onValueChange={(rt) => update({ rule_type: rt as RecurrenceValue['rule_type'] })}>
              <SelectTrigger className="rounded-xl h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map(rt => (
                  <SelectItem key={rt.key} value={rt.key!}>{rt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weekly: weekday chips */}
          {v.rule_type === 'weekly' && (
            <div>
              <Label className="text-xs text-muted-foreground block mb-1.5">On</Label>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAYS.map(d => {
                  const active = (v.weekdays || []).includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleWeekday(d.key)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border/50 text-muted-foreground hover:border-border',
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Monthly: by date or day-of-week */}
          {v.rule_type === 'monthly' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  checked={v.monthly_type === 'date'}
                  onChange={() => update({ monthly_type: 'date' })}
                  className="accent-primary"
                />
                <span className="text-muted-foreground">On day</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  disabled={v.monthly_type !== 'date'}
                  value={v.day ?? 1}
                  onChange={e => update({ day: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
                  className="rounded-xl h-8 w-20"
                />
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer flex-wrap">
                <input
                  type="radio"
                  checked={v.monthly_type === 'day_of_week'}
                  onChange={() => update({ monthly_type: 'day_of_week' })}
                  className="accent-primary"
                />
                <span className="text-muted-foreground">On the</span>
                <Select
                  value={v.byday}
                  onValueChange={(byday) => update({ byday: byday as RecurrenceValue['byday'] })}
                >
                  <SelectTrigger className="rounded-xl h-8 w-24" disabled={v.monthly_type !== 'day_of_week'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BYDAY.map(b => (
                      <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={v.weekday}
                  onValueChange={(weekday) => update({ weekday })}
                >
                  <SelectTrigger className="rounded-xl h-8 w-24" disabled={v.monthly_type !== 'day_of_week'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map(d => (
                      <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          )}

          {/* End type */}
          <div>
            <Label className="text-xs text-muted-foreground block mb-1.5">Ends</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  checked={v.end_type === 'forever'}
                  onChange={() => update({ end_type: 'forever' })}
                  className="accent-primary"
                />
                <span>Never</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  checked={v.end_type === 'count'}
                  onChange={() => update({ end_type: 'count' })}
                  className="accent-primary"
                />
                <span className="text-muted-foreground">After</span>
                <Input
                  type="number"
                  min={1}
                  disabled={v.end_type !== 'count'}
                  value={v.count ?? 1}
                  onChange={e => update({ count: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="rounded-xl h-8 w-20"
                />
                <span className="text-muted-foreground">occurrence(s)</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  checked={v.end_type === 'until'}
                  onChange={() => update({ end_type: 'until' })}
                  className="accent-primary"
                />
                <span className="text-muted-foreground">On</span>
                <Input
                  type="date"
                  disabled={v.end_type !== 'until'}
                  value={v.until ?? ''}
                  onChange={e => update({ until: e.target.value })}
                  className="rounded-xl h-8 w-40"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
