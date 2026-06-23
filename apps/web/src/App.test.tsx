// @vitest-environment jsdom

import type { Household } from '@matt-alison-wedding/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HouseholdCardActions } from './App';

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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Household;

describe('HouseholdCardActions', () => {
  it('opens the menu and closes it with Escape or by clicking outside', () => {
    render(
      <HouseholdCardActions
        household={household}
        revealedInvite={{
          householdId: 'household-1',
          displayName: 'The Example Family',
          inviteCode: 'invite-code-123',
          inviteCodeHash: 'hash',
        }}
        isInviteExpanded={false}
        initialMenuOpen={false}
        canNotify
        onNotify={() => {}}
        onEdit={() => {}}
        onRotateInviteCode={() => {}}
        onToggleInvite={() => {}}
        onOpenQrCode={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByRole('menu')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /invitation qr/i })).not.toBeNull();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
