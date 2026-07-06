import { lazy, Suspense, useMemo } from 'react';
import { Header, SiteFooter } from './components/SiteLayout.js';
import {
  HomePage,
  OurStoryPage,
  PrivacyPage,
  RegistryPage,
  SmsOptInProofPage,
  TermsPage,
} from './pages/PublicPages.js';

const AdminPage = lazy(() =>
  import('./pages/AdminPage.js').then((module) => ({
    default: module.AdminPage,
  })),
);
const RsvpLookupPage = lazy(() =>
  import('./pages/RsvpPages.js').then((module) => ({
    default: module.RsvpLookupPage,
  })),
);
const RsvpPage = lazy(() =>
  import('./pages/RsvpPages.js').then((module) => ({
    default: module.RsvpPage,
  })),
);
const RsvpSuccessPage = lazy(() =>
  import('./pages/RsvpPages.js').then((module) => ({
    default: module.RsvpSuccessPage,
  })),
);

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
      <Header activeRoute={route.name} />
      {route.name === 'home' && <HomePage />}
      {route.name === 'our_story' && <OurStoryPage />}
      {route.name === 'privacy' && <PrivacyPage />}
      {route.name === 'registry' && <RegistryPage />}
      {route.name === 'rsvp_entry' && (
        <Suspense fallback={<main className="page-shell">Loading...</main>}>
          <RsvpLookupPage />
        </Suspense>
      )}
      {route.name === 'rsvp' && (
        <Suspense fallback={<main className="page-shell">Loading...</main>}>
          <RsvpPage inviteCode={route.inviteCode} />
        </Suspense>
      )}
      {route.name === 'rsvp_success' && (
        <Suspense fallback={<main className="page-shell">Loading...</main>}>
          <RsvpSuccessPage inviteCode={route.inviteCode} />
        </Suspense>
      )}
      {route.name === 'sms_opt_in_proof' && <SmsOptInProofPage />}
      {route.name === 'terms' && <TermsPage />}
      {route.name === 'admin' && (
        <Suspense fallback={<main className="page-shell">Loading...</main>}>
          <AdminPage />
        </Suspense>
      )}
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
