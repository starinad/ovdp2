"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return <button className="profile" onClick={() => void signOut({ redirectTo: "/login" })}>
    <span className="avatar">↪</span>
    <span className="profile-name">Sign out<small>Google account</small></span>
    <span className="profile-chevron">⌄</span>
  </button>;
}
