'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = (x, d = 1) => x == null ? 'n/a' : (x * 100 >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%';
const px = x => x == null ? 'n/a' : x >= 1 ? '$' + x.toLocaleString('en-US', {maximumFractionDigits: 2}) : x >= .01 ? '$' + x.toFixed(4) : '$' + x.toFixed(6);
const usd = x => x == null ? 'n/a' : (x < 0 ? '-' : '') + '$' + Math.abs(x).toLocaleString('en-US', {maximumFractionDigits: 0});
const cls = x => x == null ? '' : x >= 0 ? 'pos' : 'neg';
let ST = null, HI = null, tab = 'status', fs = 'ALL', fc = 'ALL';

async function getJSON(u) {
  try { const r = await fetch(u + '?t=' + Date.now(), {cache: 'no-store'}); if (!r.ok) throw 0; return await r.json(); } catch (e) { return null; }
}
async function load() {
  [ST, HI] = await Promise.all([getJSON('data/status.json'), getJSON('data/history.json')]);
  const gen = ST && ST.generated;
  $('#meta').textContent = gen ? '갱신 ' + new Date(gen).toLocaleString('ko-KR', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) + ' · 일봉 마감 기준(한국시간 09:00)' : '데이터 없음';
  const b = $('#banner');
  if (!ST || !ST.symbols || !ST.symbols.length) { b.hidden = false; b.textContent = '아직 데이터가 없습니다. 저장소의 자동 실행(Actions)을 한 번 실행하면 채워집니다.'; }
  else if (Date.now() - new Date(gen).getTime() > 36 * 3600 * 1000) { b.hidden = false; b.textContent = '마지막 갱신이 36시간 넘게 지났습니다. 자동 실행이 멈췄을 수 있어요. 저장소 Actions 탭을 확인하세요.'; }
  else b.hidden = true;
  if (ST && ST.skipped && ST.skipped.length) { b.hidden = false; b.textContent = '데이터를 못 가져와 제외된 종목: ' + ST.skipped.join(', ') + ' (거래소 미상장이거나 심볼이 다를 수 있어요)'; }
  render();
}
function kv(k, v, c) { return `<div class="kv"><span>${k}</span><b class="${c || ''}">${v}</b></div>`; }
function posBlock(s) {
  const p = s.position; if (!p) return '';
  return `<h3>내 보유</h3><div class="grid">${kv('보유수량', p.qty.toLocaleString('en-US', {maximumFractionDigits: 2}))}${kv('수익률', pct(p.ret), cls(p.ret))}
${kv('매수평균가', px(p.avg_usd))}${kv('현재가', px(s.close))}
${kv('매수금액', usd(p.cost_usd))}${kv('평가금액', usd(p.value_usd))}
${kv('평가손익', usd(p.pnl_usd), cls(p.pnl_usd))}${kv('내 비중', p.weight == null ? 'n/a' : Math.round(p.weight * 100) + '%')}
${kv('업비트 평균가', '₩' + p.avg_krw.toLocaleString('en-US'))}${kv('매도 알림 기준', (p.sell_pct == null ? 100 : p.sell_pct) + '% 매도')}</div>`;
}
function totalCard() {
  const L = (ST.symbols || []).filter(s => s.position); if (!L.length) return '';
  const c = L.reduce((a, s) => a + s.position.cost_usd, 0), v = L.reduce((a, s) => a + s.position.value_usd, 0);
  const fx = ST.fx && ST.fx.krw ? `환율 ₩${Math.round(ST.fx.krw).toLocaleString('en-US')}/$${ST.fx.source === 'live' ? '' : ' (고정값 사용 중)'}` : '환율 없음';
  const top = L.map(s => [s.symbol, s.position.value_usd / v]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0] + ' ' + Math.round(x[1] * 100) + '%').join(' · ');
  return `<section class="card"><h3>내 보유 합계 (달러 환산)</h3><div class="grid">${kv('매수금액', usd(c))}${kv('평가금액', usd(v))}${kv('평가손익', usd(v - c), cls(v - c))}${kv('수익률', pct(v / c - 1), cls(v - c))}</div><div class="small">비중 ${top}<br>${fx} · 매수평균가도 현재 환율로 환산해서, 당시 환율 변동과 업비트·코인베이스 가격 차이만큼 업비트 표시 수익률과 다릅니다.</div></section>`;
}
function statusCard(s) {
  const i = s.indicators || {}, inn = s.state === 'IN';
  const items = (s.next?.items || []).map(x => `<div class="it"><div class="ck ${x.ok ? 'ok' : ''}">${x.ok ? '✓' : ''}</div><div>${esc(x.label)}${x.gap != null ? ` <span class="gap">(현재 ${pct(x.gap)})</span>` : ''}${x.note ? `<div class="small">${esc(x.note)}</div>` : ''}</div></div>`).join('');
  const to = s.next?.timeout ? `<div class="small">매도 후 ${s.next.timeout.days}일이 지나면 돌파 없이도 재진입 알람 (${s.next.timeout.left}일 남음)</div>` : '';
  const A = s.A || {triggers: [], flags: []};
  const sold = !inn && s.sell_date ? `<div class="small">매도 알람 ${esc(s.sell_date)}${s.sell_price ? ' · ' + px(s.sell_price) + ' → 현재 ' + pct(s.close / s.sell_price - 1) : ''}</div>` : '';
  return `<section class="card"><div class="row"><div><span class="sym">${esc(s.symbol)}</span> <span class="chip ${inn ? 'in' : 'out'}">${inn ? '보유(IN)' : '현금 대기(OUT)'}</span></div><div class="px">${px(s.close)}</div></div>${sold}${posBlock(s)}
<h3>매도·재진입형 — ${esc(s.next?.title || '')}</h3>${items}${to}
<h3>지표 현황</h3><div class="grid">
${kv('RSI14', i.rsi == null ? 'n/a' : i.rsi.toFixed(0) + ' (5일 전 ' + (i.rsi_5d_ago == null ? 'n/a' : i.rsi_5d_ago.toFixed(0)) + ')')}${kv('EMA20 대비', pct(i.vs_ema20), cls(i.vs_ema20))}
${kv('EMA50 대비', pct(i.vs_ema50), cls(i.vs_ema50))}${kv('60일 고점 대비', pct(i.dd60), cls(i.dd60))}
${kv('BTC·EMA20', pct(i.btc_vs_ema20), cls(i.btc_vs_ema20))}${kv('BTC·EMA50', pct(i.btc_vs_ema50), cls(i.btc_vs_ema50))}
${kv('코인/BTC·EMA20', pct(i.rs_vs_ema20), cls(i.rs_vs_ema20))}${kv('EMA20 아래 알트', i.breadth_below20 == null ? 'n/a' : Math.round(i.breadth_below20 * 100) + '%')}</div>
<h3>매도전용형(참고용) — 시장 약세 ${A.count ?? 0}/${(A.flags || []).length} (2개 이상이면 후보)</h3>
<div class="tags">${(A.triggers || []).map(t => `<span class="tag ${t.on ? 'on' : ''}">${esc(t.label)}</span>`).join('')}${(A.flags || []).map(t => `<span class="tag ${t.on ? 'on' : ''}">${esc(t.label)}</span>`).join('')}</div>
${s.validated ? '' : '<div class="warn">⚠ 검증 대상 10종목 밖입니다. 규칙이 이 종목에서 검증되지 않았습니다.</div>'}</section>`;
}
function historyView() {
  const all = (HI && HI.alerts) || [];
  const syms = [...new Set(all.map(a => a.symbol))];
  const chip = (id, v, l, cur) => `<button class="f ${cur === v ? 'on' : ''}" data-f="${id}" data-v="${v}">${l}</button>`;
  const f = `<div class="filters">${chip('s', 'ALL', '전체 종목', fs)}${syms.map(s => chip('s', s, s, fs)).join('')}</div><div class="filters">${chip('c', 'ALL', '전체 분류', fc)}${chip('c', 'B', '매도·재진입형', fc)}${chip('c', 'A', '매도전용형', fc)}</div>`;
  const L = all.filter(a => (fs === 'ALL' || a.symbol === fs) && (fc === 'ALL' || a.category === fc));
  return f + (L.length ? L.map(a => `<section class="card"><div class="row"><span class="t ${a.action === 'BUY' ? 'buy' : a.category === 'A' ? 'ref' : 'sell'}">${esc(a.title)}</span></div><div class="small">${esc(a.candle_date)} 일봉 · ${px(a.price)}</div><pre>${esc(a.body)}</pre></section>`).join('') : '<div class="empty">아직 알람이 없습니다</div>');
}
function infoView() {
  const m = location.hostname.match(/^(.+)\.github\.io$/), repo = location.pathname.split('/')[1];
  const edit = m && repo ? `https://github.com/${m[1]}/${repo}/edit/main/watchlist.json` : null;
  return `<section class="card"><h3>관심종목 바꾸기</h3><div>종목은 저장소의 <b>watchlist.json</b>에서 바꿉니다. 저장하면 다음 자동 실행부터 적용돼요.</div>${edit ? `<a class="btn" href="${edit}" target="_blank" rel="noopener">관심종목 편집 열기</a>` : '<div class="small">GitHub Pages 주소에서 열면 편집 버튼이 나타납니다.</div>'}</section>
<section class="card"><h3>알람 분류</h3><ul class="l"><li><b>🔻 매도 / 🔼 재진입 · 매도·재진입형</b>: 종가가 EMA20 아래로 이탈하면 매도, 20일 최고 종가를 돌파하고 BTC가 EMA20 위면 재진입(60일 지나면 시간 만료 재진입). 과거 검증(2023~26)에서 사전 기준 통과.</li><li><b>🚪 매도 경고 · 매도전용형(참고용)</b>: EMA50/100 이탈 등 중장기 추세 이탈과 시장 약세 2/3 이상. 재진입 알람 없음. 근거 약함.</li></ul></section>
<section class="card"><h3>꼭 알아둘 것</h3><ul class="l"><li>고점 매도·저점 매수 신호가 아니라 <b>추세 추종</b>입니다. 재진입가가 매도가보다 낮았던 비율은 41%뿐이었어요.</li><li>알람을 받고 하루 늦게 체결하면 과거 성과가 크게 줄었고, 이틀 늦으면 보유보다 나빴습니다.</li><li>가격은 Coinbase USD 기준이라 국내 거래소 KRW 가격·수수료와 다릅니다.</li><li>과거 성과는 미래를 보장하지 않으며 투자 조언이 아닙니다.</li></ul></section>
<section class="card"><h3>알림이 안 올 때</h3><ul class="l"><li>텔레그램 앱의 알림 권한과 봇 대화 알림 켜기</li><li>저장소 Actions 탭에서 최근 실행이 성공했는지 확인</li><li>상단에 "갱신이 36시간 넘게 지남" 경고가 뜨면 자동 실행이 멈춘 것</li></ul></section>`;
}
function render() {
  const v = $('#view'); document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'status') v.innerHTML = (ST && ST.symbols && ST.symbols.length) ? totalCard() + ST.symbols.map(statusCard).join('') : '<div class="empty">표시할 종목이 없습니다</div>';
  else if (tab === 'history') v.innerHTML = historyView(); else v.innerHTML = infoView();
}
document.querySelector('nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; render(); scrollTo(0, 0); } });
document.addEventListener('click', e => { const b = e.target.closest('.f'); if (!b) return; if (b.dataset.f === 's') fs = b.dataset.v; else fc = b.dataset.v; render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
load();
