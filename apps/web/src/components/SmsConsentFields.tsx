import { SMS_CONSENT_TEXT } from '@matt-alison-wedding/shared';

export const smsPhonePlaceholder = '(555) 123-4567';

export function SmsConsentCheckboxField({
  checked,
  onChange,
  error,
  inputId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  inputId: string;
}) {
  return (
    <div>
      <label className="checkbox-row" htmlFor={inputId}>
        <input
          checked={checked}
          id={inputId}
          type="checkbox"
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <SmsConsentCopy />
        </span>
      </label>
      {error && (
        <span className="field-error-message" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function SmsConsentCopy() {
  return (
    <>
      <span>
        {SMS_CONSENT_TEXT.split('View our Terms and Privacy Policy.')[0]}
        View our{' '}
      </span>
      <a href="/terms">Terms</a>
      <span> and </span>
      <a href="/privacy">Privacy Policy</a>
      <span>.</span>
    </>
  );
}

export function isLikelyPhoneRecoveryContact(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  return (
    (trimmed.startsWith('+') && /^\+[1-9]\d{7,14}$/.test(`+${digits}`)) ||
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith('1'))
  );
}
