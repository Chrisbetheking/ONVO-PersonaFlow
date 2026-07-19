import { Bot, CalendarCheck2, MessageCircle, NotebookPen, Send, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FollowupEvent } from '../../types'

const iconMap: Record<string, typeof Bot> = {
  customer_message: MessageCircle,
  advisor_sent: Send,
  advisor_note: NotebookPen,
  intent_detected: Bot,
  test_drive_booked: CalendarCheck2,
}

export function FollowupTimeline({ events, selectedId = '', onSelect, renderActions }: { events: FollowupEvent[]; selectedId?: string; onSelect?: (event: FollowupEvent) => void; renderActions?: (event: FollowupEvent) => ReactNode }) {
  return (
    <ol className="timeline">
      {events.map(event => {
        const Icon = iconMap[event.type] || UserRound
        return <li key={event.id} className={selectedId === event.id ? 'active' : ''} data-testid={`timeline-event-${event.id}`}>
          <span className="timeline-icon"><Icon size={17} /></span>
          <div className="timeline-body">
            <button className="timeline-main" onClick={() => onSelect?.(event)}>
              <div><strong>{event.title}</strong><span>{event.time}</span></div>
              <p>{event.content}</p>
              <small>{event.actor}{event.source_label ? ` · ${event.source_label}` : ''}{event.sync_status ? ` · ${event.sync_status}` : ''}</small>
            </button>
            {renderActions ? <div className="timeline-event-actions">{renderActions(event)}</div> : null}
          </div>
        </li>
      })}
    </ol>
  )
}
