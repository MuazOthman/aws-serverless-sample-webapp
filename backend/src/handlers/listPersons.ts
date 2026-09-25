import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// GET /persons
export const handler: APIGatewayProxyHandlerV2 = async () => {
  const result = await db.send(
    new ScanCommand({
      TableName: process.env.PERSONS_TABLE,
    }),
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.Items),
  };
};
