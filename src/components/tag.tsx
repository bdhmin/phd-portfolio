'use client';

import { useState } from 'react';

export default function Tag({
  name,
  children,
}: {
  name: string;
  children: any;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isDarkMode =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const linkMap: {
    [key: string]: {
      color: string;
      url: string;
    };
  } = {
    creativity: {
      color: isDarkMode ? '#D7CAC3' : '#A19792',
      url: 'https://creativity.ucsd.edu/',
    },
    ucsd: {
      color: isDarkMode ? '#54AEE2' : '#00629B',
      url: 'https://ucsd.edu',
    },
    cogsci: {
      color: isDarkMode ? '#F48175' : '#EC6556',
      url: 'https://cogsci.ucsd.edu/graduates/phd-program/index.html',
    },
    masonview: {
      color: '#f0b051',
      url: 'https://creativity.ucsd.edu/masonview',
    },
    'masonview-uist23': {
      color: '#f0b051',
      url: 'https://programs.sigchi.org/uist/2023/program/content/127104/',
    },
  };

  const link = linkMap[name];

  return (
    <a
      className="font-[640] transition-all duration-[0.2s]"
      href={link.url}
      target="_blank"
      rel="noreferrer"
      style={{
        color: isHovered ? link.color : '',
        fontWeight: isHovered ? 500 : 640,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </a>
  );
}
