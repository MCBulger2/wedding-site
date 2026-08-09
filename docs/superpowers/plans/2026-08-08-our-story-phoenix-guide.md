# Our Story and Phoenix Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Our Story page with Matt and Alison's approved story, personal responsive photography, and a device-aware Phoenix favorites guide.

**Architecture:** Keep all static editorial content and paired map destinations in the shared `siteContent` object. Render ordered story chapters and grouped Phoenix recommendations in the existing React route, and extract the duplicated Apple-versus-Google selection into a focused web utility used by the homepage, RSVP, and guide links.

**Tech Stack:** TypeScript 6, React 19, Vite 8, CSS Modules plus the existing global responsive stylesheet, Vitest 4, Playwright 1.61, Sharp responsive-image generation.

## Global Constraints

- Write story copy from a shared "we" perspective with the exact approved wording in the design spec.
- Prefer ordinary punctuation and parentheses; do not introduce forced em dashes into story copy.
- Keep the page static and build-time generated. Add no API calls, location permissions, embedded tracking maps, dependencies, or infrastructure.
- Use the existing `ResponsiveImage` component and AVIF/WebP/JPEG generation pipeline for every new image.
- Apple devices open Apple Maps; all other devices and unavailable browser state fall back to Google Maps.
- External map links open in a new tab with `rel="noreferrer"` and destination-specific accessible names.
- Preserve the existing wedding-details and RSVP calls to action.
- Keep the current site typography, colors, focus treatment, contrast standards, and responsive behavior.
- Update documentation that describes the public Our Story route in the same change.

## File Structure

- Create `apps/web/src/nativeMapUrl.ts`: one structural URL-pair interface and the reusable native map selector.
- Create `apps/web/src/nativeMapUrl.test.ts`: deterministic unit coverage for server, Apple, iPadOS, and non-Apple selection.
- Modify `packages/shared/src/siteContent.ts`: structured chapters, Phoenix guide groups, map destinations, and approved copy.
- Modify `packages/shared/src/index.test.ts`: exact shared-content and map-pair regression coverage.
- Add `apps/web/image-sources/asu-graduation.jpg`: selected wide ASU graduation photo.
- Add `apps/web/image-sources/canadian-grand-prix.jpg`: selected Canadian Grand Prix couple photo.
- Modify `apps/web/scripts/responsive-image-config.mjs`: responsive variants for both selected source images.
- Regenerate the ignored responsive manifest and files locally through the existing generator; do not stage generated outputs.
- Modify `apps/web/src/pages/PublicPages.tsx`: generic story chapters, Phoenix guide rendering, and shared map selection.
- Modify `apps/web/src/pages/RsvpPages.tsx`: remove its local map selector and import the shared utility.
- Modify `apps/web/src/pages/PublicPages.module.css`: editorial chapter, proposal pair, closing, and Phoenix guide presentation.
- Modify `apps/web/src/styles.css`: responsive collapse rules for the new chapter and guide class names.
- Modify `apps/web/e2e/home.spec.ts`: content, responsive-image, native-map, accessibility, and mobile-overflow coverage.
- Modify `apps/web/public/llms.txt`: describe the Phoenix favorites guide on the Our Story route.
- Modify `docs/ARCHITECTURE.md`: record the static editorial story and device-aware Phoenix recommendation links in the public-site description.

---

### Task 1: Reusable native map selection

**Files:**
- Create: `apps/web/src/nativeMapUrl.ts`
- Create: `apps/web/src/nativeMapUrl.test.ts`
- Modify: `apps/web/src/pages/PublicPages.tsx:24-30,268-283`
- Modify: `apps/web/src/pages/RsvpPages.tsx:1339-1341,1426-1439`

**Interfaces:**
- Consumes: structural `{ googleMapsUrl: string; appleMapsUrl: string }` objects from venue or recommendation content.
- Produces: `getNativeMapUrl(urls: NativeMapUrls, navigatorLike?: NavigatorLike): string` for all web map links.

- [ ] **Step 1: Write failing selector tests**

