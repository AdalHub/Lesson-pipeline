// A focused publication check, not a replacement for a dedicated secret scanner.
// Compares history/current tracked content with local secrets without printing them.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parse } from 'dotenv';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const files = git('ls-files', '-z').split('\0').filter(Boolean);
const historyNames = git('log', '--all', '--format=', '--name-only').split(/\r?\n/).filter(Boolean);
const forbidden = [...new Set([...files, ...historyNames])].filter(file =>
  /(^|\/)(\.env(?:\..+)?|backups|private|\.vercel)(\/|$)/.test(file) && file !== '.env.example');
const text = git('log', '-p', '--all', '--no-ext-diff') + '\n' + files
  .filter(file => fs.existsSync(file)).map(file => fs.readFileSync(file, 'utf8')).join('\n');
const suspectPatterns = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const localEnv = fs.existsSync('.env.local') ? parse(fs.readFileSync('.env.local')) : {};
const knownSecrets = Object.entries(localEnv).filter(([name, value]) =>
  /KEY|TOKEN|PASSWORD|DATABASE_URL|POSTGRES_URL/.test(name) && value.length >= 16);
const matches = knownSecrets.filter(([, value]) => text.includes(value)).map(([name]) => name);
const privateCorrespondence = /palmer\.wenzel@|owed\s+to\s+the\s+staffing\s+agency/.test(text);
const patternsMatched = suspectPatterns.map((pattern, index) => pattern.test(text) ? index + 1 : null).filter(Boolean);
const ok = !forbidden.length && !matches.length && !patternsMatched.length && !privateCorrespondence;
console.log(JSON.stringify({ ok, trackedFiles: files.length, forbiddenPaths: forbidden, knownSecretNamesMatched: matches, credentialPatternsMatched: patternsMatched, privateCorrespondence }, null, 2));
if (!ok) process.exitCode = 1;
