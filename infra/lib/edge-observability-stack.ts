import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface EdgeObservabilityStackProps extends StackProps {
  envName: string;
  distributionId: string;
  operationsAlertEmails?: string[];
}

export class EdgeObservabilityStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: EdgeObservabilityStackProps,
  ) {
    super(scope, id, props);

    const alarm = new cloudwatch.Alarm(this, 'CloudFront5xxErrorRateAlarm', {
      alarmName: `wedding-site-${props.envName}-cloudfront-5xx-error-rate`,
      alarmDescription:
        'CloudFront 5xx error rate was at least 5% for two of three five-minute periods.',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: '5xxErrorRate',
        dimensionsMap: {
          DistributionId: props.distributionId,
          Region: 'Global',
        },
        statistic: 'Average',
        label: '5xx error rate',
        period: Duration.minutes(5),
        region: 'us-east-1',
      }),
      threshold: 5,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const alarmAction = createOperationsAlarmAction(
      this,
      props.envName,
      props.operationsAlertEmails ?? [],
    );
    if (alarmAction) {
      alarm.addAlarmAction(alarmAction);
    }
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

  const topic = new sns.Topic(scope, 'EdgeOperationsAlarmTopic', {
    topicName: `wedding-site-${envName}-edge-operations-alarms`,
  });
  for (const email of recipients) {
    topic.addSubscription(new snsSubscriptions.EmailSubscription(email));
  }

  return new cloudwatchActions.SnsAction(topic);
}
