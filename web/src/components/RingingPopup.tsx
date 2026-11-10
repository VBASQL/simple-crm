import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Avatar } from './Avatar.js';
import { Icon } from './Icon.js';
import type { Customer, RingingDoc } from '../types.js';

/**
 * Global live pop-up. Subscribes to the company's `ringing` collection and
 * shows the newest active ring until it is dismissed or the doc disappears
 * (answer / hangup delete it). This is the product's signature feature.
 */
export function RingingPopup() {
  const { profile } = useAuth();
  const services = useServices();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [ringing, setRinging] = useState<RingingDoc[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [customer, setCustomer] = useState<Customer | null>(null);

  const companyId = profile?.companyId;

  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeRinging(companyId, setRinging);
  }, [services, companyId]);

  const active = useMemo(() => ringing.find((r) => !dismissed.has(r.id)) ?? null, [ringing, dismissed]);

  useEffect(() => {
    let cancelled = false;
    if (active === null) {
      setCustomer(null);
      return;
    }
    void services.getCustomer(active.customerId).then((c) => {
      if (!cancelled) setCustomer(c);
    });
    return () => {
      cancelled = true;
    };
  }, [services, active]);

  if (active === null) return null;

  const name = customer?.name ?? t('popup.newCustomer');
  const number = active.callerNumber ?? customer?.phones[0] ?? '';

  return (
    <div className="popup" role="dialog" aria-label={t('popup.incoming')}>
      <div className="popup__label">
        <Icon name="phone" size={13} /> {t('popup.incoming')}
      </div>
      <div className="popup__row">
        <Avatar name={customer?.name ?? number} size={40} />
        <div>
          <div className="popup__name">{name}</div>
          <div className="popup__number">{number}</div>
        </div>
      </div>
      <div className="popup__actions">
        {/* Open the call itself, not just the customer: the agent needs the
            note box live while the call is ringing/connected. The ringing doc
            id is the call_id, so it is the call's own page. */}
        <button type="button" className="btn btn--primary" onClick={() => navigate(`/calls/${active.id}`)}>
          {t('popup.openCall')}
        </button>
        <button type="button" className="btn" onClick={() => setDismissed((prev) => new Set(prev).add(active.id))}>
          {t('popup.dismiss')}
        </button>
      </div>
    </div>
  );
}
