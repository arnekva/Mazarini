import "./backtowork.css"

const NOTES = [
  { text: "Møte 09:00", className: "btwNote1" },
  { text: "Svar på 214 e-poster", className: "btwNote2" },
  { text: "Neste ferie: om 10 mnd 🥲", className: "btwNote3" },
]

export function BackToWorkDecor() {
  return (
    <div data-theme-decor="backtowork">
      {NOTES.map((note) => (
        <span key={note.className} className={`btwNote ${note.className}`}>
          {note.text}
        </span>
      ))}
      {/* A wall clock whose hands are in rather too much of a hurry. */}
      <div className="btwClock">
        <span className="btwHand btwHour" />
        <span className="btwHand btwMinute" />
      </div>
      <span className="btwDesk btwCalendar">📅</span>
      <span className="btwDesk btwCoffee">
        ☕
        <span className="btwSteam btwSteam1" />
        <span className="btwSteam btwSteam2" />
        <span className="btwSteam btwSteam3" />
      </span>
    </div>
  )
}
