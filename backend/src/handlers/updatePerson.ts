import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  // Skip fields that are undefined, such as a missing (optional) notes
  marshallOptions: { removeUndefinedValues: true },
});

// PUT /persons/{id}
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;
  const body = JSON.parse(event.body ?? '{}');

  const person = {
    id,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    notes: body.notes,
  };

  try {
    await db.send(
      new PutCommand({
        TableName: process.env.PERSONS_TABLE,
        Item: person,
        // Only replace the person if they already exist
        ConditionExpression: 'attribute_exists(id)',
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Person not found' }),
      };
    }
    throw error;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  };
};
