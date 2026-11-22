import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import Benefits from "@/components/landing/Benefits";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import ClosingCta from "@/components/landing/ClosingCta";
import LandingFooter from "@/components/landing/LandingFooter";
import { container } from "@/components/landing/styles";

/**
 * Wholly static: no client component anywhere beneath it, so the page ships as
 * markup. `tao-ground` swaps the app's dark body wash for the light palette.
 * `HowItWorks` bleeds full-width, so each band sets its own container.
 */
export default function Home() {
  return (
    <div className="tao-ground min-h-screen overflow-x-clip font-tao">
      <div className={container}>
        <LandingNav />
      </div>
      <main>
        <div className={container}>
          <LandingHero />
          <Benefits />
        </div>
        <HowItWorks />
        <div className={container}>
          <Features />
          <ClosingCta />
        </div>
      </main>
      <div className={container}>
        <LandingFooter />
      </div>
    </div>
  );
}
