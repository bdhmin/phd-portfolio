import About from '@/pages/about';
import Contact from '@/pages/contact';
import Publications from '@/pages/publications';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen">
      <main className="max-w-[960px] w-full flex-1 flex flex-col p-8 pt-12 lg:pt-20 lg:p-20items-start">
        <About />
        {/* <Contact /> */}
        <Publications />
      </main>
      <footer className="flex flex-wrap items-center justify-center p-8 text-zinc-400 dark:text-zinc-600">
        Last Updated: November 6, 2025
      </footer>
    </div>
  );
}