Create `apps/web/src/nativeMapUrl.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getNativeMapUrl } from './nativeMapUrl.js';

const urls = {
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Phoenix',
  appleMapsUrl: 'https://maps.apple.com/?q=Phoenix',
};

describe('getNativeMapUrl', () => {
  it('falls back to Google Maps without browser information', () => {
    expect(getNativeMapUrl(urls, undefined)).toBe(urls.googleMapsUrl);
  });

  it('uses Apple Maps for iPhone and Mac platforms', () => {
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 0,
        platform: 'iPhone',
        userAgent: 'Mobile Safari',
      }),
    ).toBe(urls.appleMapsUrl);
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 0,
        platform: 'MacIntel',
        userAgent: 'Safari',
      }),
    ).toBe(urls.appleMapsUrl);
  });

  it('recognizes iPadOS using a touch-capable MacIntel platform', () => {
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 5,
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe(urls.appleMapsUrl);
  });

  it('uses Google Maps for non-Apple platforms', () => {
    expect(
      getNativeMapUrl(urls, {
        maxTouchPoints: 0,
        platform: 'Win32',
        userAgent: 'Chrome',
      }),
    ).toBe(urls.googleMapsUrl);
  });
});
```

- [ ] **Step 2: Run the selector test and confirm the red state**

Run:

```powershell
npx vitest run apps/web/src/nativeMapUrl.test.ts
```

Expected: FAIL because `apps/web/src/nativeMapUrl.ts` does not exist.

- [ ] **Step 3: Implement the focused selector**

Create `apps/web/src/nativeMapUrl.ts`:

```ts
export interface NativeMapUrls {
  googleMapsUrl: string;
  appleMapsUrl: string;
}

export type NavigatorLike = Pick<
  Navigator,
  'maxTouchPoints' | 'platform' | 'userAgent'
>;

function getBrowserNavigator(): NavigatorLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

export function getNativeMapUrl(
  urls: NativeMapUrls,
  navigatorLike: NavigatorLike | undefined = getBrowserNavigator(),
): string {
  if (!navigatorLike) {
    return urls.googleMapsUrl;
  }

  const platform = navigatorLike.platform.toLowerCase();
  const userAgent = navigatorLike.userAgent.toLowerCase();
  const isAppleDevice =
    /mac|iphone|ipad|ipod/.test(platform) ||
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === 'macintel' && navigatorLike.maxTouchPoints > 1);

  return isAppleDevice ? urls.appleMapsUrl : urls.googleMapsUrl;
}
```

- [ ] **Step 4: Replace both local implementations**

In `PublicPages.tsx` and `RsvpPages.tsx`, import `getNativeMapUrl` from `../nativeMapUrl.js`. Replace each venue call with:

```ts
const venueMapHref = getNativeMapUrl({
  googleMapsUrl: siteContent.venueMapUrl,
  appleMapsUrl: siteContent.venueAppleMapsUrl,
});
```

Delete both file-local `getNativeMapUrl()` functions. Do not change the public `siteContent.venueMapUrl` fields in this task.

- [ ] **Step 5: Run focused and regression tests**

Run:

```powershell
npx vitest run apps/web/src/nativeMapUrl.test.ts apps/web/src/pages/RsvpPages.test.tsx apps/web/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the selector refactor**

```powershell
git add apps/web/src/nativeMapUrl.ts apps/web/src/nativeMapUrl.test.ts apps/web/src/pages/PublicPages.tsx apps/web/src/pages/RsvpPages.tsx
git commit -m "refactor: share native map selection"
```

---

### Task 2: Approved story content, guide data, and responsive sources

**Files:**
- Modify: `packages/shared/src/siteContent.ts:10-45,117-161`
- Modify: `packages/shared/src/index.test.ts:435-480`
- Add: `apps/web/image-sources/asu-graduation.jpg`
- Add: `apps/web/image-sources/canadian-grand-prix.jpg`
- Modify: `apps/web/scripts/responsive-image-config.mjs`
- Regenerate locally (ignored): `apps/web/src/generated/responsiveImageAssets.ts`
- Regenerate locally (ignored): `apps/web/public/images/asu-graduation-*`
- Regenerate locally (ignored): `apps/web/public/images/canadian-grand-prix-*`

**Interfaces:**
- Consumes: existing `GalleryPhoto` image fields and responsive image keys.
- Produces: `ourStory.chapters`, `ourStory.phoenixGuide.groups`, and map destinations consumed by Tasks 3 and 4.

- [ ] **Step 1: Replace the placeholder-content test with exact failing expectations**

Update the structured-content block in `packages/shared/src/index.test.ts` to assert:

```ts
it('publishes the approved story chapters and personal photography', () => {
  expect(siteContent.ourStory.intro).toBe(
    "From meeting in a programming class at ASU to making a home together in Phoenix, we've shared plenty of adventures along the way. Here's a little about the story that brought us here.",
  );
  expect(siteContent.ourStory.heroImage.src).toBe('/engagement-10.jpg');
  expect(siteContent.ourStory.chapters.map((chapter) => chapter.id)).toEqual([
    'asu',
    'life-together',
    'proposal',
    'always-side-by-side',
  ]);
  expect(siteContent.ourStory.chapters[0]).toMatchObject({
    title: 'It started at ASU',
    images: [{ src: '/asu-graduation.jpg' }],
  });
  expect(siteContent.ourStory.chapters[1]).toMatchObject({
    title: 'Life together',
    images: [{ src: '/canadian-grand-prix.jpg' }],
  });
  expect(siteContent.ourStory.chapters[2]).toMatchObject({
    title: 'The proposal',
    images: [{ src: '/hero-wedding.jpg' }, { src: '/smile.jpg' }],
  });
  expect(siteContent.ourStory.chapters[3]).toMatchObject({
    title: 'Always side by side',
    images: [{ src: '/engagement-08.jpg' }],
  });
});

