import {
  GenericRecoverySuccessMessage,
  RecoveryContactInputSchema,
  RsvpUpdateSchema,
  generateIcs,
  type Household,
  type StoredRsvp,
} from '@matt-alison-wedding/shared';
import {
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Heart,
  Home,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  fetchRsvp,
  recoverRsvpLink,
  saveRsvp,
  saveSmsPreferences,
  type RsvpPayload,
} from '../api.js';
import { cx, scoped } from '../classNames.js';
import {
  SmsConsentCheckboxField,
  smsPhonePlaceholder,
} from '../components/SmsConsentFields.js';
import { LoadingPulse, LoadingScreen } from '../components/LoadingStates.js';
import { siteContent } from '../siteContent.js';
import styles from './RsvpPages.module.css';

type RsvpFieldErrorMap = Record<string, string>;

export function RsvpLookupPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const [recoveryContact, setRecoveryContact] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<
    'idle' | 'submitting' | 'success'
  >('idle');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const recoveryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!recoveryExpanded) {
      return;
    }

    recoveryInputRef.current?.focus();
  }, [recoveryExpanded]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setStatus('submitting');
    window.location.assign(`/rsvp/${encodeURIComponent(normalized)}`);
  };

  const submitRecovery = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = recoveryContact.trim();
    const validation = validateRecoveryContact(normalized);
    if (validation) {
      setRecoveryError(validation);
      setRecoveryMessage('');
      setRecoveryStatus('idle');
      return;
    }
    setRecoveryStatus('submitting');
    setRecoveryError('');
    setRecoveryMessage('');

    try {
      const response = await recoverRsvpLink({ contact: normalized });
      setRecoveryStatus('success');
      setRecoveryMessage(response.message || GenericRecoverySuccessMessage);
    } catch (error) {
      setRecoveryStatus('idle');
      if (error instanceof ApiError && error.statusCode === 422) {
        const parsed = parseRecoveryApiError(error);
        setRecoveryError(parsed.contactError);
        return;
      }

      setRecoveryMessage(GenericRecoverySuccessMessage);
      setRecoveryStatus('success');
    }
  };

  return (
    <main className={cx('narrow-page', scoped(styles, 'rsvp-flow-page'))}>
      <section
        className={cx('lookup-card', scoped(styles, 'rsvp-lookup-card'))}
      >
        <div className={scoped(styles, 'rsvp-lookup-guide')}>
          <p className="eyebrow">Private RSVP</p>
          <h1>Enter your invitation code</h1>
          <p className="page-lede">
            Your mailed invitation includes a private RSVP code. Enter it here
            to view or update your household&apos;s response.
          </p>
          <ol
            className={scoped(styles, 'rsvp-step-list')}
            aria-label="RSVP steps"
          >
            <li>
              <span>1</span>
              <div>
                <strong>Enter code</strong>
                <p>Start with the code printed on your invitation.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Review household</strong>
                <p>We&apos;ll load the guests included with your invitation.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Save response</strong>
                <p>
                  Submit your RSVP securely, and return later if plans change.
                </p>
              </div>
            </li>
          </ol>
        </div>
        <div className={scoped(styles, 'rsvp-lookup-panel')}>
          <form className={scoped(styles, 'lookup-form')} onSubmit={submit}>
            <label>
              Invitation code
              <input
                aria-label="Invitation code"
                autoCapitalize="characters"
                autoCorrect="off"
                autoFocus
                inputMode="text"
                maxLength={128}
                placeholder="Enter your code"
                value={inviteCode}
                onChange={(event) => {
                  setInviteCode(event.target.value.toUpperCase());
                }}
              />
            </label>
            <button type="submit" disabled={status === 'submitting'}>
              <Search aria-hidden="true" />
              {status === 'submitting' ? 'Opening RSVP...' : 'View RSVP'}
            </button>
          </form>
          {status === 'submitting' && (
            <div className="inline-loading-shell">
              <LoadingPulse compact />
            </div>
          )}
          <div className={scoped(styles, 'lookup-divider')}>
            <span>or</span>
          </div>
          <button
            type="button"
            className={scoped(styles, 'recovery-toggle')}
            aria-expanded={recoveryExpanded}
            aria-controls="rsvp-recovery-form"
            onClick={() => {
              setRecoveryExpanded((current) => !current);
              setRecoveryError('');
              setRecoveryMessage('');
              setRecoveryStatus('idle');
            }}
          >
            <LifeBuoy aria-hidden="true" />
            Don&apos;t have a code?
          </button>
          {recoveryExpanded && (
            <form
              id="rsvp-recovery-form"
              className={scoped(styles, 'recovery-form')}
              onSubmit={submitRecovery}
            >
              <label className={recoveryError ? 'field-error' : undefined}>
                Email or mobile number
                <input
                  ref={recoveryInputRef}
                  aria-describedby={
                    recoveryError ? 'rsvp-recovery-contact-error' : undefined
                  }
                  aria-invalid={recoveryError ? 'true' : 'false'}
                  autoCapitalize="off"
                  autoCorrect="off"
                  inputMode="email"
                  placeholder="name@example.com or (555) 123-4567"
                  value={recoveryContact}
                  onChange={(event) => {
                    setRecoveryContact(event.target.value);
                    setRecoveryError('');
                    if (recoveryStatus !== 'submitting') {
                      setRecoveryMessage('');
                      setRecoveryStatus('idle');
                    }
                  }}
                />
                {recoveryError && (
                  <span
                    id="rsvp-recovery-contact-error"
                    className="field-error-message"
                    role="alert"
                  >
                    {recoveryError}
                  </span>
                )}
              </label>
              <p
                className={cx(
                  'form-message',
                  scoped(styles, 'recovery-helper'),
                )}
              >
                Enter the email address or mobile number already saved with your
                household.
              </p>
              <button
                type="submit"
                className={scoped(styles, 'recovery-submit-button')}
                disabled={recoveryStatus === 'submitting'}
              >
                <Send aria-hidden="true" />
                {recoveryStatus === 'submitting'
                  ? 'Sending link...'
                  : 'Send private RSVP link'}
              </button>
              {recoveryStatus === 'submitting' && (
                <div className="inline-loading-shell">
                  <LoadingPulse compact />
                </div>
              )}
              {recoveryMessage && (
                <p className="form-message" aria-live="polite">
                  {recoveryMessage}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export function RsvpPage({ inviteCode }: { inviteCode: string }) {
  const [household, setHousehold] = useState<Household | undefined>();
  const [form, setForm] = useState<RsvpPayload | undefined>();
  const [savedRsvp, setSavedRsvp] = useState<StoredRsvp | undefined>();
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'saving' | 'error'
  >('loading');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RsvpFieldErrorMap>({});
  const [step, setStep] = useState<'guests' | 'details'>('guests');
  const guestHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingStepFocusRef = useRef(false);
  const calendarHref = useMemo(() => {
    const ics = generateIcs(siteContent.weddingEvent);
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);

  const moveToStep = (nextStep: 'guests' | 'details', focusHeading = true) => {
    pendingStepFocusRef.current = focusHeading;
    setStep(nextStep);
  };

  useEffect(() => {
    fetchRsvp(inviteCode)
      .then((response) => {
        setHousehold(response.household);
        setSavedRsvp(response.rsvp);
        setForm(toEditableRsvp(response.household, response.rsvp));
        pendingStepFocusRef.current = false;
        setStep('guests');
        setFieldErrors({});
        setMessage('');
        setStatus('ready');
      })
      .catch((error: Error) => {
        setMessage(error.message);
        setStatus('error');
      });
  }, [inviteCode]);

  useEffect(() => {
    if (!pendingStepFocusRef.current) {
      return;
    }

    pendingStepFocusRef.current = false;
    const heading =
      step === 'guests' ? guestHeadingRef.current : detailsHeadingRef.current;
    heading?.focus({ preventScroll: true });
  }, [step]);

  if (status === 'loading') {
    return (
      <main className="narrow-page">
        <LoadingScreen />
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
  const canAddPlusOne =
    eligibleSponsors.length > 0 && form.plusOnes.length < household.maxPlusOnes;

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

  const updateMember = (
    memberId: string,
    updates: Partial<RsvpPayload['members'][number]>,
  ) => {
    clearFormMessage();
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextMembers = current.members.map((member) =>
        member.memberId === memberId ? { ...member, ...updates } : member,
      );
      const nextPlusOnes =
        updates.attending === false
          ? current.plusOnes.filter(
              (plusOne) => plusOne.sponsorMemberId !== memberId,
            )
          : current.plusOnes;

      return {
        ...current,
        members: nextMembers,
        plusOnes: nextPlusOnes,
      };
    });
  };

  const updatePlusOne = (
    index: number,
    updates: Partial<RsvpPayload['plusOnes'][number]>,
  ) => {
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

  const addPlusOne = (sponsorMemberId?: string) => {
    if (!canAddPlusOne) {
      return;
    }

    clearValidationState();
    setForm((current) => {
      if (!current) {
        return current;
      }

      const defaultSponsor =
        eligibleSponsors.find((member) => member.id === sponsorMemberId) ??
        eligibleSponsors[0];
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
        plusOnes: current.plusOnes.filter(
          (_, plusOneIndex) => plusOneIndex !== index,
        ),
      };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const validation = validateRsvpForm(household, form);
    if (validation) {
      setFieldErrors(validation.fieldErrors);
      setMessage(validation.formMessage);
      if (hasGuestOrPlusOneFieldErrors(validation.fieldErrors)) {
        moveToStep('guests');
      }
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
        if (hasGuestOrPlusOneFieldErrors(parsedError.fieldErrors)) {
          moveToStep('guests');
        }
        return;
      }

      setMessage(
        error instanceof Error ? error.message : 'Unable to save RSVP',
      );
    }
  };

  const activeMembers = household.members.filter(
    (member) => !member.archivedAt,
  );
  return (
    <main className={cx('narrow-page', scoped(styles, 'rsvp-flow-page'))}>
      <p className="eyebrow">Private RSVP</p>
      <h1>{household.displayName}</h1>
      <p className="page-lede">
        Respond for everyone listed below. Your invitation includes{' '}
        {household.members.length} household guest
        {household.members.length === 1 ? '' : 's'} and up to{' '}
        {household.maxPlusOnes} plus-one
        {household.maxPlusOnes === 1 ? '' : 's'}.
      </p>
      <RsvpContextPanel
        calendarHref={calendarHref}
        householdGuestCount={activeMembers.length}
        maxPlusOnes={household.maxPlusOnes}
        savedRsvp={savedRsvp}
        showLookupLink
      />
      <RsvpStepIndicator step={step} />
      <form className={scoped(styles, 'rsvp-form')} onSubmit={submit}>
        {status === 'saving' && (
          <div className="inline-loading-shell" aria-live="polite">
            <LoadingPulse compact />
          </div>
        )}
        {step === 'guests' && (
          <>
            <section
              className={scoped(styles, 'rsvp-form-section')}
              aria-labelledby="rsvp-guests-heading"
            >
          <div className="section-heading">
            <div>
              <h2 id="rsvp-guests-heading" ref={guestHeadingRef} tabIndex={-1}>
                Who&apos;s coming?
              </h2>
              <p className="form-message">
                Choose attendance for each person, then add any dietary notes
                for guests who are attending.
              </p>
            </div>
          </div>
          <div className={scoped(styles, 'guest-list')}>
          {household.members.map((member, memberIndex) => {
            const memberRsvp = form.members.find(
              (item) => item.memberId === member.id,
            )!;
            const fullName = `${member.firstName} ${member.lastName}`;
            const memberPlusOnes = form.plusOnes
              .map((plusOne, index) => ({ plusOne, index }))
              .filter(({ plusOne }) => plusOne.sponsorMemberId === member.id);
            const canAddForMember =
              member.canBringPlusOne && memberRsvp.attending && canAddPlusOne;
            return (
              <div
                className={scoped(styles, 'guest-party-group')}
                key={member.id}
              >
              <fieldset
                className={scoped(styles, 'guest-response-card')}
              >
                <legend>{fullName}</legend>
                <div className={scoped(styles, 'guest-response-grid')}>
                  <div className={scoped(styles, 'guest-response-person')}>
                    <strong>{fullName}</strong>
                    <span>
                      {member.weddingPartyRole ||
                        (member.canBringPlusOne
                          ? 'Plus-one eligible'
                          : 'Guest')}
                    </span>
                  </div>
                  <div
                    className={scoped(styles, 'segmented-control')}
                    role="group"
                    aria-label={`${fullName} attendance`}
                  >
                    <button
                      type="button"
                      className={cx(
                        scoped(styles, 'rsvp-segment'),
                        memberRsvp.attending && scoped(styles, 'is-selected'),
                      )}
                      aria-pressed={memberRsvp.attending}
                      aria-label={`${fullName} attending`}
                      onClick={() =>
                        updateMember(member.id, {
                          attending: true,
                          mealChoice:
                            memberRsvp.mealChoice === 'none'
                              ? 'buffet'
                              : memberRsvp.mealChoice,
                        })
                      }
                    >
                      <Check aria-hidden="true" />
                      Attending
                    </button>
                    <button
                      type="button"
                      className={cx(
                        scoped(styles, 'rsvp-segment'),
                        !memberRsvp.attending && scoped(styles, 'is-selected'),
                      )}
                      aria-pressed={!memberRsvp.attending}
                      aria-label={`${fullName} not attending`}
                      onClick={() =>
                        updateMember(member.id, {
                          attending: false,
                          mealChoice: 'none',
                        })
                      }
                    >
                      Not attending
                    </button>
                  </div>
                  <div className={scoped(styles, 'guest-response-detail')}>
                    {memberRsvp.attending ? (
                      <label
                        className={
                          fieldError(`members.${memberIndex}.dietaryNotes`)
                            ? 'field-error'
                            : undefined
                        }
                      >
                        Dietary notes
                        <input
                          aria-label={`${fullName} dietary notes`}
                          aria-describedby={
                            fieldError(`members.${memberIndex}.dietaryNotes`)
                              ? buildFieldErrorId(
                                  `members.${memberIndex}.dietaryNotes`,
                                )
                              : undefined
                          }
                          aria-invalid={
                            fieldError(`members.${memberIndex}.dietaryNotes`)
                              ? 'true'
                              : 'false'
                          }
                          maxLength={500}
                          placeholder="E.g., no nuts"
                          value={memberRsvp.dietaryNotes}
                          onChange={(event) => {
                            clearFieldError(
                              `members.${memberIndex}.dietaryNotes`,
                            );
                            updateMember(member.id, {
                              dietaryNotes: event.target.value,
                            });
                          }}
                        />
                        <FieldError
                          path={`members.${memberIndex}.dietaryNotes`}
                          errors={fieldErrors}
                        />
                      </label>
                    ) : (
                      <p
                        className={cx(
                          'form-message',
                          scoped(styles, 'guest-decline-note'),
                        )}
                      >
                        No additional details needed for guests who are not
                        attending.
                      </p>
                    )}
                  </div>
                </div>
                {member.canBringPlusOne && (
                  <div className={scoped(styles, 'companion-row')}>
                    <p className="form-message">
                      {memberRsvp.attending
                        ? memberPlusOnes.length > 0
                          ? `${fullName}'s companion guest is listed below.`
                          : 'This guest may bring a plus-one.'
                        : 'Mark this guest as attending to add their plus-one.'}
                    </p>
                    <button
                      type="button"
                      className="secondary-button button-inline"
                      onClick={() => addPlusOne(member.id)}
                      disabled={!canAddForMember}
                    >
                      <Plus aria-hidden="true" />
                      Add plus-one
                    </button>
                  </div>
                )}
              </fieldset>
              {memberPlusOnes.map(({ plusOne, index }) => (
                <fieldset
                  className={scoped(styles, 'companion-guest-card')}
                  key={`${plusOne.sponsorMemberId}-${index}`}
                >
                  <legend>Guest of {fullName}</legend>
                  <div className="split-fields">
                    <label
                      className={
                        fieldError(`plusOnes.${index}.firstName`)
                          ? 'field-error'
                          : undefined
                      }
                    >
                      First name
                      <input
                        aria-label={`Plus-one ${index + 1} first name`}
                        aria-describedby={
                          fieldError(`plusOnes.${index}.firstName`)
                            ? buildFieldErrorId(`plusOnes.${index}.firstName`)
                            : undefined
                        }
                        aria-invalid={
                          fieldError(`plusOnes.${index}.firstName`)
                            ? 'true'
                            : 'false'
                        }
                        maxLength={80}
                        value={plusOne.firstName}
                        onChange={(event) => {
                          clearFieldError(`plusOnes.${index}.firstName`);
                          updatePlusOne(index, {
                            firstName: event.target.value,
                          });
                        }}
                      />
                      <FieldError
                        path={`plusOnes.${index}.firstName`}
                        errors={fieldErrors}
                      />
                    </label>
                    <label
                      className={
                        fieldError(`plusOnes.${index}.lastName`)
                          ? 'field-error'
                          : undefined
                      }
                    >
                      Last name
                      <input
                        aria-label={`Plus-one ${index + 1} last name`}
                        aria-describedby={
                          fieldError(`plusOnes.${index}.lastName`)
                            ? buildFieldErrorId(`plusOnes.${index}.lastName`)
                            : undefined
                        }
                        aria-invalid={
                          fieldError(`plusOnes.${index}.lastName`)
                            ? 'true'
                            : 'false'
                        }
                        maxLength={80}
                        value={plusOne.lastName}
                        onChange={(event) => {
                          clearFieldError(`plusOnes.${index}.lastName`);
                          updatePlusOne(index, {
                            lastName: event.target.value,
                          });
                        }}
                      />
                      <FieldError
                        path={`plusOnes.${index}.lastName`}
                        errors={fieldErrors}
                      />
                    </label>
                  </div>
                  {eligibleSponsors.length > 1 && (
                    <label
                      className={
                        fieldError(`plusOnes.${index}.sponsorMemberId`)
                          ? 'field-error'
                          : undefined
                      }
                    >
                      Guest of
                      <select
                        aria-label={`Plus-one ${index + 1} sponsor`}
                        aria-describedby={
                          fieldError(`plusOnes.${index}.sponsorMemberId`)
                            ? buildFieldErrorId(
                                `plusOnes.${index}.sponsorMemberId`,
                              )
                            : undefined
                        }
                        aria-invalid={
                          fieldError(`plusOnes.${index}.sponsorMemberId`)
                            ? 'true'
                            : 'false'
                        }
                        value={plusOne.sponsorMemberId}
                        onChange={(event) => {
                          clearFieldError(`plusOnes.${index}.sponsorMemberId`);
                          updatePlusOne(index, {
                            sponsorMemberId: event.target.value,
                          });
                        }}
                      >
                        {eligibleSponsors.map((sponsor) => (
                          <option key={sponsor.id} value={sponsor.id}>
                            {sponsor.firstName} {sponsor.lastName}
                          </option>
                        ))}
                      </select>
                      <FieldError
                        path={`plusOnes.${index}.sponsorMemberId`}
                        errors={fieldErrors}
                      />
                    </label>
                  )}
                  <label
                    className={
                      fieldError(`plusOnes.${index}.dietaryNotes`)
                        ? 'field-error'
                        : undefined
                    }
                  >
                    Dietary notes
                    <input
                      aria-label={`Plus-one ${index + 1} dietary notes`}
                      aria-describedby={
                        fieldError(`plusOnes.${index}.dietaryNotes`)
                          ? buildFieldErrorId(`plusOnes.${index}.dietaryNotes`)
                          : undefined
                      }
                      aria-invalid={
                        fieldError(`plusOnes.${index}.dietaryNotes`)
                          ? 'true'
                          : 'false'
                      }
                      maxLength={500}
                      placeholder="E.g., allergies"
                      value={plusOne.dietaryNotes}
                      onChange={(event) => {
                        clearFieldError(`plusOnes.${index}.dietaryNotes`);
                        updatePlusOne(index, {
                          dietaryNotes: event.target.value,
                        });
                      }}
                    />
                    <FieldError
                      path={`plusOnes.${index}.dietaryNotes`}
                      errors={fieldErrors}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-button button-inline danger-button"
                    onClick={() => removePlusOne(index)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remove plus-one
                  </button>
                </fieldset>
              ))}
              </div>
            );
          })}
          </div>
            </section>
            <div className={scoped(styles, 'rsvp-step-actions')}>
              <button
                type="button"
                onClick={() => {
                  clearFormMessage();
                  moveToStep('details');
                }}
              >
                Continue to details
              </button>
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <section
              className={scoped(styles, 'rsvp-form-section')}
              aria-labelledby="rsvp-details-heading"
            >
              <div className="section-heading">
                <div>
                  <h2
                    id="rsvp-details-heading"
                    ref={detailsHeadingRef}
                    tabIndex={-1}
                  >
                    Anything else we should know?
                  </h2>
                  <p className="form-message">
                    Add any optional household notes.
                  </p>
                </div>
              </div>
              <div
                className={cx(
                  scoped(styles, 'rsvp-notes-grid'),
                  scoped(styles, 'single-notes'),
                )}
                aria-label="Additional notes"
              >
          <label className={fieldError('notes') ? 'field-error' : undefined}>
            Household notes
            <textarea
              aria-label="Household notes"
              aria-describedby={
                fieldError('notes') ? buildFieldErrorId('notes') : undefined
              }
              aria-invalid={fieldError('notes') ? 'true' : 'false'}
              maxLength={1000}
              placeholder="Share a note, song request, or timing detail..."
              value={form.notes}
              onChange={(event) => {
                clearFieldError('notes');
                clearFormMessage();
                setForm({ ...form, notes: event.target.value });
              }}
            />
            <FieldError path="notes" errors={fieldErrors} />
          </label>
              </div>
            </section>
            <p className="form-message">
              Text updates are managed separately from your RSVP.{' '}
              <a href={`${buildGuestRsvpPath(inviteCode)}/sms-updates`}>
                Manage text updates
              </a>
              .
            </p>
            <div className={scoped(styles, 'rsvp-save-bar')}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  clearFormMessage();
                  moveToStep('guests');
                }}
              >
                Back to guests
              </button>
              <button type="submit" disabled={status === 'saving'}>
                {status === 'saving' ? 'Saving...' : 'Save RSVP'}
              </button>
            </div>
          </>
        )}
        {message && (
          <p
            className={cx(
              'form-message',
              Object.keys(fieldErrors).length > 0 && 'error-message',
            )}
          >
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

export function RsvpSmsUpdatesPage({ inviteCode }: { inviteCode: string }) {
  const [household, setHousehold] = useState<Household>();
  const [phone, setPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const loadPreferences = useCallback(async () => {
    setStatus('loading');
    setMessage('');
    try {
      const { household: loaded } = await fetchRsvp(inviteCode);
      setHousehold(loaded);
      setPhone(loaded.smsConsent?.phone ?? loaded.phone ?? '');
      setStatus('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load text preferences.');
      setStatus('error');
    }
  }, [inviteCode]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  if (status === 'error') {
    return (
      <main className={cx('narrow-page', scoped(styles, 'rsvp-flow-page'))}>
        <section className="lookup-card">
          <h1>Unable to load text preferences</h1>
          <p className="form-message" role="alert">{message}</p>
          <button type="button" onClick={() => void loadPreferences()}>Try again</button>
        </section>
      </main>
    );
  }

  if (!household || status === 'loading') {
    return <LoadingScreen />;
  }

  const preferenceStatus = household.smsConsent?.status;
  const statusLabel = preferenceStatus === 'opted_in'
    ? 'Active'
    : preferenceStatus === 'pending_confirmation'
      ? 'Pending confirmation'
      : 'Off';

  const enable = async (event: FormEvent) => {
    event.preventDefault();
    if (!consentAccepted) {
      setMessage('Check the consent box to enable or update text messages.');
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      const updated = await saveSmsPreferences(inviteCode, { enabled: true, phone });
      setHousehold(updated);
      setConsentAccepted(false);
      setStatus('ready');
      setMessage('Text updates are active.');
    } catch (error) {
      const providerMessage = error instanceof Error
        ? error.message
        : 'Unable to update text preferences.';
      try {
        const { household: reconciled } = await fetchRsvp(inviteCode);
        setHousehold(reconciled);
        setPhone(reconciled.smsConsent?.phone ?? reconciled.phone ?? phone);
        setConsentAccepted(false);
      } catch {
        // Preserve the provider failure and the current form as a retry path.
      }
      setStatus('ready');
      setMessage(providerMessage);
    }
  };

  const disable = async () => {
    setStatus('saving');
    setMessage('');
    try {
      const updated = await saveSmsPreferences(inviteCode, { enabled: false });
      setHousehold(updated);
      setConsentAccepted(false);
      setStatus('ready');
      setMessage('Text updates are off.');
    } catch (error) {
      setStatus('ready');
      setMessage(error instanceof Error ? error.message : 'Unable to update text preferences.');
    }
  };

  return (
    <main className={cx('narrow-page', scoped(styles, 'rsvp-flow-page'))}>
      <p className="eyebrow">Private invitation</p>
      <h1>Text updates</h1>
      <p className="page-lede">
        Manage optional RSVP recovery, schedule, and wedding logistics texts for {household.displayName}.
        Your RSVP is saved separately and does not depend on SMS consent.
      </p>
      <section className={cx('lookup-card', scoped(styles, 'sms-panel'))}>
        <div className={scoped(styles, 'sms-panel-header')}>
          <MessageSquare aria-hidden="true" />
          <div><h2>Current status</h2><p className="form-message">{statusLabel}</p></div>
        </div>
        <form className={scoped(styles, 'rsvp-form')} onSubmit={enable}>
          <label>
            Mobile phone
            <input aria-label="Mobile phone" inputMode="tel" maxLength={32} placeholder={smsPhonePlaceholder} value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <SmsConsentCheckboxField checked={consentAccepted} inputId="rsvp-sms-preferences-consent" onChange={setConsentAccepted} />
          <button type="submit" disabled={status === 'saving'}>
            {preferenceStatus === 'opted_in' ? 'Update text updates' : 'Enable text updates'}
          </button>
        </form>
        {preferenceStatus && preferenceStatus !== 'opted_out' && (
          <button type="button" className="secondary-button" disabled={status === 'saving'} onClick={() => void disable()}>
            Turn off text updates
          </button>
        )}
        {message && <p className="form-message" role="status">{message}</p>}
      </section>
      <a className="secondary-button button-inline" href={buildGuestRsvpPath(inviteCode)}>Back to RSVP</a>
    </main>
  );
}

export function RsvpSuccessPage({ inviteCode }: { inviteCode: string }) {
  const [household, setHousehold] = useState<Household | undefined>();
  const [savedRsvp, setSavedRsvp] = useState<StoredRsvp | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  );
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
        <LoadingScreen />
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

  const responseSummary = buildRsvpSummary(household, savedRsvp);
  return (
    <main className={cx('narrow-page', scoped(styles, 'rsvp-flow-page'))}>
      <section
        className={cx(
          'lookup-card',
          'success-card',
          scoped(styles, 'rsvp-success-card'),
        )}
      >
        <p className="eyebrow">Private RSVP</p>
        <RsvpStepIndicator step="confirmation" />
        <div className={scoped(styles, 'success-mark')} aria-hidden="true">
          <Check />
        </div>
        <h1>RSVP received</h1>
        <p className="page-lede">
          Thanks, {household.displayName}. Your response has been saved.
        </p>
        <RsvpContextPanel calendarHref={calendarHref} savedRsvp={savedRsvp} />
        <div
          className={scoped(styles, 'rsvp-response-summary')}
          aria-label="RSVP response summary"
        >
          <section>
            <h2>Attending ({responseSummary.attending.length})</h2>
            {responseSummary.attending.length ? (
              <ul>
                {responseSummary.attending.map((guest) => (
                  <li key={guest}>{guest}</li>
                ))}
              </ul>
            ) : (
              <p className="form-message">None</p>
            )}
          </section>
          <section>
            <h2>Not attending ({responseSummary.notAttending.length})</h2>
            {responseSummary.notAttending.length ? (
              <ul>
                {responseSummary.notAttending.map((guest) => (
                  <li key={guest}>{guest}</li>
                ))}
              </ul>
            ) : (
              <p className="form-message">None</p>
            )}
          </section>
          <section>
            <h2>Notes</h2>
            {responseSummary.notes.length ? (
              <ul>
                {responseSummary.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="form-message">No notes added.</p>
            )}
          </section>
        </div>
        <p className="form-message">
          We&apos;ll see you at {siteContent.venueName} on{' '}
          {siteContent.dateLabel}. Need to make a change? Reopen this
          invitation and save again.
        </p>
        <div className="hero-actions compact-actions">
          <a className="icon-button" href={buildGuestRsvpPath(inviteCode)}>
            <Heart aria-hidden="true" />
            Review or update RSVP
          </a>
          <a className="secondary-button" href={`${buildGuestRsvpPath(inviteCode)}/sms-updates`}>
            <MessageSquare aria-hidden="true" />
            Manage text updates
          </a>
          <a className="secondary-button" href="/">
            <Home aria-hidden="true" />
            Back home
          </a>
        </div>
      </section>
    </main>
  );
}

function RsvpStepIndicator({
  step,
}: {
  step: 'guests' | 'details' | 'confirmation';
}) {
  const labels = {
    guests: 'Step 1 of 3 · Guests',
    details: 'Step 2 of 3 · Details',
    confirmation: 'Step 3 of 3 · Confirmation complete',
  };

  return (
    <p className={scoped(styles, 'rsvp-step-indicator')} aria-live="polite">
      {labels[step]}
    </p>
  );
}

function RsvpContextPanel({
  calendarHref,
  householdGuestCount,
  maxPlusOnes,
  savedRsvp,
  showLookupLink = false,
}: {
  calendarHref: string;
  householdGuestCount?: number;
  maxPlusOnes?: number;
  savedRsvp?: StoredRsvp;
  showLookupLink?: boolean;
}) {
  const venueMapHref = getNativeMapUrl();

  return (
    <section
      className={scoped(styles, 'rsvp-context-panel')}
      aria-label="RSVP details"
    >
      <div className={scoped(styles, 'rsvp-context-status')}>
        <div>
          <strong>
            {savedRsvp ? 'RSVP submitted' : `RSVP by ${siteContent.rsvpDeadline}`}
          </strong>
          <small>
            {savedRsvp
              ? `Submitted ${formatDateTime(savedRsvp.submittedAt)}. Last updated ${formatDateTime(savedRsvp.updatedAt)}.`
              : "We can't wait to celebrate with you."}
          </small>
        </div>
        {typeof householdGuestCount === 'number' && (
          <div>
            <strong>
              {householdGuestCount} household guest
              {householdGuestCount === 1 ? '' : 's'}
            </strong>
            <small>
              {maxPlusOnes && maxPlusOnes > 0
                ? `Up to ${maxPlusOnes} plus-one${maxPlusOnes === 1 ? '' : 's'}`
                : 'No plus-ones on this invitation'}
            </small>
          </div>
        )}
      </div>
      <div className={scoped(styles, 'rsvp-context-grid')}>
        <div>
          <Clock aria-hidden="true" />
          <span>
            <strong>{siteContent.dateLabel}</strong>
            <small>
              Ceremony at {siteContent.ceremonyTime}. Reception until{' '}
              {siteContent.receptionTime}.
            </small>
          </span>
        </div>
        <div>
          <MapPin aria-hidden="true" />
          <span>
            <strong>{siteContent.venueName}</strong>
            <small>{siteContent.venueAddress}</small>
          </span>
        </div>
      </div>
      <div className="toolbar-actions">
        <a
          className="secondary-button button-inline"
          href={venueMapHref}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink aria-hidden="true" />
          Open map
        </a>
        <a
          className="secondary-button button-inline"
          href={calendarHref}
          download="matt-alison-wedding.ics"
        >
          <CalendarDays aria-hidden="true" />
          Add to calendar
        </a>
        {showLookupLink && (
          <a className="secondary-button button-inline" href="/rsvp">
            <Search aria-hidden="true" />
            Not you?
          </a>
        )}
      </div>
      {savedRsvp && showLookupLink && (
        <p className={cx('form-message', scoped(styles, 'update-note'))}>
          You&apos;re reviewing an existing response. Make any changes below and
          select Save RSVP to update it.
        </p>
      )}
    </section>
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

function buildRsvpSummary(
  household: Household,
  rsvp: StoredRsvp,
): {
  attending: string[];
  notAttending: string[];
  notes: string[];
} {
  const memberNames = new Map(
    household.members.map((member) => [
      member.id,
      `${member.firstName} ${member.lastName}`,
    ]),
  );
  const attending = rsvp.members
    .filter((member) => member.attending)
    .map((member) => memberNames.get(member.memberId) ?? 'Household guest');
  const notAttending = rsvp.members
    .filter((member) => !member.attending)
    .map((member) => memberNames.get(member.memberId) ?? 'Household guest');

  for (const plusOne of rsvp.plusOnes) {
    const sponsor = memberNames.get(plusOne.sponsorMemberId);
    attending.push(
      `${plusOne.firstName} ${plusOne.lastName}${sponsor ? ` (guest of ${sponsor})` : ''}`,
    );
  }

  const dietaryNotes = [
    ...rsvp.members
      .filter((member) => member.attending && member.dietaryNotes.trim())
      .map((member) => {
        const name = memberNames.get(member.memberId) ?? 'Household guest';
        return `${name}: ${member.dietaryNotes}`;
      }),
    ...rsvp.plusOnes
      .filter((plusOne) => plusOne.dietaryNotes.trim())
      .map(
        (plusOne) =>
          `${plusOne.firstName} ${plusOne.lastName}: ${plusOne.dietaryNotes}`,
      ),
  ];

  return {
    attending,
    notAttending,
    notes: [
      ...dietaryNotes,
      ...(rsvp.notes.trim() ? [`Household note: ${rsvp.notes}`] : []),
    ],
  };
}

function FieldError({
  path,
  errors,
}: {
  path: string;
  errors: RsvpFieldErrorMap;
}) {
  const message = errors[path];
  if (!message) {
    return null;
  }

  return (
    <span
      id={buildFieldErrorId(path)}
      className="field-error-message"
      role="alert"
    >
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
      .filter((member) =>
        form.members.some(
          (entry) => entry.memberId === member.id && entry.attending,
        ),
      )
      .map((member) => member.id),
  );

  if (form.plusOnes.length > household.maxPlusOnes) {
    formMessages.push(
      `This invitation allows up to ${household.maxPlusOnes} plus-one${household.maxPlusOnes === 1 ? '' : 's'}.`,
    );
  }

  form.plusOnes.forEach((plusOne, index) => {
    const sponsorPath = `plusOnes.${index}.sponsorMemberId`;
    if (
      !eligibleSponsorIds.has(plusOne.sponsorMemberId) &&
      !fieldErrors[sponsorPath]
    ) {
      fieldErrors[sponsorPath] =
        'Choose an attending guest who is allowed a plus-one.';
    }
  });

  if (Object.keys(fieldErrors).length === 0 && formMessages.length === 0) {
    return undefined;
  }

  return {
    fieldErrors,
    formMessage:
      formMessages[0] ?? 'Please fix the highlighted fields and try again.',
  };
}

function parseRsvpApiError(error: ApiError): {
  fieldErrors: RsvpFieldErrorMap;
  formMessage: string;
} {
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
      (Object.keys(fieldErrors).length > 0
        ? 'Please fix the highlighted fields and try again.'
        : error.message),
  };
}

function hasGuestOrPlusOneFieldErrors(fieldErrors: RsvpFieldErrorMap): boolean {
  return Object.keys(fieldErrors).some(
    (path) => path.startsWith('members.') || path.startsWith('plusOnes.'),
  );
}

function parseRecoveryApiError(error: ApiError): { contactError: string } {
  let contactError = '';

  for (const detail of error.details) {
    const separatorIndex = detail.indexOf(': ');
    if (separatorIndex === -1) {
      continue;
    }

    const path = detail.slice(0, separatorIndex);
    const rawMessage = normalizeValidationMessage(
      detail.slice(separatorIndex + 2),
    );
    if (path === 'contact' && !contactError) {
      contactError = rawMessage;
    }
  }

  return {
    contactError,
  };
}

function isRsvpFieldPath(path: string): boolean {
  return (
    path === 'notes' ||
    path === 'accessibilityNotes' ||
    path.startsWith('members.') ||
    path.startsWith('plusOnes.')
  );
}

function normalizeValidationMessage(message: string): string {
  if (
    message === 'String must contain at least 1 character(s)' ||
    message === 'Required'
  ) {
    return 'This field is required.';
  }

  const maxLengthMatch = message.match(
    /^String must contain at most (\d+) character\(s\)$/,
  );
  if (maxLengthMatch) {
    return `Please keep this to ${maxLengthMatch[1]} characters or fewer.`;
  }

  return message;
}

function validateRecoveryContact(value: string): string | undefined {
  const parsed = RecoveryContactInputSchema.safeParse(value);
  if (!parsed.success) {
    return 'Enter a valid email address or mobile number.';
  }

  const trimmed = value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const digits = trimmed.replace(/\D/g, '');
  const validPhone =
    (trimmed.startsWith('+') && /^\+[1-9]\d{7,14}$/.test(`+${digits}`)) ||
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith('1'));

  if (!emailPattern.test(trimmed) && !validPhone) {
    return 'Enter a valid email address or mobile number.';
  }

  return undefined;
}

function buildFieldErrorId(path: string): string {
  return `${path.replace(/[^a-z0-9]+/gi, '-')}-error`;
}

function buildGuestRsvpPath(inviteCode: string): string {
  return `/rsvp/${encodeURIComponent(inviteCode)}`;
}

function buildGuestRsvpSuccessPath(inviteCode: string): string {
  return `${buildGuestRsvpPath(inviteCode)}/success`;
}
