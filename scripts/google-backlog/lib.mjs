// Shared OAuth helper for the Google Forms/Sheets backlog automation.
// See scripts/google-backlog/README.md for the one-time Cloud Console setup
// this depends on (redirect URI, enabled APIs, test-user access).

import { google } from 'googleapis';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CLIENT_SECRET_PATH = path.join(ROOT, '.secrets/google-oauth-client.json');
const TOKEN_PATH = path.join(ROOT, '.secrets/google-oauth-token.json');

// Must exactly match an "Authorized redirect URI" registered on this OAuth
// client in Google Cloud Console — this client is a "Web application" type,
// which (unlike "Desktop app" clients) requires an exact match, not just any
// localhost port.
const REDIRECT_URI = 'http://localhost:53682/oauth2callback';

export const SCOPES = {
  forms: 'https://www.googleapis.com/auth/forms.body',
  formsResponses: 'https://www.googleapis.com/auth/forms.responses.readonly',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',
};

// Every script in this folder shares one cached token, so the first one run
// requests the union of everything any of them need — otherwise whichever
// script runs first would cache a token too narrow for the others to reuse.
const ALL_SCOPES = Object.values(SCOPES);

function loadClientSecret() {
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    throw new Error(
      `Missing ${CLIENT_SECRET_PATH}. Copy the OAuth client JSON from Google ` +
        `Cloud Console into .secrets/google-oauth-client.json first (gitignored).`
    );
  }
  const raw = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf8'));
  const cfg = raw.web || raw.installed;
  if (!cfg) throw new Error('Unrecognized client secret JSON shape (expected a "web" or "installed" key).');
  return cfg;
}

async function interactiveAuth(oAuth2Client, scopes) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });

  console.log('\nOpen this URL in a browser and sign in with the Google account');
  console.log('that should own the forms / edit the spreadsheet:\n');
  console.log(authUrl + '\n');
  console.log(`Waiting for the OAuth redirect on ${REDIRECT_URI} ...`);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const err = url.searchParams.get('error');
      const authCode = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        err
          ? `<h1>Auth failed</h1><p>${err}</p><p>You can close this tab.</p>`
          : `<h1>Signed in</h1><p>You can close this tab and go back to the terminal.</p>`
      );
      server.close();
      if (err) reject(new Error(`OAuth error: ${err}`));
      else resolve(authCode);
    });
    server.listen(53682);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`Saved refresh token to ${TOKEN_PATH} (gitignored) — future runs won't need to re-auth.\n`);
}

/**
 * Returns an authenticated OAuth2 client (all of SCOPES, see ALL_SCOPES
 * above), running the interactive consent flow the first time and reusing
 * the cached token on subsequent runs.
 */
export async function getAuthedClient() {
  const { client_id, client_secret } = loadClientSecret();
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
  } else {
    await interactiveAuth(oAuth2Client, ALL_SCOPES);
  }

  return oAuth2Client;
}

export const STATE_PATH = path.join(__dirname, 'state.json');

export function readState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

export function writeState(next) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...readState(), ...next }, null, 2));
}
