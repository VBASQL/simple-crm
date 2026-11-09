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
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'secret' | null>(null);

  async function onCreate() {
    const value = secret.trim();
    if (value.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const id = await services.createSecret(value);
      setLink(`${window.location.origin}/s.html#${id}`);
    } catch {
      setError(t('share.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, which: 'link' | 'secret') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      // Clipboard blocked; the text is selectable on screen.
    }
  }

  function reset() {
    setLink(null);
    setSecret('');
    setError(null);
  }

  const codeStyle = { fontFamily: 'ui-monospace, monospace', fontSize: '0.9rem', wordBreak: 'break-all' as const, flex: 1, minWidth: 0 };

  return (
    <section>
      <div className="page-head">
        <h1>{t('share.title')}</h1>
      </div>

      {link === null ? (
        <div className="card card--pad" style={{ maxWidth: '560px' }}>
          <p className="muted" style={{ marginTop: 0 }}>{t('share.subtitle')}</p>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
            {t('share.secretLabel')}
          </label>
          <textarea
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            rows={3}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
          />
          {error !== null && <p className="error">{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setSecret(randomKey())}>
              {t('share.generate')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || secret.trim().length === 0}
              onClick={() => void onCreate()}
            >
              <Icon name="key" size={16} />
              {busy ? t('share.creating') : t('share.create')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card card--pad" style={{ maxWidth: '560px' }}>
          <h2 style={{ marginTop: 0 }}>{t('share.yourSecret')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
            <code style={codeStyle}>{secret.trim()}</code>
            <button type="button" className="btn" onClick={() => void copy(secret.trim(), 'secret')}>
              {copied === 'secret' ? t('share.copied') : t('share.copy')}
            </button>
          </div>

          <h2>{t('share.linkForRecipient')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={codeStyle}>{link}</code>
            <button type="button" className="btn btn--primary" onClick={() => void copy(link, 'link')}>
              {copied === 'link' ? t('share.copied') : t('share.copy')}
            </button>
          </div>
          <p className="error" style={{ marginTop: '0.9rem' }}>{t('share.warn')}</p>
          <button type="button" className="btn" onClick={reset}>{t('share.another')}</button>
        </div>
      )}
    </section>
  );
}
