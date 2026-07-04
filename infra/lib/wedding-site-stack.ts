import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sesActions from 'aws-cdk-lib/aws-ses-actions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface WeddingSiteStackProps extends StackProps {
  envName: string;
  domainName?: string;
  frontendDomainName?: string;
  apiDomainName?: string;
  authDomainName?: string;
  cloudFrontWebAclArn?: string;
  frontendCertificate?: acm.ICertificate;
  authCertificate?: acm.ICertificate;
  hostedZoneDomain?: string;
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
  enablePasskeys: boolean;
  operationsAlertEmails?: string[];
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..', '..');
const adminHostedUiCss = String.raw`
.background-customizable {
  background-color: #f9faf8;
}

.banner-customizable {
  padding: 25px 0px 18px 0px;
  background-color: #e6f0ec;
}

.logo-customizable {
  max-width: 60%;
  max-height: 30%;
  background-color: #ffffff;
}

.label-customizable {
  color: #3d464c;
  font-weight: 600;
}

.textDescription-customizable {
  padding-top: 10px;
  padding-bottom: 10px;
  display: block;
  font-size: 15px;
  color: #3d464c;
}

.inputField-customizable {
  width: 100%;
  height: 42px;
  color: #242a2f;
  background-color: #ffffff;
  border: 1px solid rgba(36, 42, 47, 0.18);
}

.inputField-customizable:focus {
  border-color: #315f53;
  outline: 0;
}

.idpDescription-customizable {
  padding-top: 10px;
  padding-bottom: 10px;
  display: block;
  font-size: 15px;
  color: #242a2f;
}

.submitButton-customizable {
  font-size: 14px;
  font-weight: bold;
  margin: 20px -15px 10px -13px;
  height: 42px;
  width: 108%;
  color: #fffffb;
  background-color: #315f53;
}

.submitButton-customizable:hover {
  color: #fffffb;
  background-color: #244940;
}

.idpButton-customizable {
  height: 42px;
  width: 100%;
  text-align: center;
  margin-bottom: 15px;
  color: #fffffb;
  background-color: #315f53;
  border-color: #315f53;
}

.idpButton-customizable:hover {
  color: #fffffb;
  background-color: #244940;
}

.socialButton-customizable {
  height: 42px;
  text-align: left;
  width: 100%;
  margin-bottom: 15px;
}

.redirect-customizable {
  text-align: center;
}

.legalText-customizable {
  color: #667077;
  font-size: 11px;
}

.errorMessage-customizable {
  padding: 5px;
  font-size: 14px;
  width: 100%;
  background: #f5f5f5;
  border: 2px solid #9b3d35;
  color: #9b3d35;
}

.passwordCheck-notValid-customizable {
  color: #9b3d35;
}

.passwordCheck-valid-customizable {
  color: #315f53;
}
`;

export class WeddingSiteStack extends Stack {
  readonly distributionId: string;

  constructor(scope: Construct, id: string, props: WeddingSiteStackProps) {
    super(scope, id, props);

    const removalPolicy =
      props.envName === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY;
    const frontendDomainName = props.frontendDomainName ?? props.domainName;

    const table = new dynamodb.Table(this, 'WeddingTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy,
    });

    const inviteCodePepper = new secretsmanager.Secret(
      this,
      'InviteCodePepper',
      {
        description: `Pepper for hashing ${props.envName} wedding RSVP invite codes`,
        generateSecretString: {
          excludePunctuation: true,
          passwordLength: 48,
        },
        removalPolicy,
      },
    );

    const inviteCodeKey = new kms.Key(this, 'InviteCodeKey', {
      alias: `alias/wedding-site-${props.envName}-invite-codes`,
      description: `KMS key for encrypted ${props.envName} wedding RSVP invite codes`,
      enableKeyRotation: true,
      removalPolicy,
    });

