"use client";

/** Last-resort error screen when the root layout itself fails (no fonts/CSS guaranteed, so inline styles). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#faf7f2", color: "#1b1a18", fontFamily: "Georgia, serif", textAlign: "center", padding: "1.5rem" }}>
        <div>
          <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12, color: "#7d602d", fontFamily: "system-ui, sans-serif" }}>Seamwell Tailoring</p>
          <h1 style={{ fontSize: 40, margin: "0.5rem 0" }}>A stitch came loose.</h1>
          <p style={{ color: "#6f6a61", fontFamily: "system-ui, sans-serif" }}>Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ marginTop: 24, minHeight: 44, padding: "0 1.5rem", borderRadius: 999, border: 0, background: "#1f2a44", color: "#faf7f2", fontSize: 15, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
