export interface DeploymentConfig {
  appRegion: string;
  hostedZoneDomain?: string;
  frontendDomainName?: string;
  apiDomainName?: string;
  authDomainName?: string;
  allowedOrigins: string[];
  notificationSenderEmail?: string;
  notificationRecipientEmails: string[];
  contactEmailAddress?: string;
  contactForwardingRecipientEmail?: string;
  enablePasskeys: boolean;
}

export const deploymentConfigs: Record<string, DeploymentConfig> = {
  staging: {
    appRegion: 'us-west-1',
    allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    notificationRecipientEmails: [],
    enablePasskeys: true,
  },
  production: {
    appRegion: 'us-west-1',
    allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    notificationRecipientEmails: [],
    enablePasskeys: true,
  },
};
