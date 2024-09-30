import { serif } from '@/app/fonts';
import { Tag } from '@/components/tag';

export const About = () => {
  return (
    <div className="flex flex-col gap-6">
      <div className="w-full flex flex-col md:flex-row gap-12 justify-start">
        <div className="max-w-[320px] min-w-[130px] w-full lg:min-w-[220px] lg:w-[220px] lg:h-[260px] rounded-sm overflow-hidden">
          <img
            className="w-full h-full object-cover"
            src="portrait/portrait2023-1sq.JPEG"
            alt="A medium close-up portrait photo of Bryan Min"
          />
          {/* <p>Contact me here: bdmin@ucsd.edu</p> */}
        </div>
        <div className="w-full flex flex-col gap-6">
          <div className={`font-semibold text-4xl ${serif.className}`}>
            Bryan Min
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <p>
                I'm a first-year PhD student at{' '}
                <Tag name="ucsd">UC San Diego</Tag> doing research in
                Human-Computer Interaction. I work with <b>Haijun Xia</b> as a
                member of the <Tag name="creativity">Creativity Lab</Tag>.
              </p>
            </div>
          </div>
          <p>
            My goal is to give end-users more control over their interface.
            End-users should be able to <b>easily</b>, <b>expressively</b>, and{' '}
            <b>broadly</b> customize their interface, without complex code or
            searching for settings in a bloated settings panel. I explore novel
            interaction techniques in foundational design patterns that gives
            end-users this control to customize their interface. These
            techniques could either be supported by direct manipulation or
            natual language queries to AI.
          </p>
        </div>
      </div>
    </div>
  );
};
