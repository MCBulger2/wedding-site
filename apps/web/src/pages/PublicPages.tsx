import { generateIcs } from '@matt-alison-wedding/shared';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Gift,
  Heart,
  Hotel,
  KeyRound,
  MapPin,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx, scoped } from '../classNames.js';
import { ResponsiveImage } from '../components/ResponsiveImage.js';
import { getNativeMapUrl } from '../nativeMapUrl.js';
import { siteContent } from '../siteContent.js';
import styles from './PublicPages.module.css';

const PHOTO_WHEEL_SCROLL_THRESHOLD = 90;
const PHOTO_WHEEL_NAVIGATION_INTERVAL_MS = 450;

export function HomePage() {
  const calendarHref = useMemo(() => {
    const ics = generateIcs(siteContent.weddingEvent);
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);
  const venueMapHref = getNativeMapUrl({
    googleMapsUrl: siteContent.venueMapUrl,
    appleMapsUrl: siteContent.venueAppleMapsUrl,
  });
  const publicHotels = siteContent.hotels.filter(
    (hotel) => hotel.publiclyShareable,
  );

  return (
    <main>
      <section className={scoped(styles, 'hero')}>
        <div className={scoped(styles, 'hero-copy')}>
          <p className="eyebrow">Wedding Announcement</p>
          <h1>{siteContent.coupleNames}</h1>
          <p className={scoped(styles, 'hero-lede')}>
            {siteContent.announcement}
          </p>
          <div
            className={scoped(styles, 'hero-facts')}
            aria-label="Wedding highlights"
          >
            <span>
              <CalendarDays aria-hidden="true" />
              {siteContent.dateLabel}
            </span>
            <span>
              <MapPin aria-hidden="true" />
              {siteContent.location}
            </span>
          </div>
          <div className="hero-actions">
            <a className="icon-button" href="/rsvp">
              <KeyRound aria-hidden="true" />
              Find your RSVP
            </a>
            <a className="secondary-button" href="/#details">
              Wedding details
            </a>
          </div>
        </div>
      </section>

      <PhotoCarousel photos={siteContent.photos} />

      <section id="details" className={scoped(styles, 'section-grid')}>
        <div>
          <p className="eyebrow">Itinerary</p>
          <h2>Wedding day</h2>
          <div className={scoped(styles, 'timeline')}>
            {siteContent.schedule.map((item) => (
              <div key={item.time}>
                <strong>{item.time}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">Venue</p>
          <h2>{siteContent.venueName}</h2>
          <ul className={scoped(styles, 'plain-list')}>
            <li>
              <MapPin aria-hidden="true" />
              <a
                className={scoped(styles, 'venue-address-link')}
                href={venueMapHref}
                target="_blank"
                rel="noreferrer"
              >
                {siteContent.venueAddress}
              </a>
            </li>
            <li>
              <Clock aria-hidden="true" />
              Ceremony at {siteContent.ceremonyTime}; reception at{' '}
              {siteContent.receptionTime}
            </li>
            <li>
              <Heart aria-hidden="true" />
              {siteContent.dressCode}
            </li>
          </ul>
          <div className={scoped(styles, 'venue-map-frame')}>
            <iframe
              title={`${siteContent.venueName} map`}
              src={siteContent.venueMapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <div
            className={cx('hero-actions', scoped(styles, 'compact-actions'))}
          >
            <a
              className="icon-button"
              href={venueMapHref}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" />
              Open map
            </a>
            <a
              className="secondary-button"
              href={calendarHref}
              download="matt-alison-wedding.ics"
            >
              <CalendarDays aria-hidden="true" />
              Add to calendar
            </a>
          </div>
        </div>
      </section>

      <section
        id="travel"
        className={cx(
          scoped(styles, 'section-grid'),
          scoped(styles, 'travel-section'),
          publicHotels.length === 0 &&
            scoped(styles, 'travel-section-without-hotels'),
        )}
      >
        <div>
          <p className="eyebrow">Travel</p>
          <h2>Getting there</h2>
          <ul className={scoped(styles, 'plain-list')}>
            {siteContent.travel.map((item) => (
              <li key={item}>
                <Hotel aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        {publicHotels.length > 0 && (
          <div>
            <p className="eyebrow">Hotel block</p>
            <h2>Where to stay</h2>
            <div className={scoped(styles, 'hotel-list')}>
              {publicHotels.map((hotel) => (
                <article
                  key={hotel.name}
                  className={scoped(styles, 'hotel-card')}
                >
                  <h3>{hotel.name}</h3>
                  <p>{hotel.address}</p>
                  <dl>
                    {hotel.groupCode && (
                      <>
                        <dt>Group code</dt>
                        <dd>{hotel.groupCode}</dd>
                      </>
                    )}
                    {hotel.cutoffDate && (
                      <>
                        <dt>Book by</dt>
                        <dd>{hotel.cutoffDate}</dd>
                      </>
                    )}
                    {hotel.nightlyRateNotes && (
                      <>
                        <dt>Rate notes</dt>
                        <dd>{hotel.nightlyRateNotes}</dd>
                      </>
                    )}
                    {hotel.transportationNotes && (
                      <>
                        <dt>Transportation</dt>
                        <dd>{hotel.transportationNotes}</dd>
                      </>
                    )}
                  </dl>
                  <div className="toolbar-actions">
                    {hotel.bookingUrl && (
                      <a
                        className="icon-button button-inline"
                        href={hotel.bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink aria-hidden="true" />
                        Book hotel
                      </a>
                    )}
                    {hotel.phoneNumber && (
                      <span className={scoped(styles, 'phone-note')}>
                        {hotel.phoneNumber}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="registry" className={scoped(styles, 'registry-section')}>
        <div className={scoped(styles, 'registry-callout')}>
          <div>
            <p className="eyebrow">Registry</p>
            <h2>{siteContent.registry.title}</h2>
            <p className="page-lede">{siteContent.registry.intro}</p>
          </div>
          <a className="icon-button button-inline" href="/registry">
            <Gift aria-hidden="true" />
            View registry
          </a>
        </div>
      </section>

      <section id="faq" className={scoped(styles, 'faq-section')}>
        <p className="eyebrow">FAQ</p>
        <h2>Guest notes</h2>
        <div className={scoped(styles, 'faq-grid')}>
          {siteContent.faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>
                {faq.answer}
                {faq.link && (
                  <>
                    {' '}
                    <a
                      className={scoped(styles, 'faq-link')}
                      href={faq.link.href}
                    >
                      {faq.link.label}
                    </a>
                    .
                  </>
                )}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function RegistryPage() {
  const { registry } = siteContent;
  const hasRegistryLinks = registry.links.length > 0;

  return (
    <main className={cx('narrow-page', scoped(styles, 'registry-page'))}>
      <section className={scoped(styles, 'registry-hero-card')}>
        <div className={scoped(styles, 'registry-icon')} aria-hidden="true">
          <Gift />
        </div>
        <p className="eyebrow">Registry</p>
        <h1>{registry.title}</h1>
        <p className="page-lede">{registry.intro}</p>
        <p className="form-message">
          <i>{registry.note}</i>
        </p>
      </section>

      {hasRegistryLinks ? (
        <section
          className={scoped(styles, 'registry-list')}
          aria-label="Registry links"
        >
          {registry.links.map((link) => (
            <article
              className={cx(
                scoped(styles, 'registry-card'),
                link.image && scoped(styles, 'registry-card-with-image'),
              )}
              key={link.name}
            >
              {link.image && (
                <div className={scoped(styles, 'registry-card-media')}>
                  <ResponsiveImage
                    src={link.image.src}
                    alt={link.image.alt}
                    loading="lazy"
                    sizes="(min-width: 980px) 220px, 100vw"
                    decoding="async"
                    objectPosition={link.image.objectPosition}
                  />
                </div>
              )}
              <div className={scoped(styles, 'registry-card-body')}>
                <h2>{link.name}</h2>
                <p>{link.description}</p>
              </div>
              <div className={scoped(styles, 'registry-card-action')}>
                <a
                  className="icon-button button-inline"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" />
                  {link.linkLabel}
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={scoped(styles, 'registry-empty-card')}>
          <h2>{registry.comingSoonTitle}</h2>
          <p>{registry.comingSoonMessage}</p>
          <a className="secondary-button button-inline" href="/">
            Back to wedding details
          </a>
        </section>
      )}
    </main>
  );
}

export function OurStoryPage() {
  const { ourStory } = siteContent;
  const [meetSection, proposalSection, loveSection, futureSection] =
    ourStory.sections;

  return (
    <main className={scoped(styles, 'our-story-page')}>
      <section
        className={scoped(styles, 'our-story-hero')}
        aria-labelledby="our-story-heading"
      >
        <div className={scoped(styles, 'our-story-hero-copy')}>
          <h1 id="our-story-heading">{ourStory.title}</h1>
          <span className={scoped(styles, 'story-rule')} aria-hidden="true" />
          <p className="page-lede">{ourStory.intro}</p>
        </div>
        <figure className={scoped(styles, 'our-story-hero-image')}>
          <ResponsiveImage
            src={ourStory.heroImage.src}
            alt={ourStory.heroImage.alt}
            sizes="(min-width: 900px) 56vw, 100vw"
            objectPosition={ourStory.heroImage.objectPosition}
          />
        </figure>
      </section>

      <section
        className={cx(
          scoped(styles, 'story-section'),
          scoped(styles, 'story-section-meet'),
        )}
      >
        {meetSection?.image && (
          <figure className={scoped(styles, 'story-thumbnail')}>
            <ResponsiveImage
              src={meetSection.image.src}
              alt={meetSection.image.alt}
              decoding="async"
              sizes="(min-width: 760px) 180px, 100vw"
              objectPosition={meetSection.image.objectPosition}
            />
          </figure>
        )}
        <StoryText title={meetSection?.title} body={meetSection?.body} />
      </section>

      <section
        className={cx(
          scoped(styles, 'story-section'),
          scoped(styles, 'story-section-proposal'),
        )}
      >
        <StoryText
          title={proposalSection?.title}
          body={proposalSection?.body}
        />
        {proposalSection?.image && (
          <figure className={scoped(styles, 'story-landscape')}>
            <ResponsiveImage
              src={proposalSection.image.src}
              alt={proposalSection.image.alt}
              decoding="async"
              sizes="(min-width: 900px) 44vw, 100vw"
              objectPosition={proposalSection.image.objectPosition}
            />
          </figure>
        )}
      </section>

      <section
        className={cx(
          scoped(styles, 'story-section'),
          scoped(styles, 'story-section-duo'),
        )}
      >
        <StoryText title={loveSection?.title} body={loveSection?.body} />
        <StoryText title={futureSection?.title} body={futureSection?.body} />
      </section>

      <section
        className={scoped(styles, 'story-cta-band')}
        aria-label="Our story next steps"
      >
        <a className="secondary-button button-inline" href="/#details">
          {ourStory.ctas.detailsLabel}
          <ArrowRight aria-hidden="true" />
        </a>
        <a className="icon-button button-inline" href="/rsvp">
          {ourStory.ctas.rsvpLabel}
          <ArrowRight aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <main className={cx('narrow-page', scoped(styles, 'policy-page'))}>
      <section className="lookup-card">
        <p className="eyebrow">Privacy Policy</p>
        <h1>Privacy</h1>
        <div className={scoped(styles, 'policy-copy')}>
          <p>
            Matt &amp; Alison Wedding uses the contact details you provide through
            an RSVP to manage responses, share wedding logistics, and help
            guests recover private RSVP links.
          </p>
          <p>
            We do not sell guest information. An exact-last-name search can
            return a household RSVP URL. That URL contains the bearer credential
            and grants access to the household RSVP, so it should be treated as
            private. Anyone with the URL may be able to view or update that
            household's RSVP.
          </p>
          <p>Matt &amp; Alison Wedding is operated by sole proprietor Matthew Bulger. Contact: contact@matt-alison.com.</p>
        </div>
      </section>
    </main>
  );
}

export function TermsPage() {
  return (
    <main className={cx('narrow-page', scoped(styles, 'policy-page'))}>
      <section className="lookup-card">
        <p className="eyebrow">Terms</p>
        <h1>Terms</h1>
        <div className={scoped(styles, 'policy-copy')}>
          <p>
            This website and its private RSVP flow are provided for invited
            guests to review wedding details and submit or update responses.
          </p>
          <p>Matt &amp; Alison Wedding is operated by sole proprietor Matthew Bulger. Contact: contact@matt-alison.com.</p>
        </div>
      </section>
    </main>
  );
}

function StoryText({ title, body }: { title?: string; body?: string }) {
  if (!title || !body) {
    return null;
  }

  return (
    <article className={scoped(styles, 'story-copy-block')}>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}

function PhotoCarousel({ photos }: { photos: typeof siteContent.photos }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiplePhotos = photos.length > 1;
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const programmaticScrollTargetRef = useRef<number | undefined>(undefined);
  const wheelScrollRef = useRef({ deltaX: 0, lastNavigationAt: 0 });
  const activePhoto = photos[activeIndex];

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  const syncActivePhoto = () => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const slideWidth = scroller.clientWidth;
    if (slideWidth <= 0) {
      return;
    }

    const nextIndex = Math.min(
      photos.length - 1,
      Math.max(0, Math.round(scroller.scrollLeft / slideWidth)),
    );
    const programmaticScrollTarget = programmaticScrollTargetRef.current;
    if (
      programmaticScrollTarget !== undefined &&
      nextIndex !== programmaticScrollTarget
    ) {
      return;
    }
    programmaticScrollTargetRef.current = undefined;
    setActiveIndex(nextIndex);
  };

  const handlePhotoScroll = () => {
    if (scrollFrameRef.current !== undefined) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = undefined;
      syncActivePhoto();
    });
  };

  const showPhoto = (index: number) => {
    const nextIndex = (index + photos.length) % photos.length;
    const slide = trackRef.current?.children.item(nextIndex) as
      HTMLElement | null | undefined;

    programmaticScrollTargetRef.current = nextIndex;
    setActiveIndex(nextIndex);
    slide?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  };

  const advancePhoto = (offset: number) => {
    showPhoto(activeIndex + offset);
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();

      const scroll = wheelScrollRef.current;
      const deltaDirection = Math.sign(e.deltaX);
      const currentDirection = Math.sign(scroll.deltaX);
      scroll.deltaX =
        currentDirection !== 0 && deltaDirection !== currentDirection
          ? e.deltaX
          : scroll.deltaX + e.deltaX;

      if (Math.abs(scroll.deltaX) < PHOTO_WHEEL_SCROLL_THRESHOLD) return;

      const now = Date.now();
      if (now - scroll.lastNavigationAt < PHOTO_WHEEL_NAVIGATION_INTERVAL_MS) {
        scroll.deltaX = Math.sign(scroll.deltaX) * PHOTO_WHEEL_SCROLL_THRESHOLD;
        return;
      }

      scroll.lastNavigationAt = now;
      const shouldScrollNext = scroll.deltaX > 0;
      scroll.deltaX = 0;

      if (shouldScrollNext) {
        advancePhoto(1);
      } else {
        advancePhoto(-1);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeIndex]);

  if (!activePhoto) {
    return null;
  }

  return (
    <section
      className={scoped(styles, 'photo-section')}
      aria-labelledby="photo-carousel-heading"
    >
      <div className={scoped(styles, 'photo-section-copy')}>
        <p className="eyebrow">Photos</p>
        <h2 id="photo-carousel-heading">A few favorite moments</h2>
        <p className="page-lede">
          A growing gallery for engagement and wedding-weekend photos, with more
          memories to add as the celebration gets closer.
        </p>
        <a className="secondary-button button-inline" href="/our-story">
          Read our story
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
      <div
        ref={carouselRef}
        className={scoped(styles, 'photo-carousel')}
        aria-roledescription="carousel"
        aria-label="Matt and Alison photos"
      >
        <div className={scoped(styles, 'photo-frame-shell')}>
          <div
            ref={scrollerRef}
            className={scoped(styles, 'photo-frame')}
            data-testid="photo-carousel-scroller"
            onScroll={handlePhotoScroll}
          >
            <div ref={trackRef} className={scoped(styles, 'photo-track')}>
              {photos.map((photo, index) => (
                <figure
                  className={scoped(styles, 'photo-slide')}
                  aria-hidden={index === activeIndex ? 'false' : 'true'}
                  key={`${photo.src}-${photo.caption}`}
                >
                  <ResponsiveImage
                    src={photo.src}
                    alt={photo.alt}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    sizes="(min-width: 980px) 58vw, 100vw"
                    objectPosition={photo.objectPosition}
                  />
                </figure>
              ))}
            </div>
          </div>
          {hasMultiplePhotos && (
            <div
              className={scoped(styles, 'photo-controls')}
              aria-label="Photo controls"
            >
              <button
                type="button"
                className={scoped(styles, 'photo-nav-button')}
                aria-label="Show previous photo"
                onClick={() => advancePhoto(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className={scoped(styles, 'photo-nav-button')}
                aria-label="Show next photo"
                onClick={() => advancePhoto(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <div className={scoped(styles, 'photo-caption-row')}>
          <p aria-live="polite">
            <strong>{activePhoto.caption}</strong>
            {activePhoto.detail && <span>{activePhoto.detail}</span>}
          </p>
          {hasMultiplePhotos && (
            <div
              className={scoped(styles, 'photo-dots')}
              aria-label="Choose a photo"
            >
              {photos.map((photo, index) => (
                <button
                  type="button"
                  aria-label={`Show photo ${index + 1}: ${photo.caption}`}
                  aria-current={index === activeIndex ? 'true' : 'false'}
                  className={scoped(styles, 'photo-dot')}
                  key={`${photo.caption}-dot`}
                  onClick={() => showPhoto(index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
