"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";

export default function SearchForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [navigating, setNavigating] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!isAddress(addr)) {
      setError("That doesn't look like a wallet address. Paste the full 0x… address (42 characters).");
      return;
    }
    setError("");
    setNavigating(true);
    router.push(`/w/${addr}`);
  }

  return (
    <>
      <form className="search-form" onSubmit={submit}>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Paste a wallet address (0x…)"
          aria-label="Wallet address"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
        />
        <button type="submit" className="btn" disabled={navigating}>
          {navigating ? "Opening…" : "Track positions"}
        </button>
      </form>
      <p className="form-error" role="alert">
        {error}
      </p>
    </>
  );
}
