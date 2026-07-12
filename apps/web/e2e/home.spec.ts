import { expect, test, type Locator, type Page } from '@playwright/test';

const adminAuthConfig = {
  clientId: 'admin-client-id',
  userPoolDomain: 'https://wedding-admin.auth.us-west-1.amazoncognito.com',
  scopes: ['openid', 'email', 'profile'],
};

const household = {
  householdId: 'h1',
  displayName: 'The Example Household',
  email: 'sam@example.com',
  phone: '+14805550100',
  smsConsent: {
    status: 'opted_in',
    phone: '+14805550100',
    source: 'rsvp_form',
    consentedAt: '2026-07-03T20:00:00.000Z',
    consentTextVersion: 'twilio-tollfree-v1',
  },
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

const firstGalleryPhoto = {
  alt: "A close up of Alison's engagement ring",
  caption: 'Engagement ring',
};

const secondGalleryPhoto = {
  alt: 'Alison & Matt, shortly after the proposal',
  caption: 'Alison & Matt after the proposal',
};

async function expectResponsiveImageDelivery(
  image: Locator,
  expectedFallbackPath: string,
) {
  await expect(image).toHaveAttribute('src', expectedFallbackPath);

  const delivery = await image.evaluate((element) => {
    const img = element as HTMLImageElement;
    const picture = img.closest('picture');

    return {
      sources: Array.from(picture?.querySelectorAll('source') ?? []).map(
        (source) => ({
          srcSet: source.srcset,
          type: source.type,
        }),
      ),
    };
  });

  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).currentSrc),
    )
    .toContain('/images/');
  expect(delivery.sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'image/avif' }),
      expect.objectContaining({ type: 'image/webp' }),
    ]),
  );
}

async function openHouseholdActions(card: Locator) {
  const trigger = card.getByRole('button', { name: 'Actions' });
  await trigger.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await trigger.click();
}

async function clickHouseholdAction(card: Locator, actionName: string) {
  const page = card.page();

  await openHouseholdActions(card);
  const action = page.getByRole('menuitem', { name: actionName });
  await expect(action).toBeVisible();

  try {
    await action.click({ timeout: 1_000 });
    return;
  } catch {
    await action.focus();
    await page.keyboard.press('Enter');
  }
}

async function getVisibleHouseholdsSurface(page: Page) {
  const table = page.getByLabel('Households table');
  return (await table.isVisible())
    ? table
    : page.getByLabel('Households', { exact: true });
}

async function getVisibleHousehold(page: Page, displayName: string) {
  const table = page.getByLabel('Households table');
  if (await table.isVisible()) {
    return table
      .getByRole('row')
      .filter({ hasText: displayName })
      .first();
  }

  return page
    .getByLabel('Households', { exact: true })
    .locator('article')
    .filter({ hasText: displayName })
    .first();
}

async function getVisibleHouseholdPanel(
  page: Page,
  household: Locator,
  name: string,
) {
  const table = page.getByLabel('Households table');
  return (await table.isVisible())
    ? table.getByLabel(name)
    : household.getByLabel(name);
}

async function getVisibleHouseholdContent(page: Page, household: Locator) {
  const table = page.getByLabel('Households table');
  return (await table.isVisible()) ? table : household;
}

async function showHouseholdDetails(
  page: Page,
  household: Locator,
  displayName: string,
) {
  const table = page.getByLabel('Households table');
  if (await table.isVisible()) {
    await household
      .getByRole('button', { name: `Show ${displayName} details` })
      .click();
  }
}

async function swipeScroller(page: Page, scroller: Locator) {
  const box = await scroller.boundingBox();
  if (!box) {
    throw new Error('Photo carousel scroller is not visible');
  }

  const scrollLeftBeforeSwipe = await scroller.evaluate(
    (element) => element.scrollLeft,
  );
  const session = await page.context().newCDPSession(page);
  const startX = box.x + box.width * 0.75;
  const endX = box.x + box.width * 0.15;
  const y = box.y + box.height / 2;
  const touchPoint = (x: number) => ({
    force: 1,
    id: 1,
    radiusX: 1,
    radiusY: 1,
    x,
    y,
  });

  try {
    await session.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 1,
    });
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [touchPoint(startX)],
      type: 'touchStart',
    });
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      await session.send('Input.dispatchTouchEvent', {
        touchPoints: [touchPoint(startX + (endX - startX) * progress)],
        type: 'touchMove',
      });
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [],
      type: 'touchEnd',
    });
    await page.waitForTimeout(16);
  } finally {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
  }

  return {
    after: await scroller.evaluate((element) => element.scrollLeft),
    before: scrollLeftBeforeSwipe,
  };
}

async function wheelScroller(page: Page, scroller: Locator, deltaX: number) {
  const box = await scroller.boundingBox();
  if (!box) {
    throw new Error('Photo carousel scroller is not visible');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, 0);
}

async function expectMinimumContrastRatio(locator: Locator, minimumRatio: number) {
  const contrastRatio = await locator.evaluate((element) => {
    const parseRgb = (value: string) => {
      const match = value.match(
        /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/,
      );

      if (!match) {
        throw new Error(`Unable to parse color value: ${value}`);
      }

      return {
        alpha: match[4] === undefined ? 1 : Number(match[4]),
        blue: Number(match[3]),
        green: Number(match[2]),
        red: Number(match[1]),
      };
    };

    const blend = (
      foreground: ReturnType<typeof parseRgb>,
      background: ReturnType<typeof parseRgb>,
    ) => {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);

      if (alpha === 0) {
        return { alpha: 0, blue: 0, green: 0, red: 0 };
      }

      return {
        alpha,
        blue:
          (foreground.blue * foreground.alpha +
            background.blue * background.alpha * (1 - foreground.alpha)) /
          alpha,
        green:
          (foreground.green * foreground.alpha +
            background.green * background.alpha * (1 - foreground.alpha)) /
          alpha,
        red:
          (foreground.red * foreground.alpha +
            background.red * background.alpha * (1 - foreground.alpha)) /
          alpha,
      };
    };

    const elementBackground = () => {
      const layers = [];
      let current: Element | null = element;

      while (current) {
        layers.push(parseRgb(window.getComputedStyle(current).backgroundColor));
        current = current.parentElement;
      }

      return layers
        .reverse()
        .reduce(
          (background, foreground) => blend(foreground, background),
          parseRgb('rgb(255, 255, 255)'),
        );
    };

    const relativeLuminance = (color: ReturnType<typeof parseRgb>) => {
      const [red, green, blue] = [color.red, color.green, color.blue].map(
        (channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        },
      );

      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };

    const styles = window.getComputedStyle(element);
    const textLuminance = relativeLuminance(parseRgb(styles.color));
    const backgroundLuminance = relativeLuminance(elementBackground());
    const lighter = Math.max(textLuminance, backgroundLuminance);
    const darker = Math.min(textLuminance, backgroundLuminance);

    return (lighter + 0.05) / (darker + 0.05);
  });

  expect(contrastRatio).toBeGreaterThanOrEqual(minimumRatio);
}

