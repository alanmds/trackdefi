"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { localePath } from "../i18n/config";
import { useI18n } from "../i18n/provider";

export default function SearchForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const { locale, ui } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [navigating, setNavigating] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!isAddress(addr)) {
      setError(ui.search.invalid);
      return;
    }
    setError("");
    setNavigating(true);
    router.push(localePath(locale, `/w/${addr}`));
  }

  return (
    <>
      <form className="search-form" onSubmit={submit}>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          /* teclado do iPhone: sem maiúscula nem correção automática — um
             endereço digitado com uma letra trocada de caixa falha no checksum
             e o site diria "isso não parece um endereço" */
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="go"
          autoFocus={autoFocus}
          placeholder={ui.search.placeholder}
          aria-label={ui.search.aria}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
        />
        <button type="submit" className="btn" disabled={navigating}>
          {navigating ? ui.search.opening : ui.search.submit}
        </button>
      </form>
      <p className="form-error" role="alert">
        {error}
      </p>
    </>
  );
}
