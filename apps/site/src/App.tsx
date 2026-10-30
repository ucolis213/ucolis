import { Carriers } from './sections/Carriers';
import { Coverage } from './sections/Coverage';
import { Download } from './sections/Download';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { Navbar } from './sections/Navbar';
import { Pro } from './sections/Pro';
import { Simulator } from './sections/Simulator';
import { Stats } from './sections/Stats';
import { Stories } from './sections/Stories';
import { Tracking } from './sections/Tracking';
import { Trust } from './sections/Trust';

export function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <Simulator />
        <Tracking />
        <Trust />
        <Carriers />
        <Pro />
        <Coverage />
        <Stories />
        <Faq />
        <Download />
      </main>
      <Footer />
    </>
  );
}
