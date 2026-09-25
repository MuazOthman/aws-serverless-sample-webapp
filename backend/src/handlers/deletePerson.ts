import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// DELETE /persons/{id}
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;

  await db.send(
    new DeleteCommand({
      TableName: process.env.PERSONS_TABLE,
      Key: { id },
    }),
  );

  return { statusCode: 204 };
};
