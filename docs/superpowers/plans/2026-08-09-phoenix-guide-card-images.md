# Phoenix Guide Card Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the supplied local images as responsive decorative background layers for all nine LEGO, Eat, and Explore cards on `/our-story`, including new Buck and Rider and Bei Sushi Eat cards.

**Architecture:** Store each image source beside its Phoenix recommendation in `packages/shared/src/siteContent.ts`. Register the nine source files in the existing responsive-image generator, then render each image through `ResponsiveImage` in an absolute background layer with a contrast overlay and a foreground content wrapper. No new component or service is needed.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vite, Sharp, Playwright, Vitest.

## Global Constraints

- Keep the change scoped to the Phoenix recommendation cards and the supplied local assets.
- Preserve existing recommendation copy, destinations, map links, layout, and accessibility semantics.
- Add the two new Eat cards using the existing recommendation and map-destination patterns.
- Treat card images as decorative with empty alt text.
- Use the existing responsive-image generation pipeline; do not add a new image dependency or service.
- Preserve unrelated dirty-worktree changes.

---

### Task 1: Register all supplied images with the responsive image pipeline

**Files:**
- Modify: `apps/web/scripts/responsive-image-config.mjs`
- Generate: `apps/web/public/images/*` and `apps/web/src/generated/responsiveImageAssets.ts`

**Interfaces:**
- Consumes: the nine files in `apps/web/image-sources`.
- Produces: `responsiveImageAssets` entries keyed by the source paths used in shared content.

- [ ] **Step 1: Add the nine image registrations**

Add these entries to `responsiveImages`:

```js
{ key: '/lego.jpg', source: 'lego.jpg', widths: [480, 800, 1200] },
{ key: '/oreganos.jpg', source: 'oreganos.jpg', widths: [480, 800, 1200] },
{ key: '/buck-and-rider.jpg', source: 'buck-and-rider.jpg', widths: [480, 800, 1200] },
{ key: '/sushi.jpg', source: 'sushi.jpg', widths: [480, 800, 1200] },
{ key: '/botanical-gardens.jpeg', source: 'botanical-gardens.jpeg', widths: [480, 800, 1200] },
{ key: '/papago-park.jpg', source: 'papago-park.jpg', widths: [480, 800, 1200] },
{ key: '/mcdowell-sonoran-preserve.jpg', source: 'mcdowell-sonoran-preserve.jpg', widths: [480, 800, 1200] },
{ key: '/piestwa-peak.png', source: 'piestwa-peak.png', widths: [480, 800, 1200] },
{ key: '/odysea.jpg', source: 'odysea.jpg', widths: [480, 800, 1200] },
```

- [ ] **Step 2: Generate optimized variants**

Run:

```bash
npm run images:generate -w apps/web
```

Expected: exit 0, with AVIF/WebP/JPEG variants for all nine sources under `apps/web/public/images`.

- [ ] **Step 3: Confirm generated manifest keys**

Run:

```rg -n "lego|oreganos|buck-and-rider|sushi|botanical-gardens|papago-park|mcdowell-sonoran-preserve|piestwa-peak|odysea" apps/web/src/generated/responsiveImageAssets.ts
```

Expected: all nine source keys appear.

### Task 2: Attach image sources and add the two Eat recommendations

**Files:**
- Modify: `packages/shared/src/siteContent.ts:49-61,279-361`

**Interfaces:**
- Consumes: generated image keys from Task 1.
- Produces: `PhoenixRecommendation.backgroundImage?: string`, populated for all nine recommendations.

- [ ] **Step 1: Extend the recommendation type**

Add:

```ts
backgroundImage?: string;
```

- [ ] **Step 2: Assign image keys to existing recommendations**

Use these exact mappings:

```ts
'lego-tour': '/lego.jpg',
'oreganos': '/oreganos.jpg',
'desert-botanical-garden': '/botanical-gardens.jpeg',
'papago-park': '/papago-park.jpg',
'mcdowell-sonoran-preserve': '/mcdowell-sonoran-preserve.jpg',
'piestewa-peak': '/piestwa-peak.png',
'odysea-aquarium': '/odysea.jpg',
```

- [ ] **Step 3: Add the new Eat recommendations**

Append these objects to the existing `eat.recommendations` array, preserving the existing Oregano's object:

