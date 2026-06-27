// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RsvpLookupPage } from './RsvpPages.js';

const { recoverRsvpLink } = vi.hoisted(() => ({
  recoverRsvpLink: vi.fn(),
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
  recoverRsvpLink,
}));

describe('RsvpLookupPage', () => {
  beforeEach(() => {
    recoverRsvpLink.mockReset();
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
