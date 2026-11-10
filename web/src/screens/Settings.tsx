import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from '../components/Icon.js';
import type { CompanySettings } from '../types.js';

// Mirror functions/src/shared/defaults.ts so the form shows the same values the
// engine falls back to when a field is unset. Kept in sync by hand (two runtimes).
const DEFAULTS = { ticketAutoCloseDays: 14, retentionMonths: 12, language: 'he' as const, timezone: 'Asia/Jerusalem' };

export function Settings() {
  const { profile } = useAuth();
  const services = useServices();
  const { t } = useI18n();

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState({ name: '', language: DEFAULTS.language as 'he' | 'en', timezone: '', autoClose: '', retention: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeCompanySettings(companyId, setSettings);
  }, [services, companyId]);

  // Seed the form from the loaded settings, once (and whenever the active
  // company changes). After that the fields are the agent's to edit.
  useEffect(() => {
    if (settings === null) return;
    setForm({
      name: settings.name ?? '',
      language: settings.language ?? DEFAULTS.language,
      timezone: settings.timezone ?? '',
      autoClose: settings.ticketAutoCloseDays?.toString() ?? '',
      retention: settings.retentionMonths?.toString() ?? '',
    });
  }, [settings?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (companyId === undefined || settings === null) return <p className="muted">{t('common.loading')}</p>;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (companyId === undefined) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    // Positive integers only; fall back to the defaults when left blank.
    const autoClose = form.autoClose.trim() === '' ? DEFAULTS.ticketAutoCloseDays : Math.max(1, Math.trunc(Number(form.autoClose)));
    const retention = form.retention.trim() === '' ? DEFAULTS.retentionMonths : Math.max(1, Math.trunc(Number(form.retention)));
    if (!Number.isFinite(autoClose) || !Number.isFinite(retention)) {
      setBusy(false);
      setError(t('settings.invalid'));
      return;
    }
    try {
      await services.updateCompanySettings(companyId, {
        name: form.name.trim(),
        language: form.language,
        timezone: form.timezone.trim() === '' ? DEFAULTS.timezone : form.timezone.trim(),
        ticketAutoCloseDays: autoClose,
        retentionMonths: retention,
      });
      setSaved(true);
    } catch {
      setError(t('settings.failed'));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  return (
    <section>
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>{t('settings.subtitle')}</p>

      <form className="card card--pad form-grid" onSubmit={(e) => void onSave(e)}>
        <label className="field">
          <span>{t('settings.name')}</span>
          <input type="text" value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </label>

        <label className="field">
          <span>{t('settings.language')}</span>
          <select value={form.language} onChange={(e) => set('language')(e.target.value)}>
            <option value="he">{t('locale.he')}</option>
            <option value="en">{t('locale.en')}</option>
          </select>
        </label>

        <label className="field">
          <span>{t('settings.timezone')}</span>
          <input
            type="text"
            value={form.timezone}
            placeholder={DEFAULTS.timezone}
            onChange={(e) => set('timezone')(e.target.value)}
          />
        </label>

        <label className="field">
          <span>{t('settings.autoClose')}</span>
          <input
            type="number"
            min={1}
            value={form.autoClose}
            placeholder={String(DEFAULTS.ticketAutoCloseDays)}
            onChange={(e) => set('autoClose')(e.target.value)}
          />
          <small className="muted">{t('settings.autoCloseHint')}</small>
        </label>

        <label className="field">
          <span>{t('settings.retention')}</span>
          <input
            type="number"
            min={1}
            value={form.retention}
            placeholder={String(DEFAULTS.retentionMonths)}
            onChange={(e) => set('retention')(e.target.value)}
          />
          <small className="muted">{t('settings.retentionHint')}</small>
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            <Icon name="settings" size={16} />
            {busy ? t('settings.saving') : t('settings.save')}
          </button>
          {saved && <span className="saved-flag">{t('settings.saved')}</span>}
          {error !== null && <span className="error">{error}</span>}
        </div>
      </form>
    </section>
  );
}
