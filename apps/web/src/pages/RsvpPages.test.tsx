// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api.js';
import { RsvpLookupPage, RsvpPage, RsvpSuccessPage } from './RsvpPages.js';

const { fetchRsvp, recoverRsvpLink, saveRsvp } = vi.hoisted(() => ({
  fetchRsvp: vi.fn(),
  recoverRsvpLink: vi.fn(),
  saveRsvp: vi.fn(),
}));

vi.mock('../api.js', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
      readonly details: string[] = [],
    ) {
      super(message);
    }
  },
  fetchRsvp,
  recoverRsvpLink,
  saveRsvp,
}));

const household = {
  householdId: 'h1',
  displayName: 'The Example Household',
  members: [
    {
      id: 'h1-1',
      firstName: 'Sam',
      lastName: 'Example',
      canBringPlusOne: true,
      rehearsalDinnerInvited: false,
    },
    {
      id: 'h1-2',
      firstName: 'Taylor',
      lastName: 'Example',
      canBringPlusOne: false,
      rehearsalDinnerInvited: false,
    },
  ],
  maxPlusOnes: 1,
  rsvpStatus: 'not_started',
  inviteLifecycleStatus: 'generated',
  createdAt: '2026-06-15T22:00:00.000Z',
  updatedAt: '2026-06-15T22:00:00.000Z',
};

const savedRsvp = {
  members: [
    {
      memberId: 'h1-1',
      attending: true,
      mealChoice: 'buffet',
      dietaryNotes: 'No nuts.',
    },
    {
      memberId: 'h1-2',
      attending: false,
      mealChoice: 'none',
      dietaryNotes: '',
    },
  ],
  plusOnes: [
    {
      sponsorMemberId: 'h1-1',
      firstName: 'Jamie',
      lastName: 'Guest',
      mealChoice: 'buffet',
      dietaryNotes: 'Gluten-free dessert if available.',
    },
  ],
  notes: 'Excited to celebrate.',
  accessibilityNotes: 'Please seat near an aisle.',
  submittedAt: '2026-06-15T22:05:00.000Z',
  updatedAt: '2026-06-15T22:07:00.000Z',
};

describe('RsvpLookupPage', () => {
  beforeEach(() => {
    fetchRsvp.mockReset();
    recoverRsvpLink.mockReset();
    saveRsvp.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: vi.fn(),
      },
    });
  });

  it('keeps the lost-code form collapsed by default and expands it with focus', async () => {
    render(<RsvpLookupPage />);

    expect(screen.queryByLabelText('Email or mobile number')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: "Don't have a code?" }));

    const recoveryInput = await screen.findByLabelText(
      'Email or mobile number',
    );
    expect(
      screen
        .getByRole('button', { name: "Don't have a code?" })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(recoveryInput));
  });

  it('validates recovery contact input before submitting', async () => {
    render(<RsvpLookupPage />);

    fireEvent.click(screen.getByRole('button', { name: "Don't have a code?" }));
    fireEvent.change(screen.getByLabelText('Email or mobile number'), {
      target: { value: 'not-a-contact' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send private RSVP link' }),
    );

    expect(recoverRsvpLink).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Enter a valid email address or mobile number.'),
    ).not.toBeNull();
  });

  it('shows generic success copy after recovery submit', async () => {
    recoverRsvpLink.mockResolvedValue({
      accepted: true,
      message:
        "If that matches our guest list, we'll send your private RSVP link.",
    });
    render(<RsvpLookupPage />);

    fireEvent.click(screen.getByRole('button', { name: "Don't have a code?" }));
    fireEvent.change(screen.getByLabelText('Email or mobile number'), {
      target: { value: 'sam@example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send private RSVP link' }),
    );

    await waitFor(() =>
      expect(recoverRsvpLink).toHaveBeenCalledWith({
        contact: 'sam@example.com',
      }),
    );
    expect(
      await screen.findByText(
        "If that matches our guest list, we'll send your private RSVP link.",
      ),
    ).not.toBeNull();
  });

  it('requires explicit SMS consent before phone recovery submits', async () => {
    render(<RsvpLookupPage />);

    fireEvent.click(screen.getByRole('button', { name: "Don't have a code?" }));
    fireEvent.change(screen.getByLabelText('Email or mobile number'), {
      target: { value: '(480) 555-0100' },
    });

    expect(
      await screen.findByText(/I agree to receive SMS messages from Matt & Alison Wedding/i),
    ).not.toBeNull();
    const consentCheckbox = screen.getByRole('checkbox');
    expect((consentCheckbox as HTMLInputElement).checked).toBe(false);

    fireEvent.click(
      screen.getByRole('button', { name: 'Send private RSVP link' }),
    );

    expect(recoverRsvpLink).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'Please confirm SMS consent before requesting a texted RSVP link.',
      ),
    ).not.toBeNull();

    fireEvent.click(consentCheckbox);
    fireEvent.click(
      screen.getByRole('button', { name: 'Send private RSVP link' }),
    );

    await waitFor(() =>
      expect(recoverRsvpLink).toHaveBeenCalledWith({
        contact: '(480) 555-0100',
        smsConsentAccepted: true,
      }),
    );
  });

  it('preserves the invitation-code submit flow', () => {
    render(<RsvpLookupPage />);

    fireEvent.change(screen.getByLabelText('Invitation code'), {
      target: { value: 'a2b3c4d5e6' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'View RSVP' }));

    expect(window.location.assign).toHaveBeenCalledWith('/rsvp/A2B3C4D5E6');
  });
});

