export interface DeploymentConfig {
  appRegion: string;
  hostedZoneDomain?: string;
  frontendDomainName?: string;
  apiDomainName?: string;
  authDomainName?: string;
  allowedOrigins: string[];
  notificationSenderEmail?: string;
  notificationRecipientEmails: string[];
  enablePasskeys: boolean;
}

export const deploymentConfigs: Record<string, DeploymentConfig> = {
  staging: {
    appRegion: 'us-west-1',
    hostedZoneDomain: 'staging.example.com',
    frontendDomainName: 'staging.example.com',
    apiDomainName: 'api.staging.example.com',
    authDomainName: 'login.staging.example.com',
    allowedOrigins: ['https://staging.example.com'],
    notificationSenderEmail: 'staging-rsvp@example.com',
    notificationRecipientEmails: ['admin@example.com'],
    enablePasskeys: true,
  },
  production: {
    appRegion: 'us-west-1',
    hostedZoneDomain: 'example.com',
    frontendDomainName: 'www.example.com',
    apiDomainName: 'api.example.com',
    authDomainName: 'login.example.com',
    allowedOrigins: ['https://www.example.com'],
    notificationSenderEmail: 'rsvp@example.com',
    notificationRecipientEmails: ['admin@example.com'],
    enablePasskeys: true,
  },
};
