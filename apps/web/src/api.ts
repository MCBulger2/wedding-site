import type {
  AdminHouseholdRecord,
  BulkInvitationEmailResponse,
  CreateHouseholdInput,
  Household,
  InvitationDetails,
  InviteLifecycleStatus,
  RsvpRecoveryAcceptedResponse,
  RsvpRecoveryRequest,
  RsvpUpdate,
  SendInvitationEmailResponse,
  SendHouseholdNotificationInput,
  SendHouseholdNotificationResponse,
  StoredRsvp,
  UpdateHouseholdInput,
  UpdateHouseholdMemberInput,
} from '@matt-alison-wedding/shared';

export type RsvpPayload = RsvpUpdate;

export interface RsvpResponse {
  household: Household;
  rsvp?: StoredRsvp;
}

export interface AdminHouseholdsResponse {
  households: AdminHouseholdRecord[];
}

export interface CreateHouseholdResponse {
  household: Household;
}

export interface RotateInviteCodeResponse {
  inviteCode: string;
  inviteCodeHash: string;
}

export type RevealInvitationResponse = InvitationDetails;
export type EmailInvitationResponse = SendInvitationEmailResponse;
export type BulkEmailInvitationsResponse = BulkInvitationEmailResponse;

export type NotifyHouseholdResponse = SendHouseholdNotificationResponse;

export interface AdminAuthConfigResponse {
  clientId: string;
  userPoolDomain: string;
  scopes: string[];
}

export type RsvpRecoveryResponse = RsvpRecoveryAcceptedResponse;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly details: string[] = [],
  ) {
    super(`${message}${details.length ? ` ${details.join(' ')}` : ''}`.trim());
  }
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? '/api';

export async function fetchRsvp(inviteCode: string): Promise<RsvpResponse> {
  return request<RsvpResponse>(`/rsvp/${encodeURIComponent(inviteCode)}`);
}

export async function saveRsvp(inviteCode: string, payload: RsvpPayload): Promise<RsvpResponse> {
  return request<RsvpResponse>(`/rsvp/${encodeURIComponent(inviteCode)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function recoverRsvpLink(
  payload: RsvpRecoveryRequest,
): Promise<RsvpRecoveryResponse> {
  return request<RsvpRecoveryResponse>('/rsvp/recovery', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminAuthConfig(): Promise<AdminAuthConfigResponse> {
  return request<AdminAuthConfigResponse>('/admin/auth/config');
}

export async function fetchHouseholds(adminToken: string): Promise<AdminHouseholdsResponse> {
  return request<AdminHouseholdsResponse>('/admin/households', {
    headers: authHeaders(adminToken),
  });
}

export async function createHousehold(
  adminToken: string,
  payload: CreateHouseholdInput,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>('/admin/households', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify(payload),
  });
}

export async function updateHousehold(
  adminToken: string,
  householdId: string,
  payload: UpdateHouseholdInput,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>(`/admin/households/${encodeURIComponent(householdId)}`, {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify(payload),
  });
}

export async function archiveHousehold(
  adminToken: string,
  householdId: string,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>(`/admin/households/${encodeURIComponent(householdId)}`, {
    method: 'DELETE',
    headers: authHeaders(adminToken),
  });
}

export async function updateHouseholdMember(
  adminToken: string,
  householdId: string,
  memberId: string,
  payload: UpdateHouseholdMemberInput,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>(
    `/admin/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'PUT',
      headers: authHeaders(adminToken),
      body: JSON.stringify(payload),
    },
  );
}

export async function removeHouseholdMember(
  adminToken: string,
  householdId: string,
  memberId: string,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>(
    `/admin/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(adminToken),
    },
  );
}

export async function updateInviteLifecycleStatus(
  adminToken: string,
  householdId: string,
  status: InviteLifecycleStatus,
): Promise<CreateHouseholdResponse> {
  return request<CreateHouseholdResponse>(`/admin/households/${encodeURIComponent(householdId)}/invite-lifecycle`, {
    method: 'PUT',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ status }),
  });
}

export async function rotateInviteCode(
  adminToken: string,
  householdId: string,
  confirmRotation = false,
): Promise<RotateInviteCodeResponse> {
  return request<RotateInviteCodeResponse>(`/admin/households/${encodeURIComponent(householdId)}/invite-code`, {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ confirmRotation }),
  });
}

export async function revealInvitation(
  adminToken: string,
  householdId: string,
): Promise<RevealInvitationResponse> {
  return request<RevealInvitationResponse>(`/admin/households/${encodeURIComponent(householdId)}/invitation`, {
    headers: authHeaders(adminToken),
  });
}

export async function emailHouseholdInvitation(
  adminToken: string,
  householdId: string,
): Promise<EmailInvitationResponse> {
  return request<EmailInvitationResponse>(
    `/admin/households/${encodeURIComponent(householdId)}/invitation-email`,
    {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({}),
    },
  );
}

export async function emailInvitations(adminToken: string): Promise<BulkEmailInvitationsResponse> {
  return request<BulkEmailInvitationsResponse>('/admin/invitations/email', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({}),
  });
}

export async function sendHouseholdNotification(
  adminToken: string,
  householdId: string,
  payload: SendHouseholdNotificationInput,
): Promise<NotifyHouseholdResponse> {
  return request<NotifyHouseholdResponse>(
    `/admin/households/${encodeURIComponent(householdId)}/notifications`,
    {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify(payload),
    },
  );
}

export async function downloadRsvpsCsv(adminToken: string): Promise<Blob> {
  return downloadCsv('/admin/rsvps/export', adminToken);
}

export async function downloadInvitationsCsv(adminToken: string): Promise<Blob> {
  return downloadCsv('/admin/invitations/export', adminToken);
}

export async function downloadInvitationLabelsPdf(adminToken: string): Promise<Blob> {
  return downloadFile('/admin/invitations/labels', adminToken);
}

async function downloadCsv(path: string, adminToken: string): Promise<Blob> {
  return downloadFile(path, adminToken);
}

async function downloadFile(path: string, adminToken: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: authHeaders(adminToken),
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  return response.blob();
}

function authHeaders(adminToken: string): HeadersInit {
  return adminToken ? { authorization: `Bearer ${adminToken}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  });

  const body = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : undefined;

  if (!response.ok) {
    throw new ApiError(body?.message ?? 'Request failed', response.status, normalizeDetails(body?.details));
  }

  return body as T;
}

async function createApiError(response: Response): Promise<ApiError> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return new ApiError('Request failed', response.status);
  }

  const body = await response.json();
  return new ApiError(body?.message ?? 'Request failed', response.status, normalizeDetails(body?.details));
}

function normalizeDetails(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((detail): detail is string => typeof detail === 'string') : [];
}

function normalizeApiBaseUrl(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue.replace(/\/+$/, '');
}
