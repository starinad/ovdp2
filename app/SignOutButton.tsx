"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

export default function SignOutButton({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [user, setUser] = useState<{ name?: string | null; image?: string | null } | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    fetch("/api/auth/session").then(response => response.ok ? response.json() : null).then(session => setUser(session?.user ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) menu.current?.removeAttribute("open");
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") menu.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <details className="profile-menu" ref={menu}>
    <summary className="profile" aria-label="Open profile menu">
      {user?.image ? <img className="avatar profile-photo" src={user.image} alt=""/> : <span className="avatar">{user?.name?.[0] ?? "👤"}</span>}
      <span className="profile-name">{user?.name ?? "Account"}<small>Google account</small></span>
      <span className="profile-chevron">⌄</span>
    </summary>
    <div className="profile-dropdown">
      <button onClick={() => { menu.current?.removeAttribute("open"); onOpenSettings(); }}>Settings</button>
      <button onClick={() => void signOut({ redirectTo: "/login" })}>Sign Out</button>
    </div>
  </details>;
}