async function clickBulkAction(page: Page, actionName: string) {
  await page.getByRole('button', { name: 'Bulk actions' }).click();
  await page.getByRole('menuitem', { name: actionName }).click();
}

async function expectCarouselControlsMatchPointer(page: Page) {
  const controlsVisibleByDefault = await page.evaluate(() =>
    window.matchMedia('(hover: none), (pointer: coarse)').matches,
  );

  await expect(page.locator('.photo-controls')).toHaveCSS(
    'opacity',
    controlsVisibleByDefault ? '1' : '0',
  );

  if (!controlsVisibleByDefault) {
    await page.getByLabel('Matt and Alison photos').hover();
    await expect(page.locator('.photo-controls')).toHaveCSS('opacity', '1');
  }

  await expect(
    page.getByRole('button', { name: 'Show previous photo' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show next photo' }),
  ).toBeVisible();
}

test('homepage renders wedding announcement and details', async ({ page }) => {
  await page.goto('/');

  await expect
    .poll(() =>
      page
        .locator('.hero')
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .toContain('/images/hero-wedding');
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
      .getByRole('link', { name: 'Our Story' }),
  ).toHaveAttribute('href', '/our-story');
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Registry' }),
  ).toHaveAttribute('href', '/registry');
  await expect(
    page.getByRole('heading', { name: 'A few favorite moments' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: firstGalleryPhoto.alt,
    }),
  ).toBeVisible();
  await expectResponsiveImageDelivery(
    page.getByRole('img', {
      name: firstGalleryPhoto.alt,
    }),
    '/images/ring-1200.jpg',
  );
  await expect(
    page.getByRole('link', { name: 'Read our story' }),
  ).toHaveAttribute('href', '/our-story');
  await expectCarouselControlsMatchPointer(page);
  await page.getByRole('button', { name: 'Show next photo' }).click();
  await expect(page.getByText(secondGalleryPhoto.caption)).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: secondGalleryPhoto.alt,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Wedding day' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Superstition Manor' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: '1220 N Signal Butte Rd, Mesa, AZ 85207',
    }),
  ).toHaveAttribute('href', /google\.com\/maps/);
  await expect(page.getByTitle('Superstition Manor map')).toHaveAttribute(
    'src',
    /openstreetmap\.org\/export\/embed\.html/,
  );
  await expect(page.getByTitle('Superstition Manor map')).not.toHaveAttribute(
    'src',
    /[?&]marker=/,
  );
  await expect(page.locator('[class*="venue-map-marker"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open map' })).toHaveAttribute(
    'href',
    /google\.com\/maps/,
  );
  await expect(
    page.getByRole('link', { name: 'Add to calendar' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Where to stay' }),
  ).toHaveCount(0);
  await expect(page.getByText(/TBD Hotel|123 TBD|MATTALISON2027/)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Wedding Registry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'View registry' }),
  ).toHaveAttribute('href', '/registry');
  await expect(
    page.getByRole('heading', { name: 'Guest notes' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Who should I contact with questions?' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: 'contact@matt-alison.com' }),
  ).toHaveAttribute('href', 'mailto:contact@matt-alison.com');
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Admin' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Admin' }),
  ).toBeVisible();
});

test('dark mode public CTA links meet text contrast requirements', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wedding.theme', 'dark');
  });

  await page.goto('/');

  for (const name of [
    'Find your RSVP',
    'Open map',
    'View registry',
  ]) {
    await expectMinimumContrastRatio(page.getByRole('link', { name }), 4.5);
  }
});

test('light mode travel details meet text contrast requirements', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wedding.theme', 'light');
  });

  await page.goto('/');

  for (const text of [
    'Phoenix Sky Harbor International Airport is the closest major airport.',
    'Rideshare is the easiest option between Mesa hotels and the venue.',
  ]) {
    await expectMinimumContrastRatio(page.getByText(text), 4.5);
  }
});

test('homepage details render on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(
    page.getByLabel('Wedding highlights').getByText('January 18, 2027'),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: firstGalleryPhoto.alt,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Ceremony at 4:30 PM; reception at 10:00 PM'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: '1220 N Signal Butte Rd, Mesa, AZ 85207',
    }),
  ).toBeVisible();
  await expect(page.getByTitle('Superstition Manor map')).toBeVisible();
  await expect(page.locator('[class*="venue-map-marker"]')).toHaveCount(0);
  const mobileMapBounds = await page.locator('.venue-map-frame').boundingBox();
  expect(mobileMapBounds).not.toBeNull();
  expect(mobileMapBounds!.height).toBeGreaterThanOrEqual(260);
  await expect(
    page.getByText('Phoenix Sky Harbor International Airport'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add to calendar' }),
  ).toHaveAttribute('href', /^data:text\/calendar/);
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Our Story' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Read our story' }),
  ).toBeVisible();
  await expectCarouselControlsMatchPointer(page);
  await page.getByRole('button', { name: 'Show next photo' }).click();
  await expect(page.getByText(secondGalleryPhoto.caption)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Who should I contact with questions?' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: 'contact@matt-alison.com' }),
  ).toHaveAttribute('href', 'mailto:contact@matt-alison.com');
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 390, scrollWidth: 390 });
});

test('mobile header keeps all primary links on one compact navigation row', async ({
  page,
}) => {
  for (const width of [360, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');

    const layout = await page.evaluate(() => {
      const header = document.querySelector('header');
      const links = Array.from(
        document.querySelectorAll('nav[aria-label="Primary navigation"] a'),
      );
      const themeToggle = document.querySelector(
        'header button[aria-label^="Switch to"]',
      );
      return {
        headerHeight: Math.round(header?.getBoundingClientRect().height ?? 0),
        linkHeights: links.map((link) =>
          Math.round(link.getBoundingClientRect().height),
        ),
        linkTops: links.map((link) =>
          Math.round(link.getBoundingClientRect().top),
        ),
        themeHeight: Math.round(
          themeToggle?.getBoundingClientRect().height ?? 0,
        ),
      };
    });

    expect(layout.linkTops).toHaveLength(4);
    expect(
      Math.max(...layout.linkTops) - Math.min(...layout.linkTops),
    ).toBeLessThanOrEqual(2);
    expect(Math.min(...layout.linkHeights)).toBeGreaterThanOrEqual(44);
    expect(layout.themeHeight).toBeGreaterThanOrEqual(44);
    expect(layout.headerHeight).toBeLessThanOrEqual(124);
  }
});

test('our story page renders editorial sections and calls to action', async ({
  page,
}) => {
  await page.goto('/our-story');

  await expect(
    page.getByRole('heading', { name: 'Our Story' }),
  ).toBeVisible();
  await expect(
    page.getByText('A little about the moments and everyday joys that brought us here.'),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Matt proposing to Alison by the lake',
    }),
  ).toBeVisible();
  await expectResponsiveImageDelivery(
    page.getByRole('img', {
      name: 'Matt proposing to Alison by the lake',
    }),
    '/images/hero-wedding-1920.jpg',
  );
  await expect(
    page.getByRole('heading', { name: 'How we met' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'The proposal' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'What we love together' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Looking ahead' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to wedding details' }),
  ).toHaveAttribute('href', '/#details');
  await expect(
    page.locator('.story-cta-band').getByRole('link', { name: 'RSVP' }),
  ).toHaveAttribute('href', '/rsvp');
});

