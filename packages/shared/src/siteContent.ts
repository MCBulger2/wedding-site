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
  ],
};
