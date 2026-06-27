import { generateIcs } from '@matt-alison-wedding/shared';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Gift, Hotel, KeyRound, MapPin, Heart } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { siteContent } from '../siteContent.js';

export function HomePage() {
  const calendarHref = useMemo(() => {
    const ics = generateIcs(siteContent.weddingEvent);
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);
  const venueMapHref = getNativeMapUrl();

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Wedding Announcement</p>
          <h1>{siteContent.coupleNames}</h1>
          <p className="hero-lede">{siteContent.announcement}</p>
          <div className="hero-facts" aria-label="Wedding highlights">
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

      <section id="details" className="section-grid">
        <div>
          <p className="eyebrow">Itinerary</p>
          <h2>Wedding day</h2>
          <div className="timeline">
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
          <ul className="plain-list">
            <li>
              <MapPin aria-hidden="true" />
              <a
                className="venue-address-link"
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
          <div className="venue-map-frame">
            <iframe
              title={`${siteContent.venueName} map`}
              src={siteContent.venueMapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="hero-actions compact-actions">
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

      <section id="travel" className="section-grid travel-section">
        <div>
          <p className="eyebrow">Travel</p>
          <h2>Getting there</h2>
          <ul className="plain-list">
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
          <div className="hotel-list">
            {siteContent.hotels
              .filter((hotel) => hotel.publiclyShareable)
              .map((hotel) => (
                <article key={hotel.name} className="hotel-card">
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
                      <span className="phone-note">{hotel.phoneNumber}</span>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      </section>

      <section id="registry" className="registry-section">
        <div className="registry-callout">
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

      <section id="faq" className="faq-section">
        <p className="eyebrow">FAQ</p>
        <h2>Guest notes</h2>
        <div className="faq-grid">
          {siteContent.faqs.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function getNativeMapUrl(): string {
  if (typeof navigator === 'undefined') {
    return siteContent.venueMapUrl;
  }

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const isAppleDevice =
    /mac|iphone|ipad|ipod/.test(platform) ||
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === 'macintel' && navigator.maxTouchPoints > 1);

  return isAppleDevice ? siteContent.venueAppleMapsUrl : siteContent.venueMapUrl;
}

export function RegistryPage() {
  const { registry } = siteContent;
  const hasRegistryLinks = registry.links.length > 0;

  return (
    <main className="narrow-page registry-page">
      <section className="registry-hero-card">
        <div className="registry-icon" aria-hidden="true">
          <Gift />
        </div>
        <p className="eyebrow">Registry</p>
        <h1>{registry.title}</h1>
        <p className="page-lede">{registry.intro}</p>
        <p className="form-message">{registry.note}</p>
      </section>

      {hasRegistryLinks ? (
        <section className="registry-list" aria-label="Registry links">
          {registry.links.map((link) => (
            <article className="registry-card" key={link.name}>
              <div>
                <h2>{link.name}</h2>
                <p>{link.description}</p>
              </div>
              <a
                className="icon-button button-inline"
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink aria-hidden="true" />
                {link.linkLabel}
              </a>
            </article>
          ))}
        </section>
      ) : (
        <section className="registry-empty-card">
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

function PhotoCarousel({ photos }: { photos: typeof siteContent.photos }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiplePhotos = photos.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: hasMultiplePhotos,
  });
  const carouselRef = useRef<HTMLDivElement>(null);
  const lastWheelTimeRef = useRef(0);
  const activePhoto = photos[activeIndex];
  const syncActivePhoto = useCallback(() => {
    if (!emblaApi) {
      return;
    }

    setActiveIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return undefined;
    }

    syncActivePhoto();
    emblaApi.on('select', syncActivePhoto);
    emblaApi.on('reInit', syncActivePhoto);

    return () => {
      emblaApi.off('select', syncActivePhoto);
      emblaApi.off('reInit', syncActivePhoto);
    };
  }, [emblaApi, syncActivePhoto]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !emblaApi) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();

      const now = Date.now();
      if (now - lastWheelTimeRef.current < 300) return;
      lastWheelTimeRef.current = now;

      if (e.deltaX > 0) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollPrev();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [emblaApi]);

  if (!activePhoto) {
    return null;
  }

  const showPhoto = (index: number) => {
    const nextIndex = (index + photos.length) % photos.length;
    setActiveIndex(nextIndex);
    emblaApi?.scrollTo(nextIndex);
  };
  const advancePhoto = (offset: number) => {
    if (!emblaApi) {
      showPhoto(activeIndex + offset);
      return;
    }

    if (offset > 0) {
      emblaApi.scrollNext();
    } else {
      emblaApi.scrollPrev();
    }
  };

  return (
    <section className="photo-section" aria-labelledby="photo-carousel-heading">
      <div className="photo-section-copy">
        <p className="eyebrow">Photos</p>
        <h2 id="photo-carousel-heading">A few favorite moments</h2>
        <p className="page-lede">
          A growing gallery for engagement and wedding-weekend photos, with more memories to add as the celebration gets
          closer.
        </p>
      </div>
      <div ref={carouselRef} className="photo-carousel" aria-roledescription="carousel" aria-label="Matt and Alison photos">
        <div ref={emblaRef} className="photo-frame">
          <div className="photo-track">
            {photos.map((photo, index) => (
              <figure
                className="photo-slide"
                aria-hidden={index === activeIndex ? 'false' : 'true'}
                key={`${photo.src}-${photo.caption}`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  style={{ objectPosition: photo.objectPosition }}
                />
              </figure>
            ))}
          </div>
          {hasMultiplePhotos && (
            <div className="photo-controls" aria-label="Photo controls">
              <button type="button" className="photo-nav-button" aria-label="Show previous photo" onClick={() => advancePhoto(-1)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="photo-nav-button" aria-label="Show next photo" onClick={() => advancePhoto(1)}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <div className="photo-caption-row">
          <p aria-live="polite">
            <strong>{activePhoto.caption}</strong>
            {activePhoto.detail && <span>{activePhoto.detail}</span>}
          </p>
          {hasMultiplePhotos && (
            <div className="photo-dots" aria-label="Choose a photo">
              {photos.map((photo, index) => (
                <button
                  type="button"
                  aria-label={`Show photo ${index + 1}: ${photo.caption}`}
                  aria-current={index === activeIndex ? 'true' : 'false'}
                  className="photo-dot"
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
