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
 * The vault is rooted at the bucket, so every top-level folder that exists in S3
 * is listed without being declared here. Folders are ordinary S3 prefixes that
 * users create from the UI — no redeploy needed to add one.
 *
 * The client supplies the browsable location (see `ROOT_PREFIX` in `src/App.tsx`);
 * this policy only decides what the signed-in user is permitted to reach.
 *
 * Per-folder access control is not expressed here. That needs per-session scoped
 * credentials rather than one static policy shared by every authenticated user.
 */

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
          '*': {
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
    // Listing is allowed across the bucket so the browser can enumerate whatever
    // folders actually exist, including ones created from the UI after deploy.
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [existingBucket.bucketArn, `${existingBucket.bucketArn}/*`],
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);