test('our story page renders on mobile without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/our-story');

  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Our Story' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Our Story' }),
  ).toBeVisible();
  const mobileMeetLayout = await page
    .locator('.story-section-meet')
    .evaluate((section) => {
      const copyBox = section
        .querySelector('.story-copy-block')
        ?.getBoundingClientRect();
      const imageBox = section
        .querySelector('.story-thumbnail')
        ?.getBoundingClientRect();
      const sectionBox = section.getBoundingClientRect();
      const styles = getComputedStyle(section);
      const contentWidth =
        sectionBox.width -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight);

      return {
        copyTop: Math.round(copyBox?.top ?? 0),
        imageTop: Math.round(imageBox?.top ?? 0),
        imageWidth: Math.round(imageBox?.width ?? 0),
        contentWidth: Math.round(contentWidth),
      };
    });
  expect(mobileMeetLayout.copyTop).toBeLessThan(mobileMeetLayout.imageTop);
  expect(mobileMeetLayout.imageWidth).toBe(mobileMeetLayout.contentWidth);
  const heroImageRadii = await page
    .locator('.our-story-hero-image')
    .evaluate((element) => {
      const styles = getComputedStyle(element);

      return {
        bottomLeft: styles.borderBottomLeftRadius,
        bottomRight: styles.borderBottomRightRadius,
        overflow: styles.overflow,
        topLeft: styles.borderTopLeftRadius,
        topRight: styles.borderTopRightRadius,
      };
    });
  expect(heroImageRadii).toEqual({
    bottomLeft: '8px',
    bottomRight: '8px',
    overflow: 'hidden',
    topLeft: '8px',
    topRight: '8px',
  });
  await expect(
    page.getByRole('link', { name: 'Back to wedding details' }),
  ).toBeVisible();
  await expect(
    page.locator('.story-cta-band').getByRole('link', { name: 'RSVP' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 390, scrollWidth: 390 });
});

test('cross-page details navigation lands below the sticky header', async ({
  page,
}) => {
  await page.goto('/our-story');
  await page.getByRole('link', { name: 'Back to wedding details' }).click();
  await expect(page).toHaveURL(/\/#details$/);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const details = document.querySelector('#details');
        const header = document.querySelector('header');
        if (!details || !header) {
          return false;
        }

        const detailsTop = Math.round(details.getBoundingClientRect().top);
        const headerBottom = Math.round(header.getBoundingClientRect().bottom);
        return detailsTop >= headerBottom && detailsTop - headerBottom <= 32;
      }),
    )
    .toBe(true);
});

test('history navigation to details stays aligned after the correction window', async ({
  page,
}) => {
  const detailsOffset = () =>
    page.evaluate(() => {
      const details = document.querySelector('#details');
      const header = document.querySelector('header');
      if (!details || !header) {
        return undefined;
      }

      return Math.round(
        details.getBoundingClientRect().top -
          header.getBoundingClientRect().bottom,
      );
    });

  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  await page.locator('#details').evaluate((details) =>
    details.scrollIntoView({ block: 'start' }),
  );
  await page.evaluate(() => window.scrollBy(0, 650));
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Our Story' })
    .click();
  await expect(page).toHaveURL(/\/our-story$/);
  await page.getByRole('link', { name: 'Back to wedding details' }).click();
  await expect(page).toHaveURL(/\/#details$/);

  await expect
    .poll(async () => {
      const offset = await detailsOffset();
      return offset !== undefined && offset >= 0 && offset <= 32;
    })
    .toBe(true);
  await page.waitForTimeout(550);
  const settledOffset = await detailsOffset();
  expect(settledOffset).toBeGreaterThanOrEqual(0);
  expect(settledOffset).toBeLessThanOrEqual(32);
});

test('cross-page details navigation preserves user scrolling during correction', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/our-story');
  await page.getByRole('link', { name: 'Back to wedding details' }).click();
  await expect(page).toHaveURL(/\/#details$/);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const details = document.querySelector('#details');
        const header = document.querySelector('header');
        if (!details || !header) {
          return false;
        }
        const offset =
          details.getBoundingClientRect().top -
          header.getBoundingClientRect().bottom;
        return offset >= 0 && offset <= 32;
      }),
    )
    .toBe(true);
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBeGreaterThan(2000);
  await page.waitForTimeout(550);

  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(
    2000,
  );
});

test('homepage map link opens Apple Maps on Apple devices', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'iPhone',
    });
  });

  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Open map' })).toHaveAttribute(
    'href',
    /maps\.apple\/p/,
  );
  await expect(
    page.getByRole('link', {
      name: '1220 N Signal Butte Rd, Mesa, AZ 85207',
    }),
  ).toHaveAttribute('href', /maps\.apple\/p/);
});

test('photo carousel rate-limits horizontal wheel navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __photoCarouselTestNow?: number;
    };
    const originalDateNow = Date.now;

    testWindow.__photoCarouselTestNow = 1_000;
    Date.now = () => testWindow.__photoCarouselTestNow ?? originalDateNow();
  });

  await page.goto('/');

  await expect(
    page.getByRole('img', {
      name: firstGalleryPhoto.alt,
    }),
  ).toBeVisible();

  const carousel = page.getByLabel('Matt and Alison photos');
  const scroller = page.getByTestId('photo-carousel-scroller');
  const activeCaption = carousel.locator('.photo-caption-row strong');
  const wheelHorizontally = (deltaX: number) =>
    wheelScroller(page, scroller, deltaX);
  const setWheelClock = async (now: number) => {
    await page.evaluate((nextNow) => {
      (
        window as Window & {
          __photoCarouselTestNow?: number;
        }
      ).__photoCarouselTestNow = nextNow;
    }, now);
  };
  const wheelUntilCaption = async (caption: string) => {
    await expect
      .poll(
        async () => {
          const currentCaption = await activeCaption.textContent();
          if (currentCaption !== caption) {
            await wheelHorizontally(300);
          }
          return activeCaption.textContent();
        },
        { intervals: [100], timeout: 5_000 },
      )
      .toBe(caption);
  };
  await carousel.scrollIntoViewIfNeeded();
  await scroller.scrollIntoViewIfNeeded();

  await wheelHorizontally(20);
  await expect(activeCaption).toHaveText(firstGalleryPhoto.caption);

  await wheelUntilCaption(secondGalleryPhoto.caption);
  await expect(
    page.getByRole('img', {
      name: secondGalleryPhoto.alt,
    }),
  ).toBeVisible();

  for (let i = 0; i < 3; i += 1) {
    await page.waitForTimeout(50);
    await wheelHorizontally(300);
  }
  await expect(activeCaption).toHaveText(secondGalleryPhoto.caption);

  await setWheelClock(1_500);
  await wheelHorizontally(300);
  await expect(activeCaption).toHaveText(firstGalleryPhoto.caption);
});

