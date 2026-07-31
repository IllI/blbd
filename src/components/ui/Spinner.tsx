import { cx } from '@/lib/utils';

interface SpinnerProps {
  size?: number;
  dark?: boolean;
  label?: string;
}

export function Spinner({ size = 16, dark = false, label }: SpinnerProps) {
  return (
    <span
      className={cx('spinner', dark && 'spinner--dark')}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <Spinner dark label={label} />
      <span className="small">{label}</span>
    </div>
  );
}
