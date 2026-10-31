'use strict';
// 개발용 밸런스 시뮬레이터 (게임에서 불러오지 않음). game.js를 그대로 불러와 봇이 수천 판을 플레이합니다.
// 사용 예: node tools/sim.js --games 1000 --seasons 3 --bot attentive
//          node tools/sim.js --games 400 --bot attentive --tune '{"limitBase":5}'
//          node tools/sim.js --games 600 --all            (전략 5가지를 한 번에 비교)
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ----- 재미 지표와 목표 범위 (AGENTS.md 8장과 같게 유지) -----
const TARGETS = {
  attentive: [
    ['decisionWeeks', '할 일이 있는 주', 55, 75, '%'],
    ['newsPerWeek', '주당 소식', 0.4, 1.0, ''],
    ['overloadWeeks', '소식 3건 이상 쌓인 주', 0, 10, '%'],
    ['apUse', 'AP 사용률', 35, 80, '%'],           // AP는 소식이 몰리는 주에만 모자라면 충분
    ['renewRate', '재계약 성공률', 55, 75, '%'],
    ['recruitRate', '영입 성공률', 40, 60, '%'],
    ['lostAny', '선수를 1명 이상 잃은 게임', 20, 40, '%'],
    ['bankrupt', '파산한 게임', 0, 2, '%'],
    ['transferS1', '1시즌 안에 첫 이적', 60, 100, '%'],
    ['callupAny', '국가대표 소집이 있었던 게임', 20, 50, '%'], // 돈 위주 봇 기준. 작은 나라 선수를 노리면 더 높음
    ['dreamAny', '꿈의 구단 이적이 있었던 게임', 10, 25, '%'],
    ['transfersPerSeason', '시즌당 이적', 0.8, 2, '건'],
    ['consentAvg', '이적 제안 평균 선수 동의', 35, 60, '%'],
    ['foundS1', '1시즌 안에 회사 설립', 50, 90, '%'],
    ['firstInvestS1', '설립 뒤 1시즌 안에 첫 투자', 60, 100, '%'],
    ['soloBusy', '혼자일 때 할 일이 있는 주', 45, 75, '%'],
    ['bondHigh', '남은 선수 중 유대 60 이상', 30, 70, '%'],
    ['tales', '3시즌 동안 관계 이야기', 6, 20, '개'],
    ['lateShare', '마감 주에 온 이적 제안', 15, 40, '%'],    // 9단계: 마감일 막판 제안이 몰리는 느낌 (마감 주는 이적 기간 17주 중 2주)
    ['investLevels', '투자 단계 (10단계 중)', 3, 7, ''],
    ['spendShare', '번 돈 중 투자·아이템에 쓴 비율', 40, 85, '%'],
    ['deficitWeeks', '투자 유지비 때문에 적자인 주', 0, 3, '%'],
    // 18단계: 지킬 만할 때만 약속하면 대부분 지키지만 5번 중 1번 이상은 못 지키게. 지키면 유대 +6, 못 지키면 -10, 거절은 -2라
    // 지킬 확률이 50%를 넘을 때만 약속하는 것이 맞는 답이고, 그렇게 고르면 지킨 비율은 50%보다 꽤 높음 (처음 목표 50~65%는 이와 맞지 않았음)
    ['vowKept', '약속을 지킨 비율', 60, 80, '%']
  ],
  passive: [['bankrupt', '파산한 게임', 80, 100, '%'], ['lostAll', '선수를 다 잃은 게임', 80, 100, '%']],
  // 대충 하는 봇: 선수를 잘 잃고, 약속은 아무렇게나 해서 절반도 못 지킴 (약속을 가려서 하는 실력이 보이게)
  careless: [['lostAny', '선수를 1명 이상 잃은 게임', 60, 100, '%'], ['vowKept', '약속을 지킨 비율', 0, 50, '%']]
};

// ----- game.js 불러오기 (저장·화면은 끔) -----
// vm 대신 함수로 감싸서 불러옴: game.js의 전역이 함수 안 지역 변수가 되어 반복문이 빨라짐
// P19 재미 지표용 두 가지를 더함 (game.js 파일은 그대로, 불러온 글에만 씀):
// - vary가 고른 문장 번호를 기록 (반복 지표: 같은 소식 종류에서 상황 글·선수의 말 조합을 이미 봤는지)
// - probe(ev, i, runs): 답 i를 고른 결과(만족·유대·법인 자금·평판)를 runs번 굴려 평균을 내고 상태를 되돌림 (뻔한 답 지표).
//   세계 배열(153,312명)은 복사하지 않고 소속 선수의 폼만 되돌림 (답이 바꾸는 세계 배열은 폼뿐). 첫 난수는 층을 나눠 고르게(답 하나에 확률 하나인 경우 정확), 나머지는 고정 시드
const VARY_SRC = 'const vary = (d, lines, salt = 0) => lines[hash((d && d.v) || 0, salt) % lines.length](d);';
function loadGame() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  if (!raw.includes(VARY_SRC)) throw new Error('game.js의 vary가 바뀌어 반복 지표를 잴 수 없습니다. tools/sim.js의 VARY_SRC를 고치세요.');
  const src = raw.replace(VARY_SRC, 'const vary = (d, lines, salt = 0) => { const i = hash((d && d.v) || 0, salt) % lines.length; if (__varied.on) __varied.push(`${salt}.${i}`); return lines[i](d); };');
  const noop = () => {};
  const stubs = {
    localStorage: { getItem: () => null, setItem: noop }, window: { addEventListener: noop, scrollTo: noop },
    document: { addEventListener: noop, getElementById: () => null, querySelectorAll: () => [] },
    history: { replaceState: noop, pushState: noop, back: noop }, confirm: () => true,
    console: { ...console, assert: noop, warn: noop }, __varied: []
  };
  const factory = new Function(...Object.keys(stubs), `${src}
    ;saveState = () => {};
    const variety = ev => {
      const type = EVENT_TYPES[ev.type];
      const p = getPlayer(ev.s);
      const c = clientOf(ev.s);
      __varied.length = 0;
      __varied.on = true;
      try { type.text(p, ev.d, c); if (type.quote) type.quote(p, ev.d, c); } finally { __varied.on = false; }
      return ev.type + ':' + __varied.join(',');
    };
    const probe = (ev, index, runs) => {
      const out = { sat: 0, bond: 0, money: 0, rep: 0 };
      const rnd = Math.random;
      for (let j = 0; j < runs; j++) {
        const keep = {};
        // 뉴스·기록은 맨 앞에 더하기만 해서 배열만 복사 (가장 큰 두 개라 시간이 절반쯤 줄어듦)
        for (const k of Object.keys(state)) if (k !== 'world' && k !== 'tierOf' && k !== 'clients') keep[k] = k === 'news' || k === 'logs' ? state[k].slice() : structuredClone(state[k]);
        const own = state.clients.map(c => [c, structuredClone(c), state.world.form[c.s]]);
        let first = true;
        let seed = j * 7919 + 1;
        Math.random = () => {
          if (first) return (first = false), (j + 0.5) / runs;
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        const cash0 = state.agencyCash;
        const rep0 = state.rep;
        try {
          resolveEvent(ev.id, index, true);
          const c = clientOf(ev.s); // 선수를 잃으면 만족·유대 0으로 셈
          out.sat += c ? c.sat : 0;
          out.bond += c ? c.bond : 0;
          out.money += state.agencyCash - cash0;
          out.rep += state.rep - rep0;
        } finally {
          Math.random = rnd;
          Object.assign(state, keep);
          state.clients = own.map(([c, snap, form]) => {
            for (const key of Object.keys(c)) if (!(key in snap)) delete c[key];
            state.world.form[c.s] = form;
            return Object.assign(c, snap);
          });
          applyLoans();
        }
      }
      for (const k of Object.keys(out)) out[k] /= runs;
      return out;
    };
    return { get state() { return state; }, variety, probe, todoList, TUNE, SLOTS, EVENT_TYPES, RENEW_LEVELS, RENEW_YEARS, newGame, advanceWeek, getPlayer, ageOf, valueOf,
      weeklyWage, commissionOf, clientIncome, clientLimit, recruit, recruitBlock, recruitChance, recruitCost, renew, renewBlock, renewTerms,
      meet, meetBlock, resolveEvent, offerFit, offerCut, counterChance, clientOf, absWeek,
      INVEST_KEYS, ITEMS, investSteps, investUpkeep, upkeepNow, weeklySpend, invest, downgrade, dividendRoom, afterTax, payDividend, inject, buyItem, netWorth,
      potRange, scout, scoutBlock, toggleWatch, cooldownKey, foundBlock, foundAgency, windowAt, isFreeAgent, pitch, pitchBlock, CLUBS, clubLevel, loan, loanBlock, loanClubs, loanFit, buyWish,
      homeClub, vowOn, vowTermsOk, vowOutlook, vowClubKeeps };`);
  return factory(...Object.values(stubs));
}

