import { z } from 'zod';

z.config({ jitless: true });

export const InviteCodeSchema = z
  .string()
  .trim()
  .min(10)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invite code contains unsupported characters');

export const MealChoiceSchema = z.enum([
  'buffet',
  'chicken',
  'fish',
  'vegetarian',
  'child',
  'none',
]);
export type MealChoice = z.infer<typeof MealChoiceSchema>;

export const InviteLifecycleStatusSchema = z.enum([
  'not_generated',
  'generated',
  'exported',
  'sent',
  'archived',
]);
export type InviteLifecycleStatus = z.infer<typeof InviteLifecycleStatusSchema>;

export const PhoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must use E.164 format');
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;

export const HouseholdPhoneInputSchema = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^[0-9+(). -]+$/, 'Phone number contains unsupported characters');
export type HouseholdPhoneInput = z.infer<typeof HouseholdPhoneInputSchema>;

export const PublicSmsSubscriptionRequestSchema = z.object({
  phone: HouseholdPhoneInputSchema,
  consentAccepted: z.literal(true, {
    error: 'Confirm SMS consent to enable text updates.',
  }),
});
export type PublicSmsSubscriptionRequest = z.infer<
  typeof PublicSmsSubscriptionRequestSchema
>;

export const PublicSmsSubscriptionResponseSchema = z.object({
  status: z.enum(['pending_confirmation', 'opted_in']),
});
export type PublicSmsSubscriptionResponse = z.infer<
  typeof PublicSmsSubscriptionResponseSchema
>;

export const RecoveryContactInputSchema = z.string().trim().min(3).max(320);
export type RecoveryContactInput = z.infer<typeof RecoveryContactInputSchema>;

export const SMS_CONSENT_TEXT_VERSION = 'twilio-tollfree-v1' as const;
export const SMS_HELP_STOP_NOTICE = 'Reply HELP for help or STOP to opt out.';
export const SMS_BRAND_PREFIX = 'Matt & Alison Wedding:';
export const SMS_PREFERENCE_CONFIRMATION =
  'Matt & Alison Wedding: You’re enrolled for RSVP recovery, schedule, and wedding logistics texts. Fewer than 10 msgs/month. Msg & data rates may apply. Help: contact@matt-alison.com. Reply HELP for help or STOP to opt out.';
export const SMS_CONSENT_TEXT =
  'I agree to receive SMS messages from Matt & Alison Wedding about RSVP recovery, schedule updates, and wedding logistics. Message frequency varies, typically fewer than 10 messages per month. Message and data rates may apply. Reply HELP for help or STOP to opt out. SMS consent is optional and is not shared with third parties. View our Terms and Privacy Policy.';

export const SmsConsentSourceSchema = z.enum([
  'rsvp_form',
  'recovery_form',
  'sms_preferences',
  'public_sms_opt_in',
]);
export type SmsConsentSource = z.infer<typeof SmsConsentSourceSchema>;

export const SmsConsentTextVersionSchema = z.literal(
  SMS_CONSENT_TEXT_VERSION,
);
export type SmsConsentTextVersion = z.infer<
  typeof SmsConsentTextVersionSchema
>;

export const SmsConsentSchema = z.object({
  status: z.enum(['pending_confirmation', 'opted_in', 'opted_out']),
  phone: PhoneNumberSchema,
  source: SmsConsentSourceSchema,
  consentedAt: z.string().datetime(),
  consentTextVersion: SmsConsentTextVersionSchema,
});
export type SmsConsent = z.infer<typeof SmsConsentSchema>;

export const MailingAddressSchema = z.object({
  line1: z.string().trim().max(160).optional().default(''),
  line2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  postalCode: z.string().trim().max(32).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
});
export type MailingAddress = z.infer<typeof MailingAddressSchema>;

export const HouseholdMemberSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  canBringPlusOne: z.boolean().default(false),
  weddingPartyRole: z.string().trim().max(80).optional(),
  rehearsalDinnerInvited: z.boolean().optional(),
  archivedAt: z.string().datetime().optional(),
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;

