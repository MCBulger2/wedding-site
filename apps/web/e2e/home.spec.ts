import { expect, test } from '@playwright/test';

const adminAuthConfig = {
  clientId: 'admin-client-id',
  userPoolDomain: 'https://wedding-admin.auth.us-west-1.amazoncognito.com',
  scopes: ['openid', 'email', 'profile'],
};

const household = {
  householdId: 'h1',
  displayName: 'The Example Household',
  email: 'sam@example.com',
  members: [
    {
      id: 'h1-1',
      firstName: 'Sam',
      lastName: 'Example',
      canBringPlusOne: true,
    },
    {
      id: 'h1-2',
      firstName: 'Taylor',
      lastName: 'Example',
      canBringPlusOne: false,
    },
  ],
  maxPlusOnes: 1,
  rsvpStatus: 'not_started',
  inviteLifecycleStatus: 'generated',
  inviteCodeHash: 'hash-value',
  mailingAddress: {
    line1: '123 Main St',
    line2: '',
    city: 'Phoenix',
    state: 'AZ',
    postalCode: '85001',
    country: 'USA',
  },
  inviteCodeLastRotatedAt: '2026-06-15T22:00:00.000Z',
  inviteCodeGeneratedAt: '2026-06-15T22:00:00.000Z',
  createdAt: '2026-06-15T22:00:00.000Z',
  updatedAt: '2026-06-15T22:00:00.000Z',
};

test('homepage renders wedding announcement and details', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Matt & Alison' }),
  ).toBeVisible();
  await expect(page.getByText('Wedding Announcement')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Find your RSVP' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Registry' }),
  ).toHaveAttribute('href', '/registry');
  await expect(
    page.getByRole('heading', { name: 'Wedding day' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Desert Garden Venue' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open map' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add to calendar' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Where to stay' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sonoran Courtyard Hotel' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Wedding registry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'View registry' }),
  ).toHaveAttribute('href', '/registry');
  await expect(
    page.getByRole('heading', { name: 'Guest notes' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Admin' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Admin' }),
  ).toBeVisible();
});

test('homepage details render on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(
    page.getByLabel('Wedding highlights').getByText('March 20, 2027'),
  ).toBeVisible();
  await expect(
    page.getByText('Ceremony at 3:00 PM; reception at 5:00 PM'),
  ).toBeVisible();
  await expect(
    page.getByText('Phoenix Sky Harbor International Airport'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add to calendar' }),
  ).toHaveAttribute('href', /^data:text\/calendar/);
});

test('registry page renders coming soon state', async ({ page }) => {
  await page.goto('/registry');

  await expect(
    page.getByRole('heading', { name: 'Wedding registry' }),
  ).toBeVisible();
  await expect(
    page.getByText('Your presence is the best gift.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Registry details coming soon' }),
  ).toBeVisible();
  await expect(
    page.getByText('Check back closer to the celebration'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to wedding details' }),
  ).toHaveAttribute('href', '/');
  await expect(page.getByLabel('Registry links')).toHaveCount(0);
});

test('registry page renders on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/registry');

  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Registry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Wedding registry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Registry details coming soon' }),
  ).toBeVisible();
});

test('rsvp entry keeps footer pinned to the viewport bottom on tall screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1400 });
  await page.goto('/rsvp');

  const footerBounds = await page.getByRole('contentinfo').boundingBox();
  const viewport = page.viewportSize();
  const pixelTolerance = 1;
  expect(footerBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(footerBounds!.y + footerBounds!.height).toBeGreaterThanOrEqual(
    viewport!.height - pixelTolerance,
  );
});