// ----- 봇 -----
// P19 사람 같은 봇: human(이적·완전 이적 제안은 동의 50% 이상이면 수락 아니면 거절, 소식의 15%는 넘김, 면담은 할 일 줄에 뜰 때만),
// greedy(법인 자금이 가장 많이 남는 답, 같으면 성실한 봇의 답), skipper(소식의 80%를 넘김). 그 밖의 행동은 성실한 봇과 같음
// 넘긴 소식은 답하지 않고 두어서 기한이 지나면 게임이 기본 답으로 처리함
const SKIP = { human: 0.15, skipper: 0.8 };
const LIKE_ATTENTIVE = new Set(['attentive', 'human', 'greedy', 'skipper']);

// 뻔한 답 판정 (17단계 리뷰 4장 첫 문단): 답마다 결과를 굴려 본 평균(만족·유대·법인 자금·평판)에서
// 어느 면에서도 다른 답보다 나쁘지 않은 답이 있고 그 답의 AP·돈을 낼 수 있으면 "뻔한 답". 그런 답이 AP 때문에 막혔으면 apShort
// 바로 생기는 결과만 셈 (약속을 지키거나 어긴 결과처럼 나중에 오는 것은 안 셈)
const PROBE_RUNS = 12;
function judge(G, ev, ok) {
  const type = G.EVENT_TYPES[ev.type];
  const fx = type.options.map((_, i) => G.probe(ev, i, PROBE_RUNS));
  const dims = ['sat', 'bond', 'money', 'rep'];
  const eps = { sat: 0.01, bond: 0.01, money: 1, rep: 0.01 };
  const top = fx.findIndex((a, i) => fx.every((b, j) => i === j || dims.every(d => a[d] >= b[d] - eps[d])));
  const opt = type.options[top];
  const apShort = top >= 0 && !ok(top) && Boolean(opt.ap) && G.state.ap < opt.ap;
  return { fx, obvious: top >= 0 && ok(top), apShort };
}

// 소식 답: 성실한 봇은 상황을 보고 고름, 대충 하는 봇은 아무거나
// 그 답을 지금 고를 수 있는지 (AP·돈)
function pickable(G, ev) {
  const st = G.state;
  const c = G.clientOf(ev.s);
  const type = G.EVENT_TYPES[ev.type];
  return i => {
    const o = type.options[i];
    if (!o) return false;
    const cost = o.cost ? o.cost(ev.d, c) : 0;
    return !(o.ap && st.ap < o.ap) && (cost <= 0 || cost <= st.agencyCash); // 게임과 같게: 비용 없는 답은 자금이 마이너스여도 고름
  };
}

function answer(G, bot, ev, judged) {
  const c = G.clientOf(ev.s);
  const p = G.getPlayer(ev.s);
  const type = G.EVENT_TYPES[ev.type];
  const ok = pickable(G, ev);
  if (bot === 'careless') {
    const opts = type.options.map((_, i) => i).filter(ok);
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : type.def;
  }
  if (bot === 'greedy') {
    const kind = attentiveAnswer(G, ev, c, p, type, ok);
    const opts = type.options.map((_, i) => i).filter(ok);
    if (!opts.length) return kind;
    const most = Math.max(...opts.map(i => judged.fx[i].money));
    return judged.fx[kind] && ok(kind) && judged.fx[kind].money >= most - 1 ? kind : opts.find(i => judged.fx[i].money >= most - 1);
  }
  if (bot === 'human' && (ev.type === 'offer' || ev.type === 'buy')) return G.offerFit(p, ev.d).consent >= 50 ? 0 : 2;
  return attentiveAnswer(G, ev, c, p, type, ok);
}

function attentiveAnswer(G, ev, c, p, type, ok) {
  const st = G.state;
  // 관계 이야기: 성실한 봇은 할 수 있으면 가장 따뜻한 답(0번), 아니면 다음 답
  if (type.tale) return ok(0) ? 0 : ok(1) ? 1 : type.def;
  switch (ev.type) {
    case 'offer': {
      const fit = G.offerFit(p, ev.d);
      // 18단계: 지키는 중인 약속을 이 제안으로 지킬 수 있으면 동의가 조금 낮아도 받아들임
      const keeps = G.vowOn(c) && G.vowTermsOk(c, p, G.CLUBS[ev.d.club], ev.d.wage, ev.d.years || 3);
      if (fit.consent >= 55 || (keeps && fit.consent >= 40)) return 0;
      if (fit.consent >= 40 && G.counterChance() >= 55) return 1;
      return 2;
    }
    // 18단계 약속: 지킬 수 있어 보일 때만 약속함 (주급·안정은 맞는 재계약의 구단 수락 40% 이상(결렬돼도 이적으로 지킬 길이 있어서),
    // 출전은 기한이 든 이적 기간 임대 후보의 선수 동의 40% 이상, 큰 무대는 닿는 구단의 20% 이상이 큰 무대, 고향은 닿는 고향 구단 8곳 이상)
    case 'promise': {
      const o = G.vowOutlook(c, p, ev.d.k, ev.d.until);
      const k = ev.d.k;
      const hope = k === 'money' || k === 'stable' || k === 'play' ? o.n >= 40 : k === 'stage' ? o.total > 0 && o.n / o.total >= 0.2 : o.n >= 8;
      return hope ? 0 : 1;
    }
    // 17단계 임대 뒤 완전 이적: 선수 동의 55% 이상이면 받아들이고(남고 싶거나 반반인 선수), 아니면 돌아오게 함(돌아오고 싶은 선수).
    // --no-buy면 늘 돌아오게 하는 봇과 비교
    case 'buy': return !workerData.noBuy && G.offerFit(p, ev.d).consent >= 55 ? 0 : 2;
    case 'playtime': return ok(0) ? 0 : 1;
    case 'sns': return st.agencyCash > 20000 && ok(1) ? 1 : ok(0) ? 0 : 2;
    case 'injury': return ok(0) ? 0 : 1;
    case 'interview': return ok(0) ? 0 : 1;
    case 'ask': return ok(0) ? 0 : 1; // 이적 요청: AP가 있으면 새 구단을 알아봄, 없으면 남자고 설득
    case 'poach': return ok(0) ? 0 : ok(1) ? 1 : 2;
    default: return 0;
  }
}

