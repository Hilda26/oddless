const STEPS = [
  {
    n: "01",
    title: "Frame a binary question",
    body: "Write a question with exactly two mutually exclusive outcomes, set equal stakes, and list 2–4 public sources. Our sanity check runs before anyone stakes anything.",
    side: "a" as const,
  },
  {
    n: "02",
    title: "Get matched",
    body: "Challenge a specific wallet, or open it to whoever accepts first. The opponent automatically takes the opposite side — no side-picking after the fact.",
    side: "b" as const,
  },
  {
    n: "03",
    title: "Lock equal stake",
    body: "Both wallets fund the exact same amount of test-GEN into the vault contract. No overfunding, no unequal stakes — the duel only locks once both sides match.",
    side: "a" as const,
  },
  {
    n: "04",
    title: "GenLayer settles it",
    body: "After the event, anyone can trigger resolution. Every validator independently fetches the same public sources and checks the excerpts — not just the leader's word for it.",
    side: "b" as const,
  },
];

export function HowItWorks() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
      <h2 className="font-display text-3xl sm:text-4xl mb-12 text-center">HOW A DUEL WORKS</h2>
      <ol className="grid sm:grid-cols-2 gap-6">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className={`border-2 border-ink p-6 bg-paper halftone-shadow ${
              step.side === "a" ? "border-l-8 border-l-side-a" : "border-l-8 border-l-side-b"
            }`}
          >
            <span className="font-meta text-xs text-silver">{step.n}</span>
            <h3 className="font-display text-xl mb-2">{step.title}</h3>
            <p className="font-ui text-sm text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
