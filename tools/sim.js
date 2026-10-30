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
    ['firstInvestS1', '1시즌 안에 첫 투자', 60, 100, '%'],
    ['investLevels', '투자 단계 (10단계 중)', 3, 7, ''],
    ['spendShare', '번 돈 중 투자·아이템에 쓴 비율', 40, 85, '%'],
    ['deficitWeeks', '투자 유지비 때문에 적자인 주', 0, 3, '%']
  ],
  passive: [['bankrupt', '파산한 게임', 80, 100, '%'], ['lostAll', '선수를 다 잃은 게임', 80, 100, '%']],
  careless: [['lostAny', '선수를 1명 이상 잃은 게임', 60, 100, '%']]
};

// ----- game.js 불러오기 (저장·화면은 끔) -----
// vm 대신 함수로 감싸서 불러옴: game.js의 전역이 함수 안 지역 변수가 되어 반복문이 빨라짐
function loadGame() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const noop = () => {};
  const stubs = {
    localStorage: { getItem: () => null, setItem: noop }, window: { addEventListener: noop, scrollTo: noop },
    document: { addEventListener: noop, getElementById: () => null, querySelectorAll: () => [] },
    history: { replaceState: noop, pushState: noop, back: noop }, confirm: () => true,
    console: { ...console, assert: noop, warn: noop }
  };
  const factory = new Function(...Object.keys(stubs), `${src}
    ;saveState = () => {};
    return { get state() { return state; }, TUNE, SLOTS, EVENT_TYPES, RENEW_LEVELS, RENEW_YEARS, newGame, advanceWeek, getPlayer, ageOf, valueOf,
      weeklyWage, commissionOf, clientIncome, clientLimit, recruit, recruitBlock, recruitChance, recruitCost, renew, renewBlock, renewTerms,
      meet, meetBlock, resolveEvent, offerFit, offerCut, counterChance, clientOf, absWeek,
      INVEST_KEYS, ITEMS, investSteps, investUpkeep, upkeepNow, weeklySpend, invest, downgrade, dividendRoom, afterTax, payDividend, inject, buyItem, netWorth };`);
  return factory(...Object.values(stubs));
}

// ----- 봇 -----
// 소식 답: 성실한 봇은 상황을 보고 고름, 대충 하는 봇은 아무거나
function answer(G, bot, ev) {
  const st = G.state;
  const c = G.clientOf(ev.s);
  const p = G.getPlayer(ev.s);
  const type = G.EVENT_TYPES[ev.type];
  const ok = i => {
    const o = type.options[i];
    if (!o) return false;
    const cost = o.cost ? o.cost(ev.d, c) : 0;
    return !(o.ap && st.ap < o.ap) && cost <= st.agencyCash;
  };
  if (bot === 'careless') {
    const opts = type.options.map((_, i) => i).filter(ok);
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : type.def;
  }
  switch (ev.type) {
    case 'offer': {
      const fit = G.offerFit(p, ev.d);
      if (fit.consent >= 55) return 0;
      if (fit.consent >= 40 && G.counterChance() >= 55) return 1;
      return 2;
    }
    case 'playtime': return ok(0) ? 0 : 1;
    case 'sns': return st.agencyCash > 20000 && ok(1) ? 1 : ok(0) ? 0 : 2;
    case 'injury': return ok(0) ? 0 : 1;
    case 'interview': return ok(0) ? 0 : 1;
    case 'poach': return ok(0) ? 0 : ok(1) ? 1 : 2;
    default: return 0;
  }
}

