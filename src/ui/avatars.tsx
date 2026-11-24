/** Team avatars: a person's photo (or initials). The Front Desk shows whoever is on duty, with a green "on duty" dot. */
import type { Conversation, Person } from '@/data/team';
import { InitialsAvatar } from './kit';

export function PersonAvatar({ person, size = 48 }: { person: Pick<Person, 'name' | 'photo'>; size?: number }) {
  if (!person.photo) return <InitialsAvatar name={person.name} size={size} />;
  return <img src={person.photo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
}

export function ConvAvatar({ conv, size = 48 }: { conv: Pick<Conversation, 'name' | 'face' | 'kind'>; size?: number }) {
  const dot = Math.max(10, Math.round(size * 0.26));
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <PersonAvatar person={conv.face ?? { name: conv.name }} size={size} />
      {conv.kind === 'frontdesk' && conv.face && <span className="absolute bottom-0 right-0 rounded-full bg-[#22c55e] ring-2 ring-white" style={{ width: dot, height: dot }} aria-label="On duty" />}
    </span>
  );
}