test('photo carousel responds to native horizontal scroll snapping', async ({
  page,
}) => {
  await page.goto('/');

  const carousel = page.getByLabel('Matt and Alison photos');
  const scroller = page.getByTestId('photo-carousel-scroller');
  const activeCaption = carousel.locator('.photo-caption-row strong');

  await carousel.scrollIntoViewIfNeeded();
  await expect(activeCaption).toHaveText(firstGalleryPhoto.caption);
  await expect
    .poll(() =>
      scroller.evaluate((element) => getComputedStyle(element).scrollSnapType),
    )
    .toBe('x mandatory');
  await expect
    .poll(() =>
      scroller.evaluate((element) => getComputedStyle(element).overflowX),
    )
    .toBe('auto');

  await scroller.evaluate((element) => {
    element.scrollLeft = element.clientWidth;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect(activeCaption).toHaveText(secondGalleryPhoto.caption);
});

test('photo carousel keeps mobile swipe path native and controls stable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const carousel = page.getByLabel('Matt and Alison photos');
  const scroller = page.getByTestId('photo-carousel-scroller');
  const controls = carousel.locator('.photo-controls');
  const dots = carousel.locator('.photo-dot');
  const captionRow = carousel.locator('.photo-caption-row');
  const activeCaption = carousel.locator('.photo-caption-row strong');

  await carousel.scrollIntoViewIfNeeded();
  await scroller.scrollIntoViewIfNeeded();
  const swipe = await swipeScroller(page, scroller);
  expect(swipe.after - swipe.before).toBeGreaterThan(
    (await scroller.evaluate((element) => element.clientWidth)) / 2,
  );
  await expect(activeCaption).toHaveText(secondGalleryPhoto.caption);
  await expect(
    carousel.getByRole('button', {
      name: `Show photo 2: ${secondGalleryPhoto.caption}`,
    }),
  ).toHaveAttribute('aria-current', 'true');
  await expect(controls).toHaveCSS('pointer-events', 'none');
  await expect
    .poll(() =>
      dots.evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().width)),
      ),
    )
    .toEqual([32, 32]);
  await expect
    .poll(() =>
      dots.evaluateAll((elements) =>
        elements.map((element) => {
          const styles = getComputedStyle(element);
          const markerStyles = getComputedStyle(element, '::before');
          const rootStyles = getComputedStyle(document.documentElement);
          const ariaCurrent = element.getAttribute('aria-current');
          const expectedInactiveMarkerBackground = rootStyles
            .getPropertyValue('--photo-dot-bg')
            .trim();

          return {
            ariaCurrent,
            hasTransparentButtonBackground:
              styles.backgroundColor === 'rgba(0, 0, 0, 0)',
            inactiveMarkerUsesExpectedBackground:
              ariaCurrent === 'true' ||
              markerStyles.backgroundColor === expectedInactiveMarkerBackground,
            markerHeight: markerStyles.height,
            markerRadius: markerStyles.borderTopLeftRadius,
            markerTransform: markerStyles.transform,
            markerWidth: markerStyles.width,
          };
        }),
      ),
    )
    .toEqual([
      {
        ariaCurrent: 'false',
        hasTransparentButtonBackground: true,
        inactiveMarkerUsesExpectedBackground: true,
        markerHeight: '12px',
        markerRadius: '999px',
        markerTransform: 'none',
        markerWidth: '12px',
      },
      {
        ariaCurrent: 'true',
        hasTransparentButtonBackground: true,
        inactiveMarkerUsesExpectedBackground: true,
        markerHeight: '12px',
        markerRadius: '999px',
        markerTransform: 'none',
        markerWidth: '32px',
      },
    ]);

  const beforeCaptionBox = await captionRow.boundingBox();
  expect(beforeCaptionBox).not.toBeNull();

  await page.getByRole('button', { name: 'Show next photo' }).click();
  await expect(activeCaption).toHaveText(firstGalleryPhoto.caption);

  const afterCaptionBox = await captionRow.boundingBox();
  expect(afterCaptionBox).not.toBeNull();
  expect(Math.abs(afterCaptionBox!.height - beforeCaptionBox!.height)).toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      dots.evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().width)),
      ),
    )
    .toEqual([32, 32]);
});

test('photo carousel updates caption once during button navigation', async ({
  page,
}) => {
  await page.goto('/');

  const carousel = page.getByLabel('Matt and Alison photos');
  const activeCaption = carousel.locator('.photo-caption-row strong');

  await carousel.scrollIntoViewIfNeeded();
  await expect(activeCaption).toHaveText(firstGalleryPhoto.caption);
  await page.evaluate(() => {
    const caption = document.querySelector('.photo-caption-row strong');
    const testWindow = window as Window & {
      __photoCarouselCaptionChanges?: Array<string | null>;
    };
    testWindow.__photoCarouselCaptionChanges = [caption?.textContent ?? null];

    const observer = new MutationObserver(() => {
      testWindow.__photoCarouselCaptionChanges?.push(
        caption?.textContent ?? null,
      );
    });
    if (caption) {
      observer.observe(caption, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }

    window.setTimeout(() => observer.disconnect(), 900);
  });

  await page.getByRole('button', { name: 'Show next photo' }).click();
  await expect(activeCaption).toHaveText(secondGalleryPhoto.caption);
  await page.waitForTimeout(900);

  const captionChanges = await page.evaluate(
    () =>
      (
        window as Window & {
          __photoCarouselCaptionChanges?: Array<string | null>;
        }
      ).__photoCarouselCaptionChanges ?? [],
  );
  expect(captionChanges).toEqual([
    firstGalleryPhoto.caption,
    secondGalleryPhoto.caption,
  ]);
});

test('registry page renders configured links', async ({ page }) => {
  await page.goto('/registry');

  await expect(
    page.getByRole('heading', { name: 'Wedding Registry' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Your presence at our celebration is the greatest gift. If you would like to contribute, our honeymoon and future-home funds are available below.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Both funds are hosted securely through Joy.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Honeymoon Fund' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Down Payment Fund' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Travel journals, sunglasses, and a camera overlooking a coastal honeymoon destination',
    }),
  ).toBeVisible();
  await expectResponsiveImageDelivery(
    page.getByRole('img', {
      name: 'Travel journals, sunglasses, and a camera overlooking a coastal honeymoon destination',
    }),
    '/images/registry-honeymoon-fund-1200.jpg',
  );
  await expect(
    page.getByRole('img', {
      name: 'Ceramic house, keys, and greenery on a warm tabletop',
    }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel('Registry links')
      .locator('article')
      .filter({ hasText: 'Honeymoon Fund' })
      .getByRole('link', { name: 'Contribute' }),
  ).toHaveAttribute(
    'href',
    'https://withjoy.com/matthew-and-alison-jan-2027/registry?pid=86869e07-24e0-4107-9e8a-dd6a571d2f86',
  );
  await expect(
    page
      .getByLabel('Registry links')
      .locator('article')
      .filter({ hasText: 'Down Payment Fund' })
      .getByRole('link', { name: 'Contribute' }),
  ).toHaveAttribute(
    'href',
    'https://withjoy.com/matthew-and-alison-jan-2027/registry?pid=f1fb6734-a2e9-4244-bea4-19b7646448a2',
  );
  await expect(page.getByLabel('Registry links')).toBeVisible();
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
    page.getByRole('heading', { name: 'Wedding Registry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Honeymoon Fund' }),
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

test('mobile footer links stay aligned across public, RSVP, and admin routes', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthConfig),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/', '/rsvp', '/admin']) {
    await page.goto(route);
    const footer = page.getByRole('contentinfo');
    const footerLinks = footer.getByRole('link', {
      name: /^(Terms|Privacy|Admin)$/,
    });
    await expect(footer).toContainText('Matt & Alison Wedding');
    await expect(
      footer.getByRole('link', { name: 'contact@matt-alison.com' }),
    ).toHaveAttribute('href', 'mailto:contact@matt-alison.com');
    await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
    const boxes = await footerLinks.evaluateAll((links) =>
      links.map((link) => {
        const rect = link.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          y: Math.round(rect.y),
        };
      }),
    );
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    const rows = boxes.map((box) => box.y);
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(2);
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].left).toBeGreaterThan(boxes[index - 1].right);
    }
  }
});

