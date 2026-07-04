export interface DeploymentConfig {
  appRegion: string;
  hostedZoneDomain?: string;
  frontendDomainName?: string;
  apiDomainName?: string;
  authDomainName?: string;
  enableLocalBrowserTrust: boolean;
  allowedOrigins: string[];
  notificationSenderEmail?: string;
  notificationRecipientEmails: string[];
  twilioAccountSid?: string;
  twilioApiKeySid?: string;
  twilioApiKeySecretArn?: string;
  twilioMessagingServiceSid?: string;
  twilioFromPhoneNumber?: string;
  contactEmailAddress?: string;
  contactForwardingRecipientEmail?: string;
  operationsAlertEmails: string[];
  enablePasskeys: boolean;
}

export const deploymentConfigs: Record<string, DeploymentConfig> = {
  staging: {
    appRegion: 'us-west-1',
    enableLocalBrowserTrust: true,
    allowedOrigins: [],
    notificationRecipientEmails: [],
    operationsAlertEmails: [],
    enablePasskeys: true,
  },
  production: {
    appRegion: 'us-west-1',
    enableLocalBrowserTrust: false,
    allowedOrigins: [],
    notificationRecipientEmails: [],
    operationsAlertEmails: [],
    enablePasskeys: true,
  },
};
