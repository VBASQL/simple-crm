import { useState, type FormEvent } from 'react';
import { useServices } from '../services/ServicesContext.js';
import type { InteractionType } from '../services/firestoreServices.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';

const KINDS: InteractionType[] = ['call', 'email', 'meeting'];

/**
 * Log an interaction that was not captured automatically — a call on another
 * phone, an email, or an in-person meeting. Always lands on a ticket (every
 * interaction belongs to a ticket). Distinct from a note, which is commentary.
 */
export function InteractionLogger({
  companyId,
  customerId,
  ticketId,
  author,
}: {
  companyId: string;
  customerId: string;
  ticketId: string;
  author?: string;
}) {
  const services = useServices();
  const { t } = useI18n();
  const [type, setType] = useState<InteractionType>('call');
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
      await services.logInteraction({ companyId, customerId, ticketId, type, text: body, ...(author !== undefined ? { author } : {}) });
      setText('');
      setType('call');
    } catch {
      setError(t('interaction.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={(e) => void onSubmit(e)}>
      <div className="composer__kinds" role="group" aria-label={t('interaction.kindLabel')}>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`chip chip--btn${type === k ? ' is-active' : ''}`}
            onClick={() => setType(k)}
          >
            {t(`event.type.${k}`)}
          </button>
        ))}
      </div>
      <div className="composer__row">
        <textarea
          className="note-input"
          rows={2}
          placeholder={t(`interaction.placeholder.${type}`)}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || text.trim().length === 0}>
          <Icon name="plus" size={16} />
          {busy ? t('interaction.logging') : t('interaction.log')}
        </button>
      </div>
      {error !== null && <p className="error">{error}</p>}
    </form>
  );
}
