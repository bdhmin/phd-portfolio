#!/usr/bin/env python3
"""Update the live portfolio.mrbl (already on editwire): python3 assemble3.py IN OUT"""
import sys, re
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
editor = open('./editwire.js').read()
def rep(a, b):
    global s
    n = s.count(a)
    assert n == 1, f'expected 1, found {n}: {a[:90]!r}'
    s = s.replace(a, b)

# The page measures the room it is given, not the window: in the drive the
# header, sidebar and docked chat take part of the window, and a layout that
# asked the window would lay out for space it does not have. Published, the
# page is the whole window and the two answers are the same.
if 'container: page' not in s:
    rep('  .page { display: flex; flex-direction: column; align-items: center; min-height: 100vh; }',
        '''  /* The layout asks how wide the page is, not the window: inside Marble Drive
     the header, sidebar and a docked chat take part of the window (and say how
     much in --marble-shell-top). Published, the page is the window, so both
     answers are the same. */
  .page {
    display: flex; flex-direction: column; align-items: center;
    min-height: calc(100vh - var(--marble-shell-top, 0px));
    container: page / inline-size;
  }''')
    css_end = s.index('</style>')
    head, rest = s[:css_end], s[css_end:]
    head = re.sub(r'@media \(min-width: (768|1024)px\)', r'@container page (min-width: \1px)', head)
    s = head + rest

start = s.index('<script data-marble-id="editwire">')
end = s.index('</script>', start) + len('</script>')
s = s[:start] + '<script data-marble-id="editwire">\n' + editor + '</script>' + s[end:]
open(out, 'w').write(s)
print('ok', len(s.encode()))
