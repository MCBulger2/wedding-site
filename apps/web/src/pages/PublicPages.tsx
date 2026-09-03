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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx, scoped } from '../classNames.js';
import { ResponsiveImage } from '../components/ResponsiveImage.js';
import { getNativeMapUrl } from '../nativeMapUrl.js';
import { siteContent } from '../siteContent.js';
import styles from './PublicPages.module.css';

const PHOTO_WHEEL_SCROLL_THRESHOLD = 90;
const PHOTO_WHEEL_NAVIGATION_INTERVAL_MS = 450;
const PHOTO_CONTROLS_FOCUS_DURATION_MS = 500;
const PHOTO_SCROLL_SETTLE_DELAY_MS = 120;

export function HomePage() {
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

      <section
        className={scoped(styles, 'photo-section')}
        aria-labelledby="photo-carousel-heading"
      >
        <div className={scoped(styles, 'photo-section-copy')}>
          <p className="eyebrow">Photos</p>
          <h2 id="photo-carousel-heading">A few favorite moments</h2>
          <p className="page-lede">
            A growing gallery for engagement and wedding-weekend photos, with
            more memories to add as the celebration gets closer.
          </p>
          <a className="secondary-button button-inline" href="/our-story">
            Read our story
            <ArrowRight aria-hidden="true" />
          </a>
        </div>
        <PhotoCarousel
          ariaLabel="Matt and Alison photos"
          photos={siteContent.photos}
        />
      </section>

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
              Ceremony at {siteContent.ceremonyTime}; reception to follow
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
              href="/matt-alison-wedding.ics"
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
        <div>
          <p className="eyebrow">Hotel block</p>
          <h2>Where to stay</h2>
          {publicHotels.length > 0 ? (
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
          ) : (
            <p className="page-lede">
              We’re still finalizing our hotel block—check back soon for
              updates. We’ll share the details here as soon as they’re ready.
            </p>
          )}
        </div>
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

      {ourStory.chapters.map((chapter, index) => (
        <StoryChapterSection
          chapter={chapter}
          key={chapter.id}
          reverse={index % 2 === 1}
        />
      ))}

      <PhoenixGuideSection guide={ourStory.phoenixGuide} />

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

function PhoenixGuideSection({
  guide,
}: {
  guide: typeof siteContent.ourStory.phoenixGuide;
}) {
  return (
    <section
      className={scoped(styles, 'phoenix-guide')}
      aria-labelledby="phoenix-guide-heading"
    >
      <div className={scoped(styles, 'phoenix-guide-heading')}>
        <p className="eyebrow">While you're here</p>
        <h2 id="phoenix-guide-heading">{guide.title}</h2>
        <p>{guide.intro}</p>
      </div>
      <div className={scoped(styles, 'phoenix-guide-groups')}>
        {guide.groups.map((group) => (
          <section
            className={scoped(styles, `phoenix-guide-group-${group.id}`)}
            key={group.id}
            aria-labelledby={`phoenix-guide-${group.id}`}
          >
            <h3 id={`phoenix-guide-${group.id}`}>{group.title}</h3>
            <div className={scoped(styles, 'phoenix-recommendations')}>
              {group.recommendations.map((recommendation) => (
                <article
                  className={scoped(styles, 'phoenix-recommendation')}
                  key={recommendation.id}
                >
                  {recommendation.backgroundImage && (
                    <div
                      aria-hidden="true"
                      className={scoped(styles, 'phoenix-recommendation-image')}
                    >
                      <ResponsiveImage
                        alt=""
                        sizes="(min-width: 900px) 40vw, 100vw"
                        src={recommendation.backgroundImage}
                      />
                    </div>
                  )}
                  <div
                    className={scoped(styles, 'phoenix-recommendation-content')}
                  >
                    <h4>{recommendation.title}</h4>
                    <p>{recommendation.description}</p>
                    <div className={scoped(styles, 'phoenix-map-links')}>
                      {recommendation.destinations.map((destination) => (
                        <a
                          aria-label={`${recommendation.actionLabel}: ${destination.label}`}
                          href={getNativeMapUrl(destination)}
                          key={destination.label}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <MapPin aria-hidden="true" />
                          {recommendation.destinations.length > 1
                            ? destination.label
                            : recommendation.actionLabel}
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className={scoped(styles, 'phoenix-hiking-note')}>
        {guide.hikingNote}
      </p>
    </section>
  );
}

function StoryChapterSection({
  chapter,
  reverse,
}: {
  chapter: (typeof siteContent.ourStory.chapters)[number];
  reverse: boolean;
}) {
  const useCarousel = chapter.id === 'asu' || chapter.id === 'life-together';

  return (
    <section
      className={cx(
        scoped(styles, 'story-chapter'),
        reverse && scoped(styles, 'story-chapter-reverse'),
        scoped(styles, `story-chapter-${chapter.id}`),
      )}
      aria-labelledby={`story-${chapter.id}`}
    >
      <div className={scoped(styles, 'story-chapter-media')}>
        {useCarousel ? (
          <PhotoCarousel
            ariaLabel={`${chapter.title} photos`}
            className={scoped(styles, 'story-chapter-carousel')}
            photos={chapter.images}
          />
        ) : (
          chapter.images.map((image) => (
            <figure
              className={scoped(styles, 'story-chapter-image')}
              key={image.src}
            >
              <ResponsiveImage
                alt={image.alt}
                decoding="async"
                objectPosition={image.objectPosition}
                sizes="(min-width: 900px) 48vw, 100vw"
                src={image.src}
                style={{ objectFit: image.objectFit ?? 'cover' }}
              />
            </figure>
          ))
        )}
      </div>
      <div className={scoped(styles, 'story-copy-block')}>
        <h2 id={`story-${chapter.id}`}>{chapter.title}</h2>
        {chapter.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
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
            Matt &amp; Alison Wedding uses the contact details you provide
            through an RSVP to manage responses, share wedding logistics, and
            help guests recover private RSVP links.
          </p>
          <p>
            We do not sell guest information. An exact-last-name search can
            return a household RSVP URL. That URL contains the bearer credential
            and grants access to the household RSVP, so it should be treated as
            private. Anyone with the URL may be able to view or update that
            household's RSVP.
          </p>
          <p>
            Matt &amp; Alison Wedding is operated by sole proprietor Matthew
            Bulger. Contact: contact@matt-alison.com.
          </p>
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
          <p>
            Matt &amp; Alison Wedding is operated by sole proprietor Matthew
            Bulger. Contact: contact@matt-alison.com.
          </p>
        </div>
      </section>
    </main>
  );
}

type CarouselPhoto = {
  src: string;
  alt: string;
  caption?: string;
  detail?: string;
  objectPosition?: string;
  objectFit?: 'cover' | 'contain';
};

function PhotoCarousel({
  ariaLabel,
  className,
  photos,
}: {
  ariaLabel: string;
  className?: string;
  photos: readonly CarouselPhoto[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiplePhotos = photos.length > 1;
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const scrollSettleTimerRef = useRef<number | undefined>(undefined);
  const programmaticScrollTargetRef = useRef<number | undefined>(undefined);
  const wheelScrollRef = useRef({ deltaX: 0, lastNavigationAt: 0 });
  const activePhoto = photos[activeIndex];
  const carouselPhotos = hasMultiplePhotos
    ? [photos[photos.length - 1], ...photos, photos[0]]
    : photos;

  const resetToSlide = (slideIndex: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.style.scrollBehavior = 'auto';
    scroller.scrollLeft = scroller.clientWidth * slideIndex;
    window.requestAnimationFrame(() =>
      scroller.style.removeProperty('scroll-behavior'),
    );
  };

  useLayoutEffect(() => {
    if (hasMultiplePhotos) resetToSlide(1);
  }, [hasMultiplePhotos, photos.length]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== undefined) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (scrollSettleTimerRef.current !== undefined) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
    },
    [],
  );

  const syncActivePhoto = (settled = false) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const slideWidth = scroller.clientWidth;
    if (slideWidth <= 0) {
      return;
    }

    const slideIndex = Math.round(scroller.scrollLeft / slideWidth);
    const isBoundaryClone =
      hasMultiplePhotos && (slideIndex === 0 || slideIndex === photos.length + 1);
    if (isBoundaryClone) {
      if (!settled) return;

      if (slideIndex === 0) {
        setActiveIndex(photos.length - 1);
        resetToSlide(photos.length);
      } else {
        setActiveIndex(0);
        resetToSlide(1);
      }
      return;
    }

    const nextIndex = Math.min(
      photos.length - 1,
      Math.max(0, hasMultiplePhotos ? slideIndex - 1 : slideIndex),
    );
    const programmaticScrollTarget = programmaticScrollTargetRef.current;
    if (
      programmaticScrollTarget !== undefined &&
      slideIndex !== programmaticScrollTarget &&
      !settled
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
    if (scrollSettleTimerRef.current !== undefined) {
      window.clearTimeout(scrollSettleTimerRef.current);
    }
    scrollSettleTimerRef.current = window.setTimeout(() => {
      scrollSettleTimerRef.current = undefined;
      syncActivePhoto(true);
    }, PHOTO_SCROLL_SETTLE_DELAY_MS);
  };

  const handlePhotoScrollEnd = () => {
    if (scrollSettleTimerRef.current !== undefined) {
      window.clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = undefined;
    }
    syncActivePhoto(true);
  };

  const showPhoto = (index: number) => {
    const nextIndex = (index + photos.length) % photos.length;
    const targetSlideIndex = hasMultiplePhotos
      ? index < 0
        ? 0
        : index >= photos.length
          ? photos.length + 1
          : nextIndex + 1
      : nextIndex;
    const slide = trackRef.current?.children.item(targetSlideIndex) as
      HTMLElement | null | undefined;

    programmaticScrollTargetRef.current = targetSlideIndex;
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

  const dismissPhotoControlFocus = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (event.detail === 0) return;
    const button = event.currentTarget;
    window.setTimeout(() => button.blur(), PHOTO_CONTROLS_FOCUS_DURATION_MS);
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
    <div
      ref={carouselRef}
      className={cx(scoped(styles, 'photo-carousel'), className)}
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      <div className={scoped(styles, 'photo-frame-shell')}>
        <div
          ref={scrollerRef}
          className={scoped(styles, 'photo-frame')}
          data-testid="photo-carousel-scroller"
          onScroll={handlePhotoScroll}
          onScrollEnd={handlePhotoScrollEnd}
        >
          <div ref={trackRef} className={scoped(styles, 'photo-track')}>
            {carouselPhotos.map((photo, index) => {
              const photoIndex = hasMultiplePhotos
                ? (index - 1 + photos.length) % photos.length
                : index;
              const isDuplicate =
                hasMultiplePhotos &&
                (index === 0 || index === carouselPhotos.length - 1);

              return (
                <figure
                  className={scoped(styles, 'photo-slide')}
                  aria-hidden={isDuplicate || photoIndex !== activeIndex ? 'true' : 'false'}
                  key={`${index}-${photo.src}-${photo.caption ?? photo.alt}`}
                >
                  <ResponsiveImage
                    src={photo.src}
                    alt={photo.alt}
                    loading={photoIndex === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    sizes="(min-width: 980px) 58vw, 100vw"
                    objectPosition={photo.objectPosition}
                    style={{ objectFit: photo.objectFit ?? 'cover' }}
                  />
                </figure>
              );
            })}
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
              onClick={(event) => {
                advancePhoto(-1);
                dismissPhotoControlFocus(event);
              }}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className={scoped(styles, 'photo-nav-button')}
              aria-label="Show next photo"
              onClick={(event) => {
                advancePhoto(1);
                dismissPhotoControlFocus(event);
              }}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {(hasMultiplePhotos || activePhoto.caption || activePhoto.detail) && (
        <div className={scoped(styles, 'photo-caption-row')}>
          {hasMultiplePhotos && (
            <div className={scoped(styles, 'photo-pagination')}>
              <span
                className={scoped(styles, 'photo-position')}
                role="status"
                aria-atomic="true"
                aria-label="Photo position"
                aria-live="polite"
              >
                {activeIndex + 1} of {photos.length}
              </span>
              <div
                className={scoped(styles, 'photo-progress')}
                aria-hidden="true"
              >
                {photos.map((photo, index) => (
                  <span
                    className={scoped(styles, 'photo-progress-segment')}
                    data-active={index === activeIndex ? 'true' : undefined}
                    key={photo.src}
                  />
                ))}
              </div>
            </div>
          )}
          {(activePhoto.caption || activePhoto.detail) && (
            <p>
              {activePhoto.caption && <strong>{activePhoto.caption}</strong>}
              {activePhoto.detail && <span>{activePhoto.detail}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
