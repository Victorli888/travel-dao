import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import HowItWorks from "@/components/landing/HowItWorks";
import LandingFooter from "@/components/landing/LandingFooter";

/**
 * Wholly static: no client component anywhere beneath it, so the page ships as
 * markup. `tao-ground` swaps the app's dark body wash for the light palette.
 */
export default function Home() {
  return (
    <main className="tao-ground min-h-screen font-tao">
      <div className="mx-auto w-full max-w-[72rem] px-5 sm:px-8">
        <LandingNav />
        <LandingHero />
        <HowItWorks />
        <LandingFooter />
      </div>
    </main>
  );
}
