"use client"

import Link from "next/link"
import styles from "./PageShell.module.css"

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link className={styles.backLink} href="/" aria-label="Tilbake">
          ←
        </Link>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
