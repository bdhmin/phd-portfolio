'use client';

import { serif } from '@/app/fonts';
import { papers } from '@/lib/publications-data';
import { useEffect, useState } from 'react';

export default function Publications() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window !== 'undefined') {
      const darkMode =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(darkMode);
    }
  }, []);

  const paperOrganization = [
    {
      name: 'Publications',
      papers: papers.filter((paper) => paper.type === 'publication'),
    },
    {
      name: 'Posters, Demos, and Workshop Papers',
      papers: papers.filter((paper) => paper.type !== 'publication'),
    },
  ];

  const topicOrganization = [
    {
      name: 'Malleable Interfaces',
      papers: papers.filter((paper) => paper.tags.includes('malleable')),
    },
    {
      name: 'Human-AI Interaction',
      papers: papers.filter((paper) => paper.tags.includes('human-ai')),
    },
  ];

  return (
    <div className="flex flex-col gap-20 mt-16">
      {paperOrganization.map((topic) => (
        <div>
          <div className={`mb-6 font-semibold text-xl ${serif.className}`}>
            {topic.name}
          </div>
          <div className="flex flex-col gap-12 md:gap-6">
            {topic.papers.map((publication) => (
              <div
                key={publication.title + publication.subtitle}
                className="flex flex-col md:flex-row items-center md:items-center w-full gap-4 md:gap-8"
              >
                <div className="max-w-[360px] md:w-[400px] md:min-w-[200px]  overflow-hidden rounded-sm">
                  <img
                    className="w-full"
                    src={publication.thumbnail}
                    alt={publication.title}
                  />
                </div>

                <div className="flex flex-col gap-1 w-full">
                  <div className="w-full sm:flex flex-wrap text-[13px] text-zinc-500 items-center gap-4">
                    <h5 className="">{publication.venue}</h5>
                    <h5 className="font-semibold text-[#f19a21]">
                      {publication.award}
                    </h5>
                  </div>
                  <h3
                    className={`text-[1rem] leading-snug font-semibold my-1`}
                    // className={`text-[1rem] leading-snug font-medium my-1 ${serif.className}`}
                  >
                    {publication.title && publication.subtitle ? (
                      <>
                        {publication.title}: {publication.subtitle}
                      </>
                    ) : publication.title ? (
                      <>{publication.title}</>
                    ) : (
                      <>{publication.subtitle}</>
                    )}
                  </h3>
                  <div className="text-[13px]">
                    {publication.authors.map((author, index) => (
                      <>
                        <span
                          style={{
                            fontWeight: author === 'Bryan Min' ? 600 : 400,
                          }}
                        >
                          {author}
                        </span>
                        {index < publication.authors.length - 1 ? ', ' : null}
                      </>
                    ))}
                  </div>
                  {/* <div className="h-[2px]" /> */}
                  <div className="flex gap-4 text-[13px]">
                    {publication.resources.length === 0 ? (
                      <p className="text-zinc-400">Coming Soon</p>
                    ) : (
                      publication.resources.map((resource) => (
                        <a
                          className={`text-zinc-500 hover:${
                            isDarkMode ? 'text-white' : 'text-zinc-600'
                          } hover:text-zinc-800 transition-all`}
                          key={resource.type}
                          // style={{ pointerEvents: '' }}
                          href={resource.link}
                          target="_blank"
                          rel={`${
                            resource.type === 'Paper' ? 'noopener' : ''
                          } noreferrer`}
                        >
                          {resource.type}
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
