import { About } from '@/pages/about';
import { Publications } from '@/pages/publications';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen ">
      <main className="max-w-[960px] w-full flex-1 flex flex-col gap-20 p-8 pt-20 lg:p-20items-start">
        <About />
        <Publications />
      </main>
      <footer className="flex flex-wrap items-center justify-center p-4">
        Last Updated: September 26, 2024
      </footer>
    </div>
  );
}
