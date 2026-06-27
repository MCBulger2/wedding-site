import { generateIcs, RsvpUpdateSchema, type Household, type StoredRsvp } from '@matt-alison-wedding/shared';
import { CalendarDays, Heart, Plus, Search, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchRsvp, saveRsvp, type RsvpPayload } from '../api.js';
import { siteContent } from '../siteContent.js';

type RsvpFieldErrorMap = Record<string, string>;

export function RsvpLookupPage() {
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
          Your mailed invitation includes a private RSVP code. Enter it here to
          view or update your household&apos;s response.
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
            <LoadingPulse
              label="Opening your RSVP"
              message="Following your invitation link and loading your household details."
              compact
            />
          </div>
        )}
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

      setMessage(
        error instanceof Error ? error.message : 'Unable to save RSVP',
      );
    }
  };

  return (
    <main className="narrow-page">
      <p className="eyebrow">Private RSVP</p>
      <h1>{household.displayName}</h1>
      <p className="page-lede">
        Respond for everyone listed below. Your invitation includes{' '}
        {household.members.length} household guest
        {household.members.length === 1 ? '' : 's'} and up to{' '}
        {household.maxPlusOnes} plus-one
        {household.maxPlusOnes === 1 ? '' : 's'}.
      </p>
      {savedRsvp && (
        <div className="confirmation-row">
          <p className="form-message">
            Submitted {formatDateTime(savedRsvp.submittedAt)}. Last updated{' '}
            {formatDateTime(savedRsvp.updatedAt)}.
          </p>
          <a
            className="secondary-button button-inline"
            href={calendarHref}
            download="matt-alison-wedding.ics"
          >
            <CalendarDays aria-hidden="true" />
            Add to calendar
          </a>
        </div>
      )}
      <form className="rsvp-form" onSubmit={submit}>
        {status === 'saving' && (
          <div className="inline-loading-shell" aria-live="polite">
            <LoadingPulse
              label="Saving your RSVP"
              message="Updating your response and refreshing your confirmation."
              compact
            />
          </div>
        )}
        {household.members.map((member, memberIndex) => {
          const memberRsvp = form.members.find(
            (item) => item.memberId === member.id,
          )!;
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
                      ? buildFieldErrorId(`members.${memberIndex}.dietaryNotes`)
                      : undefined
                  }
                  aria-invalid={
                    fieldError(`members.${memberIndex}.dietaryNotes`)
                      ? 'true'
                      : 'false'
                  }
                  maxLength={500}
                  value={memberRsvp.dietaryNotes}
                  onChange={(event) => {
                    clearFieldError(`members.${memberIndex}.dietaryNotes`);
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
            </fieldset>
          );
        })}

        {household.maxPlusOnes > 0 && (
          <section className="subsection-card">
            <div className="section-heading">
              <div>
                <h2>Plus-ones</h2>
                <p className="form-message">
                  Add up to {household.maxPlusOnes} guest
                  {household.maxPlusOnes === 1 ? '' : 's'} for attending
                  household members who are allowed a plus-one.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button button-inline"
                onClick={addPlusOne}
                disabled={!canAddPlusOne}
              >
                <Plus aria-hidden="true" />
                Add plus-one
              </button>
            </div>
            {!canAddPlusOne && form.plusOnes.length === 0 && (
              <p className="form-message">
                A guest can be added once an eligible household member is marked
                as attending.
              </p>
            )}
            {form.plusOnes.map((plusOne, index) => (
              <fieldset key={`${plusOne.sponsorMemberId}-${index}`}>
                <legend>Plus-one {index + 1}</legend>
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
                        updatePlusOne(index, { firstName: event.target.value });
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
                        updatePlusOne(index, { lastName: event.target.value });
                      }}
                    />
                    <FieldError
                      path={`plusOnes.${index}.lastName`}
                      errors={fieldErrors}
                    />
                  </label>
                </div>
                <label
                  className={
                    fieldError(`plusOnes.${index}.sponsorMemberId`)
                      ? 'field-error'
                      : undefined
                  }
                >
                  Sponsored by
                  <select
                    aria-label={`Plus-one ${index + 1} sponsor`}
                    aria-describedby={
                      fieldError(`plusOnes.${index}.sponsorMemberId`)
                        ? buildFieldErrorId(`plusOnes.${index}.sponsorMemberId`)
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
                    {eligibleSponsors.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    path={`plusOnes.${index}.sponsorMemberId`}
                    errors={fieldErrors}
                  />
                </label>
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
          </section>
        )}

        <label className={fieldError('notes') ? 'field-error' : undefined}>
          Household notes
          <textarea
            aria-describedby={
              fieldError('notes') ? buildFieldErrorId('notes') : undefined
            }
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
        <label
          className={
            fieldError('accessibilityNotes') ? 'field-error' : undefined
          }
        >
          Accessibility notes
          <textarea
            aria-describedby={
              fieldError('accessibilityNotes')
                ? buildFieldErrorId('accessibilityNotes')
                : undefined
            }
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
          <p
            className={`form-message ${Object.keys(fieldErrors).length > 0 ? 'error-message' : ''}`}
          >
            {message}
          </p>
        )}
      </form>
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
          Thanks, {household.displayName}. Your response was submitted{' '}
          {formatDateTime(savedRsvp.submittedAt)} and last updated{' '}
          {formatDateTime(savedRsvp.updatedAt)}.
        </p>
        <div className="confirmation-row">
          <p className="form-message">
            Need to make a change? You can reopen your invitation link and save
            again.
          </p>
          <a
            className="secondary-button button-inline"
            href={calendarHref}
            download="matt-alison-wedding.ics"
          >
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

function buildFieldErrorId(path: string): string {
  return `${path.replace(/[^a-z0-9]+/gi, '-')}-error`;
}

function LoadingScreen({
  eyebrow,
  title,
  message,
}: {
  eyebrow: string;
  title: string;
  message: string;
}) {
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