test('rsvp recovery stays collapsed by default and shows generic success when expanded', async ({
  page,
}) => {
  await page.route('**/api/rsvp/recovery', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        accepted: true,
        message:
          "If that matches our guest list, we'll send your private RSVP link.",
      }),
    });
  });

  await page.goto('/rsvp');

  await expect(
    page.getByRole('button', { name: "Don't have a code?" }),
  ).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Email or mobile number')).toHaveCount(0);

  await page.getByRole('button', { name: "Don't have a code?" }).click();
  await expect(
    page.getByRole('button', { name: "Don't have a code?" }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Email or mobile number')).toBeFocused();

  await page.getByLabel('Email or mobile number').fill('sam@example.com');
  await page.getByRole('button', { name: 'Send private RSVP link' }).click();
  await expect(
    page.getByText(
      "If that matches our guest list, we'll send your private RSVP link.",
    ),
  ).toBeVisible();
});

test('rsvp recovery expands cleanly on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rsvp');

  const lookupOrder = await page.locator('.rsvp-lookup-card').evaluate((card) => {
    const panel = card.querySelector('.rsvp-lookup-panel');
    const heading = card.querySelector('h1');
    const steps = card.querySelector('ol');
    const codeInput = card.querySelector('#invite-code');
    const cardBox = card.getBoundingClientRect();
    const panelBox = panel?.getBoundingClientRect();
    const headingBox = heading?.getBoundingClientRect();
    const stepsBox = steps?.getBoundingClientRect();
    const codeBox = codeInput?.getBoundingClientRect();

    return {
      codeTop: Math.round((codeBox?.top ?? 0) - cardBox.top),
      headingTop: Math.round((headingBox?.top ?? 0) - cardBox.top),
      panelTop: Math.round((panelBox?.top ?? 0) - cardBox.top),
      stepsTop: Math.round((stepsBox?.top ?? 0) - cardBox.top),
    };
  });
  expect(lookupOrder.headingTop).toBeLessThan(lookupOrder.panelTop);
  expect(lookupOrder.panelTop).toBeLessThan(lookupOrder.stepsTop);
  expect(lookupOrder.headingTop).toBeLessThan(180);

  await page.getByRole('button', { name: "Don't have a code?" }).click();
  await expect(page.getByLabel('Email or mobile number')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send private RSVP link' }),
  ).toBeVisible();

  const cardBounds = await page.locator('.lookup-card').boundingBox();
  const buttonBounds = await page
    .getByRole('button', { name: 'Send private RSVP link' })
    .boundingBox();
  expect(cardBounds).not.toBeNull();
  expect(buttonBounds).not.toBeNull();
  expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(
    cardBounds!.x + cardBounds!.width + 1,
  );
});

test('phone recovery submits without SMS enrollment fields', async ({
  page,
}) => {
  const recoveryRequests: Array<{ contact: string }> = [];
  await page.route('**/api/rsvp/recovery', async (route) => {
    const payload = route.request().postDataJSON() as { contact: string };
    recoveryRequests.push(payload);
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        accepted: true,
        message:
          "If that matches our guest list, we'll send your private RSVP link.",
      }),
    });
  });

  await page.goto('/rsvp');
  await page.getByRole('button', { name: "Don't have a code?" }).click();
  await page.getByLabel('Email or mobile number').fill('(480) 555-0100');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await Promise.all([
    page.waitForResponse('**/api/rsvp/recovery'),
    page.locator('#rsvp-recovery-form').evaluate((form) => {
      if (!(form instanceof HTMLFormElement)) {
        throw new Error('Recovery form not found');
      }
      form.requestSubmit();
    }),
  ]);
  await expect(
    page.getByText(
      "If that matches our guest list, we'll send your private RSVP link.",
    ),
  ).toBeVisible();
  expect(recoveryRequests).toEqual([{ contact: '(480) 555-0100' }]);
});

test('privacy and terms pages render public compliance content', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  await expect(
    page.getByText(
      'All the above categories exclude text messaging originator opt-in data and consent; this information won’t be shared with any third parties.',
    ),
  ).toBeVisible();

  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible();
  await expect(
    page.getByText('Reply HELP for help or STOP to opt out.'),
  ).toBeVisible();
});

test('public SMS signup submits affirmative consent and legacy proof URL redirects', async ({
  page,
}) => {
  let submittedPayload: unknown;
  await page.route('**/api/sms-subscriptions', async (route) => {
    expect(route.request().method()).toBe('POST');
    submittedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'opted_in' }),
    });
  });

  await page.goto('/sms-updates');

  await expect(
    page.getByRole('heading', { name: 'Wedding text updates', exact: true }),
  ).toBeVisible();
  const smsPreferences = page.getByLabel('Standalone SMS preferences');
  const phoneInput = smsPreferences.getByLabel('Mobile phone');
  const consentCheckbox = smsPreferences.getByRole('checkbox');
  await expect(phoneInput).toHaveValue('');
  await expect(consentCheckbox).not.toBeChecked();
  await expect(
    smsPreferences.getByRole('link', { name: 'Terms' }),
  ).toHaveAttribute('href', '/terms');
  await expect(
    smsPreferences.getByRole('link', { name: 'Privacy Policy' }),
  ).toHaveAttribute('href', '/privacy');
  await expect(page.locator('body')).not.toContainText(
    /SMS opt-in proof|non-submitting example|does not submit|does not enroll/i,
  );

  await phoneInput.fill('(480) 555-0100');
  await consentCheckbox.check();
  await page.getByRole('button', { name: 'Sign up for text updates' }).click();

  await expect(
    page.getByRole('status').filter({
      hasText: 'You’re enrolled for Matt & Alison Wedding text updates.',
    }),
  ).toBeVisible();
  expect(submittedPayload).toEqual({
    phone: '(480) 555-0100',
    consentAccepted: true,
  });

  await page.goto('/sms-opt-in-proof');
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe('/sms-updates');
  await expect(
    page.getByRole('heading', { name: 'Wedding text updates', exact: true }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /SMS opt-in proof|non-submitting example|does not submit|does not enroll/i,
  );
});

