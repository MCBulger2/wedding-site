import * as cdk from 'aws-cdk-lib';
import { Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface CertificateStackProps extends StackProps {
  envName: string;
  hostedZoneDomain?: string;
  frontendDomainName?: string;
  authDomainName?: string;
}

export class CertificateStack extends Stack {
  readonly frontendCertificate?: acm.ICertificate;
  readonly authCertificate?: acm.ICertificate;
  readonly cloudFrontWebAclArn?: string;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    if (props.envName === 'production') {
      const publicRsvpPathStatement: wafv2.CfnWebACL.StatementProperty = {
        byteMatchStatement: {
          fieldToMatch: { uriPath: {} },
          positionalConstraint: 'STARTS_WITH',
          searchString: '/api/rsvp',
          textTransformations: [{ priority: 0, type: 'NONE' }],
        },
      };

      const cloudFrontWebAcl = new wafv2.CfnWebACL(this, 'PublicRsvpWebAcl', {
        defaultAction: { allow: {} },
        scope: 'CLOUDFRONT',
        description:
          'Protects public RSVP traffic with managed edge filtering and per-IP rate limiting.',
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'publicRsvpWebAcl',
          sampledRequestsEnabled: true,
        },
        rules: [
          {
            name: 'AmazonIpReputationForPublicRsvp',
            priority: 0,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesAmazonIpReputationList',
                scopeDownStatement: publicRsvpPathStatement,
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'amazonIpReputationPublicRsvp',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'CommonProtectionsForPublicRsvp',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
                scopeDownStatement: publicRsvpPathStatement,
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'commonProtectionsPublicRsvp',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'RateLimitPublicRsvpPerIp',
            priority: 2,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                aggregateKeyType: 'IP',
                limit: 200,
                scopeDownStatement: publicRsvpPathStatement,
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'rateLimitPublicRsvpPerIp',
              sampledRequestsEnabled: true,
            },
          },
        ],
        name: `wedding-site-${props.envName}-public-rsvp`,
      });

      this.cloudFrontWebAclArn = cloudFrontWebAcl.attrArn;

      new cdk.CfnOutput(this, 'CloudFrontWebAclArn', {
        value: cloudFrontWebAcl.attrArn,
      });
    }

    const hostedZone = props.hostedZoneDomain
      ? route53.HostedZone.fromLookup(this, 'HostedZone', {
          domainName: props.hostedZoneDomain,
        })
      : undefined;

    if (props.frontendDomainName && hostedZone) {
      this.frontendCertificate = new acm.Certificate(this, 'CloudFrontCertificate', {
        domainName: props.frontendDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    if (props.authDomainName && hostedZone) {
      this.authCertificate = new acm.Certificate(this, 'AdminAuthCertificate', {
        domainName: props.authDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    new cdk.CfnOutput(this, 'CertificateRegion', { value: this.region });
  }
}