    const apiHandlerLogGroup = new logs.LogGroup(this, 'ApiHandlerLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });

    const apiAccessLogGroup = new logs.LogGroup(this, 'ApiAccessLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });

    const apiHandler = new lambdaNode.NodejsFunction(this, 'ApiHandler', {
      entry: path.join(repoRoot, 'apps/api/src/handler.ts'),
      environment: {
        TABLE_NAME: table.tableName,
        INVITE_CODE_PEPPER_SECRET_ARN: inviteCodePepper.secretArn,
        INVITE_CODE_KMS_KEY_ID: inviteCodeKey.keyId,
      },
      logGroup: apiHandlerLogGroup,
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: Duration.seconds(10),
    });

    table.grantReadWriteData(apiHandler);
    inviteCodePepper.grantRead(apiHandler);
    apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt'],
        resources: [inviteCodeKey.keyArn],
      }),
    );

    const userPool = new cognito.UserPool(this, 'AdminUserPool', {
      selfSignUpEnabled: false,
      featurePlan: props.enablePasskeys
        ? cognito.FeaturePlan.ESSENTIALS
        : undefined,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        otp: true,
        sms: false,
      },
      signInPolicy: props.enablePasskeys
        ? {
            allowedFirstAuthFactors: {
              password: true,
              passkey: true,
            },
          }
        : undefined,
      passkeyRelyingPartyId: props.enablePasskeys
        ? props.authDomainName
        : undefined,
      passkeyUserVerification: props.enablePasskeys
        ? cognito.PasskeyUserVerification.REQUIRED
        : undefined,
      signInAliases: {
        email: true,
      },
      passwordPolicy: {
        minLength: 14,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy,
    });
    if (props.enablePasskeys) {
      const userPoolResource = userPool.node
        .defaultChild as cognito.CfnUserPool;
      userPoolResource.webAuthnFactorConfiguration =
        'MULTI_FACTOR_WITH_USER_VERIFICATION';
    }

    const api = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: buildAllowedOrigins(
          props.allowedOrigins,
          frontendDomainName,
        ),
        maxAge: Duration.days(1),
      },
      createDefaultStage: false,
    });
    const defaultApiStageName = '$default';
    const defaultApiStage = new apigwv2.CfnStage(api, 'DefaultStage', {
      apiId: api.apiId,
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: apiAccessLogGroup.logGroupArn,
        format:
          '{"requestId":"$context.requestId","routeKey":"$context.routeKey","status":"$context.status","responseLatency":"$context.responseLatency","integrationLatency":"$context.integrationLatency","protocol":"$context.protocol","responseLength":"$context.responseLength"}',
      },
      stageName: defaultApiStageName,
    });
    // Preserve the logical ID of the previous HttpApi auto-created stage.
    defaultApiStage.overrideLogicalId('HttpApiDefaultStage3EEB07D6');
    const defaultHttpStage = apigwv2.HttpStage.fromHttpStageAttributes(
      this,
      'DefaultHttpStageMetrics',
      {
        api,
        stageName: defaultApiStageName,
      },
    );

    const apiIntegration = new integrations.HttpLambdaIntegration(
      'ApiIntegration',
      apiHandler,
    );

    api.addRoutes({
      path: '/api/rsvp/{inviteCode}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: apiIntegration,
    });

    api.addRoutes({
      path: '/api/rsvp/recovery',
      methods: [apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });

    defaultApiStage.defaultRouteSettings = {
      throttlingBurstLimit: 100,
      throttlingRateLimit: 50,
    };
    // CfnStage routeSettings values must use CloudFormation's PascalCase keys.
    defaultApiStage.addPropertyOverride('RouteSettings', {
      'GET /api/rsvp/{inviteCode}': {
        ThrottlingBurstLimit: 20,
        ThrottlingRateLimit: 10,
      },
      'PUT /api/rsvp/{inviteCode}': {
        ThrottlingBurstLimit: 10,
        ThrottlingRateLimit: 5,
      },
      'POST /api/rsvp/recovery': {
        ThrottlingBurstLimit: 5,
        ThrottlingRateLimit: 2,
      },
    });

    const siteBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: props.envName === 'production' ? false : true,
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self'; connect-src 'self' https:; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-src https://www.openstreetmap.org; frame-ancestors 'none'",
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
      },
    );

    const hostedZone =
      props.hostedZoneDomain &&
      (frontendDomainName ||
        props.apiDomainName ||
        props.authDomainName ||
        props.contactEmailAddress)
        ? route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: props.hostedZoneDomain,
          })
        : undefined;
    const domainSesIdentities = new Map<string, ses.IEmailIdentity>();
    const manageHostedZoneSesIdentities = props.envName === 'production';
    const getSesIdentity = (
      id: string,
      emailAddress: string,
    ): ses.IEmailIdentity => {
      const emailDomain = getEmailDomain(emailAddress);
      if (
        hostedZone &&
        props.hostedZoneDomain &&
        normalizeDomainName(emailDomain) ===
          normalizeDomainName(props.hostedZoneDomain)
      ) {
        const domainKey = normalizeDomainName(emailDomain);
        const existingIdentity = domainSesIdentities.get(domainKey);
        if (existingIdentity) {
          return existingIdentity;
        }

        const identity = manageHostedZoneSesIdentities
          ? new ses.EmailIdentity(this, id, {
              identity: ses.Identity.publicHostedZone(hostedZone),
            })
          : ses.EmailIdentity.fromEmailIdentityName(this, id, domainKey);
        domainSesIdentities.set(domainKey, identity);
        return identity;
      }

      return ses.EmailIdentity.fromEmailIdentityName(this, id, emailAddress);
    };

    const certificate = frontendDomainName
      ? (props.frontendCertificate ??
        new acm.Certificate(this, 'CloudFrontCertificate', {
          domainName: frontendDomainName,
          validation: hostedZone
            ? acm.CertificateValidation.fromDns(hostedZone)
            : undefined,
        }))
      : undefined;

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        responseHeadersPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(
            `${api.apiId}.execute-api.${Stack.of(this).region}.${Stack.of(this).urlSuffix}`,
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      defaultRootObject: 'index.html',
      domainNames: frontendDomainName ? [frontendDomainName] : undefined,
      certificate,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });
    if (props.cloudFrontWebAclArn) {
      distribution.attachWebAclId(props.cloudFrontWebAclArn);
    }
    this.distributionId = distribution.distributionId;
    const siteAliasRecord =
      frontendDomainName && hostedZone
        ? new route53.ARecord(this, 'SiteAliasRecord', {
            zone: hostedZone,
            recordName: frontendDomainName,
            target: route53.RecordTarget.fromAlias(
              new route53Targets.CloudFrontTarget(distribution),
            ),
          })
        : undefined;

    const deployedFrontendBaseUrl = frontendDomainName
      ? `https://${frontendDomainName}`
      : `https://${distribution.distributionDomainName}`;
    apiHandler.addEnvironment('FRONTEND_BASE_URL', deployedFrontendBaseUrl);
    apiHandler.addEnvironment(
      'ADMIN_DASHBOARD_URL',
      `${deployedFrontendBaseUrl}/admin`,
    );
    if (props.contactEmailAddress) {
      apiHandler.addEnvironment(
        'CONTACT_EMAIL_ADDRESS',
        props.contactEmailAddress,
      );
    }

    const adminRedirectUris = buildAdminRedirectUris(
      frontendDomainName,
      distribution.distributionDomainName,
    );
    const authCertificate = props.authDomainName
      ? (props.authCertificate ??
        new acm.Certificate(this, 'AdminAuthCertificate', {
          domainName: props.authDomainName,
          validation: hostedZone
            ? acm.CertificateValidation.fromDns(hostedZone)
            : undefined,
        }))
      : undefined;
    const authParentValidationRecord =
      props.authDomainName && hostedZone
        ? createCognitoParentDomainValidationRecord(
            this,
            hostedZone,
            props.authDomainName,
            [frontendDomainName, props.apiDomainName, props.authDomainName],
          )
        : undefined;
    const authParentDomainName = props.authDomainName
      ? getParentDomainName(props.authDomainName)
      : undefined;
    const authParentAliasRecord =
      authParentDomainName &&
      frontendDomainName &&
      siteAliasRecord &&
      normalizeDomainName(authParentDomainName) ===
        normalizeDomainName(frontendDomainName)
        ? siteAliasRecord
        : undefined;
    const userPoolDomain =
      props.authDomainName && authCertificate
        ? userPool.addDomain('AdminCustomDomain', {
            customDomain: {
              domainName: props.authDomainName,
              certificate: authCertificate,
            },
            managedLoginVersion: cognito.ManagedLoginVersion.CLASSIC_HOSTED_UI,
          })
        : userPool.addDomain('AdminHostedUiDomain', {
            cognitoDomain: {
              domainPrefix: buildCognitoDomainPrefix(
                this.stackName,
                props.envName,
                this.account,
              ),
            },
            managedLoginVersion: cognito.ManagedLoginVersion.CLASSIC_HOSTED_UI,
          });
    if (authParentValidationRecord) {
      userPoolDomain.node.addDependency(authParentValidationRecord);
    }
    if (authParentAliasRecord) {
      userPoolDomain.node.addDependency(authParentAliasRecord);
    }

    const userPoolClient = userPool.addClient('AdminWebClient', {
      authFlows: {
        user: props.enablePasskeys,
        userSrp: true,
      },
      generateSecret: false,
      oAuth: {
        callbackUrls: adminRedirectUris,
        logoutUrls: adminRedirectUris,
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
      preventUserExistenceErrors: true,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    const hostedUiCustomization =
      new cognito.CfnUserPoolUICustomizationAttachment(
        this,
        'AdminHostedUiBranding',
        {
          clientId: userPoolClient.userPoolClientId,
          css: adminHostedUiCss,
          userPoolId: userPool.userPoolId,
        },
      );
    hostedUiCustomization.node.addDependency(userPoolDomain);

    apiHandler.addEnvironment(
      'ADMIN_COGNITO_CLIENT_ID',
      userPoolClient.userPoolClientId,
    );
    apiHandler.addEnvironment('ADMIN_COGNITO_DOMAIN', userPoolDomain.baseUrl());
    if (
      props.notificationSenderEmail &&
      props.notificationRecipientEmails.length > 0
    ) {
      apiHandler.addEnvironment(
        'NOTIFICATION_SENDER_EMAIL',
        props.notificationSenderEmail,
      );
      apiHandler.addEnvironment(
        'RSVP_NOTIFICATION_SENDER_EMAIL',
        props.notificationSenderEmail,
      );
      apiHandler.addEnvironment(
        'RSVP_NOTIFICATION_RECIPIENT_EMAILS',
        props.notificationRecipientEmails.join(','),
      );

      const sesIdentity = getSesIdentity(
        'RsvpNotificationSesIdentity',
        props.notificationSenderEmail,
      );
      sesIdentity.grantSendEmail(apiHandler);
      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: [
            sesIdentity.emailIdentityArn,
            ...props.notificationRecipientEmails.map(
              (email) =>
                `arn:${Stack.of(this).partition}:ses:${Stack.of(this).region}:${Stack.of(this).account}:identity/${email}`,
            ),
          ],
          conditions: {
            StringEquals: {
              'ses:FromAddress': props.notificationSenderEmail,
            },
          },
        }),
      );
    }

    const twilioConfigState = getTwilioConfigState(props);
    if (twilioConfigState === 'complete') {
      apiHandler.addEnvironment('TWILIO_ACCOUNT_SID', props.twilioAccountSid!);
      apiHandler.addEnvironment('TWILIO_API_KEY_SID', props.twilioApiKeySid!);
      apiHandler.addEnvironment(
        'TWILIO_API_KEY_SECRET_ARN',
        props.twilioApiKeySecretArn!,
      );
      if (props.twilioMessagingServiceSid) {
        apiHandler.addEnvironment(
          'TWILIO_MESSAGING_SERVICE_SID',
          props.twilioMessagingServiceSid,
        );
      } else {
        apiHandler.addEnvironment(
          'TWILIO_FROM_PHONE_NUMBER',
          props.twilioFromPhoneNumber!,
        );
      }

      secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'TwilioApiKeySecret',
        props.twilioApiKeySecretArn!,
      ).grantRead(apiHandler);
    } else if (twilioConfigState === 'partial') {
      cdk.Annotations.of(this).addWarningV2(
        'TwilioSmsConfigurationIncomplete',
        'Twilio SMS requires TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET_ARN, and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_PHONE_NUMBER.',
      );
    }

    let contactForwarderLogGroup: logs.LogGroup | undefined;
    let contactForwarder: lambdaNode.NodejsFunction | undefined;

    if (
      props.contactEmailAddress &&
      props.contactForwardingRecipientEmail &&
      hostedZone &&
      props.hostedZoneDomain &&
      normalizeDomainName(getEmailDomain(props.contactEmailAddress)) ===
        normalizeDomainName(props.hostedZoneDomain)
    ) {
      const contactEmailIdentity = getSesIdentity(
        'ContactEmailSesIdentity',
        props.contactEmailAddress,
      );
      const inboundEmailPrefix = 'incoming/';
      const inboundEmailBucket = new s3.Bucket(
        this,
        'ContactInboundEmailBucket',
        {
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          encryption: s3.BucketEncryption.S3_MANAGED,
          enforceSSL: true,
          lifecycleRules: [
            {
              expiration: Duration.days(30),
              prefix: inboundEmailPrefix,
            },
          ],
          removalPolicy,
          autoDeleteObjects: props.envName === 'production' ? false : true,
        },
      );
      contactForwarderLogGroup = new logs.LogGroup(
        this,
        'ContactForwarderLogGroup',
        {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy,
        },
      );
      contactForwarder = new lambdaNode.NodejsFunction(
        this,
        'ContactForwarder',
        {
          entry: path.join(repoRoot, 'apps/api/src/contactForwarder.ts'),
          environment: {
            CONTACT_EMAIL_ADDRESS: props.contactEmailAddress,
            CONTACT_FORWARDING_RECIPIENT_EMAIL:
              props.contactForwardingRecipientEmail,
          },
          logGroup: contactForwarderLogGroup,
          runtime: lambda.Runtime.NODEJS_24_X,
          timeout: Duration.seconds(20),
        },
      );

      inboundEmailBucket.grantRead(contactForwarder, `${inboundEmailPrefix}*`);
      inboundEmailBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3Notifications.LambdaDestination(contactForwarder),
        { prefix: inboundEmailPrefix },
      );
      contactForwarder.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ses:SendEmail'],
          resources: [
            contactEmailIdentity.emailIdentityArn,
            `arn:${Stack.of(this).partition}:ses:${Stack.of(this).region}:${Stack.of(this).account}:identity/${props.contactForwardingRecipientEmail}`,
          ],
          conditions: {
            StringEquals: {
              'ses:FromAddress': props.contactEmailAddress,
            },
          },
        }),
      );

      new route53.MxRecord(this, 'ContactEmailMxRecord', {
        zone: hostedZone,
        values: [
          {
            priority: 10,
            hostName: `inbound-smtp.${Stack.of(this).region}.amazonaws.com`,
          },
        ],
      });

      const contactReceiptRuleSetName = `wedding-site-${props.envName}-contact`;
      const contactReceiptRuleSet = new ses.ReceiptRuleSet(
        this,
        'ContactReceiptRuleSet',
        {
          receiptRuleSetName: contactReceiptRuleSetName,
        },
      );
      const contactReceiptRule = contactReceiptRuleSet.addRule(
        'ContactReceiptRule',
        {
          recipients: [props.contactEmailAddress],
          scanEnabled: true,
          actions: [
            new sesActions.S3({
              bucket: inboundEmailBucket,
              objectKeyPrefix: inboundEmailPrefix,
            }),
          ],
        },
      );
      contactReceiptRule.node.addDependency(contactEmailIdentity);

      const activeReceiptRuleSet = new customResources.AwsCustomResource(
        this,
        'ActiveContactReceiptRuleSet',
        {
          onCreate: {
            service: 'SES',
            action: 'setActiveReceiptRuleSet',
            parameters: {
              RuleSetName: contactReceiptRuleSetName,
            },
            physicalResourceId: customResources.PhysicalResourceId.of(
              contactReceiptRuleSetName,
            ),
          },
          onUpdate: {
            service: 'SES',
            action: 'setActiveReceiptRuleSet',
            parameters: {
              RuleSetName: contactReceiptRuleSetName,
            },
            physicalResourceId: customResources.PhysicalResourceId.of(
              contactReceiptRuleSetName,
            ),
          },
          policy: customResources.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              actions: ['ses:SetActiveReceiptRuleSet'],
              resources: ['*'],
            }),
          ]),
          installLatestAwsSdk: false,
        },
      );
      activeReceiptRuleSet.node.addDependency(contactReceiptRule);
    } else if (
      props.contactEmailAddress ||
      props.contactForwardingRecipientEmail
    ) {
      cdk.Annotations.of(this).addWarningV2(
        'ContactEmailForwardingIncomplete',
        'Contact email forwarding requires CONTACT_EMAIL_ADDRESS, CONTACT_FORWARDING_RECIPIENT_EMAIL, and a matching HOSTED_ZONE_DOMAIN.',
      );
    }

    const adminAuthorizer = new authorizers.HttpUserPoolAuthorizer(
      'AdminAuthorizer',
      userPool,
      {
        userPoolClients: [userPoolClient],
      },
    );

    api.addRoutes({
      path: '/api/admin/auth/config',
      methods: [apigwv2.HttpMethod.GET],
      integration: apiIntegration,
    });

    for (const route of [
      { path: '/api/admin/households', method: apigwv2.HttpMethod.POST },
      { path: '/api/admin/households', method: apigwv2.HttpMethod.GET },
      { path: '/api/admin/households/import', method: apigwv2.HttpMethod.POST },
      { path: '/api/admin/households/{id}', method: apigwv2.HttpMethod.PUT },
      { path: '/api/admin/households/{id}', method: apigwv2.HttpMethod.DELETE },
      {
        path: '/api/admin/households/{id}/invite-code',
        method: apigwv2.HttpMethod.POST,
      },
      {
        path: '/api/admin/households/{id}/invitation',
        method: apigwv2.HttpMethod.GET,
      },
      {
        path: '/api/admin/households/{id}/invitation-email',
        method: apigwv2.HttpMethod.POST,
      },
      {
        path: '/api/admin/households/{id}/invite-lifecycle',
        method: apigwv2.HttpMethod.PUT,
      },
      {
        path: '/api/admin/households/{id}/notifications',
        method: apigwv2.HttpMethod.POST,
      },
      {
        path: '/api/admin/households/{id}/members/{memberId}',
        method: apigwv2.HttpMethod.PUT,
      },
      {
        path: '/api/admin/households/{id}/members/{memberId}',
        method: apigwv2.HttpMethod.DELETE,
      },
      { path: '/api/admin/rsvps/export', method: apigwv2.HttpMethod.GET },
      { path: '/api/admin/invitations/export', method: apigwv2.HttpMethod.GET },
      { path: '/api/admin/invitations/labels', method: apigwv2.HttpMethod.GET },
      { path: '/api/admin/invitations/email', method: apigwv2.HttpMethod.POST },
    ]) {
      api.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: apiIntegration,
        authorizer: adminAuthorizer,
      });
    }

    new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
      sources: [s3deploy.Source.asset(path.join(repoRoot, 'apps/web/dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    if (props.apiDomainName && hostedZone) {
      const apiCertificate = new acm.Certificate(this, 'ApiCertificate', {
        domainName: props.apiDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
      const apiCustomDomain = new apigwv2.DomainName(this, 'ApiCustomDomain', {
        domainName: props.apiDomainName,
        certificate: apiCertificate,
      });
      const apiCustomDomainMapping = new apigwv2.ApiMapping(
        this,
        'ApiCustomDomainMapping',
        {
          api,
          domainName: apiCustomDomain,
          stage: apigwv2.HttpStage.fromHttpStageAttributes(
            this,
            'DefaultHttpStage',
            {
              api,
              stageName: defaultApiStageName,
            },
          ),
        },
      );
      apiCustomDomainMapping.node.addDependency(defaultApiStage);
      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: hostedZone,
        recordName: props.apiDomainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayv2DomainProperties(
            apiCustomDomain.regionalDomainName,
            apiCustomDomain.regionalHostedZoneId,
          ),
        ),
      });
    }

    if (props.authDomainName && hostedZone) {
      new route53.ARecord(this, 'AdminAuthAliasRecord', {
        zone: hostedZone,
        recordName: props.authDomainName,
        target: route53.RecordTarget.fromAlias(
          cognitoUserPoolDomainAliasTarget(userPoolDomain),
        ),
      });
    }

    createObservability(this, {
      envName: props.envName,
      operationsAlertEmails: props.operationsAlertEmails ?? [],
      apiStage: defaultHttpStage,
      apiHandler,
      apiHandlerLogGroup,
      apiAccessLogGroup,
      table,
      distribution,
      contactForwarder,
      contactForwarderLogGroup,
      includePublicRsvpWaf:
        props.envName === 'production' && Boolean(props.cloudFrontWebAclArn),
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, 'AdminUserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'AdminUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'AdminUserPoolDomainUrl', {
      value: userPoolDomain.baseUrl(),
    });
  }
}

