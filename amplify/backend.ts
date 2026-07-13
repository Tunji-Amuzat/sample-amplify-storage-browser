import { defineBackend } from '@aws-amplify/backend';
import { CfnUserPoolGroup } from 'aws-cdk-lib/aws-cognito';
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
        paths: {
          'oyetunji/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
          'kelvin/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
          'application-files/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
          'folder-a/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
          'folder-b/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
          'folder-c/*': {
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
          's3:prefix': ['oyetunji/*', 'oyetunji/', 
            'kelvin/*', 'kelvin/',
            'application-files/*', 'application-files/',
            'folder-a/*', 'folder-a/',
            'folder-b/*', 'folder-b/',
            'folder-c/*', 'folder-c/',],
        },
      },
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);

// Plain Cognito groups used to record which folder(s) a user is assigned to.
// These are informational only: they carry no IAM role and are not part of
// `defineAuth`'s `groups` list, so they have no effect on Identity Pool role
// resolution or S3 access. Enforcement is a future step.
const folderGroupNames = [
  'oyetunji',
  'kelvin',
  'application-files',
  'folder-a',
  'folder-b',
  'folder-c',
];

for (const groupName of folderGroupNames) {
  new CfnUserPoolGroup(backend.stack, `${groupName}FolderGroup`, {
    groupName,
    userPoolId: backend.auth.resources.userPool.userPoolId,
    description: `Users assigned to the ${groupName} folder (informational only, not yet enforced)`,
  });
}

// IAM policy granting the `admin` group the Cognito Admin API actions needed
// by the admin UI to list/create users and manage their folder group membership.
const adminCognitoManagementPolicy = new Policy(backend.stack, 'adminCognitoManagementPolicy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'cognito-idp:ListUsers',
        'cognito-idp:ListGroups',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup',
      ],
      resources: [backend.auth.resources.userPool.userPoolArn],
    }),
  ],
});

backend.auth.resources.groups['admin'].role.attachInlinePolicy(adminCognitoManagementPolicy);
// Admins assume the `admin` group's role instead of the base authenticated
// role, so they also need the storage policy to keep Storage Browser access.
backend.auth.resources.groups['admin'].role.attachInlinePolicy(authPolicy);
