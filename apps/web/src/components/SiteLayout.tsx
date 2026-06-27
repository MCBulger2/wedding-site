import { Heart } from 'lucide-react';
import { siteContent } from '../siteContent.js';

export function Header() {
  return (
    <header className="site-header">
      <a
        href="/"
        className="brand"
        aria-label="Matt and Alison wedding homepage"
      >
        <Heart aria-hidden="true" />
        <span>Matt & Alison</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/#details">Details</a>
        <a href="/registry">Registry</a>
        <a href="/rsvp">RSVP</a>
      </nav>
    </header>
  );
}

export function SiteFooter({ showAdminLink }: { showAdminLink: boolean }) {
  return (
    <footer className="site-footer">
      <span>
        {siteContent.coupleNames} · {siteContent.dateLabel}
      </span>
      {showAdminLink && (
        <a className="footer-admin-link" href="/admin">
          Admin
        </a>
      )}
    </footer>
  );
}