it('publishes grouped Phoenix favorites with paired map URLs', () => {
  const groups = siteContent.ourStory.phoenixGuide.groups;
  expect(groups.map((group) => group.id)).toEqual(['build', 'eat', 'explore']);

  const recommendations = groups.flatMap((group) => group.recommendations);
  const legoTour = recommendations.find((item) => item.id === 'lego-tour');
  expect(legoTour?.destinations.map((destination) => destination.label)).toEqual([
    'LEGO Store Scottsdale Quarter',
    'LEGO Store Chandler Fashion Center',
    'LEGO Store Arrowhead Towne Center',
  ]);
  expect(recommendations.map((item) => item.id)).toEqual([
    'lego-tour',
    'oreganos',
    'desert-botanical-garden',
    'papago-park',
    'mcdowell-sonoran-preserve',
    'piestewa-peak',
    'odysea-aquarium',
  ]);
  expect(
    recommendations
      .flatMap((item) => item.destinations)
      .every(
        (destination) =>
          new URL(destination.googleMapsUrl).hostname === 'www.google.com' &&
          new URL(destination.appleMapsUrl).hostname === 'maps.apple.com',
      ),
  ).toBe(true);
});
```

- [ ] **Step 2: Run the shared test and confirm the schema red state**

Run:

```powershell
npx vitest run packages/shared/src/index.test.ts
```

Expected: FAIL because `ourStory.chapters` and `ourStory.phoenixGuide` do not exist.

- [ ] **Step 3: Introduce the explicit content types**

Replace `StorySection` with these focused types in `siteContent.ts`:

```ts
type StoryImage = Pick<
  GalleryPhoto,
  'src' | 'alt' | 'objectPosition'
>;

interface StoryChapter {
  id: 'asu' | 'life-together' | 'proposal' | 'always-side-by-side';
  title: string;
  paragraphs: string[];
  images: StoryImage[];
}

interface MapDestination {
  label: string;
  address?: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
}

interface PhoenixRecommendation {
  id:
    | 'lego-tour'
    | 'oreganos'
    | 'desert-botanical-garden'
    | 'papago-park'
    | 'mcdowell-sonoran-preserve'
    | 'piestewa-peak'
    | 'odysea-aquarium';
  title: string;
  description: string;
  actionLabel: 'Open map' | 'Find nearby';
  destinations: MapDestination[];
}

interface PhoenixGuideGroup {
  id: 'build' | 'eat' | 'explore';
  title: string;
  recommendations: PhoenixRecommendation[];
}