test('standalone SMS preferences require fresh consent and support website opt-out', async ({ page }) => {
  const requests: unknown[] = [];
  const smsHousehold = { ...household, smsConsent: undefined };
  await page.route('**/api/rsvp/A2B3C4D5E6', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ household: smsHousehold }) });
  });
  await page.route('**/api/rsvp/A2B3C4D5E6/sms-preferences', async (route) => {
    const payload = route.request().postDataJSON();
    requests.push(payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...smsHousehold,
        smsConsent: payload.enabled
          ? { status: 'opted_in', phone: '+14805550100', source: 'sms_preferences', consentedAt: new Date().toISOString(), consentTextVersion: 'twilio-tollfree-v1' }
          : { status: 'opted_out', phone: '+14805550100', source: 'sms_preferences', consentedAt: new Date().toISOString(), consentTextVersion: 'twilio-tollfree-v1' },
      }),
    });
  });

  await page.goto('/rsvp/A2B3C4D5E6/sms-updates');
  const smsPreferencesMain = page.getByRole('main');
  await expect(smsPreferencesMain.getByRole('heading', { name: 'Text updates' })).toBeVisible();
  await expect(smsPreferencesMain.getByRole('checkbox')).not.toBeChecked();
  await expect(smsPreferencesMain.getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect(smsPreferencesMain.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
  await page.getByRole('button', { name: 'Enable text updates' }).click();
  await expect(page.getByText('Check the consent box to enable or update text messages.')).toBeVisible();
  expect(requests).toEqual([]);

  await page.getByRole('checkbox').check();
  await page.getByLabel('Mobile phone').fill('(480) 555-0100');
  await page.getByRole('button', { name: 'Enable text updates' }).click();
  await expect.poll(() => requests).toEqual([
    { enabled: true, phone: '(480) 555-0100' },
  ]);
  await expect(page.getByText('Text updates are active.')).toBeVisible();
  await expect(smsPreferencesMain.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();

  await page.getByRole('button', { name: 'Turn off text updates' }).click();
  await expect.poll(() => requests).toEqual([
    { enabled: true, phone: '(480) 555-0100' },
    { enabled: false },
  ]);
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
  await expect
    .poll(() =>
      page
        .locator('.admin-login-intro')
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .toContain('/images/hero-wedding');
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await expect(
    page.getByText('Manage RSVPs, households, and invitations.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('admin sign-in stacks into one non-overlapping column on mobile', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminAuthConfig),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: 'Admin sign in' }),
  ).toBeVisible();
  const layout = await page.evaluate(() => {
    const intro = document.querySelector('.admin-login-intro');
    const card = document.querySelector('.admin-login-card');
    const introBox = intro?.getBoundingClientRect();
    const cardBox = card?.getBoundingClientRect();
    return {
      cardLeft: Math.round(cardBox?.left ?? -1),
      cardTop: Math.round(cardBox?.top ?? -1),
      cardWidth: Math.round(cardBox?.width ?? -1),
      introBottom: Math.round(introBox?.bottom ?? -1),
      introLeft: Math.round(introBox?.left ?? -1),
      introWidth: Math.round(introBox?.width ?? -1),
    };
  });

  expect(layout.cardTop).toBeGreaterThanOrEqual(layout.introBottom + 20);
  expect(Math.abs(layout.cardLeft - layout.introLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.cardWidth - layout.introWidth)).toBeLessThanOrEqual(1);
});

test('guest can look up an invite code and submit an RSVP', async ({
  page,
}) => {
  let savedBody: any;
  let savedRsvp: any;

  await page.route('**/api/rsvp/A2B3C4D5E6', async (route) => {
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
  await page.getByLabel('Invitation code').fill('a2b3c4d5e6');
  await page.getByRole('button', { name: 'View RSVP' }).click();

  await expect(page).toHaveURL(/\/rsvp\/A2B3C4D5E6$/);
  await expect(
    page.getByRole('heading', { name: 'The Example Household' }),
  ).toBeVisible();
  await expect(page.getByLabel('Sam Example meal choice')).toHaveCount(0);

  await page.getByRole('button', { name: 'Taylor Example not attending' }).click();
  await page.getByRole('button', { name: 'Add plus-one' }).click();
  await page.getByRole('button', { name: 'Continue to details' }).click();
  await page.getByRole('button', { name: 'Save RSVP' }).click();

  await expect(page.getByText('Step 1 of 3 · Guests')).toBeVisible();
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
  await page.getByRole('button', { name: 'Continue to details' }).click();
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

  await expect(page).toHaveURL(/\/rsvp\/A2B3C4D5E6\/success$/);
  await expect(
    page.getByRole('heading', { name: 'RSVP received' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Review or update RSVP' }),
  ).toBeVisible();
  await expect(page.getByText('RSVP submitted')).toBeVisible();
  await expect(page.getByText('Attending (2)')).toBeVisible();
  await expect(page.getByText('Not attending (1)')).toBeVisible();
  await expect(page.getByText('Plus-ones (1)')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Add to calendar' })).toHaveCount(
    1,
  );
});

test('admin route is reachable, can create households, and shows RSVP results', async ({
  page,
}) => {

  const deliveredNotifications: Array<{
    channel: string;
    deliveredTo: string;
    subject?: string;
    message: string;
  }> = [];
  const deliveredInvitationEmails: Array<{
    householdId: string;
    deliveredTo: string;
  }> = [];
  let labelExportRequests = 0;
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
      phone: string;
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
      phone: payload.phone,
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

  await page.route(
    '**/api/admin/households/h1/notifications',
    async (route) => {
      const payload = route.request().postDataJSON() as {
        channel: 'email' | 'sms';
        subject?: string;
        message: string;
      };
      const deliveredTo =
        payload.channel === 'email'
          ? String(
              households.find((record) => record.household.householdId === 'h1')
                ?.household.email ?? '',
            )
          : String(
              households.find((record) => record.household.householdId === 'h1')
                ?.household.phone ?? '',
            );
      deliveredNotifications.push({ ...payload, deliveredTo });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          channel: payload.channel,
          deliveredTo,
        }),
      });
    },
  );

  await page.route('**/api/admin/households/*/invitation', async (route) => {
    const requestOrigin = new URL(route.request().url()).origin;
    const householdId =
      route
        .request()
        .url()
        .match(/households\/([^/]+)\/invitation/)?.[1] ?? '';
    const record = households.find(
      (entry) => entry.household.householdId === householdId,
    );
    const inviteCode = householdId === 'h2' ? 'FRESH22456' : 'A2B3C4D5E6';

    await route.fulfill({
      status: record ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(
        record
          ? {
              householdId,
              inviteCode,
              inviteCodeHash: record.household.inviteCodeHash,
              rsvpUrl: `${requestOrigin}/rsvp/${inviteCode}`,
            }
          : { message: 'Household not found' },
      ),
    });
  });

  await page.route(
    '**/api/admin/households/*/invitation-email',
    async (route) => {
      const requestOrigin = new URL(route.request().url()).origin;
      const householdId =
        route
          .request()
          .url()
          .match(/households\/([^/]+)\/invitation-email/)?.[1] ?? '';
      const record = households.find(
        (entry) => entry.household.householdId === householdId,
      );
      const inviteCode = householdId === 'h2' ? 'FRESH22456' : 'A2B3C4D5E6';

      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Household not found' }),
        });
        return;
      }

      households = households.map((entry) =>
        entry.household.householdId === householdId
          ? {
              ...entry,
              household: {
                ...entry.household,
                inviteLifecycleStatus: 'sent',
                inviteSentAt: '2026-06-15T22:30:00.000Z',
              },
            }
          : entry,
      );
      deliveredInvitationEmails.push({
        householdId,
        deliveredTo: String(record.household.email ?? ''),
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invitation: {
            householdId,
            inviteCode,
            inviteCodeHash: record.household.inviteCodeHash,
            rsvpUrl: `${requestOrigin}/rsvp/${inviteCode}`,
          },
          result: {
            householdId,
            displayName: record.household.displayName,
            status: 'sent',
            deliveredTo: record.household.email,
            message: `Sent invitation email to ${record.household.email}`,
          },
        }),
      });
    },
  );

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
        inviteCode: 'FRESH22456',
        inviteCodeHash: 'hash-value',
      }),
    });
  });

  await page.route('**/api/admin/households/h1', async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON() as {
        displayName: string;
        email: string;
        phone: string;
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

  await page.route('**/api/admin/invitations/labels', async (route) => {
    labelExportRequests += 1;
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
      contentType: 'application/pdf',
      body: '%PDF-labels',
    });
  });

  await page.route('**/api/admin/invitations/email', async (route) => {
    const results = households.map((record) => {
      if (!record.household.email) {
        return {
          householdId: record.household.householdId,
          displayName: record.household.displayName,
          status: 'skipped',
          message: 'Household does not have a contact email address',
        };
      }

      deliveredInvitationEmails.push({
        householdId: String(record.household.householdId),
        deliveredTo: String(record.household.email),
      });
      return {
        householdId: record.household.householdId,
        displayName: record.household.displayName,
        status: 'sent',
        deliveredTo: record.household.email,
        message: `Sent invitation email to ${record.household.email}`,
      };
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results }),
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
  const householdsTable = page.getByLabel('Households table');
  if (await householdsTable.isVisible()) {
    await expect(
      householdsTable.getByRole('columnheader', { name: 'Household' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 900, height: 844 });
    const intermediateTableLayout = await householdsTable.evaluate((element) => ({
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      shellClientWidth: element.clientWidth,
      shellOverflowX: getComputedStyle(element).overflowX,
      shellScrollWidth: element.scrollWidth,
      shellScrollbarGutter: getComputedStyle(element).scrollbarGutter,
    }));
    expect(intermediateTableLayout.shellOverflowX).toBe('auto');
    expect(intermediateTableLayout.shellScrollWidth).toBeGreaterThan(
      intermediateTableLayout.shellClientWidth,
    );
    expect(intermediateTableLayout.documentScrollWidth).toBe(
      intermediateTableLayout.documentClientWidth,
    );
    expect(intermediateTableLayout.shellScrollbarGutter).toBe(
      'stable both-edges',
    );
    await page.setViewportSize({ width: 1280, height: 720 });
  }

  const householdsSurface = await getVisibleHouseholdsSurface(page);
  const exampleRow = await getVisibleHousehold(page, 'The Example Household');
  await expect(householdsSurface).toBeVisible();
  await expect(exampleRow).toBeVisible();
  await expect(exampleRow.getByText('generated')).toBeVisible();
  await showHouseholdDetails(page, exampleRow, 'The Example Household');
  await expect(householdsSurface.getByText('Jamie Guest')).toBeVisible();
  await expect(
    exampleRow.getByRole('link', { name: '+14805550100' }),
  ).toBeVisible();
  await clickHouseholdAction(exampleRow, 'Notify');
  await page.getByLabel('Notification subject').fill('Travel update');
  await page
    .getByLabel('Notification message')
    .fill('The shuttle now departs at 4:15 PM.');
  await page.getByRole('button', { name: 'Send update' }).click();
  await expect(
    page.getByText('Sent EMAIL to The Example Household at sam@example.com.'),
  ).toBeVisible();
  expect(deliveredNotifications[0]).toMatchObject({
    channel: 'email',
    deliveredTo: 'sam@example.com',
    subject: 'Travel update',
  });

  await clickHouseholdAction(exampleRow, 'Notify');
  await page.getByLabel('Delivery channel').selectOption('sms');
  await expect(page.getByLabel('Notification subject')).toHaveCount(0);
  await page
    .getByLabel('Notification message')
    .fill('Ceremony starts at 3:00 PM.');
  await page.getByRole('button', { name: 'Send update' }).click();
  await expect(
    page.getByText('Sent SMS to The Example Household at +14805550100.'),
  ).toBeVisible();
  expect(deliveredNotifications[1]).toMatchObject({
    channel: 'sms',
    deliveredTo: '+14805550100',
    message: 'Ceremony starts at 3:00 PM.',
  });

  await clickBulkAction(page, 'Export invitations');
  await page
    .getByRole('dialog', { name: 'Confirm invitation export' })
    .getByRole('button', { name: 'Export invitations' })
    .click();
  await expect(
    page.getByText(
      'Exported invitation mailing data. Review the CSV before printing.',
    ),
  ).toBeVisible();
  await expect(exampleRow.getByText('exported')).toBeVisible();

  await clickBulkAction(page, 'Export QR labels');
  await page
    .getByRole('dialog', { name: 'Confirm QR label export' })
    .getByRole('button', { name: 'Export QR labels' })
    .click();
  await expect(
    page.getByText(
      'Exported invitation QR labels. Print the PDF on Avery 5160 label sheets.',
    ),
  ).toBeVisible();
  expect(labelExportRequests).toBe(1);

  await clickHouseholdAction(exampleRow, 'View invitation');
  const exampleContent = await getVisibleHouseholdContent(page, exampleRow);
  await expect(
    exampleContent.getByRole('link', {
      name: new URL('/rsvp/A2B3C4D5E6', page.url()).toString(),
    }),
  ).toBeVisible();
  await exampleContent
    .getByRole('button', { name: 'Email invitation' })
    .click();
  await expect(
    page.getByText(
      'The Example Household: Sent invitation email to sam@example.com',
    ),
  ).toBeVisible();
  expect(deliveredInvitationEmails[0]).toMatchObject({
    householdId: 'h1',
    deliveredTo: 'sam@example.com',
  });

  await clickBulkAction(page, 'Email invitations');
  await page
    .getByRole('dialog', { name: 'Confirm invitation emails' })
    .getByRole('button', { name: 'Email invitations' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Invitation email results' }),
  ).toBeVisible();
  await expect(
    page.getByText('Sent invitation email to sam@example.com').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await clickHouseholdAction(exampleRow, 'Edit');
  const editPanel = await getVisibleHouseholdPanel(
    page,
    exampleRow,
    'Edit The Example Household',
  );
  const saveChangesButton = editPanel.getByRole('button', { name: 'Save changes' });
  const saveChangesStyles = await saveChangesButton.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
      color: styles.color,
    };
  });
  expect(saveChangesStyles.backgroundColor).not.toBe('rgb(15, 81, 63)');
  await editPanel
    .getByLabel('The Example Household edit display name')
    .fill('The Updated Household');
  await editPanel.getByLabel('Sam Example edit wedding-party role').fill('Reader');
  await editPanel.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Household changes saved.')).toBeVisible();
  await expect(
    await getVisibleHousehold(page, 'The Updated Household'),
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const updatedRow = await getVisibleHousehold(
    page,
    'The Updated Household',
  );
  await clickHouseholdAction(updatedRow, 'Archive');
  await expect(page.getByText('Archived The Updated Household.')).toBeVisible();
  await expect(
    await getVisibleHousehold(page, 'The Updated Household'),
  ).toHaveCount(0);
  await page.getByLabel('Show archived households').check();
  const archivedRow = await getVisibleHousehold(page, 'The Updated Household');
  await expect(archivedRow.getByText('archived')).toBeVisible();

  await page.getByRole('button', { name: 'Create household' }).click();
  await page.getByLabel('Household display name').fill('The Harper Household');
  await page.getByLabel('Contact email').fill('harper@example.com');
  await page.getByLabel('Mobile phone').fill('4805550222');
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
  const harperHousehold = await getVisibleHousehold(
    page,
    'The Harper Household',
  );
  await expect(harperHousehold).toBeVisible();
  const harperContent = await getVisibleHouseholdContent(page, harperHousehold);
  await expect(
    harperContent.locator('.invite-code-block strong').filter({
      hasText: 'FRESH22456',
    }),
  ).toHaveText('FRESH22456');
  await expect(
    harperContent.getByRole('link', {
      name: new URL('/rsvp/FRESH22456', page.url()).toString(),
    }),
  ).toBeVisible();
  await harperContent.getByRole('button', { name: 'QR code' }).click();
  await expect(
    page.getByRole('dialog', { name: 'The Harper Household invitation QR' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'RSVP dashboard' }),
  ).toBeVisible();
  const reloadedRow = await getVisibleHousehold(page, 'The Harper Household');
  await clickHouseholdAction(reloadedRow, 'View invitation');
  const reloadedContent = await getVisibleHouseholdContent(page, reloadedRow);
  await expect(
    reloadedContent.locator('.invite-code-block strong').filter({
      hasText: 'FRESH22456',
    }),
  ).toHaveText('FRESH22456');
});

test('admin mobile keeps household cards instead of the desktop table', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/admin/households', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        households: [
          {
            household: { ...household, rsvpStatus: 'partial' },
            attendance: {
              invitedGuests: 3,
              attendingGuests: 2,
              declinedGuests: 1,
              pendingGuests: 0,
              plusOneGuests: 1,
            },
          },
        ],
      }),
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
  await expect(page.getByLabel('Households table')).toBeHidden();
  const mobileCard = page
    .getByLabel('Households')
    .locator('article')
    .filter({ hasText: 'The Example Household' });
  await expect(mobileCard).toBeVisible();
  await expect(mobileCard.getByRole('button', { name: 'Actions' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 390, scrollWidth: 390 });
});

