/**
 * One-off: copy every still-working LinkedIn profile picture into blob
 * storage, so it stops expiring.
 *
 * LinkedIn's picture links are signed with an expiry (`e=`). Sign-in now
 * stores our own copy (lib/linkedin.ts), but members who joined before
 * that still point at LinkedIn and will go blank on the date in the link.
 * A link that has already expired answers 403 and cannot be copied; that
 * member gets their face back the next time they sign in with LinkedIn.
 *
 * Dry run by default (reads only). Pass --write to copy and update rows.
 *   DATABASE_URL=… BLOB_READ_WRITE_TOKEN=… node scripts/keep-linkedin-photos.mjs [--write]
 * DB_HOSTADDR / DB_SERVERNAME let it connect where the hostname won't resolve.
 */
import pg from "pg";
import { put } from "@vercel/blob";

const write = process.argv.includes("--write");
const u = new URL(process.env.DATABASE_URL);
const db = new pg.Client({
  host: process.env.DB_HOSTADDR || u.hostname,
  port: Number(u.port) || 5432,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
  ssl: { servername: process.env.DB_SERVERNAME || u.hostname },
});
if (write && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("--write needs BLOB_READ_WRITE_TOKEN");

await db.connect();
const { rows } = await db.query(`select id, name, photo_url from users where photo_url ~ 'licdn\\.com/'`);
const tally = { copied: 0, expired: 0, failed: 0 };

for (const r of rows) {
  const res = await fetch(r.photo_url).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) {
    tally.expired++;
    console.log(`expired  ${r.name} (${res?.status ?? "no response"})`);
    continue;
  }
  if (!write) {
    tally.copied++;
    console.log(`would copy  ${r.name}`);
    continue;
  }
  try {
    const blob = await put(`profile-photos/${r.id}-linkedin`, await res.arrayBuffer(), {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    // Only if nobody changed it meanwhile.
    await db.query(`update users set photo_url = $1 where id = $2 and photo_url = $3`, [blob.url, r.id, r.photo_url]);
    tally.copied++;
    console.log(`copied  ${r.name}`);
  } catch (e) {
    tally.failed++;
    console.log(`failed  ${r.name}: ${e.message}`);
  }
}

console.log(write ? "" : "\nDry run, nothing changed.", tally);
await db.end();
