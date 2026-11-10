import { useServices } from '../services/ServicesContext.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime } from '../format.js';
import { Icon } from './Icon.js';
import type { Note } from '../types.js';

/** Render a list of notes; the author may delete their own. */
export function NotesList({ notes }: { notes: Note[] }) {
  const services = useServices();
  const { profile } = useAuth();
  const { t, locale } = useI18n();

  if (notes.length === 0) return null;

  return (
    <ul className="notes">
      {notes.map((n) => (
        <li key={n.id} className="note">
          <div className="note__body">
            <span className="note__text">{n.text}</span>
            <span className="muted note__meta">
              {n.author ?? ''} · {relativeTime(n.at, locale)}
            </span>
          </div>
          {n.author !== undefined && n.author === profile?.email && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              title={t('note.delete')}
              onClick={() => {
                if (window.confirm(t('note.confirmDelete'))) void services.deleteNote(n.id);
              }}
            >
              <Icon name="trash" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
