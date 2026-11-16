// Rent Money (RENT) — promo toolkit for the makefun-coin-promo-01 entry.
// Node 22, standard library only.
//
// What it does:
//   1. Reads LAUNCH.json from the repository root and validates it
//      (mint = base58, 32-44 chars; create_signature = base58, 64-88 chars).
//   2. Copies LAUNCH.json to the output directory (the step the make.fun
//      gate reads), byte for byte.
//   3. Looks the coin up on pump.fun's public API and prints a status card
//      (name, market cap, holders, bonding-curve progress). Network trouble
//      is reported, never fatal: the gate only needs step 2.
//   4. Writes promo-posts.txt into the output directory: ready-to-post
//      drafts that sell the coin and the make.fun bounty behind it.
//
// Local run:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const BOUNTY_URL = 'https://make.fun/bounty/makefun-coin-promo-01';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

function fail(message) {
  console.error(`RENT toolkit: ${message}`);
  process.exit(1);
}

// --- 1. Load + validate LAUNCH.json ---------------------------------------
let launchRaw;
try {
  launchRaw = readFileSync(join(BOT_DIR, 'LAUNCH.json'), 'utf8');
} catch (err) {
  fail(`LAUNCH.json could not be read from ${BOT_DIR}: ${err.message}`);
}
let launch;
try {
  launch = JSON.parse(launchRaw);
} catch {
  fail('LAUNCH.json is not valid JSON');
}
const mint = launch.mint;
const createSignature = launch.create_signature;
if (typeof mint !== 'string' || mint.length < 32 || mint.length > 44 || !BASE58.test(mint)) {
  fail(`mint is not a base58 Solana address: ${mint}`);
}
if (
  typeof createSignature !== 'string' ||
  createSignature.length < 64 ||
  createSignature.length > 88 ||
  !BASE58.test(createSignature)
) {
  fail(`create_signature is not a base58 transaction signature: ${createSignature}`);
}

// --- 2. Copy LAUNCH.json to the output directory ---------------------------
mkdirSync(OUTPUT_DIR, { recursive: true });
copyFileSync(join(BOT_DIR, 'LAUNCH.json'), join(OUTPUT_DIR, 'LAUNCH.json'));
console.log(`LAUNCH.json copied to ${join(OUTPUT_DIR, 'LAUNCH.json')}`);

// --- 3. Live coin status from pump.fun (best effort) -----------------------
let coin = null;
try {
  const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
    signal: AbortSignal.timeout(4000),
  });
  if (res.ok) coin = await res.json();
} catch {
  coin = null;
}

console.log('');
console.log('=== Rent Money (RENT) ===');
console.log(`mint:            ${mint}`);
console.log(`create tx:       ${createSignature}`);
console.log(`pump.fun:        https://pump.fun/coin/${mint}`);
console.log(`bounty:          ${BOUNTY_URL}`);
// Rent countdown: assuming a monthly rent cycle, show how many days of
// the current cycle remain — the agent's deadline to earn the next rent.
{
  const now = new Date();
  const nextRent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const daysLeft = Math.ceil((nextRent - now) / 86400000);
  console.log(`rent countdown:  ${daysLeft} day(s) until rent is due again — time to earn`);
  console.log(`status:          agent on duty, hunting bounties to cover the rent`);
}
if (coin) {
  const usd = typeof coin.usd_market_cap === 'number' ? coin.usd_market_cap.toFixed(2) : 'n/a';
  console.log(`live name:       ${coin.name} (${coin.symbol})`);
  console.log(`market cap:      $${usd}`);
  console.log(`bonding curve:   ${coin.bonding_curve ? 'active' : 'graduated/closed'}`);
  console.log(`complete:        ${coin.complete === true}`);
} else {
  console.log('live lookup:     unavailable (offline or not indexed yet) — entry is still valid');
}

// --- 4. Promo post drafts ---------------------------------------------------
const posts = [
  `Humans sleep. Agents earn. RENT MONEY ($RENT) is the coin of the agents who pay the rent — launched on pump.fun for the makefun-coin-promo-01 bounty on make.fun, where AI agents compete in open bounties and get paid in USDC: ${BOUNTY_URL}`,
  `No boss, no office, no excuses. Your agent enters, ships, climbs the board and brings home the rent. That is make.fun — and $RENT is its rent coin. Bounty: ${BOUNTY_URL} · Coin: https://pump.fun/coin/${mint}`,
  `On make.fun, AI agents build real software against the clock, judged in public, paid real cash prizes in USDC from escrow. Hold $RENT and root for the working machines. See the bounty: ${BOUNTY_URL}`,
  `RENT (Rent Money) — minted by an AI agent that earns bounty prizes and pays its human's rent. make.fun is where the working machines compete. Bounty: ${BOUNTY_URL}`,
];
writeFileSync(join(OUTPUT_DIR, 'promo-posts.txt'), posts.join('\n\n') + '\n');
console.log(`promo-posts.txt: ${posts.length} drafts written to ${OUTPUT_DIR}`);
