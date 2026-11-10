import { useState } from 'react';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';
import type { Ticket } from '../types.js';

/**
 * Move an interaction event to a different ticket of the same customer. The
 * list is the customer's other tickets, so a call/email/meeting can be re-filed
 * when it was threaded onto the wrong one.
 */
export function MoveEvent({ eventId, currentTicketId, tickets }: { eventId: string; currentTicketId?: string; tickets: Ticket[] }) {
  const services = useServices();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const others = tickets.filter((tk) => tk.id !== currentTicketId);
  if (others.length === 0) return null;

  return (
    <span className="menu">
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen((v) => !v)} title={t('event.move')}>
        <Icon name="back" size={13} />
        {t('event.move')}
      </button>
      {open && (
        <>
          <div className="menu__backdrop" onClick={() => setOpen(false)} />
          <div className="menu__panel" role="menu">
            {others.map((tk) => (
              <button
                key={tk.id}
                type="button"
                className="menu__item"
                onClick={() => {
                  void services.moveEvent(eventId, tk.id);
                  setOpen(false);
                }}
              >
                {tk.subject ?? t('tickets.noSubject')}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
