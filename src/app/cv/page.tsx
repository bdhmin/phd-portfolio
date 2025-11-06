import cv from '@/../public/cv.json';
import { serifCV, serif } from '@/app/fonts';
import { Fragment } from 'react';

export default function CV() {
  const publicationAbbreviations: Record<string, string> =
    cv.publications.reduce((dict, publication) => {
      publication.papers.forEach((paper, index, array) => {
        const abbr =
          publication.type[0].toUpperCase() + (array.length - index).toString();
        (dict as Record<string, string>)[paper.id] = abbr;
      });
      return dict;
    }, {} as Record<string, string>);

  console.log(publicationAbbreviations);

  return (
    <div
      className={`w-full flex flex-col gap-4 items-center text-[16px] ${serifCV.className}`}
    >
      <a
        href="/cv.pdf"
        target="_blank"
        rel="noreferrer"
        className="self-end border border-gray-400 rounded-md px-3 py-1 m-4"
      >
        PDF
      </a>

      <div className="w-full max-w-[840px] flex flex-col my-10 gap-y-6">
        {/* Name */}
        <div className="w-full flex justify-between my-4">
          <h1 className="text-5xl font-[600]">{cv.profile.name}</h1>
          <div className="flex flex-col items-end">
            <p className="">{cv.profile.email}</p>
            <a
              href={`https://${cv.profile.url}`}
              target="_blank"
              rel="noreferrer"
            >
              {cv.profile.url}
            </a>
          </div>
        </div>

        {/* Education */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">EDUCATION</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.education.map((education) => (
            <div
              key={education.name}
              className="flex flex-col justify-between my-1"
            >
              <h2 className="text-lg font-[600] mb-2">{education.name}</h2>
              <div className="flex flex-col ml-8 gap-y-2">
                {education.degrees.map((degree) => (
                  <div key={degree.name} className="flex justify-between">
                    <div>
                      <p className="font-[700]">{degree.name}</p>
                      <p className="">{degree.note}</p>
                    </div>
                    <p className="">
                      {degree.start}
                      {degree.start && degree.end ? ' - ' : ''}
                      {degree.end}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Publications */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">PUBLICATIONS</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.publications.map((publication) => (
            <div
              key={publication.type}
              className="flex flex-col justify-between my-1 mb-3"
            >
              <h2 className="text-lg font-[600] mb-2">{publication.type}</h2>
              <div className="flex flex-col gap-y-4">
                {publication.papers
                  .filter((paper) => paper.status !== 'Not Accepted Yet')
                  .map((paper, index, array) => (
                    <div
                      key={paper.id}
                      className="flex justify-between ml-4 gap-x-4"
                    >
                      <div className="w-[100px] flex justify-end leading-[1.2]">
                        {paper.year} [{publication.type[0].toUpperCase()}
                        {array.length - index}]
                      </div>
                      <div className="w-full flex flex-col gap-y-[0.1em]">
                        <p className="font-[700] leading-[1.2]">
                          {paper.status === 'published'
                            ? paper.title
                            : paper.shorttitle}
                        </p>
                        <p className="">
                          {paper.status === 'published' ? (
                            paper.authors.length === 2 ? (
                              <>
                                {paper.authors
                                  .map((author, i) =>
                                    author === 'Bryan Min' ? (
                                      <span key={author} className="font-[700]">
                                        {author}
                                      </span>
                                    ) : (
                                      <span key={author}>{author}</span>
                                    )
                                  )
                                  .reduce((prev, curr, idx) =>
                                    idx === 1 ? (
                                      <>
                                        {prev} and {curr}
                                      </>
                                    ) : (
                                      curr
                                    )
                                  )}
                              </>
                            ) : (
                              <>
                                {paper.authors.map((author, i) => (
                                  <Fragment key={author + i}>
                                    {i > 0 && ', '}
                                    {author === 'Bryan Min' ? (
                                      <b>{author}</b>
                                    ) : (
                                      author
                                    )}
                                  </Fragment>
                                ))}
                              </>
                            )
                          ) : (
                            // Not published: Only show Bryan Min in context, with ellipses as appropriate
                            (() => {
                              const idx = paper.authors.findIndex(
                                (a) => a === 'Bryan Min'
                              );
                              const isFirst = idx === 0;
                              const isLast = idx === paper.authors.length - 1;
                              const isOnly = paper.authors.length === 1;
                              if (isOnly) {
                                return <b>Bryan Min</b>;
                              } else if (isFirst) {
                                return (
                                  <>
                                    <b>Bryan Min</b>
                                    {', ...'}
                                  </>
                                );
                              } else if (isLast) {
                                return (
                                  <>
                                    {'..., '}
                                    <b>Bryan Min</b>
                                  </>
                                );
                              } else if (idx !== -1) {
                                return (
                                  <>
                                    {'..., '}
                                    <b>Bryan Min</b>
                                    {', ...'}
                                  </>
                                );
                              } else {
                                // Fallback if for some reason Bryan Min not found
                                return null;
                              }
                            })()
                          )}
                        </p>
                        <p className="italic">
                          {paper.status === 'published'
                            ? paper.venue
                            : paper.status}
                        </p>
                        <p className="font-[700] text-orange-400">
                          {paper.award.includes('Honorable Mention')
                            ? `🏅 ${paper.award}`
                            : paper.award}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Research Experience */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">
            RESEARCH EXPERIENCE
          </h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.research_experience.map((experience) => (
            <div
              key={experience.organization + experience.start + experience.end}
              className="flex justify-between my-1"
            >
              <div>
                <h2 className="font-[600]">{experience.organization}</h2>
                <p className="italic">{experience.role}</p>
                <p className="">Supervisor: {experience.supervisor}</p>
              </div>
              <div className="flex flex-col items-end">
                <p className="">
                  {experience.start} - {experience.end}
                </p>
                <p className="italic">{experience.location}</p>
                <p className="">
                  [
                  {experience.publications
                    .map(
                      (publicationId) =>
                        `${publicationAbbreviations[publicationId] ?? ''}`
                    )
                    .filter((abbr) => abbr !== '')
                    .join(', ')}
                  ]
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Professional Experience */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">
            PROFESSIONAL EXPERIENCE
          </h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.professional_experience.map((experience) => (
            <div
              key={experience.organization + experience.start + experience.end}
              className="flex justify-between my-1"
            >
              <div>
                <h2 className="font-[600]">{experience.organization}</h2>
                <p className="italic">{experience.role}</p>
              </div>
              <div className="flex flex-col items-end">
                <p className="">
                  {experience.start} - {experience.end}
                </p>
                <p className="italic">{experience.location}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Honors and Awards */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">HONORS AND AWARDS</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.honors_and_awards.map((award) => (
            <div key={award.name + award.year} className="flex justify-between">
              <div>
                <h2 className="font-[600]">
                  {award.name}{' '}
                  <span className="font-normal italic">({award.source})</span>
                </h2>
              </div>
              <div className="flex flex-col items-end">
                <p className="">{award.year}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Teaching */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">TEACHING</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.teaching.map((teaching) => (
            <div
              key={teaching.role + teaching.course}
              className="flex justify-between"
            >
              <div>
                <span className="font-[600]">{teaching.role}</span>,{' '}
                <span className="italic">{teaching.course}</span>
                {' – '}
                <span className="">{teaching.instructor}</span>
              </div>
              <div className="flex flex-col items-end">
                <p className="">{teaching.term}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mentoring */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">MENTORING</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.mentoring.map((mentoring) => (
            <div
              key={mentoring.name + mentoring.start + mentoring.end}
              className="flex justify-between"
            >
              <div>
                <span className="font-[600]">{mentoring.name}</span>{' '}
                <span className="italic">({mentoring.study})</span>
                {mentoring.now ? ` – Now: ${mentoring.now}` : ''}
              </div>
              <div className="flex flex-col items-end">
                <p className="">
                  {mentoring.start && mentoring.end
                    ? `${mentoring.start} - ${mentoring.end}`
                    : mentoring.start
                    ? mentoring.start
                    : mentoring.end}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Invited Talks */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">INVITED TALKS</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.invited_talks.map((talk) => (
            <div
              key={talk.place + talk.title}
              className="flex justify-between my-1"
            >
              <div>
                <p className="font-[600]">{talk.place}</p>
                <p className="italic">{talk.title}</p>
              </div>
              <div className="flex flex-col items-end">
                <p className="">{talk.date ? talk.date : ''}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Service */}
        <div className="w-full flex flex-col justify-between">
          <h2 className="text-2xl font-[700] capitalize">SERVICE</h2>
          <div className="border-t border-gray-400 w-full mt-1 mb-3" />
          {cv.service.map((service) => (
            <div
              key={service.name + service.start + service.end}
              className="flex justify-between my-1"
            >
              <div>
                <span className="font-[600]">{service.name}</span>{' '}
                <span className="italic">
                  {service.note ? `(${service.note})` : ''}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <p className="">
                  {service.start && service.end
                    ? `${service.start} - ${service.end}`
                    : service.start
                    ? service.start
                    : service.end}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
