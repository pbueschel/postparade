/* Shared render helpers for PostParade screens (classic script — top-level
   function declarations are intentionally global; screens modules and the
   app shell consume them). */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMoney(n) { return '$' + Math.round(+n || 0).toLocaleString(); }

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* Whole days between the demo clock (PPData.today) and an ISO date. */
function daysUntil(iso) {
  const now = new Date((window.PPData && PPData.today) || Date.now());
  return Math.ceil((new Date(iso) - now) / 86400000);
}

function furlongs(yards) {
  const f = (+yards || 0) / 220;
  const whole = Math.floor(f), frac = f - whole;
  if (frac > 0.4 && frac < 0.6) return whole + '½f';
  return (Math.round(f * 10) / 10) + 'f';
}

function toast(msg) {
  let t = document.getElementById('pp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pp-toast';
    t.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg bg-ink-900 text-white text-sm shadow-lg flex items-center gap-2 transition-opacity duration-300';
    document.body.appendChild(t);
  }
  t.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-turf-300"></i><span>${msg}</span>`;
  t.style.opacity = '1';
  lucide.createIcons();
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
}

function pill(text, cls = 'bg-slate-100 text-slate-600', icon = '') {
  const i = icon ? `<i data-lucide="${icon}" class="w-3 h-3"></i>` : '';
  return `<span class="pill ${cls}">${i}${text}</span>`;
}

/* Conic-gradient fit ring; color defaults to the active workspace accent. */
function scoreRing(fit, color) {
  const c = color || (document.body.dataset.ws === 'track' ? '#4f46e5' : '#059669');
  return `
    <div class="w-10 h-10 rounded-full score-ring flex items-center justify-center" style="--p:${+fit || 0}; --c:${c};">
      <div class="w-7 h-7 rounded-full bg-white flex items-center justify-center"><span class="text-[11px] font-bold accent-text">${Math.round(+fit || 0)}</span></div>
    </div>`;
}

/* Draw-in probability chip from PPEngine.drawIn() result (tolerates null). */
function drawInChip(d) {
  if (!d) return '';
  const map = {
    in: ['accent-soft', 'check-circle-2'],
    ae: ['bg-amber-50 text-amber-700', 'clock'],
    unlikely: ['bg-red-50 text-red-700', 'alert-triangle'],
  };
  const [cls, icon] = map[d.bucket] || map.ae;
  return `<span class="pill ${cls}" title="${esc(d.detail || '')}"><i data-lucide="${icon}" class="w-3 h-3"></i>${esc(d.label)}</span>`;
}

/* Fill-health bar state for a race: entered count vs target. */
function fillState(entered, target) {
  const t = +target || 8;
  const pct = Math.min(100, Math.round(entered / t * 100));
  if (entered >= t) return { pct, bar: 'accent-bg', pill: 'pill accent-soft', label: 'Full', note: 'Target met — field is full' };
  const short = t - entered;
  if (short <= 2) return { pct, bar: 'bg-amber-500', pill: 'pill bg-amber-50 text-amber-700', label: 'Filling', note: `${short} short of target · nearly there` };
  return { pct, bar: 'bg-red-500', pill: 'pill bg-red-50 text-red-700', label: 'Underfilled', note: `${short} short of target · needs outreach` };
}

/* Screen renderer registry: screens modules register under the resolved route
   key (the section id); the router invokes on every navigation so screens
   always reflect current PPStore state. */
window.PPRenderers = window.PPRenderers || {};

/* Adding a research-picked feature = 3 steps (see plan):
   1. sidebar <a class="nav-item" data-nav="trainer|track" href="#trainer/x">
   2. <section id="trainer/x" class="screen p-6 space-y-6"> shell in app.html
   3. PPRenderers['trainer/x'] = function () { ... } in a screens module. */
