type HeroProps = {
  role: string;
  headline: string;
  intro: string;
};

export function Hero({ role, headline, intro }: HeroProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24">
      <p className="text-sm uppercase tracking-widest text-neutral-500">{role}</p>
      <h1 className="mt-4 text-4xl font-bold md:text-6xl">{headline}</h1>
      <p className="mt-6 text-lg text-neutral-600">{intro}</p>
    </section>
  );
}