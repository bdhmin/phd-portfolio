'use client';

import { useState } from 'react';

export const Tag = ({ name, children }: { name: string; children: any }) => {
  const [isHovered, setIsHovered] = useState(false);

  const linkMap: {
    [key: string]: {
      color: string;
      url: string;
    };
  } = {
    creativity: {
      color: '#9c9a99',
      url: 'https://creativity.ucsd.edu/',
    },
    ucsd: {
      color: '#00629B',
      url: 'https://ucsd.edu',
    },
    cogsci: {
      color: '#EC6556',
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
        color: isHovered ? link.color : 'initial',
        fontWeight: isHovered ? 500 : 640,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </a>
  );
};
