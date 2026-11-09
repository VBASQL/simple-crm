export type IconName =
  | 'calls'
  | 'customers'
  | 'tickets'
  | 'users'
  | 'search'
  | 'phone'
  | 'mail'
  | 'back'
  | 'logout'
  | 'plus'
  | 'trash';

const PATHS: Record<IconName, string> = {
  calls: 'M3 5.5A2.5 2.5 0 0 1 5.5 3h2L9 7l-2 1.5a12 12 0 0 0 5.5 5.5L14 12l4 1.5v2A2.5 2.5 0 0 1 15.5 18 13 13 0 0 1 3 5.5Z',
  customers: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19a3 3 0 0 0-4-2.8M18 10.5a2.5 2.5 0 0 0 0-4.9',
  tickets: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7ZM12 7v10',
  users: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  phone: 'M3 5.5A2.5 2.5 0 0 1 5.5 3h2L9 7l-2 1.5a12 12 0 0 0 5.5 5.5L14 12l4 1.5v2A2.5 2.5 0 0 1 15.5 18 13 13 0 0 1 3 5.5Z',
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3.5 7l8.5 6 8.5-6',
  back: 'M15 19l-7-7 7-7',
  logout: 'M10 17l-1.5-1.5M9 12h11M16 7l4 5-4 5M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