test('admin route shows a minimal sign-in entry point', async ({ page }) => {
  await page.route('**/api/admin/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthConfig),
    });
  });

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: 'Admin sign in' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await expect(
    page.getByText('Manage RSVPs, households, and invitations.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('guest can look up an invite code and submit an RSVP', async ({
  page,
}) => {
  let savedBody: any;
  let savedRsvp: any;

  await page.route('**/api/rsvp/test-invite-code-123', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          savedRsvp
            ? {
                household: { ...household, rsvpStatus: 'partial' },
                rsvp: savedRsvp,
              }
            : { household },
        ),
      });
      return;
    }

    savedBody = route.request().postDataJSON();
    savedRsvp = {
      ...savedBody,
      submittedAt: '2026-06-15T22:05:00.000Z',
      updatedAt: '2026-06-15T22:07:00.000Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        household: { ...household, rsvpStatus: 'partial' },
        rsvp: savedRsvp,
      }),
    });
  });

  await page.goto('/rsvp');
  await page.getByLabel('Invitation code').fill('test-invite-code-123');
  await page.getByRole('button', { name: 'View RSVP' }).click();

  await expect(page).toHaveURL(/\/rsvp\/test-invite-code-123$/);
  await expect(
    page.getByRole('heading', { name: 'The Example Household' }),
  ).toBeVisible();

  await page.getByLabel('Taylor Example attending').uncheck();
  await page.getByRole('button', { name: 'Add plus-one' }).click();
  await page.getByRole('button', { name: 'Save RSVP' }).click();

  await expect(page.getByLabel('Plus-one 1 first name')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('Plus-one 1 last name')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page.getByText('Please fix the highlighted fields and try again.'),
  ).toBeVisible();

  await page.getByLabel('Plus-one 1 first name').fill('Jamie');
  await page.getByLabel('Plus-one 1 last name').fill('Guest');
  await page.getByLabel('Household notes').fill('Excited to celebrate.');
  await page.getByRole('button', { name: 'Save RSVP' }).click();

  expect(savedBody).toMatchObject({
    members: [
      { memberId: 'h1-1', attending: true, mealChoice: 'buffet' },
      { memberId: 'h1-2', attending: false, mealChoice: 'none' },
    ],
    plusOnes: [
      {
        sponsorMemberId: 'h1-1',
        firstName: 'Jamie',
        lastName: 'Guest',
        mealChoice: 'buffet',
      },
    ],
    notes: 'Excited to celebrate.',
  });

  await expect(page).toHaveURL(/\/rsvp\/test-invite-code-123\/success$/);
  await expect(
    page.getByRole('heading', { name: 'RSVP received' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Review or update RSVP' }),
  ).toBeVisible();
  await expect(page.getByText('submitted')).toBeVisible();
});

