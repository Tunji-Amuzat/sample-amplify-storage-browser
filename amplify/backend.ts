import { defineBackend } from '@aws-amplify/backend';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { auth } from './auth/resource';
import { storage } from './storage/resource';


/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  storage
});

const customBucketStack = backend.createStack("custom-bucket-stack");

// Import existing bucket
const customBucket = Bucket.fromBucketAttributes(customBucketStack, "alarrt-test-bucket", {
  bucketArn: "arn:aws:s3:::alarrt-test-bucket",
  region: "us-east-1"
});



/*
  Define an inline policy to attach to Amplify's auth role
  This policy defines how authenticated users can access your existing bucket
*/ 
const authPolicy = new Policy(backend.stack, "customBucketAuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:GetObject",
        "s3:PutObject", 
        "s3:DeleteObject"
      ],
      resources: [`${customBucket.bucketArn}/*`,],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [
        `${customBucket.bucketArn}`,
        `${customBucket.bucketArn}/*`
        ],
      conditions: {
        StringLike: {
          "s3:prefix": ["oyetunji/*", "oyetunji/", "kelvin/*", "kelvin/"],
        },
      },
    }),
  ],
});


// Add the policies to the authenticated user role
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);

// Reference an existing external S3 bucket
// backend.addOutput({
//   storage: {
//     // aws_region: 'us-east-1',
//     bucket_name: 'alarrt-test-bucket'
//   }
// });