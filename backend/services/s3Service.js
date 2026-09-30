const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');

// AWS SDK v3. Credentials are NOT passed here: the SDK's default provider
// chain reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the environment
// (or an IAM role when deployed on AWS). They never reach the frontend.

let client = null;

function isConfigured() {
  return Boolean(env.aws.bucket && env.aws.region);
}

function getClient() {
  client ??= new S3Client({ region: env.aws.region });
  return client;
}

async function uploadImage(key, body, contentType) {
  await getClient().send(
    new PutObjectCommand({ Bucket: env.aws.bucket, Key: key, Body: body, ContentType: contentType })
  );
}

// The bucket stays private. To show an image, the API hands the browser a
// presigned URL: a normal HTTPS link that works for a limited time only.
function getSignedImageUrl(key) {
  const command = new GetObjectCommand({ Bucket: env.aws.bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: env.aws.urlExpiresSeconds });
}

async function deleteImage(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: env.aws.bucket, Key: key }));
}

// Permanent (non-public) object URL, stored in MongoDB for reference.
function getObjectUrl(key) {
  return `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${key}`;
}

module.exports = { isConfigured, uploadImage, getSignedImageUrl, deleteImage, getObjectUrl };
