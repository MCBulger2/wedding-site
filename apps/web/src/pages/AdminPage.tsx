import { type AdminHouseholdRecord, type CreateHouseholdInput, type Household, type InvitationDetails, type InvitationEmailResult, type SendHouseholdNotificationInput } from '@matt-alison-wedding/shared';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, CheckSquare, Download, Edit3, ExternalLink, Heart, Image, KeyRound, Mail, MessageSquare, MoreHorizontal, Phone, Plus, Save, Send, ShieldCheck, Trash2, Users } from 'lucide-react';
import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import { beginAdminLogin, beginAdminLogout, clearAdminSession, completeAdminLogin, getAdminProfileName, loadAdminSession, type AdminAuthConfig, type AdminSession } from '../adminAuth.js';
import { archiveHousehold, createHousehold, downloadInvitationLabelsPdf, downloadInvitationsCsv, downloadRsvpsCsv, emailHouseholdInvitation, emailInvitations, fetchAdminAuthConfig, fetchHouseholds, removeHouseholdMember, revealInvitation, rotateInviteCode, sendHouseholdNotification, updateHousehold, updateHouseholdMember, updateInviteLifecycleStatus } from '../api.js';
import { cx, scoped } from '../classNames.js';
import { createLocalAdminMockSession, localAdminMockAuthConfig, localAdminMockEnabled } from '../localAdminMock.js';
import styles from './AdminPage.module.css';

interface HouseholdFormState {
  displayName: string;
  email: string;
  phone: string;
  maxPlusOnes: string;
  mailingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  members: Array<{
    id?: string;
    firstName: string;
    lastName: string;
    canBringPlusOne: boolean;
    weddingPartyRole: string;
    rehearsalDinnerInvited: boolean;
  }>;
}

type AdminInvitationDetails = InvitationDetails & { displayName: string };

interface HouseholdCardActionsProps {
  household: Household;
  initialMenuOpen?: boolean;
  canNotify: boolean;
  canEmailInvitation: boolean;
  onNotify: () => void;
  onEmailInvitation: () => void;
  onEdit: () => void;
  onRotateInviteCode: () => void;
  onManageInvitation: () => void;
  onArchive: () => void;
  onMarkSent?: () => void;
  onMarkExported?: () => void;
}

