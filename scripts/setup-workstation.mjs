// Local bootstrap only. No deployments, account grants, hooks, or secret exports.
import { copyFileSync, constants, existsSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (!['--check', '--skip-install'].includes(flag)) {
    console.error(`Unknown option: ${flag}`);
    process.exit(1);
  }
}
const [major, minor] = process.versions.node.split('.').map(Number);
if (!((major === 22 && minor >= 13) || major === 24)) {
  console.error('Use Node.js 22.13+ (22 LTS) or 24 LTS, then rerun setup.');
  process.exit(1);
}
if (realpathSync(process.cwd()) !== realpathSync(root)) {
  console.error('Run this command from the cloned repository root.');
  process.exit(1);
}

function read(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, timeout: 30_000,
    }).trim();
  } catch { return null; }
}

console.log(`Node ${process.versions.node}`);
const git = read('git', ['--version']);
if (!git) {
  console.error('Install Git from https://git-scm.com/downloads, then rerun setup.');
  process.exit(1);
}
console.log(git);
if (!existsSync(resolve(root, '.env.local.example'))) {
  console.error('Missing tracked .env.local.example; check the beta branch.');
  process.exit(1);
}

if (!flags.has('--check')) {
  if (!flags.has('--skip-install')) {
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !existsSync(npmCli)) {
      console.error('Run through npm: npm run setup:workstation');
      process.exit(1);
    }
    const result = spawnSync(process.execPath, [npmCli, 'ci'], {
      cwd: root, stdio: 'inherit', windowsHide: true,
    });
    if (result.error || result.status !== 0) {
      console.error('Dependency installation failed; no env file was created.');
      process.exit(result.status || 1);
    }
  }
  try {
    copyFileSync(resolve(root, '.env.local.example'), resolve(root, '.env.local'), constants.COPYFILE_EXCL);
    console.log('Created .env.local with placeholder values; real beta login is not configured.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('Preserved existing .env.local without reading or displaying its values.');
  }
}

const gh = read('gh', ['--version']);
if (!gh) {
  console.log('Contribution setup pending: install GitHub CLI (https://cli.github.com).');
} else {
  console.log(gh.split(/\r?\n/)[0]);
  const login = read('gh', ['api', 'user', '--jq', '.login']);
  console.log(login && /^[a-z0-9-]+$/i.test(login)
    ? `GitHub account: ${login}. Follow CONTRIBUTING.md to verify write access or set up a fork.`
    : 'GitHub sign-in pending: gh auth login --hostname github.com --git-protocol https --web');
}
console.log('Next: read CONTRIBUTING.md, finish GitHub authentication/remotes, run npm run build, then npm run dev.');
console.log('Private Vercel access is optional. This command does not create a fork, push code, or trigger a deployment.');
