import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Skeleton } from '@mashora/design-system'
import type { ViewProps } from '../../ViewRegistry'
import { fetchViewDefinition } from '../../ActionService'
import { loadCalendarEvents, rescheduleEvent, extractCalendarConfig } from './CalendarController'

export default function CalendarView({ model, action, domain: actionDomain }: ViewProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split('T')[0],
  })

  const { data: viewDef } = useQuery({
    queryKey: ['viewDef', model, 'calendar'],
    queryFn: () => fetchViewDefinition(model, 'calendar'),
    staleTime: 5 * 60 * 1000,
  })

  const config = viewDef ? extractCalendarConfig(viewDef.arch) : null

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar', model, dateRange, actionDomain],
    queryFn: () =>
      config
        ? loadCalendarEvents(
            model,
            config.dateStartField,
            config.dateStopField,
            config.displayFields,
            dateRange.start,
            dateRange.end,
            actionDomain || [],
          )
        : Promise.resolve([]),
    enabled: !!config,
  })

  const calendarEvents = useMemo(
    () =>
      (events || []).map(e => ({
        id: String(e.id),
        title: e.title,
        start: e.start,
        end: e.end || undefined,
        allDay: e.allDay,
        extendedProps: { record: e.record },
      })),
    [events],
  )

  const handleEventClick = useCallback(
    (info: any) => {
      navigate(`/model/${model}/${info.event.id}`)
    },
    [navigate, model],
  )

  const handleEventDrop = useCallback(
    async (info: any) => {
      if (!config) return
      const newStart = info.event.start?.toISOString()?.slice(0, 19)?.replace('T', ' ')
      const newEnd = info.event.end?.toISOString()?.slice(0, 19)?.replace('T', ' ')
      if (newStart) {
        await rescheduleEvent(
          model,
          parseInt(info.event.id),
          config.dateStartField,
          newStart,
          config.dateStopField,
          newEnd,
        )
        queryClient.invalidateQueries({ queryKey: ['calendar', model] })
      }
    },
    [model, config, queryClient],
  )

  const handleDateClick = useCallback(() => {
    navigate(`/model/${model}/new`)
  }, [navigate, model])

  const handleDatesSet = useCallback((info: any) => {
    setDateRange({
      start: info.startStr.split('T')[0],
      end: info.endStr.split('T')[0],
    })
  }, [])

  const modelLabel = model.split('.').pop()?.replace(/_/g, ' ') || model

  if (!viewDef || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-2xl" />
        <Skeleton className="h-[600px] w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          {model.replace(/\./g, ' ')}
        </p>
        <h1 className="text-xl font-semibold tracking-tight capitalize">
          {action?.name || modelLabel}
        </h1>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.45)] [&_.fc]:text-sm [&_.fc-button]:rounded-lg [&_.fc-button]:text-xs [&_.fc-button-primary]:bg-zinc-900 [&_.fc-button-primary]:border-zinc-700 [&_.fc-today-button]:rounded-xl [&_.fc-daygrid-event]:rounded-lg [&_.fc-daygrid-event]:border-0 [&_.fc-daygrid-event]:bg-primary/80 [&_.fc-daygrid-event]:px-1.5 [&_.fc-daygrid-event]:text-primary-foreground [&_.fc-timegrid-event]:rounded-lg [&_.fc-timegrid-event]:border-0 [&_.fc-timegrid-event]:bg-primary/80 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground [&_.fc-scrollgrid]:border-border/60 [&_td]:border-border/40 [&_th]:border-border/40">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          editable={true}
          selectable={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          height="auto"
          dayMaxEvents={3}
        />
      </div>
    </div>
  )
}
