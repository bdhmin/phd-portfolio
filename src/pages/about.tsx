import { serif } from '@/app/fonts';
import Tag from '@/components/tag';
import Link from '@/assets/link.svg';

export default function About() {
  const academicLinks = [
    {
      name: 'bdmin@ucsd.edu',
      link: '',
    },
    {
      name: 'CV',
      link: 'https://drive.google.com/file/d/1QRxHPrn_d2tv947H3nf4uCfPLgEtRXHn/view?usp=sharing',
    },
  ];

  const socialLinks = [
    {
      name: 'Google Scholar',
      link: 'https://scholar.google.com/citations?user=12yN6_gAAAAJ&hl=en',
    },
    {
      name: 'GitHub',
      link: 'https://github.com/bdhmin',
    },
    {
      name: 'X',
      link: 'https://twitter.com/bryandhmin',
    },
  ];

  const Links = ({ links }: { links: { name: string; link: string }[] }) => {
    return (
      <div className="flex flex-col flex-wrap justify-start gap-x-8 gap-y-1 md:gap-1 text-zinc-500 md:mx-2 md:border-none md:text-black">
        {/* <div className="w-fit flex flex-row flex-wrap gap-6 my-2"> */}
        {links.map((url) =>
          !url.name ? (
            <div className="h-[1px] bg-zinc-200 my-2" />
          ) : url.link ? (
            <a
              className="w-fit group flex flex-row items-center gap-[4px] hover:text-zinc-400 transition"
              href={url.link}
              target="_blank"
              rel="noreferrer"
            >
              {url.name}
              <span className="opacity-50 md:opacity-100 group-hover:opacity-30 transition">
                <Link />
              </span>
            </a>
          ) : (
            <p className="w-fit group flex flex-row items-center gap-[4px] transition">
              {url.name}
            </p>
          )
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full flex flex-col md:flex-row gap-8 justify-start">
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-row gap-4">
            <div className="min-w-[200px] w-[200px] h-[240px] rounded-sm overflow-hidden">
              <img
                className="w-full h-full object-cover"
                src="portrait/portrait2023-1sq.JPEG"
                alt="A medium close-up portrait photo of Bryan Min"
              />
            </div>
            <div className="flex flex-col justify-start block md:hidden gap-6 my-2 pr-4">
              <Links links={[...academicLinks, ...socialLinks]} />
            </div>
          </div>

          <div className="hidden md:block mt-2 w-full">
            <Links links={academicLinks} />
            <div className="h-[1px] bg-zinc-200 my-2" />
            <Links links={socialLinks} />
          </div>
        </div>
        <div className="w-full flex flex-col gap-5 text-[15px]">
          <div className="flex flex-col gap-2">
            <h1 className={`font-semibold text-4xl ${serif.className}`}>
              Bryan Min
            </h1>
          </div>
          <p>
            I'm a first-year Ph.D. student at{' '}
            <Tag name="ucsd">UC San Diego</Tag> in the{' '}
            <Tag name="cogsci">Cognitive Science Department</Tag> doing research
            in Human-Computer Interaction. I work with{' '}
            <Tag name="haijun">Prof. Haijun Xia</Tag> as part of the{' '}
            <Tag name="creativity">Foundation Interface Lab</Tag>.
          </p>
          {/* <p>
            My research centers on the question:{' '}
            <b>
              How can we enable end users to <u>easily</u> customize their
              interfaces?
            </b>
          </p> */}
          <p>
            My research centers on <b>malleable interfaces</b>—interfaces that
            enable users to easily, expressively, and broadly customize their
            software interface without code or bloated lists of settings.
            Specifically, I'm exploring how users can create custom, personal
            abstractions of information through the interface. I analyze design
            patterns, develop interaction techniques, and create theoretical
            frameworks for bringing malleable interfaces to more end-users.
          </p>

          <div className="mt-4 flex flex-col gap-1 border-t border-zinc-200 pt-2">
            <h2 className="font-semibold underline text-[16px]">News</h2>
            <p>
              <span className="font-semibold mr-2">Sept 28~Oct 1</span> I am
              attending UIST 2025 in Busan, South Korea to present{' '}
              <span className="font-semibold">Meridian</span>.
            </p>
          </div>

          {/* <div className="flex flex-col">
            <p>bdmin@ucsd.edu</p>
            <p>Github</p>
            <p>Google Scholar</p>
            <p>Twitter</p>
          </div> */}
        </div>
      </div>
    </div>
  );
}

{
  /* <b>
              I envision end-users will be in greater control over their
              software interfaces, particularly in a frictionless and in-situ
              manner.
            </b>{' '} */
}

// that <b>interfaces must be malleable</b>
//             To achieve this vision, I primarily investigate three domains:
//             <div className="flex flex-wrap justify-center gap-3 my-2">
//               {[
//                 'Malleable Interfaces',
//                 'User-Defined Abstractions',
//                 'Human-AI Collaboration',
//               ].map((domain) => (
//                 <div className="px-3 py-[0.5] font-medium bg-zinc-200 rounded-sm">
//                   {domain}
//                 </div>
//               ))}
//             </div>
//             1. Malleability, 2. User-Defined Abstractions, and 3. Human-AI
//             Interaction. pushing for interfaces to be <b>malleable</b>
//             —ones where end-users can easily, expressively, and broadly
//             customize without code or bloated lists of settings. I am also
//             pushing for end-users to be able to{' '}
//             <b>form their own abstractions</b> in interfaces. —ones where
//             end-users can easily, expressively, and broadly customize without
//             complex code or a bloated settings panel. To achieve this, I'm
//             exploring novel interaction techniques in foundational design
//             patterns that give end-users this <i>easy malleability</i> to
//             customize their interface. I Regardless, these techniques should be
//             seamless and in-situ such that the user feels minimal friction.