interface ObservabilityConfig {
  envName: string;
  operationsAlertEmails: string[];
  apiStage: apigwv2.IHttpStage;
  apiHandler: lambda.IFunction;
  apiHandlerLogGroup: logs.ILogGroup;
  apiAccessLogGroup: logs.ILogGroup;
  table: dynamodb.ITable;
  distribution: cloudfront.IDistribution;
  contactForwarder?: lambda.IFunction;
  contactForwarderLogGroup?: logs.ILogGroup;
  includePublicRsvpWaf: boolean;
}

interface OperationalAlarmProps {
  envName: string;
  nameSuffix: string;
  description: string;
  metric: cloudwatch.IMetric;
  threshold: number;
  evaluationPeriods?: number;
  datapointsToAlarm?: number;
  alarmAction?: cloudwatch.IAlarmAction;
}

const observabilityPeriod = Duration.minutes(5);
const observedDynamoDbOperations = [
  dynamodb.Operation.BATCH_GET_ITEM,
  dynamodb.Operation.BATCH_WRITE_ITEM,
  dynamodb.Operation.DELETE_ITEM,
  dynamodb.Operation.GET_ITEM,
  dynamodb.Operation.PUT_ITEM,
  dynamodb.Operation.QUERY,
  dynamodb.Operation.SCAN,
  dynamodb.Operation.UPDATE_ITEM,
];

