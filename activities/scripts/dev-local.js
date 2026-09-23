// Starts `next dev` with the Discord-less test mode on (see devAuthEnabled in src/lib/env.ts).
// Opt-in on purpose: plain `npm run dev` still behaves exactly like the real Activity.
process.env.NEXT_PUBLIC_DEV_AUTH = "1"
process.argv = [process.argv[0], "next", "dev", ...process.argv.slice(2)]
require("next/dist/bin/next")
