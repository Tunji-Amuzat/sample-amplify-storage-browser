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

/**
 * Single root location.
 *
 * A "location" is an IAM grant, not a folder — adding one requires a code change
 * and a redeploy. By granting one root prefix instead of a fixed list, everything
 * inside it becomes an ordinary S3 folder that users can create, rename and nest
 * from the UI with no redeploy.
 *
 * Per-folder access control is not expressed here. That needs per-session scoped
 * credentials rather than one static policy shared by every authenticated user.
 */
const ROOT_PREFIX = 'vault';

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
        paths: {
          [`${ROOT_PREFIX}/*`]: {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
        },
      } as any,
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
          's3:prefix': [`${ROOT_PREFIX}/*`, `${ROOT_PREFIX}/`],
        },
      },
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);
