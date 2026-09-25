import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  // Skip fields that are undefined, such as a missing (optional) notes
  marshallOptions: { removeUndefinedValues: true },
});

// POST /persons
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = JSON.parse(event.body ?? '{}');

  const person = {
    id: randomUUID(),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    notes: body.notes,
  };

  await db.send(
    new PutCommand({
      TableName: process.env.PERSONS_TABLE,
      Item: person,
    }),
  );

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  };
};
