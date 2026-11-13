type AboutProps = {
  paragraphs: string[];
}; 

export function About({paragraphs}: AboutProps){
    return(
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-2xl font bold">About</h2>
        {paragraphs.map((text)=> (
            <p key={text} className="mt-4">{text}</p>
        ))}

      </section>
    );
}