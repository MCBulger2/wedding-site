// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  mockDownloadInvitationsCsv,
  mockDownloadRsvpsCsv,
} from './localAdminMock.js';

describe('local admin export mocks', () => {
  it('includes the dinner and plus-one fields used by production exports', async () => {
    const [rsvps, invitations] = await Promise.all([
      mockDownloadRsvpsCsv().then((blob) => blob.text()),
      mockDownloadInvitationsCsv().then((blob) => blob.text()),
    ]);

    expect(rsvps).toContain(
      'rehearsalDinnerInvited,rehearsalDinnerAttending,plusOneInvited,plusOneAttending',
    );
    expect(rsvps).toContain('household_member,h1-1,,Sam,Example,true');
    expect(invitations).toContain(
      'rehearsalDinnerInviteeNames,rehearsalDinnerInviteeCount,weddingResponses,rehearsalDinnerResponses,plusOneInvitedCount,plusOneAttendingCount',
    );
    expect(invitations).toContain('Sam Example; Taylor Example');
    expect(invitations).toContain('Sam Example: Attending; Taylor Example: Declined');
  });
});
