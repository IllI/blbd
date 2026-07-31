import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ title, action, flush = false, className, children }: CardProps) {
  return (
    <section className={cx('card', flush && 'card--flush', className)}>
      {(title || action) && (
        <div className="card__title">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__mark" aria-hidden="true">
        ✹ ✦ ✹
      </div>
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  );
}