function createObservability(
  scope: Construct,
  config: ObservabilityConfig,
): void {
  const alarmAction = createOperationsAlarmAction(
    scope,
    config.envName,
    config.operationsAlertEmails,
  );
  const alarms: cloudwatch.Alarm[] = [];
  const addAlarm = (
    id: string,
    props: Omit<OperationalAlarmProps, 'envName' | 'alarmAction'>,
  ): cloudwatch.Alarm => {
    const alarm = createOperationalAlarm(scope, id, {
      ...props,
      envName: config.envName,
      alarmAction,
    });
    alarms.push(alarm);
    return alarm;
  };

  addAlarm('ApiGateway5xxAlarm', {
    nameSuffix: 'api-gateway-5xx',
    description:
      'API Gateway returned at least one 5xx response in five minutes.',
    metric: config.apiStage.metricServerError({
      period: observabilityPeriod,
      statistic: 'Sum',
      label: '5xx errors',
    }),
    threshold: 1,
  });
  addAlarm('ApiHandlerErrorsAlarm', {
    nameSuffix: 'api-lambda-errors',
    description: 'API Lambda reported at least one error in five minutes.',
    metric: config.apiHandler.metricErrors({
      period: observabilityPeriod,
      statistic: 'Sum',
      label: 'API errors',
    }),
    threshold: 1,
  });
  addAlarm('ApiHandlerThrottlesAlarm', {
    nameSuffix: 'api-lambda-throttles',
    description: 'API Lambda was throttled at least once in five minutes.',
    metric: config.apiHandler.metricThrottles({
      period: observabilityPeriod,
      statistic: 'Sum',
      label: 'API throttles',
    }),
    threshold: 1,
  });
  addAlarm('ApiHandlerDurationAlarm', {
    nameSuffix: 'api-lambda-p95-duration',
    description:
      'API Lambda p95 duration stayed above eight seconds for three consecutive periods.',
    metric: config.apiHandler.metricDuration({
      period: observabilityPeriod,
      statistic: 'p95',
      label: 'API p95 duration',
    }),
    threshold: 8000,
    evaluationPeriods: 3,
    datapointsToAlarm: 3,
  });
  addAlarm('DynamoDbThrottledRequestsAlarm', {
    nameSuffix: 'dynamodb-throttled-requests',
    description:
      'DynamoDB reported at least one throttled request in five minutes.',
    metric: config.table.metricThrottledRequestsForOperations({
      period: observabilityPeriod,
      label: 'Throttled requests',
      operations: observedDynamoDbOperations,
    }),
    threshold: 1,
  });
  addAlarm('DynamoDbSystemErrorsAlarm', {
    nameSuffix: 'dynamodb-system-errors',
    description: 'DynamoDB reported at least one system error in five minutes.',
    metric: config.table.metricSystemErrorsForOperations({
      period: observabilityPeriod,
      label: 'System errors',
      operations: observedDynamoDbOperations,
    }),
    threshold: 1,
  });
  if (config.contactForwarder) {
    addAlarm('ContactForwarderErrorsAlarm', {
      nameSuffix: 'contact-forwarder-errors',
      description:
        'Contact forwarder Lambda reported at least one error in five minutes.',
      metric: config.contactForwarder.metricErrors({
        period: observabilityPeriod,
        statistic: 'Sum',
        label: 'Contact forwarder errors',
      }),
      threshold: 1,
    });
    addAlarm('ContactForwarderThrottlesAlarm', {
      nameSuffix: 'contact-forwarder-throttles',
      description:
        'Contact forwarder Lambda was throttled at least once in five minutes.',
      metric: config.contactForwarder.metricThrottles({
        period: observabilityPeriod,
        statistic: 'Sum',
        label: 'Contact forwarder throttles',
      }),
      threshold: 1,
    });
  }

  const dashboard = new cloudwatch.Dashboard(scope, 'OperationsDashboard', {
    dashboardName: `wedding-site-${config.envName}`,
  });

  dashboard.addWidgets(
    new cloudwatch.TextWidget({
      markdown: `# Wedding Site ${config.envName} Operations\nKey health signals for the public site, API, data store, and notifications.`,
      width: 24,
      height: 2,
    }),
    new cloudwatch.AlarmStatusWidget({
      title: 'Alarm Status',
      alarms,
      width: 24,
      height: 4,
    }),
    new cloudwatch.GraphWidget({
      title: 'API Gateway Traffic',
      left: [
        config.apiStage.metricCount({
          period: observabilityPeriod,
          label: 'Requests',
        }),
        config.apiStage.metricClientError({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: '4xx errors',
        }),
        config.apiStage.metricServerError({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: '5xx errors',
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'API Gateway Latency',
      left: [
        config.apiStage.metricLatency({
          period: observabilityPeriod,
          statistic: 'p95',
          label: 'p95 latency',
        }),
        config.apiStage.metricIntegrationLatency({
          period: observabilityPeriod,
          statistic: 'p95',
          label: 'p95 integration latency',
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'API Lambda Health',
      left: [
        config.apiHandler.metricInvocations({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: 'Invocations',
        }),
        config.apiHandler.metricErrors({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: 'Errors',
        }),
        config.apiHandler.metricThrottles({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: 'Throttles',
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'API Lambda Duration',
      left: [
        config.apiHandler.metricDuration({
          period: observabilityPeriod,
          statistic: 'Average',
          label: 'Average duration',
        }),
        config.apiHandler.metricDuration({
          period: observabilityPeriod,
          statistic: 'p95',
          label: 'p95 duration',
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'DynamoDB Capacity',
      left: [
        config.table.metricConsumedReadCapacityUnits({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: 'Consumed read units',
        }),
        config.table.metricConsumedWriteCapacityUnits({
          period: observabilityPeriod,
          statistic: 'Sum',
          label: 'Consumed write units',
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'DynamoDB Throttles',
      left: [
        config.table.metricThrottledRequestsForOperations({
          period: observabilityPeriod,
          label: 'Throttled requests',
          operations: observedDynamoDbOperations,
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'DynamoDB System Errors',
      left: [
        config.table.metricSystemErrorsForOperations({
          period: observabilityPeriod,
          label: 'System errors',
          operations: observedDynamoDbOperations,
        }),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'CloudFront Traffic',
      left: [
        cloudFrontMetric(config.distribution, 'Requests', 'Sum', 'Requests'),
      ],
      width: 12,
      height: 6,
    }),
    new cloudwatch.GraphWidget({
      title: 'CloudFront Error Rates',
      left: [
        cloudFrontMetric(
          config.distribution,
          'TotalErrorRate',
          'Average',
          'Total error rate',
        ),
        cloudFrontMetric(
          config.distribution,
          '4xxErrorRate',
          'Average',
          '4xx error rate',
        ),
        cloudFrontMetric(
          config.distribution,
          '5xxErrorRate',
          'Average',
          '5xx error rate',
        ),
      ],
      width: 12,
      height: 6,
    }),
    createRequestTimelineLogQueryWidget(
      'API Request Timeline',
      config.apiAccessLogGroup.logGroupName,
    ),
    createLogQueryWidget(
      'Recent API Application Events',
      config.apiHandlerLogGroup.logGroupName,
      [
        'fields @timestamp, event, level, message',
        'filter ispresent(event)',
        'sort @timestamp desc',
        'limit 20',
      ],
    ),
    createLogQueryWidget(
      'Public RSVP And Recovery Activity',
      config.apiHandlerLogGroup.logGroupName,
      [
        'fields @timestamp, event, level, message, householdId, contactKind, outcome',
        'filter event like /^rsvp\\./ or event like /^recovery\\./',
        'sort @timestamp desc',
        'limit 20',
      ],
    ),
    createLogQueryWidget(
      'Admin Activity',
      config.apiHandlerLogGroup.logGroupName,
      [
        'fields @timestamp, event, level, message, householdId, outcome',
        'filter event like /^admin\\./ or event like /^invitation\\./',
        'sort @timestamp desc',
        'limit 20',
      ],
    ),
    createLogQueryWidget(
      'Notification Delivery',
      config.apiHandlerLogGroup.logGroupName,
      [
        'fields @timestamp, event, level, message, householdId, channel, provider, outcome',
        'filter event like /^notification\\./ or event like /^invitation\\./ or event like /^recovery\\.delivery\\./',
        'sort @timestamp desc',
        'limit 20',
      ],
    ),
    createErrorLogQueryWidget(
      'Recent API Errors',
      config.apiHandlerLogGroup.logGroupName,
    ),
  );

  if (config.contactForwarder && config.contactForwarderLogGroup) {
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Contact Forwarder Lambda Health',
        left: [
          config.contactForwarder.metricInvocations({
            period: observabilityPeriod,
            statistic: 'Sum',
            label: 'Invocations',
          }),
          config.contactForwarder.metricErrors({
            period: observabilityPeriod,
            statistic: 'Sum',
            label: 'Errors',
          }),
          config.contactForwarder.metricThrottles({
            period: observabilityPeriod,
            statistic: 'Sum',
            label: 'Throttles',
          }),
        ],
        width: 12,
        height: 6,
      }),
      createLogQueryWidget(
        'Contact Forwarding Activity',
        config.contactForwarderLogGroup.logGroupName,
        [
          'fields @timestamp, event, level, message, bucketName, objectKey, messageId, processedCount',
          'filter event like /^contact\\./ or @message like /Forwarded contact email/',
          'sort @timestamp desc',
          'limit 20',
        ],
      ),
      createErrorLogQueryWidget(
        'Recent Contact Forwarder Errors',
        config.contactForwarderLogGroup.logGroupName,
      ),
    );
  }

  if (config.includePublicRsvpWaf) {
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'WAF Public RSVP Requests',
        left: [
          publicRsvpWafMetric('AllowedRequests', 'Allowed requests'),
          publicRsvpWafMetric('BlockedRequests', 'Blocked requests'),
        ],
        width: 24,
        height: 6,
      }),
    );
  }
}

function createOperationsAlarmAction(
  scope: Construct,
  envName: string,
  operationsAlertEmails: string[],
): cloudwatch.IAlarmAction | undefined {
  const recipients = [
    ...new Set(
      operationsAlertEmails.map((email) => email.trim()).filter(Boolean),
    ),
  ];
  if (recipients.length === 0) {
    return undefined;
  }

  const topic = new sns.Topic(scope, 'OperationsAlarmTopic', {
    topicName: `wedding-site-${envName}-operations-alarms`,
  });
  for (const email of recipients) {
    topic.addSubscription(new snsSubscriptions.EmailSubscription(email));
  }

  return new cloudwatchActions.SnsAction(topic);
}

function createOperationalAlarm(
  scope: Construct,
  id: string,
  props: OperationalAlarmProps,
): cloudwatch.Alarm {
  const alarm = new cloudwatch.Alarm(scope, id, {
    alarmName: `wedding-site-${props.envName}-${props.nameSuffix}`,
    alarmDescription: props.description,
    metric: props.metric,
    threshold: props.threshold,
    evaluationPeriods: props.evaluationPeriods ?? 1,
    datapointsToAlarm: props.datapointsToAlarm,
    comparisonOperator:
      cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  if (props.alarmAction) {
    alarm.addAlarmAction(props.alarmAction);
  }

  return alarm;
}

function cloudFrontMetric(
  distribution: cloudfront.IDistribution,
  metricName: string,
  statistic: string,
  label: string,
): cloudwatch.Metric {
  return new cloudwatch.Metric({
    namespace: 'AWS/CloudFront',
    metricName,
    dimensionsMap: {
      DistributionId: distribution.distributionId,
      Region: 'Global',
    },
    statistic,
    label,
    period: observabilityPeriod,
    region: 'us-east-1',
  });
}

function publicRsvpWafMetric(
  metricName: string,
  label: string,
): cloudwatch.Metric {
  return new cloudwatch.Metric({
    namespace: 'AWS/WAFV2',
    metricName,
    dimensionsMap: {
      WebACL: 'publicRsvpWebAcl',
      Rule: 'ALL',
      Region: 'Global',
    },
    statistic: 'Sum',
    label,
    period: observabilityPeriod,
    region: 'us-east-1',
  });
}

function createLogQueryWidget(
  title: string,
  logGroupName: string,
  queryLines: string[],
  view: cloudwatch.LogQueryVisualizationType = cloudwatch.LogQueryVisualizationType.TABLE,
): cloudwatch.LogQueryWidget {
  return new cloudwatch.LogQueryWidget({
    title,
    logGroupNames: [logGroupName],
    queryLines,
    view,
    width: 24,
    height: 6,
  });
}

function createRequestTimelineLogQueryWidget(
  title: string,
  logGroupName: string,
): cloudwatch.LogQueryWidget {
  return createLogQueryWidget(
    title,
    logGroupName,
    [
      'fields @timestamp, routeKey, status, responseLatency, integrationLatency, protocol, responseLength',
      'stats count(*) as requests, avg(responseLatency) as avgResponseLatency, avg(integrationLatency) as avgIntegrationLatency by bin(5m)',
      'sort bin(5m) desc',
    ],
    cloudwatch.LogQueryVisualizationType.LINE,
  );
}

function createErrorLogQueryWidget(
  title: string,
  logGroupName: string,
): cloudwatch.LogQueryWidget {
  return createLogQueryWidget(title, logGroupName, [
    'fields @timestamp, event, level, message, errorName, errorType, errorMessage',
    'filter level = "error" or @message like /ERROR|Error|error|Exception|exception|Task timed out|Failed|failed/',
    'sort @timestamp desc',
    'limit 20',
  ]);
}
function buildAllowedOrigins(
  configuredOrigins: string[],
  frontendDomainName: string | undefined,
): string[] {
  const origins = new Set(
    configuredOrigins.length > 0
      ? configuredOrigins
      : ['http://localhost:5173'],
  );
  if (frontendDomainName) {
    origins.add(`https://${frontendDomainName}`);
  }
  return [...origins];
}

function buildAdminRedirectUris(
  domainName: string | undefined,
  distributionDomainName: string,
): string[] {
  const uris = [
    'http://localhost:5173/admin',
    'http://127.0.0.1:5173/admin',
    `https://${distributionDomainName}/admin`,
  ];

  if (domainName) {
    uris.push(`https://${domainName}/admin`);
  }

  return uris;
}

function buildCognitoDomainPrefix(
  stackName: string,
  envName: string,
  account: string,
): string {
  return `${stackName}-${envName}-${account}-admin`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

function createCognitoParentDomainValidationRecord(
  scope: Construct,
  zone: route53.IHostedZone,
  authDomainName: string,
  reservedRecordNames: Array<string | undefined>,
): route53.ARecord | undefined {
  const parentDomainName = getParentDomainName(authDomainName);
  if (!parentDomainName || parentDomainName === zone.zoneName) {
    return undefined;
  }

  const normalizedParent = normalizeDomainName(parentDomainName);
  const reservedNames = new Set(
    reservedRecordNames
      .filter((name): name is string => Boolean(name))
      .map((name) => normalizeDomainName(name)),
  );
  if (reservedNames.has(normalizedParent)) {
    return undefined;
  }

  return new route53.ARecord(scope, 'AdminAuthParentValidationRecord', {
    zone,
    recordName: parentDomainName,
    target: route53.RecordTarget.fromIpAddresses('192.0.2.1'),
    ttl: Duration.minutes(5),
  });
}

function getParentDomainName(domainName: string): string | undefined {
  const labels = normalizeDomainName(domainName).split('.');
  if (labels.length < 3) {
    return undefined;
  }

  return labels.slice(1).join('.');
}

function getEmailDomain(emailAddress: string): string {
  const [, domain] = emailAddress.split('@');
  return domain ?? '';
}

function normalizeDomainName(domainName: string): string {
  return domainName.trim().replace(/\.+$/, '').toLowerCase();
}

function getTwilioConfigState(
  props: WeddingSiteStackProps,
): 'complete' | 'partial' | 'absent' {
  const hasRequired =
    Boolean(props.twilioAccountSid) &&
    Boolean(props.twilioApiKeySid) &&
    Boolean(props.twilioApiKeySecretArn);
  const hasSender =
    Boolean(props.twilioMessagingServiceSid) ||
    Boolean(props.twilioFromPhoneNumber);
  const hasAny = [
    props.twilioAccountSid,
    props.twilioApiKeySid,
    props.twilioApiKeySecretArn,
    props.twilioMessagingServiceSid,
    props.twilioFromPhoneNumber,
  ].some(Boolean);

  if (hasRequired && hasSender) {
    return 'complete';
  }

  return hasAny ? 'partial' : 'absent';
}

function cognitoUserPoolDomainAliasTarget(
  domain: cognito.UserPoolDomain,
): route53.IAliasRecordTarget {
  return {
    bind: () => ({
      dnsName: domain.cloudFrontEndpoint,
      hostedZoneId: route53Targets.CloudFrontTarget.CLOUDFRONT_ZONE_ID,
    }),
  };
}
