"use client"

import { useEffect } from "react"
import { themeById } from "./themes"

const STORAGE_KEY = "themeOverride"

/** For trying a theme outside its dates: ?theme=<id> switches to it, ?theme=none turns theming off, ?theme=auto goes back to the
 * date-based one. Kept for the rest of the session, since moving between pages drops the query string. Renders nothing. */
export function ThemeOverride() {
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("theme")
      if (fromUrl === "auto") sessionStorage.removeItem(STORAGE_KEY)
      else if (fromUrl === "none" || (fromUrl && themeById(fromUrl))) sessionStorage.setItem(STORAGE_KEY, fromUrl)

      const override = sessionStorage.getItem(STORAGE_KEY)
      if (!override) return
      const root = document.documentElement.dataset
      const theme = themeById(override)
      if (theme) root.theme = theme.id
      else delete root.theme
      if (theme?.tone) root.tone = theme.tone
      else delete root.tone
    } catch {
      // No sessionStorage (blocked in some iframes) - just stay on the date-based theme.
    }
  }, [])
  return null
}
