import * as cdk from 'aws-cdk-lib';
import { Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps extends StackProps {
  hostedZoneDomain: string;
  frontendDomainName?: string;
  authDomainName?: string;
}

export class CertificateStack extends Stack {
  readonly frontendCertificate?: acm.ICertificate;
  readonly authCertificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneDomain,
    });

    if (props.frontendDomainName) {
      this.frontendCertificate = new acm.Certificate(this, 'CloudFrontCertificate', {
        domainName: props.frontendDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    if (props.authDomainName) {
      this.authCertificate = new acm.Certificate(this, 'AdminAuthCertificate', {
        domainName: props.authDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    new cdk.CfnOutput(this, 'CertificateRegion', { value: this.region });
  }
}
