import type { ReactNode } from 'react';

export function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string | undefined }) {
  return (
    <section className={`anim-enter-up rounded-[var(--radius-card)] border border-hairline bg-surface p-5 ${className}`}>
      {title === '' ? null : <h2 className="text-[15px] font-semibold text-text">{title}</h2>}
      <div className={title === '' ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}
