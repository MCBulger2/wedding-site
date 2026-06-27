// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(
      screen.queryByLabelText('Email or mobile number'),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: "Don't have a code?" }),
    );

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

    fireEvent.click(
      screen.getByRole('button', { name: "Don't have a code?" }),
    );
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

    fireEvent.click(
      screen.getByRole('button', { name: "Don't have a code?" }),
    );
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

  it('preserves the invitation-code submit flow', () => {
    render(<RsvpLookupPage />);

    fireEvent.change(screen.getByLabelText('Invitation code'), {
      target: { value: 'invite-code-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'View RSVP' }));

    expect(window.location.assign).toHaveBeenCalledWith(
      '/rsvp/invite-code-123',
    );
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

    fireEvent.click(
      screen.getByRole('button', { name: 'Taylor Example not attending' }),
    );

    expect(
      screen.getByText(
        'No additional details needed for guests who are not attending.',
      ),
    ).not.toBeNull();
  });

  it('keeps meal choice support in the saved payload without exposing controls', async () => {
    fetchRsvp.mockResolvedValue({ household });
    saveRsvp.mockResolvedValue({ household, rsvp: savedRsvp });

    render(<RsvpPage inviteCode="invite-code-123" />);

    await screen.findByRole('heading', { name: 'The Example Household' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Taylor Example not attending' }),
    );
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
    expect(screen.getByText('Sam Example')).not.toBeNull();
    expect(screen.getByText('Taylor Example')).not.toBeNull();
    expect(screen.getByText('Jamie Guest (guest of Sam Example)')).not.toBeNull();
    expect(screen.queryByText('Accessibility: Please seat near an aisle.')).toBeNull();
    expect(screen.queryByText('Meal summary')).toBeNull();
  });
});
