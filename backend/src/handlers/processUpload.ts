import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { S3Handler } from 'aws-lambda';

// Created once and reused across invocations of this Lambda function
const s3 = new S3Client({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  // Skip fields that are undefined, such as a missing (optional) notes
  marshallOptions: { removeUndefinedValues: true },
});

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  notes?: string;
};

// Runs every time a file is created in the uploads bucket.
// The file holds a list of persons, or a single person, as JSON or CSV. Each person with an id
// that is already in the table is updated; any other person is created with the id in the file.
export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // Keys in S3 events are URL-encoded, with spaces as "+"
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = (await object.Body?.transformToString()) ?? '';
    const rows = key.toLowerCase().endsWith('.csv') ? parseCsv(text) : [JSON.parse(text)].flat();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const person = toPerson(row);
      if (!person) {
        console.warn(`${key}: skipping person #${index + 1}, it needs an id, firstName, lastName and email`, row);
        skipped++;
        continue;
      }

      const existing = await db.send(
        new GetCommand({
          TableName: process.env.PERSONS_TABLE,
          Key: { id: person.id },
        }),
      );

      // Either way the person in the file replaces what is stored, like PUT /persons/{id} does
      await db.send(
        new PutCommand({
          TableName: process.env.PERSONS_TABLE,
          Item: person,
        }),
      );

      if (existing.Item) {
        updated++;
      } else {
        created++;
      }
    }

    console.log(`${key}: created ${created}, updated ${updated}, skipped ${skipped}`);
  }
};

// Picks the person's fields out of a row of the file, or returns undefined if any are missing
function toPerson(row: unknown): Person | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const { id, firstName, lastName, email, notes } = row as Record<string, unknown>;
  const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

  const person: Person = {
    id: text(id),
    firstName: text(firstName),
    lastName: text(lastName),
    email: text(email),
    notes: text(notes) || undefined,
  };
  if (!person.id || !person.firstName || !person.lastName || !person.email) return undefined;
  return person;
}

// Turns CSV text into one object per line, using the first line as the field names.
// Supports values in double quotes, which may contain commas, line breaks and "" for a quote.
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let line: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      line.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      line.push(value);
      lines.push(line);
      line = [];
      value = '';
    } else {
      value += char;
    }
  }
  // The last line may not end with a line break
  if (value || line.length > 0) {
    line.push(value);
    lines.push(line);
  }

  // Leave out blank lines, such as one at the end of the file
  const [header = [], ...rows] = lines.filter((l) => l.some((v) => v.trim() !== ''));
  const names = header.map((name) => name.replace(/^﻿/, '').trim());
  return rows.map((values) => Object.fromEntries(names.map((name, i) => [name, values[i] ?? ''])));
}
