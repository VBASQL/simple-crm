import { useState } from 'react';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from '../components/Icon.js';

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function Share() {
  const services = useServices();
  const { t } = useI18n();
  const [secret, setSecret] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onCreate() {
    if (secret.trim().length === 0) return;
    setBusy(true);
    try {
      const id = services.createSecret(secret.trim());
      const resolved = await id;
      setLink(`${window.location.origin}/s.html#${resolved}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (link === null) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked; the link is selectable on screen.
    }
  }

  function reset() {
    setLink(null);
    setSecret('');
  }

  return (
    <section>
      <div className="page-head">
        <h1>{t('share.title')}</h1>
      </div>

      {link === null ? (
        <div className="card card--pad" style={{ maxWidth: '540px' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            {t('share.subtitle')}
          </p>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
            {t('share.secretLabel')}
          </label>
          <textarea
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            rows={3}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setSecret(randomKey())}>
              {t('share.generate')}
            </button>
            <button type="button" className="btn btn--primary" disabled={busy || secret.trim().length === 0} onClick={() => void onCreate()}>
              <Icon name="key" size={16} />
              {busy ? t('share.creating') : t('share.create')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card card--pad" style={{ maxWidth: '540px' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            {t('share.ready')}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem', wordBreak: 'break-all', flex: 1, minWidth: 0 }}>
              {link}
            </code>
            <button type="button" className="btn btn--primary" onClick={() => void copy()}>
              {copied ? t('share.copied') : t('share.copy')}
            </button>
          </div>
          <p className="error" style={{ marginTop: '0.9rem' }}>
            {t('share.warn')}
          </p>
          <button type="button" className="btn" onClick={reset}>
            {t('share.another')}
          </button>
        </div>
      )}
    </section>
  );
}
