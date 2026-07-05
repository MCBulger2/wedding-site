import { describe, expect, it, vi } from 'vitest';

describe('shared schema CSP compatibility', () => {
  it('validates shared object schemas without probing Function eval support', async () => {
    const originalFunction = globalThis.Function;
    const functionSpy = vi.fn(() => {
      throw new Error('CSP blocked eval');
    });

    Object.defineProperty(globalThis, 'Function', {
      configurable: true,
      writable: true,
      value: functionSpy,
    });
    vi.resetModules();

    try {
      const { HouseholdSchema } = await import('./index.js');
      const result = HouseholdSchema.safeParse({
        householdId: 'h1',
        displayName: 'The Example Household',
        members: [
          {
            id: 'm1',
            firstName: 'Sam',
            lastName: 'Example',
          },
        ],
        maxPlusOnes: 0,
        rsvpStatus: 'not_started',
        inviteLifecycleStatus: 'generated',
        createdAt: '2026-07-03T20:00:00.000Z',
        updatedAt: '2026-07-03T20:00:00.000Z',
      });

      expect(result.success).toBe(true);
      expect(functionSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'Function', {
        configurable: true,
        writable: true,
        value: originalFunction,
      });
      vi.resetModules();
    }
  });
});
