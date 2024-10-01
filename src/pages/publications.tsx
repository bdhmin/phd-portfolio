import { serif } from '@/app/fonts';
import { publications } from '@/lib/publications-data';

export default function Publications() {
  return (
    <div className="mt-20">
      <div className={`mb-6 font-semibold text-2xl ${serif.className}`}>
        Publications
      </div>
      <div className="flex flex-col gap-12 md:gap-6 px-4">
        {publications.map((publication) => (
          <div className="flex flex-col md:flex-row items-start md:items-center w-full gap-4 md:gap-8">
            <div className="max-w-[400px] md:w-[240px] md:min-w-[240px] border border-zinc-200 rounded-sm">
              <img
                className="w-full"
                src={publication.thumbnail}
                alt={publication.title}
              />
            </div>
            <div className="flex flex-col gap-1 w-full">
              <h3 className="text-[1.05rem] leading-snug font-[570]">
                {publication.title ? (
                  <>
                    {publication.title}: {publication.subtitle}
                  </>
                ) : (
                  <>{publication.subtitle}</>
                )}
                {/* {publication.title ? (
                  <>
                    <b>{publication.title}</b>:{' '}
                    <span className="font-[480]">{publication.subtitle}</span>
                  </>
                ) : (
                  <span className="font-[480]">{publication.subtitle}</span>
                )} */}
              </h3>
              <div className="">
                {publication.authors.map((author, index) => (
                  <>
                    <span
                      style={{ fontWeight: author === 'Bryan Min' ? 640 : 400 }}
                    >
                      {author}
                    </span>
                    {index < publication.authors.length - 1 ? ', ' : null}
                  </>
                ))}
              </div>
              <div className="h-[6px]" />
              <div className="flex gap-4">
                <h5 className="">{publication.venue}</h5>
                <h5 className="font-semibold text-[#f19a21]">
                  {publication.award}
                </h5>
              </div>
              <div className="flex gap-4">
                {publication.resources.length === 0 ? (
                  <p>Coming Soon</p>
                ) : (
                  publication.resources.map((resource) => (
                    <a
                      className="text-zinc-400 hover:text-zinc-700 hover:font-[640] transition-all"
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
  );
}
