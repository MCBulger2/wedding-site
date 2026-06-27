import { useMemo } from 'react';
import { Header, SiteFooter } from './components/SiteLayout.js';
import { AdminPage } from './pages/AdminPage.js';
import { HomePage, RegistryPage } from './pages/PublicPages.js';
import { RsvpLookupPage, RsvpPage, RsvpSuccessPage } from './pages/RsvpPages.js';

type Route =
  | { name: 'home' }
  | { name: 'registry' }
  | { name: 'rsvp_entry' }
  | { name: 'rsvp'; inviteCode: string }
  | { name: 'rsvp_success'; inviteCode: string }
  | { name: 'admin' };

export function App() {
  const route = useMemo(() => parseRoute(window.location.pathname), []);

  return (
    <div className="app-shell">
      <Header />
      {route.name === 'home' && <HomePage />}
      {route.name === 'registry' && <RegistryPage />}
      {route.name === 'rsvp_entry' && <RsvpLookupPage />}
      {route.name === 'rsvp' && <RsvpPage inviteCode={route.inviteCode} />}
      {route.name === 'rsvp_success' && (
        <RsvpSuccessPage inviteCode={route.inviteCode} />
      )}
      {route.name === 'admin' && <AdminPage />}
      <SiteFooter showAdminLink={route.name !== 'admin'} />
    </div>
  );
}

function parseRoute(pathname: string): Route {
  if (pathname === '/registry') {
    return { name: 'registry' };
  }
  if (pathname === '/rsvp') {
    return { name: 'rsvp_entry' };
  }
  if (pathname.startsWith('/rsvp/') && pathname.endsWith('/success')) {
    return {
      name: 'rsvp_success',
      inviteCode: decodeURIComponent(
        pathname.slice('/rsvp/'.length, -'/success'.length),
      ),
    };
  }
  if (pathname.startsWith('/rsvp/')) {
    return {
      name: 'rsvp',
      inviteCode: decodeURIComponent(pathname.slice('/rsvp/'.length)),
    };
  }
  if (pathname === '/admin') {
    return { name: 'admin' };
  }
  return { name: 'home' };
}
