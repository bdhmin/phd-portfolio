import { serif } from '@/app/fonts';
import Tag from '@/components/tag';
import Link from '@/assets/link.svg';

export default function About() {
  return (
    <div className="flex flex-col gap-6">
      <div className="px-4 w-full flex flex-col md:flex-row gap-8 justify-start">
        <div className="flex flex-col items-center gap-2">
          <div className="max-w-[380px] min-w-[130px] w-full md:min-w-[240px] md:w-[240px] md:h-[280px] rounded-sm overflow-hidden">
            <img
              className="w-full h-full object-cover"
              src="portrait/portrait2023-1sq.JPEG"
              alt="A medium close-up portrait photo of Bryan Min"
            />
          </div>
          <div className="w-fit flex flex-row gap-6 my-2 mx-4">
            {[
              {
                name: 'Scholar',
                link: 'https://scholar.google.com/citations?user=12yN6_gAAAAJ&hl=en',
              },
              {
                name: 'Github',
                link: 'https://github.com/bdhmin',
              },
              {
                name: 'Twitter',
                link: 'https://twitter.com/BryanDMin',
              },
            ].map((url) => (
              <a
                className="group flex flex-row items-center gap-[4px] hover:text-zinc-400 transition"
                href={url.link}
              >
                {url.name}
                <span className="opacity-100 group-hover:opacity-30 transition">
                  <Link />
                </span>
              </a>
            ))}
          </div>
          {/* <p>bdmin@ucsd.edu</p> */}
        </div>
        <div className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className={`font-semibold text-4xl ${serif.className}`}>
              Bryan Min
            </h1>
          </div>
          <div className="mt-4">
            I am dissatisfied with the limited capabilities end-users have to
            interact with their software. I believe end-users need{' '}
            <i>greater control</i> over their interfaces in a more{' '}
            <i>frictionless</i> and <i>in-situ</i> manner.
          </div>
          <div>
            To achieve this, I believe end-users need{' '}
            <b>malleable interfaces</b>
            —interfaces that allow them to easily, expressively, and broadly
            customize their software without code or bloated lists of settings.
            Additionally, they need <b>user-defined abstractions</b>
            —abstractions that end-users can form to view exactly the details
            and representations they need. I am exploring ways to fulfill these
            needs by investigating interface design patterns and developing
            novel interaction techniques to support tasks in diverse domains,
            including sensemaking, information management, and generative AI
            interaction.
          </div>
          <div className="flex flex-col gap-6">
            <p>
              I'm a first-year Ph.D. student at{' '}
              <Tag name="ucsd">UC San Diego</Tag> in the{' '}
              <Tag name="cogsci">Cognitive Science Department</Tag> doing
              research in Human-Computer Interaction. I work with{' '}
              <b>Haijun Xia</b> as a member of the{' '}
              <Tag name="creativity">Foundation Interface Lab</Tag>.
            </p>
          </div>
          <p>
            You can reach me via email:{' '}
            <span className="font-semibold">bdmin@ucsd.edu</span>
          </p>

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
