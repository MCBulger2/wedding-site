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
  objectFit?: 'cover' | 'contain';
}

type StoryImage = Pick<GalleryPhoto, 'src' | 'alt'> &
  Partial<
    Pick<GalleryPhoto, 'caption' | 'detail' | 'objectPosition' | 'objectFit'>
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
    | 'buck-and-rider'
    | 'bei-sushi'
    | 'desert-botanical-garden'
    | 'papago-park'
    | 'mcdowell-sonoran-preserve'
    | 'piestewa-peak'
    | 'odysea-aquarium';
  title: string;
  description: string;
  actionLabel: 'Open map' | 'Find nearby';
  backgroundImage?: string;
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

interface OurStoryContent {
  title: string;
  intro: string;
  heroImage: StoryImage;
  chapters: StoryChapter[];
  phoenixGuide: PhoenixGuideContent;
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

const hotels: HotelBlock[] = [];

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

const contactEmail =
  resolveRuntimeValue('CONTACT_EMAIL_ADDRESS', 'VITE_CONTACT_EMAIL_ADDRESS') ??
  'contact@matt-alison.com';

const contact = {
  email: contactEmail,
  href: `mailto:${contactEmail}`,
};

const ourStory: OurStoryContent = {
  title: 'Our Story',
  intro:
    "From meeting in a programming class at ASU to making a home together in Phoenix, we've shared plenty of adventures along the way. Here's a little about the story that brought us here.",
  heroImage: {
    src: '/close-up.jpg',
    alt: 'Alison and Matt smiling at each other beneath leafy branches',
  },
  chapters: [
    {
      id: 'asu',
      title: 'It started at ASU',
      paragraphs: [
        'We met in 2019 during freshman year at Arizona State University—luckily for both of us, we ended up in the same programming class.',
        "We got to know each other through several more classes and stayed in touch even after the COVID-19 pandemic sent Matt away from the dorms. Once he returned, it wasn't long before we were dating, and the rest is history.",
        "We both graduated from ASU in 2023: Alison with an MS in Actuarial Science and Matt with a BS in Computer Science. Since then, we've made our home together in the Phoenix and Scottsdale area.",
      ],
      images: [
        {
          src: '/asu-graduation.jpg',
          alt: 'Alison and Matt wearing their ASU graduation regalia together on campus',
          caption: 'ASU graduation day',
          detail: 'Celebrating our degrees together on campus.',
        },
        {
          src: '/asu-spin.JPEG',
          alt: 'Alison and Matt dancing together outside an ASU building',
          caption: 'A spin around ASU',
          detail: 'Dancing through an afternoon on campus.',
          objectFit: 'contain',
        },
        {
          src: '/asu.JPEG',
          alt: 'Alison and Matt standing together outside an ASU building',
          caption: 'Back at ASU',
          detail: 'One of our favorite spots on campus.',
          objectFit: 'contain',
        },
        {
          src: '/asu-hockey.JPEG',
          alt: 'Alison and Matt at an Arizona State hockey game',
          caption: 'ASU hockey night',
          detail: 'Cheering on the Sun Devils.',
        },
      ],
    },
    {
      id: 'life-together',
      title: 'Life together',
      paragraphs: [
        "We spend many race weekends watching Formula 1 (and cheering for Max Verstappen!). Attending the 2025 Canadian Grand Prix was an experience we'll never forget.",
        'We also love cooking together, building LEGO sets, and working on puzzles. In fact, our dining room table is much better known as the designated puzzle table.',
      ],
      images: [
        {
          src: '/canadian-grand-prix.jpg',
          alt: 'Alison and Matt together beside a Formula 1 show car at the 2025 Canadian Grand Prix',
          caption: 'At the Canadian Grand Prix',
          detail: 'A favorite weekend from the 2025 race season.',
        },
        {
          src: '/drs.JPEG',
          alt: 'Matt holding a DRS sign at a Formula 1 race',
          caption: 'DRS',
          detail: 'Matt found one of the best signs at the track.',
          objectFit: 'contain',
        },
        {
          src: '/canada-ferris-wheel.JPEG',
          alt: 'Alison and Matt smiling beside a Ferris wheel in Montreal',
          caption: 'Montreal by the water',
          detail: 'Taking in the view by the Old Port.',
        },
        {
          src: '/canada-alison-flowers.JPEG',
          alt: 'Alison standing beside bright flowers in Montreal',
          caption: 'A little color',
          detail: 'Alison stopping to smell the flowers.',
          objectFit: 'contain',
        },
        {
          src: '/san-diego.JPEG',
          alt: 'Alison and Matt smiling together beside the ocean in San Diego',
          caption: 'By the Pacific',
          detail: 'A windy day by the San Diego coast.',
        },
        {
          src: '/vegas-bellagio.JPEG',
          alt: 'Alison and Matt standing beside the Bellagio fountains in Las Vegas',
          caption: 'A weekend in Las Vegas',
          detail: 'Taking in the Bellagio fountains.',
          objectFit: 'contain',
        },
        {
          src: '/niagara-falls.JPEG',
          alt: 'Alison and Matt smiling in front of Niagara Falls',
          caption: 'Niagara Falls',
          detail: 'A memorable stop at the falls.',
        },
      ],
    },
    {
      id: 'proposal',
      title: 'The proposal',
      paragraphs: [
        'During Easter weekend 2026, we traveled to Denver. We spent a lovely day sightseeing, including buying some LEGO, of course. Later, at City Park, Matt asked Alison to marry him.',
        "Matt's parents, Jane and Tom, and his brothers, Tim and Joe, were there to share the moment with us. Tim graciously captured it all in the proposal photos you see here.",
      ],
      images: [
        {
          src: '/hero-wedding.jpg',
          alt: 'Matt proposing to Alison at City Park in Denver',
        },
        {
          src: '/smile.jpg',
          alt: 'Alison and Matt smiling together after the proposal',
        },
      ],
    },
    {
      id: 'always-side-by-side',
      title: 'Always side by side',
      paragraphs: [
        "We're excited to take this big next step in our lives and celebrate it with the people we love. Whatever comes next, we know we'll always be by each other's side.",
      ],
      images: [
        {
          src: '/engagement-08.jpg',
          alt: 'Matt kissing Alison on the cheek as they laugh together outdoors',
        },
      ],
    },
  ],
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
              "We can never resist a LEGO Store, and the Phoenix area has three. If you're feeling ambitious, see how many you can visit while you're here. Make sure to get your LEGO passport stamped!",
            actionLabel: 'Open map',
            backgroundImage: '/lego.jpg',
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
              'One of our favorite Arizona restaurant chains—particularly the Big Rig Pasta and Pizookie!',
            actionLabel: 'Find nearby',
            backgroundImage: '/oreganos.jpg',
            destinations: [
              mapDestination("Oregano's", "Oregano's Phoenix Arizona"),
            ],
          },
          {
            id: 'buck-and-rider',
            title: 'Buck & Rider',
            description:
              'In the mood for oysters or seafood? This is the place to go.',
            actionLabel: 'Find nearby',
            backgroundImage: '/buck-and-rider.jpg',
            destinations: [
              mapDestination('Buck & Rider', 'Buck & Rider Phoenix Arizona'),
            ],
          },
          {
            id: 'bei-sushi',
            title: 'Bei Sushi',
            description: 'One of our favorite sushi spots in the Phoenix area.',
            actionLabel: 'Find nearby',
            backgroundImage: '/sushi.jpg',
            destinations: [
              mapDestination('Bei Sushi', 'Bei Sushi Phoenix Arizona'),
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
            backgroundImage: '/botanical-gardens.jpeg',
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
            backgroundImage: '/papago-park.jpg',
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
            backgroundImage: '/mcdowell-sonoran-preserve.jpg',
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
            backgroundImage: '/piestwa-peak.png',
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
            backgroundImage: '/odysea.jpg',
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
  },
  ctas: {
    detailsLabel: 'Back to wedding details',
    rsvpLabel: 'RSVP',
  },
};

const rsvpDeadline = 'December 4, 2026';

export const siteContent = {
  coupleNames: 'Matt & Alison',
  dateLabel: 'January 17, 2027',
  location: 'Mesa, Arizona',
  venueName: venue.name,
  venueAddress: venue.location,
  venueMapUrl: venue.urls.googleMaps,
  venueAppleMapsUrl: venue.urls.appleMaps,
  venueMapEmbedUrl: venue.urls.openStreetMapEmbed,
  ceremonyTime: '4:30 PM',
  receptionTime: '10:30 PM',
  rsvpDeadline,
  dressCode:
    'Semi-formal attire. Ceremony and cocktail hour are planned outdoors, while the reception will be indoors. Bring a light layer for the evening.',
  announcement:
    'We are getting married in Mesa, Arizona, and would love to celebrate with you. Invitations include a private RSVP link for each household.',
  schedule: [
    { time: '4:00 PM', detail: 'Guest arrival at Superstition Manor' },
    { time: '4:30 PM', detail: 'Ceremony at the North Garden' },
    { time: '5:00 PM', detail: 'Cocktail hour on the terrace' },
    { time: '6:00 PM', detail: 'Dinner and reception' },
    { time: '10:30 PM', detail: 'Send-off' },
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
      src: '/engagement-01.jpg',
      alt: 'Alison and Matt sitting together outdoors among trees and rocks',
      caption: 'Together outdoors',
      detail: 'A quiet moment together in the garden.',
      objectPosition: 'center',
    },
    {
      src: '/ring.jpg',
      alt: "A close up of Alison's engagement ring",
      caption: 'Engagement ring',
      detail: "Alison's beautiful engagement ring.",
      objectPosition: '50% 80%',
    },
    {
      src: '/engagement-02.jpg',
      alt: 'Alison and Matt smiling together outdoors',
      caption: 'A garden smile',
      detail: 'Alison and Matt enjoying their engagement photos.',
      objectPosition: '50% 70%',
    },
    {
      src: '/engagement-03.jpg',
      alt: 'Alison standing behind Matt with her hand resting on his shoulder',
      caption: 'Side by side',
      detail: 'A favorite portrait from the day.',
      objectPosition: 'center',
    },
    {
      src: '/engagement-05.jpg',
      alt: 'Alison and Matt smiling closely together outdoors',
      caption: 'Close together',
      detail: 'A close-up portrait with a little room to breathe.',
      objectPosition: 'center',
    },
    {
      src: '/engagement-06.jpg',
      alt: 'Alison and Matt kissing outdoors in a garden',
      caption: 'A garden kiss',
      detail: 'One of our favorite engagement moments.',
      objectPosition: 'center',
    },
    {
      src: '/engagement-07.jpg',
      alt: 'Alison and Matt leaning close together outdoors',
      caption: 'Leaning in',
      detail: 'A quiet moment before the next frame.',
      objectPosition: 'center',
    },
    {
      src: '/engagement-08.jpg',
      alt: 'Matt kissing Alison’s cheek as they laugh outdoors',
      caption: 'A happy laugh',
      detail: 'The kind of moment that feels like us.',
      objectPosition: '50% 40%',
    },
    {
      src: '/engagement-09.jpg',
      alt: 'Alison and Matt reading a save-the-date newspaper together on a bench',
      caption: 'Save the date',
      detail: 'Sharing the news of our January 2027 celebration.',
      objectPosition: 'center',
    },
    {
      src: '/engagement-10.jpg',
      alt: 'Alison and Matt standing together beneath leafy branches',
      caption: 'Under the trees',
      detail: 'A warm portrait beneath the willow branches.',
      objectPosition: 'center',
    },
    {
      src: '/engagement-11.jpg',
      alt: 'Alison and Matt smiling face to face outdoors',
      caption: 'Face to face',
      detail: 'A little joy in every direction.',
      objectPosition: '50% 40%',
    },
    {
      src: '/smile.jpg',
      alt: 'Alison & Matt, shortly after the proposal',
      caption: 'Alison & Matt after the proposal',
      detail: 'Alison & Matt, shortly after the proposal.',
      objectPosition: '50% 50%',
      objectFit: 'contain',
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
        'Semi-formal attire is encouraged. Ceremony and cocktail hour are planned outdoors, while the reception will be indoors. Bring a light layer for the evening.',
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
  const runtimeEnv = (
    globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } }
  ).process?.env;

  for (const name of names) {
    const value = runtimeEnv?.[name]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}
