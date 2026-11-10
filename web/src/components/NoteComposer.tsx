import { useState, type FormEvent } from 'react';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';

/**
 * Add a free-text note. A note is commentary — distinct from a logged
 * interaction (call/email/meeting). The caller anchors it by passing the
 * ids: a note on a customer, a ticket, a call, or a single event.
 */
export function NoteComposer({
  companyId,
  customerId,
  ticketId,
  callId,
  eventId,
  author,
  placeholder,
  compact = false,
}: {
  companyId: string;
  customerId: string;
  ticketId?: string;
  callId?: string;
  eventId?: string;
  author?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const services = useServices();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (body.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await services.addNote({
        companyId,
        customerId,
        text: body,
        ...(ticketId !== undefined ? { ticketId } : {}),
        ...(callId !== undefined ? { callId } : {}),
        ...(eventId !== undefined ? { eventId } : {}),
        ...(author !== undefined ? { author } : {}),
      });
      setText('');
    } catch {
      setError(t('note.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="note-form" onSubmit={(e) => void onSubmit(e)}>
      <textarea
        className="note-input"
        rows={compact ? 1 : 2}
        placeholder={placeholder ?? t('note.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn btn--primary" disabled={busy || text.trim().length === 0}>
        <Icon name="plus" size={16} />
        {busy ? t('note.adding') : t('note.add')}
      </button>
      {error !== null && <p className="error">{error}</p>}
    </form>
  );
}
