import type { CalendarEvent, HotelBlock } from '@matt-alison-wedding/shared';

interface GalleryPhoto {
  src: string;
  alt: string;
  caption: string;
  detail?: string;
  objectPosition?: string;
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
  weddingEvent,
  photos: [
    {
      src: '/hero-wedding.png',
      alt: 'Candlelit garden reception table at sunset',
      caption: 'Scottsdale, Arizona',
      detail: 'A desert-garden preview while engagement and wedding-weekend photos are gathered.',
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
