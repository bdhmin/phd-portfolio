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
      name: 'Human-AI Collaboration',
      papers: papers.filter((paper) => paper.tags.includes('human-ai')),
    },
  ];

  return (
    <div className="flex flex-col gap-20 mt-20">
      {topicOrganization.map((paper) => (
        <div>
          <div className={`mb-6 font-semibold text-2xl ${serif.className}`}>
            {paper.name}
          </div>
          <div className="flex flex-col gap-12 md:gap-6 px-4">
            {paper.papers.map((publication) => (
              <div
                key={publication.subtitle}
                className="flex flex-col md:flex-row items-center md:items-center w-full gap-4 md:gap-8"
              >
                <div className="max-w-[400px] md:w-[240px] md:min-w-[240px] border border-zinc-200 overflow-hidden rounded-sm">
                  <img
                    className="w-full"
                    src={publication.thumbnail}
                    alt={publication.title}
                  />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <h3 className="text-[1.05rem] leading-snug font-[570]">
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
                  <div className="">
                    {publication.authors.map((author, index) => (
                      <>
                        <span
                          style={{
                            fontWeight: author === 'Bryan Min' ? 640 : 400,
                          }}
                        >
                          {author}
                        </span>
                        {index < publication.authors.length - 1 ? ', ' : null}
                      </>
                    ))}
                  </div>
                  <div className="h-[6px]" />
                  <div className="w-full sm:flex flex-wrap items-center gap-4">
                    <h5 className="">{publication.venue}</h5>
                    <h5 className="font-semibold text-[#f19a21]">
                      {publication.award}
                    </h5>
                  </div>
                  <div className="flex gap-4">
                    {publication.resources.length === 0 ? (
                      <p className="text-zinc-400">Coming Soon</p>
                    ) : (
                      publication.resources.map((resource) => (
                        <a
                          className={`text-zinc-400 hover:${
                            isDarkMode ? 'text-white' : 'text-zinc-700'
                          } hover:font-[640] transition-all`}
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
