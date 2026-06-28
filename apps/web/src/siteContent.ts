import { siteContent as sharedSiteContent } from '@matt-alison-wedding/shared';

const contactEmail =
  import.meta.env.VITE_CONTACT_EMAIL_ADDRESS?.trim() ??
  sharedSiteContent.contact.email;
const contact = {
  email: contactEmail,
  href: `mailto:${contactEmail}`,
};

export const siteContent: typeof sharedSiteContent = {
  ...sharedSiteContent,
  contact,
  faqs: sharedSiteContent.faqs.map((faq) =>
    faq.link?.href === sharedSiteContent.contact.href
      ? {
          ...faq,
          link: {
            label: contact.email,
            href: contact.href,
          },
        }
      : faq,
  ),
};
