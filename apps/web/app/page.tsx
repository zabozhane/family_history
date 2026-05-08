// Server component — anonymous landing page.
// TODO(T12): replace with a proper home/dashboard once the timeline ships.
import Link from "next/link";

import { ghostButton, heading, link, pageWrap } from "../lib/styles";

export default function HomePage() {
  return (
    <main style={pageWrap}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ ...heading, fontSize: "2rem", marginBottom: "0.75rem" }}>
          Family Media System
        </h1>
        <p style={{ opacity: 0.7, marginBottom: "2rem" }}>
          Private family media + digital memory platform.
        </p>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/login" style={link}>
            <button style={ghostButton}>Sign in</button>
          </Link>
          <Link href="/register" style={link}>
            <button style={ghostButton}>Create account</button>
          </Link>
          <Link href="/me" style={link}>
            <button style={ghostButton}>My profile</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
