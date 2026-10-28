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
