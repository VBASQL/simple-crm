import { useState, type FormEvent } from 'react';
import { useServices } from '../services/ServicesContext.js';
import type { ManualEntryType } from '../services/firestoreServices.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';

const KINDS: ManualEntryType[] = ['note', 'call', 'email', 'meeting'];

/**
 * Log a manual timeline entry: a plain note, or something not captured
 * automatically — a call on another phone, an email, an in-person meeting.
 * One composer, reused on the customer, ticket and call pages; the caller
 * decides which thread it lands on by passing ticketId / callId.
 */
export function EntryComposer({
  companyId,
  customerId,
  ticketId,
  callId,
  author,
  defaultType = 'note',
}: {
  companyId: string;
  customerId: string;
  ticketId?: string;
  callId?: string;
  author?: string;
  defaultType?: ManualEntryType;
}) {
  const services = useServices();
  const { t } = useI18n();

  const [type, setType] = useState<ManualEntryType>(defaultType);
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
      await services.addEntry({
        companyId,
        customerId,
        type,
        text: body,
        ...(ticketId !== undefined ? { ticketId } : {}),
        ...(callId !== undefined ? { callId } : {}),
        ...(author !== undefined ? { author } : {}),
      });
      setText('');
      setType(defaultType);
    } catch {
      setError(t('entry.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={(e) => void onSubmit(e)}>
      <div className="composer__kinds" role="group" aria-label={t('entry.kindLabel')}>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`chip chip--btn${type === k ? ' is-active' : ''}`}
            onClick={() => setType(k)}
          >
            {t(`entry.kind.${k}`)}
          </button>
        ))}
      </div>
      <div className="composer__row">
        <textarea
          className="note-input"
          rows={2}
          placeholder={t(`entry.placeholder.${type}`)}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || text.trim().length === 0}>
          <Icon name="plus" size={16} />
          {busy ? t('entry.adding') : t('entry.add')}
        </button>
      </div>
      {error !== null && <p className="error">{error}</p>}
    </form>
  );
}