```ts
{
  id: 'buck-and-rider',
  title: 'Buck and Rider',
  description: 'A welcoming spot for a memorable meal while you are in Phoenix.',
  actionLabel: 'Find nearby',
  backgroundImage: '/buck-and-rider.jpg',
  destinations: [
    mapDestination('Buck & Rider', 'Buck & Rider Phoenix Arizona'),
  ],
},
{
  id: 'bei-sushi',
  title: 'Bei Sushi',
  description: 'A fun choice when you are in the mood for sushi in Phoenix.',
  actionLabel: 'Find nearby',
  backgroundImage: '/sushi.jpg',
  destinations: [
    mapDestination('Bei Sushi', 'Bei Sushi Phoenix Arizona'),
  ],
},
```

- [ ] **Step 4: Run shared typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

### Task 3: Render readable image-backed recommendation cards

**Files:**
- Modify: `apps/web/src/pages/PublicPages.tsx:405-454`
- Modify: `apps/web/src/pages/PublicPages.module.css:698-735`

**Interfaces:**
- Consumes: `recommendation.backgroundImage` and `ResponsiveImage`.
- Produces: nine cards with image layer, contrast overlay, and unchanged foreground actions.

- [ ] **Step 1: Add the decorative image and content layers**

Inside each `phoenix-recommendation` article, render the image when present and wrap the existing heading, paragraph, and map links:

```tsx
{recommendation.backgroundImage && (
  <div
    aria-hidden="true"
    className={scoped(styles, 'phoenix-recommendation-image')}
  >
    <ResponsiveImage
      alt=""
      sizes="(min-width: 900px) 40vw, 100vw"
      src={recommendation.backgroundImage}
    />
  </div>
)}
<div className={scoped(styles, 'phoenix-recommendation-content')}>
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
</div>
```

Keep the existing article key, group structure, destination link labels, map URLs, and target behavior.

- [ ] **Step 2: Add image, overlay, and stacking styles**

Add these focused rules while retaining existing card styling:

```css
.phoenix-recommendation {
  isolation: isolate;
  overflow: hidden;
  position: relative;
}

.phoenix-recommendation-image,
.phoenix-recommendation-image::after {
  inset: 0;
  position: absolute;
}

.phoenix-recommendation-image {
  z-index: 0;
}

.phoenix-recommendation-image::after {
  background: linear-gradient(
    135deg,
    rgb(5 27 21 / 88%),
    rgb(5 27 21 / 62%) 55%,
    rgb(5 27 21 / 78%)
  );
  content: '';
  z-index: 1;
}

.phoenix-recommendation-image img {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.phoenix-recommendation-content {
  position: relative;
  z-index: 2;
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

### Task 4: Add focused coverage and perform visual QA

**Files:**
- Modify: `apps/web/e2e/home.spec.ts` in the existing Our Story test.

**Interfaces:**
- Consumes: rendered recommendation image layers from Task 3.
- Produces: regression coverage for all nine responsive image deliveries.

- [ ] **Step 1: Assert all nine recommendation images render**

Add to the existing Our Story test:

```ts
const guideImages = page.locator('[class*="phoenix-recommendation-image"] img');
await expect(guideImages).toHaveCount(9);
await expect
  .poll(() =>
    guideImages.evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).currentSrc),
    ),
  )
  .toEqual(
    expect.arrayContaining([
      expect.stringContaining('/images/lego-'),
      expect.stringContaining('/images/oreganos-'),
      expect.stringContaining('/images/buck-and-rider-'),
      expect.stringContaining('/images/sushi-'),
      expect.stringContaining('/images/botanical-gardens-'),
      expect.stringContaining('/images/papago-park-'),
      expect.stringContaining('/images/mcdowell-sonoran-preserve-'),
      expect.stringContaining('/images/piestwa-peak-'),
      expect.stringContaining('/images/odysea-'),
    ]),
  );
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test -- apps/web/src/components/ResponsiveImage.test.tsx
npm run test:e2e -- --grep "our story page renders editorial sections"
```

Expected: both commands exit 0.

- [ ] **Step 3: Verify the target flow in the local browser**

Flow under test: `/our-story` -> all Phoenix recommendation cards render -> image layers load -> map links remain visible and clickable.

Use `http://127.0.0.1:50082/our-story` at desktop and 390px mobile widths. Confirm the page is not blank, no framework error overlay appears, no relevant console errors are logged, all nine image layers load, text remains readable, and at least one map link retains its existing map URL.

- [ ] **Step 4: Run final checks**

Run:

```bash
npm run typecheck
git diff --check
```

Expected: both commands exit 0.
