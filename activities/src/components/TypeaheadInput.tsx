"use client"

import { useMemo, useState } from "react"
import styles from "./TypeaheadInput.module.css"

const MAX_SUGGESTIONS = 6

export function TypeaheadInput({
  suggestions,
  onSubmit,
  disabled,
  placeholder,
}: {
  suggestions: string[]
  onSubmit: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return []
    const starts = suggestions.filter((s) => s.toLowerCase().startsWith(query))
    const contains = suggestions.filter((s) => !s.toLowerCase().startsWith(query) && s.toLowerCase().includes(query))
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
  }, [value, suggestions])

  function pick(s: string) {
    setValue(s)
    setShowSuggestions(false)
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue("")
    setShowSuggestions(false)
  }

  return (
    <div className={styles.wrapper}>
      <input
        className={styles.input}
        type="text"
        value={value}
        placeholder={placeholder ?? "Skriv svaret ditt..."}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
        }}
      />
      {showSuggestions && matches.length > 0 && (
        <div className={styles.suggestions}>
          {matches.map((s) => (
            <button key={s} type="button" className={styles.suggestion} onMouseDown={() => pick(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <button className={styles.submitBtn} type="button" disabled={disabled || !value.trim()} onClick={submit}>
        Gjett
      </button>
    </div>
  )
}
