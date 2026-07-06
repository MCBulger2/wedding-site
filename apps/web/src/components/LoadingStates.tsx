import { Heart } from 'lucide-react';
import { cx } from '../classNames.js';

export function LoadingPulse({
  compact = false,
  status = true,
}: {
  compact?: boolean;
  status?: boolean;
}) {
  return (
    <div
      className={cx('loading-pulse', compact && 'compact')}
      role={status ? 'status' : undefined}
      aria-label={status ? 'Loading' : undefined}
    >
      <div className="loading-mark" aria-hidden="true">
        <Heart />
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <section
      className="lookup-card loading-card"
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      <LoadingPulse status={false} />
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </section>
  );
}

export function RouteLoadingFallback() {
  return (
    <main className="page-shell route-loading-shell">
      <LoadingScreen />
    </main>
  );
}

export function SkeletonStat() {
  return (
    <article className="skeleton-stat" aria-hidden="true">
      <span className="skeleton-line number" />
      <span className="skeleton-line short" />
    </article>
  );
}

export function SkeletonDashboard({
  householdCardClassName,
  statsInlineClassName,
  memberListClassName,
}: {
  householdCardClassName?: string;
  statsInlineClassName?: string;
  memberListClassName?: string;
}) {
  return (
    <div className="admin-skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <article
          className={cx(householdCardClassName, 'skeleton-household-card')}
          key={item}
        >
          <div className="section-heading">
            <div className="skeleton-stack">
              <span className="skeleton-line title" />
              <span className="skeleton-line wide" />
            </div>
            <div className="toolbar-actions skeleton-actions">
              <span className="skeleton-button" />
              <span className="skeleton-button" />
            </div>
          </div>
          <div className={statsInlineClassName}>
            <span className="skeleton-line short" />
            <span className="skeleton-line short" />
            <span className="skeleton-line short" />
          </div>
          <div className={memberListClassName}>
            <span className="skeleton-row" />
            <span className="skeleton-row" />
          </div>
        </article>
      ))}
    </div>
  );
}
