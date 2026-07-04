// @vitest-environment jsdom

import type { Household } from '@matt-alison-wedding/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import {
  HouseholdCardActions,
  HouseholdNotificationForm,
} from './pages/AdminPage.js';
import { ThemeProvider } from './theme.js';

const household = {
  householdId: 'household-1',
  displayName: 'The Example Family',
  email: 'example@example.com',
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
} as Household;

describe('HouseholdCardActions', () => {
  it('opens the menu and closes it with Escape or menu selection', () => {
    const onNotify = vi.fn();
    render(
      <HouseholdCardActions
        household={household}
        initialMenuOpen={false}
        canNotify
        canEmailInvitation
        onNotify={onNotify}
        onEmailInvitation={() => {}}
        onEdit={() => {}}
        onRotateInviteCode={() => {}}
        onManageInvitation={() => {}}
        onArchive={() => {}}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: /actions/i }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole('menu')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /email invitation/i })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /view invitation/i })).not.toBeNull();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.pointerDown(screen.getByRole('button', { name: /actions/i }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole('menuitem', { name: /notify/i }));
    expect(onNotify).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('App routes', () => {
  it('renders the terms route', () => {
    window.history.pushState({}, '', '/terms');

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Terms' }),
    ).not.toBeNull();
    expect(
      screen.getByText(/Reply HELP for help or STOP to opt out./i),
    ).not.toBeNull();
  });

  it('renders the privacy route', () => {
    window.history.pushState({}, '', '/privacy');

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Privacy' }),
    ).not.toBeNull();
    expect(
      screen.getByText(
        'SMS opt-in data and consent will not be shared with third parties.',
      ),
    ).not.toBeNull();
  });

  it('renders the SMS proof route', () => {
    window.history.pushState({}, '', '/sms-opt-in-proof');

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'SMS opt-in proof' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Send private RSVP link' }),
    ).not.toBeNull();
  });
});

describe('HouseholdNotificationForm', () => {
  it('hides the SMS option when consent is missing', () => {
    render(
      <HouseholdNotificationForm
        household={{ ...household, phone: '+14805550100' }}
        form={{ channel: 'email', subject: 'Update', message: '' }}
        setForm={vi.fn()}
        sending={false}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(
      screen.queryByRole('option', { name: 'SMS' }),
    ).toBeNull();
    expect(
      screen.getByText(
        /SMS delivery stays disabled until this household opts in through the RSVP or recovery form./i,
      ),
    ).not.toBeNull();
  });
});
