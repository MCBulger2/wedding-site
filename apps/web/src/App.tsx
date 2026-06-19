import {
  generateIcs,
  RsvpUpdateSchema,
  type AdminHouseholdRecord,
  type CreateHouseholdInput,
  type Household,
  type StoredRsvp,
} from '@matt-alison-wedding/shared';
import {
  Archive,
  CalendarDays,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Heart,
  Hotel,
  Image,
  KeyRound,
  Mail,
  MapPin,
  Plus,
  Search,
  Send,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from 'react';
import {
  beginAdminLogin,
  beginAdminLogout,
  clearAdminSession,
  completeAdminLogin,
  getAdminProfileName,
  loadAdminSession,
  type AdminAuthConfig,
  type AdminSession,
} from './adminAuth.js';
import {
  ApiError,
  archiveHousehold,
  createHousehold,
  downloadInvitationsCsv,
  downloadRsvpsCsv,
  fetchAdminAuthConfig,
  fetchHouseholds,
  fetchRsvp,
  removeHouseholdMember,
  rotateInviteCode,
  saveRsvp,
  updateHousehold,
  updateHouseholdMember,
  updateInviteLifecycleStatus,
  type RsvpPayload,
} from './api.js';
import { siteContent } from './siteContent.js';

type Route =
  | { name: 'home' }
  | { name: 'rsvp_entry' }
  | { name: 'rsvp'; inviteCode: string }
  | { name: 'rsvp_success'; inviteCode: string }
  | { name: 'admin' };

type RsvpFieldErrorMap = Record<string, string>;

interface HouseholdFormState {
  displayName: string;
  email: string;
  maxPlusOnes: string;
  mailingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  members: Array<{
    id?: string;
    firstName: string;
    lastName: string;
    canBringPlusOne: boolean;
    weddingPartyRole: string;
    rehearsalDinnerInvited: boolean;
  }>;
}

interface InviteCodeNotice {
  householdId: string;
  displayName: string;
  inviteCode: string;
}

interface RevealedInvite {
  householdId: string;
  displayName: string;
  inviteCode: string;
}

export function App() {
  const route = useMemo(() => parseRoute(window.location.pathname), []);

  return (
    <div>
      <Header />
      {route.name === 'home' && <HomePage />}
      {route.name === 'rsvp_entry' && <RsvpLookupPage />}
      {route.name === 'rsvp' && <RsvpPage inviteCode={route.inviteCode} />}
      {route.name === 'rsvp_success' && <RsvpSuccessPage inviteCode={route.inviteCode} />}
      {route.name === 'admin' && <AdminPage />}
      <SiteFooter showAdminLink={route.name !== 'admin'} />
    </div>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a href="/" className="brand" aria-label="Matt and Alison wedding homepage">
        <Heart aria-hidden="true" />
        <span>Matt & Alison</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/#details">Details</a>
        <a href="/rsvp">RSVP</a>
      </nav>
    </header>
  );
}

function SiteFooter({ showAdminLink }: { showAdminLink: boolean }) {
  return (
    <footer className="site-footer">
      <span>{siteContent.coupleNames} · {siteContent.dateLabel}</span>
      {showAdminLink && (
        <a className="footer-admin-link" href="/admin">
          Admin
        </a>
      )}
    </footer>
  );
}

function HomePage() {
  const calendarHref = useMemo(() => {
    const ics = generateIcs(siteContent.weddingEvent);
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);

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
              {siteContent.venueAddress}
            </li>
            <li>
              <Clock aria-hidden="true" />
              Ceremony at {siteContent.ceremonyTime}; reception at {siteContent.receptionTime}
            </li>
            <li>
              <Heart aria-hidden="true" />
              {siteContent.dressCode}
            </li>
          </ul>
          <div className="hero-actions compact-actions">
            <a className="icon-button" href={siteContent.venueMapUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Open map
            </a>
            <a className="secondary-button" href={calendarHref} download="matt-alison-wedding.ics">
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
                      <a className="icon-button button-inline" href={hotel.bookingUrl} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden="true" />
                        Book hotel
                      </a>
                    )}
                    {hotel.phoneNumber && <span className="phone-note">{hotel.phoneNumber}</span>}
                  </div>
                </article>
              ))}
          </div>
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

function RsvpLookupPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = inviteCode.trim();
    if (!normalized) {
      return;
    }
    setStatus('submitting');
    window.location.assign(`/rsvp/${encodeURIComponent(normalized)}`);
  };

  return (
    <main className="narrow-page">
      <section className="lookup-card">
        <p className="eyebrow">Private RSVP</p>
        <h1>Enter your invitation code</h1>
        <p className="page-lede">
          Your mailed invitation includes a private RSVP code. Enter it here to view or update your household&apos;s
          response.
        </p>
        <form className="lookup-form" onSubmit={submit}>
          <label>
            Invitation code
            <input
              aria-label="Invitation code"
              autoCapitalize="off"
              autoCorrect="off"
              autoFocus
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </label>
          <button type="submit" disabled={status === 'submitting'}>
            <Search aria-hidden="true" />
            {status === 'submitting' ? 'Opening RSVP...' : 'View RSVP'}
          </button>
        </form>
        {status === 'submitting' && (
          <div className="inline-loading-shell">
            <LoadingPulse label="Opening your RSVP" message="Following your invitation link and loading your household details." compact />
          </div>
        )}
      </section>
    </main>
  );
}

