import { signIn } from "@/auth";

export default function LoginPage() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb", fontFamily: "Arial, sans-serif" }}>
    <section style={{ width: "min(360px, calc(100% - 40px))", padding: 32, borderRadius: 12, background: "white", boxShadow: "0 12px 40px #1d355710", textAlign: "center" }}>
      <div style={{ color: "#3477e9", fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>OBLIG</div>
      <h1 style={{ margin: "16px 0 8px", fontSize: 24, color: "#23344b" }}>Your portfolio, private.</h1>
      <p style={{ margin: "0 0 24px", color: "#8995a6", fontSize: 14 }}>Sign in to manage your bonds.</p>
      <form action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}>
        <button style={{ width: "100%", padding: "12px 16px", border: "1px solid #dfe5ed", borderRadius: 7, background: "white", color: "#34445a", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Continue with Google</button>
      </form>
    </section>
  </main>;
}
