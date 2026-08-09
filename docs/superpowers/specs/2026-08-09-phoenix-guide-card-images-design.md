# Phoenix Guide Card Images

## Goal

Add visual variety to the Our Story page by giving each LEGO, Eat, and Explore recommendation card its matching local image.

## Design

- Add an optional decorative image source to the shared Phoenix recommendation content.
- Assign the supplied assets to the seven recommendations:
  - `lego.jpg`
  - `oreganos.jpg`
  - `botanical-gardens.jpeg`
  - `papago-park.jpg`
  - `mcdowell-sonoran-preserve.jpg`
  - `piestwa-peak.png`
  - `odysea.jpg`
- Render each image with the existing `ResponsiveImage` component as an absolutely positioned background layer inside the recommendation card.
- Add a translucent overlay above the image and below the card content to preserve text and link contrast.
- Keep the existing recommendation content, map links, card structure, responsive layout, and accessibility semantics unchanged. The images are decorative, so they use empty alt text.
- Run the existing responsive-image preparation/build flow so each new source gets optimized variants.

## Non-goals

- No new image service or component abstraction.
- No changes to recommendation copy, destinations, or navigation behavior.
- No redesign of the Phoenix guide layout beyond the image layer and contrast treatment.

## Validation

- Typecheck the shared, API, web, and infrastructure packages.
- Run the relevant web tests.
- Verify `/our-story` in the local browser at desktop and mobile widths, checking that all seven images load, text remains readable, and map links remain clickable.
- Run `git diff --check`.