// 재계약: 성공 확률 × (선수 만족 변화 + 10)이 가장 큰 조건
// 18단계: 주급·안정 약속을 지키는 중이면 약속을 지키는 조건 중 구단 수락이 가장 높은 것
function bestRenew(G, c, p) {
  if (G.vowOn(c) && (c.vow.k === 'money' || c.vow.k === 'stable')) {
    let keep = null;
    for (let level = 0; level < G.RENEW_LEVELS.length; level++) {
      for (const years of G.RENEW_YEARS) {
        const t = G.renewTerms(c, p, level, years);
        if (G.vowTermsOk(c, p, G.homeClub(c.s), t.wage, years) && (!keep || t.chance > keep.chance)) keep = { level, years, chance: t.chance };
      }
    }
    if (keep) return keep;
  }
  let best = null;
  for (let level = 0; level < G.RENEW_LEVELS.length; level++) {
    for (const years of G.RENEW_YEARS) {
      const t = G.renewTerms(c, p, level, years);
      const score = t.chance * (t.satGain + 10);
      if (!best || score > best.score) best = { level, years, score };
    }
  }
  return best;
}

// 영입 대상: 무작위 250명(+ 관심 목록) 중 전략 점수가 가장 높은 선수
// 유망주 봇은 진짜 잠재력을 모르고 보이는 범위만 씀: optimistic이면 범위 위쪽, 아니면 가운데로 점수를 매김
function pickTarget(G, bot, optimistic, skip, forScout) {
  let best = null;
  let bestScore = 0;
  const pool = Array.from({ length: 250 }, () => Math.floor(Math.random() * G.SLOTS));
  if (bot === 'youth') for (const key of G.state.watch) pool.push(Number(key.split('-')[0]));
  for (const s of pool) {
    if (skip && skip.has(s)) continue;
    const p = G.getPlayer(s);
    if (forScout ? G.scoutBlock(p) : G.recruitBlock(p)) continue; // 스카우트용이면 한도가 차도 고름
    const age = G.ageOf(p);
    const chance = G.recruitChance(p) / 100;
    const gain = G.commissionOf(G.weeklyWage(p.ability)) - 50;
    let score;
    if (bot === 'youth') {
      const [lo, hi] = G.potRange(p);
      const pot = optimistic ? hi : (lo + hi) / 2;
      score = age <= 21 && pot - p.ability >= 10 ? chance * (pot - 40) : 0;
    } else if (bot === 'veteran') score = age >= 26 ? chance * gain - G.recruitCost(p) / 52 : 0; // 영입 비용도 따짐 (혼자 시작하면 돈이 적음)
    else score = chance * (gain + G.valueOf(p) * 0.0005) - G.recruitCost(p) / 52;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

// 유망주 봇: 진짜 잠재력은 모르고 보이는 범위만 씀
// 1) 자리가 있으면: 범위 위쪽으로 가장 좋아 보이는 후보를 고르고, 범위가 넓으면(폭 4 초과) 스카우트, 좁으면 가운데 값으로 판단해 영입
// 2) 자리가 없어도 남는 AP로 주 1번: 확인된 유망주(폭 4 이하, 가운데 값이 능력 +10 이상)가 관심 목록에 6명보다 적으면 스카우트
//    좁혀 보니 기대보다 낮은 선수는 관심 목록에서 뺌
function youthRecruit(G, m) {
  const st = G.state;
  const useScout = !workerData.noScout;
  const skip = new Set();
  let scouted = false;
  const mid = p => G.potRange(p).reduce((a, b) => a + b) / 2;
  const narrow = p => G.potRange(p)[1] - G.potRange(p)[0] <= 4;
  const good = p => mid(p) - p.ability >= 10;
  const doScout = s => {
    G.scout(s);
    m.scouts += 1;
    scouted = true;
    if (!st.watch.includes(G.cooldownKey(G.getPlayer(s))) && st.watch.length < G.TUNE.watchMax) G.toggleWatch(s);
  };
  for (let tries = 0; tries < 8 && st.ap > 0 && st.clients.length < G.clientLimit() && st.agencyCash > 2000; tries++) {
    // 스카우트할 사람은 범위 위쪽으로(좋을 수도 있는 선수), 영입할 사람은 범위 가운데로 고름 (위쪽으로 고르면 운 좋게 넓은 범위만 뽑힘)
    if (useScout && st.ap >= 2) {
      const t = pickTarget(G, 'youth', true, skip);
      if (t !== null && !narrow(G.getPlayer(t)) && !G.scoutBlock(G.getPlayer(t))) {
        doScout(t);
        continue;
      }
    }
    const s = pickTarget(G, 'youth', false, skip);
    if (s === null) break;
    const p = G.getPlayer(s);
    if (!good(p)) {
      if (st.watch.includes(G.cooldownKey(p))) G.toggleWatch(s);
      skip.add(s);
      continue;
    }
    m.recruitTry += 1;
    if (G.ageOf(p) <= 21) {
      m.youthTry += 1;
      m.youthPotSum += p.pot;
      m.youthMissSum += Math.abs(p.pot - mid(p));
    }
    G.recruit(s);
  }
  if (!useScout || st.ap < 1) return scouted;
  const watched = st.watch.map(key => G.getPlayer(Number(key.split('-')[0])));
  for (const p of watched) if (narrow(p) && !good(p)) G.toggleWatch(p.s);
  if (watched.filter(p => narrow(p) && good(p)).length >= 6) return scouted;
  let target = watched.find(p => st.watch.includes(G.cooldownKey(p)) && !narrow(p) && !G.scoutBlock(p));
  if (!target) {
    const s = pickTarget(G, 'youth', true, skip, true);
    target = s === null ? null : G.getPlayer(s);
  }
  if (target) doScout(target.s);
  return scouted;
}

function botWeek(G, bot, m) {
  const st = G.state;
  if (bot === 'passive') return false;
  // 회사 설립: 조건(평판·자금·수수료 ≥ 회사 운영비)을 채우면 바로 세움. 한 번뿐인 결정이라 "할 일"에는 넣지 않음
  if (!st.founded && !G.foundBlock()) {
    G.foundAgency();
    m.foundWeek = m.weeks + 1;
  }
  let acted = false;
  for (const ev of [...st.events]) {
    // 넘긴 소식은 기한까지 그대로 두므로 다음 주에도 보임: 넘길지는 처음 볼 때 한 번 정하고, 넘긴 소식은 다시 보지 않음
    if (m.skipped.has(ev.id)) continue;
    const fresh = !m.seen.has(ev.id);
    m.seen.add(ev.id);
    if (fresh) {
      // 반복: 같은 종류의 소식에서 상황 글·선수의 말 조합을 이 게임에서 이미 봤는지
      m.eventsSeen += 1;
      const key = G.variety(ev);
      if (m.combos.has(key)) m.repeats += 1;
      else m.combos.add(key);
      if (SKIP[bot] && Math.random() < SKIP[bot]) {
        m.skipped.add(ev.id);
        continue;
      }
    }
    const type = G.EVENT_TYPES[ev.type];
    if (type.tale) {
      m.tales += 1;
      m.taleKinds[ev.type] = (m.taleKinds[ev.type] || 0) + 1;
      if (ev.type === 'junior') m.juniors += 1;
    }
    if (ev.type === 'offer') {
      m.offers += 1;
      m.consentSum += G.offerFit(G.getPlayer(ev.s), ev.d).consent;
      if (ev.d.late) m.lateOffers += 1;
      if (ev.d.from === 'pitch') m.pitchOffers += 1;
      // 9단계 확인용: 이적 기간이 아닌데 계약 중인 선수에게 온 제안 (0이어야 함, 지난주에 온 제안이 남은 경우는 뺌)
      const c = G.clientOf(ev.s);
      if (c && !G.windowAt() && !G.isFreeAgent(c) && ev.until - G.TUNE.eventTtl === G.absWeek()) m.closedOffers += 1;
    }
    if (ev.type === 'ask') m.asks += 1;
    if (ev.type === 'promise') m.vowAsks += 1;
    if (ev.type === 'buy') {
      m.buyOffers += 1;
      m.buyWish[G.buyWish(G.getPlayer(ev.s), ev.d)] += 1; // 남고 싶음·반반·돌아오고 싶음
    }
    const judged = judge(G, ev, pickable(G, ev));
    m.answered += 1;
    if (judged.obvious) m.obvious += 1;
    else m.realWeek = true;
    if (judged.apShort) m.apShortWeek = true;
    const pick = answer(G, bot, ev, judged);
    // 후회: 이적·완전 이적 제안에 답한 뒤 26주 안에 그 선수를 잃었는지
    const owner = G.clientOf(ev.s);
    if (owner && (ev.type === 'offer' || ev.type === 'buy')) m.pend.push({ s: ev.s, g: owner.g, w: G.absWeek() });
    const go = G.resolveEvent(ev.id, pick);
    acted = true;
    if (go !== null && !G.clientOf(go) && !G.recruitBlock(G.getPlayer(go))) {
      m.recruitTry += 1;
      G.recruit(go);
    }
  }
  for (const c of [...st.clients]) {
    if (G.renewBlock(c) || (bot === 'careless' && Math.random() < 0.5)) continue;
    const p = G.getPlayer(c.s);
    const pick = bot === 'careless' ? { level: Math.floor(Math.random() * 3), years: Math.random() < 0.5 ? 2 : 4 } : bestRenew(G, c, p);
    G.renew(c.s, pick.level, pick.years);
    acted = true;
  }
  if (bot !== 'careless') {
    // human은 할 일 줄(앞 4개)에 면담이 뜬 선수만 만남
    const todo = bot === 'human' ? G.todoList() : null;
    for (const c of [...st.clients].sort((a, b) => a.sat - b.sat)) {
      const want = todo ? todo.some(t => t.act === 'player' && t.v === c.s && t.text.endsWith(' 면담')) : c.sat < 55;
      if (!want) continue;
      if (!G.meetBlock(c)) {
        G.meet(c.s);
        acted = true;
      } else if (st.ap < 1 && !(c.met && G.absWeek() - c.met < G.TUNE.meetGap)) m.apShortWeek = true; // 만나고 싶은데 AP가 없음
    }
  }
  // 15단계 임대: 성실·유망주·베테랑 봇은 회사를 세운 뒤(AP 2) 이적 기간에, 소속 구단에서 벤치이고 더 자랄 여유(잠재력 - 능력 5 이상)가 있는 23세 이하 선수를
  // 선수 동의가 가장 높은 후보(50% 이상)로 임대함. 혼자일 때는 AP 1을 영입·추천에 씀. 추천처럼 하고 싶을 때 하는 일이라 "할 일이 있는 주"에 넣지 않음.
  // 18단계: 출전 시간 약속을 지키는 중이면 나이·잠재력과 관계없이, 혼자일 때도, 동의가 50% 아래여도 임대를 시도함 (안 보내면 약속을 못 지키니까).
  // 처음에는 혼자일 때 출전 약속을 해 놓고 임대를 보내지 않아서, 못 지킨 출전 약속의 70%가 여기서 나왔음
  // --no-loan이면 임대하지 않는 봇과 비교
  if (bot !== 'careless' && !workerData.noLoan) {
    for (const c of [...st.clients]) {
      if (st.ap < 1) break;
      const p = G.getPlayer(c.s);
      const playVow = G.vowOn(c) && c.vow.k === 'play';
      if ((!playVow && (!st.founded || G.ageOf(p) > 23 || p.pot - p.ability < 5)) || G.loanBlock(c)) continue;
      const best = G.loanClubs(c).map(club => ({ club, consent: G.loanFit(c, club).consent })).sort((a, b) => b.consent - a.consent)[0];
      if (best && (best.consent >= 50 || playVow)) {
        G.loan(c.s, best.club.id);
        m.loans += 1;
      }
    }
  }
  // 10단계 추천: 성실·유망주·베테랑 봇은 남는 AP가 있으면, 맞는 보강 중 가장 수준 높은 구단에 내 선수를 추천 (하고 싶을 때 하는 일)
  if (bot !== 'careless' && !workerData.noPitch) {
    for (const c of [...st.clients]) {
      if (st.ap < 1) break;
      // 18단계: 약속(출전·큰 무대·고향)에 맞는 구단을 먼저, 그다음 수준 높은 순
      const keeps = n => (G.vowClubKeeps(c, G.CLUBS[n.club]) ? 1 : 0);
      const best = st.needs.filter(n => !G.pitchBlock(c, n)).sort((a, b) => keeps(b) - keeps(a) || G.clubLevel(G.CLUBS[b.club]) - G.clubLevel(G.CLUBS[a.club]))[0];
      if (best && (bot !== 'youth' || st.ap >= 2)) {
        G.pitch(c.s, best.club);
        m.pitches += 1;
      }
    }
  }
  if (bot === 'youth') {
    const tries0 = m.recruitTry;
    if (youthRecruit(G, m)) m.scoutWeeks += 1;
    if (m.recruitTry > tries0) acted = true;
    return acted;
  }
  while (st.ap > 0 && st.clients.length < G.clientLimit() && st.agencyCash > 2000) {
    const s = pickTarget(G, bot);
    if (s === null) break;
    m.recruitTry += 1;
    G.recruit(s);
    acted = true;
  }
  return acted;
}

// 돈 쓰기 (성실·유망주·베테랑 봇). 투자·배당은 플레이어가 원할 때 하는 일이라 "할 일이 있는 주"에 넣지 않음
// 1) 적자 메우기: 법인 자금이 마이너스면 개인 자금을 넣고, 적자가 이어질 것 같으면 유지비가 큰 투자부터 한 단계 줄임
// 2) 투자: 우선순위대로, 도입비 + 여유 자금(지출 10주치 + 영입 비용용 주 수입 4주치)이 있고
//    유지비를 더해도 주간 수지가 수입의 30% 이상 남으면 한 단계
// 3) 아이템: 배당액(세금 포함)이 주 수입 4주치 이하로 싸거나, 다음 투자 비용의 1.5배 + 지출 20주치 + 주 수입 6주치를 넘는
//    여유가 있으면 그만큼만 배당해서 다음 아이템을 삼 (투자용 여유 자금은 남김)
const INVEST_ORDER = { attentive: ['lawyer', 'scout', 'coach', 'office'], youth: ['coach', 'scout', 'lawyer', 'office'], veteran: ['lawyer', 'office', 'scout', 'coach'] };
for (const bot of LIKE_ATTENTIVE) INVEST_ORDER[bot] = INVEST_ORDER.attentive;
function botMoney(G, bot, m) {
  const st = G.state;
  const order = workerData.order || INVEST_ORDER[bot];
  if (!order || workerData.noMoney || !st.founded) return; // 회사를 세우기 전에는 투자·배당이 없음
  const T = G.TUNE;
  const income = st.clients.reduce((n, c) => n + G.clientIncome(c), 0);
  const upkeepOf = k => (st.invest[k] ? G.investSteps(k)[st.invest[k] - 1][1] : 0);
  if (st.agencyCash < 0 && st.personalCash > 0) G.inject(st.personalCash);
  const spend = G.weeklySpend();
  if (income < spend && st.agencyCash < spend * 8) {
    const key = G.INVEST_KEYS.filter(k => st.invest[k]).sort((a, b) => upkeepOf(b) - upkeepOf(a))[0];
    if (key) {
      G.downgrade(key);
      m.downgrades += 1;
    }
    return;
  }
  let nextCost = Infinity;
  for (const key of order) {
    const lv = st.invest[key];
    const steps = G.investSteps(key);
    if (lv >= steps.length) continue;
    const [cost, upkeep] = steps[lv];
    nextCost = Math.min(nextCost, cost);
    const after = spend - upkeepOf(key) + upkeep;
    if (st.agencyCash >= cost + after * 10 + income * 4 && income - after >= income * 0.3) {
      G.invest(key);
      m.investSpent += cost;
      if (!m.firstInvest) m.firstInvest = m.weeks + 1;
      if (!m.buyWeek[`${key}${lv + 1}`]) m.buyWeek[`${key}${lv + 1}`] = m.weeks + 1;
      return;
    }
  }
  const i = G.ITEMS.findIndex(([id]) => !st.items.includes(id));
  if (i < 0) return;
  const price = T.itemPrice[i];
  if (st.personalCash < price) {
    const gross = Math.ceil((price - st.personalCash) / (1 - T.tax) / 100) * 100;
    const cheap = gross <= income * 4 && st.agencyCash - gross >= spend * 10 + income * 4;
    const spare = st.agencyCash - (nextCost === Infinity ? 0 : nextCost * 1.5) - spend * 20 - income * 6;
    if (!(cheap || gross <= spare) || gross > G.dividendRoom()) return;
    G.payDividend(gross);
    m.taxPaid += gross - G.afterTax(gross);
  }
  G.buyItem(i);
  m.itemSpent += price;
  m.buyWeek[G.ITEMS[i][0]] = m.weeks + 1;
}

// 18단계: 끝난 약속을 종류별로 셈 [지킴, 못 지킴]. 지키는 중에 선수가 떠난 약속은 따로(vowLost, 지킨 비율에서 뺌)
function trackVows(G, m) {
  const live = new Map();
  for (const c of G.state.clients) {
    if (!c.vow) continue;
    const id = `${c.s}:${c.g}:${c.vow.w}`;
    if (c.vow.s === 0) live.set(id, c.vow.k);
    else if ((c.vow.s === 1 || c.vow.s === -1) && !m.vowSeen.has(id)) {
      m.vowSeen.add(id);
      const t = (m.vowBy[c.vow.k] = m.vowBy[c.vow.k] || [0, 0]);
      t[c.vow.s === 1 ? 0 : 1] += 1;
    }
  }
  for (const id of m.vowLive.keys()) if (!live.has(id) && !m.vowSeen.has(id)) m.vowLost += 1;
  m.vowLive = live;
}

// ----- P19 재미 지표 (정의는 AGENTS.md 8장 "재미 지표") -----
// 처음 겪는 일: 소식 종류마다 처음 온 것 + 기록(stats)이 처음 생긴 것 + 회사 설립·첫 투자·첫 아이템
const FIRST_STATS = ['lost', 'transfers', 'dream', 'callups', 'renewWin', 'signed', 'loans', 'loanBuys', 'vows', 'vowKept', 'vowBroken'];
function newFirsts(G, m) {
  const st = G.state;
  const keys = [...st.events.map(ev => `ev:${ev.type}`), ...FIRST_STATS.filter(key => st.stats[key] > 0).map(key => `st:${key}`)];
  if (st.founded) keys.push('founded');
  if (G.INVEST_KEYS.some(key => st.invest[key])) keys.push('invest');
  if (st.items.length) keys.push('item');
  let n = 0;
  for (const key of keys) {
    if (m.firsts.has(key)) continue;
    m.firsts.add(key);
    n += 1;
  }
  return n;
}
const memberKey = c => `${c.s}:${c.g}`;
function funWeekStart(G, m) {
  const st = G.state;
  // 긴장 주: 만족이 경고선(TUNE.satWarn 35) 미만인 선수가 있거나 다른 에이전시 접근 소식이 있는 주
  if (st.clients.some(c => c.sat < G.TUNE.satWarn) || st.events.some(ev => ev.type === 'poach')) m.tenseWeeks += 1;
  m.realWeek = false;
  m.apShortWeek = false;
  m.uncapped = new Set(st.clients.filter(c => !c.capped).map(memberKey));
}
function funWeekEnd(G, m) {
  const st = G.state;
  const now = G.absWeek();
  if (m.realWeek || m.apShortWeek) m.realWeeks += 1;
  m.firstCaps += st.clients.filter(c => c.capped && m.uncapped.has(memberKey(c))).length;
  const season = Math.floor((m.weeks - 1) / 52);
  m.novel[season] = (m.novel[season] || 0) + newFirsts(G, m);
  // 애착: 떠난 선수는 함께한 주 수를 남김
  const live = new Set(st.clients.map(memberKey));
  for (const [key, since] of m.members) {
    if (live.has(key)) continue;
    m.tenure.push(now - since);
    m.members.delete(key);
  }
  for (const c of st.clients) if (!m.members.has(memberKey(c))) m.members.set(memberKey(c), c.since);
  // 후회: 이적 제안에 답한 뒤 26주 안에 선수를 잃음 (26주를 다 채우지 못하고 게임이 끝난 답은 뺌)
  m.pend = m.pend.filter(x => {
    if (!live.has(`${x.s}:${x.g}`)) {
      m.regret += 1;
      m.regretDone += 1;
      return false;
    }
    if (now - x.w < 26) return true;
    m.regretDone += 1;
    return false;
  });
  // 시즌 끝 점검: 유대 100 비율, 법인 자금, 재계약 누적
  if (m.weeks % 52 === 0) {
    m.bond100.push(st.clients.length ? (st.clients.filter(c => c.bond >= 100).length / st.clients.length) * 100 : null);
    m.cashBy.push(st.agencyCash);
    m.renewBy.push([st.stats.renewWin, st.stats.renewTry]);
  }
}

// 한 판: 지표를 숫자로 돌려줌
function playGame(G, bot, seasons) {
  G.newGame();
  const st = G.state;
  const m = { weeks: 0, decisionWeeks: 0, news: 0, overload: 0, apUsed: 0, offers: 0, consentSum: 0, recruitTry: 0, firstTransfer: 0, bankrupt: 0,
    firstInvest: 0, investSpent: 0, upkeepPaid: 0, taxPaid: 0, itemSpent: 0, downgrades: 0, deficitWeeks: 0, buyWeek: {},
    scouts: 0, scoutWeeks: 0, busyWithScout: 0, youthTry: 0, youthPotSum: 0, youthMissSum: 0, foundWeek: 0, soloWeeks: 0, soloBusy: 0, apAvail: 0, tales: 0, juniors: 0, taleKinds: {},
    lateOffers: 0, closedOffers: 0, asks: 0, pitches: 0, pitchOffers: 0, worldDeals: 0, loans: 0, buyOffers: 0, buyWish: { stay: 0, mid: 0, back: 0 }, vowAsks: 0,
    vowBy: {}, vowSeen: new Set(), vowLive: new Map(), vowLost: 0,
    // P19 재미 지표
    seen: new Set(), skipped: new Set(), eventsSeen: 0, repeats: 0, combos: new Set(), answered: 0, obvious: 0,
    realWeek: false, apShortWeek: false, realWeeks: 0, tenseWeeks: 0, pend: [], regret: 0, regretDone: 0, firstCaps: 0,
    firsts: new Set(), novel: [], bond100: [], cashBy: [], renewBy: [], tenure: [], members: new Map() };
  const signed0 = st.stats.signed;
  newFirsts(G, m); // 시작할 때 이미 있는 것은 "처음 겪는 일"로 세지 않음
  for (let w = 0; w < seasons * 52; w++) {
    funWeekStart(G, m);
    const news = st.events.length;
    m.news += news;
    if (news >= 3) m.overload += 1;
    const ap0 = st.ap;
    m.apAvail += ap0;
    const transfers0 = st.stats.transfers;
    const scoutWeeks0 = m.scoutWeeks;
    const solo = !st.founded;
    const acted = botWeek(G, bot, m);
    trackVows(G, m);
    if (acted || news) m.decisionWeeks += 1;
    if (solo) {
      m.soloWeeks += 1;
      if (acted || news) m.soloBusy += 1;
    }
    if (acted || news || m.scoutWeeks > scoutWeeks0) m.busyWithScout += 1; // 스카우트(하고 싶을 때 하는 일)까지 넣으면
    m.apUsed += ap0 - st.ap;
    botMoney(G, bot, m);
    // 투자 유지비 때문에 적자가 난 주 (투자가 없었으면 흑자)
    const income = st.clients.reduce((n, c) => n + G.clientIncome(c), 0);
    const fixed = G.investUpkeep();
    if (income >= G.upkeepNow() && income < G.upkeepNow() + fixed) m.deficitWeeks += 1;
    m.upkeepPaid += fixed;
    G.advanceWeek();
    m.weeks += 1;
    trackVows(G, m);
    m.worldDeals += st.news.filter(n => n.k === 'sign' && n.w === G.absWeek()).length;
    if (!m.firstTransfer && st.stats.transfers > transfers0) m.firstTransfer = m.weeks;
    funWeekEnd(G, m);
    if (st.over) {
      m.bankrupt = 1;
      break;
    }
  }
  for (const since of m.members.values()) m.tenure.push(G.absWeek() - since); // 끝날 때 남은 선수도 그때까지 함께한 기간으로
  const k = st.stats;
  // 번 돈 = 쓴 돈 + 늘어난 자금(법인 + 개인). 쓴 돈 = 투자 도입비 + 유지비 + 배당 세금 + 아이템
  const spent = m.investSpent + m.upkeepPaid + m.taxPaid + m.itemSpent;
  const saved = st.agencyCash + st.personalCash - G.TUNE.soloCash;
  const levels = G.INVEST_KEYS.reduce((n, key) => n + st.invest[key], 0);
  const maxLevels = G.INVEST_KEYS.reduce((n, key) => n + G.investSteps(key).length, 0);
  const money = INVEST_ORDER[bot] && !workerData.noMoney ? {
    // 투자는 회사를 세운 뒤에만 가능: 세운 주부터 52주 안에 첫 투자를 했는지 (못 세운 게임은 빼고 셈)
    firstInvestS1: !m.foundWeek ? null : m.firstInvest && m.firstInvest - m.foundWeek <= 52 ? 100 : 0,
    investLevels: levels,
    deficitWeeks: (m.deficitWeeks / m.weeks) * 100,
    spendShare: spent + Math.max(0, saved) > 0 ? (spent / (spent + Math.max(0, saved))) * 100 : null,
    leftToBuy: levels < maxLevels || st.items.length < G.ITEMS.length ? 100 : 0,
    items: st.items.length,
    downgrades: m.downgrades,
    buyWeek: m.buyWeek
  } : {};
  const scouting = bot === 'youth' ? {
    scoutsPerSeason: m.scouts / Math.max(1, m.weeks / 52),
    busyWithScout: (m.busyWithScout / m.weeks) * 100,
    youthPot: m.youthTry ? m.youthPotSum / m.youthTry : null,   // 영입하려 한 21세 이하의 진짜 잠재력 평균
    youthMiss: m.youthTry ? m.youthMissSum / m.youthTry : null  // 그때 보이던 범위 가운데와 진짜 잠재력의 차이
  } : {};
  // 7단계: 회사 설립 시점, 혼자일 때 할 일이 있는 주, 끝날 때 남은 선수의 유대
  const bonds = st.clients.map(c => c.bond);
  const solo = bot === 'passive' ? {} : {
    foundS1: m.foundWeek && m.foundWeek <= 52 ? 100 : 0,
    foundWeek: m.foundWeek || null,
    soloBusy: m.soloWeeks ? (m.soloBusy / m.soloWeeks) * 100 : null,
    bondAvg: bonds.length ? bonds.reduce((a, b) => a + b, 0) / bonds.length : null,
    bondHigh: bonds.length ? (bonds.filter(b => b >= 60).length / bonds.length) * 100 : null,
    tales: m.tales,                          // 찾아온 관계 이야기 수
    juniorAny: m.juniors ? 100 : 0,          // 후배 소개를 받은 게임
    alumni: st.alumni.length,                // 스카우트로 합류한 옛 선수
    taleKinds: m.taleKinds
  };
  return {
    ...money,
    ...scouting,
    ...solo,
    earned: spent + saved,
    personal: st.personalCash,
    netWorth: G.netWorth(),
    decisionWeeks: (m.decisionWeeks / m.weeks) * 100,
    newsPerWeek: m.news / m.weeks,
    overloadWeeks: (m.overload / m.weeks) * 100,
    apUse: m.apAvail ? (m.apUsed / m.apAvail) * 100 : 0, // 혼자일 때는 주 AP가 적음
    renewRate: k.renewTry ? (k.renewWin / k.renewTry) * 100 : null,
    recruitRate: m.recruitTry ? ((k.signed - signed0) / m.recruitTry) * 100 : null,
    lost: k.lost,
    lostAny: k.lost > 0 ? 100 : 0,
    lostAll: st.clients.length === 0 ? 100 : 0,
    bankrupt: m.bankrupt * 100,
    transfers: k.transfers,
    transfersPerSeason: k.transfers / Math.max(1, m.weeks / 52),
    transferS1: m.firstTransfer && m.firstTransfer <= 52 ? 100 : 0,
    callupAny: k.callups > 0 ? 100 : 0,
    dreamAny: k.dream > 0 ? 100 : 0,
    consentAvg: m.offers ? m.consentSum / m.offers : null,
    lateShare: m.offers ? (m.lateOffers / m.offers) * 100 : null, // 9단계: 마감 주에 온 제안 비율
    closedOffers: m.closedOffers,
    asks: m.asks,
    pitches: m.pitches,                                                     // 10단계: 게임당 추천 수
    pitchOffers: m.pitchOffers,                                             // 추천한 구단에서 온 제안
    loans: m.loans,                                                         // 15단계: 게임당 임대
    buyOffers: m.buyOffers,                                                 // 17단계: 임대 구단의 완전 이적 제안
    buyWish: m.buyWish,
    loanBuys: k.loanBuys,                                                   // 그중 성사된 완전 이적
    vowAsks: m.vowAsks,                                                     // 18단계: 약속 부탁 (게임당)
    vows: k.vows,                                                           // 그중 약속한 것
    vowBy: m.vowBy,                                                         // 종류별 [지킴, 못 지킴]
    vowLost: m.vowLost,                                                     // 지키는 중에 선수가 떠난 약속
    vowKept: k.vowKept + k.vowBroken ? (k.vowKept / (k.vowKept + k.vowBroken)) * 100 : null, // 끝난 약속 중 지킨 비율 (게임 끝에 지키는 중인 것은 빼고)
    worldDealsPerSeason: m.worldDeals / Math.max(1, m.weeks / 52),          // 세계 이적(뉴스) 시즌당
    // P19 재미 지표
    realWeeks: (m.realWeeks / m.weeks) * 100,
    obviousShare: m.answered ? (m.obvious / m.answered) * 100 : null,
    tenseWeeks: (m.tenseWeeks / m.weeks) * 100,
    regret: m.regret,
    regretDone: m.regretDone,
    surprise: (k.dream + m.firstCaps) / Math.max(1, m.weeks / 52),
    dreamN: k.dream,
    firstCaps: m.firstCaps,
    novel: m.novel,
    repeat: m.eventsSeen ? (m.repeats / m.eventsSeen) * 100 : null,
    skippedN: m.skipped.size,
    eventsSeen: m.eventsSeen,
    bond100: m.bond100,
    cashBy: m.cashBy,
    renewBy: m.renewBy,
    tenure: m.tenure,
    cash: st.agencyCash,
    income: st.clients.reduce((n, c) => n + G.clientIncome(c), 0),
    clients: st.clients.length,
    rep: st.rep
  };
}

// ----- 작업자: 맡은 판 수만큼 돌리고 결과 배열을 돌려줌 -----
if (!isMainThread) {
  const G = loadGame();
  Object.assign(G.TUNE, workerData.tune);
  const out = [];
  for (let i = 0; i < workerData.games; i++) out.push(playGame(G, workerData.bot, workerData.seasons));
  parentPort.postMessage(out);
  return;
}

// ----- 메인: 판을 나눠 돌리고 평균을 목표와 비교 -----
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const games = Number(arg('games', 400));
const seasons = Number(arg('seasons', 3));
const tune = JSON.parse(arg('tune', '{}'));
// --bots attentive,human,greedy,skipper: 여러 봇을 한 번에 돌리고 끝에 재미 지표 비교표
const bots = args.includes('--all') ? ['attentive', 'youth', 'veteran', 'careless', 'passive'] : arg('bots', '') ? arg('bots').split(',') : [arg('bot', 'attentive')];
const noMoney = args.includes('--no-money');           // 투자·배당·아이템을 하지 않는 봇과 비교
const noScout = args.includes('--no-scout');           // 유망주 봇이 스카우트 없이 보이는 범위만 보고 영입
const noPitch = args.includes('--no-pitch');           // 봇이 보강이 필요한 구단에 선수를 추천하지 않음 (추천의 값어치 비교)
const noLoan = args.includes('--no-loan');             // 봇이 벤치 선수를 임대 보내지 않음 (임대의 값어치 비교)
const noBuy = args.includes('--no-buy');               // 봇이 임대 구단의 완전 이적 제안을 늘 거절 (임대 뒤 완전 이적의 값어치 비교)
const order = arg('order', '') ? arg('order').split(',') : null; // 이 투자만, 이 순서로 (예: --order lawyer)
const G0 = loadGame(); // 결과 표시용 (TUNE·아이템 목록)
Object.assign(G0.TUNE, tune);

function runBot(bot) {
  const workers = Math.min(os.cpus().length, games);
  const per = Array.from({ length: workers }, (_, i) => Math.floor(games / workers) + (i < games % workers ? 1 : 0));
  return Promise.all(per.map(n => new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: { games: n, bot, seasons, tune, noMoney, noScout, noPitch, noLoan, noBuy, order } });
    w.on('message', resolve);
    w.on('error', reject);
  }))).then(parts => parts.flat());
}

