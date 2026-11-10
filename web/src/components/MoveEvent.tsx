import { useState } from 'react';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';
import type { Ticket } from '../types.js';

/**
 * Re-file a call or interaction onto a different ticket of the same customer —
 * an existing one, or a brand-new ticket. Generic over what moves: the caller
 * supplies onMove(toTicketId) and onMoveToNew() (create a ticket + move onto it).
 */
export function MoveTo({
  currentTicketId,
  tickets,
  onMove,
  onMoveToNew,
}: {
  currentTicketId?: string;
  tickets: Ticket[];
  onMove: (toTicketId: string) => void;
  onMoveToNew?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const others = tickets.filter((tk) => tk.id !== currentTicketId);

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
                  onMove(tk.id);
                  setOpen(false);
                }}
              >
                {tk.subject ?? t('tickets.noSubject')}
              </button>
            ))}
            {onMoveToNew !== undefined && (
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  onMoveToNew();
                  setOpen(false);
                }}
              >
                <Icon name="plus" size={14} />
                <span>{t('event.moveToNew')}</span>
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}
