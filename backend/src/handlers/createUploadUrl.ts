import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const s3 = new S3Client({
  // Don't add a checksum of an empty body to the URL, or the browser's upload would be rejected
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

// The kinds of file that processUpload knows how to read
const allowedExtensions = ['csv', 'json'];

// POST /uploads
// Returns a short-lived URL the website can PUT a CSV or JSON file of persons to
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = JSON.parse(event.body ?? '{}');
  const extension = String(body.fileName ?? '').split('.').pop()?.toLowerCase() ?? '';

  if (!allowedExtensions.includes(extension)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Only .csv and .json files can be uploaded' }),
    };
  }

  // A new, random name, so uploads never overwrite each other
  const key = `uploads/${randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.UPLOADS_BUCKET,
      Key: key,
    }),
    { expiresIn: 300 }, // seconds
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadUrl, key }),
  };
};