export function HouseholdCardActions({
  household,
  initialMenuOpen = false,
  canNotify,
  canEmailInvitation,
  onNotify,
  onEmailInvitation,
  onEdit,
  onRotateInviteCode,
  onManageInvitation,
  onArchive,
  onMarkSent,
  onMarkExported,
}: HouseholdCardActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(initialMenuOpen);

  useEffect(() => {
    setIsMenuOpen(initialMenuOpen);
  }, [initialMenuOpen]);

  return (
    <DropdownMenu.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="secondary-button button-inline"
          aria-label="Actions"
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={scoped(styles, 'household-action-menu')}
          align="end"
          collisionPadding={12}
          sideOffset={6}
        >
          <DropdownMenu.Item
            className={scoped(styles, 'household-action-menu-item')}
            onClick={onEdit}
          >
            <Edit3 aria-hidden="true" />
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={scoped(styles, 'household-action-menu-item')}
            disabled={!canNotify}
            onClick={onNotify}
          >
            <MessageSquare aria-hidden="true" />
            Notify
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={scoped(styles, 'household-action-menu-item')}
            disabled={!canEmailInvitation}
            onClick={onEmailInvitation}
          >
            <Mail aria-hidden="true" />
            {household.inviteSentAt
              ? 'Resend invitation email'
              : 'Email invitation'}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={scoped(styles, 'household-action-menu-item')}
            onClick={onManageInvitation}
          >
            <KeyRound aria-hidden="true" />
            {household.inviteCodeHash
              ? 'View invitation'
              : 'Generate invitation'}
          </DropdownMenu.Item>
          {household.inviteCodeHash && (
            <DropdownMenu.Item
              className={scoped(styles, 'household-action-menu-item')}
              onClick={onRotateInviteCode}
            >
              <KeyRound aria-hidden="true" />
              Rotate code
            </DropdownMenu.Item>
          )}
          {onMarkSent && (
            <DropdownMenu.Item
              className={scoped(styles, 'household-action-menu-item')}
              onClick={onMarkSent}
            >
              <CheckSquare aria-hidden="true" />
              Mark as sent
            </DropdownMenu.Item>
          )}
          {onMarkExported && (
            <DropdownMenu.Item
              className={scoped(styles, 'household-action-menu-item')}
              onClick={onMarkExported}
            >
              <CheckSquare aria-hidden="true" />
              Mark as exported
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            className={scoped(styles, 'household-action-menu-item')}
            disabled={Boolean(household.archivedAt)}
            onClick={onArchive}
          >
            <Archive aria-hidden="true" />
            Archive
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface HouseholdNotificationFormState {
  channel: 'email' | 'sms';
  subject: string;
  message: string;
}

type BulkAdminAction = 'email_invitations' | 'export_invitations' | 'export_labels';

export function AdminPage() {
  const [authConfig, setAuthConfig] = useState<AdminAuthConfig | undefined>();
  const [session, setSession] = useState<AdminSession | undefined>();
  const [authStatus, setAuthStatus] = useState<
    'loading' | 'signed_out' | 'signing_in' | 'ready' | 'error'
  >('loading');
  const [householdLoadStatus, setHouseholdLoadStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [households, setHouseholds] = useState<AdminHouseholdRecord[]>([]);
  const [message, setMessage] = useState('Loading admin authentication...');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | Household['rsvpStatus']
  >('all');
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<HouseholdFormState>(emptyHouseholdForm());
  const [invitationDetails, setInvitationDetails] = useState<
    Record<string, AdminInvitationDetails>
  >({});
  const [expandedInvitationHouseholdId, setExpandedInvitationHouseholdId] = useState<
    string | undefined
  >();
  const [editingHouseholdId, setEditingHouseholdId] = useState<
    string | undefined
  >();
  const [editForm, setEditForm] =
    useState<HouseholdFormState>(emptyHouseholdForm());
  const [showCreateHouseholdModal, setShowCreateHouseholdModal] =
    useState(false);
  const [notificationHousehold, setNotificationHousehold] = useState<
    Household | undefined
  >();
  const [notificationForm, setNotificationForm] =
    useState<HouseholdNotificationFormState>({
      channel: 'email',
      subject: '',
      message: '',
    });
  const [sendingNotification, setSendingNotification] = useState(false);
  const [qrModalInvite, setQrModalInvite] = useState<
    AdminInvitationDetails | undefined
  >();
  const [bulkEmailResults, setBulkEmailResults] = useState<
    InvitationEmailResult[] | undefined
  >();
  const [bulkActionToConfirm, setBulkActionToConfirm] = useState<
    BulkAdminAction | undefined
  >();
  const [pendingBulkAction, setPendingBulkAction] = useState<
    BulkAdminAction | undefined
  >();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [qrCodeStatus, setQrCodeStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const pendingBulkActionRef = useRef<BulkAdminAction | undefined>();
  const qrCodeRequestId = useRef(0);

  const load = async (
    token = session?.accessToken,
  ): Promise<AdminHouseholdRecord[] | undefined> => {
    if (!token) {
      setAuthStatus('signed_out');
      setHouseholdLoadStatus('idle');
      setMessage('Sign in to view and manage RSVP data.');
      return undefined;
    }

    setHouseholdLoadStatus('loading');
    try {
      const response = await fetchHouseholds(token);
      setHouseholds(response.households);
      setAuthStatus('ready');
      setHouseholdLoadStatus('ready');
      setMessage(`${response.households.length} households loaded.`);
      return response.households;
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : 'Unable to load households';
      if (/unauthorized|forbidden|jwt|token/i.test(nextMessage)) {
        clearAdminSession();
        setSession(undefined);
        setAuthStatus('signed_out');
        setHouseholdLoadStatus('idle');
        setMessage('Your admin session expired. Please sign in again.');
        return undefined;
      }

      setHouseholdLoadStatus('error');
      setMessage(nextMessage);
      return undefined;
    }
  };

  useEffect(() => {
    if (
      expandedInvitationHouseholdId &&
      !invitationDetails[expandedInvitationHouseholdId]
    ) {
      setExpandedInvitationHouseholdId(undefined);
    }
  }, [expandedInvitationHouseholdId, invitationDetails]);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        if (localAdminMockEnabled) {
          const mockSession = createLocalAdminMockSession();
          setAuthConfig(localAdminMockAuthConfig);
          setSession(mockSession);
          setAuthStatus('ready');
          setMessage('Loading local mock households...');
          await load(mockSession.accessToken);
          return;
        }

        const config = await fetchAdminAuthConfig();
        if (cancelled) {
          return;
        }

        setAuthConfig(config);

        const callbackSession = await completeAdminLogin(
          config,
          window.location,
        );
        const storedSession = callbackSession ?? loadAdminSession();
        if (cancelled) {
          return;
        }

        if (!storedSession) {
          setAuthStatus('signed_out');
          setMessage('Sign in to manage RSVPs.');
          return;
        }

        setSession(storedSession);
        setAuthStatus(callbackSession ? 'signing_in' : 'ready');
        setMessage(
          callbackSession ? 'Signing you in...' : 'Loading households...',
        );
        await load(storedSession.accessToken);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAuthStatus('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to initialize admin authentication.',
        );
      }
    };

    void initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const submitHousehold = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      if (!session) {
        throw new Error('Sign in before creating households.');
      }

      const createResponse = await createHousehold(
        session.accessToken,
        toCreateHouseholdInput(form),
      );
      const inviteResponse = await rotateInviteCode(
        session.accessToken,
        createResponse.household.householdId,
      );
      setInvitationDetails((current) => ({
        ...current,
        [createResponse.household.householdId]: toAdminInvitationDetails(
          createResponse.household,
          inviteResponse,
        ),
      }));
      setExpandedInvitationHouseholdId(createResponse.household.householdId);
      setForm(emptyHouseholdForm());
      setShowCreateHouseholdModal(false);
      await load();
      setMessage(
        `Created ${createResponse.household.displayName} and generated an invite code.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to create household',
      );
    } finally {
      setCreating(false);
    }
  };

  const openNotificationModal = (household: Household) => {
    setNotificationHousehold(household);
    setNotificationForm(defaultNotificationFormState(household));
  };

  const closeNotificationModal = () => {
    setNotificationHousehold(undefined);
    setNotificationForm({
      channel: 'email',
      subject: '',
      message: '',
    });
  };

  const handleRotateInviteCode = async (record: AdminHouseholdRecord) => {
    try {
      if (!session) {
        throw new Error('Sign in before rotating invite codes.');
      }
      if (record.household.inviteLifecycleStatus === 'sent') {
        setMessage('Sent invitations cannot be rotated from the dashboard.');
        return;
      }
      const confirmRotation =
        record.household.inviteLifecycleStatus === 'exported'
          ? window.confirm(
              'This household was already exported. Rotating will invalidate that printed RSVP URL. Continue?',
            )
          : false;
      if (
        record.household.inviteLifecycleStatus === 'exported' &&
        !confirmRotation
      ) {
        return;
      }

      const response = await rotateInviteCode(
        session.accessToken,
        record.household.householdId,
        confirmRotation,
      );
      setInvitationDetails((current) => ({
        ...current,
        [record.household.householdId]: toAdminInvitationDetails(
          record.household,
          response,
        ),
      }));
      setExpandedInvitationHouseholdId(record.household.householdId);
      await load();
      setMessage(
        `Generated a new invite code for ${record.household.displayName}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to rotate invite code',
      );
    }
  };

  const handleExport = async (
    kind: 'rsvps' | 'invitations' | 'labels',
  ): Promise<boolean> => {
    try {
      if (!session) {
        throw new Error('Sign in before exporting data.');
      }

      const blob =
        kind === 'rsvps'
          ? await downloadRsvpsCsv(session.accessToken)
          : kind === 'invitations'
            ? await downloadInvitationsCsv(session.accessToken)
            : await downloadInvitationLabelsPdf(session.accessToken);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        kind === 'rsvps'
          ? 'rsvps.csv'
          : kind === 'invitations'
            ? 'invitations.csv'
            : 'invitation-qr-labels-avery-5160.pdf';
      anchor.click();
      window.URL.revokeObjectURL(url);
      if (kind === 'invitations') {
        await load();
        setMessage(
          'Exported invitation mailing data. Review the CSV before printing.',
        );
      } else if (kind === 'labels') {
        await load();
        setMessage(
          'Exported invitation QR labels. Print the PDF on Avery 5160 label sheets.',
        );
      }
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to export data',
      );
      return false;
    }
  };

  const handleManageInvitation = async (record: AdminHouseholdRecord) => {
    try {
      if (!session) {
        throw new Error('Sign in before managing invitations.');
      }

      if (!record.household.inviteCodeHash) {
        await handleRotateInviteCode(record);
        return;
      }

      const invitation = await revealInvitation(
        session.accessToken,
        record.household.householdId,
      );
      setInvitationDetails((current) => ({
        ...current,
        [record.household.householdId]: {
          ...invitation,
          displayName: record.household.displayName,
        },
      }));
      setExpandedInvitationHouseholdId((current) =>
        current === record.household.householdId
          ? undefined
          : record.household.householdId,
      );
      setMessage(`Revealed invitation for ${record.household.displayName}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to reveal invitation',
      );
    }
  };

  const handleEmailInvitation = async (record: AdminHouseholdRecord) => {
    try {
      if (!session) {
        throw new Error('Sign in before emailing invitations.');
      }

      const response = await emailHouseholdInvitation(
        session.accessToken,
        record.household.householdId,
      );
      const invitation = response.invitation;
      if (invitation) {
        setInvitationDetails((current) => ({
          ...current,
          [record.household.householdId]: {
            ...invitation,
            displayName: record.household.displayName,
          },
        }));
        setExpandedInvitationHouseholdId(record.household.householdId);
      }
      await load();
      setMessage(
        `${response.result.displayName}: ${response.result.message}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to email invitation',
      );
    }
  };

  const handleEmailInvitations = async (): Promise<boolean> => {
    try {
      if (!session) {
        throw new Error('Sign in before emailing invitations.');
      }

      const response = await emailInvitations(session.accessToken);
      setBulkEmailResults(response.results);
      await load();
      const sent = response.results.filter((result) => result.status === 'sent').length;
      const skipped = response.results.filter((result) => result.status === 'skipped').length;
      const failed = response.results.filter((result) => result.status === 'failed').length;
      setMessage(`Invitation email summary: ${sent} sent, ${skipped} skipped, ${failed} failed.`);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to email invitations',
      );
      return false;
    }
  };

  const submitHouseholdNotification = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!session) {
        throw new Error('Sign in before sending guest notifications.');
      }
      if (!notificationHousehold) {
        throw new Error('Select a household before sending a notification.');
      }

      setSendingNotification(true);
      const payload: SendHouseholdNotificationInput =
        notificationForm.channel === 'email'
          ? {
              channel: 'email',
              subject: notificationForm.subject,
              message: notificationForm.message,
            }
          : {
              channel: 'sms',
              message: notificationForm.message,
            };
      const response = await sendHouseholdNotification(
        session.accessToken,
        notificationHousehold.householdId,
        payload,
      );
      closeNotificationModal();
      setMessage(
        `Sent ${response.channel.toUpperCase()} to ${notificationHousehold.displayName} at ${response.deliveredTo}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send household notification',
      );
    } finally {
      setSendingNotification(false);
    }
  };

  const beginEditHousehold = (household: Household) => {
    setEditingHouseholdId(household.householdId);
    setEditForm(toHouseholdFormState(household));
  };

  const saveHouseholdEdit = async (householdId: string) => {
    try {
      if (!session) {
        throw new Error('Sign in before editing households.');
      }
      await updateHousehold(
        session.accessToken,
        householdId,
        toUpdateHouseholdInput(editForm),
      );
      for (const member of editForm.members) {
        if (member.id) {
          await updateHouseholdMember(
            session.accessToken,
            householdId,
            member.id,
            {
              firstName: member.firstName,
              lastName: member.lastName,
              canBringPlusOne: member.canBringPlusOne,
              weddingPartyRole: member.weddingPartyRole,
              rehearsalDinnerInvited: member.rehearsalDinnerInvited,
            },
          );
        }
      }
      setEditingHouseholdId(undefined);
      await load();
      setMessage('Household changes saved.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save household changes',
      );
    }
  };

  const handleRemoveMember = async (
    record: AdminHouseholdRecord,
    memberId: string,
  ) => {
    try {
      if (!session) {
        throw new Error('Sign in before editing households.');
      }
      const hasRsvp = record.rsvp?.members.some(
        (member) => member.memberId === memberId,
      );
      if (
        hasRsvp &&
        !window.confirm(
          'This member has RSVP history. Removing will archive them instead of deleting them. Continue?',
        )
      ) {
        return;
      }
      await removeHouseholdMember(
        session.accessToken,
        record.household.householdId,
        memberId,
      );
      await load();
      setMessage('Household member removed or archived.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to remove member',
      );
    }
  };

  const handleArchiveHousehold = async (record: AdminHouseholdRecord) => {
    try {
      if (!session) {
        throw new Error('Sign in before archiving households.');
      }
      if (isHouseholdArchived(record.household)) {
        throw new Error(`${record.household.displayName} is already archived.`);
      }
      const risky = record.household.inviteCodeHash || record.rsvp;
      if (
        risky &&
        !window.confirm(
          'This household has invite or RSVP history. Archiving keeps history but removes guest RSVP access. Continue?',
        )
      ) {
        return;
      }
      await archiveHousehold(session.accessToken, record.household.householdId);
      await load();
      setMessage(`Archived ${record.household.displayName}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to archive household',
      );
    }
  };

  const markInviteStatus = async (
    record: AdminHouseholdRecord,
    status: 'exported' | 'sent',
  ) => {
    try {
      if (!session) {
        throw new Error('Sign in before updating invitation status.');
      }
      await updateInviteLifecycleStatus(
        session.accessToken,
        record.household.householdId,
        status,
      );
      await load();
      setMessage(`${record.household.displayName} marked ${status}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update invitation status',
      );
    }
  };

  const openQrCodeModal = async (invite: AdminInvitationDetails) => {
    const requestId = qrCodeRequestId.current + 1;
    qrCodeRequestId.current = requestId;
    await openQrCodeModalForInvite(
      invite,
      () => qrCodeRequestId.current === requestId,
      setQrModalInvite,
      setQrCodeDataUrl,
      setQrCodeStatus,
    );
  };

  const visibleHouseholds = households.filter((record) => {
    const matchesArchived =
      showArchived || !isHouseholdArchived(record.household);
    const matchesStatus =
      statusFilter === 'all' || record.household.rsvpStatus === statusFilter;
    const matchesSearch =
      search.trim().length === 0 ||
      [
        record.household.displayName,
        record.household.email ?? '',
        record.household.phone ?? '',
        ...record.household.members.map(formatMemberName),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    return matchesArchived && matchesStatus && matchesSearch;
  });

  const totals = visibleHouseholds.reduce(
    (summary, record) => {
      summary.households += 1;
      summary.invitedGuests += record.attendance.invitedGuests;
      summary.attendingGuests += record.attendance.attendingGuests;
      summary.pendingGuests += record.attendance.pendingGuests;
      return summary;
    },
    { households: 0, invitedGuests: 0, attendingGuests: 0, pendingGuests: 0 },
  );
  const loadedHouseholdCount = households.length;
  const householdsWithEmailCount = households.filter(
    (record) =>
      Boolean(record.household.email) && !isHouseholdArchived(record.household),
  ).length;
  const bulkActionScopeNote =
    visibleHouseholds.length === loadedHouseholdCount
      ? `This action runs against all ${formatCountLabel(loadedHouseholdCount, 'loaded household')} currently in the dashboard.`
      : `This action runs against all ${formatCountLabel(loadedHouseholdCount, 'loaded household')} currently in the dashboard, not only the ${formatCountLabel(visibleHouseholds.length, 'household')} matching the current filters.`;
  const bulkActionDetails = getBulkActionDetails(
    bulkActionScopeNote,
    loadedHouseholdCount,
    householdsWithEmailCount,
  );

  const confirmBulkAction = async () => {
    if (!bulkActionToConfirm || pendingBulkActionRef.current) {
      return;
    }

    pendingBulkActionRef.current = bulkActionToConfirm;
    setPendingBulkAction(bulkActionToConfirm);
    try {
      const succeeded =
        bulkActionToConfirm === 'email_invitations'
          ? await handleEmailInvitations()
          : bulkActionToConfirm === 'export_invitations'
            ? await handleExport('invitations')
            : await handleExport('labels');
      if (succeeded) {
        setBulkActionToConfirm(undefined);
      }
    } finally {
      pendingBulkActionRef.current = undefined;
      setPendingBulkAction(undefined);
    }
  };

  const profileName = getAdminProfileName(session);
  const isHouseholdsLoading =
    householdLoadStatus === 'loading' && households.length === 0;
  const isHouseholdsRefreshing =
    householdLoadStatus === 'loading' && households.length > 0;

  if (authStatus === 'loading' || authStatus === 'signing_in') {
    return (
      <main className={scoped(styles, 'admin-page')}>
        <LoadingScreen
          eyebrow="Admin"
          title="Preparing sign-in"
          message={message}
        />
      </main>
    );
  }

  if (
    authStatus === 'error' ||
    authStatus === 'signed_out' ||
    !authConfig ||
    !session
  ) {
    return (
      <main className={scoped(styles, 'admin-page')}>
        <section
          className={scoped(styles, 'admin-login-shell')}
          aria-labelledby="admin-login-title"
        >
          <div className={scoped(styles, 'admin-login-intro')}>
            <p className="eyebrow">Admin dashboard</p>
            <h1 id="admin-login-title">Admin sign in</h1>
            <p className="page-lede">
              Manage RSVPs, households, and invitations.
            </p>
          </div>
          <section className={scoped(styles, 'admin-login-card')} aria-label="Admin sign in">
            <div className={scoped(styles, 'admin-login-card-header')}>
              <span className={scoped(styles, 'admin-login-icon')}>
                <KeyRound aria-hidden="true" />
              </span>
              <div>
                <h2>Welcome back</h2>
                <p className="form-message">{message}</p>
              </div>
            </div>
            {authConfig ? (
              <button
                type="button"
                className={cx('icon-button', scoped(styles, 'admin-login-button'))}
                onClick={() => void beginAdminLogin(authConfig)}
              >
                <KeyRound aria-hidden="true" />
                Sign in
              </button>
            ) : (
              <button
                type="button"
                className={cx('secondary-button', scoped(styles, 'admin-login-button'))}
                disabled
              >
                <KeyRound aria-hidden="true" />
                Sign-in unavailable
              </button>
            )}
            <p className={scoped(styles, 'admin-login-note')}>
              You will return here after signing in.
            </p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className={scoped(styles, 'admin-page')}>
      <section className={scoped(styles, 'admin-toolbar')}>
        <div>
          <p className="eyebrow">Admin</p>
          <h2>RSVP dashboard</h2>
          {profileName && (
            <p className="form-message">Signed in as {profileName}</p>
          )}
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setForm(emptyHouseholdForm());
              setShowCreateHouseholdModal(true);
            }}
          >
            <Users aria-hidden="true" />
            Create household
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={pendingBulkAction === 'email_invitations'}
            onClick={() => setBulkActionToConfirm('email_invitations')}
          >
            <Mail aria-hidden="true" />
            {pendingBulkAction === 'email_invitations'
              ? 'Emailing invitations...'
              : 'Email invitations'}
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={pendingBulkAction === 'export_invitations'}
            onClick={() => setBulkActionToConfirm('export_invitations')}
          >
            <Download aria-hidden="true" />
            {pendingBulkAction === 'export_invitations'
              ? 'Exporting invitations...'
              : 'Export invitations'}
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={pendingBulkAction === 'export_labels'}
            onClick={() => setBulkActionToConfirm('export_labels')}
          >
            <Download aria-hidden="true" />
            {pendingBulkAction === 'export_labels'
              ? 'Exporting QR labels...'
              : 'Export QR labels'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleExport('rsvps')}
          >
            <Download aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => beginAdminLogout(authConfig)}
          >
            <ShieldCheck aria-hidden="true" />
            Sign out
          </button>
        </div>
      </section>

      <p className="form-message">{message}</p>

      {showCreateHouseholdModal && (
        <Modal
          title="Create household"
          onClose={() => setShowCreateHouseholdModal(false)}
        >
          <HouseholdForm
            form={form}
            setForm={setForm}
            creating={creating}
            onSubmit={submitHousehold}
            onCancel={() => setShowCreateHouseholdModal(false)}
          />
        </Modal>
      )}

      {notificationHousehold && (
        <Modal
          title={`Notify ${notificationHousehold.displayName}`}
          onClose={closeNotificationModal}
        >
          <HouseholdNotificationForm
            household={notificationHousehold}
            form={notificationForm}
            setForm={setNotificationForm}
            sending={sendingNotification}
            onSubmit={submitHouseholdNotification}
            onCancel={closeNotificationModal}
          />
        </Modal>
      )}

      {qrModalInvite && (
        <Modal
          title={`${qrModalInvite.displayName} invitation QR`}
          onClose={() => {
            qrCodeRequestId.current += 1;
            setQrModalInvite(undefined);
            setQrCodeDataUrl(undefined);
            setQrCodeStatus('idle');
          }}
        >
          <div className={scoped(styles, 'qr-modal-content')}>
            <p className="form-message">
              Guests can scan this code or use the RSVP link below.
            </p>
            {qrCodeStatus === 'loading' && (
              <div
                className={cx('inline-loading-shell', scoped(styles, 'qr-loading-shell'))}
                aria-live="polite"
              >
                <LoadingPulse
                  label="Generating QR code"
                  message="Preparing a scannable invitation link."
                  compact
                />
              </div>
            )}
            {qrCodeStatus === 'error' && (
              <p className={scoped(styles, 'warning-message')}>
                Unable to generate the QR code right now.
              </p>
            )}
            {qrCodeDataUrl && (
              <img
                className={scoped(styles, 'qr-code-image')}
                src={qrCodeDataUrl}
                alt={`QR code for ${qrModalInvite.displayName}`}
              />
            )}
            <a
              className="secondary-button button-inline"
              href={qrModalInvite.rsvpUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" />
              Open RSVP
            </a>
          </div>
        </Modal>
      )}

      {bulkEmailResults && (
        <Modal
          title="Invitation email results"
          onClose={() => setBulkEmailResults(undefined)}
        >
          <div className={scoped(styles, 'result-list')} aria-label="Invitation email results">
            {bulkEmailResults.map((result) => (
              <p
                className={cx(
                  scoped(styles, 'status-result'),
                  scoped(styles, result.status),
                )}
                key={result.householdId}
              >
                <strong>{result.displayName}</strong>
                <span>{result.message}</span>
              </p>
            ))}
          </div>
        </Modal>
      )}

      {bulkActionToConfirm && (
        <BulkActionConfirmationModal
          action={bulkActionDetails[bulkActionToConfirm]}
          pending={pendingBulkAction === bulkActionToConfirm}
          onCancel={() => setBulkActionToConfirm(undefined)}
          onConfirm={confirmBulkAction}
        />
      )}

      <section className={scoped(styles, 'admin-grid')}>
        <section className={scoped(styles, 'subsection-card')}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Results</p>
              <h2>View responses</h2>
            </div>
          </div>
          <div className={scoped(styles, 'stats-grid')}>
            {isHouseholdsLoading ? (
              <>
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
              </>
            ) : (
              <>
                <article>
                  <strong>{totals.households}</strong>
                  <span>Households</span>
                </article>
                <article>
                  <strong>{totals.invitedGuests}</strong>
                  <span>Invited spots</span>
                </article>
                <article>
                  <strong>{totals.attendingGuests}</strong>
                  <span>Attending</span>
                </article>
                <article>
                  <strong>{totals.pendingGuests}</strong>
                  <span>Pending</span>
                </article>
              </>
            )}
          </div>
          <div className={scoped(styles, 'filter-grid')}>
            <label>
              Search
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Household or guest"
              />
            </label>
            <label>
              Status
              <select
                aria-label="RSVP status filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="all">All statuses</option>
                <option value="not_started">Not started</option>
                <option value="attending">Attending</option>
                <option value="partial">Partial</option>
                <option value="declined">Declined</option>
              </select>
            </label>
            <label className={cx('checkbox-row', scoped(styles, 'filter-toggle'))}>
              <input
                aria-label="Show archived households"
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived households
            </label>
          </div>

          <div className={scoped(styles, 'results-list')} aria-label="Households">
            {isHouseholdsRefreshing && (
              <div
                className={cx('inline-loading-shell', scoped(styles, 'dashboard-refresh'))}
                aria-live="polite"
              >
                <LoadingPulse
                  label="Refreshing dashboard"
                  message="Updating household and RSVP data."
                  compact
                />
              </div>
            )}
            {isHouseholdsLoading && <AdminDashboardSkeleton />}
            {!isHouseholdsLoading && visibleHouseholds.length === 0 && (
              <p className="form-message">
                No households match the current filters.
              </p>
            )}
            {visibleHouseholds.map((record) => {
              const invitation =
                invitationDetails[record.household.householdId];
              const isInvitationExpanded =
                expandedInvitationHouseholdId === record.household.householdId;

              return (
                <article
                  className={scoped(styles, 'household-card')}
                  key={record.household.householdId}
                >
                  <div className="section-heading">
                    <div>
                      <div className={scoped(styles, 'title-row')}>
                        <h3>{record.household.displayName}</h3>
                        <span
                          className={cx(
                            scoped(styles, 'status-pill'),
                            scoped(styles, record.household.rsvpStatus),
                          )}
                        >
                          {record.household.rsvpStatus.replace('_', ' ')}
                        </span>
                        <span
                          className={cx(
                            scoped(styles, 'status-pill'),
                            scoped(
                              styles,
                              `invite-${record.household.inviteLifecycleStatus}`,
                            ),
                          )}
                        >
                          {inviteStatusLabel(record.household)}
                        </span>
                      </div>
                      <div className={scoped(styles, 'meta-row')}>
                        <span>
                          <Users aria-hidden="true" />
                          {record.household.members.length} household guests
                        </span>
                        {record.household.email && (
                          <span>
                            <Mail aria-hidden="true" />
                            <a href={`mailto:${record.household.email}`}>{record.household.email}</a>
                          </span>
                        )}
                        {record.household.phone && (
                          <span>
                            <Phone aria-hidden="true" />
                            <a href={`tel:${record.household.phone}`}>{record.household.phone}</a>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="toolbar-actions">
                      <HouseholdCardActions
                        household={record.household}
                        canNotify={
                          Boolean(record.household.email) ||
                          Boolean(record.household.phone)
                        }
                        canEmailInvitation={Boolean(record.household.email) && !isHouseholdArchived(record.household)}
                        onNotify={() => openNotificationModal(record.household)}
                        onEmailInvitation={() => void handleEmailInvitation(record)}
                        onEdit={() => beginEditHousehold(record.household)}
                        onRotateInviteCode={() =>
                          void handleRotateInviteCode(record)
                        }
                        onManageInvitation={() => void handleManageInvitation(record)}
                        onMarkSent={() => void markInviteStatus(record, 'sent')}
                        onMarkExported={() => void markInviteStatus(record, 'exported')}
                        onArchive={() => void handleArchiveHousehold(record)}
                      />
                    </div>
                  </div>
                  {invitation && isInvitationExpanded && (
                    <section
                      className={scoped(styles, 'invite-preview-card')}
                      aria-label={`${record.household.displayName} invitation details`}
                    >
                      <div>
                        <p className="eyebrow">Invitation ready</p>
                        <h4>
                          Share this code, link, or QR with the household.
                        </h4>
                        <p className={cx('form-message', scoped(styles, 'compact-message'))}>
                          Revealed for this admin session only.
                        </p>
                      </div>
                      <div className={scoped(styles, 'invite-code-box')}>
                        <div className={scoped(styles, 'invite-code-block')}>
                          <span className={scoped(styles, 'invite-detail-label')}>
                            Invite code
                          </span>
                          <strong>{invitation.inviteCode}</strong>
                        </div>
                        <div className={scoped(styles, 'invite-code-block')}>
                          <span className={scoped(styles, 'invite-detail-label')}>RSVP link</span>
                          <a
                            className={scoped(styles, 'invite-link')}
                            href={invitation.rsvpUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {invitation.rsvpUrl}
                          </a>
                        </div>
                      </div>
                      <div className="toolbar-actions">
                        <button
                          type="button"
                          className="secondary-button button-inline"
                          onClick={() => void navigator.clipboard.writeText(invitation.inviteCode)}
                        >
                          <KeyRound aria-hidden="true" />
                          Copy code
                        </button>
                        <button
                          type="button"
                          className="secondary-button button-inline"
                          onClick={() => void navigator.clipboard.writeText(invitation.rsvpUrl)}
                        >
                          <ExternalLink aria-hidden="true" />
                          Copy link
                        </button>
                        <button
                          type="button"
                          className="secondary-button button-inline"
                          onClick={() => void openQrCodeModal(invitation)}
                        >
                          <Image aria-hidden="true" />
                          QR code
                        </button>
                        <button
                          type="button"
                          className="secondary-button button-inline"
                          onClick={() => void handleEmailInvitation(record)}
                          disabled={!record.household.email}
                        >
                          <Mail aria-hidden="true" />
                          {record.household.inviteSentAt ? 'Resend email' : 'Email invitation'}
                        </button>
                      </div>
                    </section>
                  )}

                  {editingHouseholdId === record.household.householdId && (
                    <section
                      className={scoped(styles, 'edit-panel')}
                      aria-label={`Edit ${record.household.displayName}`}
                    >
                      <div className={scoped(styles, 'split-fields')}>
                        <label>
                          Display name
                          <input
                            aria-label={`${record.household.displayName} edit display name`}
                            value={editForm.displayName}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                displayName: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Contact email
                          <input
                            aria-label={`${record.household.displayName} edit contact email`}
                            type="email"
                            value={editForm.email}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                email: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Mobile phone
                          <input
                            aria-label={`${record.household.displayName} edit mobile phone`}
                            type="tel"
                            value={editForm.phone}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                phone: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Max plus-ones
                        <input
                          aria-label={`${record.household.displayName} edit max plus-ones`}
                          type="number"
                          min="0"
                          max="10"
                          value={editForm.maxPlusOnes}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              maxPlusOnes: event.target.value,
                            })
                          }
                        />
                      </label>
                      <AddressFields
                        form={editForm}
                        onChange={setEditForm}
                        labelPrefix={`${record.household.displayName} edit`}
                      />
                      {editForm.members.map((member, index) => (
                        <fieldset key={member.id ?? index}>
                          <legend>
                            {member.id
                              ? formatMemberName(member)
                              : `Member ${index + 1}`}
                          </legend>
                          <div className={scoped(styles, 'split-fields')}>
                            <label>
                              First name
                              <input
                                aria-label={`${formatMemberName(member)} edit first name`}
                                value={member.firstName}
                                onChange={(event) =>
                                  setEditForm({
                                    ...editForm,
                                    members: editForm.members.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              firstName: event.target.value,
                                            }
                                          : entry,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Last name
                              <input
                                aria-label={`${formatMemberName(member)} edit last name`}
                                value={member.lastName}
                                onChange={(event) =>
                                  setEditForm({
                                    ...editForm,
                                    members: editForm.members.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              lastName: event.target.value,
                                            }
                                          : entry,
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label className="checkbox-row">
                            <input
                              aria-label={`${formatMemberName(member)} edit can bring a plus-one`}
                              type="checkbox"
                              checked={member.canBringPlusOne}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  members: editForm.members.map(
                                    (entry, entryIndex) =>
                                      entryIndex === index
                                        ? {
                                            ...entry,
                                            canBringPlusOne:
                                              event.target.checked,
                                          }
                                        : entry,
                                  ),
                                })
                              }
                            />
                            Can bring a plus-one
                          </label>
                          <label>
                            Wedding-party role
                            <input
                              aria-label={`${formatMemberName(member)} edit wedding-party role`}
                              value={member.weddingPartyRole}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  members: editForm.members.map(
                                    (entry, entryIndex) =>
                                      entryIndex === index
                                        ? {
                                            ...entry,
                                            weddingPartyRole:
                                              event.target.value,
                                          }
                                        : entry,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="checkbox-row">
                            <input
                              aria-label={`${formatMemberName(member)} edit rehearsal dinner invited`}
                              type="checkbox"
                              checked={member.rehearsalDinnerInvited}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  members: editForm.members.map(
                                    (entry, entryIndex) =>
                                      entryIndex === index
                                        ? {
                                            ...entry,
                                            rehearsalDinnerInvited:
                                              event.target.checked,
                                          }
                                        : entry,
                                  ),
                                })
                              }
                            />
                            Rehearsal dinner invited
                          </label>
                          {member.id && (
                            <button
                              type="button"
                              className="secondary-button button-inline danger-button"
                              onClick={() =>
                                void handleRemoveMember(record, member.id!)
                              }
                            >
                              <Trash2 aria-hidden="true" />
                              Remove member
                            </button>
                          )}
                        </fieldset>
                      ))}
                      <div className="toolbar-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            void saveHouseholdEdit(record.household.householdId)
                          }
                        >
                          <Save aria-hidden="true" />
                          Save changes
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingHouseholdId(undefined)}
                        >
                          Cancel
                        </button>
                      </div>
                    </section>
                  )}

                  <div className={scoped(styles, 'stats-inline')}>
                    <span><b>{record.attendance.attendingGuests}</b> attending</span>
                    <span><b>{record.attendance.pendingGuests}</b> pending</span>
                    <span><b>{record.attendance.plusOneGuests}</b> plus-ones</span>
                  </div>

                  <div className={scoped(styles, 'member-list')}>
                    {record.household.members.map((member) => {
                      const memberRsvp = record.rsvp?.members.find(
                        (entry) => entry.memberId === member.id,
                      );
                      return (
                        <div key={member.id} className={scoped(styles, 'member-row')}>
                          <strong>{formatMemberName(member)}</strong>
                          <span>
                            {memberRsvp
                              ? summarizeMemberRsvp(memberRsvp.attending)
                              : 'Awaiting RSVP'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {record.rsvp?.plusOnes.length ? (
                    <div className={scoped(styles, 'note-block')}>
                      <strong>Plus-ones</strong>
                      <ul className="plain-list compact-list">
                        {record.rsvp.plusOnes.map((plusOne, index) => (
                          <li key={`${plusOne.sponsorMemberId}-${index}`}>
                            {plusOne.firstName} {plusOne.lastName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {record.rsvp?.notes && (
                    <div className={scoped(styles, 'note-block')}>
                      <strong>Notes</strong>
                      <p>{record.rsvp.notes}</p>
                    </div>
                  )}

                  {record.rsvp?.accessibilityNotes && (
                    <div className={scoped(styles, 'note-block')}>
                      <strong>Accessibility</strong>
                      <p>{record.rsvp.accessibilityNotes}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

function AddressFields({
  form,
  onChange,
  labelPrefix,
}: {
  form: HouseholdFormState;
  onChange: (form: HouseholdFormState) => void;
  labelPrefix: string;
}) {
  return (
    <>
      <div className={scoped(styles, 'split-fields')}>
        <label>
          Address line 1
          <input
            aria-label={`${labelPrefix} address line 1`}
            value={form.mailingAddress.line1}
            onChange={(event) =>
              onChange({
                ...form,
                mailingAddress: {
                  ...form.mailingAddress,
                  line1: event.target.value,
                },
              })
            }
          />
        </label>
        <label>
          Address line 2
          <input
            aria-label={`${labelPrefix} address line 2`}
            value={form.mailingAddress.line2}
            onChange={(event) =>
              onChange({
                ...form,
                mailingAddress: {
                  ...form.mailingAddress,
                  line2: event.target.value,
                },
              })
            }
          />
        </label>
      </div>
      <div className={scoped(styles, 'split-fields')}>
        <label>
          City
          <input
            aria-label={`${labelPrefix} city`}
            value={form.mailingAddress.city}
            onChange={(event) =>
              onChange({
                ...form,
                mailingAddress: {
                  ...form.mailingAddress,
                  city: event.target.value,
                },
              })
            }
          />
        </label>
        <label>
          State
          <input
            aria-label={`${labelPrefix} state`}
            value={form.mailingAddress.state}
            onChange={(event) =>
              onChange({
                ...form,
                mailingAddress: {
                  ...form.mailingAddress,
                  state: event.target.value,
                },
              })
            }
          />
        </label>
      </div>
      <div className={scoped(styles, 'split-fields')}>
        <label>
          Postal code
          <input
            aria-label={`${labelPrefix} postal code`}
            value={form.mailingAddress.postalCode}
            onChange={(event) =>
              onChange({
                ...form,
                mailingAddress: {
                  ...form.mailingAddress,
                  postalCode: event.target.value,
                },
              })
            }
          />
        </label>
        <label>
          Country
          <input
            aria-label={`${labelPrefix} country`}
            value={form.mailingAddress.country}
            onChange={(event) =>
              onChange({
                ...form,
                mailingAddress: {
                  ...form.mailingAddress,
                  country: event.target.value,
                },
              })
            }
          />
        </label>
      </div>
    </>
  );
}

function emptyHouseholdForm(): HouseholdFormState {
  return {
    displayName: '',
    email: '',
    phone: '',
    maxPlusOnes: '0',
    mailingAddress: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    members: [
      {
        firstName: '',
        lastName: '',
        canBringPlusOne: false,
        weddingPartyRole: '',
        rehearsalDinnerInvited: false,
      },
    ],
  };
}

function toCreateHouseholdInput(
  form: HouseholdFormState,
): CreateHouseholdInput {
  return {
    displayName: form.displayName,
    email: form.email,
    phone: form.phone,
    maxPlusOnes: Number(form.maxPlusOnes || 0),
    mailingAddress: form.mailingAddress,
    members: form.members.map((member) => ({
      firstName: member.firstName,
      lastName: member.lastName,
      canBringPlusOne: member.canBringPlusOne,
      weddingPartyRole: member.weddingPartyRole,
      rehearsalDinnerInvited: member.rehearsalDinnerInvited,
    })),
  };
}

function toUpdateHouseholdInput(form: HouseholdFormState) {
  return {
    displayName: form.displayName,
    email: form.email,
    phone: form.phone,
    maxPlusOnes: Number(form.maxPlusOnes || 0),
    mailingAddress: form.mailingAddress,
  };
}

function toHouseholdFormState(household: Household): HouseholdFormState {
  return {
    displayName: household.displayName,
    email: household.email ?? '',
    phone: household.phone ?? '',
    maxPlusOnes: String(household.maxPlusOnes),
    mailingAddress: {
      line1: household.mailingAddress?.line1 ?? '',
      line2: household.mailingAddress?.line2 ?? '',
      city: household.mailingAddress?.city ?? '',
      state: household.mailingAddress?.state ?? '',
      postalCode: household.mailingAddress?.postalCode ?? '',
      country: household.mailingAddress?.country ?? '',
    },
    members: household.members.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      canBringPlusOne: member.canBringPlusOne,
      weddingPartyRole: member.weddingPartyRole ?? '',
      rehearsalDinnerInvited: member.rehearsalDinnerInvited ?? false,
    })),
  };
}

function defaultNotificationFormState(
  household: Household,
): HouseholdNotificationFormState {
  const channel =
    household.email || !household.phone ? 'email' : 'sms';

  return {
    channel,
    subject: `Wedding update for ${household.displayName}`,
    message: '',
  };
}

function inviteStatusLabel(household: Household): string {
  if (
    household.inviteCodeHash &&
    household.inviteLifecycleStatus === 'not_generated'
  ) {
    return 'generated';
  }
  return household.inviteLifecycleStatus.replace('_', ' ');
}

function isHouseholdArchived(household: Household): boolean {
  return (
    household.inviteLifecycleStatus === 'archived' ||
    Boolean(household.archivedAt)
  );
}

interface BulkActionDetails {
  dialogTitle: string;
  summary: string;
  countHeadline: string;
  countDetail: string;
  sideEffectDetail: string;
  confirmLabel: string;
  pendingLabel: string;
  icon: typeof Mail | typeof Download;
}

function getBulkActionDetails(
  scopeNote: string,
  loadedHouseholdCount: number,
  householdsWithEmailCount: number,
): Record<BulkAdminAction, BulkActionDetails> {
  return {
    email_invitations: {
      dialogTitle: 'Confirm invitation emails',
      summary: 'Send invitation emails across the admin dashboard.',
      countHeadline: formatCountLabel(
        householdsWithEmailCount,
        'household with a contact email',
        'households with a contact email',
      ),
      countDetail: `${scopeNote} ${formatCountLabel(householdsWithEmailCount, 'household with a contact email', 'households with a contact email')} can send or resend immediately.`,
      sideEffectDetail:
        'Invitation lifecycle status can change to sent for successful deliveries. You will get a per-household result summary after the request finishes.',
      confirmLabel: 'Email invitations',
      pendingLabel: 'Emailing invitations...',
      icon: Mail,
    },
    export_invitations: {
      dialogTitle: 'Confirm invitation export',
      summary: 'Download the mailing CSV for invitation planning and printing.',
      countHeadline: formatCountLabel(loadedHouseholdCount, 'loaded household'),
      countDetail: scopeNote,
      sideEffectDetail:
        'Completing this download marks invitation records as exported, which changes the invite lifecycle shown in the dashboard.',
      confirmLabel: 'Export invitations',
      pendingLabel: 'Exporting invitations...',
      icon: Download,
    },
    export_labels: {
      dialogTitle: 'Confirm QR label export',
      summary: 'Generate the PDF used for invitation QR mailing labels.',
      countHeadline: formatCountLabel(loadedHouseholdCount, 'loaded household'),
      countDetail: scopeNote,
      sideEffectDetail:
        'Completing this PDF export marks invitation records as exported, which changes the invite lifecycle shown in the dashboard.',
      confirmLabel: 'Export QR labels',
      pendingLabel: 'Exporting QR labels...',
      icon: Download,
    },
  };
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatMemberName(member: {
  firstName: string;
  lastName: string;
}): string {
  return `${member.firstName} ${member.lastName}`;
}

function summarizeMemberRsvp(attending: boolean): string {
  return attending ? 'Attending' : 'Declined';
}

async function openQrCodeModalForInvite(
  invite: AdminInvitationDetails,
  isCurrentRequest: () => boolean,
  setInvite: (invite: AdminInvitationDetails | undefined) => void,
  setQrCodeDataUrl: (value: string | undefined) => void,
  setQrCodeStatus: (value: 'idle' | 'loading' | 'ready' | 'error') => void,
) {
  setInvite(invite);
  setQrCodeStatus('loading');
  setQrCodeDataUrl(undefined);

  try {
    const { default: QRCode } = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(invite.rsvpUrl, {
      margin: 1,
      width: 256,
    });
    if (!isCurrentRequest()) {
      return;
    }

    setQrCodeDataUrl(dataUrl);
    setQrCodeStatus('ready');
  } catch {
    if (!isCurrentRequest()) {
      return;
    }

    setQrCodeStatus('error');
  }
}

function Modal({
  title,
  children,
  onClose,
  closeDisabled = false,
  showCloseButton = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => !open && !closeDisabled && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={scoped(styles, 'modal-backdrop')}>
          <Dialog.Content
            className={scoped(styles, 'modal-card')}
            onEscapeKeyDown={(event) => {
              if (closeDisabled) {
                event.preventDefault();
              }
            }}
            onPointerDownOutside={(event) => {
              if (closeDisabled) {
                event.preventDefault();
              }
            }}
          >
            <div className="section-heading">
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              {showCloseButton && (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="secondary-button button-inline"
                    disabled={closeDisabled}
                  >
                    Close
                  </button>
                </Dialog.Close>
              )}
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BulkActionConfirmationModal({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action: BulkActionDetails;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const Icon = action.icon;

  return (
    <Modal
      title={action.dialogTitle}
      onClose={onCancel}
      closeDisabled={pending}
      showCloseButton={false}
    >
      <div className="modal-form">
        <p className="form-message">{action.summary}</p>
        <div className={scoped(styles, 'result-list')}>
          <div className={scoped(styles, 'note-block')}>
            <strong>{action.countHeadline}</strong>
            <p>{action.countDetail}</p>
          </div>
          <div className={scoped(styles, 'note-block')}>
            <strong>Before you continue</strong>
            <p>{action.sideEffectDetail}</p>
          </div>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void onConfirm()}
            disabled={pending}
          >
            <Icon aria-hidden="true" />
            {pending ? action.pendingLabel : action.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function HouseholdForm({
  form,
  setForm,
  creating,
  onSubmit,
  onCancel,
}: {
  form: HouseholdFormState;
  setForm: (form: HouseholdFormState) => void;
  creating: boolean;
  onSubmit: (event: FormEvent) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <p className="form-message">
        Add the household, mailing details, and each invited guest.
      </p>
      <label>
        Household display name
        <input
          aria-label="Household display name"
          value={form.displayName}
          onChange={(event) =>
            setForm({ ...form, displayName: event.target.value })
          }
        />
      </label>
      <label>
        Contact email
        <input
          aria-label="Contact email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </label>
      <label>
        Mobile phone
        <input
          aria-label="Mobile phone"
          type="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
      </label>
      <p className={cx('form-message', scoped(styles, 'compact-message'))}>
        Use a US 10-digit number or E.164 format such as +14805550100 for SMS.
      </p>
      <label>
        Max plus-ones
        <input
          aria-label="Max plus-ones"
          type="number"
          min="0"
          max="10"
          value={form.maxPlusOnes}
          onChange={(event) =>
            setForm({ ...form, maxPlusOnes: event.target.value })
          }
        />
      </label>
      <AddressFields
        form={form}
        onChange={setForm}
        labelPrefix="create household"
      />
      <div className="section-heading">
        <div>
          <h3>Members</h3>
          <p className="form-message">
            Add every invited guest in the household.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button button-inline"
          onClick={() =>
            setForm({
              ...form,
              members: [
                ...form.members,
                {
                  firstName: '',
                  lastName: '',
                  canBringPlusOne: false,
                  weddingPartyRole: '',
                  rehearsalDinnerInvited: false,
                },
              ],
            })
          }
        >
          <Plus aria-hidden="true" />
          Add member
        </button>
      </div>
      {form.members.map((member, index) => (
        <fieldset key={index}>
          <legend>Member {index + 1}</legend>
          <div className={scoped(styles, 'split-fields')}>
            <label>
              First name
              <input
                aria-label={`Member ${index + 1} first name`}
                value={member.firstName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    members: form.members.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, firstName: event.target.value }
                        : entry,
                    ),
                  })
                }
              />
            </label>
            <label>
              Last name
              <input
                aria-label={`Member ${index + 1} last name`}
                value={member.lastName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    members: form.members.map((entry, entryIndex) =>
                      entryIndex === index
                        ? { ...entry, lastName: event.target.value }
                        : entry,
                    ),
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              aria-label={`Member ${index + 1} can bring a plus-one`}
              type="checkbox"
              checked={member.canBringPlusOne}
              onChange={(event) =>
                setForm({
                  ...form,
                  members: form.members.map((entry, entryIndex) =>
                    entryIndex === index
                      ? { ...entry, canBringPlusOne: event.target.checked }
                      : entry,
                  ),
                })
              }
            />
            Can bring a plus-one
          </label>
          <label>
            Wedding-party role
            <input
              aria-label={`Member ${index + 1} wedding-party role`}
              value={member.weddingPartyRole}
              onChange={(event) =>
                setForm({
                  ...form,
                  members: form.members.map((entry, entryIndex) =>
                    entryIndex === index
                      ? { ...entry, weddingPartyRole: event.target.value }
                      : entry,
                  ),
                })
              }
            />
          </label>
          <label className="checkbox-row">
            <input
              aria-label={`Member ${index + 1} rehearsal dinner invited`}
              type="checkbox"
              checked={member.rehearsalDinnerInvited}
              onChange={(event) =>
                setForm({
                  ...form,
                  members: form.members.map((entry, entryIndex) =>
                    entryIndex === index
                      ? {
                          ...entry,
                          rehearsalDinnerInvited: event.target.checked,
                        }
                      : entry,
                  ),
                })
              }
            />
            Rehearsal dinner invited
          </label>
          {form.members.length > 1 && (
            <button
              type="button"
              className="secondary-button button-inline danger-button"
              onClick={() =>
                setForm({
                  ...form,
                  members: form.members.filter(
                    (_, entryIndex) => entryIndex !== index,
                  ),
                })
              }
            >
              <Trash2 aria-hidden="true" />
              Remove member
            </button>
          )}
        </fieldset>
      ))}
      <div className="toolbar-actions">
        <button type="submit" disabled={creating}>
          <Users aria-hidden="true" />
          {creating ? 'Creating...' : 'Create household'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function HouseholdNotificationForm({
  household,
  form,
  setForm,
  sending,
  onSubmit,
  onCancel,
}: {
  household: Household;
  form: HouseholdNotificationFormState;
  setForm: Dispatch<SetStateAction<HouseholdNotificationFormState>>;
  sending: boolean;
  onSubmit: (event: FormEvent) => Promise<void>;
  onCancel: () => void;
}) {
  const canEmail = Boolean(household.email);
  const canSms = Boolean(household.phone);

  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <p className="form-message">
        Send a direct update to this household by email or SMS.
      </p>
      <div className="confirmation-row">
        <div>
          <strong>{household.displayName}</strong>
          <p className="form-message">
            {form.channel === 'email'
              ? household.email ?? 'No contact email on file.'
              : household.phone ?? 'No mobile number on file.'}
          </p>
        </div>
      </div>
      <label>
        Delivery channel
        <select
          aria-label="Delivery channel"
          value={form.channel}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              channel: event.target.value as 'email' | 'sms',
            }))
          }
        >
          {canEmail && <option value="email">Email</option>}
          {canSms && <option value="sms">SMS</option>}
        </select>
      </label>
      {form.channel === 'email' && (
        <label>
          Subject
          <input
            aria-label="Notification subject"
            value={form.subject}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subject: event.target.value,
              }))
            }
          />
        </label>
      )}
      <label>
        Message
        <textarea
          aria-label="Notification message"
          rows={form.channel === 'email' ? 8 : 5}
          value={form.message}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              message: event.target.value,
            }))
          }
        />
      </label>
      {form.channel === 'sms' && (
        <p className={cx('form-message', scoped(styles, 'compact-message'))}>
          SMS uses Amazon SNS and should stay concise.
        </p>
      )}
      <div className="toolbar-actions">
        <button type="submit" disabled={sending}>
          <Send aria-hidden="true" />
          {sending ? 'Sending...' : 'Send update'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LoadingScreen({
  eyebrow,
  title,
  message,
}: {
  eyebrow: string;
  title: string;
  message: string;
}) {
  return (
    <section className="lookup-card loading-card">
      <p className="eyebrow">{eyebrow}</p>
      <LoadingPulse label={title} message={message} />
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </section>
  );
}

function SkeletonStat() {
  return (
    <article className="skeleton-stat" aria-hidden="true">
      <span className="skeleton-line number" />
      <span className="skeleton-line short" />
    </article>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="admin-skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <article className={cx(scoped(styles, 'household-card'), 'skeleton-household-card')} key={item}>
          <div className="section-heading">
            <div className="skeleton-stack">
              <span className="skeleton-line title" />
              <span className="skeleton-line wide" />
            </div>
            <div className="toolbar-actions skeleton-actions">
              <span className="skeleton-button" />
              <span className="skeleton-button" />
            </div>
          </div>
          <div className={scoped(styles, 'stats-inline')}>
            <span className="skeleton-line short" />
            <span className="skeleton-line short" />
            <span className="skeleton-line short" />
          </div>
          <div className={scoped(styles, 'member-list')}>
            <span className="skeleton-row" />
            <span className="skeleton-row" />
          </div>
        </article>
      ))}
    </div>
  );
}

function LoadingPulse({
  label,
  message,
  compact = false,
}: {
  label: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div className={cx('loading-pulse', compact && 'compact')}>
      <div className="loading-mark" aria-hidden="true">
        <Heart />
      </div>
      <div>
        <h1>{label}</h1>
        <p className="page-lede">{message}</p>
      </div>
    </div>
  );
}

function buildGuestRsvpPath(inviteCode: string): string {
  return `/rsvp/${encodeURIComponent(inviteCode)}`;
}

function buildGuestRsvpUrl(inviteCode: string): string {
  return `${window.location.origin}${buildGuestRsvpPath(inviteCode)}`;
}

function toAdminInvitationDetails(
  household: Household,
  response: { inviteCode: string; inviteCodeHash: string },
): AdminInvitationDetails {
  return {
    householdId: household.householdId,
    displayName: household.displayName,
    inviteCode: response.inviteCode,
    inviteCodeHash: response.inviteCodeHash,
    rsvpUrl: buildGuestRsvpUrl(response.inviteCode),
  };
}