interface PhoenixGuideContent {
  title: 'Our Phoenix favorites';
  intro: string;
  hikingNote: string;
  groups: PhoenixGuideGroup[];
}
```

Change `OurStoryContent` to expose `chapters: StoryChapter[]` and `phoenixGuide: PhoenixGuideContent`. Temporarily retain the existing `sections` field through Task 2 so the existing renderer remains type-safe; Task 3 removes it after migrating the renderer to `chapters`.

- [ ] **Step 4: Add the exact approved story data**

Set the hero to `/engagement-10.jpg` with alt text `Alison and Matt smiling at each other beneath leafy branches`. Add the four chapters in the tested order with these exact paragraph arrays:

```ts
[
  {
    id: 'asu',
    title: 'It started at ASU',
    paragraphs: [
      'We met during freshman year at Arizona State University in Introduction to Object-Oriented Programming. Matt was a computer science major, while Alison had to take the class despite being a math major rather than a computer science major like Matt (luckily for both of us!).',
      "We got to know each other through several more classes and stayed in touch even after the COVID-19 pandemic sent Matt away from the dorms. Once he returned, it wasn't long before we were dating, and the rest is history.",
      "We both graduated from ASU in 2023: Alison with an MS in Actuarial Science and Matt with a BS in Computer Science. Since then, we've made our home together in the Phoenix and Scottsdale area.",
    ],
    images: [{ src: '/asu-graduation.jpg', alt: 'Alison and Matt wearing their ASU graduation regalia together on campus' }],
  },
  {
    id: 'life-together',
    title: 'Life together',
    paragraphs: [
      "We spend many race weekends watching Formula 1 (and cheering for Max Verstappen!). Attending the 2025 Canadian Grand Prix was an experience we'll never forget.",
      'We also love cooking together, building LEGO sets, and working on puzzles. In fact, our dining room table is much better known as the designated puzzle table.',
    ],
    images: [{ src: '/canadian-grand-prix.jpg', alt: 'Alison and Matt together beside a Formula 1 show car at the 2025 Canadian Grand Prix' }],
  },
  {
    id: 'proposal',
    title: 'The proposal',
    paragraphs: [
      'During Easter weekend 2026, we traveled to Denver. We spent a lovely day sightseeing, including buying some LEGO, of course. Later, at City Park, Matt asked Alison to marry him.',
      "Matt's parents, Jane and Tom, and his brothers, Tim and Joe, were there to share the moment with us. Tim graciously captured it all in the proposal photos you see here.",
    ],
    images: [
      { src: '/hero-wedding.jpg', alt: 'Matt proposing to Alison at City Park in Denver' },
      { src: '/smile.jpg', alt: 'Alison and Matt smiling together after the proposal' },
    ],
  },
  {
    id: 'always-side-by-side',
    title: 'Always side by side',
    paragraphs: [
      "We're excited to take this big next step in our lives and celebrate it with the people we love. Whatever comes next, we know we'll always be by each other's side.",
    ],
    images: [{ src: '/engagement-08.jpg', alt: 'Matt kissing Alison on the cheek as they laugh together outdoors' }],
  },
]
```

- [ ] **Step 5: Add the approved guide data and paired URLs**

Construct static provider URLs using encoded destination names and addresses:

```ts
const googleMapsSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const appleMapsSearch = (query: string) =>
  `https://maps.apple.com/?q=${encodeURIComponent(query)}`;

