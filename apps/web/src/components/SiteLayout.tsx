import { Heart, Moon, Sun } from 'lucide-react';
import { scoped } from '../classNames.js';
import { siteContent } from '../siteContent.js';
import { useTheme } from '../theme.js';
import styles from './SiteLayout.module.css';

export function Header() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const ThemeIcon = isDarkTheme ? Sun : Moon;
  const toggleLabel = isDarkTheme
    ? 'Switch to light mode'
    : 'Switch to dark mode';

  return (
    <header className={scoped(styles, 'site-header')}>
      <a
        href="/"
        className={scoped(styles, 'brand')}
        aria-label="Matt and Alison wedding homepage"
      >
        <Heart aria-hidden="true" />
        <span>Matt & Alison</span>
      </a>
      <div className={scoped(styles, 'header-actions')}>
        <nav aria-label="Primary navigation">
          <a href="/#details">Details</a>
          <a href="/our-story">Our Story</a>
          <a href="/registry">Registry</a>
          <a href="/rsvp">RSVP</a>
        </nav>
        <button
          type="button"
          className={scoped(styles, 'theme-toggle-button')}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={toggleTheme}
        >
          <ThemeIcon aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function SiteFooter({ showAdminLink }: { showAdminLink: boolean }) {
  return (
    <footer className={scoped(styles, 'site-footer')}>
      <span>
        {siteContent.coupleNames} · {siteContent.dateLabel}
      </span>
      {showAdminLink && (
        <a className={scoped(styles, 'footer-admin-link')} href="/admin">
          Admin
        </a>
      )}
    </footer>
  );
}
