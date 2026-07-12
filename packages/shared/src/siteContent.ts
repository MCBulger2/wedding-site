import type { CalendarEvent, HotelBlock } from './index.js';

interface RegistryLink {
  name: string;
  description: string;
  url: string;
  linkLabel: string;
  image?: {
    src: string;
    alt: string;
    objectPosition?: string;
  };
}

interface RegistryContent {
  title: string;
  intro: string;
  note: string;
  comingSoonTitle: string;
  comingSoonMessage: string;
  links: RegistryLink[];
}

interface GalleryPhoto {
  src: string;
  alt: string;
  caption: string;
  detail?: string;
  objectPosition?: string;
}

interface StorySection {
  title: string;
  body: string;
  image?: Pick<GalleryPhoto, 'src' | 'alt' | 'objectPosition'>;
}

interface OurStoryContent {
  title: string;
  intro: string;
  heroImage: Pick<GalleryPhoto, 'src' | 'alt' | 'objectPosition'>;
  sections: StorySection[];
  ctas: {
    detailsLabel: string;
    rsvpLabel: string;
  };
}

const venue = {
  name: 'Superstition Manor',
  location: '1220 N Signal Butte Rd, Mesa, AZ 85207',
  urls: {
    googleMaps:
      'https://www.google.com/maps/place/Superstition+Manor+Wedding+%26+Event+Center/@33.437824,-111.6011223,1301m/data=!3m2!1e3!4b1!4m6!3m5!1s0x872bb099b11510fd:0x63a10ccbb2e45498!8m2!3d33.437824!4d-111.5985474!16s%2Fg%2F11b5plb0_6?entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D',
    appleMaps: 'https://maps.apple/p/.MpX6qJ9zEasjg',
    openStreetMapEmbed:
      'https://www.openstreetmap.org/export/embed.html?bbox=-111.60154044628145%2C33.43481681617157%2C-111.59690022468568%2C33.44042143559003&layer=mapnik',
  },
};

const weddingEvent: CalendarEvent = {
  title: "Matt & Alison's Wedding",
  start: '2027-01-18T22:00:00.000Z',
  end: '2027-01-19T04:00:00.000Z',
  timezone: 'America/Phoenix',
  location: venue.location,
  description: 'Ceremony, dinner, and reception for Matt and Alison.',
};

const hotels: HotelBlock[] = [];

const registry: RegistryContent = {
  title: 'Wedding Registry',
  intro:
    'Your presence at our celebration is the greatest gift. If you would like to contribute, our honeymoon and future-home funds are available below.',
  note: 'Both funds are hosted securely through Joy.',
  comingSoonTitle: 'Registry details coming soon',
  comingSoonMessage:
    'Check back closer to the celebration for registry links and any gift notes from Matt and Alison.',
  links: [
    {
      name: 'Honeymoon Fund',
      description:
        'Help us make our honeymoon unforgettable with a contribution to our travel fund.',
      url: 'https://withjoy.com/matthew-and-alison-jan-2027/registry?pid=86869e07-24e0-4107-9e8a-dd6a571d2f86',
      linkLabel: 'Contribute',
      image: {
        src: '/registry-honeymoon-fund.jpg',
        alt: 'Travel journals, sunglasses, and a camera overlooking a coastal honeymoon destination',
      },
    },
    {
      name: 'Down Payment Fund',
      description:
        'Support our future home by contributing to our down payment fund.',
      url: 'https://withjoy.com/matthew-and-alison-jan-2027/registry?pid=f1fb6734-a2e9-4244-bea4-19b7646448a2',
      linkLabel: 'Contribute',
      image: {
        src: '/registry-down-payment-fund.jpg',
        alt: 'Ceramic house, keys, and greenery on a warm tabletop',
      },
    },
  ],
};

const contactEmail = resolveRuntimeValue(
  'CONTACT_EMAIL_ADDRESS',
  'VITE_CONTACT_EMAIL_ADDRESS',
) ?? 'contact@matt-alison.com';

const contact = {
  email: contactEmail,
  href: `mailto:${contactEmail}`,
};

