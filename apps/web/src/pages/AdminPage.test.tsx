// @vitest-environment jsdom

import type { AdminHouseholdRecord } from '@matt-alison-wedding/shared';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  fetchAdminAuthConfig,
  completeAdminLogin,
  loadAdminSession,
  sendHouseholdNotification,
  fetchHouseholds,
} = vi.hoisted(() => ({
  fetchAdminAuthConfig: vi.fn(),
  completeAdminLogin: vi.fn(),
  loadAdminSession: vi.fn(),
  sendHouseholdNotification: vi.fn(),
  fetchHouseholds: vi.fn(),
}));

vi.mock('../api.js', () => ({
  archiveHousehold: vi.fn(),
  createHousehold: vi.fn(),
  downloadAddressLabelsPdf: vi.fn(),
  downloadInvitationLabelsPdf: vi.fn(),
  downloadInvitationsCsv: vi.fn(),
  downloadReturnAddressLabelsPdf: vi.fn(),
  downloadRsvpsCsv: vi.fn(),
  emailHouseholdInvitation: vi.fn(),
  emailInvitations: vi.fn(),
  fetchAdminAuthConfig,
  fetchHouseholds,
  removeHouseholdMember: vi.fn(),
  revealInvitation: vi.fn(),
  rotateInviteCode: vi.fn(),
  sendHouseholdNotification,
  updateHousehold: vi.fn(),
  updateHouseholdMember: vi.fn(),
  updateInviteLifecycleStatus: vi.fn(),
}));

vi.mock('../adminAuth.js', () => ({
  beginAdminLogin: vi.fn(),
  beginAdminLogout: vi.fn(),
  clearAdminSession: vi.fn(),
  completeAdminLogin,
  getAdminProfileName: vi.fn(() => 'Admin Person'),
  loadAdminSession,
}));

vi.mock('../localAdminMock.js', () => ({
  createLocalAdminMockSession: vi.fn(),
  localAdminMockAuthConfig: undefined,
  localAdminMockEnabled: false,
}));

import { AdminPage } from './AdminPage.js';

const householdRecord: AdminHouseholdRecord = {
  household: {
    householdId: 'household-1',
    displayName: 'The Example Family',
    email: 'example@example.com',
    phone: '+14805550100',
    smsConsent: {
      status: 'opted_in',
      phone: '+14805550100',
      source: 'rsvp_form',
      consentedAt: '2026-01-01T00:00:00.000Z',
      consentTextVersion: 'twilio-tollfree-v1',
    },
    members: [
      {
        id: 'member-1',
        firstName: 'Taylor',
        lastName: 'Example',
        canBringPlusOne: false,
        weddingPartyRole: '',
        rehearsalDinnerInvited: false,
        archivedAt: undefined,
      },
    ],
    maxPlusOnes: 0,
    rsvpStatus: 'not_started',
    inviteLifecycleStatus: 'generated',
    inviteCodeHash: 'hash',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  attendance: {
    invitedGuests: 1,
    attendingGuests: 0,
    declinedGuests: 0,
    pendingGuests: 1,
    plusOneGuests: 0,
  },
  hasRecoverableInviteCode: true,
};

describe('AdminPage admin notifications', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps SMS status and channel controls out of the admin notification flow', async () => {
    fetchAdminAuthConfig.mockResolvedValue({
      userPoolId: 'pool',
      userPoolClientId: 'client',
      userPoolDomain: 'https://auth.example.com',
      redirectUri: 'http://localhost/admin',
      logoutUri: 'http://localhost/',
    });
    completeAdminLogin.mockResolvedValue(null);
    loadAdminSession.mockReturnValue({
      accessToken: 'admin-token',
      idToken: 'id-token',
      expiresAt: Date.now() + 60_000,
      email: 'admin@example.com',
    });
    fetchHouseholds.mockResolvedValue({ households: [householdRecord] });
    sendHouseholdNotification.mockResolvedValue({
      channel: 'email',
      deliveredTo: 'example@example.com',
    });

    render(<AdminPage />);

    expect(
      (
        await screen.findByRole('status', {
          name: 'Admin dashboard status',
        })
      ).textContent,
    ).toBe('1 households loaded.');
    expect(document.body.textContent).not.toMatch(/SMS active for|Twilio/i);

    fireEvent.click(screen.getByRole('button', { name: 'Create household' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Use a US 10-digit number or E.164 format such as +14805550100.',
        ),
      ).not.toBeNull(),
    );
    expect(document.body.textContent).not.toMatch(/for SMS/i);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.pointerDown(
      screen.getAllByRole('button', { name: 'Actions' })[0],
      {
        button: 0,
        ctrlKey: false,
      },
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Notify' }));

    const notificationDialog = await screen.findByRole('dialog', {
      name: 'Notify The Example Family',
    });
    expect(screen.queryByLabelText('Delivery channel')).toBeNull();
    expect(
      within(notificationDialog).getByText('example@example.com'),
    ).not.toBeNull();
    expect(
      (
        within(notificationDialog).getByLabelText(
          'Notification subject',
        ) as HTMLInputElement
      ).value,
    ).toBe('Wedding update for The Example Family');
    expect(document.body.textContent).not.toMatch(/sms|twilio|help|stop/i);

    fireEvent.change(
      within(notificationDialog).getByLabelText('Notification subject'),
      {
        target: { value: 'Travel update' },
      },
    );
    fireEvent.change(
      within(notificationDialog).getByLabelText('Notification message'),
      {
        target: { value: 'The shuttle now departs at 4:15 PM.' },
      },
    );
    fireEvent.click(
      within(notificationDialog).getByRole('button', { name: 'Send update' }),
    );

    await waitFor(() =>
      expect(sendHouseholdNotification).toHaveBeenCalledWith(
        'admin-token',
        'household-1',
        {
          channel: 'email',
          subject: 'Travel update',
          message: 'The shuttle now departs at 4:15 PM.',
        },
      ),
    );
  });
});
