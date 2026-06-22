import type { CalendarEvent, HotelBlock } from '@matt-alison-wedding/shared';

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

const weddingEvent: CalendarEvent = {
  title: 'Matt and Alison Wedding',
  start: '2027-03-20T22:00:00.000Z',
  end: '2027-03-21T04:00:00.000Z',
  timezone: 'America/Phoenix',
  location: 'Desert Garden Venue, 1234 Celebration Way, Scottsdale, AZ 85251',
  description: 'Ceremony, dinner, and reception for Matt and Alison.',
};

const hotels: HotelBlock[] = [
  {
    name: 'Sonoran Courtyard Hotel',
    address: '7420 E Camelback Rd, Scottsdale, AZ 85251',
    bookingUrl: 'https://example.com/hotel-block',
    phoneNumber: '480-555-0127',
    groupCode: 'MATTALISON2027',
    cutoffDate: 'February 20, 2027',
    nightlyRateNotes: 'Wedding block rate available while rooms last.',
    transportationNotes: 'Ten minutes from the venue by rideshare.',
    publiclyShareable: true,
  },
];

const registry: RegistryContent = {
  title: 'Wedding registry',
  intro:
    'Your presence is the best gift. For guests who have asked, registry details will be shared here once they are finalized.',
  note:
    'We are keeping everything simple and will link directly to our selected registries from this page.',
  comingSoonTitle: 'Registry details coming soon',
  comingSoonMessage:
    'Check back closer to the celebration for registry links and any gift notes from Matt and Alison.',
  links: [],
};

export const siteContent = {
  coupleNames: 'Matt & Alison',
  dateLabel: 'March 20, 2027',
  location: 'Scottsdale, Arizona',
  venueName: 'Desert Garden Venue',
  venueAddress: '1234 Celebration Way, Scottsdale, AZ 85251',
  venueMapUrl: 'https://www.google.com/maps/search/?api=1&query=1234%20Celebration%20Way%20Scottsdale%20AZ%2085251',
  ceremonyTime: '3:00 PM',
  receptionTime: '5:00 PM',
  dressCode: 'Garden formal. Ceremony and cocktail hour are planned outdoors, so choose shoes that work on lawn and desert paths.',
  announcement:
    'We are getting married in Scottsdale and would love to celebrate with you. Invitations include a private RSVP link for each household.',
  schedule: [
    { time: '2:30 PM', detail: 'Guest arrival at Desert Garden Venue' },
    { time: '3:00 PM', detail: 'Ceremony in the garden courtyard' },
    { time: '3:45 PM', detail: 'Cocktail hour on the terrace' },
    { time: '5:00 PM', detail: 'Dinner and reception' },
    { time: '9:30 PM', detail: 'Send-off' },
  ],
  travel: [
    'Phoenix Sky Harbor International Airport is the closest major airport.',
    'Rideshare is the easiest option between Scottsdale hotels and the venue.',
    'Guests will receive RSVP links by mailed invitation.',
  ],
  hotels,
  registry,
  weddingEvent,
  photos: [
    {
      src: '/hero-wedding.png',
      alt: 'Matt and Alison together outdoors',
      caption: 'Scottsdale, Arizona',
    },
  ],
  faqs: [
    {
      question: 'When should I RSVP?',
      answer: 'Please RSVP by February 20, 2027 using the private link on your mailed invitation.',
    },
    {
      question: 'Can I bring a guest?',
      answer: 'Your invitation link will show the guests included with your household.',
    },
    {
      question: 'What should I wear?',
      answer: 'Garden formal attire is encouraged. Bring a light layer for the evening.',
    },
    {
      question: 'Where should I find updates?',
      answer: 'This site will stay current as wedding details are finalized.',
    },
  ],
};