const ourStory: OurStoryContent = {
  title: 'Our Story',
  intro: 'A little about the moments and everyday joys that brought us here.',
  heroImage: {
    src: '/hero-wedding.jpg',
    alt: 'Matt proposing to Alison by the lake',
    objectPosition: 'center',
  },
  sections: [
    {
      title: 'How we met',
      body:
        'We met in the spring of 2021 through mutual friends at a small get-together in Phoenix. A long conversation about travel, tacos, and terrible pool volleyball sealed the deal. We have been adventuring together ever since.',
      image: {
        src: '/ring.jpg',
        alt: "Alison's engagement ring",
        objectPosition: 'center',
      },
    },
    {
      title: 'The proposal',
      body:
        'On a quiet morning hike in Sedona, Matt found the perfect spot to ask the question. There were happy tears, a lot of hugging, and a celebratory coffee in town.',
      image: {
        src: '/smile.jpg',
        alt: 'Alison and Matt smiling after the proposal',
        objectPosition: 'center',
      },
    },
    {
      title: 'What we love together',
      body:
        'Exploring new places, cooking at home, desert sunsets, morning coffee, live music, and time with family and friends. We balance each other, laugh a lot, and are always up for our next adventure.',
    },
    {
      title: 'Looking ahead',
      body:
        'We are so excited to celebrate this next chapter with our favorite people. We cannot wait for a day filled with love, good food, and unforgettable memories in Mesa, Arizona. See you there!',
    },
  ],
  ctas: {
    detailsLabel: 'Back to wedding details',
    rsvpLabel: 'RSVP',
  },
};

const rsvpDeadline = 'February 20, 2027';

export const siteContent = {
  coupleNames: 'Matt & Alison',
  dateLabel: 'January 18, 2027',
  location: 'Mesa, Arizona',
  venueName: venue.name,
  venueAddress: venue.location,
  venueMapUrl: venue.urls.googleMaps,
  venueAppleMapsUrl: venue.urls.appleMaps,
  venueMapEmbedUrl: venue.urls.openStreetMapEmbed,
  ceremonyTime: '4:30 PM',
  receptionTime: '10:00 PM',
  rsvpDeadline,
  dressCode:
    'Garden formal. Ceremony and cocktail hour are planned outdoors, so choose shoes that work on lawn and desert paths.',
  announcement:
    'We are getting married in Mesa, Arizona, and would love to celebrate with you. Invitations include a private RSVP link for each household.',
  schedule: [
    { time: '4:00 PM', detail: 'Guest arrival at Superstition Manor' },
    { time: '4:30 PM', detail: 'Ceremony at the North Garden' },
    { time: '5:00 PM', detail: 'Cocktail hour on the terrace' },
    { time: '6:00 PM', detail: 'Dinner and reception' },
    { time: '9:00 PM', detail: 'Send-off' },
  ],
  travel: [
    'Phoenix Sky Harbor International Airport is the closest major airport.',
    'Rideshare is the easiest option between Mesa hotels and the venue.',
    'Guests will receive RSVP links by mailed invitation.',
  ],
  hotels,
  contact,
  registry,
  ourStory,
  weddingEvent,
  photos: [
    {
      src: '/ring.jpg',
      alt: "A close up of Alison's engagement ring",
      caption: 'Engagement ring',
      detail: "Alison's beautiful engagement ring.",
      objectPosition: 'center',
    },
    {
      src: '/smile.jpg',
      alt: 'Alison & Matt, shortly after the proposal',
      caption: 'Alison & Matt after the proposal',
      detail: 'Alison & Matt, shortly after the proposal.',
      objectPosition: 'center',
    },
  ] satisfies GalleryPhoto[],
  faqs: [
    {
      question: 'When should I RSVP?',
      answer: `Please RSVP by ${rsvpDeadline} using the private link on your mailed invitation.`,
    },
    {
      question: 'Can I bring a guest?',
      answer:
        'Your invitation link will show the guests included with your household.',
    },
    {
      question: 'What should I wear?',
      answer:
        'Garden formal attire is encouraged. Bring a light layer for the evening.',
    },
    {
      question: 'Where should I find updates?',
      answer: 'This site will stay current as wedding details are finalized.',
    },
    {
      question: 'Who should I contact with questions?',
      answer:
        'Have a question about the wedding weekend or your RSVP? Email us at',
      link: {
        label: contact.email,
        href: contact.href,
      },
    },
  ],
};

type RuntimeEnv = Record<string, string | undefined>;

function resolveRuntimeValue(...names: string[]): string | undefined {
  const runtimeEnv =
    (globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } })
      .process?.env;

  for (const name of names) {
    const value = runtimeEnv?.[name]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}
