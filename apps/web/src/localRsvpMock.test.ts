import { describe, expect, it } from 'vitest';
import { mockFetchRsvp, mockSaveRsvp } from './localRsvpMock.js';

describe('local RSVP mock', () => {
  it('loads and saves the local RSVP without an API request', async () => {
    const initial = await mockFetchRsvp('LOCALRSVP2027');
    const payload = {
      members: initial.household.members.map((member, index) => ({
        memberId: member.id,
        attending: index === 0,
        mealChoice: index === 0 ? ('buffet' as const) : ('none' as const),
        dietaryNotes: '',
      })),
      plusOnes: [],
      notes: 'Testing locally',
      accessibilityNotes: '',
    };

    expect(initial.rsvp).toBeUndefined();
    await mockSaveRsvp('LOCALRSVP2027', payload);

    await expect(mockFetchRsvp('LOCALRSVP2027')).resolves.toMatchObject({
      rsvp: { notes: 'Testing locally' },
    });
  });
});