function RsvpPage({ inviteCode }: { inviteCode: string }) {
  const [household, setHousehold] = useState<Household | undefined>();
  const [form, setForm] = useState<RsvpPayload | undefined>();
  const [savedRsvp, setSavedRsvp] = useState<StoredRsvp | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RsvpFieldErrorMap>({});
  const calendarHref = useMemo(() => {
    const ics = generateIcs(siteContent.weddingEvent);
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);

  useEffect(() => {
    fetchRsvp(inviteCode)
      .then((response) => {
        setHousehold(response.household);
        setSavedRsvp(response.rsvp);
        setForm(toEditableRsvp(response.household, response.rsvp));
        setFieldErrors({});
        setMessage('');
        setStatus('ready');
      })
      .catch((error: Error) => {
        setMessage(error.message);
        setStatus('error');
      });
  }, [inviteCode]);

  if (status === 'loading') {
    return (
      <main className="narrow-page">
        <LoadingScreen
          eyebrow="Private RSVP"
          title="Loading your RSVP"
          message="Pulling in your household details and latest response."
        />
      </main>
    );
  }

  if (status === 'error' || !household || !form) {
    return (
      <main className="narrow-page">
        <section className="lookup-card">
          <h1>RSVP unavailable</h1>
          <p>{message || 'Please check your invitation link.'}</p>
          <a className="icon-button" href="/rsvp">
            <Search aria-hidden="true" />
            Try another code
          </a>
        </section>
      </main>
    );
  }

  const eligibleSponsors = household.members.filter((member) => {
    const memberRsvp = form.members.find((item) => item.memberId === member.id);
    return member.canBringPlusOne && memberRsvp?.attending;
  });
  const canAddPlusOne = eligibleSponsors.length > 0 && form.plusOnes.length < household.maxPlusOnes;

  const fieldError = (path: string) => fieldErrors[path];
  const clearFieldError = (path: string) => {
    setFieldErrors((current) => {
      if (!(path in current)) {
        return current;
      }

      const next = { ...current };
      delete next[path];
      return next;
    });
  };
  const clearFormMessage = () => {
    setMessage('');
  };
  const clearValidationState = () => {
    setFieldErrors({});
    clearFormMessage();
  };

  const updateMember = (memberId: string, updates: Partial<RsvpPayload['members'][number]>) => {
    clearFormMessage();
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextMembers = current.members.map((member) => (member.memberId === memberId ? { ...member, ...updates } : member));
      const nextPlusOnes =
        updates.attending === false
          ? current.plusOnes.filter((plusOne) => plusOne.sponsorMemberId !== memberId)
          : current.plusOnes;

      return {
        ...current,
        members: nextMembers,
        plusOnes: nextPlusOnes,
      };
    });
  };

  const updatePlusOne = (index: number, updates: Partial<RsvpPayload['plusOnes'][number]>) => {
    clearFormMessage();
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        plusOnes: current.plusOnes.map((plusOne, plusOneIndex) =>
          plusOneIndex === index ? { ...plusOne, ...updates } : plusOne,
        ),
      };
    });
  };

  const addPlusOne = () => {
    if (!canAddPlusOne) {
      return;
    }

    clearValidationState();
    setForm((current) => {
      if (!current) {
        return current;
      }

      const defaultSponsor = eligibleSponsors[0];
      if (!defaultSponsor) {
        return current;
      }

      return {
        ...current,
        plusOnes: [
          ...current.plusOnes,
          {
            sponsorMemberId: defaultSponsor.id,
            firstName: '',
            lastName: '',
            mealChoice: 'buffet',
            dietaryNotes: '',
          },
        ],
      };
    });
  };

  const removePlusOne = (index: number) => {
    clearValidationState();
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        plusOnes: current.plusOnes.filter((_, plusOneIndex) => plusOneIndex !== index),
      };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const validation = validateRsvpForm(household, form);
    if (validation) {
      setFieldErrors(validation.fieldErrors);
      setMessage(validation.formMessage);
      return;
    }

    setStatus('saving');
    setFieldErrors({});
    setMessage('');
    try {
      const response = await saveRsvp(inviteCode, form);
      if (!response.rsvp) {
        throw new Error('The RSVP response was incomplete.');
      }

      window.location.assign(buildGuestRsvpSuccessPath(inviteCode));
    } catch (error) {
      setStatus('ready');
      if (error instanceof ApiError) {
        const parsedError = parseRsvpApiError(error);
        setFieldErrors(parsedError.fieldErrors);
        setMessage(parsedError.formMessage);
        return;
      }

      setMessage(error instanceof Error ? error.message : 'Unable to save RSVP');
    }
  };

  return (
    <main className="narrow-page">
      <p className="eyebrow">Private RSVP</p>
      <h1>{household.displayName}</h1>
      <p className="page-lede">
        Respond for everyone listed below. Your invitation includes {household.members.length} household guest
        {household.members.length === 1 ? '' : 's'} and up to {household.maxPlusOnes} plus-one
        {household.maxPlusOnes === 1 ? '' : 's'}.
      </p>
      {savedRsvp && (
        <div className="confirmation-row">
          <p className="form-message">
            Submitted {formatDateTime(savedRsvp.submittedAt)}. Last updated {formatDateTime(savedRsvp.updatedAt)}.
          </p>
          <a className="secondary-button button-inline" href={calendarHref} download="matt-alison-wedding.ics">
            <CalendarDays aria-hidden="true" />
            Add to calendar
          </a>
        </div>
      )}
      <form className="rsvp-form" onSubmit={submit}>
        {status === 'saving' && (
          <div className="inline-loading-shell" aria-live="polite">
            <LoadingPulse label="Saving your RSVP" message="Updating your response and refreshing your confirmation." compact />
          </div>
        )}
        {household.members.map((member, memberIndex) => {
          const memberRsvp = form.members.find((item) => item.memberId === member.id)!;
          const fullName = `${member.firstName} ${member.lastName}`;
          return (
            <fieldset key={member.id}>
              <legend>{fullName}</legend>
              <label className="checkbox-row">
                <input
                  aria-label={`${fullName} attending`}
                  type="checkbox"
                  checked={memberRsvp.attending}
                  onChange={(event) =>
                    updateMember(member.id, {
                      attending: event.target.checked,
                      mealChoice: event.target.checked ? 'buffet' : 'none',
                    })
                  }
                />
                Attending
              </label>
              <label className={fieldError(`members.${memberIndex}.dietaryNotes`) ? 'field-error' : undefined}>
                Dietary notes
                <input
                  aria-label={`${fullName} dietary notes`}
                  aria-describedby={fieldError(`members.${memberIndex}.dietaryNotes`) ? buildFieldErrorId(`members.${memberIndex}.dietaryNotes`) : undefined}
                  aria-invalid={fieldError(`members.${memberIndex}.dietaryNotes`) ? 'true' : 'false'}
                  maxLength={500}
                  value={memberRsvp.dietaryNotes}
                  onChange={(event) => {
                    clearFieldError(`members.${memberIndex}.dietaryNotes`);
                    updateMember(member.id, { dietaryNotes: event.target.value });
                  }}
                />
                <FieldError path={`members.${memberIndex}.dietaryNotes`} errors={fieldErrors} />
              </label>
            </fieldset>
          );
        })}

        {household.maxPlusOnes > 0 && (
          <section className="subsection-card">
            <div className="section-heading">
              <div>
                <h2>Plus-ones</h2>
                <p className="form-message">
                  Add up to {household.maxPlusOnes} guest{household.maxPlusOnes === 1 ? '' : 's'} for attending
                  household members who are allowed a plus-one.
                </p>
              </div>
              <button type="button" className="secondary-button button-inline" onClick={addPlusOne} disabled={!canAddPlusOne}>
                <Plus aria-hidden="true" />
                Add plus-one
              </button>
            </div>
            {!canAddPlusOne && form.plusOnes.length === 0 && (
              <p className="form-message">A guest can be added once an eligible household member is marked as attending.</p>
            )}
            {form.plusOnes.map((plusOne, index) => (
              <fieldset key={`${plusOne.sponsorMemberId}-${index}`}>
                <legend>Plus-one {index + 1}</legend>
                <div className="split-fields">
                  <label className={fieldError(`plusOnes.${index}.firstName`) ? 'field-error' : undefined}>
                    First name
                    <input
                      aria-label={`Plus-one ${index + 1} first name`}
                      aria-describedby={fieldError(`plusOnes.${index}.firstName`) ? buildFieldErrorId(`plusOnes.${index}.firstName`) : undefined}
                      aria-invalid={fieldError(`plusOnes.${index}.firstName`) ? 'true' : 'false'}
                      maxLength={80}
                      value={plusOne.firstName}
                      onChange={(event) => {
                        clearFieldError(`plusOnes.${index}.firstName`);
                        updatePlusOne(index, { firstName: event.target.value });
                      }}
                    />
                    <FieldError path={`plusOnes.${index}.firstName`} errors={fieldErrors} />
                  </label>
                  <label className={fieldError(`plusOnes.${index}.lastName`) ? 'field-error' : undefined}>
                    Last name
                    <input
                      aria-label={`Plus-one ${index + 1} last name`}
                      aria-describedby={fieldError(`plusOnes.${index}.lastName`) ? buildFieldErrorId(`plusOnes.${index}.lastName`) : undefined}
                      aria-invalid={fieldError(`plusOnes.${index}.lastName`) ? 'true' : 'false'}
                      maxLength={80}
                      value={plusOne.lastName}
                      onChange={(event) => {
                        clearFieldError(`plusOnes.${index}.lastName`);
                        updatePlusOne(index, { lastName: event.target.value });
                      }}
                    />
                    <FieldError path={`plusOnes.${index}.lastName`} errors={fieldErrors} />
                  </label>
                </div>
                <label className={fieldError(`plusOnes.${index}.sponsorMemberId`) ? 'field-error' : undefined}>
                  Sponsored by
                  <select
                    aria-label={`Plus-one ${index + 1} sponsor`}
                    aria-describedby={fieldError(`plusOnes.${index}.sponsorMemberId`) ? buildFieldErrorId(`plusOnes.${index}.sponsorMemberId`) : undefined}
                    aria-invalid={fieldError(`plusOnes.${index}.sponsorMemberId`) ? 'true' : 'false'}
                    value={plusOne.sponsorMemberId}
                    onChange={(event) => {
                      clearFieldError(`plusOnes.${index}.sponsorMemberId`);
                      updatePlusOne(index, { sponsorMemberId: event.target.value });
                    }}
                  >
                    {eligibleSponsors.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </select>
                  <FieldError path={`plusOnes.${index}.sponsorMemberId`} errors={fieldErrors} />
                </label>
                <label className={fieldError(`plusOnes.${index}.dietaryNotes`) ? 'field-error' : undefined}>
                  Dietary notes
                  <input
                    aria-label={`Plus-one ${index + 1} dietary notes`}
                    aria-describedby={fieldError(`plusOnes.${index}.dietaryNotes`) ? buildFieldErrorId(`plusOnes.${index}.dietaryNotes`) : undefined}
                    aria-invalid={fieldError(`plusOnes.${index}.dietaryNotes`) ? 'true' : 'false'}
                    maxLength={500}
                    value={plusOne.dietaryNotes}
                    onChange={(event) => {
                      clearFieldError(`plusOnes.${index}.dietaryNotes`);
                      updatePlusOne(index, { dietaryNotes: event.target.value });
                    }}
                  />
                  <FieldError path={`plusOnes.${index}.dietaryNotes`} errors={fieldErrors} />
                </label>
                <button type="button" className="secondary-button button-inline danger-button" onClick={() => removePlusOne(index)}>
                  <Trash2 aria-hidden="true" />
                  Remove plus-one
                </button>
              </fieldset>
            ))}
          </section>
        )}

        <label className={fieldError('notes') ? 'field-error' : undefined}>
          Household notes
          <textarea
            aria-describedby={fieldError('notes') ? buildFieldErrorId('notes') : undefined}
            aria-invalid={fieldError('notes') ? 'true' : 'false'}
            maxLength={1000}
            value={form.notes}
            onChange={(event) => {
              clearFieldError('notes');
              clearFormMessage();
              setForm({ ...form, notes: event.target.value });
            }}
          />
          <FieldError path="notes" errors={fieldErrors} />
        </label>
        <label className={fieldError('accessibilityNotes') ? 'field-error' : undefined}>
          Accessibility notes
          <textarea
            aria-describedby={fieldError('accessibilityNotes') ? buildFieldErrorId('accessibilityNotes') : undefined}
            aria-invalid={fieldError('accessibilityNotes') ? 'true' : 'false'}
            maxLength={1000}
            value={form.accessibilityNotes}
            onChange={(event) => {
              clearFieldError('accessibilityNotes');
              clearFormMessage();
              setForm({ ...form, accessibilityNotes: event.target.value });
            }}
          />
          <FieldError path="accessibilityNotes" errors={fieldErrors} />
        </label>
        <button type="submit" disabled={status === 'saving'}>
          <Heart aria-hidden="true" />
          {status === 'saving' ? 'Saving...' : 'Save RSVP'}
        </button>
        {message && (
          <p className={`form-message ${Object.keys(fieldErrors).length > 0 ? 'error-message' : ''}`}>
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

function RsvpSuccessPage({ inviteCode }: { inviteCode: string }) {
  const [household, setHousehold] = useState<Household | undefined>();
  const [savedRsvp, setSavedRsvp] = useState<StoredRsvp | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const calendarHref = useMemo(() => {
    const ics = generateIcs(siteContent.weddingEvent);
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);

  useEffect(() => {
    fetchRsvp(inviteCode)
      .then((response) => {
        setHousehold(response.household);
        setSavedRsvp(response.rsvp);

        if (!response.rsvp) {
          setMessage('No RSVP has been submitted for this invitation yet.');
          setStatus('empty');
          return;
        }

        setStatus('ready');
      })
      .catch((error: Error) => {
        setMessage(error.message);
        setStatus('error');
      });
  }, [inviteCode]);

  if (status === 'loading') {
    return (
      <main className="narrow-page">
        <LoadingScreen
          eyebrow="Private RSVP"
          title="Loading your confirmation"
          message="Pulling in your latest response and confirmation details."
        />
      </main>
    );
  }

  if (status === 'error' || !household) {
    return (
      <main className="narrow-page">
        <section className="lookup-card">
          <h1>RSVP unavailable</h1>
          <p>{message || 'Please check your invitation link.'}</p>
          <div className="hero-actions compact-actions">
            <a className="icon-button" href="/rsvp">
              <Search aria-hidden="true" />
              Find your RSVP
            </a>
            <a className="secondary-button" href="/">
              Back home
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (status === 'empty' || !savedRsvp) {
    return (
      <main className="narrow-page">
        <section className="lookup-card success-card">
          <p className="eyebrow">Private RSVP</p>
          <h1>No RSVP on file yet</h1>
          <p className="page-lede">{message}</p>
          <div className="hero-actions compact-actions">
            <a className="icon-button" href={buildGuestRsvpPath(inviteCode)}>
              <Heart aria-hidden="true" />
              Complete RSVP
            </a>
            <a className="secondary-button" href="/">
              Back home
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="narrow-page">
      <section className="lookup-card success-card">
        <p className="eyebrow">Private RSVP</p>
        <h1>RSVP received</h1>
        <p className="page-lede">
          Thanks, {household.displayName}. Your response was submitted {formatDateTime(savedRsvp.submittedAt)} and last
          updated {formatDateTime(savedRsvp.updatedAt)}.
        </p>
        <div className="confirmation-row">
          <p className="form-message">Need to make a change? You can reopen your invitation link and save again.</p>
          <a className="secondary-button button-inline" href={calendarHref} download="matt-alison-wedding.ics">
            <CalendarDays aria-hidden="true" />
            Add to calendar
          </a>
        </div>
        <div className="hero-actions compact-actions">
          <a className="icon-button" href={buildGuestRsvpPath(inviteCode)}>
            <Heart aria-hidden="true" />
            Review or update RSVP
          </a>
          <a className="secondary-button" href="/">
            Back home
          </a>
        </div>
      </section>
    </main>
  );
}

function AdminPage() {
  const [authConfig, setAuthConfig] = useState<AdminAuthConfig | undefined>();
  const [session, setSession] = useState<AdminSession | undefined>();
  const [authStatus, setAuthStatus] = useState<'loading' | 'signed_out' | 'signing_in' | 'ready' | 'error'>('loading');
  const [householdLoadStatus, setHouseholdLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [households, setHouseholds] = useState<AdminHouseholdRecord[]>([]);
  const [message, setMessage] = useState('Loading admin authentication...');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Household['rsvpStatus']>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<HouseholdFormState>(emptyHouseholdForm());
  const [latestInvite, setLatestInvite] = useState<InviteCodeNotice | undefined>();
  const [revealedInvites, setRevealedInvites] = useState<Record<string, RevealedInvite>>(() => loadRevealedInvites());
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | undefined>();
  const [editForm, setEditForm] = useState<HouseholdFormState>(emptyHouseholdForm());
  const [showCreateHouseholdModal, setShowCreateHouseholdModal] = useState(false);
  const [qrModalInvite, setQrModalInvite] = useState<RevealedInvite | undefined>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [qrCodeStatus, setQrCodeStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = async (token = session?.accessToken) => {
    if (!token) {
      setAuthStatus('signed_out');
      setHouseholdLoadStatus('idle');
      setMessage('Sign in to view and manage RSVP data.');
      return;
    }

    setHouseholdLoadStatus('loading');
    try {
      const response = await fetchHouseholds(token);
      setHouseholds(response.households);
      setAuthStatus('ready');
      setHouseholdLoadStatus('ready');
      setMessage(`${response.households.length} households loaded.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'Unable to load households';
      if (/unauthorized|forbidden|jwt|token/i.test(nextMessage)) {
        clearAdminSession();
        setSession(undefined);
        setAuthStatus('signed_out');
        setHouseholdLoadStatus('idle');
        setMessage('Your admin session expired. Please sign in again.');
        return;
      }

      setHouseholdLoadStatus('error');
      setMessage(nextMessage);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        const config = await fetchAdminAuthConfig();
        if (cancelled) {
          return;
        }

        setAuthConfig(config);

        const callbackSession = await completeAdminLogin(config, window.location);
        const storedSession = callbackSession ?? loadAdminSession();
        if (cancelled) {
          return;
        }

        if (!storedSession) {
          setAuthStatus('signed_out');
          setMessage('Sign in to manage RSVPs.');
          return;
        }

        setSession(storedSession);
        setAuthStatus(callbackSession ? 'signing_in' : 'ready');
        setMessage(callbackSession ? 'Signing you in...' : 'Loading households...');
        await load(storedSession.accessToken);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAuthStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unable to initialize admin authentication.');
      }
    };

    void initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const submitHousehold = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      if (!session) {
        throw new Error('Sign in before creating households.');
      }

      const createResponse = await createHousehold(session.accessToken, toCreateHouseholdInput(form));
      const inviteResponse = await rotateInviteCode(session.accessToken, createResponse.household.householdId);
      const revealedInvite = {
        householdId: createResponse.household.householdId,
        displayName: createResponse.household.displayName,
        inviteCode: inviteResponse.inviteCode,
      };
      setLatestInvite(revealedInvite);
      persistRevealedInvite(revealedInvite, setRevealedInvites);
      setForm(emptyHouseholdForm());
      setShowCreateHouseholdModal(false);
      await load();
      setMessage(`Created ${createResponse.household.displayName} and generated an invite code.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create household');
    } finally {
      setCreating(false);
    }
  };

  const handleRotateInviteCode = async (record: AdminHouseholdRecord) => {
    try {
      if (!session) {
        throw new Error('Sign in before rotating invite codes.');
      }
      if (record.household.inviteLifecycleStatus === 'sent') {
        setMessage('Sent invitations cannot be rotated from the dashboard.');
        return;
      }
      const confirmRotation =
        record.household.inviteLifecycleStatus === 'exported'
          ? window.confirm('This household was already exported. Rotating will invalidate that printed RSVP URL. Continue?')
          : false;
      if (record.household.inviteLifecycleStatus === 'exported' && !confirmRotation) {
        return;
      }

      const response = await rotateInviteCode(session.accessToken, record.household.householdId, confirmRotation);
      const revealedInvite = {
        householdId: record.household.householdId,
        displayName: record.household.displayName,
        inviteCode: response.inviteCode,
      };
      setLatestInvite(revealedInvite);
      persistRevealedInvite(revealedInvite, setRevealedInvites);
      await load();
      setMessage(`Generated a new invite code for ${record.household.displayName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to rotate invite code');
    }
  };

  const handleExport = async (kind: 'rsvps' | 'invitations') => {
    try {
      if (!session) {
        throw new Error('Sign in before exporting data.');
      }

      const blob = kind === 'rsvps' ? await downloadRsvpsCsv(session.accessToken) : await downloadInvitationsCsv(session.accessToken);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = kind === 'rsvps' ? 'rsvps.csv' : 'invitations.csv';
      anchor.click();
      window.URL.revokeObjectURL(url);
      if (kind === 'invitations') {
        await load();
        setMessage('Exported invitation mailing data. Review the CSV before printing.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to export data');
    }
  };

  const beginEditHousehold = (household: Household) => {
    setEditingHouseholdId(household.householdId);
    setEditForm(toHouseholdFormState(household));
  };

  const saveHouseholdEdit = async (householdId: string) => {
    try {
      if (!session) {
        throw new Error('Sign in before editing households.');
      }
      await updateHousehold(session.accessToken, householdId, toUpdateHouseholdInput(editForm));
      for (const member of editForm.members) {
        if (member.id) {
          await updateHouseholdMember(session.accessToken, householdId, member.id, {
            firstName: member.firstName,
            lastName: member.lastName,
            canBringPlusOne: member.canBringPlusOne,
            weddingPartyRole: member.weddingPartyRole,
            rehearsalDinnerInvited: member.rehearsalDinnerInvited,
          });
        }
      }
      setEditingHouseholdId(undefined);
      await load();
      setMessage('Household changes saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save household changes');
    }
  };

  const handleRemoveMember = async (record: AdminHouseholdRecord, memberId: string) => {
    try {
      if (!session) {
        throw new Error('Sign in before editing households.');
      }
      const hasRsvp = record.rsvp?.members.some((member) => member.memberId === memberId);
      if (hasRsvp && !window.confirm('This member has RSVP history. Removing will archive them instead of deleting them. Continue?')) {
        return;
      }
      await removeHouseholdMember(session.accessToken, record.household.householdId, memberId);
      await load();
      setMessage('Household member removed or archived.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove member');
    }
  };

  const handleArchiveHousehold = async (record: AdminHouseholdRecord) => {
    try {
      if (!session) {
        throw new Error('Sign in before archiving households.');
      }
      if (isHouseholdArchived(record.household)) {
        throw new Error(`${record.household.displayName} is already archived.`);
      }
      const risky = record.household.inviteCodeHash || record.rsvp;
      if (risky && !window.confirm('This household has invite or RSVP history. Archiving keeps history but removes guest RSVP access. Continue?')) {
        return;
      }
      await archiveHousehold(session.accessToken, record.household.householdId);
      await load();
      setMessage(`Archived ${record.household.displayName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to archive household');
    }
  };

  const markInviteStatus = async (record: AdminHouseholdRecord, status: 'exported' | 'sent') => {
    try {
      if (!session) {
        throw new Error('Sign in before updating invitation status.');
      }
      await updateInviteLifecycleStatus(session.accessToken, record.household.householdId, status);
      await load();
      setMessage(`${record.household.displayName} marked ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update invitation status');
    }
  };

  const openQrCodeModal = async (invite: RevealedInvite) => {
    await openQrCodeModalForInvite(invite, setQrModalInvite, setQrCodeDataUrl, setQrCodeStatus);
  };

  const visibleHouseholds = households.filter((record) => {
    const matchesArchived = showArchived || !isHouseholdArchived(record.household);
    const matchesStatus = statusFilter === 'all' || record.household.rsvpStatus === statusFilter;
    const matchesSearch =
      search.trim().length === 0 ||
      [record.household.displayName, record.household.email ?? '', ...record.household.members.map(formatMemberName)]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    return matchesArchived && matchesStatus && matchesSearch;
  });

  const totals = visibleHouseholds.reduce(
    (summary, record) => {
      summary.households += 1;
      summary.invitedGuests += record.attendance.invitedGuests;
      summary.attendingGuests += record.attendance.attendingGuests;
      summary.pendingGuests += record.attendance.pendingGuests;
      return summary;
    },
    { households: 0, invitedGuests: 0, attendingGuests: 0, pendingGuests: 0 },
  );

  const profileName = getAdminProfileName(session);
  const isHouseholdsLoading = householdLoadStatus === 'loading' && households.length === 0;
  const isHouseholdsRefreshing = householdLoadStatus === 'loading' && households.length > 0;

  if (authStatus === 'loading' || authStatus === 'signing_in') {
    return (
      <main className="admin-page">
        <LoadingScreen eyebrow="Admin" title="Preparing sign-in" message={message} />
      </main>
    );
  }

  if (authStatus === 'error' || authStatus === 'signed_out' || !authConfig || !session) {
    return (
      <main className="admin-page">
        <section className="admin-login-shell" aria-labelledby="admin-login-title">
          <div className="admin-login-intro">
            <p className="eyebrow">Admin dashboard</p>
            <h1 id="admin-login-title">Admin sign in</h1>
            <p className="page-lede">Manage RSVPs, households, and invitations.</p>
          </div>
          <section className="admin-login-card" aria-label="Admin sign in">
            <div className="admin-login-card-header">
              <span className="admin-login-icon">
                <KeyRound aria-hidden="true" />
              </span>
              <div>
                <h2>Welcome back</h2>
                <p className="form-message">{message}</p>
              </div>
            </div>
            {authConfig ? (
              <button type="button" className="icon-button admin-login-button" onClick={() => void beginAdminLogin(authConfig)}>
                <KeyRound aria-hidden="true" />
                Sign in
              </button>
            ) : (
              <button type="button" className="secondary-button admin-login-button" disabled>
                <KeyRound aria-hidden="true" />
                Sign-in unavailable
              </button>
            )}
            <p className="admin-login-note">You will return here after signing in.</p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>RSVP dashboard</h1>
          {profileName && <p className="form-message">Signed in as {profileName}</p>}
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setForm(emptyHouseholdForm());
              setShowCreateHouseholdModal(true);
            }}
          >
            <Users aria-hidden="true" />
            Create household
          </button>
          <button type="button" className="icon-button" onClick={() => void handleExport('invitations')}>
            <Download aria-hidden="true" />
            Export invitations
          </button>
          <button type="button" className="secondary-button" onClick={() => void handleExport('rsvps')}>
            <Download aria-hidden="true" />
            Export CSV
          </button>
          <button type="button" className="secondary-button" onClick={() => beginAdminLogout(authConfig)}>
            <ShieldCheck aria-hidden="true" />
            Sign out
          </button>
        </div>
      </section>

      <p className="form-message">{message}</p>

      {showCreateHouseholdModal && (
        <Modal title="Create household" onClose={() => setShowCreateHouseholdModal(false)}>
          <HouseholdForm
            form={form}
            setForm={setForm}
            creating={creating}
            onSubmit={submitHousehold}
            onCancel={() => setShowCreateHouseholdModal(false)}
          />
        </Modal>
      )}

      {qrModalInvite && (
        <Modal
          title={`${qrModalInvite.displayName} invitation QR`}
          onClose={() => {
            setQrModalInvite(undefined);
            setQrCodeDataUrl(undefined);
            setQrCodeStatus('idle');
          }}
        >
          <div className="qr-modal-content">
            <p className="form-message">Guests can scan this code or use the RSVP link below.</p>
            {qrCodeStatus === 'loading' && (
              <div className="inline-loading-shell qr-loading-shell" aria-live="polite">
                <LoadingPulse label="Generating QR code" message="Preparing a scannable invitation link." compact />
              </div>
            )}
            {qrCodeStatus === 'error' && <p className="warning-message">Unable to generate the QR code right now.</p>}
            {qrCodeDataUrl && <img className="qr-code-image" src={qrCodeDataUrl} alt={`QR code for ${qrModalInvite.displayName}`} />}
            <a href={buildGuestRsvpUrl(qrModalInvite.inviteCode)} target="_blank" rel="noreferrer">
              {buildGuestRsvpPath(qrModalInvite.inviteCode)}
            </a>
          </div>
        </Modal>
      )}

      {latestInvite && (
        <section className="callout-card">
          <p className="eyebrow">Invite code</p>
          <h2>{latestInvite.displayName}</h2>
          <p className="page-lede">
            This code is only shown now. Share the direct link or print it on the mailed invitation.
          </p>
          <div className="invite-code-box">
            <strong>{latestInvite.inviteCode}</strong>
            <a href={buildGuestRsvpUrl(latestInvite.inviteCode)} target="_blank" rel="noreferrer">
              {buildGuestRsvpPath(latestInvite.inviteCode)}
            </a>
          </div>
        </section>
      )}

      <section className="admin-grid">
        <section className="subsection-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Results</p>
              <h2>View responses</h2>
            </div>
          </div>
          <div className="stats-grid">
            {isHouseholdsLoading ? (
              <>
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
              </>
            ) : (
              <>
                <article>
                  <strong>{totals.households}</strong>
                  <span>Households</span>
                </article>
                <article>
                  <strong>{totals.invitedGuests}</strong>
                  <span>Invited spots</span>
                </article>
                <article>
                  <strong>{totals.attendingGuests}</strong>
                  <span>Attending</span>
                </article>
                <article>
                  <strong>{totals.pendingGuests}</strong>
                  <span>Pending</span>
                </article>
              </>
            )}
          </div>
          <div className="filter-grid">
            <label>
              Search
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Household or guest" />
            </label>
            <label>
              Status
              <select
                aria-label="RSVP status filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="not_started">Not started</option>
                <option value="attending">Attending</option>
                <option value="partial">Partial</option>
                <option value="declined">Declined</option>
              </select>
            </label>
            <label className="checkbox-row filter-toggle">
              <input
                aria-label="Show archived households"
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived households
            </label>
          </div>

          <div className="results-list" aria-label="Households">
            {isHouseholdsRefreshing && (
              <div className="inline-loading-shell dashboard-refresh" aria-live="polite">
                <LoadingPulse label="Refreshing dashboard" message="Updating household and RSVP data." compact />
              </div>
            )}
            {isHouseholdsLoading && <AdminDashboardSkeleton />}
            {!isHouseholdsLoading && visibleHouseholds.length === 0 && <p className="form-message">No households match the current filters.</p>}
            {visibleHouseholds.map((record) => (
              <article className="household-card" key={record.household.householdId}>
                <div className="section-heading">
                  <div>
                    <div className="title-row">
                      <h3>{record.household.displayName}</h3>
                      <span className={`status-pill ${record.household.rsvpStatus}`}>
                        {record.household.rsvpStatus.replace('_', ' ')}
                      </span>
                      <span className={`status-pill invite-${record.household.inviteLifecycleStatus}`}>
                        {inviteStatusLabel(record.household)}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span>
                        <Users aria-hidden="true" />
                        {record.household.members.length} household guests
                      </span>
                      {record.household.email && (
                        <span>
                          <Mail aria-hidden="true" />
                          {record.household.email}
                        </span>
                      )}
                      {record.household.inviteCodeLastRotatedAt && (
                        <span>
                          <KeyRound aria-hidden="true" />
                          Code updated {formatDateTime(record.household.inviteCodeLastRotatedAt)}
                        </span>
                      )}
                      {record.household.inviteExportedAt && <span>Exported {formatDateTime(record.household.inviteExportedAt)}</span>}
                  {record.household.inviteSentAt && <span>Sent {formatDateTime(record.household.inviteSentAt)}</span>}
                    </div>
                    <div className="invite-actions-row">
                      {revealedInvites[record.household.householdId] ? (
                        <>
                          <a
                            className="secondary-button button-inline"
                            href={buildGuestRsvpUrl(revealedInvites[record.household.householdId].inviteCode)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink aria-hidden="true" />
                            View RSVP
                          </a>
                          <button
                            type="button"
                            className="secondary-button button-inline"
                            onClick={() => void openQrCodeModal(revealedInvites[record.household.householdId])}
                          >
                            <Image aria-hidden="true" />
                            Invitation QR
                          </button>
                        </>
                      ) : (
                        <p className="form-message compact-message">
                          Generate or rotate this invite code in this session to reveal its RSVP link and QR code.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="toolbar-actions">
                    <button type="button" className="secondary-button button-inline" onClick={() => beginEditHousehold(record.household)}>
                      <Edit3 aria-hidden="true" />
                      Edit
                    </button>
                    <button type="button" className="secondary-button button-inline" onClick={() => handleRotateInviteCode(record)}>
                      <KeyRound aria-hidden="true" />
                      {record.household.inviteCodeLastRotatedAt ? 'Rotate code' : 'Generate code'}
                    </button>
                  </div>
                </div>

                {inviteWarning(record.household) && <p className="warning-message">{inviteWarning(record.household)}</p>}

                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="secondary-button button-inline"
                    onClick={() => void markInviteStatus(record, 'exported')}
                    disabled={
                      isHouseholdArchived(record.household) ||
                      record.household.inviteLifecycleStatus === 'exported' ||
                      record.household.inviteLifecycleStatus === 'sent'
                    }
                  >
                    <Download aria-hidden="true" />
                    Mark exported
                  </button>
                  <button
                    type="button"
                    className="secondary-button button-inline"
                    onClick={() => void markInviteStatus(record, 'sent')}
                    disabled={isHouseholdArchived(record.household) || record.household.inviteLifecycleStatus !== 'exported'}
                  >
                    <Send aria-hidden="true" />
                    Mark sent
                  </button>
                  <button
                    type="button"
                    className="secondary-button button-inline danger-button"
                    onClick={() => void handleArchiveHousehold(record)}
                    disabled={isHouseholdArchived(record.household)}
                  >
                    <Archive aria-hidden="true" />
                    Archive
                  </button>
                </div>

                {editingHouseholdId === record.household.householdId && (
                  <section className="edit-panel" aria-label={`Edit ${record.household.displayName}`}>
                    <div className="split-fields">
                      <label>
                        Display name
                        <input
                          aria-label={`${record.household.displayName} edit display name`}
                          value={editForm.displayName}
                          onChange={(event) => setEditForm({ ...editForm, displayName: event.target.value })}
                        />
                      </label>
                      <label>
                        Contact email
                        <input
                          aria-label={`${record.household.displayName} edit contact email`}
                          value={editForm.email}
                          onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                        />
                      </label>
                    </div>
                    <label>
                      Max plus-ones
                      <input
                        aria-label={`${record.household.displayName} edit max plus-ones`}
                        type="number"
                        min="0"
                        max="10"
                        value={editForm.maxPlusOnes}
                        onChange={(event) => setEditForm({ ...editForm, maxPlusOnes: event.target.value })}
                      />
                    </label>
                    <AddressFields form={editForm} onChange={setEditForm} labelPrefix={`${record.household.displayName} edit`} />
                    {editForm.members.map((member, index) => (
                      <fieldset key={member.id ?? index}>
                        <legend>{member.id ? formatMemberName(member) : `Member ${index + 1}`}</legend>
                        <div className="split-fields">
                          <label>
                            First name
                            <input
                              aria-label={`${formatMemberName(member)} edit first name`}
                              value={member.firstName}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  members: editForm.members.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, firstName: event.target.value } : entry,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            Last name
                            <input
                              aria-label={`${formatMemberName(member)} edit last name`}
                              value={member.lastName}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  members: editForm.members.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, lastName: event.target.value } : entry,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                        <label className="checkbox-row">
                          <input
                            aria-label={`${formatMemberName(member)} edit can bring a plus-one`}
                            type="checkbox"
                            checked={member.canBringPlusOne}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                members: editForm.members.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, canBringPlusOne: event.target.checked } : entry,
                                ),
                              })
                            }
                          />
                          Can bring a plus-one
                        </label>
                        <label>
                          Wedding-party role
                          <input
                            aria-label={`${formatMemberName(member)} edit wedding-party role`}
                            value={member.weddingPartyRole}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                members: editForm.members.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, weddingPartyRole: event.target.value } : entry,
                                ),
                              })
                            }
                          />
                        </label>
                        <label className="checkbox-row">
                          <input
                            aria-label={`${formatMemberName(member)} edit rehearsal dinner invited`}
                            type="checkbox"
                            checked={member.rehearsalDinnerInvited}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                members: editForm.members.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, rehearsalDinnerInvited: event.target.checked } : entry,
                                ),
                              })
                            }
                          />
                          Rehearsal dinner invited
                        </label>
                        {member.id && (
                          <button
                            type="button"
                            className="secondary-button button-inline danger-button"
                            onClick={() => void handleRemoveMember(record, member.id!)}
                          >
                            <Trash2 aria-hidden="true" />
                            Remove member
                          </button>
                        )}
                      </fieldset>
                    ))}
                    <div className="toolbar-actions">
                      <button type="button" className="icon-button" onClick={() => void saveHouseholdEdit(record.household.householdId)}>
                        <Save aria-hidden="true" />
                        Save changes
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setEditingHouseholdId(undefined)}>
                        Cancel
                      </button>
                    </div>
                  </section>
                )}

                <div className="stats-inline">
                  <span>{record.attendance.attendingGuests} attending</span>
                  <span>{record.attendance.pendingGuests} pending</span>
                  <span>{record.attendance.plusOneGuests} plus-ones</span>
                </div>

                <div className="member-list">
                  {record.household.members.map((member) => {
                    const memberRsvp = record.rsvp?.members.find((entry) => entry.memberId === member.id);
                    return (
                      <div key={member.id} className="member-row">
                        <strong>{formatMemberName(member)}</strong>
                        <span>{memberRsvp ? summarizeMemberRsvp(memberRsvp.attending) : 'Awaiting RSVP'}</span>
                      </div>
                    );
                  })}
                </div>

                {record.rsvp?.plusOnes.length ? (
                  <div className="note-block">
                    <strong>Plus-ones</strong>
                    <ul className="plain-list compact-list">
                      {record.rsvp.plusOnes.map((plusOne, index) => (
                        <li key={`${plusOne.sponsorMemberId}-${index}`}>
                          {plusOne.firstName} {plusOne.lastName}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {record.rsvp?.notes && (
                  <div className="note-block">
                    <strong>Notes</strong>
                    <p>{record.rsvp.notes}</p>
                  </div>
                )}

                {record.rsvp?.accessibilityNotes && (
                  <div className="note-block">
                    <strong>Accessibility</strong>
                    <p>{record.rsvp.accessibilityNotes}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function parseRoute(pathname: string): Route {
  if (pathname === '/rsvp') {
    return { name: 'rsvp_entry' };
  }
  if (pathname.startsWith('/rsvp/') && pathname.endsWith('/success')) {
    return {
      name: 'rsvp_success',
      inviteCode: decodeURIComponent(pathname.slice('/rsvp/'.length, -'/success'.length)),
    };
  }
  if (pathname.startsWith('/rsvp/')) {
    return { name: 'rsvp', inviteCode: decodeURIComponent(pathname.slice('/rsvp/'.length)) };
  }
  if (pathname === '/admin') {
    return { name: 'admin' };
  }
  return { name: 'home' };
}

function toEditableRsvp(household: Household, rsvp?: StoredRsvp): RsvpPayload {
  if (rsvp) {
    return {
      members: rsvp.members.map((member) => ({ ...member })),
      plusOnes: rsvp.plusOnes.map((plusOne) => ({ ...plusOne })),
      notes: rsvp.notes,
      accessibilityNotes: rsvp.accessibilityNotes,
    };
  }

  return {
    members: household.members.map((member) => ({
      memberId: member.id,
      attending: true,
      mealChoice: 'buffet',
      dietaryNotes: '',
    })),
    plusOnes: [],
    notes: '',
    accessibilityNotes: '',
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function FieldError({ path, errors }: { path: string; errors: RsvpFieldErrorMap }) {
  const message = errors[path];
  if (!message) {
    return null;
  }

  return (
    <span id={buildFieldErrorId(path)} className="field-error-message" role="alert">
      {message}
    </span>
  );
}

function validateRsvpForm(
  household: Household,
  form: RsvpPayload,
): { fieldErrors: RsvpFieldErrorMap; formMessage: string } | undefined {
  const fieldErrors: RsvpFieldErrorMap = {};
  const formMessages: string[] = [];
  const parsed = RsvpUpdateSchema.safeParse(form);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      const message = normalizeValidationMessage(issue.message);
      if (path && isRsvpFieldPath(path) && !fieldErrors[path]) {
        fieldErrors[path] = message;
        continue;
      }

      formMessages.push(message);
    }
  }

  const eligibleSponsorIds = new Set(
    household.members
      .filter((member) => member.canBringPlusOne)
      .filter((member) => form.members.some((entry) => entry.memberId === member.id && entry.attending))
      .map((member) => member.id),
  );

  if (form.plusOnes.length > household.maxPlusOnes) {
    formMessages.push(
      `This invitation allows up to ${household.maxPlusOnes} plus-one${household.maxPlusOnes === 1 ? '' : 's'}.`,
    );
  }

  form.plusOnes.forEach((plusOne, index) => {
    const sponsorPath = `plusOnes.${index}.sponsorMemberId`;
    if (!eligibleSponsorIds.has(plusOne.sponsorMemberId) && !fieldErrors[sponsorPath]) {
      fieldErrors[sponsorPath] = 'Choose an attending guest who is allowed a plus-one.';
    }
  });

  if (Object.keys(fieldErrors).length === 0 && formMessages.length === 0) {
    return undefined;
  }

  return {
    fieldErrors,
    formMessage: formMessages[0] ?? 'Please fix the highlighted fields and try again.',
  };
}

function parseRsvpApiError(error: ApiError): { fieldErrors: RsvpFieldErrorMap; formMessage: string } {
  const fieldErrors: RsvpFieldErrorMap = {};
  const formMessages: string[] = [];

  for (const detail of error.details) {
    const separatorIndex = detail.indexOf(': ');
    if (separatorIndex === -1) {
      formMessages.push(normalizeValidationMessage(detail));
      continue;
    }

    const path = detail.slice(0, separatorIndex);
    const rawMessage = detail.slice(separatorIndex + 2);
    if (isRsvpFieldPath(path) && !fieldErrors[path]) {
      fieldErrors[path] = normalizeValidationMessage(rawMessage);
      continue;
    }

    formMessages.push(normalizeValidationMessage(rawMessage));
  }

  return {
    fieldErrors,
    formMessage:
      formMessages[0] ??
      (Object.keys(fieldErrors).length > 0 ? 'Please fix the highlighted fields and try again.' : error.message),
  };
}

function isRsvpFieldPath(path: string): boolean {
  return path === 'notes' || path === 'accessibilityNotes' || path.startsWith('members.') || path.startsWith('plusOnes.');
}

function normalizeValidationMessage(message: string): string {
  if (message === 'String must contain at least 1 character(s)' || message === 'Required') {
    return 'This field is required.';
  }

  const maxLengthMatch = message.match(/^String must contain at most (\d+) character\(s\)$/);
  if (maxLengthMatch) {
    return `Please keep this to ${maxLengthMatch[1]} characters or fewer.`;
  }

  return message;
}

function buildFieldErrorId(path: string): string {
  return `${path.replace(/[^a-z0-9]+/gi, '-')}-error`;
}

function AddressFields({
  form,
  onChange,
  labelPrefix,
}: {
  form: HouseholdFormState;
  onChange: (form: HouseholdFormState) => void;
  labelPrefix: string;
}) {
  return (
    <>
      <div className="split-fields">
        <label>
          Address line 1
          <input
            aria-label={`${labelPrefix} address line 1`}
            value={form.mailingAddress.line1}
            onChange={(event) => onChange({ ...form, mailingAddress: { ...form.mailingAddress, line1: event.target.value } })}
          />
        </label>
        <label>
          Address line 2
          <input
            aria-label={`${labelPrefix} address line 2`}
            value={form.mailingAddress.line2}
            onChange={(event) => onChange({ ...form, mailingAddress: { ...form.mailingAddress, line2: event.target.value } })}
          />
        </label>
      </div>
      <div className="split-fields">
        <label>
          City
          <input
            aria-label={`${labelPrefix} city`}
            value={form.mailingAddress.city}
            onChange={(event) => onChange({ ...form, mailingAddress: { ...form.mailingAddress, city: event.target.value } })}
          />
        </label>
        <label>
          State
          <input
            aria-label={`${labelPrefix} state`}
            value={form.mailingAddress.state}
            onChange={(event) => onChange({ ...form, mailingAddress: { ...form.mailingAddress, state: event.target.value } })}
          />
        </label>
      </div>
      <div className="split-fields">
        <label>
          Postal code
          <input
            aria-label={`${labelPrefix} postal code`}
            value={form.mailingAddress.postalCode}
            onChange={(event) => onChange({ ...form, mailingAddress: { ...form.mailingAddress, postalCode: event.target.value } })}
          />
        </label>
        <label>
          Country
          <input
            aria-label={`${labelPrefix} country`}
            value={form.mailingAddress.country}
            onChange={(event) => onChange({ ...form, mailingAddress: { ...form.mailingAddress, country: event.target.value } })}
          />
        </label>
      </div>
    </>
  );
}

function emptyHouseholdForm(): HouseholdFormState {
  return {
    displayName: '',
    email: '',
    maxPlusOnes: '0',
    mailingAddress: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    members: [
      {
        firstName: '',
        lastName: '',
        canBringPlusOne: false,
        weddingPartyRole: '',
        rehearsalDinnerInvited: false,
      },
    ],
  };
}

function toCreateHouseholdInput(form: HouseholdFormState): CreateHouseholdInput {
  return {
    displayName: form.displayName,
    email: form.email,
    maxPlusOnes: Number(form.maxPlusOnes || 0),
    mailingAddress: form.mailingAddress,
    members: form.members.map((member) => ({
      firstName: member.firstName,
      lastName: member.lastName,
      canBringPlusOne: member.canBringPlusOne,
      weddingPartyRole: member.weddingPartyRole,
      rehearsalDinnerInvited: member.rehearsalDinnerInvited,
    })),
  };
}

function toUpdateHouseholdInput(form: HouseholdFormState) {
  return {
    displayName: form.displayName,
    email: form.email,
    maxPlusOnes: Number(form.maxPlusOnes || 0),
    mailingAddress: form.mailingAddress,
  };
}

function toHouseholdFormState(household: Household): HouseholdFormState {
  return {
    displayName: household.displayName,
    email: household.email ?? '',
    maxPlusOnes: String(household.maxPlusOnes),
    mailingAddress: {
      line1: household.mailingAddress?.line1 ?? '',
      line2: household.mailingAddress?.line2 ?? '',
      city: household.mailingAddress?.city ?? '',
      state: household.mailingAddress?.state ?? '',
      postalCode: household.mailingAddress?.postalCode ?? '',
      country: household.mailingAddress?.country ?? '',
    },
    members: household.members.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      canBringPlusOne: member.canBringPlusOne,
      weddingPartyRole: member.weddingPartyRole ?? '',
      rehearsalDinnerInvited: member.rehearsalDinnerInvited ?? false,
    })),
  };
}

function inviteStatusLabel(household: Household): string {
  if (household.inviteCodeHash && household.inviteLifecycleStatus === 'not_generated') {
    return 'generated';
  }
  return household.inviteLifecycleStatus.replace('_', ' ');
}

function isHouseholdArchived(household: Household): boolean {
  return household.inviteLifecycleStatus === 'archived' || Boolean(household.archivedAt);
}

function inviteWarning(household: Household): string {
  if (household.inviteLifecycleStatus === 'sent') {
    return 'This invitation is marked sent. Invite-code rotation is blocked to protect the mailed URL.';
  }
  if (household.inviteLifecycleStatus === 'exported') {
    return 'This invitation was exported. Rotating the code requires confirmation because printed materials may already include it.';
  }
  return '';
}

function formatMemberName(member: { firstName: string; lastName: string }): string {
  return `${member.firstName} ${member.lastName}`;
}

function summarizeMemberRsvp(attending: boolean): string {
  return attending ? 'Attending' : 'Declined';
}

async function openQrCodeModalForInvite(
  invite: RevealedInvite,
  setInvite: (invite: RevealedInvite | undefined) => void,
  setQrCodeDataUrl: (value: string | undefined) => void,
  setQrCodeStatus: (value: 'idle' | 'loading' | 'ready' | 'error') => void,
) {
  setInvite(invite);
  setQrCodeStatus('loading');
  setQrCodeDataUrl(undefined);

  try {
    const { default: QRCode } = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(buildGuestRsvpUrl(invite.inviteCode), { margin: 1, width: 256 });
    setQrCodeDataUrl(dataUrl);
    setQrCodeStatus('ready');
  } catch {
    setQrCodeStatus('error');
  }
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <h2>{title}</h2>
          <button type="button" className="secondary-button button-inline" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function HouseholdForm({
  form,
  setForm,
  creating,
  onSubmit,
  onCancel,
}: {
  form: HouseholdFormState;
  setForm: (form: HouseholdFormState) => void;
  creating: boolean;
  onSubmit: (event: FormEvent) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <p className="form-message">Add the household, mailing details, and each invited guest.</p>
      <label>
        Household display name
        <input aria-label="Household display name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
      </label>
      <label>
        Contact email
        <input aria-label="Contact email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      </label>
      <label>
        Max plus-ones
        <input
          aria-label="Max plus-ones"
          type="number"
          min="0"
          max="10"
          value={form.maxPlusOnes}
          onChange={(event) => setForm({ ...form, maxPlusOnes: event.target.value })}
        />
      </label>
      <AddressFields form={form} onChange={setForm} labelPrefix="create household" />
      <div className="section-heading">
        <div>
          <h3>Members</h3>
          <p className="form-message">Add every invited guest in the household.</p>
        </div>
        <button
          type="button"
          className="secondary-button button-inline"
          onClick={() =>
            setForm({
              ...form,
              members: [
                ...form.members,
                {
                  firstName: '',
                  lastName: '',
                  canBringPlusOne: false,
                  weddingPartyRole: '',
                  rehearsalDinnerInvited: false,
                },
              ],
            })
          }
        >
          <Plus aria-hidden="true" />
          Add member
        </button>
      </div>
      {form.members.map((member, index) => (
        <fieldset key={index}>
          <legend>Member {index + 1}</legend>
          <div className="split-fields">
            <label>
              First name
              <input
                aria-label={`Member ${index + 1} first name`}
                value={member.firstName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    members: form.members.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, firstName: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <label>
              Last name
              <input
                aria-label={`Member ${index + 1} last name`}
                value={member.lastName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    members: form.members.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, lastName: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              aria-label={`Member ${index + 1} can bring a plus-one`}
              type="checkbox"
              checked={member.canBringPlusOne}
              onChange={(event) =>
                setForm({
                  ...form,
                  members: form.members.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, canBringPlusOne: event.target.checked } : entry,
                  ),
                })
              }
            />
            Can bring a plus-one
          </label>
          <label>
            Wedding-party role
            <input
              aria-label={`Member ${index + 1} wedding-party role`}
              value={member.weddingPartyRole}
              onChange={(event) =>
                setForm({
                  ...form,
                  members: form.members.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, weddingPartyRole: event.target.value } : entry,
                  ),
                })
              }
            />
          </label>
          <label className="checkbox-row">
            <input
              aria-label={`Member ${index + 1} rehearsal dinner invited`}
              type="checkbox"
              checked={member.rehearsalDinnerInvited}
              onChange={(event) =>
                setForm({
                  ...form,
                  members: form.members.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, rehearsalDinnerInvited: event.target.checked } : entry,
                  ),
                })
              }
            />
            Rehearsal dinner invited
          </label>
          {form.members.length > 1 && (
            <button
              type="button"
              className="secondary-button button-inline danger-button"
              onClick={() =>
                setForm({
                  ...form,
                  members: form.members.filter((_, entryIndex) => entryIndex !== index),
                })
              }
            >
              <Trash2 aria-hidden="true" />
              Remove member
            </button>
          )}
        </fieldset>
      ))}
      <div className="toolbar-actions">
        <button type="submit" disabled={creating}>
          <Users aria-hidden="true" />
          {creating ? 'Creating...' : 'Create household'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LoadingScreen({ eyebrow, title, message }: { eyebrow: string; title: string; message: string }) {
  return (
    <section className="lookup-card loading-card">
      <p className="eyebrow">{eyebrow}</p>
      <LoadingPulse label={title} message={message} />
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </section>
  );
}

function SkeletonStat() {
  return (
    <article className="skeleton-stat" aria-hidden="true">
      <span className="skeleton-line number" />
      <span className="skeleton-line short" />
    </article>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="admin-skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <article className="household-card skeleton-household-card" key={item}>
          <div className="section-heading">
            <div className="skeleton-stack">
              <span className="skeleton-line title" />
              <span className="skeleton-line wide" />
            </div>
            <div className="toolbar-actions skeleton-actions">
              <span className="skeleton-button" />
              <span className="skeleton-button" />
            </div>
          </div>
          <div className="stats-inline">
            <span className="skeleton-line short" />
            <span className="skeleton-line short" />
            <span className="skeleton-line short" />
          </div>
          <div className="member-list">
            <span className="skeleton-row" />
            <span className="skeleton-row" />
          </div>
        </article>
      ))}
    </div>
  );
}

function LoadingPulse({
  label,
  message,
  compact = false,
}: {
  label: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div className={`loading-pulse ${compact ? 'compact' : ''}`}>
      <div className="loading-mark" aria-hidden="true">
        <Heart />
      </div>
      <div>
        <h1>{label}</h1>
        <p className="page-lede">{message}</p>
      </div>
    </div>
  );
}

function buildGuestRsvpPath(inviteCode: string): string {
  return `/rsvp/${encodeURIComponent(inviteCode)}`;
}

function buildGuestRsvpSuccessPath(inviteCode: string): string {
  return `${buildGuestRsvpPath(inviteCode)}/success`;
}

function buildGuestRsvpUrl(inviteCode: string): string {
  return `${window.location.origin}${buildGuestRsvpPath(inviteCode)}`;
}

function loadRevealedInvites(): Record<string, RevealedInvite> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = window.sessionStorage.getItem('admin.revealedInvites');
    return stored ? (JSON.parse(stored) as Record<string, RevealedInvite>) : {};
  } catch {
    return {};
  }
}

function persistRevealedInvite(
  invite: RevealedInvite,
  setState: Dispatch<SetStateAction<Record<string, RevealedInvite>>>,
) {
  setState((current) => {
    const next = { ...current, [invite.householdId]: invite };
    window.sessionStorage.setItem('admin.revealedInvites', JSON.stringify(next));
    return next;
  });
}
