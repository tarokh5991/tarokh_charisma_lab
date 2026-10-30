import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("account bans allow the supported durations and protect administrators", async () => {
  const migration = await read(
    "./supabase/migrations/20261028100000_add_admin_user_bans.sql",
  )

  for (const period of [
    "three_days",
    "seven_days",
    "fourteen_days",
    "permanent",
    "remove",
  ]) {
    assert.match(migration, new RegExp(`when '${period}'`))
  }

  assert.match(migration, /role = 'admin'/)
  assert.match(migration, /administrators cannot be banned/)
  assert.match(migration, /update auth\.users/)
})

test("admin UI exposes ban and unban controls", async () => {
  const app = await read("./src/App.tsx")

  for (const label of [
    "بن ۳ روزه",
    "بن ۷ روزه",
    "بن ۲ هفته‌ای",
    "بن دائم",
    "رفع بن",
  ]) {
    assert.match(app, new RegExp(label))
  }

  assert.match(app, /selectedUser\.profile\.role\s*===\s*"admin"/)
  assert.match(app, /setAdminUserBan/)
})

test("user profiles include the ban state needed to end blocked sessions", async () => {
  const auth = await read("./src/lib/supabase-auth.ts")
  const app = await read("./src/App.tsx")

  assert.match(auth, /is_banned: boolean/)
  assert.match(auth, /banned_until: string \| null/)
  assert.match(
    auth,
    /select=id,role,username,display_name,is_banned,banned_until/,
  )
  assert.match(app, /profileIsBanned\(profile\)/)
})

test("path challenges use the two recommended CLEAR dimensions and remain user-scoped", async () => {
  const app = await read("./src/App.tsx")
  const migration = await read(
    "./supabase/migrations/20261028130000_add_path_challenges.sql",
  )

  assert.match(app, /const pathChallengeKey = \[\.\.\.recommendedDimensions\]/)
  assert.match(
    app,
    /const assignedPathChallenges = pathChallenges\[pathChallengeKey\]/,
  )
  assert.match(app, /completePathChallenge/)
  assert.match(migration, /primary key \(user_id, challenge_key\)/)
  assert.match(migration, /user_id = auth\.uid\(\)/)
  for (const key of ["cl-1", "ce-1", "la-2", "ar-2"]) {
    assert.match(migration, new RegExp(`'${key}'`))
  }
})

test("email signup rejects an address already associated with an account", async () => {
  const app = await read("./src/App.tsx")
  const auth = await read("./src/lib/supabase-auth.ts")
  const migration = await read(
    "./supabase/migrations/20261030100000_prevent_duplicate_email_signup.sql",
  )

  assert.match(app, /signup && accountTab === "email"/)
  assert.match(app, /registrationEmailExists\(identifier\.trim\(\)\)/)
  assert.match(auth, /registration_email_exists/)
  assert.match(migration, /add column email_hash text/)
  assert.match(
    migration,
    /grant execute on function public\.registration_email_exists\(text\) to anon, authenticated/,
  )
})

test("client error logging is authenticated, rate-limited, and visible to admins", async () => {
  const migration = await read(
    "./supabase/migrations/20261028110000_add_client_error_monitoring.sql",
  )
  const app = await read("./src/App.tsx")

  assert.match(migration, /if auth\.uid\(\) is null/)
  assert.match(migration, /interval '1 minute'/)
  assert.match(migration, /not public\.is_admin\(\)/)
  assert.match(app, /logClientError/)
  assert.match(app, /getAdminRecentClientErrors/)
})
