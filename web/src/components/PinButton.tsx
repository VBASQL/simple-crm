import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';

/** Pin / unpin toggle. The caller owns the write; this is just the control. */
export function PinButton({ pinned, onToggle }: { pinned: boolean; onToggle: (next: boolean) => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`btn btn--sm pin-btn${pinned ? ' is-pinned' : ''}`}
      title={pinned ? t('action.unpin') : t('action.pin')}
      aria-pressed={pinned}
      onClick={() => onToggle(!pinned)}
    >
      <Icon name="star" size={15} />
      {pinned ? t('action.pinned') : t('action.pin')}
    </button>
  );
}
