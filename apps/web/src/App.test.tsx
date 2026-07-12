// @vitest-environment jsdom

import type { Household } from '@matt-alison-wedding/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import {
  AdminPage,
  AdminBulkActionsMenu,
  AdminHouseholdsTable,
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
  it('scrolls a hash target into view after the destination route mounts', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.pushState({}, '', '/#details');

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('reapplies hash scrolling after paint and after delayed restoration', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    let postPaint: FrameRequestCallback | undefined;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        postPaint = callback;
        return 1;
      }),
    });
    window.history.pushState({}, '', '/#details');

    try {
      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>,
      );

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(postPaint).toBeTypeOf('function');
      postPaint?.(0);
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(450);
      expect(scrollIntoView).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(window, 'requestAnimationFrame');
    }
  });

  it.each([
    ['wheel input', () => window.dispatchEvent(new WheelEvent('wheel'))],
    [
      'navigation key input',
      () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' })),
    ],
  ])('cancels delayed hash correction after %s', (_label, signalIntent) => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    let postPaint: FrameRequestCallback | undefined;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        postPaint = callback;
        return 1;
      }),
    });
    window.history.pushState({}, '', '/#details');

    try {
      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>,
      );
      postPaint?.(0);
      expect(scrollIntoView).toHaveBeenCalledTimes(2);

      signalIntent();
      vi.advanceTimersByTime(450);

      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(window, 'requestAnimationFrame');
    }
  });

  it('ignores malformed percent-encoded hashes without throwing', () => {
    window.history.pushState({}, '', '/#%E0%A4%A');

    expect(() =>
      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>,
      ),
    ).not.toThrow();
  });

  it('marks the active top-level navigation route', () => {
    window.history.pushState({}, '', '/our-story');

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('link', { name: 'Our Story' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Registry' }).getAttribute('aria-current'),
    ).toBeNull();
  });

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
        'All the above categories exclude text messaging originator opt-in data and consent; this information won’t be shared with any third parties.',
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
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('button', { name: 'Send private RSVP link' })).toBeNull();
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
        /SMS delivery stays disabled until this household opts in through the standalone text preferences page./i,
      ),
    ).not.toBeNull();
  });
});

describe('AdminBulkActionsMenu', () => {
  it('keeps invitation and export actions behind one menu', () => {
    const onSelectAction = vi.fn();
    const onExportRsvps = vi.fn();

    render(
      <AdminBulkActionsMenu
        pendingAction={undefined}
        onSelectAction={onSelectAction}
        onExportRsvps={onExportRsvps}
      />,
    );

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Bulk actions' }),
      { button: 0, ctrlKey: false },
    );

    expect(
      screen.getByRole('menuitem', { name: 'Email invitations' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('menuitem', { name: 'Export invitations' }),
    ).not.toBeNull();
    expect(
      screen.getByRole('menuitem', { name: 'Export QR labels' }),
    ).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Export RSVP CSV' })).not.toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export RSVP CSV' }));
    expect(onExportRsvps).toHaveBeenCalledTimes(1);
  });
});

describe('AdminPage loading states', () => {
  it('uses a silent loading fallback while admin auth initializes', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { container } = render(<AdminPage />);

    expect(screen.getByRole('status').textContent).not.toMatch(
      /Preparing sign-in|Loading admin authentication/i,
    );
    expect(container.querySelector('.loading-mark')).not.toBeNull();
  });
});

describe('AdminHouseholdsTable', () => {
  it('renders desktop table columns and expandable household details', () => {
    render(
      <AdminHouseholdsTable
        records={[
          {
            household: {
              ...household,
              phone: '+14805550100',
              smsConsent: {
                status: 'opted_in',
                phone: '+14805550100',
                source: 'rsvp_form',
                consentedAt: '2026-01-01T00:00:00.000Z',
                consentTextVersion: 'twilio-tollfree-v1',
              },
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
            attendance: {
              invitedGuests: 1,
              attendingGuests: 0,
              declinedGuests: 0,
              pendingGuests: 1,
              plusOneGuests: 0,
            },
            hasRecoverableInviteCode: true,
          },
        ]}
        actionHandlers={{
          onNotify: vi.fn(),
          onEmailInvitation: vi.fn(),
          onEdit: vi.fn(),
          onRotateInviteCode: vi.fn(),
          onManageInvitation: vi.fn(),
          onArchive: vi.fn(),
          onMarkSent: vi.fn(),
          onMarkExported: vi.fn(),
        }}
        editingHouseholdId={undefined}
        editForm={{
          displayName: '',
          email: '',
          phone: '',
          maxPlusOnes: '0',
          mailingAddress: {
            line1: '',
            line2: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US',
          },
          members: [],
        }}
        invitationDetails={{}}
        expandedInvitationHouseholdId={undefined}
        onEditFormChange={vi.fn()}
        onSaveHouseholdEdit={vi.fn()}
        onCancelHouseholdEdit={vi.fn()}
        onRemoveMember={vi.fn()}
        onCopyInviteCode={vi.fn()}
        onCopyInviteLink={vi.fn()}
        onOpenQrCode={vi.fn()}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Household' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Contact' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'RSVP' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Invitation' })).not.toBeNull();
    expect(screen.getByRole('cell', { name: /The Example Family/ })).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Show The Example Family details' }),
    );

    expect(screen.getByText('Taylor Example')).not.toBeNull();
    expect(screen.getByText('Awaiting RSVP')).not.toBeNull();
  });
});
