# Our Story and Phoenix Favorites Design

**Date:** August 8, 2026
**Status:** Approved design

## Goal

Replace the placeholder Our Story content with Matt and Alison's real story, refresh the page with recently added engagement photography and selected personal photos, and add a lighthearted guide to places they enjoy around the Phoenix area.

The page should remain simple, static, responsive, accessible, and consistent with the existing wedding site. It must not add runtime services, location permissions, embedded tracking maps, or new infrastructure.

## Approved Direction

Use the approved **Editorial journey** direction. The page reads chronologically with alternating text and photography. A compact Phoenix guide follows the emotional story as a cheerful encore rather than competing with it.

The page order is:

1. Hero
2. It started at ASU
3. Life together
4. The proposal
5. Always side by side
6. Our Phoenix favorites
7. Existing wedding-details and RSVP actions

## Voice and Writing Style

- Write from a shared "we" perspective.
- Keep the tone warm, direct, and lightly playful.
- Avoid inflated or generic wedding language.
- Prefer ordinary punctuation and parentheses over forced em dashes.
- Use calendar years instead of relative phrases such as "last year" or "earlier this year."

## Approved Story Copy

### Introduction

> From meeting in a programming class at ASU to making a home together in Phoenix, we've shared plenty of adventures along the way. Here's a little about the story that brought us here.

### It started at ASU

> We met during freshman year at Arizona State University in Introduction to Object-Oriented Programming. Matt was a computer science major, while Alison had to take the class despite being a math major rather than a computer science major like Matt (luckily for both of us!).

> We got to know each other through several more classes and stayed in touch even after the COVID-19 pandemic sent Matt away from the dorms. Once he returned, it wasn't long before we were dating, and the rest is history.

> We both graduated from ASU in 2023: Alison with an MS in Actuarial Science and Matt with a BS in Computer Science. Since then, we've made our home together in the Phoenix and Scottsdale area.

### Life together

> We spend many race weekends watching Formula 1 (and cheering for Max Verstappen!). Attending the 2025 Canadian Grand Prix was an experience we'll never forget.

> We also love cooking together, building LEGO sets, and working on puzzles. In fact, our dining room table is much better known as the designated puzzle table.

### The proposal

> During Easter weekend 2026, we traveled to Denver. We spent a lovely day sightseeing, including buying some LEGO, of course. Later, at City Park, Matt asked Alison to marry him.

> Matt's parents, Jane and Tom, and his brothers, Tim and Joe, were there to share the moment with us. Tim graciously captured it all in the proposal photos you see here.

### Always side by side

> We're excited to take this big next step in our lives and celebrate it with the people we love. Whatever comes next, we know we'll always be by each other's side.

## Photography

Use the site's existing responsive image pipeline and `ResponsiveImage` component for every image.

### Selected images

- Hero: `engagement-10.jpg`, a wide recent engagement portrait with both people looking at each other.
- ASU chapter: the supplied wide graduation photo `69DD7A51-0066-450E-9982-F9DB93EB5735.jpeg`. Import it under a semantic source name such as `asu-graduation.jpg`.
- Life together chapter: the supplied Canadian Grand Prix photo `IMG_1371.jpeg`, showing Matt and Alison together beside the show car. Import it as `canadian-grand-prix.jpg`.
- Proposal chapter: use Tim's original `hero-wedding.jpg` proposal moment and `smile.jpg` post-proposal portrait. Keep `ring.jpg` available elsewhere in the site, but do not add it to this chapter.
- Closing chapter: `engagement-08.jpg`, a recent vertical engagement portrait with a candid, affectionate expression.

The other supplied ASU and Canadian Grand Prix photos remain outside the repository because the approved layout does not need them.

All new source images receive responsive AVIF, WebP, and JPEG variants through the existing generator. Alt text must describe the visible moment and location without repeating nearby prose.

## Phoenix Favorites

Use this introduction to frame the guide as personal recommendations rather than a comprehensive tourism list:

> If you have some time while you're here, these are a few of the places around Phoenix that we enjoy and think are worth a visit.

### Build the grand tour

Create one featured LEGO Store tour card with this description. Each stop has its own device-aware **Open map** action.

> We can never resist a LEGO Store, and the Phoenix area has three. If you're feeling ambitious, see how many you can visit while you're here.

1. LEGO Store Scottsdale Quarter, 15257 N Scottsdale Road, Suite 170, Scottsdale, AZ 85254
2. LEGO Store Chandler Fashion Center, 3111 W Chandler Boulevard, Chandler, AZ 85226
3. LEGO Store Arrowhead Towne Center, 7700 W Arrowhead Towne Center, Glendale, AZ 85308

### Eat

Present Oregano's with this description. Do not favor one branch. The action label is **Find nearby** and opens a maps search for Oregano's in the Phoenix area.

> One of our favorite Arizona restaurant chains and an easy choice when you're in the mood for pizza or pasta.

### Explore

Render each destination as an individual compact entry with the specified description and an **Open map** action:

- Desert Botanical Garden, 1201 N Galvin Parkway, Phoenix, AZ 85008: "A beautiful way to explore the plants and landscapes that make the Sonoran Desert special."
- Papago Park, Phoenix, AZ: "An easy place to enjoy red-rock scenery, desert trails, and a great Phoenix sunset."
- McDowell Sonoran Preserve, targeting Gateway Trailhead at 18333 N Thompson Peak Parkway, Scottsdale, AZ 85255: "Miles of Sonoran Desert trails with plenty of options for a morning outside."
- Piestewa Peak, targeting the City of Phoenix Piestewa Peak trail area: "One of Phoenix's classic hikes, with rewarding views across the Valley."
- OdySea Aquarium, 9500 E Via de Ventura, Suite A-100, Scottsdale, AZ 85256: "A fun indoor stop in Scottsdale when you want a break from the desert trails."

The hiking group includes one concise note reminding guests to bring water and check current trail conditions. The site does not display live conditions or hours.

## Map-Link Behavior

Represent every map destination with paired `googleMapsUrl` and `appleMapsUrl` values in shared content.

Generalize the current native-map selection into one reusable function that accepts a URL pair:

- Apple devices receive the Apple Maps URL.
- Non-Apple devices receive the Google Maps URL.
- Server rendering or unavailable device information falls back to Google Maps.

Use this shared behavior for the homepage venue, RSVP venue link, and all Phoenix recommendations. External map links open in a new tab with `rel="noreferrer"`. No location permission is requested.

For exact destinations, use map search URLs containing the verified destination name and address. For Oregano's, Papago Park, and Piestewa Peak, use named-area search URLs rather than inventing a single branch or trailhead not selected by the user.

## Content and Component Structure

Keep story and guide data in `packages/shared/src/siteContent.ts`.

Replace the current fixed four-item story assumption with explicit structures:

- `StoryChapter`: stable identifier, title, paragraphs, and one or more image references.
- `MapDestination`: label, optional address, Google Maps URL, and Apple Maps URL.
- `PhoenixRecommendation`: identifier, title, description, category, and one or more map destinations.
- `OurStoryContent`: title, introduction, hero image, ordered chapters, Phoenix guide content, and existing calls to action.

Render ordered chapters rather than destructuring specific array positions. Keep the Phoenix guide as a focused section within `OurStoryPage`; do not create a new route.

Extract the duplicated native-map decision logic from the public and RSVP pages into a small shared web utility. Do not create a broader location or navigation abstraction.

## Visual Design

- Preserve the existing site typography, colors, buttons, and editorial tone.
- Use a full-width or split editorial hero with `engagement-10.jpg`.
- Alternate chapter image and copy alignment on larger screens.
- Collapse every chapter into a single readable column on mobile, with the image preceding the text when needed for comprehension.
- Give proposal photography more room than small thumbnails because it is a pivotal chapter.
- Present Phoenix recommendations as a compact dark-accent band or card group near the end of the page.
- Make the LEGO tour visually featured without using LEGO trademarks as decorative graphics or introducing third-party brand assets.
- Retain the existing wedding-details and RSVP calls to action after the guide.

## Accessibility and Resilience

- Maintain one `h1` and a logical heading hierarchy.
- Use semantic sections, lists, figures, and links.
- Provide specific alt text for all story images.
- Keep all text readable without images.
- Ensure link purpose is clear from accessible names, including the destination name when multiple **Open map** links appear.
- Maintain visible keyboard focus and existing contrast standards.
- Avoid horizontal overflow at supported mobile widths.
- Static content means there is no loading or network error state. A map-provider failure remains an ordinary external-link failure and does not affect page rendering.

## Verification

### Content and unit coverage

- Verify story copy, ordered chapters, image metadata, recommendation groups, and all three LEGO destinations.
- Verify every recommendation has a valid Google and Apple URL pair.
- Verify the reusable map selector chooses Apple Maps for Apple device signals and Google Maps otherwise.
- Verify the homepage and RSVP venue links continue to use the same behavior after deduplication.

### Image pipeline

- Add the two selected supplied photos to `apps/web/image-sources` under semantic names.
- Add them to the responsive image configuration.
- Regenerate committed responsive image metadata and assets using the existing image build workflow.
- Confirm unrelated generated files do not drift.

### Application verification

- Run type checking, unit tests, linting, and the production web build.
- Run targeted Playwright coverage for the Our Story page and native map selection.
- Verify desktop and mobile chapter order, guide layout, accessible map-link names, calls to action, and absence of horizontal overflow.
- Inspect the rendered page in a real browser on a fresh local port, including responsive image delivery and both light and dark themes if the section inherits theme variants.

## Verified Destination Sources

- LEGO Scottsdale Quarter: <https://www.lego.com/en-us/stores/store/scottsdale-quarter>
- LEGO Chandler Fashion Center: <https://www.lego.com/en-us/stores/store/chandler-fashion-center>
- LEGO Arrowhead Towne Center: <https://www.lego.com/en-us/stores/store/arrowhead-towne-center>
- Desert Botanical Garden: <https://dbg.org/contact/>
- McDowell Sonoran Preserve trailheads: <https://www.scottsdaleaz.gov/preserve>
- Papago Park: <https://www.phoenix.gov/administration/departments/parks/activities-facilities/trails/papago-park.html>
- Piestewa Peak trails: <https://www.phoenix.gov/administration/departments/parks/activities-facilities/trails/piestewa-peak-dreamy-draw/piestewa-trails.html>
- OdySea Aquarium: <https://www.odyseaaquarium.com/about/contact-us/>

These sources establish names and destinations. The implementation uses maps links, not scraped hours or admission details, so changing operational information does not become stale site content.