describe('RsvpPage', () => {
  beforeEach(() => {
    fetchRsvp.mockReset();
    recoverRsvpLink.mockReset();
    saveRsvp.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: vi.fn(),
      },
    });
  });

  it('shows clear attendance controls while keeping meal choice hidden', async () => {
    fetchRsvp.mockResolvedValue({ household });

    render(<RsvpPage inviteCode="invite-code-123" />);

    expect(
      await screen.findByRole('heading', { name: 'The Example Household' }),
    ).not.toBeNull();
    expect(screen.getByText('Step 1 of 3 · Guests')).not.toBeNull();
    expect(screen.getByRole('heading', { name: "Who's coming?" })).not.toBeNull();
    expect(screen.queryByLabelText('Household notes')).toBeNull();
    expect(screen.queryByText('Text updates')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Sam Example attending' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Taylor Example not attending' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Sam Example meal choice')).toBeNull();
    expect(screen.queryByLabelText('Accessibility notes')).toBeNull();
    expect(screen.getByLabelText('RSVP details')).not.toBeNull();
    expect(screen.queryByLabelText('Wedding event at a glance')).toBeNull();
    expect(screen.getByText('January 18, 2027')).not.toBeNull();
    expect(screen.getByText(/Ceremony at 4:30 PM/i)).not.toBeNull();
    expect(screen.getByText('Superstition Manor')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Open map/i })).not.toBeNull();
    expect(
      screen.getAllByRole('link', { name: /Add to calendar/i }),
    ).toHaveLength(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Taylor Example not attending' }),
    );

    expect(
      screen.getByText(
        'No additional details needed for guests who are not attending.',
      ),
    ).not.toBeNull();
  });

  it('integrates plus-one fields with the household guest list', async () => {
    fetchRsvp.mockResolvedValue({ household });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: "Who's coming?" });
    fireEvent.click(screen.getByRole('button', { name: 'Add plus-one' }));

    expect(screen.queryByText('Optional plus-one')).toBeNull();
    expect(screen.getByText('Guest of Sam Example')).not.toBeNull();
    expect(screen.getByLabelText('Plus-one 1 first name')).not.toBeNull();
    expect(screen.getByLabelText('Plus-one 1 last name')).not.toBeNull();
    expect(screen.getByLabelText('Plus-one 1 dietary notes')).not.toBeNull();
    expect(screen.queryByLabelText('Household notes')).toBeNull();
  });

  it('moves details-only fields to the second RSVP step', async () => {
    fetchRsvp.mockResolvedValue({ household });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: "Who's coming?" });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to details' }));

    expect(screen.getByText('Step 2 of 3 · Details')).not.toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Anything else we should know?' }),
    ).not.toBeNull();
    expect(screen.getByLabelText('Household notes')).not.toBeNull();
    expect(screen.getByText('Text updates')).not.toBeNull();
    expect(screen.queryByLabelText('Plus-one 1 first name')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', {
          name: 'Anything else we should know?',
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to guests' }));

    expect(screen.getByRole('heading', { name: "Who's coming?" })).not.toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: "Who's coming?" }),
      ),
    );
  });

  it('returns to guests when hidden plus-one fields fail validation on submit', async () => {
    fetchRsvp.mockResolvedValue({ household });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: "Who's coming?" });
    fireEvent.click(screen.getByRole('button', { name: 'Add plus-one' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save RSVP' }));

    expect(screen.getByText('Step 1 of 3 · Guests')).not.toBeNull();
    expect(
      screen
        .getByLabelText('Plus-one 1 first name')
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      screen
        .getByLabelText('Plus-one 1 last name')
        .getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('returns to guests when the API reports hidden plus-one field errors', async () => {
    fetchRsvp.mockResolvedValue({ household });
    saveRsvp.mockRejectedValue(
      new ApiError('Invalid RSVP', 422, [
        'plusOnes.0.firstName: First name is required.',
      ]),
    );

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: "Who's coming?" });
    fireEvent.click(screen.getByRole('button', { name: 'Add plus-one' }));
    fireEvent.change(screen.getByLabelText('Plus-one 1 first name'), {
      target: { value: 'Jamie' },
    });
    fireEvent.change(screen.getByLabelText('Plus-one 1 last name'), {
      target: { value: 'Guest' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save RSVP' }));

    await screen.findByText('Please fix the highlighted fields and try again.');
    expect(screen.getByText('Step 1 of 3 · Guests')).not.toBeNull();
    expect(
      screen
        .getByLabelText('Plus-one 1 first name')
        .getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('keeps meal choice support in the saved payload without exposing controls', async () => {
    fetchRsvp.mockResolvedValue({ household });
    saveRsvp.mockResolvedValue({ household, rsvp: savedRsvp });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: 'The Example Household' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Taylor Example not attending' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue to details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save RSVP' }));

    await waitFor(() => expect(saveRsvp).toHaveBeenCalled());
    expect(saveRsvp.mock.calls[0][1]).toMatchObject({
      members: [
        { memberId: 'h1-1', attending: true, mealChoice: 'buffet' },
        { memberId: 'h1-2', attending: false, mealChoice: 'none' },
      ],
      accessibilityNotes: '',
    });
  });

  it('shows an unchecked SMS consent checkbox and updates the submit label when selected', async () => {
    fetchRsvp.mockResolvedValue({ household });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: 'The Example Household' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to details' }));
    expect(
      screen.getByText('Text updates'),
    ).not.toBeNull();
    expect(
      screen.getByText(/Get RSVP recovery, schedule updates, and wedding logistics by text./i),
    ).not.toBeNull();
    expect(
      screen.getByText('Consent not recorded'),
    ).not.toBeNull();
    expect(
      screen.getByText(/I agree to receive SMS messages from Matt & Alison Wedding/i),
    ).not.toBeNull();

    const consentCheckbox = screen.getByRole('checkbox');
    expect((consentCheckbox as HTMLInputElement).checked).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Save RSVP' }),
    ).not.toBeNull();

    fireEvent.click(consentCheckbox);

    expect(
      screen.getByRole('button', { name: 'Save RSVP and text preferences' }),
    ).not.toBeNull();
  });

  it('shows recorded SMS consent in the text updates panel', async () => {
    fetchRsvp.mockResolvedValue({
      household: {
        ...household,
        phone: '+14805550100',
        smsConsent: {
          status: 'opted_in',
          phone: '+14805550100',
          source: 'rsvp_form',
          consentedAt: '2026-06-15T22:05:00.000Z',
          consentTextVersion: 'twilio-tollfree-v1',
        },
      },
    });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: 'The Example Household' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to details' }));

    expect(screen.getByText('Consent recorded')).not.toBeNull();
    expect(screen.getByText('+14805550100')).not.toBeNull();
  });
});

describe('RsvpSuccessPage', () => {
  beforeEach(() => {
    fetchRsvp.mockReset();
    recoverRsvpLink.mockReset();
    saveRsvp.mockReset();
  });

  it('summarizes the saved response without meal controls', async () => {
    fetchRsvp.mockResolvedValue({ household, rsvp: savedRsvp });

    render(<RsvpSuccessPage inviteCode="invite-code-123" />);

    expect(
      await screen.findByRole('heading', { name: 'RSVP received' }),
    ).not.toBeNull();
    expect(screen.getByText('Step 3 of 3 · Confirmation complete')).not.toBeNull();
    expect(
      screen.getByText('Thanks, The Example Household. Your response has been saved.'),
    ).not.toBeNull();
    expect(screen.getByText('Sam Example')).not.toBeNull();
    expect(screen.getByText('Taylor Example')).not.toBeNull();
    expect(screen.getByText('Jamie Guest (guest of Sam Example)')).not.toBeNull();
    expect(screen.queryByText('Accessibility: Please seat near an aisle.')).toBeNull();
    expect(screen.queryByText('Meal summary')).toBeNull();
    expect(screen.getByLabelText('RSVP details')).not.toBeNull();
    expect(screen.queryByLabelText('Wedding event at a glance')).toBeNull();
    expect(
      screen.getAllByRole('link', { name: /Add to calendar/i }),
    ).toHaveLength(1);
    expect(screen.queryByText('Plus-ones (1)')).toBeNull();
    expect(screen.getByRole('link', { name: /Open map/i })).not.toBeNull();
    expect(
      screen.getByRole('link', { name: 'Review or update RSVP' }),
    ).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back home' })).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: /Submit RSVP/i }),
    ).toBeNull();
  });
});
