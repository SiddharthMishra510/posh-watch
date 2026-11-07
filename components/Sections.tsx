export function Sections({ title, lead, sections, children }: { title: string; lead: string; sections: { h: string; p: string[] }[]; children?: React.ReactNode }) {
  return (
    <article className="prose">
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      {sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((p) => <p key={p}>{p}</p>)}
        </section>
      ))}
      {children}
    </article>
  );
}
