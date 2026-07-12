import { Heart, Moon, Sun } from 'lucide-react';
import { scoped } from '../classNames.js';
import { siteContent } from '../siteContent.js';
import { useTheme } from '../theme.js';
import styles from './SiteLayout.module.css';

type HeaderRoute =
  | 'home'
  | 'our_story'
  | 'registry'
  | 'privacy'
  | 'rsvp_entry'
  | 'rsvp'
  | 'rsvp_success'
  | 'sms_updates'
  | 'sms_opt_in_redirect'
  | 'terms'
  | 'admin';

const navItems: Array<{
  href: string;
  label: string;
  activeRoutes: HeaderRoute[];
}> = [
  { href: '/#details', label: 'Details', activeRoutes: ['home'] },
  { href: '/our-story', label: 'Our Story', activeRoutes: ['our_story'] },
  { href: '/registry', label: 'Registry', activeRoutes: ['registry'] },
  {
    href: '/rsvp',
    label: 'RSVP',
    activeRoutes: ['rsvp_entry', 'rsvp', 'rsvp_success'],
  },
];

export function Header({ activeRoute }: { activeRoute: HeaderRoute }) {
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
          {navItems.map((item) => (
            <a
              href={item.href}
              aria-current={
                item.activeRoutes.includes(activeRoute) ? 'page' : undefined
              }
              key={item.href}
            >
              {item.label}
            </a>
          ))}
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
      <span className={scoped(styles, 'footer-details')}>
        <span>Matt &amp; Alison Wedding · {siteContent.dateLabel}</span>
        <a href={siteContent.contact.href}>
          <span aria-hidden="true">· </span>
          {siteContent.contact.email}
        </a>
      </span>
      <div className={scoped(styles, 'footer-links')}>
        <a className={scoped(styles, 'footer-admin-link')} href="/terms">
          Terms
        </a>
        <a className={scoped(styles, 'footer-admin-link')} href="/privacy">
          Privacy
        </a>
        {showAdminLink && (
          <a className={scoped(styles, 'footer-admin-link')} href="/admin">
            Admin
          </a>
        )}
      </div>
    </footer>
  );
}
