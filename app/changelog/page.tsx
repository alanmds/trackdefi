import type { Metadata } from "next";
import Link from "next/link";
import { CHANGELOG, fmtDate, KIND_LABEL } from "../changelog";
import { NETWORK_COUNT, pageMetadata, SITE_NAME } from "../site";

export const metadata: Metadata = pageMetadata({
  path: "/changelog",
  title: "What's new — every update, dated",
  description: `Every change that reached ${SITE_NAME}, newest first: exchanges and networks added, APR improvements and maintenance, across ${NETWORK_COUNT} networks. Dated, in plain language.`,
});

export default function Changelog() {
  return (
    <main className="container prose">
      <h1>What&apos;s new</h1>
      <p className="prose-lede">
        Every change that reached the site, newest first — features, networks, exchanges and the maintenance in
        between. Dates are the day each one went live, not the day it was written.
      </p>

      <ol className="changelog">
        {CHANGELOG.map((e) => (
          <li className="changelog-entry" key={`${e.date}-${e.title}`}>
            <div className="changelog-meta">
              <time className="changelog-date" dateTime={e.date}>
                {fmtDate(e.date)}
              </time>
              <span className="badge">{KIND_LABEL[e.kind]}</span>
            </div>
            <h2 className="changelog-title">{e.title}</h2>
            <p className="changelog-body">{e.body}</p>
          </li>
        ))}
      </ol>

      <p className="prose-note">
        Where it goes next — and what will never change — is on the <Link href="/roadmap">roadmap</Link>.
      </p>

      <p className="prose-back">
        <Link href="/" className="btn">
          ← Back to search
        </Link>
      </p>
    </main>
  );
}
