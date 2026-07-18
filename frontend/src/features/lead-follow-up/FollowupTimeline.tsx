import { Bot, CalendarCheck2, MessageCircle, NotebookPen, Send, UserRound } from 'lucide-react'
import type { FollowupEvent } from '../../types'

const iconMap: Record<string, typeof Bot> = {
  customer_message: MessageCircle,
  advisor_sent: Send,
  advisor_note: NotebookPen,
  intent_detected: Bot,
  test_drive_booked: CalendarCheck2,
}

export function FollowupTimeline({ events }: { events: FollowupEvent[] }) {
  return (
    <ol className="timeline">
      {events.map(event => {
        const Icon = iconMap[event.type] || UserRound
        return <li key={event.id}><span className="timeline-icon"><Icon size={17} /></span><div className="timeline-body"><div><strong>{event.title}</strong><span>{event.time}</span></div><p>{event.content}</p><small>{event.actor}</small></div></li>
      })}
    </ol>
  )
}
