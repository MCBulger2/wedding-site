import type { CalendarEvent, HotelBlock } from './index.js';

interface RegistryLink {
  name: string;
  description: string;
  url: string;
  linkLabel: string;
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
      'https://www.openstreetmap.org/export/embed.html?bbox=-111.60154044628145%2C33.43481681617157%2C-111.59690022468568%2C33.44042143559003&layer=mapnik&marker=33.4374400%2C-111.5989000',
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

const hotels: HotelBlock[] = [
  {
    name: 'TBD Hotel',
    address: '123 TBD, Mesa, AZ 85251',
    bookingUrl: 'https://example.com/hotel-block',
    phoneNumber: '480-555-0127',
    groupCode: 'MATTALISON2027',
    cutoffDate: 'November 30, 2026',
    nightlyRateNotes: 'Wedding block rate available while rooms last.',
    transportationNotes: 'Ten minutes from the venue by rideshare.',
    publiclyShareable: true,
  },
];

const registry: RegistryContent = {
  title: 'Wedding Registry',
  intro:
    'Your presence is the best gift. For guests who have asked, registry details will be shared here once they are finalized.',
  note: 'We are keeping everything simple and will link directly to our selected registries from this page.',
  comingSoonTitle: 'Registry details coming soon',
  comingSoonMessage:
    'Check back closer to the celebration for registry links and any gift notes from Matt and Alison.',
  links: [
    {
      name: 'Honeymoon Fund',
      description:
        'Help us make our honeymoon unforgettable with a contribution to our travel fund.',
      url: 'https://www.example.com/honeymoon-fund',
      linkLabel: 'Contribute',
    },
    {
      name: 'Down Payment Fund',
      description:
        'Support our future home by contributing to our down payment fund.',
      url: 'https://www.example.com/down-payment-fund',
      linkLabel: 'Contribute',
    },
  ],
};

const ourStory: OurStoryContent = {
  title: 'Our Story',
  intro:
    'A few placeholder notes about who we are, how we met, and the moments that brought us here.',
  heroImage: {
    src: '/hero-wedding.png',
    alt: 'Candlelit garden reception table at sunset',
    objectPosition: 'center',
  },
  sections: [
    {
      title: 'How we met',
      body:
        'We met in the spring of 2021 through mutual friends at a small get-together in Phoenix. A long conversation about travel, tacos, and terrible pool volleyball sealed the deal. We have been adventuring together ever since.',
      image: {
        src: '/test-ceremony-aisle.png',
        alt: 'Temporary desert garden ceremony aisle placeholder',
        objectPosition: 'center',
      },
    },
    {
      title: 'The proposal',
      body:
        'On a quiet morning hike in Sedona, Matt found the perfect spot to ask the question. There were happy tears, a lot of hugging, and a celebratory coffee in town.',
      image: {
        src: '/test-cocktail-hour.png',
        alt: 'Temporary outdoor wedding cocktail hour placeholder',
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
  registry,
  ourStory,
  weddingEvent,
  photos: [
    {
      src: '/hero-wedding.png',
      alt: 'Candlelit garden reception table at sunset',
      caption: 'Mesa, Arizona',
      detail:
        'A desert-garden preview while engagement and wedding-weekend photos are gathered.',
      objectPosition: 'center',
    },
    {
      src: '/test-ceremony-aisle.png',
      alt: 'Temporary test photo of a desert garden ceremony aisle',
      caption: 'Ceremony preview',
      detail: 'Temporary test image for carousel layout and controls.',
      objectPosition: 'center',
    },
    {
      src: '/test-cocktail-hour.png',
      alt: 'Temporary test photo of outdoor wedding cocktail hour details',
      caption: 'Cocktail hour preview',
      detail: 'Temporary test image for carousel layout and controls.',
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
  ],
};
