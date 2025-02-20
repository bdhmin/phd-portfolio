import { serif } from '@/app/fonts';
import { papers } from '@/lib/publications-data';

export default function Contact() {
  return (
    <div className="mt-10 flex flex-col justify-center">
      {/* <div className={`mb-6 font-semibold text-2xl ${serif.className}`}>
        Contact
      </div> */}
      {/* <h3>Office Hours</h3> */}
      <div className="px-4">
        {/* <div className="flex flex-col">
          <h3 className="text-[1rem] font-semibold">Office Hours</h3>
          <ul className="px-4">
            <li>Wednesday 4pm~5pm</li>
            <li>Thursday 10am~11am</li>
          </ul>
        </div> */}

        <p>
          Reach out to me via email: <b>bdmin@ucsd.edu</b>
        </p>
        {/* <div className="flex gap-10">
          <p>Github</p>
          <p>Google Scholar</p>
          <p>Twitter</p>
        </div> */}
      </div>
    </div>
  );
}
