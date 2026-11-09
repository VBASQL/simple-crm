import { hueFrom, initials } from '../format.js';

export function Avatar({ name, size = 36 }: { name: string | undefined; size?: number }) {
  const hue = hueFrom(name ?? 'anon');
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(${hue} 70% 92%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