const mapDestination = (
  label: string,
  query: string,
  address?: string,
): MapDestination => ({
  label,
  address,
  googleMapsUrl: googleMapsSearch(query),
  appleMapsUrl: appleMapsSearch(query),
});
```

Add this exact guide structure:

```ts
phoenixGuide: {
  title: 'Our Phoenix favorites',
  intro:
    "If you have some time while you're here, these are a few of the places around Phoenix that we enjoy and think are worth a visit.",
  hikingNote:
    'Desert trails can be demanding even in cooler weather. Bring water and check current trail conditions before heading out.',
  groups: [
    {
      id: 'build',
      title: 'Build the grand tour',
      recommendations: [
        {
          id: 'lego-tour',
          title: 'The Phoenix LEGO Store tour',
          description:
            "We can never resist a LEGO Store, and the Phoenix area has three. If you're feeling ambitious, see how many you can visit while you're here.",
          actionLabel: 'Open map',
          destinations: [
            mapDestination(
              'LEGO Store Scottsdale Quarter',
              'LEGO Store Scottsdale Quarter 15257 N Scottsdale Road Suite 170 Scottsdale AZ 85254',
              '15257 N Scottsdale Road, Suite 170, Scottsdale, AZ 85254',
            ),
            mapDestination(
              'LEGO Store Chandler Fashion Center',
              'LEGO Store Chandler Fashion Center 3111 W Chandler Boulevard Chandler AZ 85226',
              '3111 W Chandler Boulevard, Chandler, AZ 85226',
            ),
            mapDestination(
              'LEGO Store Arrowhead Towne Center',
              'LEGO Store Arrowhead Towne Center 7700 W Arrowhead Towne Center Glendale AZ 85308',
              '7700 W Arrowhead Towne Center, Glendale, AZ 85308',
            ),
          ],
        },
      ],
    },
    {
      id: 'eat',
      title: 'Eat',
      recommendations: [
        {
          id: 'oreganos',
          title: "Oregano's",
          description:
            "One of our favorite Arizona restaurant chains and an easy choice when you're in the mood for pizza or pasta.",
          actionLabel: 'Find nearby',
          destinations: [
            mapDestination("Oregano's", "Oregano's Phoenix Arizona"),
          ],
        },
      ],
    },
    {
      id: 'explore',
      title: 'Explore',
      recommendations: [
        {
          id: 'desert-botanical-garden',
          title: 'Desert Botanical Garden',
          description:
            'A beautiful way to explore the plants and landscapes that make the Sonoran Desert special.',
          actionLabel: 'Open map',
          destinations: [
            mapDestination(
              'Desert Botanical Garden',
              'Desert Botanical Garden 1201 N Galvin Parkway Phoenix AZ 85008',
              '1201 N Galvin Parkway, Phoenix, AZ 85008',
            ),
          ],
        },
        {
          id: 'papago-park',
          title: 'Papago Park',
          description:
            'An easy place to enjoy red-rock scenery, desert trails, and a great Phoenix sunset.',
          actionLabel: 'Open map',
          destinations: [
            mapDestination('Papago Park', 'Papago Park Phoenix Arizona'),
          ],
        },
        {
          id: 'mcdowell-sonoran-preserve',
          title: 'McDowell Sonoran Preserve',
          description:
            'Miles of Sonoran Desert trails with plenty of options for a morning outside.',
          actionLabel: 'Open map',
          destinations: [
            mapDestination(
              'McDowell Sonoran Preserve',
              'Gateway Trailhead 18333 N Thompson Peak Parkway Scottsdale AZ 85255',
              '18333 N Thompson Peak Parkway, Scottsdale, AZ 85255',
            ),
          ],
        },
        {
          id: 'piestewa-peak',
          title: 'Piestewa Peak',
          description:
            "One of Phoenix's classic hikes, with rewarding views across the Valley.",
          actionLabel: 'Open map',
          destinations: [
            mapDestination('Piestewa Peak', 'Piestewa Peak Phoenix Arizona'),
          ],
        },
        {
          id: 'odysea-aquarium',
          title: 'OdySea Aquarium',
          description:
            'A fun indoor stop in Scottsdale when you want a break from the desert trails.',
          actionLabel: 'Open map',
          destinations: [
            mapDestination(
              'OdySea Aquarium',
              'OdySea Aquarium 9500 E Via de Ventura Suite A-100 Scottsdale AZ 85256',
              '9500 E Via de Ventura, Suite A-100, Scottsdale, AZ 85256',
            ),
          ],
        },
      ],
    },
  ],
}
```

The helper calls intentionally use a broad Phoenix-area search for Oregano's and named-area searches for Papago Park and Piestewa Peak. Do not select a single Oregano's branch or invent a more specific trailhead for those entries.

Set the same hiking note shown above; do not add live hours or trail-condition fetching.

The final shared content test should also assert:

```ts
expect(siteContent.ourStory.phoenixGuide.hikingNote).toMatch(
  /Bring water and check current trail conditions/,
);
```

- [ ] **Step 6: Copy the selected binary sources and register responsive variants**

Run from the repository root:

```powershell
Copy-Item -LiteralPath 'C:\Users\mcbul\Downloads\ASU\69DD7A51-0066-450E-9982-F9DB93EB5735.jpeg' -Destination 'apps\web\image-sources\asu-graduation.jpg'
Copy-Item -LiteralPath 'C:\Users\mcbul\Downloads\CanadaGP\IMG_1371.jpeg' -Destination 'apps\web\image-sources\canadian-grand-prix.jpg'
```

Add these entries to `responsiveImages` in `apps/web/scripts/responsive-image-config.mjs`:

```js
{
  key: '/asu-graduation.jpg',
  source: 'asu-graduation.jpg',
  widths: [640, 960, 1440, 1920],
},
{
  key: '/canadian-grand-prix.jpg',
  source: 'canadian-grand-prix.jpg',
  widths: [640, 960, 1440, 1920],
},
```

- [ ] **Step 7: Regenerate assets and run focused content verification**

Run:

```powershell
npm run images:generate -w apps/web
npx vitest run packages/shared/src/index.test.ts apps/web/src/components/ResponsiveImage.test.tsx
npm run typecheck
```

Expected: PASS, with locally generated ignored AVIF/WebP/JPEG variants and manifest entries for both semantic source keys.

- [ ] **Step 8: Commit content and assets**

```powershell
git add packages/shared/src/siteContent.ts packages/shared/src/index.test.ts apps/web/image-sources/asu-graduation.jpg apps/web/image-sources/canadian-grand-prix.jpg apps/web/scripts/responsive-image-config.mjs
git commit -m "feat: add personal story content and photos"
```

---

### Task 3: Editorial story journey

**Files:**
- Modify: `apps/web/e2e/home.spec.ts:612-675`
- Modify: `apps/web/src/pages/PublicPages.tsx:350-455`
- Modify: `apps/web/src/pages/PublicPages.module.css:517-638`
- Modify: `apps/web/src/styles.css:819-860`

**Interfaces:**
- Consumes: `ourStory.heroImage` and ordered `ourStory.chapters` from Task 2.
- Produces: semantic chapter markup and class hooks later used by the guide and full-page E2E coverage.
- Removes: the temporary legacy `ourStory.sections` compatibility field after the renderer is migrated.

- [ ] **Step 1: Rewrite the editorial E2E test for the approved content**

Change `our story page renders editorial sections and calls to action` to verify:

```ts
await expect(page.getByRole('heading', { name: 'Our Story' })).toBeVisible();
await expect(page.getByText(/From meeting in a programming class at ASU/)).toBeVisible();
for (const heading of [
  'It started at ASU',
  'Life together',
  'The proposal',
  'Always side by side',
]) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}
await expect(page.getByText(/Introduction to Object-Oriented Programming/)).toBeVisible();
await expect(page.getByText(/2025 Canadian Grand Prix/)).toBeVisible();
await expect(page.getByText(/Jane and Tom/)).toBeVisible();
await expect(page.getByText(/always be by each other's side/)).toBeVisible();
```

Use `expectResponsiveImageDelivery` to verify these exact generated fallbacks:

- hero fallback `/images/engagement-10-1200.jpg`;
- ASU fallback `/images/asu-graduation-1920.jpg`;
- Canadian GP fallback `/images/canadian-grand-prix-1920.jpg`;
- proposal fallbacks `/images/hero-wedding-1920.jpg` and `/images/smile-1200.jpg`;
- closing fallback `/images/engagement-08-1200.jpg`.

- [ ] **Step 2: Run the editorial E2E test and confirm the red state**

Use a fresh port:

```powershell
$env:E2E_PORT='52173'; npx playwright test apps/web/e2e/home.spec.ts --grep "our story page renders editorial"
```

Expected: FAIL because the route still renders fixed placeholder sections.

- [ ] **Step 3: Render ordered chapters without fixed array positions**

Replace the four-section destructuring in `OurStoryPage`. Keep the existing hero and CTA band, but render:

```tsx
{ourStory.chapters.map((chapter, index) => (
  <StoryChapterSection
    chapter={chapter}
    key={chapter.id}
    reverse={index % 2 === 1}
  />
))}
```

Implement `StoryChapterSection` in `PublicPages.tsx` with image markup before copy in the DOM. Apply `story-chapter-reverse` only for desktop visual ordering. Use:

```tsx
<section
  className={cx(
    scoped(styles, 'story-chapter'),
    reverse && scoped(styles, 'story-chapter-reverse'),
    scoped(styles, `story-chapter-${chapter.id}`),
  )}
  aria-labelledby={`story-${chapter.id}`}
>
  <div className={scoped(styles, 'story-chapter-media')}>
    {chapter.images.map((image, imageIndex) => (
      <figure className={scoped(styles, 'story-chapter-image')} key={image.src}>
        <ResponsiveImage
          alt={image.alt}
          decoding="async"
          objectPosition={image.objectPosition}
          sizes="(min-width: 900px) 48vw, 100vw"
          src={image.src}
        />
      </figure>
    ))}
  </div>
  <div className={scoped(styles, 'story-copy-block')}>
    <h2 id={`story-${chapter.id}`}>{chapter.title}</h2>
    {chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
  </div>
</section>
```

Remove the now-unused fixed `StoryText` shape or update it to accept `paragraphs: string[]` if keeping it improves readability.

- [ ] **Step 4: Implement the approved editorial CSS**

In `PublicPages.module.css`:

- keep the current hero grid but use an image aspect/crop appropriate for `engagement-10`;
- replace `story-section-meet`, `story-section-proposal`, and `story-section-duo` with `.story-chapter`, `.story-chapter-reverse`, `.story-chapter-media`, and `.story-chapter-image`;
- use two balanced columns at desktop, `max-width: 1180px`, and existing spacing tokens;
- give `.story-chapter-proposal` a full-width tinted background and a two-image media grid;
- add `gap` between successive chapter paragraphs;
- keep rounded corners and existing shadow tokens;
- make the closing chapter visually concise rather than another oversized hero.

In the existing `@media (max-width: 980px)` block in `styles.css`, set `.story-chapter { grid-template-columns: 1fr; }`, reset reverse ordering so media stays before copy, and collapse the proposal media pair without overflow. At 560px, use a single proposal-image column if two images make each image too narrow.

- [ ] **Step 5: Run editorial desktop and mobile coverage**

```powershell
$env:E2E_PORT='52173'; npx playwright test apps/web/e2e/home.spec.ts --grep "our story page"
```

Expected: both editorial and mobile-overflow tests PASS. Update the mobile layout assertions to target `.story-chapter` and confirm the first image precedes its copy at 390px.

- [ ] **Step 6: Commit the editorial route**

```powershell
git add apps/web/e2e/home.spec.ts apps/web/src/pages/PublicPages.tsx apps/web/src/pages/PublicPages.module.css apps/web/src/styles.css
git commit -m "feat: tell our story as an editorial journey"
```

---

### Task 4: Phoenix favorites guide and destination-aware links

**Files:**
- Modify: `apps/web/e2e/home.spec.ts:612-675,823-844`
- Modify: `apps/web/src/pages/PublicPages.tsx:350-480`
- Modify: `apps/web/src/pages/PublicPages.module.css:517-680`
- Modify: `apps/web/src/styles.css:819-880`

**Interfaces:**
- Consumes: `ourStory.phoenixGuide.groups` from Task 2 and `getNativeMapUrl()` from Task 1.
- Produces: one semantic Phoenix guide section with nine destination links and device-aware provider selection.

- [ ] **Step 1: Add failing guide and Apple-device E2E assertions**

Extend the desktop Our Story test:

```ts
await expect(
  page.getByRole('heading', { name: 'Our Phoenix favorites' }),
).toBeVisible();
for (const heading of ['Build the grand tour', 'Eat', 'Explore']) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}
for (const destination of [
  'LEGO Store Scottsdale Quarter',
  'LEGO Store Chandler Fashion Center',
  'LEGO Store Arrowhead Towne Center',
  "Oregano's",
  'Desert Botanical Garden',
  'Papago Park',
  'McDowell Sonoran Preserve',
  'Piestewa Peak',
  'OdySea Aquarium',
]) {
  await expect(
    page.getByRole('link', { name: new RegExp(destination, 'i') }),
  ).toHaveAttribute('href', /google\.com\/maps/);
}
```

Add a separate test that sets `navigator.platform` to `iPhone`, visits `/our-story`, and asserts all nine guide links have `href` matching `/maps\.apple\.com/`.

- [ ] **Step 2: Run guide tests and confirm the red state**

```powershell
$env:E2E_PORT='52179'; npx playwright test apps/web/e2e/home.spec.ts --grep "Phoenix favorites|Apple Maps on the story"
```

Expected: FAIL because no guide exists.

- [ ] **Step 3: Render semantic recommendation groups**

Add `PhoenixGuideSection` after story chapters and before the CTA band:

```tsx
function PhoenixGuideSection({ guide }: { guide: typeof siteContent.ourStory.phoenixGuide }) {
  return (
    <section
      className={scoped(styles, 'phoenix-guide')}
      aria-labelledby="phoenix-guide-heading"
    >
      <div className={scoped(styles, 'phoenix-guide-heading')}>
        <p className="eyebrow">While you're here</p>
        <h2 id="phoenix-guide-heading">{guide.title}</h2>
        <p>{guide.intro}</p>
      </div>
      <div className={scoped(styles, 'phoenix-guide-groups')}>
        {guide.groups.map((group) => (
          <section
            className={scoped(styles, `phoenix-guide-group-${group.id}`)}
            key={group.id}
            aria-labelledby={`phoenix-guide-${group.id}`}
          >
            <h3 id={`phoenix-guide-${group.id}`}>{group.title}</h3>
            <div className={scoped(styles, 'phoenix-recommendations')}>
              {group.recommendations.map((recommendation) => (
                <article className={scoped(styles, 'phoenix-recommendation')} key={recommendation.id}>
                  <h4>{recommendation.title}</h4>
                  <p>{recommendation.description}</p>
                  <div className={scoped(styles, 'phoenix-map-links')}>
                    {recommendation.destinations.map((destination) => (
                      <a
                        aria-label={`${recommendation.actionLabel}: ${destination.label}`}
                        href={getNativeMapUrl(destination)}
                        key={destination.label}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <MapPin aria-hidden="true" />
                        {destination.label}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className={scoped(styles, 'phoenix-hiking-note')}>{guide.hikingNote}</p>
    </section>
  );
}
```

The `MapDestination` object structurally satisfies `NativeMapUrls`; do not cast it.

- [ ] **Step 4: Style the approved compact guide**

In `PublicPages.module.css`, create a dark-accent `.phoenix-guide` band using existing theme variables, a featured full-width build card, and smaller eat/explore entries. Give every link at least a 44px touch target, visible focus, and destination labels that wrap naturally.

In `styles.css`, collapse guide groups and recommendation grids to one column below 980px. At 560px, keep map links full-width and ensure long LEGO destination names wrap without increasing document width.

- [ ] **Step 5: Run guide, native-map, and mobile checks**

```powershell
$env:E2E_PORT='52179'; npx playwright test apps/web/e2e/home.spec.ts --grep "our story page|Phoenix favorites|Apple Maps"
```

Expected: PASS, including the existing homepage Apple Maps test and the new guide test.

- [ ] **Step 6: Commit the Phoenix guide**

```powershell
git add apps/web/e2e/home.spec.ts apps/web/src/pages/PublicPages.tsx apps/web/src/pages/PublicPages.module.css apps/web/src/styles.css
git commit -m "feat: add our Phoenix favorites guide"
```

---

### Task 5: Documentation and full verification

**Files:**
- Modify: `apps/web/public/llms.txt:8`
- Modify: `docs/ARCHITECTURE.md:41-44`

**Interfaces:**
- Consumes: completed static story page, native map utility, and generated image assets.
- Produces: accurate public-route documentation and final evidence that the feature is ready for review.

- [ ] **Step 1: Update public-route documentation**

Change the `llms.txt` Our Story description to:

```text
- [Our story](https://matt-alison.com/our-story): How Matt and Alison met, their life together, their proposal, and a guide to favorite Phoenix-area places.
```

Remove the stale `/sms-updates` public-page entry because that legacy route now redirects to `/`.

Update the Public Site paragraph in `docs/ARCHITECTURE.md` to state that the static story route includes responsive personal photography and device-aware Google/Apple map links for Phoenix recommendations. Do not document provider hours or other time-sensitive attraction details.

- [ ] **Step 2: Run the complete code-level verification sequence**

```powershell
npm run images:generate -w apps/web
npm run typecheck
npm test
npm run lint
npm run build -w apps/web
git diff --check
```

Expected: every command exits 0. After the web build, inspect `git status --short` and retain only generated changes caused by the two intentional image sources.

- [ ] **Step 3: Run full end-to-end coverage on a fresh port**

```powershell
$env:CI='1'; $env:E2E_PORT='52187'; $env:VITE_ENABLE_LOCAL_ADMIN_MOCKS='false'; npm run test:e2e
```

Expected: the complete Playwright suite passes. Confirm no process continues listening on port `52187` after the run.

- [ ] **Step 4: Perform rendered browser QA**

Use the `wedding-frontend-local-testing` skill and the available in-app Browser tooling. Start a fresh local server, inspect `/our-story` at desktop and 390px mobile widths, and verify:

- hero and chapter crops keep both faces visible;
- ASU, Canadian GP, proposal, and recent engagement photos load through `<picture>` and choose generated AVIF/WebP sources;
- alternating desktop composition becomes media-first single-column mobile composition;
- all story copy matches the approved text;
- the LEGO tour reads as one featured recommendation with three distinct map links;
- guide links have visible keyboard focus and no clipped text;
- light and dark themes maintain readable contrast;
- the page has no horizontal overflow;
- the wedding-details and RSVP actions remain visible and functional.

Stop the local server started for QA and record the chosen port in the final handoff.

- [ ] **Step 5: Commit documentation and any verification-only corrections**

```powershell
git add apps/web/public/llms.txt docs/ARCHITECTURE.md
git commit -m "docs: describe story and Phoenix guide"
```

If verification required code corrections, commit those corrections separately with a message describing the corrected behavior before this documentation commit. Finish with `git status --short --branch` and confirm there are no untracked generated assets from the responsive-image build.
