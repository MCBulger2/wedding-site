import { lazy, Suspense, useEffect, useMemo } from 'react';
import { RouteLoadingFallback } from './components/LoadingStates.js';
import { Header, SiteFooter } from './components/SiteLayout.js';
import {
  HomePage,
  OurStoryPage,
  PrivacyPage,
  RegistryPage,
  SmsUpdatesPage,
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
const RsvpSmsUpdatesPage = lazy(() =>
  import('./pages/RsvpPages.js').then((module) => ({
    default: module.RsvpSmsUpdatesPage,
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
  | { name: 'rsvp_sms_updates'; inviteCode: string }
  | { name: 'sms_updates' }
  | { name: 'sms_opt_in_redirect' }
  | { name: 'terms' }
  | { name: 'admin' };

export function App() {
  const route = useMemo(() => parseRoute(window.location.pathname), []);

  useEffect(() => {
    let targetId: string;
    try {
      targetId = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }

    if (!targetId) {
      return;
    }

    const animationFrames = new Set<number>();
    const deferredScrolls = new Set<number>();
    let cancelledByUser = false;
    const scrollToTarget = () => {
      if (cancelledByUser) {
        return;
      }
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
    };
    const clearPendingCorrections = () => {
      for (const timeoutId of deferredScrolls) {
        window.clearTimeout(timeoutId);
      }
      deferredScrolls.clear();
      if (typeof window.cancelAnimationFrame === 'function') {
        for (const frameId of animationFrames) {
          window.cancelAnimationFrame(frameId);
        }
      }
      animationFrames.clear();
    };
    const cancelForUserIntent = () => {
      cancelledByUser = true;
      clearPendingCorrections();
    };
    const cancelForNavigationKey = (event: KeyboardEvent) => {
      if (
        [
          'ArrowDown',
          'ArrowUp',
          'End',
          'Home',
          'PageDown',
          'PageUp',
          ' ',
          'Spacebar',
        ].includes(event.key)
      ) {
        cancelForUserIntent();
      }
    };
    const synchronizeHashScroll = () => {
      if (cancelledByUser) {
        return;
      }
      scrollToTarget();
      if (typeof window.requestAnimationFrame === 'function') {
        animationFrames.add(window.requestAnimationFrame(scrollToTarget));
      }
      deferredScrolls.add(window.setTimeout(scrollToTarget, 450));
    };

    window.addEventListener('keydown', cancelForNavigationKey);
    window.addEventListener('pointerdown', cancelForUserIntent, {
      passive: true,
    });
    window.addEventListener('touchstart', cancelForUserIntent, {
      passive: true,
    });
    window.addEventListener('wheel', cancelForUserIntent, { passive: true });
    synchronizeHashScroll();
    window.addEventListener('pageshow', synchronizeHashScroll);

    return () => {
      window.removeEventListener('keydown', cancelForNavigationKey);
      window.removeEventListener('pageshow', synchronizeHashScroll);
      window.removeEventListener('pointerdown', cancelForUserIntent);
      window.removeEventListener('touchstart', cancelForUserIntent);
      window.removeEventListener('wheel', cancelForUserIntent);
      clearPendingCorrections();
    };
  }, [route]);

  return (
    <div className="app-shell">
      <Header activeRoute={route.name === 'rsvp_sms_updates' ? 'rsvp' : route.name} />
      {route.name === 'home' && <HomePage />}
      {route.name === 'our_story' && <OurStoryPage />}
      {route.name === 'privacy' && <PrivacyPage />}
      {route.name === 'registry' && <RegistryPage />}
      {route.name === 'rsvp_entry' && (
        <Suspense fallback={<RouteLoadingFallback />}>
          <RsvpLookupPage />
        </Suspense>
      )}
      {route.name === 'rsvp' && (
        <Suspense fallback={<RouteLoadingFallback />}>
          <RsvpPage inviteCode={route.inviteCode} />
        </Suspense>
      )}
      {route.name === 'rsvp_success' && (
        <Suspense fallback={<RouteLoadingFallback />}>
          <RsvpSuccessPage inviteCode={route.inviteCode} />
        </Suspense>
      )}
      {route.name === 'rsvp_sms_updates' && (
        <Suspense fallback={<RouteLoadingFallback />}>
          <RsvpSmsUpdatesPage inviteCode={route.inviteCode} />
        </Suspense>
      )}
      {route.name === 'sms_updates' && <SmsUpdatesPage />}
      {route.name === 'sms_opt_in_redirect' && <LegacySmsOptInRedirect />}
      {route.name === 'terms' && <TermsPage />}
      {route.name === 'admin' && (
        <Suspense fallback={<RouteLoadingFallback />}>
          <AdminPage />
        </Suspense>
      )}
      <SiteFooter showAdminLink={route.name !== 'admin'} />
    </div>
  );
}

export function parseRoute(pathname: string): Route {
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
  if (pathname.startsWith('/rsvp/') && pathname.endsWith('/sms-updates')) {
    return {
      name: 'rsvp_sms_updates',
      inviteCode: decodeURIComponent(
        pathname.slice('/rsvp/'.length, -'/sms-updates'.length),
      ),
    };
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
  if (pathname === '/sms-updates') {
    return { name: 'sms_updates' };
  }
  if (pathname === '/sms-opt-in-proof') {
    return { name: 'sms_opt_in_redirect' };
  }
  if (pathname === '/terms') {
    return { name: 'terms' };
  }
  return { name: 'home' };
}

export function LegacySmsOptInRedirect({
  replace = (path: string) => window.location.replace(path),
}: {
  replace?: (path: string) => void;
}) {
  useEffect(() => {
    replace('/sms-updates');
  }, [replace]);

  return null;
}