test('admin route is reachable, can create households, and shows RSVP results', async ({
  page,
}) => {
  let households: Array<{
    household: Record<string, unknown>;
    attendance: Record<string, number>;
    rsvp?: Record<string, unknown>;
  }> = [
    {
      household: { ...household, rsvpStatus: 'partial' },
      attendance: {
        invitedGuests: 3,
        attendingGuests: 2,
        declinedGuests: 1,
        pendingGuests: 0,
        plusOneGuests: 1,
      },
      rsvp: {
        members: [
          {
            memberId: 'h1-1',
            attending: true,
            mealChoice: 'buffet',
            dietaryNotes: '',
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
            dietaryNotes: '',
          },
        ],
        notes: 'Excited to celebrate.',
        accessibilityNotes: '',
        submittedAt: '2026-06-15T22:05:00.000Z',
        updatedAt: '2026-06-15T22:07:00.000Z',
      },
    },
  ];

  await page.route('**/api/admin/households', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ households }),
      });
      return;
    }

    const payload = route.request().postDataJSON() as {
      displayName: string;
      email: string;
      maxPlusOnes: number;
      mailingAddress?: Record<string, string>;
      members: Array<{
        firstName: string;
        lastName: string;
        canBringPlusOne: boolean;
      }>;
    };
    const newHousehold = {
      householdId: 'h2',
      displayName: payload.displayName,
      email: payload.email,
      members: payload.members.map((member, index) => ({
        id: `h2-${index + 1}`,
        firstName: member.firstName,
        lastName: member.lastName,
        canBringPlusOne: member.canBringPlusOne,
      })),
      maxPlusOnes: payload.maxPlusOnes,
      rsvpStatus: 'not_started',
      inviteLifecycleStatus: 'generated',
      inviteCodeHash: 'new-hash-value',
      mailingAddress: payload.mailingAddress,
      inviteCodeLastRotatedAt: '2026-06-15T22:10:00.000Z',
      inviteCodeGeneratedAt: '2026-06-15T22:10:00.000Z',
      createdAt: '2026-06-15T22:10:00.000Z',
      updatedAt: '2026-06-15T22:10:00.000Z',
    };

    households = [
      {
        household: newHousehold,
        attendance: {
          invitedGuests: newHousehold.members.length + newHousehold.maxPlusOnes,
          attendingGuests: 0,
          declinedGuests: 0,
          pendingGuests: newHousehold.members.length,
          plusOneGuests: 0,
        },
      },
      ...households,
    ];

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ household: newHousehold }),
    });
  });

  await page.route('**/api/admin/households/h2/invite-code', async (route) => {
    households = households.map((record) =>
      record.household.householdId === 'h2'
        ? {
            ...record,
            household: {
              ...record.household,
              inviteCodeHash: 'hash-value',
              inviteCodeLastRotatedAt: '2026-06-15T22:10:00.000Z',
              updatedAt: '2026-06-15T22:10:00.000Z',
            },
          }
        : record,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        inviteCode: 'fresh-invite-code-456',
        inviteCodeHash: 'hash-value',
      }),
    });
  });

  await page.route('**/api/admin/households/h1', async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON() as {
        displayName: string;
        email: string;
        maxPlusOnes: number;
        mailingAddress?: Record<string, string>;
      };
      households = households.map((record) =>
        record.household.householdId === 'h1'
          ? {
              ...record,
              household: {
                ...record.household,
                ...payload,
                updatedAt: '2026-06-15T22:20:00.000Z',
              },
            }
          : record,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          household: households.find(
            (record) => record.household.householdId === 'h1',
          )?.household,
        }),
      });
      return;
    }

    households = households.map((record) =>
      record.household.householdId === 'h1'
        ? {
            ...record,
            household: {
              ...record.household,
              archivedAt: '2026-06-15T22:25:00.000Z',
              inviteLifecycleStatus: 'archived',
            },
          }
        : record,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        household: households.find(
          (record) => record.household.householdId === 'h1',
        )?.household,
      }),
    });
  });

  await page.route('**/api/admin/households/h1/members/*', async (route) => {
    const memberId = route.request().url().split('/').pop() ?? '';
    const payload = route.request().postDataJSON() as {
      firstName: string;
      lastName: string;
      canBringPlusOne: boolean;
      weddingPartyRole: string;
      rehearsalDinnerInvited: boolean;
    };
    households = households.map((record) =>
      record.household.householdId === 'h1'
        ? {
            ...record,
            household: {
              ...record.household,
              members: (
                record.household.members as Array<Record<string, unknown>>
              ).map((member) =>
                member.id === memberId ? { ...member, ...payload } : member,
              ),
            },
          }
        : record,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        household: households.find(
          (record) => record.household.householdId === 'h1',
        )?.household,
      }),
    });
  });

  await page.route('**/api/admin/rsvps/export', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'householdId,household\nh1,The Example Household',
    });
  });

  await page.route('**/api/admin/invitations/export', async (route) => {
    households = households.map((record) => ({
      ...record,
      household: {
        ...record.household,
        inviteLifecycleStatus: 'exported',
        inviteExportedAt: '2026-06-15T22:15:00.000Z',
      },
    }));
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body:
        'householdId,household,rsvpUrl,qrCodeDataUrl\n' +
        'h1,The Example Household,https://example.com/rsvp/code,"data:image/png;base64,abc"',
    });
  });

  await page.route('**/api/admin/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthConfig),
    });
  });

  await page.route(
    `${adminAuthConfig.userPoolDomain}/oauth2/token`,
    async (route) => {
      const body = route.request().postData() ?? '';
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=hosted-ui-code');
      expect(body).toContain('code_verifier=test-verifier');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-access-token',
          id_token: createJwt({ email: 'admin@example.com' }),
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });
    },
  );

  await page.addInitScript(() => {
    window.sessionStorage.setItem('adminAuth.state', 'login-state');
    window.sessionStorage.setItem('adminAuth.codeVerifier', 'test-verifier');
  });

  await page.goto('/admin?code=hosted-ui-code&state=login-state');

  await expect(
    page.getByRole('heading', { name: 'RSVP dashboard' }),
  ).toBeVisible();
  await expect(page.getByText('Signed in as admin@example.com')).toBeVisible();
  await expect(page.getByText('1 households loaded.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'The Example Household' }),
  ).toBeVisible();
  await expect(page.getByText('generated').first()).toBeVisible();
  await expect(page.getByText('Jamie Guest')).toBeVisible();

  await page.getByRole('button', { name: 'Export invitations' }).click();
  await expect(
    page.getByText(
      'Exported invitation mailing data. Review the CSV before printing.',
    ),
  ).toBeVisible();
  await expect(page.getByText('exported').first()).toBeVisible();

  const exampleCard = page
    .getByLabel('Households')
    .locator('article')
    .filter({ hasText: 'The Example Household' });
  await expect(
    exampleCard.getByRole('button', { name: 'Show invitation' }),
  ).toBeVisible();
  await exampleCard.getByRole('button', { name: 'Show invitation' }).click();
  await expect(
    exampleCard.getByRole('link', { name: 'http://127.0.0.1:5173/rsvp/code' }),
  ).toBeVisible();
  await exampleCard.getByRole('button', { name: 'Hide invitation' }).click();

  await exampleCard.getByRole('button', { name: 'Edit' }).click();
  await page
    .getByLabel('The Example Household edit display name')
    .fill('The Updated Household');
  await page.getByLabel('Sam Example edit wedding-party role').fill('Reader');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Household changes saved.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'The Updated Household' }),
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const updatedCard = page
    .getByLabel('Households')
    .locator('article')
    .filter({ hasText: 'The Updated Household' });
  await updatedCard.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Archived The Updated Household.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'The Updated Household' }),
  ).toHaveCount(0);
  await page.getByLabel('Show archived households').check();
  await expect(page.getByText('archived').first()).toBeVisible();
  await expect(
    updatedCard.getByRole('button', { name: 'Archive' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Create household' }).click();
  await page.getByLabel('Household display name').fill('The Harper Household');
  await page.getByLabel('Contact email').fill('harper@example.com');
  await page.getByLabel('Max plus-ones').fill('1');
  await page.getByLabel('Member 1 first name').fill('Harper');
  await page.getByLabel('Member 1 last name').fill('Example');
  await page
    .getByRole('dialog', { name: 'Create household' })
    .getByRole('button', { name: 'Create household' })
    .click();

  await expect(
    page.getByText(
      'Created The Harper Household and generated an invite code.',
    ),
  ).toBeVisible();
  await expect(
    page
      .getByLabel('Households')
      .getByRole('heading', { name: 'The Harper Household' }),
  ).toBeVisible();
  const newCard = page
    .getByLabel('Households')
    .locator('article')
    .filter({ hasText: 'The Harper Household' });
  await expect(
    newCard.getByRole('button', { name: 'Hide invitation' }),
  ).toBeVisible();
  await expect(newCard.locator('.invite-code-block strong').first()).toHaveText(
    'fresh-invite-code-456',
  );
  await expect(newCard.getByRole('link', { name: 'Open RSVP' })).toBeVisible();
  await newCard.getByRole('button', { name: 'Invitation QR' }).click();
  await expect(
    page.getByRole('dialog', { name: 'The Harper Household invitation QR' }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'RSVP dashboard' }),
  ).toBeVisible();
  const reloadedCard = page
    .getByLabel('Households')
    .locator('article')
    .filter({ hasText: 'The Harper Household' });
  await expect(
    reloadedCard.getByRole('button', { name: 'Show invitation' }),
  ).toBeVisible();
  await reloadedCard.getByRole('button', { name: 'Show invitation' }).click();
  await expect(reloadedCard.locator('.invite-code-block strong').first()).toHaveText(
    'fresh-invite-code-456',
  );
});

test('admin route clears malformed stored sessions instead of crashing', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.route('**/api/admin/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthConfig),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'adminAuth.session',
      JSON.stringify({
        accessToken: 'fake-access-token',
        idToken: 'not-a-jwt',
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );
  });

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: 'Admin sign in' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('adminAuth.session')),
    )
    .toBeNull();
  expect(pageErrors).toEqual([]);
});

function createJwt(payload: Record<string, unknown>): string {
  const header = toBase64Url({ alg: 'none', typ: 'JWT' });
  const body = toBase64Url(payload);
  return `${header}.${body}.signature`;
}

function toBase64Url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
