P='./parts/'
r=lambda n: open(P+n).read()
style = r('style.js') + """    document.head.append(style);
    document.documentElement.classList.add('marble-studio');
    marble.pageOnly('data-hint', 'data-st-empty');

"""
out = r('a-head.js') + "\n    // ---------------------------------------------------------------- styling\n\n" + style + r('b-notes.js') + r('b-versions.js') + r('d-card.js') + r('e-finder.js') + r('c-layer.js')
open('./editwire.js','w').write(out)
print(len(out.splitlines()), 'lines')
