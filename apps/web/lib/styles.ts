// TODO(T12): replace these inline-style atoms with Tailwind + shadcn/ui.
import type { CSSProperties } from "react";

export const card: CSSProperties = {
  width: "100%",
  maxWidth: 380,
  padding: "1.75rem 1.75rem 2rem",
  background: "#141418",
  border: "1px solid #232329",
  borderRadius: 12,
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
};

export const pageWrap: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem 1rem",
};

export const heading: CSSProperties = {
  fontSize: "1.5rem",
  margin: "0 0 0.25rem",
};

export const subtle: CSSProperties = {
  margin: 0,
  marginBottom: "1.5rem",
  opacity: 0.65,
  fontSize: "0.9rem",
};

export const label: CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  opacity: 0.7,
  marginBottom: 6,
};

export const input: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  marginBottom: "1rem",
  background: "#0b0b0d",
  color: "#e8e8ea",
  border: "1px solid #2a2a32",
  borderRadius: 8,
  fontSize: "0.95rem",
  outline: "none",
};

export const primaryButton: CSSProperties = {
  width: "100%",
  padding: "0.7rem",
  background: "#3b82f6",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
};

export const ghostButton: CSSProperties = {
  background: "transparent",
  color: "#9aa0aa",
  border: "1px solid #2a2a32",
  padding: "0.5rem 0.9rem",
  borderRadius: 8,
  fontSize: "0.9rem",
  cursor: "pointer",
};

export const errorBox: CSSProperties = {
  padding: "0.6rem 0.75rem",
  margin: "0 0 1rem",
  background: "#3a1414",
  color: "#fca5a5",
  border: "1px solid #5b1f1f",
  borderRadius: 8,
  fontSize: "0.85rem",
};

export const link: CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
};
