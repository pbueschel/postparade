# Playbook: verification & release

## Branch & commits

- Work on a feature branch (e.g. `demo-refinement`). Never commit to `main`
  directly.
- Staged, logical commits (foundation / research / content — not one blob).
  Commit messages describe the contract-level change, not the diff.

## Pre-merge verification gates (all must pass)

```sh
bun test/engine-smoke.js     # engine assertions (incl. flat-spec back-compat)
bun test/app-smoke.js        # renderer + store-loop integration smoke
```

Headless-Chrome real-render checks (JS actually executes):

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for route in "dashboard" "trainer/alerts" "track/race/cd-jun6-r4" "race/cd-jun6-r4"; do
  "$CHROME" --headless=new --disable-gpu --virtual-time-budget=4000 \
    --dump-dom "file://$PWD/app.html#$route" > /tmp/dom.html 2>/dev/null
  grep -c 'card ring-soft' /tmp/dom.html               # content rendered?
  grep -c '>[^<]*undefined[^<]*<\|>NaN\|\[object' /tmp/dom.html  # must be 0
done
"$CHROME" --headless=new --disable-gpu --virtual-time-budget=4000 \
  --dump-dom "file://$PWD/tour.html" | grep -c 'Zengraya'  # tour compat gate
```

HTML tag balance for content pages:

```sh
python3 -c "
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(self): super().__init__(); self.stack=[]
    def handle_starttag(self,t,a):
        if t not in ('br','hr','img','link','meta','input'): self.stack.append(t)
    def handle_endtag(self,t):
        if self.stack and self.stack[-1]==t: self.stack.pop()
        elif t in self.stack:
            while self.stack and self.stack[-1]!=t: self.stack.pop()
            self.stack.pop()
for f in ['features.html','pitch.html','architecture.html']:
    p=P(); p.feed(open(f).read()); print(f,'unclosed:', p.stack or 'none')"
```

Manual loop test (the core demo story): Track workspace → race builder →
Request a horse → switch to Trainer → `#trainer/requests` shows it → Accept →
fill count rises on the Track side → reload page (state persists) → Reset
demo data clears it.

## Deploy

GitHub Pages serves **`main` at root** (`https://pbueschel.github.io/postparade/`).

1. Get Phil's approval to publish (everything on `main` is public by URL).
2. `git checkout main && git merge --ff-only <branch> && git push origin main`
3. Wait for Pages rebuild, then verify live:

```sh
until curl -s https://pbueschel.github.io/postparade/app.html | grep -q 'screens-trainer.js'; do sleep 5; done
for p in features pitch architecture; do
  curl -s -o /dev/null -w "$p: %{http_code}\n" https://pbueschel.github.io/postparade/$p.html
done
```

Check a marker unique to the new build in the grep (not a string that was
already live).
