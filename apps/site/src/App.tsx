import { useEffect, useState } from 'react';
import { legalDocFromHash } from './legal';
import { RouteProvider } from './route';
import { Carriers } from './sections/Carriers';
import { Coverage } from './sections/Coverage';
import { Download } from './sections/Download';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { LegalPage } from './sections/LegalPage';
import { MobileCta } from './sections/MobileCta';
import { Navbar } from './sections/Navbar';
import { Pro } from './sections/Pro';
import { Simulator } from './sections/Simulator';
import { Stats } from './sections/Stats';
import { Stories } from './sections/Stories';
import { Tracking } from './sections/Tracking';
import { Trust } from './sections/Trust';

/** « #/cgu » ouvre un document légal ; toute autre adresse affiche la page d'accueil. */
function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const legal = legalDocFromHash(hash);

  // En revenant d'un document légal vers une section (« #faq »), la section n'existait pas encore au moment
  // du saut : on y descend une fois la page d'accueil affichée.
  useEffect(() => {
    if (legal || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [legal, hash]);

  return (
    <RouteProvider>
      <Navbar />
      {legal ? (
        <LegalPage doc={legal} />
      ) : (
        <main>
          <Hero />
          <Stats />
          <HowItWorks />
          <Tracking />
          <Features />
          <Simulator />
          <Trust />
          <Coverage />
          <Carriers />
          <Pro />
          <Stories />
          <Faq />
          <Download />
        </main>
      )}
      <Footer />
      {!legal && <MobileCta />}
    </RouteProvider>
  );
}
