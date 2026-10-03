
    // ------------------------------------------------------------ the finder

    // A paper you have published exists somewhere else in full, so typing it
    // out field by field is copying by hand. The card's finder takes anything
    // you remember — a title, a DOI or arXiv link, a few words and a co-author —
    // and looks it up: Crossref (asked for papers with your name on them),
    // Semantic Scholar and OpenAlex, your own papers ranked first. Picking a
    // hit fills the card's fields; the fields are still what Add writes, so a
    // wrong guess is one correction away. "Ask an agent" goes further, through
    // one of the drive's agents searching the web the way you would. The same
    // finder lives in the CV (cv.mrbl); this one writes venues and links the
    // way this page writes them: "UIST 2025", "arXiv (May 2026)", "DOI".

    const STOP = new Set([
      'the', 'and', 'for', 'with', 'from', 'into', 'via', 'paper', 'using', 'our', 'about',
      'that', 'this', 'its', 'are', 'was', 'proceedings', 'conference', 'acm', 'ieee',
      'symposium', 'annual', 'international', 'best', 'award', 'honorable', 'mention', 'demo', 'poster',
    ]);
    const norm = (s) =>
      String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const keywords = (s) => norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
    const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    function sameName(a, b) {
      const x = norm(a).split(' ');
      const y = norm(b).split(' ');
      if (!x[0] || !y[0]) return false;
      if (x.join(' ') === y.join(' ')) return true;
      return x.at(-1) === y.at(-1) && x[0][0] === y[0][0];
    }
    const isMe = (name) => sameName(name, me());

    const VENUES = ['UIST', 'CHI', 'IUI', 'ICER', 'CSCW', 'DIS', 'C&C', 'VL/HCC', 'TOCHI', 'IMWUT', 'UbiComp', 'TEI', 'VIS', 'arXiv'];
    const VENUE_HINTS = [
      [/user interface software/i, 'UIST'],
      [/human factors in computing/i, 'CHI'],
      [/intelligent user interfaces/i, 'IUI'],
      [/computing education research/i, 'ICER'],
      [/designing interactive systems/i, 'DIS'],
      [/creativity (and|&) cognition/i, 'C&C'],
      [/visual languages/i, 'VL/HCC'],
      [/transactions on computer.human interaction/i, 'TOCHI'],
      [/interactive, mobile, wearable/i, 'IMWUT'],
      [/computer.supported cooperative|acm on human.computer interaction/i, 'CSCW'],
      [/\barxiv\b/i, 'arXiv'],
    ];
    function acronymOf(...names) {
      for (const name of names.flat()) {
        if (!name) continue;
        const bare = String(name).replace(/\s*'?\d{2,4}\s*$/, '').trim();
        const known = VENUES.find((v) => v.toLowerCase() === bare.toLowerCase());
        if (known) return known;
        const hint = VENUE_HINTS.find(([re]) => re.test(name));
        if (hint) return hint[1];
      }
      return null;
    }

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // The venue line the way this page already writes it.
    function venueLine({ acronym, year, month, name }) {
      if (acronym === 'arXiv') return month && year ? `arXiv (${MONTHS[month - 1]} ${year})` : `arXiv${year ? ` (${year})` : ''}`;
      if (acronym) return `${acronym}${year ? ` ${year}` : ''}`;
      const short = stripTags(name).replace(/^proceedings of the\s+/i, '');
      return [clip(short, 48), year].filter(Boolean).join(' ');
    }

    function linksOf(hit) {
      const out = [];
      const arxiv = hit.arxiv || /^10\.48550\/arxiv\.(.+)$/i.exec(hit.doi ?? '')?.[1];
      if (hit.doi && !/^10\.48550\//i.test(hit.doi)) out.push({ label: 'DOI', href: `https://doi.org/${hit.doi}` });
      else if (arxiv) out.push({ label: 'DOI', href: `https://arxiv.org/abs/${arxiv}` });
      if (hit.pdf) out.push({ label: 'Paper', href: hit.pdf });
      else if (arxiv) out.push({ label: 'Paper', href: `https://arxiv.org/pdf/${arxiv}` });
      if (hit.url && !out.some((l) => l.href === hit.url) && !/doi\.org|arxiv\.org/.test(hit.url)) out.push({ label: 'Website', href: hit.url });
      return out;
    }

    async function getJson(url, ms = 9000) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), ms);
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(res.status === 429 ? 'busy' : `HTTP ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    }

    const fromCrossrefItem = (it) => ({
      title: stripTags(it.title?.[0]),
      authors: (it.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name).filter(Boolean),
      year: it.issued?.['date-parts']?.[0]?.[0] ?? it.published?.['date-parts']?.[0]?.[0] ?? null,
      month: it.issued?.['date-parts']?.[0]?.[1] ?? null,
      acronym: acronymOf(it.event?.acronym, it['container-title']?.[0], it.event?.name, it.institution?.[0]?.name),
      name: it['container-title']?.[0] ?? it.event?.name ?? '',
      doi: it.DOI ?? null,
    });
    const fromCrossref = (data) =>
      (data?.message?.items ?? [])
        .filter((it) => !['component', 'peer-review', 'dataset', 'grant'].includes(it.type))
        .map(fromCrossrefItem);
    const fromOpenAlex = (data) =>
      (data?.results ?? []).map((w) => {
        const where = w.primary_location ?? {};
        const name = where.source?.display_name ?? where.raw_source_name ?? '';
        return {
          title: stripTags(w.title),
          authors: (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean),
          year: w.publication_year ?? null,
          month: Number(String(w.publication_date ?? '').slice(5, 7)) || null,
          acronym: acronymOf(name),
          name,
          doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : null,
          pdf: w.open_access?.oa_url && /\.pdf($|\?)/.test(w.open_access.oa_url) ? w.open_access.oa_url : null,
        };
      });
    const fromS2Paper = (p) => ({
      title: stripTags(p.title),
      authors: (p.authors ?? []).map((a) => a.name).filter(Boolean),
      year: p.year ?? null,
      month: Number(String(p.publicationDate ?? '').slice(5, 7)) || null,
      acronym: acronymOf(p.publicationVenue?.alternate_names ?? [], p.venue, p.publicationVenue?.name, p.externalIds?.ArXiv && !p.venue ? 'arXiv' : null),
      name: p.venue || p.publicationVenue?.name || '',
      doi: p.externalIds?.DOI ?? null,
      arxiv: p.externalIds?.ArXiv ?? null,
      pdf: p.openAccessPdf?.url || null,
    });
    const fromSemanticScholar = (data) => (data?.data ?? []).map(fromS2Paper);
    const S2_FIELDS = 'title,authors,year,venue,publicationVenue,externalIds,publicationDate,openAccessPdf';

    // How well a record answers what was typed: mostly how much of its title
    // you said, a little for co-authors you named, and a real lift if it is
    // yours — this is your site.
    function rank(hit, text) {
      const said = new Set(keywords(text).filter((w) => !/^\d+$/.test(w)));
      const title = keywords(hit.title);
      if (!title.length) return 0;
      const inTitle = title.filter((w) => said.has(w)).length;
      const overlap = inTitle / Math.max(1, Math.min(said.size, title.length));
      const cover = inTitle / title.length;
      const surnames = hit.authors.filter((a) => said.has(norm(a).split(' ').at(-1))).length;
      let score = 0.6 * overlap + 0.4 * cover + Math.min(0.15, 0.05 * surnames);
      if (hit.mine) score += 0.3;
      return score;
    }

    const onPage = () => new Set([...document.querySelectorAll('article.paper h3')].map((h) => norm(textOf(h))));

    async function lookUp(text) {
      const q = text.trim();
      const doi = /\b(10\.\d{4,9}\/[^\s"<>]+)/.exec(q)?.[1]?.replace(/[.,;)]+$/, '');
      const arxiv = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})|^\s*(?:arxiv:)?([0-9]{4}\.[0-9]{4,5})(?:v\d+)?\s*$/i.exec(q);
      const arxivId = arxiv?.[1] ?? arxiv?.[2];
      let asks;
      // A DOI or an arXiv id names one paper: ask for it, not for a search.
      if (doi && !/^10\.48550\//i.test(doi)) {
        asks = [['Crossref', (d) => [fromCrossrefItem(d.message)], `https://api.crossref.org/works/${encodeURIComponent(doi)}`]];
      } else if (arxivId || doi) {
        const id = arxivId ?? doi.replace(/^10\.48550\/arxiv\./i, '');
        asks = [['Semantic Scholar', (d) => [fromS2Paper(d)], `https://api.semanticscholar.org/graph/v1/paper/arXiv:${id}?fields=${S2_FIELDS}`]];
      } else {
        const loose = encodeURIComponent(q.slice(0, 300));
        asks = [
          ['Crossref', fromCrossref,
            `https://api.crossref.org/works?query.bibliographic=${loose}&query.author=${encodeURIComponent(me())}` +
            `&rows=8&select=DOI,title,author,container-title,event,issued,published,type`],
          ['Semantic Scholar', fromSemanticScholar,
            `https://api.semanticscholar.org/graph/v1/paper/search?query=${loose}&limit=6&fields=${S2_FIELDS}`],
          ['OpenAlex', fromOpenAlex,
            `https://api.openalex.org/works?search=${loose}&per-page=6` +
            `&select=title,publication_year,publication_date,authorships,primary_location,doi,open_access`],
        ];
      }
      const exact = asks.length === 1;
      const settled = await Promise.allSettled(asks.map(([, read, url]) => getJson(url).then(read)));
      const failed = [];
      const byTitle = new Map();
      settled.forEach((result, i) => {
        const source = asks[i][0];
        if (result.status === 'rejected') { failed.push(source); return; }
        for (const hit of result.value) {
          if (!hit.title) continue;
          hit.mine = hit.authors.some(isMe);
          const key = norm(hit.title);
          const held = byTitle.get(key);
          if (!held) { byTitle.set(key, { ...hit, sources: [source] }); continue; }
          // The same paper from two indexes: keep what each knows.
          held.sources.push(source);
          held.mine ||= hit.mine;
          if (!held.acronym && hit.acronym) Object.assign(held, { acronym: hit.acronym, name: hit.name });
          held.doi ||= hit.doi;
          held.arxiv ||= hit.arxiv;
          held.pdf ||= hit.pdf;
          held.month ||= hit.month;
        }
      });
      const listed = onPage();
      const hits = [...byTitle.values()]
        .map((hit) => ({ ...hit, score: exact ? 1 : rank(hit, q), listed: listed.has(norm(hit.title)) }))
        // A record sharing one word with what you typed is noise, not a lead.
        .filter((hit) => hit.score >= 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
      return { hits, failed, asked: asks.length };
    }

    // ---- asking an agent
    //
    // The indexes answer in a second but only know what they index. For the
    // rest the finder hands the question to one of the drive's agents, in one
    // conversation kept for this ("Portfolio · Paper finder") so you can open
    // it and watch. What it sends back is a list of papers, not an edit.

    const AGENT_KEY = 'portfolio:finder-agent';
    const AGENT_SEQ = 'portfolio:finder-agent-seq';
    const remembered = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
    const remember = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };

    async function drive(url, init = {}) {
      const res = await fetch(url, {
        credentials: 'same-origin',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
      return body;
    }

    async function finderConversation() {
      const kept = remembered(AGENT_KEY);
      if (kept) {
        try {
          const { meta } = await drive(`/agent/conversations/${kept}?after=${Number(remembered(AGENT_SEQ)) || 0}`);
          if (meta && !meta.archived) return kept;
        } catch (err) {
          if (err.status !== 404) throw err;
        }
      }
      const made = await drive('/agent/conversations', {
        method: 'POST',
        body: JSON.stringify({ provider: 'claude-subscription', model: 'sonnet', effort: 'medium' }),
      });
      await drive(`/agent/conversations/${made.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Portfolio · Paper finder' }),
      }).catch(() => {});
      remember(AGENT_KEY, made.id);
      remember(AGENT_SEQ, 0);
      return made.id;
    }

    function agentPrompt(text) {
      return [
        `Find a paper for ${me()}'s academic website. What they typed about it:`,
        `"""${text}"""`,
        `Search the web for it — Google Scholar, the ACM Digital Library, DBLP, arXiv, Semantic Scholar — and work out which paper they mean. Prefer papers ${me()} is an author of.`,
        'Do not edit any document or file. Do not ask questions. Reply with nothing but one fenced ```json block of this shape:',
        '{"papers":[{"title":"","authors":["Given Family"],"year":2025,"month":5,"venue_acronym":"UIST","venue":"full venue name","doi":"","arxiv":"","pdf":"","url":"","award":"","mine":true}]}',
        'Best match first, at most 5. Authors complete and in published order. "award" only if the paper won one (e.g. "Best Paper"), otherwise "".',
      ].join('\n\n');
    }

    function papersIn(texts) {
      for (const text of [...texts].reverse()) {
        const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
        const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        try {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : parsed.papers;
          if (Array.isArray(list)) return list;
        } catch {}
      }
      return null;
    }

    const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
    function describeStep(event) {
      if (event.type === 'turn.queued') return 'Waiting for the agent…';
      if (event.type === 'turn.started') return 'The agent is on it…';
      if (event.type !== 'tool.call') return null;
      const input = event.input ?? {};
      if (/^web_?search$/i.test(event.name) && input.query) return `Agent searching “${input.query}”`;
      if (/^web_?fetch$/i.test(event.name) && input.url) return `Agent reading ${hostOf(input.url)}…`;
      return 'The agent is working…';
    }

    async function askAgent(text, { onStep, stillWanted }) {
      const id = await finderConversation();
      const { turnId } = await drive(`/agent/conversations/${id}/turns`, {
        method: 'POST',
        body: JSON.stringify({ prompt: agentPrompt(text), context: { viewing: marble.app, target: marble.app, surface: 'chat' } }),
      });
      let after = Number(remembered(AGENT_SEQ)) || 0;
      const said = [];
      const started = Date.now();
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!stillWanted()) {
          drive(`/agent/turns/${turnId}/cancel`, { method: 'POST' }).catch(() => {});
          throw Object.assign(new Error('stopped'), { stopped: true });
        }
        if (Date.now() - started > 5 * 60_000) throw new Error('it took longer than five minutes');
        const { events = [] } = await drive(`/agent/conversations/${id}?after=${after}`);
        for (const event of events) {
          after = Math.max(after, event.seq ?? 0);
          if (event.turn !== turnId) continue;
          const step = describeStep(event);
          if (step) onStep(step);
          if (event.type === 'text') said.push(String(event.text ?? ''));
          if (event.type === 'turn.failed') throw new Error(event.error || 'its turn failed');
          if (event.type === 'turn.removed') throw Object.assign(new Error('stopped'), { stopped: true });
          if (event.type === 'turn.completed') {
            remember(AGENT_SEQ, after);
            const papers = papersIn(said);
            if (!papers) throw new Error('it answered, but not with a list of papers');
            const listed = onPage();
            return papers.filter((p) => p && p.title).map((p) => {
              const authors = (Array.isArray(p.authors) ? p.authors : String(p.authors ?? '').split(/\s*,\s*/)).map(String).filter(Boolean);
              return {
                title: stripTags(p.title), authors,
                year: Number(p.year) || null, month: Number(p.month) || null,
                acronym: acronymOf(p.venue_acronym, p.venue), name: p.venue ?? '',
                doi: p.doi ? String(p.doi).replace(/^https?:\/\/doi\.org\//, '') : null,
                arxiv: p.arxiv || null, pdf: p.pdf || null, url: p.url || null,
                award: p.award ? String(p.award).replace(/[^\p{L}\p{N}\s&'-]/gu, '').trim() : '',
                mine: Boolean(p.mine) || authors.some(isMe), sources: ['Agent'],
                listed: listed.has(norm(p.title)),
              };
            });
          }
        }
        remember(AGENT_SEQ, after);
      }
    }
