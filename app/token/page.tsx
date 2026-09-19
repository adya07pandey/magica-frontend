"use client";

import { useAuth } from "@clerk/nextjs";

export default function TokenPage() {
  const { getToken } = useAuth();

  async function showToken() {
    const token = await getToken();
    console.log(token);
  }

  return (
    <button onClick={showToken}>
      Get Token
    </button>
  );
}