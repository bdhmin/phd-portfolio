import { serif } from '@/app/fonts';
import Tag from '@/components/tag';

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
          {/* <p>bdmin@ucsd.edu</p> */}
        </div>
        <div className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className={`font-semibold text-4xl ${serif.className}`}>
              Bryan Min
            </h1>
          </div>
          <div className="flex flex-col gap-6">
            <p>
              I'm a first-year PhD student at{' '}
              <Tag name="ucsd">UC San Diego</Tag> in the{' '}
              <Tag name="cogsci">Department of Cognitive Science</Tag> doing
              research in Human-Computer Interaction. I work with{' '}
              <b>Haijun Xia</b> as a member of the{' '}
              <Tag name="creativity">Creativity Lab</Tag>.
            </p>
          </div>
          <p>
            My goal is to give end-users more control over their interface.
            End-users should be able to <b>easily</b>, <b>expressively</b>, and{' '}
            <b>broadly</b> customize their interface, without complex code or
            searching for settings in a bloated settings panel. I explore novel
            interaction techniques in foundational design patterns that gives
            end-users this control to customize their interface. These
            techniques could either be supported by direct manipulation or
            natural language queries to AI.
          </p>
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
