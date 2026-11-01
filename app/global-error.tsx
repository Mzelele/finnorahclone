"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontFamily:"system-ui,sans-serif", textAlign:"center", padding:"1rem", background:"#fff" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>😔</div>
          <h1 style={{ fontSize:"1.5rem", fontWeight:700, marginBottom:"0.5rem", color:"#111" }}>Something went wrong</h1>
          <p style={{ color:"#666", marginBottom:"1.5rem", fontSize:"0.9rem" }}>We're sorry — an unexpected error occurred. Please try again.</p>
          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={reset} style={{ background:"#111", color:"#fff", border:"none", borderRadius:"9999px", padding:"0.6rem 1.5rem", fontWeight:600, cursor:"pointer", fontSize:"0.875rem" }}>
              Try Again
            </button>
            <a href="/" style={{ background:"#fff", color:"#333", border:"1px solid #ddd", borderRadius:"9999px", padding:"0.6rem 1.5rem", fontWeight:600, textDecoration:"none", fontSize:"0.875rem" }}>
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