test('admin bulk invitation actions require confirmation and block duplicate submits', async ({
  page,
}) => {
  let invitationExportRequests = 0;
  let labelExportRequests = 0;
  let bulkInvitationEmailRequests = 0;
  let households: Array<{
    household: Record<string, unknown>;
    attendance: Record<string, number>;
    rsvp?: Record<string, unknown>;
  }> = [
    {
      household: { ...household },
      attendance: {
        invitedGuests: 3,
        attendingGuests: 0,
        declinedGuests: 0,
        pendingGuests: 2,
        plusOneGuests: 1,
      },
    },
  ];

  await page.route('**/api/admin/households', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ households }),
    });
  });

  await page.route('**/api/admin/invitations/export', async (route) => {
    invitationExportRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
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

  await page.route('**/api/admin/invitations/labels', async (route) => {
    labelExportRequests += 1;
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
      contentType: 'application/pdf',
      body: '%PDF-labels',
    });
  });

  await page.route('**/api/admin/invitations/email', async (route) => {
    bulkInvitationEmailRequests += 1;
    households = households.map((record) => ({
      ...record,
      household: {
        ...record.household,
        inviteLifecycleStatus: 'sent',
        inviteSentAt: '2026-06-15T22:20:00.000Z',
      },
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            householdId: 'h1',
            displayName: 'The Example Household',
            status: 'sent',
            deliveredTo: 'sam@example.com',
            message: 'Sent invitation email to sam@example.com',
          },
        ],
      }),
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

  await clickBulkAction(page, 'Export invitations');
  const exportDialog = page.getByRole('dialog', {
    name: 'Confirm invitation export',
  });
  await expect(exportDialog).toBeVisible();
  await expect(
    exportDialog.getByText('1 loaded household', { exact: true }),
  ).toBeVisible();
  await exportDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(exportDialog).toHaveCount(0);
  expect(invitationExportRequests).toBe(0);

  await clickBulkAction(page, 'Export invitations');
  const exportConfirmDialog = page.getByRole('dialog', {
    name: 'Confirm invitation export',
  });
  await exportConfirmDialog
    .getByRole('button', { name: 'Export invitations' })
    .dblclick();
  await expect(
    exportConfirmDialog.getByRole('button', {
      name: 'Exporting invitations...',
    }),
  ).toBeDisabled();
  await expect.poll(() => invitationExportRequests).toBe(1);
  await expect(
    page.getByText(
      'Exported invitation mailing data. Review the CSV before printing.',
    ),
  ).toBeVisible();

  await clickBulkAction(page, 'Export QR labels');
  const labelDialog = page.getByRole('dialog', {
    name: 'Confirm QR label export',
  });
  await expect(
    labelDialog.getByText('1 loaded household', { exact: true }),
  ).toBeVisible();
  await labelDialog.getByRole('button', { name: 'Export QR labels' }).click();
  await expect.poll(() => labelExportRequests).toBe(1);
  await expect(
    page.getByText(
      'Exported invitation QR labels. Print the PDF on Avery 5160 label sheets.',
    ),
  ).toBeVisible();

  await clickBulkAction(page, 'Email invitations');
  const emailDialog = page.getByRole('dialog', {
    name: 'Confirm invitation emails',
  });
  await expect(
    emailDialog.getByText('1 household with a contact email', {
      exact: true,
    }),
  ).toBeVisible();
  await emailDialog.getByRole('button', { name: 'Email invitations' }).click();
  await expect.poll(() => bulkInvitationEmailRequests).toBe(1);
  await expect(
    page.getByRole('dialog', { name: 'Invitation email results' }),
  ).toBeVisible();
  await expect(
    page.getByText('Sent invitation email to sam@example.com').first(),
  ).toBeVisible();
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

test('admin e2e uses routed auth config when local admin mocks are enabled outside Playwright', async ({
  page,
}) => {
  let authConfigRequests = 0;

  await page.route('**/api/admin/auth/config', async (route) => {
    authConfigRequests += 1;
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
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(authConfigRequests).toBeGreaterThan(0);
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