export const HouseholdSchema = z.object({
  householdId: z.string().min(1),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().email().optional(),
  phone: PhoneNumberSchema.optional(),
  smsConsent: SmsConsentSchema.optional(),
  mailingAddress: MailingAddressSchema.optional(),
  members: z.array(HouseholdMemberSchema).min(1),
  maxPlusOnes: z.number().int().min(0).max(10).default(0),
  rsvpStatus: z
    .enum(['not_started', 'attending', 'declined', 'partial'])
    .default('not_started'),
  inviteLifecycleStatus: InviteLifecycleStatusSchema.default('not_generated'),
  inviteCodeHash: z.string().optional(),
  inviteCodeGeneratedAt: z.string().datetime().optional(),
  inviteExportedAt: z.string().datetime().optional(),
  inviteSentAt: z.string().datetime().optional(),
  inviteCodeLastRotatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const MemberRsvpSchema = z.object({
  memberId: z.string().min(1),
  attending: z.boolean(),
  mealChoice: MealChoiceSchema,
  dietaryNotes: z.string().trim().max(500).optional().default(''),
});
export type MemberRsvp = z.infer<typeof MemberRsvpSchema>;

export const PlusOneRsvpSchema = z.object({
  sponsorMemberId: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  mealChoice: MealChoiceSchema,
  dietaryNotes: z.string().trim().max(500).optional().default(''),
});
export type PlusOneRsvp = z.infer<typeof PlusOneRsvpSchema>;

const RsvpUpdateBaseSchema = z.object({
  members: z.array(MemberRsvpSchema).min(1),
  plusOnes: z.array(PlusOneRsvpSchema).default([]),
  notes: z.string().trim().max(1000).optional().default(''),
  accessibilityNotes: z.string().trim().max(1000).optional().default(''),
});

function validateMealChoices(
  rsvp: z.infer<typeof RsvpUpdateBaseSchema>,
  ctx: z.RefinementCtx,
) {
  for (const [index, member] of rsvp.members.entries()) {
    if (member.attending && member.mealChoice === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Attending guests must have an active meal status',
        path: ['members', index, 'mealChoice'],
      });
    }
    if (!member.attending && member.mealChoice !== 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Declined guests should use the none meal choice',
        path: ['members', index, 'mealChoice'],
      });
    }
  }

  for (const [index, plusOne] of rsvp.plusOnes.entries()) {
    if (plusOne.mealChoice === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plus-ones must have an active meal status',
        path: ['plusOnes', index, 'mealChoice'],
      });
    }
  }
}

export const RsvpUpdateSchema =
  RsvpUpdateBaseSchema.superRefine((value, ctx) => {
    validateMealChoices(value, ctx);
  });
export type RsvpUpdate = z.infer<typeof RsvpUpdateSchema>;

export const StoredRsvpSchema = RsvpUpdateBaseSchema.extend({
  submittedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  validateMealChoices(value, ctx);
});
export type StoredRsvp = z.infer<typeof StoredRsvpSchema>;

export const HouseholdImportRowSchema = z.object({
  householdId: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: HouseholdPhoneInputSchema.optional().or(z.literal('')),
  addressLine1: z.string().trim().max(160).optional().default(''),
  addressLine2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  postalCode: z.string().trim().max(32).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  canBringPlusOne: z.coerce.boolean().default(false),
  weddingPartyRole: z.string().trim().max(80).optional().default(''),
  rehearsalDinnerInvited: z.coerce.boolean().default(false),
  maxPlusOnes: z.coerce.number().int().min(0).max(10).default(0),
});
export type HouseholdImportRow = z.infer<typeof HouseholdImportRowSchema>;

export const HouseholdImportSchema = z.object({
  rows: z.array(HouseholdImportRowSchema).min(1),
});
export type HouseholdImport = z.infer<typeof HouseholdImportSchema>;

export const HotelBlockSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(240),
  bookingUrl: z.string().url().optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  groupCode: z.string().trim().max(80).optional(),
  cutoffDate: z.string().trim().max(80).optional(),
  nightlyRateNotes: z.string().trim().max(240).optional(),
  transportationNotes: z.string().trim().max(240).optional(),
  publiclyShareable: z.boolean().default(true),
});
export type HotelBlock = z.infer<typeof HotelBlockSchema>;

export const CalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  start: z.string().datetime(),
  end: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80),
  location: z.string().trim().min(1).max(240),
  description: z.string().trim().max(500),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CreateHouseholdMemberSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  canBringPlusOne: z.boolean().default(false),
  weddingPartyRole: z.string().trim().max(80).optional().default(''),
  rehearsalDinnerInvited: z.boolean().default(false),
});
export type CreateHouseholdMember = z.infer<typeof CreateHouseholdMemberSchema>;

export const CreateHouseholdInputSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: HouseholdPhoneInputSchema.optional().or(z.literal('')),
  mailingAddress: MailingAddressSchema.optional(),
  members: z.array(CreateHouseholdMemberSchema).min(1).max(12),
  maxPlusOnes: z.number().int().min(0).max(10).default(0),
});
export type CreateHouseholdInput = z.infer<typeof CreateHouseholdInputSchema>;

export const UpdateHouseholdInputSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: HouseholdPhoneInputSchema.optional().or(z.literal('')),
  mailingAddress: MailingAddressSchema.optional(),
  maxPlusOnes: z.number().int().min(0).max(10),
});
export type UpdateHouseholdInput = z.infer<typeof UpdateHouseholdInputSchema>;

export const UpdateHouseholdMemberInputSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  canBringPlusOne: z.boolean(),
  weddingPartyRole: z.string().trim().max(80).optional().default(''),
  rehearsalDinnerInvited: z.boolean().default(false),
});
export type UpdateHouseholdMemberInput = z.infer<
  typeof UpdateHouseholdMemberInputSchema
>;

