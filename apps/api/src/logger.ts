export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogOutcome = 'success' | 'skipped' | 'failed' | 'accepted' | 'rate_limited';

export interface StructuredLogEntry {
  level: LogLevel;
  event: string;
  message?: string;
  requestId?: string;
  awsRequestId?: string;
  routeName?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  householdId?: string;
  channel?: 'email' | 'sms';
  outcome?: LogOutcome;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  isAdminRoute?: boolean;
  contactKind?: 'email' | 'phone';
  provider?: 'ses' | 'twilio';
  lifecycleStatus?: string;
  fromStatus?: string;
  toStatus?: string;
  rsvpStatus?: string;
  attendingCount?: number;
  declinedCount?: number;
  plusOneCount?: number;
  memberCount?: number;
  recordCount?: number;
  importedCount?: number;
  householdCount?: number;
  processedCount?: number;
  sentCount?: number;
  skippedCount?: number;
  failedCount?: number;
  bucketName?: string;
  objectKey?: string;
  messageId?: string;
}

const allowedKeys = new Set<keyof StructuredLogEntry>([
  'level',
  'event',
  'message',
  'requestId',
  'awsRequestId',
  'routeName',
  'method',
  'statusCode',
  'latencyMs',
  'householdId',
  'channel',
  'outcome',
  'errorName',
  'errorMessage',
  'errorStack',
  'isAdminRoute',
  'contactKind',
  'provider',
  'lifecycleStatus',
  'fromStatus',
  'toStatus',
  'rsvpStatus',
  'attendingCount',
  'declinedCount',
  'plusOneCount',
  'memberCount',
  'recordCount',
  'importedCount',
  'householdCount',
  'processedCount',
  'sentCount',
  'skippedCount',
  'failedCount',
  'bucketName',
  'objectKey',
  'messageId',
]);

export function logStructured(entry: StructuredLogEntry): void {
  const payload: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(entry) as Array<
    [keyof StructuredLogEntry, StructuredLogEntry[keyof StructuredLogEntry]]
  >) {
    if (!allowedKeys.has(key) || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      payload[key] = scrubLogString(value);
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      payload[key] = value;
      continue;
    }

    if (typeof value === 'boolean') {
      payload[key] = value;
    }
  }

  const line = JSON.stringify(payload);
  if (entry.level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function describeError(error: unknown): {
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
} {
  if (error instanceof Error) {
    return {
      errorName: error.name || 'Error',
      errorMessage: scrubLogString(error.message),
      errorStack: error.stack ? scrubLogString(error.stack) : undefined,
    };
  }

  if (typeof error === 'string') {
    return {
      errorName: 'Error',
      errorMessage: scrubLogString(error),
    };
  }

  return {};
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    statusCode?: unknown;
    status?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  const statusCode =
    candidate.statusCode ?? candidate.status ?? candidate.$metadata?.httpStatusCode;
  return typeof statusCode === 'number' && Number.isFinite(statusCode)
    ? statusCode
    : undefined;
}

function scrubLogString(value: string): string {
  return value
    .replace(
      /https?:\/\/[^\s"'<>]*\/rsvp\/[^\s"'<>]*/gi,
      '[redacted-rsvp-url]',
    )
    .replace(/\b[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10,}\b/g, '[redacted-invite-code]')
    .replace(/\b[a-f0-9]{64}\b/gi, '[redacted-hash]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[redacted-ip]')
    .replace(
      /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
      '[redacted-email]',
    )
    .replace(/\+?\d[\d(). -]{7,}\d/g, '[redacted-phone]');
}