// 재계약: 성공 확률 × (선수 만족 변화 + 10)이 가장 큰 조건
function bestRenew(G, c, p) {
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

// 영입 대상: 무작위 250명 중 전략 점수가 가장 높은 선수
function pickTarget(G, bot) {
  let best = null;
  let bestScore = 0;
  for (let k = 0; k < 250; k++) {
    const s = Math.floor(Math.random() * G.SLOTS);
    const p = G.getPlayer(s);
    if (G.recruitBlock(p)) continue;
    const age = G.ageOf(p);
    const chance = G.recruitChance(p) / 100;
    const gain = G.commissionOf(G.weeklyWage(p.ability)) - 50;
    let score;
    if (bot === 'youth') score = age <= 21 && p.pot - p.ability >= 10 ? chance * (p.pot - 40) : 0;
    else if (bot === 'veteran') score = age >= 26 ? chance * gain : 0;
    else score = chance * (gain + G.valueOf(p) * 0.0005) - G.recruitCost(p) / 52;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

function botWeek(G, bot, m) {
  const st = G.state;
  if (bot === 'passive') return false;
  let acted = false;
  for (const ev of [...st.events]) {
    if (ev.type === 'offer') {
      m.offers += 1;
      m.consentSum += G.offerFit(G.getPlayer(ev.s), ev.d).consent;
    }
    const go = G.resolveEvent(ev.id, answer(G, bot, ev));
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
    for (const c of [...st.clients].sort((a, b) => a.sat - b.sat)) {
      if (c.sat < 55 && !G.meetBlock(c)) {
        G.meet(c.s);
        acted = true;
      }
    }
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
function botMoney(G, bot, m) {
  const st = G.state;
  const order = workerData.order || INVEST_ORDER[bot];
  if (!order || workerData.noMoney) return;
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

// 한 판: 지표를 숫자로 돌려줌
function playGame(G, bot, seasons) {
  G.newGame();
  const st = G.state;
  const m = { weeks: 0, decisionWeeks: 0, news: 0, overload: 0, apUsed: 0, offers: 0, consentSum: 0, recruitTry: 0, firstTransfer: 0, bankrupt: 0,
    firstInvest: 0, investSpent: 0, upkeepPaid: 0, taxPaid: 0, itemSpent: 0, downgrades: 0, deficitWeeks: 0, buyWeek: {} };
  const signed0 = st.stats.signed;
  for (let w = 0; w < seasons * 52; w++) {
    const news = st.events.length;
    m.news += news;
    if (news >= 3) m.overload += 1;
    const ap0 = st.ap;
    const transfers0 = st.stats.transfers;
    const acted = botWeek(G, bot, m);
    if (acted || news) m.decisionWeeks += 1;
    m.apUsed += ap0 - st.ap;
    botMoney(G, bot, m);
    // 투자 유지비 때문에 적자가 난 주 (투자가 없었으면 흑자)
    const income = st.clients.reduce((n, c) => n + G.clientIncome(c), 0);
    const fixed = G.investUpkeep();
    if (income >= G.upkeepNow() && income < G.upkeepNow() + fixed) m.deficitWeeks += 1;
    m.upkeepPaid += fixed;
    G.advanceWeek();
    m.weeks += 1;
    if (!m.firstTransfer && st.stats.transfers > transfers0) m.firstTransfer = m.weeks;
    if (st.over) {
      m.bankrupt = 1;
      break;
    }
  }
  const k = st.stats;
  // 번 돈 = 쓴 돈 + 늘어난 자금(법인 + 개인). 쓴 돈 = 투자 도입비 + 유지비 + 배당 세금 + 아이템
  const spent = m.investSpent + m.upkeepPaid + m.taxPaid + m.itemSpent;
  const saved = st.agencyCash + st.personalCash - 25000;
  const levels = G.INVEST_KEYS.reduce((n, key) => n + st.invest[key], 0);
  const maxLevels = G.INVEST_KEYS.reduce((n, key) => n + G.investSteps(key).length, 0);
  const money = INVEST_ORDER[bot] && !workerData.noMoney ? {
    firstInvestS1: m.firstInvest && m.firstInvest <= 52 ? 100 : 0,
    investLevels: levels,
    deficitWeeks: (m.deficitWeeks / m.weeks) * 100,
    spendShare: spent + Math.max(0, saved) > 0 ? (spent / (spent + Math.max(0, saved))) * 100 : null,
    leftToBuy: levels < maxLevels || st.items.length < G.ITEMS.length ? 100 : 0,
    items: st.items.length,
    downgrades: m.downgrades,
    buyWeek: m.buyWeek
  } : {};
  return {
    ...money,
    earned: spent + saved,
    personal: st.personalCash,
    netWorth: G.netWorth(),
    decisionWeeks: (m.decisionWeeks / m.weeks) * 100,
    newsPerWeek: m.news / m.weeks,
    overloadWeeks: (m.overload / m.weeks) * 100,
    apUse: (m.apUsed / (m.weeks * G.TUNE.ap)) * 100,
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
const bots = args.includes('--all') ? ['attentive', 'youth', 'veteran', 'careless', 'passive'] : [arg('bot', 'attentive')];
const noMoney = args.includes('--no-money');           // 투자·배당·아이템을 하지 않는 봇과 비교
const order = arg('order', '') ? arg('order').split(',') : null; // 이 투자만, 이 순서로 (예: --order lawyer)
const G0 = loadGame(); // 결과 표시용 (TUNE·아이템 목록)
Object.assign(G0.TUNE, tune);

function runBot(bot) {
  const workers = Math.min(os.cpus().length, games);
  const per = Array.from({ length: workers }, (_, i) => Math.floor(games / workers) + (i < games % workers ? 1 : 0));
  return Promise.all(per.map(n => new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: { games: n, bot, seasons, tune, noMoney, order } });
    w.on('message', resolve);
    w.on('error', reject);
  }))).then(parts => parts.flat());
}

const mean = (rows, key) => {
  const vals = rows.map(r => r[key]).filter(v => v !== null && v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
};
const median = (rows, key) => {
  const vals = rows.map(r => r[key]).sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
};

(async () => {
  const t0 = Date.now();
  const summary = {};
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
    console.log(`    중앙값: 번 돈 $${Math.round(median(rows, 'earned')).toLocaleString()}, 법인 자금 $${Math.round(median(rows, 'cash')).toLocaleString()}, 개인 자산 $${Math.round(median(rows, 'netWorth')).toLocaleString()}, 주 수입 $${Math.round(median(rows, 'income')).toLocaleString()}`);
  }
  if (summary.youth && summary.veteran) {
    // 5단계부터 자금은 투자·아이템에 쓰이므로 "번 돈"(쓴 돈 + 늘어난 자금)으로 비교
    const ratio = mean(summary.youth, 'earned') / mean(summary.veteran, 'earned');
    console.log(`\n  ${ratio >= 0.8 && ratio <= 1.25 ? '✓' : '✗'} 유망주 전략 / 베테랑 전략 번 돈 비율 ${ratio.toFixed(2)} (목표 0.8~1.25)`);
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}초`);
})();
