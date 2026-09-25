import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "../site";
import FeedbackForm from "../ui/FeedbackForm";

export const metadata: Metadata = pageMetadata({
  path: "/feedback",
  title: "Send feedback",
  description:
    "Suggest a feature, ask for a network, or tell us about a position trackdefi missed. Every message is read by a person.",
});

export default function FeedbackPage() {
  return (
    <main className="container prose">
      <h1>Send feedback</h1>
      <p className="prose-lede">
        An idea, a network or exchange you&apos;d like to see, a position we missed, a number that looks off —
        it all lands in the same inbox, and every message is read by a person.
      </p>

      <FeedbackForm />

      <p className="prose-back">
        <Link href="/" className="btn">
          ← Back to search
        </Link>
      </p>
    </main>
  );
}
