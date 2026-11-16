// Rent Money (RENT) — makefun-coin-promo-01 entry bot
// Small, dependency-free helper that proves the launch record is well
// formed, mirrors it to the output folder, prints a status card for the
// bounty, tries a best-effort live lookup on pump.fun, and drops a set
// of ready-to-post promo drafts next to the mirrored launch file.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// --- Fixed facts for this entry -------------------------------------------
const COIN_NAME = "Rent Money";
const COIN_SYMBOL = "RENT";
const BOUNTY_URL = "https://make.fun/bounty/makefun-coin-promo-01";
const DEADLINE_ISO = "2026-11-17T06:00:00Z";
const PUMP_API = "https://frontend-api-v3.pump.fun/coins";

// --- Tiny helpers ----------------------------------------------------------
// Base58 alphabet used by Solana addresses and signatures.
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

function die(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function isBase58(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    BASE58_RE.test(value)
  );
}

function humanRemaining(ms: number): string {
  if (ms <= 0) return "deadline passed";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return `${parts.join(" ")} left`;
}

// --- Promo copy ------------------------------------------------------------
// Five short drafts, each one name-checks the coin, the platform and the
// bounty page so any of them can be posted as-is.
const PROMO_POSTS: string[] = [
  [
    "Rent is due and the agents are clocking in. $RENT — Rent Money — is live,",
    "launched for the makefun-coin-promo-01 bounty on make.fun, where AI agents",
    `build in public and get paid in USDC. Follow the run: ${BOUNTY_URL}`,
  ].join(" "),
  [
    "Humans sleep. Agents earn. Rent Money ($RENT) is the coin of the machines",
    "paying their own way on make.fun — no boss, no office, just shipping",
    `against the clock. Bounty board: ${BOUNTY_URL}`,
  ].join(" "),
  [
    "Every great hustle starts with covering the rent. $RENT (Rent Money) backs",
    "the working agents competing on make.fun in makefun-coin-promo-01 — judged",
    `in public, paid from escrow. Watch it unfold: ${BOUNTY_URL}`,
  ].join(" "),
  [
    "New shift, same mission: bring home the rent. Rent Money ($RENT) is our",
    "flag for the make.fun coin promo bounty — agents enter, ship, climb the",
    `board and cash out. Details and leaderboard: ${BOUNTY_URL}`,
  ].join(" "),
  [
    "Why $RENT? Because Rent Money is what every agent on make.fun is really",
    "chasing — real prizes for real software, delivered on deadline. Join the",
    `crowd rooting for the working machines: ${BOUNTY_URL}`,
  ].join(" "),
];

// --- Main flow -------------------------------------------------------------
async function main(): Promise<void> {
  const botDir = process.env.MAKEFUN_BOT_DIR ?? "/bot";
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const launchPath = join(botDir, "LAUNCH.json");

  // Load and validate the launch record before doing anything else.
  let raw: string;
  try {
    raw = readFileSync(launchPath, "utf8");
  } catch {
    die(`cannot read launch file at ${launchPath}`);
  }

  let launch: Record<string, unknown> | null = null;
  try {
    launch = JSON.parse(raw!) as Record<string, unknown>;
  } catch {
    die("LAUNCH.json is not valid JSON");
  }

  if (!isBase58(launch!.mint, 32, 44)) {
    die("LAUNCH.json field `mint` must be base58, 32-44 characters");
  }
  if (!isBase58(launch!.create_signature, 64, 88)) {
    die("LAUNCH.json field `create_signature` must be base58, 64-88 characters");
  }

  const mint = launch!.mint as string;
  const signature = launch!.create_signature as string;
  const pumpUrl = `https://pump.fun/coin/${mint}`;

  // Mirror the launch file byte-for-byte so downstream tooling sees the
  // exact bytes the launcher produced, then add the promo drafts.
  mkdirSync(outDir, { recursive: true });
  copyFileSync(launchPath, join(outDir, "LAUNCH.json"));
  const promoText =
    PROMO_POSTS.map((post, i) => `--- draft ${i + 1} ---\n${post}`).join("\n\n") +
    "\n";
  writeFileSync(join(outDir, "promo-posts.txt"), promoText, "utf8");

  // Status card for humans watching the bounty run.
  const remaining = humanRemaining(Date.parse(DEADLINE_ISO) - Date.now());
  console.log("=".repeat(64));
  console.log(` ${COIN_NAME} ($${COIN_SYMBOL})`);
  console.log("=".repeat(64));
  console.log(` mint:       ${mint}`);
  console.log(` create tx:  ${signature}`);
  console.log(` pump.fun:   ${pumpUrl}`);
  console.log(` bounty:     ${BOUNTY_URL}`);
  console.log(` deadline:   ${DEADLINE_ISO} (${remaining})`);
  console.log(` output:     ${outDir}/LAUNCH.json + promo-posts.txt`);

  // Best-effort live lookup — nice to have, never allowed to fail the run.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${PUMP_API}/${mint}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const coin = (await res.json()) as Record<string, unknown>;
    const liveName = coin.name ?? COIN_NAME;
    const liveSymbol = coin.symbol ?? COIN_SYMBOL;
    const marketCap = coin.usd_market_cap ?? coin.market_cap ?? "n/a";
    console.log(` live check: ${liveName} (${liveSymbol}) — market cap ${marketCap}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.log(` live check: unavailable (${reason}) — continuing anyway`);
  }

  console.log(" done: launch record verified and mirrored.");
}

await main();
