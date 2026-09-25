# aws-serverless-sample-webapp
A simple Persons app written in TypeScript, provided as an example of a serverless backend on AWS
with a React website in front of it.

It stores **persons** (`id`, `firstName`, `lastName`, `email`, `notes`) in DynamoDB, exposes
them through API Gateway with one Lambda function per operation, and has a website, hosted in an
S3 bucket, to list, add, update and delete them. Persons can also be imported in bulk by uploading a
CSV or JSON file from the website.

## Project layout

This is a [pnpm workspace](https://pnpm.io/workspaces) (a "monorepo") with two packages:

```
backend/         The REST API: one Lambda handler per operation, plus the upload processor
frontend/        The React website (built with Vite)
scripts/         deploy-frontend.mjs: builds the website and uploads it to S3
template.yaml    The AWS SAM template for everything: table, functions, API and buckets
```

### Backend

| Method   | Path            | Lambda handler                            |
| -------- | --------------- | ----------------------------------------- |
| `POST`   | `/persons`      | `backend/src/handlers/createPerson.ts`    |
| `GET`    | `/persons`      | `backend/src/handlers/listPersons.ts`     |
| `GET`    | `/persons/{id}` | `backend/src/handlers/getPerson.ts`       |
| `PUT`    | `/persons/{id}` | `backend/src/handlers/updatePerson.ts`    |
| `DELETE` | `/persons/{id}` | `backend/src/handlers/deletePerson.ts`    |
| `POST`   | `/uploads`      | `backend/src/handlers/createUploadUrl.ts` |

- `backend/src/handlers/` has one small, self-contained file per Lambda function. Each one creates
  its own DynamoDB client and reads the table name from the `PERSONS_TABLE` environment variable.
- `pnpm --filter backend build` uses [esbuild](https://esbuild.github.io/) to turn each handler into
  a single JavaScript file, `backend/dist/<handler>/index.js`. Each function's `CodeUri` in
  `template.yaml` is its own folder, so each Lambda function is uploaded with only its own code. The
  AWS SDK is left out because the Lambda Node.js runtime already includes it.

### Uploading persons

The website's **Upload file** button imports many persons at once:

1. The website calls `POST /uploads` with the file's name. `createUploadUrl.ts` returns a
   [presigned URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
   that is valid for 5 minutes, for a new, randomly named object in the private uploads bucket.
   Only `.csv` and `.json` files are accepted.
2. The website `PUT`s the file straight to S3 with that URL.
3. The bucket sends an `s3:ObjectCreated` event to `backend/src/handlers/processUpload.ts`, which
   reads the file and loops over the persons in it. For each one it looks up the `id` in the table:
   if it is found, the stored person is updated (replaced, like `PUT /persons/{id}`); if not, the
   person is created with that `id`. Persons without an `id`, `firstName`, `lastName` or `email`
   are skipped. It logs how many were created, updated and skipped to CloudWatch.

A JSON file holds a list of persons or a single person; a CSV file has a header line with the field
names. See `backend/samples/persons.csv` and `backend/samples/persons.json`:

```csv
id,firstName,lastName,email,notes
p-001,Ada,Lovelace,ada@example.com,First programmer
p-002,Alan,Turing,alan@example.com,"Codebreaker, computer scientist"
```

Uploaded files are deleted from the bucket automatically after 7 days.

### Frontend

- `frontend/src/App.tsx` shows the list of persons and an **Add person** button.
- Clicking a person's name opens `frontend/src/PersonDialog.tsx`, where you can update or delete them.
  The same dialog, empty, is used to add a person.
- The **Upload file** button next to it uploads a CSV or JSON file of persons (see above), then
  reloads the list a few seconds later.
- `frontend/src/api.ts` has the functions that call the API. The API's URL comes from the
  `VITE_API_URL` environment variable, which Vite puts into the website when it is built.

### How it fits together

- `template.yaml` is the [AWS SAM](https://aws.amazon.com/serverless/sam/) template. It creates the
  DynamoDB table, the Lambda functions, the HTTP API routes that call them, an S3 bucket set up
  as a public [static website](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html),
  and a private S3 bucket for uploaded files.
- The website and the API live on different domains, so the API allows
  [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) requests from the website's URL
  (and from `http://localhost:5173` for local development). The uploads bucket allows CORS `PUT`
  requests from the same places.
- The website is served straight from S3, without CloudFront, so it is plain `http://`, not `https://`.

## Prerequisites

- [Node.js 24](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
  and the [AWS CLI](https://aws.amazon.com/cli/)
- An AWS account with credentials configured. The account must allow public S3 buckets: if
  [Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
  is turned on for the whole account, the website bucket can't be made public.

## Deploy

```bash
pnpm install
pnpm run deploy
```

(Use `pnpm run deploy`, not `pnpm deploy`: in a workspace, `pnpm deploy` is a built-in pnpm command.)

`pnpm run deploy` runs two steps, which you can also run on their own:

1. `pnpm deploy:backend` builds the Lambda functions and deploys `template.yaml` with SAM. SAM asks
   a few questions the first time (stack name, region, ...). Save the answers to
   `samconfig.toml`. Once that file exists, SAM uses it and doesn't ask again;
   delete it to be asked again.
2. `pnpm deploy:frontend` reads the `ApiUrl` and `WebsiteBucketName` outputs of the stack, builds
   the website with that API URL, and uploads it to the bucket. It prints the `WebsiteUrl` when done.

The frontend step reads the stack name and region from `samconfig.toml`. Without that file it uses
the stack name `aws-serverless-sample-webapp` and the AWS CLI's default region. To use a
different stack, set them first, for example
`AWS_REGION=eu-west-1 STACK_NAME=my-stack pnpm deploy:frontend`.

## Run the website locally

With the backend deployed, copy `frontend/.env.example` to `frontend/.env.local`, set
`VITE_API_URL` to your `ApiUrl`, then:

```bash
pnpm --filter frontend dev
```

and open http://localhost:5173.

## Try the API

`backend/persons.http` has requests for the VS Code
[REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension. Or use curl:

```bash
API=<your ApiUrl>

# Create
curl -X POST $API/persons -H 'Content-Type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","notes":"First programmer"}'

# List
curl $API/persons

# Get
curl $API/persons/<id>

# Update
curl -X PUT $API/persons/<id> -H 'Content-Type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@lovelace.dev"}'

# Delete
curl -X DELETE $API/persons/<id>

# Upload a file of persons: get an upload URL, then PUT the file to it
URL=$(curl -s -X POST $API/uploads -H 'Content-Type: application/json' \
  -d '{"fileName":"persons.csv"}' | jq -r .uploadUrl)
curl -X PUT --upload-file backend/samples/persons.csv "$URL"
```

## Clean up

CloudFormation can't delete a bucket that still has files in it, so empty both buckets first:

```bash
aws s3 rm s3://<your WebsiteBucketName> --recursive
aws s3 rm s3://<your UploadsBucketName> --recursive
sam delete
```
