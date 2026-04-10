import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';


/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  storage
});

// Reference an existing external S3 bucket
backend.addOutput({
  storage: {
    aws_region: 'us-east-1',
    bucket_name: 'alarrt-test-bucket'
  }
});