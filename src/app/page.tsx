import { About } from "@/components/About";
import { Hero } from "@/components/Hero";
import { site } from "@/content/site";

export default function Home() {
  return (
   <main>
    <Hero role={site.role} headline={site.headline} intro={site.intro} />
    <About paragraphs={site.about} />
   </main>
  );
}
