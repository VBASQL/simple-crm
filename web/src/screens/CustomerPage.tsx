import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { useLinkTo, useBackTarget } from '../nav.js';
import { relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import { PinButton } from '../components/PinButton.js';
import { NoteComposer } from '../components/NoteComposer.js';
import { NotesList } from '../components/NotesList.js';
import type { Call, Customer, Note, Ticket } from '../types.js';

// Customer ▸ Ticket ▸ Call. The customer page leads with the customer's
// TICKETS and notes, and also has an all-CALLS view (every call, regardless of
// which ticket it is on) — the full contact history in one place.
export function CustomerPage() {
  const { customerId = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const linkTo = useLinkTo();
  const backTo = useBackTarget('/customers');

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const companyId = profile?.companyId;

  useEffect(() => {
    void services.getCustomer(customerId).then(setCustomer);
  }, [services, customerId]);

  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [
      services.subscribeCustomerTickets(companyId, customerId, setTickets),
      services.subscribeCustomerCalls(companyId, customerId, setCalls),
      services.subscribeNotes(companyId, customerId, setNotes),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId, customerId]);

  const name = customer?.name ?? t('common.unknownCustomer');
  const subjectOf = (id?: string): string | undefined =>
    id === undefined ? undefined : tickets.find((tk) => tk.id === id)?.subject;
  const customerNotes = notes.filter((n) => n.ticketId === undefined && n.callId === undefined && n.eventId === undefined);

  return (
    <section>
      <Link to={backTo} className="btn btn--ghost btn--sm" style={{ marginBottom: '0.8rem' }}>
        <Icon name="back" size={16} />
        {t('common.back')}
      </Link>

      <div className="customer-head">
        <Avatar name={customer?.name ?? customer?.phones[0]} size={56} />
        <div>
          <h1>{name}</h1>
          <div className="customer-head__meta">
            {customer?.phones[0] !== undefined && (
              <span>
                <Icon name="phone" size={14} /> {customer.phones.join(', ')}
              </span>
            )}
            {customer?.emails[0] !== undefined && (
              <span>
                <Icon name="mail" size={14} /> {customer.emails.join(', ')}
              </span>
            )}
          </div>
          {customer && customer.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              {customer.tags.map((tg) => (
                <span key={tg} className="chip">
                  {tg}
                </span>
              ))}
            </div>
          )}
        </div>
        {customer !== null && (
          <div className="customer-head__actions">
            <PinButton
              pinned={customer.pinned === true}
              onToggle={(next) => void services.setCustomerPinned(customer.id, next)}
            />
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Tickets — the customer's work, each nesting its own calls. */}
        <div className="card card--pad">
          <div className="group-head">
            <h2>{t('customer.tickets')}</h2>
            {companyId !== undefined && (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  void (async () => {
                    const id = await services.createTicket(companyId, customerId);
                    navigate(linkTo(`/tickets/${id}`));
                  })();
                }}
              >
                <Icon name="plus" size={14} />
                {t('customer.newTicket')}
              </button>
            )}
          </div>
          {tickets.length === 0 ? (
            <p className="muted">{t('customer.noTickets')}</p>
          ) : (
            <ul className="list">
              {tickets.map((tk) => (
                <li key={tk.id}>
                  {tk.pinned === true && <Icon name="star" size={13} />}
                  <span className={`badge badge--${tk.status}`}>{t(`ticket.status.${tk.status}`)}</span>
                  <Link to={linkTo(`/tickets/${tk.id}`)} className="grow link">
                    {tk.subject ?? t('tickets.noSubject')}
                  </Link>
                  <span className="muted">{relativeTime(tk.lastActivityAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notes — general commentary about the client, separate from tickets. */}
        <div className="card card--pad">
          <h2>{t('customer.notes')}</h2>
          {companyId !== undefined && (
            <NoteComposer companyId={companyId} customerId={customerId} author={profile?.email} />
          )}
          {customerNotes.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.8rem' }}>
              {t('customer.noNotes')}
            </p>
          ) : (
            <div style={{ marginTop: '0.8rem' }}>
              <NotesList notes={customerNotes} />
            </div>
          )}
        </div>
      </div>

      {/* All calls — every call for this client, regardless of ticket. */}
      <div className="card card--pad" style={{ marginTop: '1rem' }}>
        <h2>{t('customer.calls')}</h2>
        {calls.length === 0 ? (
          <p className="muted">{t('customer.noCalls')}</p>
        ) : (
          <ul className="events">
            {calls.map((c) => (
              <li key={c.id} className="event">
                <div className="event__row">
                  <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                  <Link to={linkTo(`/calls/${c.id}`)} className="grow link">
                    {t(`call.direction.${c.direction}`)} · {c.callerNumber ?? t('common.unknownCustomer')}
                  </Link>
                  {c.ticketId !== undefined && (
                    <Link to={linkTo(`/tickets/${c.ticketId}`)} className="chip">
                      {subjectOf(c.ticketId) ?? t('tickets.noSubject')}
                    </Link>
                  )}
                  <span className="muted">{relativeTime(c.startTime, locale)}</span>
                </div>
                {c.recordingUrl !== undefined && (
                  <audio className="event__audio" controls preload="none" src={c.recordingUrl} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
