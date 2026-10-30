export function PageHero({ title, intro }: { title: string; intro?: string | null }) {
  return (
    <section className="border-b bg-gradient-to-br from-secondary to-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {intro && <p className="mt-2 max-w-3xl text-muted-foreground">{intro}</p>}
      </div>
    </section>
  );
}
