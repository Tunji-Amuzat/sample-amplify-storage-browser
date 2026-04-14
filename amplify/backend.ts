import { defineBackend } from '@aws-amplify/backend';
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { auth } from './auth/resource';

const backend = defineBackend({
  auth,
});

const existingBucketStack = backend.createStack('existing-bucket-stack');

// Reference the existing S3 bucket
const existingBucket = Bucket.fromBucketAttributes(existingBucketStack, 'amplify-custom-config-storage', {
  bucketArn: 'arn:aws:s3:::amplify-custom-config-storage',
  region: 'eu-west-2',
});

// Wire the existing bucket into amplify_outputs.json
backend.addOutput({
  storage: {
    aws_region: 'eu-west-2',
    bucket_name: existingBucket.bucketName,
    buckets: [
      {
        name: 'amplify-custom-config-storage',
        bucket_name: existingBucket.bucketName,
        aws_region: 'eu-west-2',
      },
    ],
  },
});

// IAM policy granting authenticated users access to the existing bucket
const authPolicy = new Policy(backend.stack, 'customBucketAuthPolicy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`${existingBucket.bucketArn}/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [existingBucket.bucketArn, `${existingBucket.bucketArn}/*`],
      conditions: {
        StringLike: {
          's3:prefix': ['oyetunji/*', 'oyetunji/', 'kelvin/*', 'kelvin/'],
        },
      },
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);
