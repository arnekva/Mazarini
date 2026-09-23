// Copies the bot repo's custom More-or-Less game JSON (res/games/moreOrLess/customGames/) into
// this app's src/data/more-or-less/ before dev/build runs, so the two never drift out of sync by
// hand. Vercel clones the whole monorepo even with Root Directory set to activities/, so the
// source folder is present at build time even though it isn't part of the deployed output.
const fs = require("fs")
const path = require("path")

const SRC_DIR = path.resolve(__dirname, "..", "..", "res", "games", "moreOrLess", "customGames")
const DEST_DIR = path.resolve(__dirname, "..", "src", "data", "more-or-less")

if (!fs.existsSync(SRC_DIR)) {
  console.error(`sync-mol-games: source folder not found at ${SRC_DIR} - skipping (are you outside the full monorepo checkout?)`)
  process.exit(0)
}

fs.mkdirSync(DEST_DIR, { recursive: true })

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".json"))
for (const file of files) {
  fs.copyFileSync(path.join(SRC_DIR, file), path.join(DEST_DIR, file))
}

console.log(`sync-mol-games: copied ${files.length} custom More-or-Less game file(s) from res/ into src/data/more-or-less/`)
