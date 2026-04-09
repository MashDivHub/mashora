interface CalendarEventProps {
  event: { title: string; id: string }
}

export default function CalendarEventContent({ event }: CalendarEventProps) {
  return (
    <div className="truncate px-1 text-xs font-medium">
      {event.title}
    </div>
  )
}
