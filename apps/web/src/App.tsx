import { useMemo } from 'react';
import { Header, SiteFooter } from './components/SiteLayout.js';
import { AdminPage } from './pages/AdminPage.js';
import {
  HomePage,
  OurStoryPage,
  PrivacyPage,
  RegistryPage,
  SmsOptInProofPage,
  TermsPage,
} from './pages/PublicPages.js';
import { RsvpLookupPage, RsvpPage, RsvpSuccessPage } from './pages/RsvpPages.js';

type Route =
  | { name: 'home' }
  | { name: 'our_story' }
  | { name: 'registry' }
  | { name: 'privacy' }
  | { name: 'rsvp_entry' }
  | { name: 'rsvp'; inviteCode: string }
  | { name: 'rsvp_success'; inviteCode: string }
  | { name: 'sms_opt_in_proof' }
  | { name: 'terms' }
  | { name: 'admin' };

export function App() {
  const route = useMemo(() => parseRoute(window.location.pathname), []);

  return (
    <div className="app-shell">
      <Header />
      {route.name === 'home' && <HomePage />}
      {route.name === 'our_story' && <OurStoryPage />}
      {route.name === 'privacy' && <PrivacyPage />}
      {route.name === 'registry' && <RegistryPage />}
      {route.name === 'rsvp_entry' && <RsvpLookupPage />}
      {route.name === 'rsvp' && <RsvpPage inviteCode={route.inviteCode} />}
      {route.name === 'rsvp_success' && (
        <RsvpSuccessPage inviteCode={route.inviteCode} />
      )}
      {route.name === 'sms_opt_in_proof' && <SmsOptInProofPage />}
      {route.name === 'terms' && <TermsPage />}
      {route.name === 'admin' && <AdminPage />}
      <SiteFooter showAdminLink={route.name !== 'admin'} />
    </div>
  );
}

function parseRoute(pathname: string): Route {
  if (pathname === '/our-story') {
    return { name: 'our_story' };
  }
  if (pathname === '/registry') {
    return { name: 'registry' };
  }
  if (pathname === '/privacy') {
    return { name: 'privacy' };
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
  if (pathname === '/sms-opt-in-proof') {
    return { name: 'sms_opt_in_proof' };
  }
  if (pathname === '/terms') {
    return { name: 'terms' };
  }
  return { name: 'home' };
}
