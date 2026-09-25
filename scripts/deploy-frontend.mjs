// Builds the React website and uploads it to the S3 bucket created by `pnpm deploy:backend`.
//
// It reads the ApiUrl and WebsiteBucketName outputs of the CloudFormation stack, so the backend
// must be deployed first. The stack name and region come from STACK_NAME and AWS_REGION if set,
// otherwise from the samconfig.toml saved by `sam deploy --guided`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// Reads a `key = "value"` setting from samconfig.toml, if the file exists
const samconfig = existsSync('samconfig.toml') ? readFileSync('samconfig.toml', 'utf8') : '';
const samSetting = (key) => samconfig.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1];

const stackName = process.env.STACK_NAME ?? samSetting('stack_name') ?? 'aws-serverless-sample-webapp';
const region = process.env.AWS_REGION ?? samSetting('region');
const regionArgs = region ? ['--region', region] : [];

// Runs a command, showing its output in the terminal
const run = (command, args, env) =>
  execFileSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });

console.log(`Reading the outputs of the "${stackName}" stack...`);
const stack = JSON.parse(
  execFileSync('aws', ['cloudformation', 'describe-stacks', '--stack-name', stackName, ...regionArgs, '--output', 'json'], {
    encoding: 'utf8',
  }),
).Stacks[0];
const output = (key) => stack.Outputs.find((o) => o.OutputKey === key).OutputValue;

// Vite puts VITE_* environment variables into the built JavaScript
run('pnpm', ['--filter', 'frontend', 'build'], { VITE_API_URL: output('ApiUrl') });

// Upload the built files, removing any left over from a previous deploy
run('aws', ['s3', 'sync', 'frontend/dist', `s3://${output('WebsiteBucketName')}`, '--delete', ...regionArgs]);

console.log(`\nWebsite deployed to ${output('WebsiteUrl')}`);