const mean = (rows, key) => {
  const vals = rows.map(r => r[key]).filter(v => v !== null && v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
};
// 17단계: 완전 이적 제안을 받은 선수 마음 비율 "남고 싶음 70% · 반반 18% · 돌아오고 싶음 12%"
const wishText = rows => {
  const sum = { stay: 0, mid: 0, back: 0 };
  for (const r of rows) for (const k of Object.keys(sum)) sum[k] += r.buyWish ? r.buyWish[k] : 0;
  const all = sum.stay + sum.mid + sum.back;
  return all ? `남고 싶음 ${Math.round((sum.stay / all) * 100)}% · 반반 ${Math.round((sum.mid / all) * 100)}% · 돌아오고 싶음 ${Math.round((sum.back / all) * 100)}%` : '-';
};
const median = (rows, key) => {
  const vals = rows.map(r => r[key]).sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
};
const midOf = vals => (vals.length ? [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)] : NaN);
const avgOf = vals => {
  const ok = vals.filter(v => v !== null && v !== undefined);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN;
};
const pct = v => (Number.isNaN(v) ? '-' : `${v.toFixed(1)}%`);
// P19 재미 지표 9개 (모든 판을 합쳐서). 시즌별 값은 그 시즌까지 간 판만
function funStats(rows) {
  const seasonsRun = Math.max(...rows.map(r => r.cashBy.length));
  const at = (key, i) => rows.map(r => r[key][i]).filter(v => v !== undefined);
  const novelBy = Array.from({ length: seasonsRun }, (_, i) => avgOf(rows.filter(r => r.cashBy.length > i).map(r => r.novel[i] || 0)));
  const bond100By = Array.from({ length: seasonsRun }, (_, i) => avgOf(at('bond100', i)));
  const regretDone = rows.reduce((n, r) => n + r.regretDone, 0);
  return {
    realWeeks: mean(rows, 'realWeeks'),
    obviousShare: mean(rows, 'obviousShare'),
    tenseWeeks: mean(rows, 'tenseWeeks'),
    regret: regretDone ? (rows.reduce((n, r) => n + r.regret, 0) / regretDone) * 100 : NaN,
    regretDone,
    surprise: mean(rows, 'surprise'),
    dream: mean(rows, 'dreamN'),
    firstCaps: mean(rows, 'firstCaps'),
    novel: avgOf(novelBy),
    novelBy,
    repeat: mean(rows, 'repeat'),
    bond100By,
    bond100: bond100By[bond100By.length - 1],
    tenure: midOf(rows.flatMap(r => r.tenure)),
    skipped: rows.reduce((n, r) => n + r.skippedN, 0) / Math.max(1, rows.reduce((n, r) => n + r.eventsSeen, 0)) * 100,
    check: Array.from({ length: seasonsRun }, (_, i) => {
      const renew = at('renewBy', i).reduce((t, [win, all]) => [t[0] + win, t[1] + all], [0, 0]);
      return { cash: midOf(at('cashBy', i)), bond100: bond100By[i], renew: renew[1] ? (renew[0] / renew[1]) * 100 : NaN };
    })
  };
}