export const InviteLifecycleUpdateSchema = z.object({
  status: InviteLifecycleStatusSchema,
});
export type InviteLifecycleUpdate = z.infer<typeof InviteLifecycleUpdateSchema>;

export const AdminAttendanceSchema = z.object({
  invitedGuests: z.number().int().min(0),
  attendingGuests: z.number().int().min(0),
  declinedGuests: z.number().int().min(0),
  pendingGuests: z.number().int().min(0),
  plusOneGuests: z.number().int().min(0),
});
export type AdminAttendance = z.infer<typeof AdminAttendanceSchema>;

export const AdminHouseholdRecordSchema = z.object({
  household: HouseholdSchema,
  rsvp: StoredRsvpSchema.optional(),
  attendance: AdminAttendanceSchema,
  hasRecoverableInviteCode: z.boolean().default(false),
});
export type AdminHouseholdRecord = z.infer<typeof AdminHouseholdRecordSchema>;

export const InvitationDetailsSchema = z.object({
  householdId: z.string().min(1),
  inviteCode: InviteCodeSchema,
  inviteCodeHash: z.string().min(1),
  rsvpUrl: z.string().url(),
});
export type InvitationDetails = z.infer<typeof InvitationDetailsSchema>;

export const InvitationEmailResultStatusSchema = z.enum([
  'sent',
  'skipped',
  'failed',
]);
export type InvitationEmailResultStatus = z.infer<
  typeof InvitationEmailResultStatusSchema
>;

export const InvitationEmailResultSchema = z.object({
  householdId: z.string().min(1),
  displayName: z.string().trim().min(1),
  status: InvitationEmailResultStatusSchema,
  deliveredTo: z.string().email().optional(),
  message: z.string().trim().min(1),
});
export type InvitationEmailResult = z.infer<typeof InvitationEmailResultSchema>;

export const SendInvitationEmailResponseSchema = z.object({
  result: InvitationEmailResultSchema,
  invitation: InvitationDetailsSchema.optional(),
});
export type SendInvitationEmailResponse = z.infer<
  typeof SendInvitationEmailResponseSchema
>;

export const BulkInvitationEmailResponseSchema = z.object({
  results: z.array(InvitationEmailResultSchema),
});
export type BulkInvitationEmailResponse = z.infer<
  typeof BulkInvitationEmailResponseSchema
>;

export const EmailHouseholdNotificationInputSchema = z.object({
  channel: z.literal('email'),
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(4000),
});

export const SmsHouseholdNotificationInputSchema = z.object({
  channel: z.literal('sms'),
  message: z.string().trim().min(1).max(1400),
});

export const SendHouseholdNotificationInputSchema = z.discriminatedUnion(
  'channel',
  [EmailHouseholdNotificationInputSchema, SmsHouseholdNotificationInputSchema],
);
export type SendHouseholdNotificationInput = z.infer<
  typeof SendHouseholdNotificationInputSchema
>;

export const SendHouseholdNotificationResponseSchema = z.object({
  channel: z.enum(['email', 'sms']),
  deliveredTo: z.string().trim().min(1),
});
export type SendHouseholdNotificationResponse = z.infer<
  typeof SendHouseholdNotificationResponseSchema
>;

export const RsvpRecoveryRequestSchema = z.object({
  contact: RecoveryContactInputSchema,
});
export type RsvpRecoveryRequest = z.infer<typeof RsvpRecoveryRequestSchema>;

export const SmsPreferencesRequestSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(true), phone: HouseholdPhoneInputSchema }),
  z.object({ enabled: z.literal(false) }),
]);
export type SmsPreferencesRequest = z.infer<typeof SmsPreferencesRequestSchema>;

export const RsvpRecoveryAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
  message: z
    .string()
    .trim()
    .min(1)
    .default(
      "If that matches our guest list, we'll send your private RSVP link.",
    ),
});
export type RsvpRecoveryAcceptedResponse = z.infer<
  typeof RsvpRecoveryAcceptedResponseSchema
>;

export const GenericInviteError =
  'We could not find that RSVP. Please check your invitation link.';
export const GenericRecoverySuccessMessage =
  "If that matches our guest list, we'll send your private RSVP link.";

export function formatValidationIssues(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`,
  );
}

export function generateIcs(event: CalendarEvent): string {
  const parsed = CalendarEventSchema.parse(event);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Matt Alison Wedding//Wedding Website//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(parsed.title)}-${formatIcsDate(parsed.start)}@matt-alison-wedding`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART;TZID=${parsed.timezone}:${formatIcsLocalDate(parsed.start)}`,
    `DTEND;TZID=${parsed.timezone}:${formatIcsLocalDate(parsed.end)}`,
    `SUMMARY:${escapeIcsText(parsed.title)}`,
    `LOCATION:${escapeIcsText(parsed.location)}`,
    `DESCRIPTION:${escapeIcsText(parsed.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

function formatIcsDate(value: string): string {
  return value.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function formatIcsLocalDate(value: string): string {
  return formatIcsDate(value).replace(/Z$/, '');
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

export { siteContent } from './siteContent.js';
