#!/usr/bin/env node
/**
 * Bakes GitHub + GitLab contribution history into src/data/contributions.json.
 *
 * Run manually with `npm run refresh-contributions`, or on a schedule from
 * .github/workflows/refresh-contributions.yml.
 *
 * On any failure the existing JSON is left untouched and the process exits 0, so
 * a flaky API never breaks a deploy — the site just keeps the last good data.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'src/data/contributions.json');
const DAYS_OF_HISTORY = 365;
const GITLAB_PAGE_SIZE = 100;

/** Reads a `export const NAME = '...'` value out of src/lib/social-links.ts. */
function readConstant(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*'"\`([^'"\`]*)['"\`]`));
  return match ? match[1] : '';
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function lastNDays(count) {
  const days = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    days.push(isoDay(date));
  }
  return days;
}

async function fetchGitHub(username) {
  const token = process.env.GH_CONTRIBUTIONS_TOKEN || process.env.GITHUB_TOKEN;
  if (!username) throw new Error('GITHUB_USERNAME is empty');
  if (!token) {
    throw new Error(
      'no token: GitHub contribution history needs GH_CONTRIBUTIONS_TOKEN (PAT with read:user). ' +
        'The public REST API cannot report contribution counts.'
    );
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'porto-contributions'
    },
    body: JSON.stringify({
      query: `query ($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              weeks { contributionDays { date contributionCount } }
            }
          }
        }
      }`,
      variables: {
        login: username,
        from: new Date(Date.now() - DAYS_OF_HISTORY * 86400000).toISOString(),
        to: new Date().toISOString()
      }
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub HTTP ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL: ${payload.errors.map((e) => e.message).join('; ')}`);
  }

  const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const counts = new Map();
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > 0) counts.set(day.date, day.contributionCount);
    }
  }
  return counts;
}

async function fetchGitLab(username) {
  const token = process.env.GITLAB_TOKEN;
  if (!username) {
    console.warn('! GITLAB_USERNAME is empty, skipping GitLab');
    return new Map();
  }

  const headers = {Accept: 'application/json'};
  if (token) headers['PRIVATE-TOKEN'] = token;

  const usersResponse = await fetch(
    `https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`,
    {headers}
  );
  if (!usersResponse.ok) throw new Error(`GitLab users HTTP ${usersResponse.status}`);

  const users = await usersResponse.json();
  const user = Array.isArray(users) ? users[0] : null;
  if (!user) throw new Error(`GitLab user not found: ${username}`);

  const after = isoDay(new Date(Date.now() - DAYS_OF_HISTORY * 86400000));
  const counts = new Map();

  for (let page = 1; page <= 20; page += 1) {
    const url =
      `https://gitlab.com/api/v4/users/${user.id}/events` +
      `?after=${after}&per_page=${GITLAB_PAGE_SIZE}&page=${page}`;
    const response = await fetch(url, {headers});
    if (!response.ok) throw new Error(`GitLab events HTTP ${response.status}`);

    const events = await response.json();
    if (!Array.isArray(events) || events.length === 0) break;

    for (const event of events) {
      if (!event.created_at) continue;
      const day = event.created_at.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    if (events.length < GITLAB_PAGE_SIZE) break;
  }

  return counts;
}

async function main() {
  const socialLinks = path.join(ROOT, 'src/lib/social-links.ts');
  const githubUser = process.env.GITHUB_USERNAME ?? readConstant(socialLinks, 'GITHUB_USERNAME');
  const gitlabUser = process.env.GITLAB_USERNAME ?? readConstant(socialLinks, 'GITLAB_USERNAME');

  const previous = fs.existsSync(OUTPUT)
    ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8'))
    : {updatedAt: null, days: [], totals: {github: 0, gitlab: 0}};

  let github;
  let gitlab;
  try {
    github = await fetchGitHub(githubUser);
    gitlab = await fetchGitLab(gitlabUser);
  } catch (error) {
    console.warn(`! ${error.message}`);
    console.warn(`! keeping previous data (${previous.days.length} days). Nothing was written.`);
    return;
  }

  const days = lastNDays(DAYS_OF_HISTORY).map((date) => ({
    date,
    github: github.get(date) ?? 0,
    gitlab: gitlab.get(date) ?? 0
  }));

  const totals = days.reduce(
    (acc, day) => ({github: acc.github + day.github, gitlab: acc.gitlab + day.gitlab}),
    {github: 0, gitlab: 0}
  );

  fs.writeFileSync(
    OUTPUT,
    `${JSON.stringify({updatedAt: new Date().toISOString(), days, totals}, null, 2)}\n`
  );

  console.log(
    `wrote ${path.relative(ROOT, OUTPUT)} — ${totals.github} GitHub, ${totals.gitlab} GitLab ` +
      `across ${days.length} days`
  );
}

await main();