(async () => {
  const t0 = Date.now();
  const summary = {};
  const fun = {};
  for (const bot of bots) {
    const rows = await runBot(bot);
    summary[bot] = rows;
    console.log(`\n[${bot}] ${rows.length}판 × ${seasons}시즌${Object.keys(tune).length ? ` · TUNE ${JSON.stringify(tune)}` : ''}`);
    for (const [key, label, lo, hi, unit] of TARGETS[bot] || TARGETS.attentive) {
      const v = mean(rows, key);
      const mark = Number.isNaN(v) ? '·' : v >= lo && v <= hi ? '✓' : '✗';
      console.log(`  ${mark} ${label.padEnd(18)} ${Number.isNaN(v) ? '-' : v.toFixed(unit === '%' ? 1 : 2)}${unit}  (목표 ${lo}~${hi}${unit})`);
    }
    console.log(`    평균: 이적 ${mean(rows, 'transfers').toFixed(2)}건, 잃은 선수 ${mean(rows, 'lost').toFixed(2)}명, 남은 선수 ${mean(rows, 'clients').toFixed(1)}명, 평판 ${mean(rows, 'rep').toFixed(1)}, 자금 $${Math.round(mean(rows, 'cash')).toLocaleString()}, 번 돈 $${Math.round(mean(rows, 'earned')).toLocaleString()}, 주 수입 $${Math.round(mean(rows, 'income')).toLocaleString()}`);
    if (rows[0].investLevels !== undefined) {
      console.log(`    돈: 투자 ${mean(rows, 'investLevels').toFixed(1)}단계, 아이템 ${mean(rows, 'items').toFixed(1)}개, 단계 줄이기 ${mean(rows, 'downgrades').toFixed(2)}번, 아직 살 것이 남은 게임 ${mean(rows, 'leftToBuy').toFixed(0)}%`);
      // 산 시점 중앙값(시즌): 절반 넘게 못 산 것은 "-"
      const when = key => {
        const weeks = rows.map(r => r.buyWeek[key] || Infinity).sort((a, b) => a - b);
        const mid = weeks[Math.floor(weeks.length / 2)];
        return mid === Infinity ? '-' : (mid / 52).toFixed(1);
      };
      const keys = Object.keys(G0.TUNE).filter(k => k.endsWith('Lv')).flatMap(k => G0.TUNE[k].map((_, i) => `${k.slice(0, -2)}${i + 1}`));
      console.log(`    산 시점 중앙값(시즌): ${keys.map(k => `${k} ${when(k)}`).join(', ')} | ${G0.ITEMS.map(([id]) => `${id} ${when(id)}`).join(', ')}`);
    }
    if (rows[0].foundS1 !== undefined) {
      const weeks = rows.map(r => r.foundWeek || Infinity).sort((a, b) => a - b);
      const mid = weeks[Math.floor(weeks.length / 2)];
      console.log(`    혼자 시작: 회사 설립 시점 중앙값 ${mid === Infinity ? '-' : `${mid}주`}, 1시즌 안에 설립 ${mean(rows, 'foundS1').toFixed(0)}%, 설립 못 한 게임 ${((weeks.filter(w => w === Infinity).length / rows.length) * 100).toFixed(0)}%, 혼자일 때 할 일 있는 주 ${mean(rows, 'soloBusy').toFixed(1)}%`);
      console.log(`    유대: 남은 선수 평균 ${mean(rows, 'bondAvg').toFixed(1)}, 60 이상(끈끈함 이상) ${mean(rows, 'bondHigh').toFixed(0)}%`);
      const kinds = ['call', 'wedding', 'junior', 'praise'].map(k => `${k} ${(rows.reduce((n, r) => n + (r.taleKinds[k] || 0), 0) / rows.length).toFixed(2)}`).join(', ');
      console.log(`    관계 이야기: 게임당 ${mean(rows, 'tales').toFixed(2)}개 (${kinds}), 후배 소개를 받은 게임 ${mean(rows, 'juniorAny').toFixed(0)}%, 옛 선수 스카우트 평균 ${mean(rows, 'alumni').toFixed(2)}명`);
    }
    if (rows[0].scoutsPerSeason !== undefined) {
      console.log(`    스카우트: 시즌당 ${mean(rows, 'scoutsPerSeason').toFixed(1)}번, 스카우트까지 넣은 할 일 있는 주 ${mean(rows, 'busyWithScout').toFixed(1)}%, 영입하려 한 21세 이하 진짜 잠재력 평균 ${mean(rows, 'youthPot').toFixed(1)} (보이던 범위 가운데와 차이 ${mean(rows, 'youthMiss').toFixed(1)})`);
    }
    if (bot !== 'passive') console.log(`    세계 뉴스: 세계 이적 시즌당 ${mean(rows, 'worldDealsPerSeason').toFixed(1)}건, 추천 게임당 ${mean(rows, 'pitches').toFixed(2)}번, 추천한 구단에서 온 제안 ${mean(rows, 'pitchOffers').toFixed(2)}건, 임대 게임당 ${mean(rows, 'loans').toFixed(2)}건 (완전 이적 제안 ${mean(rows, 'buyOffers').toFixed(2)}건 · 성사 ${mean(rows, 'loanBuys').toFixed(2)}건 · 선수 마음 ${wishText(rows)})`);
    if (bot !== 'passive') console.log(`    이적 시장: 마감 주에 온 제안 ${mean(rows, 'lateShare').toFixed(1)}%, 닫힌 기간에 계약 중인 선수에게 온 제안 ${rows.reduce((n, r) => n + r.closedOffers, 0)}건(0이어야 함), 이적 요청 게임당 ${mean(rows, 'asks').toFixed(2)}건`);
    if (bot !== 'passive') {
      // 종류별은 모든 판을 합쳐서 (지킴/끝난 약속)
      const by = {};
      for (const r of rows) {
        for (const [key, v] of Object.entries(r.vowBy)) {
          const t = (by[key] = by[key] || [0, 0]);
          t[0] += v[0];
          t[1] += v[1];
        }
      }
      const kinds = ['money', 'play', 'stage', 'home', 'stable'].filter(key => by[key]).map(key => `${key} ${by[key][0]}/${by[key][0] + by[key][1]}(${Math.round((by[key][0] / (by[key][0] + by[key][1])) * 100)}%)`).join(', ');
      console.log(`    약속: 부탁 게임당 ${mean(rows, 'vowAsks').toFixed(2)}건, 약속 ${mean(rows, 'vows').toFixed(2)}건, 끝난 약속 중 지킨 비율 ${Number.isNaN(mean(rows, 'vowKept')) ? '-' : `${mean(rows, 'vowKept').toFixed(1)}%`} (종류별 지킴/끝남 ${kinds || '-'}), 지키는 중에 선수가 떠난 약속 게임당 ${mean(rows, 'vowLost').toFixed(2)}건(비율에서 뺌)`);
    }
    console.log(`    중앙값: 번 돈 $${Math.round(median(rows, 'earned')).toLocaleString()}, 법인 자금 $${Math.round(median(rows, 'cash')).toLocaleString()}, 개인 자산 $${Math.round(median(rows, 'netWorth')).toLocaleString()}, 주 수입 $${Math.round(median(rows, 'income')).toLocaleString()}`);
    if (bot !== 'passive') {
      const f = funStats(rows);
      fun[bot] = f;
      console.log(`  [재미 지표] (목표 범위는 아직 없음, AGENTS.md 8장)${SKIP[bot] ? ` · 넘긴 소식 ${f.skipped.toFixed(1)}%` : ''}`);
      console.log(`    진짜 고민이 있는 주 ${pct(f.realWeeks)}, 뻔한 답 ${pct(f.obviousShare)}, 긴장 주 ${pct(f.tenseWeeks)}, 후회 ${pct(f.regret)} (답한 이적 제안 ${f.regretDone}건 중)`);
      console.log(`    놀람 시즌당 ${f.surprise.toFixed(2)}건 (게임당 꿈의 구단 이적 ${f.dream.toFixed(2)} · 첫 국가대표 ${f.firstCaps.toFixed(2)}), 새로움 시즌당 ${f.novel.toFixed(2)}건, 반복 ${pct(f.repeat)}, 유대 100 비율 ${pct(f.bond100)}(마지막 시즌 끝), 애착(함께한 기간 중앙값) ${f.tenure}주`);
      console.log(`    시즌별 새로움: ${f.novelBy.map((v, i) => `${i + 1}시즌 ${v.toFixed(2)}`).join(', ')}`);
      console.log('    시즌별 점검 (시즌 끝): 법인 자금 중앙값 · 유대 100 비율 · 재계약 누적 성공률');
      f.check.forEach((x, i) => console.log(`      ${String(i + 1).padStart(2)}시즌  $${Math.round(x.cash).toLocaleString().padStart(11)} · ${pct(x.bond100).padStart(6)} · ${pct(x.renew).padStart(6)}`));
    }
  }
  const funBots = Object.keys(fun);
  if (funBots.length > 1) {
    const rowsOut = [['진짜 고민이 있는 주', f => pct(f.realWeeks)], ['뻔한 답 비율', f => pct(f.obviousShare)], ['긴장 주', f => pct(f.tenseWeeks)], ['후회', f => pct(f.regret)],
      ['놀람 (시즌당)', f => f.surprise.toFixed(2)], ['새로움 (시즌당)', f => f.novel.toFixed(2)], ['반복', f => pct(f.repeat)], ['유대 100 비율 (마지막 시즌)', f => pct(f.bond100)], ['애착 (중앙값, 주)', f => String(f.tenure)]];
    console.log(`\n  재미 지표 비교 (${seasons}시즌)\n  | 지표 | ${funBots.join(' | ')} |\n  |---|${funBots.map(() => '---').join('|')}|`);
    for (const [label, show] of rowsOut) console.log(`  | ${label} | ${funBots.map(b => show(fun[b])).join(' | ')} |`);
  }
  if (summary.youth && summary.veteran) {
    // 5단계부터 자금은 투자·아이템에 쓰이므로 "번 돈"(쓴 돈 + 늘어난 자금)으로 비교
    const ratio = mean(summary.youth, 'earned') / mean(summary.veteran, 'earned');
    // 번 돈은 몇몇 대박 게임에 크게 끌려서 평균 비율이 ±0.1쯤 흔들림 → 중앙값 비율도 같이 봄
    const mid = median(summary.youth, 'earned') / median(summary.veteran, 'earned');
    console.log(`\n  ${ratio >= 0.8 && ratio <= 1.25 ? '✓' : '✗'} 유망주 전략 / 베테랑 전략 번 돈 비율 ${ratio.toFixed(2)} (목표 0.8~1.25, 중앙값 비율 ${mid.toFixed(2)})`);
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}초`);
})();
