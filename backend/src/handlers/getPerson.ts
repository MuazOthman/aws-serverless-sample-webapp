import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// GET /persons/{id}
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;

  const result = await db.send(
    new GetCommand({
      TableName: process.env.PERSONS_TABLE,
      Key: { id },
    }),
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Person not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.Item),
  };
};
