# Be The Agent (`jn5310/be-the-agent`) — 프로젝트 명세서 & 구현 코드 정리

이 문서는 **Be The Agent (FC 에이전트 라이프)** 프로젝트의 기획 명세, 핵심 수식, 데이터 구조, 그리고 **지금까지 구현된 전체 프로토타입 코드**를 하나로 정리한 마스터 문서(`AGENTS.md` / `README.md`)입니다. 어떤 AI 코딩 도구(Cursor, Claude Code, GitHub Copilot, Windsurf 등)로 작업하더라도 이 문서만 읽으면 즉시 이어서 개발할 수 있습니다.

## 1. 코딩 원칙 (Ponytail: Lazy Senior Dev Mode)

다른 AI 코딩 툴이나 에디터에서 이 레포지토리를 열 때 아래 규칙을 최우선으로 적용합니다.

1. **가장 작고 완전한 변경 (Smallest Complete Change):** 요청하지 않은 추상화, 래퍼(Wrapper), 미래를 대비한 보일러플레이트, 불필요한 외부 패키지 추가를 금지합니다.

2. **표준 플랫폼 및 기존 코드 우선:** 이미 코드베이스에 있는 헬퍼 함수와 브라우저/플랫폼 내장 API를 최우선으로 재사용합니다.

3. **사이드 이펙트 전수 확인:** 함수를 수정하기 전 해당 함수를 호출하는 모든 곳(UI 렌더링, 세이브 데이터, 주간 정산 로직)을 확인하고 한 곳에서 근본 원인을 수정합니다.

4. **자가 검증 (Self-Check 필수):** 돈 계산(수수료, 배당세, 주간 유지비)이나 확률 로직을 추가·수정할 때는 반드시 `runSelfCheck()` 내 `console.assert` 테스트를 함께 업데이트합니다.

5. **절대 생략 금지 항목:** 세이브 데이터 로드 시 예외 처리(`try/catch`), 모바일 터치 영역 확보, 유저가 명시적으로 요청한 기능은 생략하지 않습니다.

## 2. 게임 개요 및 핵심 루프

| 항목 | 확정 사양 |
| ----- | ----- |
| **프로젝트명** | Be The Agent (`jn5310/be-the-agent`) |
| **타겟 플랫폼** | 모바일 우선 (iOS / Android 세로형 반응형 UI) + Steam (PC 가로형 호환) |
| **출시 및 BM 모델** | 초기 무료 출시 (싱글플레이 오프라인 우선, 추후 온라인 기능 확장 가능) |
| **라이선스 정책** | 법적 분쟁 방지를 위해 100% 가상 리그·구단·선수 생성기 사용 |
| **시간 진행 단위** | **주간(Weekly) 턴 진행** (1시즌 = 52주) |
| **행동력 제약** | 주당 기본 **3 AP** 부여 (오피스 확장 시 최대 AP 증가, 다음 주 진행 시 회복) |
| **커리어 엔딩** | 에이전트 **30세 시작 ~ 60세 정년 은퇴** (총 30시즌 플레이 후 명예의 전당 결산) |

### 주간 진행(Turn) 루프

1. **평일 업무 (AP 소모):**

   * 소속 선수 이적/재계약 협상 (`1 AP`)
   * 소속 선수 면담 및 언론 홍보로 사기 진작·타 구단 오퍼 유도 (`1 AP`)
   * 신규 유망주/FA 선수 스카우트 영입 제안 (`1 AP`) 또는 스카우트 명단 갱신 (`1 AP` + 법인 자금 `$1,500`)
   * 법인 인프라 투자 및 개인 라이프스타일 아이템 구매 (`AP 소모 없음`, 자금만 소모)

2. **주말 경기 및 주간 정산 (`다음 주 ▶` 클릭):**

   * 소속 선수 전원 리그 경기 텍스트 시뮬레이션 진행 (득점, 도움, OVR 성장, 이적 오퍼 발생)
   * 소속 선수들의 주급 수수료 + 득점 보너스 수수료가 **법인 계좌**로 자동 입금
   * 에이전시 주간 기본 유지비 및 고용 인력 유지비가 **법인 계좌**에서 자동 차감
   * 52주차 종료 시 새 시즌 개막 및 에이전트·선수 나이 `+1세` 증가 (60세 도달 시 은퇴 엔딩)

## 3. 이원화 자금 시스템 (법인 계좌 vs 개인 계좌)

현실의 스포츠 에이전시 운영 방식처럼 법인 계좌(Agency Cash)와 개인 계좌(Personal Cash)를 엄격히 분리합니다.

| 구분 | 법인 계좌 (Agency Wallet) | 개인 계좌 (Personal Wallet) |
| ----- | ----- | ----- |
| **주요 수입원** | 주간 주급 수수료, 이적/재계약 타결 수수료, 골 보너스 수수료 | 법인 계좌에서의 배당금 인출 (**배당 소득세 15% 공제** 후 실수령 85%) |
| **주요 지출원** | 주간 사무실/인력 유지비, 신규 선수 영입 추진비, 스카우트 갱신비, 에이전시 인프라 투자 | 에이전트 개인의 고급 의류, 시계, 차량, VIP 박스, 부동산 구매 |
| **게임 내 역할** | 에이전시 규모 확장 (관리 선수 한도 증가, AP 증가, 선수 성장 가속) | 에이전트 개인 스탯 보조 (구단 협상 수락률·선수 영입률·명성 소폭 상승) |

## 3.5 고교 주말리그 시찰 & 선수 세부 스탯·감정·건강 시스템

1. **전국 명문 고등학교 시찰 투어 (`FICTIONAL_HIGH_SCHOOLS`):**
   * 전국 6개 권역 명문고(`서울 한빛고`, `수원 청룡고`, `포항 해맞이고`, `울산 태화고`, `부산 갈매기고`, `광주 무등고`)를 `1 AP`와 출장비(`$500~$800`)로 시찰해 고교 유망주(16~18세, 고1~고3) 3명을 발굴합니다.
   * 고교 주말리그 경기 기록(경기 수, 득점, 도움, 평점 `6.5~9.6`)이 매주 누적되며, 영입 시 프로 구단 입단 오퍼와 함께 19세 이하 주간 성장 확률 보너스(`+12%`)를 받습니다.
2. **4대 핵심 세부 스탯 (`stats`):**
   * 모든 선수(소속 선수, 프로 스카우트, 고교 유망주)는 `스피드(spd)`, `결정력(fin)`, `패스(pas)`, `피지컬(phy)` 4대 핵심 스탯을 보유하며, OVR 성장 시 함께 상승합니다.
3. **선수 현재 상황 — 감정(`morale`) & 건강(`fitness`, `injuryWeeks`):**
   * **감정 상태:** `😊 행복 (82+)`, `🙂 평온 (62~81)`, `😐 불안 (45~61)`, `😡 슬럼프 (45 미만)` 4단계로 표시되며 경기 퍼포먼스에 영향을 줍니다.
   * **건강 상태:** `💚 건강 최상 (82%+)`, `💛 피로 누적 (62~81%)`, `🧡 체력 고갈 (62% 미만)`, `🏥 부상 (1~2주 결장)`으로 표시됩니다.
   * **케어/홍보 (`1 AP`):** 선수의 감정(`+14`)과 건강(`+18%`)을 즉시 회복시키고 부상 주차를 단축하며, 일정 확률로 타 구단 오퍼를 유도합니다.

## 4. 핵심 수식 및 밸런스 공식

어떤 언어나 엔진(HTML/TS, React, Godot, Unity, Flutter)으로 포팅하더라도 아래 핵심 수식을 동일하게 유지합니다.

### 4.1 에이전트 계약 수수료 (FIFA 규정 기반 5% ~ 10%)

* **주간 고정 수수료:**
  * `weeklyFee = Math.max(50, Math.round(weeklyWage * (agentFeePct / 100)))`
* **이적/재계약 성사 시 일시불 수수료 (연봉 총액 + 계약금 기준):**
  * `annualSalary = weeklyWage * 52`
  * `contractCommission = Math.round((annualSalary + signingBonus) * (agentFeePct / 100))`
* **득점 발생 시 골 보너스 수수료:**
  * `goalBonusCut = Math.round(goalBonus * (agentFeePct / 100))`

### 4.2 구단 협상 수락 확률 (`15%` ~ `95%` 클램프)

* 기본 수락 확률 `82%`에서 시작해 요구 조건에 따라 증감합니다:
  * **요구 주급 인상률 패널티:** `-(wagePct - 100) * 0.75`
  * **요구 계약금 인상률 패널티:** `-(bonusPct - 100) * 0.22`
  * **에이전트 수수료율 보정:** `5%` 선택 시 `+10%`, `8%` 선택 시 `0%`, `10%` 선택 시 `-12%`
  * **바이아웃 & 골수당 옵션 보정:** 구단 친화적(높은 바이아웃) `+12%`, 선수 친화적(낮은 바이아웃 + 고액 골수당) `-10%`
  * **에이전트 버프 합산:** 변호사 채용(`+8%`) + 개인 아이템 협상 보너스(최대 `+15%`) + 명성 보너스(`Math.min(12, Math.floor(rep / 5))`)

### 4.3 밸런스 상한선 (Over-buff 방지 캡)

* 개인 아이템과 법인 업그레이드를 모두 합쳐도 게임 밸런스가 무너지지 않도록 상한선을 둡니다:
  * **협상 수락률 총합 보너스 상한:** 최대 `+25%`
  * **선수 스카우트 영입률 총합 보너스 상한:** 최대 `+28%`

## 5. 법인 업그레이드 및 개인 아이템 테이블

### 5.1 법인 인프라 & 전문 인력 (`AGENCY_UPGRADES`)

| ID | 명칭 | 도입 비용 (법인) | 주간 유지비 | 효과 |
| ----- | ----- | ----- | ----- | ----- |
| `lawyer` | 스포츠 계약 전문 변호사 채용 | `$18,000` | `$400/주` | 구단 협상 수락 확률 `+8%` |
| `scout_net` | 유럽·남미 스카우트 분석망 구축 | `$22,000` | `$500/주` | 고잠재력 유망주 등장 및 영입 확률 `+10%` |
| `office_expand` | 메트로폴리탄 에이전시 오피스 확장 | `$35,000` | `$800/주` | 최대 관리 선수 `+3명` (5➔8명), 주간 행동력 `+1 AP` (3➔4 AP) |
| `physio` | 전담 피지컬 & 멘탈 코치 계약 | `$28,000` | `$600/주` | 주간 경기 활약 시 선수 OVR 성장 확률 상승 (`25%` ➔ `45%`) |

### 5.2 개인 라이프스타일 아이템 (`LIFESTYLE_ITEMS`)

| ID | 명칭 | 구매 가격 (개인) | 협상력 보너스 | 영입률 보너스 | 명성 증가 |
| ----- | ----- | ----- | ----- | ----- | ----- |
| `suit` | 나폴리 비스포크 수트 | `$3,500` | `+2%` | `+1%` | `+2` |
| `watch` | 스위스 크로노그래프 오토매틱 시계 | `$9,500` | `+2%` | `+3%` | `+4` |
| `sedan` | 플래그십 이그제큐티브 세단 | `$32,000` | `+3%` | `+4%` | `+8` |
| `vip_box` | 유럽 스타디움 VIP 스카이박스 회원권 | `$75,000` | `+4%` | `+5%` | `+15` |
| `penthouse` | 런던·마드리드 더블 펜트하우스 | `$180,000` | `+4%` | `+5%` | `+30` |

## 6. 세이브 데이터 스키마 (`localStorage` JSON)

다른 프레임워크로 마이그레이션할 때도 아래 JSON 스키마를 유지하면 기존 세이브 데이터를 그대로 호환할 수 있습니다.

```json
{
  "season": 1,
  "week": 1,
  "age": 30,
  "rep": 12,
  "agencyCash": 25000,
  "personalCash": 5000,
  "ap": 3,
  "activeTab": "clients",
  "ownedUpgrades": ["lawyer"],
  "ownedItems": ["suit"],
  "clients": [
    {
      "id": "p_starter_1",
      "name": "김 도윤",
      "pos": "FW",
      "age": 19,
      "ovr": 68,
      "pot": 84,
      "club": "한강 유나이티드",
      "league": "K-메트로 리그",
      "wage": 2800,
      "agentFeePct": 8,
      "goalBonus": 700,
      "marketValue": 180000,
      "morale": 85,
      "goals": 2,
      "assists": 1,
      "hasOffer": true,
      "weeksLeft": 36
    }
  ],
  "scoutPool": [],
  "logs": []
}
```

## 7. 구현된 코드 아키텍처 요약 (9개 섹션 구조)

현재 작성된 단일 파일(`index.html` / `football_agent_mvp.html`)의 내부 코드는 유지보수와 모듈 분리가 쉽도록 아래 9개 블록으로 나뉘어 있습니다.

| 섹션 번호 | 모듈명 | 주요 함수 및 상수 | 역할 설명 |
| ----- | ----- | ----- | ----- |
| **Section 1** | 데이터 및 상수 정의 | `FICTIONAL_CLUBS`, `AGENCY_UPGRADES`, `LIFESTYLE_ITEMS` | 라이선스 안전 가상 구단 10개, 법인 투자 4종, 개인 아이템 5종 정의 |
| **Section 2** | Web Audio 효과음 합성기 | `playTone(freq, duration, type)` | 외부 오디오 에셋 없이 클릭·타결·결렬 효과음 실시간 합성 |
| **Section 3** | 핵심 수식 순수 함수 | `calculateContractCommission`, `calculateWeeklyAgencyFee`, `calculateNetDividend`, `computeAgentBuffs` | UI와 분리된 순수 계산 함수 (단위 테스트 대상) |
| **Section 4** | 초기 상태 & 선수 생성기 | `createRandomPlayer(tierHint)`, `createInitialState()` | 나이(17~28세)·OVR·잠재력·주급 비례 생성 및 30세 초기 세이브 생성 |
| **Section 5** | 로컬 저장소 & 토스트 UI | `saveState()`, `loadState()`, `showToast(msg)`, `addLog(msg)` | `try/catch` 안전 로컬 세이브 및 상단 알림·주간 로그 피드 관리 |
| **Section 6** | 핵심 게임플레이 액션 | `openNegotiationModal`, `submitNegotiation`, `signScoutedPlayer`, `transferDividend`, `advanceWeek` | AP 차감, 협상 확률 주사위, 주간 리그 시뮬레이션, 60세 은퇴 트리거 |
| **Section 7** | 반응형 DOM 렌더러 | `renderAll()` | 상단 자산 바, 선수단 카드, 스카우트 리스트, 법인/개인 상점 동기화 렌더링 |
| **Section 8** | Ponytail 자가 검증 | `runSelfCheck()` | 로드 시 수수료·배당세·버프 합산 수식을 `console.assert`로 자동 검증 |
| **Section 9** | 이벤트 바인딩 & 초기화 | `DOMContentLoaded` 리스너, 이벤트 위임(`data-action`) | 탭 전환, 슬라이더 실시간 미리보기, 동적 카드 버튼 클릭 처리 |

## 8. 지금까지 코딩한 전체 소스 코드 (`index.html`)

아래 코드 블록을 저장소 루트의 `index.html`로 저장하면 빌드 도구 없이 즉시 실행됩니다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>FC 에이전트 라이프 (Be The Agent)</title>
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0b1120;
      color: #f1f5f9;
      -webkit-tap-highlight-color: transparent;
    }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">

  <!-- Calm & Clean Top Header -->
  <header class="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
    <div class="max-w-4xl mx-auto space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs">FA</span>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-bold text-sm sm:text-base tracking-tight text-white">FC 에이전트 라이프</h1>
              <span id="rep-badge" class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">명성 12</span>
            </div>
            <p id="date-display" class="text-[11px] text-slate-400 mt-0.5">1시즌 1주차 · 나이 30세 (은퇴 60세)</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <button id="btn-sound-toggle" type="button" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition">
            🔊 효과음
          </button>
          <button id="btn-reset-game" type="button" class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border border-slate-800 transition">
            초기화
          </button>
        </div>
      </div>

      <!-- Simplified 3-Column Summary Bar -->
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-slate-900/90 border border-slate-800/80 rounded-xl px-3 py-2">
          <div class="text-[11px] text-slate-400 flex items-center justify-between">
            <span>법인 자금</span>
            <span id="weekly-upkeep-label" class="text-[10px] text-slate-400">-$500/주</span>
          </div>
          <div id="agency-cash-display" class="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 truncate">$25,000</div>
        </div>

        <div class="bg-slate-900/90 border border-slate-800/80 rounded-xl px-3 py-2">
          <div class="text-[11px] text-slate-400 flex items-center justify-between">
            <span>개인 자산</span>
            <span id="buff-summary-label" class="text-[10px] text-sky-400">+0% 협상</span>
          </div>
          <div id="personal-cash-display" class="text-sm sm:text-base font-bold text-sky-400 mt-0.5 truncate">$5,000</div>
        </div>

        <div class="bg-slate-900/90 border border-slate-800/80 rounded-xl px-3 py-2 flex items-center justify-between gap-1">
          <div>
            <div class="text-[11px] text-slate-400">행동력</div>
            <div id="ap-display" class="text-sm sm:text-base font-bold text-amber-400 mt-0.5">3 / 3 AP</div>
          </div>
          <button id="btn-next-week" type="button" class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs transition">
            다음 주 ▶
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Toast Banner -->
  <div id="toast-container" class="fixed top-32 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 opacity-0">
    <div id="toast-box" class="px-4 py-2 rounded-full bg-slate-800/95 border border-emerald-500/50 text-xs font-semibold text-emerald-300 shadow-lg"></div>
  </div>

  <!-- Main Content Container -->
  <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-4 pb-28 space-y-5">

    <!-- Compact 1-Line Collapsible News Bar (No more visual clutter!) -->
    <section class="bg-slate-900/70 border border-slate-800/80 rounded-xl px-3.5 py-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
          <p id="latest-log-line" class="text-xs text-slate-200 truncate">에이전시 설립 완료! 소속 선수 2명과 함께 시즌을 시작합니다.</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="self-check-indicator" class="hidden sm:inline text-[10px] text-slate-500 font-mono">✔ OK</span>
          <button id="btn-toggle-logs" type="button" class="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80">
            기록 더보기 ▾
          </button>
        </div>
      </div>
      <div id="log-feed" class="hidden mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1.5 max-h-36 overflow-y-auto text-xs text-slate-400"></div>
    </section>

    <!-- Tab 1: Clients -->
    <section id="view-clients" class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-white">소속 선수단</h2>
          <p class="text-xs text-slate-400 mt-0.5">선수들의 세부 스탯, 감정(사기), 건강(컨디션)을 관리하고 계약을 협상합니다.</p>
        </div>
        <span id="client-count-badge" class="text-xs font-semibold px-3 py-1 rounded-full bg-slate-900 text-slate-300 border border-slate-800">2 / 5명</span>
      </div>
      <div id="clients-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
    </section>

    <!-- Tab 2: Scouting (Clean Segmented Sub-View: High School vs Pro) -->
    <section id="view-scouting" class="space-y-4 hidden">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button id="btn-scout-sub-hs" type="button" class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 transition">
            🏫 고교 주말리그 시찰
          </button>
          <button id="btn-scout-sub-pro" type="button" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition">
            🌍 프로·글로벌 영입
          </button>
        </div>

        <span id="current-school-badge" class="text-xs font-medium px-3 py-1 rounded-full bg-slate-900 text-amber-300 border border-slate-800">시찰교: 서울 한빛고</span>
      </div>

      <!-- Sub-View A: High School Scouting -->
      <div id="subview-hs-scouting" class="space-y-4">
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-300">시찰할 고등학교 선택 (1 AP · 출장비 소모)</span>
            <span class="text-[11px] text-slate-400">학교마다 특화 포지션이 다릅니다</span>
          </div>
          <div id="high-school-list" class="grid grid-cols-2 sm:grid-cols-3 gap-2"></div>
        </div>

        <div id="hs-scouting-list" class="grid grid-cols-1 md:grid-cols-3 gap-3.5"></div>
      </div>

      <!-- Sub-View B: Pro Scouting -->
      <div id="subview-pro-scouting" class="space-y-3.5 hidden">
        <div class="flex items-center justify-between flex-wrap gap-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
          <div>
            <h3 class="text-sm font-bold text-white">프로 &amp; 글로벌 FA 스카우트</h3>
            <p class="text-xs text-slate-400 mt-0.5">즉시 전력감 프로 선수와 대리 계약을 맺습니다.</p>
          </div>
          <button id="btn-refresh-scouting" type="button" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700 transition">
            🔄 명단 갱신 (1 AP · 법인 $1,500)
          </button>
        </div>
        <div id="scouting-list" class="grid grid-cols-1 md:grid-cols-2 gap-3.5"></div>
      </div>
    </section>

    <!-- Tab 3: Agency Finance & Upgrades -->
    <section id="view-agency" class="space-y-4 hidden">
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="text-base font-bold text-white">법인 수익 배당 (법인 ➔ 개인 계좌)</h2>
            <p class="text-xs text-slate-400 mt-0.5">법인 자금을 개인 계좌로 인출할 때 배당 소득세 15%가 공제됩니다.</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-payout-10k" type="button" class="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition">
              $10,000 배당 (실수령 $8,500)
            </button>
            <button id="btn-payout-50k" type="button" class="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition">
              $50,000 배당 (실수령 $42,500)
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-2.5">
        <h3 class="text-sm font-bold text-white">에이전시 인프라 &amp; 전문 인력 투자</h3>
        <div id="agency-upgrades-list" class="grid grid-cols-1 md:grid-cols-2 gap-3.5"></div>
      </div>
    </section>

    <!-- Tab 4: Personal Lifestyle Shop -->
    <section id="view-lifestyle" class="space-y-4 hidden">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-base font-bold text-white">에이전트 라이프스타일 컬렉션</h2>
          <p class="text-xs text-slate-400 mt-0.5">구단 협상력, 선수 영입 호감도, 명성을 높여주는 개인 자산입니다.</p>
        </div>
        <div id="total-personal-assets" class="text-xs font-semibold px-3 py-1 rounded-full bg-slate-900 text-sky-300 border border-slate-800">
          보유 아이템 0개
        </div>
      </div>
      <div id="lifestyle-items-list" class="grid grid-cols-1 md:grid-cols-2 gap-3.5"></div>
    </section>

  </main>

  <!-- Negotiation Modal -->
  <div id="negotiation-modal" class="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-3">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
      <div class="flex items-start justify-between border-b border-slate-800 pb-3">
        <div>
          <span id="neg-club-badge" class="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">구단 협상 테이블</span>
          <h3 id="neg-title" class="text-base font-bold text-white mt-1">계약 협상</h3>
          <p id="neg-subtitle" class="text-xs text-slate-400"></p>
        </div>
        <button id="btn-close-neg" type="button" class="text-slate-400 hover:text-white text-sm font-bold px-2 py-1">✕</button>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300 font-medium">요구 주급 (Weekly Wage)</span>
            <span id="neg-wage-val" class="font-bold text-white">$10,000 / 주</span>
          </div>
          <input id="neg-wage-slider" type="range" min="80" max="150" value="110" class="w-full accent-emerald-400" />
        </div>

        <div>
          <div class="flex justify-between mb-1">
            <span class="text-slate-300 font-medium">계약금 / 이적 보너스 (Signing Bonus)</span>
            <span id="neg-bonus-val" class="font-bold text-white">$50,000</span>
          </div>
          <input id="neg-bonus-slider" type="range" min="50" max="200" value="100" class="w-full accent-emerald-400" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <label for="neg-fee-select" class="block text-[11px] text-slate-400 mb-1">에이전트 수수료율</label>
            <select id="neg-fee-select" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-400">
              <option value="5">5% (구단 우호적 +10%)</option>
              <option value="8" selected>8% (표준 수수료)</option>
              <option value="10">10% (최대치 -12%)</option>
            </select>
          </div>

          <div class="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <label for="neg-clause-select" class="block text-[11px] text-slate-400 mb-1">바이아웃 &amp; 수당 옵션</label>
            <select id="neg-clause-select" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-sky-300">
              <option value="standard" selected>표준 바이아웃 + 골수당</option>
              <option value="club_friendly">높은 바이아웃 (구단 선호 +12%)</option>
              <option value="player_friendly">낮은 바이아웃 + 고액 골수당 (-10%)</option>
            </select>
          </div>
        </div>

        <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div class="text-[11px] text-slate-400">성사 시 즉시 법인 수수료 수입</div>
            <div id="neg-expected-commission" class="text-sm font-extrabold text-emerald-400">$18,000</div>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-slate-400">구단 수락 확률</div>
            <div id="neg-chance-display" class="text-sm font-extrabold text-amber-400">72%</div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button id="btn-cancel-neg" type="button" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">
          취소
        </button>
        <button id="btn-submit-neg" type="button" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition">
          최종 계약서 제시 (1 AP)
        </button>
      </div>
    </div>
  </div>

  <!-- Retirement Summary Modal -->
  <div id="retirement-modal" class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 text-center space-y-4 shadow-2xl">
      <div class="text-3xl">🏆</div>
      <h2 class="text-lg font-extrabold text-white">60세 정년 은퇴 · 에이전트 명예의 전당</h2>
      <p id="retirement-summary-text" class="text-xs text-slate-300 leading-relaxed"></p>
      <button id="btn-restart-career" type="button" class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs">
        새 커리어 시작하기
      </button>
    </div>
  </div>

  <!-- Bottom Mobile Tab Bar -->
  <nav class="fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80">
    <div class="max-w-4xl mx-auto grid grid-cols-4">
      <button id="tab-btn-clients" type="button" data-tab="clients" class="tab-nav-btn py-3 flex flex-col items-center gap-0.5 text-emerald-400 font-bold text-xs border-t-2 border-emerald-400">
        <span>⚽ 선수단</span>
      </button>
      <button id="tab-btn-scouting" type="button" data-tab="scouting" class="tab-nav-btn py-3 flex flex-col items-center gap-0.5 text-slate-400 font-medium text-xs border-t-2 border-transparent">
        <span>🔍 스카우트</span>
      </button>
      <button id="tab-btn-agency" type="button" data-tab="agency" class="tab-nav-btn py-3 flex flex-col items-center gap-0.5 text-slate-400 font-medium text-xs border-t-2 border-transparent">
        <span>🏢 법인/투자</span>
      </button>
      <button id="tab-btn-lifestyle" type="button" data-tab="lifestyle" class="tab-nav-btn py-3 flex flex-col items-center gap-0.5 text-slate-400 font-medium text-xs border-t-2 border-transparent">
        <span>⌚ 개인/아이템</span>
      </button>
    </div>
  </nav>

  <script>
    const STORAGE_KEY = 'fc_agent_mvp_save_v1';
    const RETIREMENT_AGE = 60;
    const WEEKS_PER_SEASON = 52;
    const DIVIDEND_TAX_RATE = 0.15;

    const FICTIONAL_CLUBS = [
      { name: '노스런던 로열스', league: '알비온 프리미어', tier: 3 },
      { name: '맨체스터 크라운', league: '알비온 프리미어', tier: 4 },
      { name: '마드리드 솔라르', league: '이베리아 프리메라', tier: 4 },
      { name: '카탈루냐 블루스', league: '이베리아 프리메라', tier: 4 },
      { name: '밀라노 네로', league: '롬바르디아 세리에', tier: 3 },
      { name: '라인란트 1904', league: '라인 분데스', tier: 3 },
      { name: '한강 유나이티드', league: 'K-메트로 리그', tier: 1 },
      { name: '남해 시티즌', league: 'K-메트로 리그', tier: 1 },
      { name: '리스본 애슬레틱', league: '아틀란틱 리그', tier: 2 },
      { name: '암스테르담 아약스풍', league: '네덜란드 에레', tier: 2 }
    ];

    const FIRST_NAMES = ['민준', '서준', '현우', '지훈', '루카스', '마테오', '레오', '하비', '마르코', '케빈', '엘링', '주드', '다비드', '리카르도'];
    const LAST_NAMES = ['김', '이', '박', '정', '실바', '모레노', '발베르데', '벨링', '마르티네스', '베르너', '산토스', '코스타', '린드스트롬'];
    const POSITIONS = ['FW', 'LW', 'CAM', 'CM', 'CB', 'RB', 'GK'];

    const FICTIONAL_HIGH_SCHOOLS = [
      { id: 'hs_seoul', name: '서울 한빛고', region: '서울 권역', specialty: '공격/결정력 특화', travelCost: 500, bonusPos: ['FW', 'LW'] },
      { id: 'hs_suwon', name: '수원 청룡고', region: '경기 권역', specialty: '중원 패스마스터', travelCost: 500, bonusPos: ['CAM', 'CM'] },
      { id: 'hs_pohang', name: '포항 해맞이고', region: '경북 권역', specialty: '활동량 & 기술', travelCost: 700, bonusPos: ['LW', 'CAM'] },
      { id: 'hs_ulsan', name: '울산 태화고', region: '경남/울산 권역', specialty: '초고교급 피지컬', travelCost: 700, bonusPos: ['FW', 'CB'] },
      { id: 'hs_busan', name: '부산 갈매기고', region: '부산 권역', specialty: '스피드 & 역습', travelCost: 800, bonusPos: ['LW', 'RB'] },
      { id: 'hs_gwangju', name: '광주 무등고', region: '호남 권역', specialty: '천재 유망주 산실', travelCost: 800, bonusPos: ['FW', 'CAM'] }
    ];

    const HS_FIRST_NAMES = ['도현', '준서', '시우', '하준', '유찬', '지호', '건우', '우진', '민성', '태윤', '승현', '재민', '현서', '찬희'];
    const HS_LAST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신'];

    const AGENCY_UPGRADES = [
      { id: 'lawyer', name: '스포츠 계약 전문 변호사 채용', cost: 18000, upkeep: 400, desc: '구단 협상 수락 확률 +8% 증가 (영구 적용)', effectLabel: '+8% 협상 수락률' },
      { id: 'scout_net', name: '유럽·남미 스카우트 분석망 구축', cost: 22000, upkeep: 500, desc: '스카우트 명단 갱신 시 고잠재력 유망주 등장 및 영입 확률 +10%', effectLabel: '+10% 선수 영입률' },
      { id: 'office_expand', name: '메트로폴리탄 에이전시 오피스 확장', cost: 35000, upkeep: 800, desc: '최대 관리 가능 선수 한도 +3명 증가 및 주간 행동력 +1 AP', effectLabel: '최대 선수 +3명 · +1 AP' },
      { id: 'physio', name: '전담 피지컬 & 멘탈 코치 계약', cost: 28000, upkeep: 600, desc: '소속 선수 주간 성장 확률 상승, 컨디션 회복 및 부상 예방', effectLabel: '성장 가속 · 건강 회복' }
    ];

    const LIFESTYLE_ITEMS = [
      { id: 'suit', name: '나폴리 비스포크 수트', price: 3500, negBonus: 2, scoutBonus: 1, repBonus: 2, desc: '첫인상을 좌우하는 맞춤 정장. 협상력 +2%, 영입 호감도 +1%' },
      { id: 'watch', name: '스위스 크로노그래프 오토매틱 시계', price: 9500, negBonus: 2, scoutBonus: 3, repBonus: 4, desc: '성공한 에이전트의 상징. 협상력 +2%, 선수 영입률 +3%' },
      { id: 'sedan', name: '플래그십 이그제큐티브 세단', price: 32000, negBonus: 3, scoutBonus: 4, repBonus: 8, desc: '선수 의전용 고급 세단. 협상력 +3%, 선수 영입률 +4%' },
      { id: 'vip_box', name: '유럽 스타디움 VIP 스카이박스 회원권', price: 75000, negBonus: 4, scoutBonus: 5, repBonus: 15, desc: '구단 보드진과 인맥 형성. 협상력 +4%, 선수 영입률 +5%' },
      { id: 'penthouse', name: '런던·마드리드 더블 펜트하우스', price: 180000, negBonus: 4, scoutBonus: 5, repBonus: 30, desc: '최정상 에이전트의 위상. 협상력 +4%, 선수 영입률 +5%' }
    ];

    let soundEnabled = true;
    let audioCtx = null;

    function playTone(freq = 520, duration = 0.07, type = 'sine') {
      if (!soundEnabled) return;
      try {
        if (!audioCtx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) audioCtx = new Ctx();
        }
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {}
    }

    function calculateContractCommission(weeklyWage, signingBonus, agentFeePct) {
      const annualSalary = weeklyWage * WEEKS_PER_SEASON;
      const totalDealValue = annualSalary + signingBonus;
      return Math.round(totalDealValue * (agentFeePct / 100));
    }

    function calculateWeeklyAgencyFee(weeklyWage, agentFeePct) {
      return Math.max(50, Math.round(weeklyWage * (agentFeePct / 100)));
    }

    function calculateNetDividend(grossAmount) {
      return Math.round(grossAmount * (1 - DIVIDEND_TAX_RATE));
    }

    function computeAgentBuffs(ownedUpgrades, ownedItems) {
      let negBonus = 0;
      let scoutBonus = 0;
      let maxClients = 5;
      let maxAp = 3;
      let upkeep = 500;

      if (ownedUpgrades.includes('lawyer')) negBonus += 8;
      if (ownedUpgrades.includes('scout_net')) scoutBonus += 10;
      if (ownedUpgrades.includes('office_expand')) {
        maxClients += 3;
        maxAp += 1;
      }
      AGENCY_UPGRADES.forEach(u => {
        if (ownedUpgrades.includes(u.id)) upkeep += u.upkeep;
      });
      LIFESTYLE_ITEMS.forEach(item => {
        if (ownedItems.includes(item.id)) {
          negBonus += item.negBonus;
          scoutBonus += item.scoutBonus;
        }
      });

      return {
        negBonus: Math.min(25, negBonus),
        scoutBonus: Math.min(28, scoutBonus),
        maxClients,
        maxAp,
        upkeep
      };
    }

    function generateStatsForPlayer(ovr, pos) {
      const base = Math.max(55, ovr);
      return {
        spd: Math.min(96, base + (pos === 'LW' || pos === 'RB' ? 5 : 0) + Math.floor(Math.random() * 8) - 2),
        fin: Math.min(96, base + (pos === 'FW' ? 6 : pos === 'CB' ? -8 : 0) + Math.floor(Math.random() * 8) - 2),
        pas: Math.min(96, base + (pos === 'CAM' || pos === 'CM' ? 6 : 0) + Math.floor(Math.random() * 8) - 2),
        phy: Math.min(96, base + (pos === 'CB' || pos === 'FW' ? 5 : 0) + Math.floor(Math.random() * 8) - 2)
      };
    }

    function ensurePlayerStatusAndStats(p) {
      if (!p.stats) p.stats = generateStatsForPlayer(p.ovr || 68, p.pos || 'FW');
      if (typeof p.morale !== 'number') p.morale = 80;
      if (typeof p.fitness !== 'number') p.fitness = 90;
      if (typeof p.injuryWeeks !== 'number') p.injuryWeeks = 0;
      return p;
    }

    function getEmotionBadgeInfo(morale) {
      if (morale >= 82) return { text: `😊 행복 (${morale})`, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      if (morale >= 62) return { text: `🙂 평온 (${morale})`, cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
      if (morale >= 45) return { text: `😐 불안 (${morale})`, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      return { text: `😡 슬럼프 (${morale})`, cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    }

    function getHealthBadgeInfo(fitness, injuryWeeks) {
      if (injuryWeeks > 0) return { text: `🏥 부상 (${injuryWeeks}주 결장)`, cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      if (fitness >= 82) return { text: `💚 건강 최상 (${fitness}%)`, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      if (fitness >= 62) return { text: `💛 피로 누적 (${fitness}%)`, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      return { text: `🧡 체력 고갈 (${fitness}%)`, cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    }

    let nextPlayerId = 100;

    function createRandomPlayer(tierHint = 1) {
      nextPlayerId += 1;
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
      const age = 17 + Math.floor(Math.random() * 12);
      const baseOvr = Math.min(89, 62 + tierHint * 4 + Math.floor(Math.random() * 8));
      const pot = Math.min(94, baseOvr + Math.max(2, 28 - age) + Math.floor(Math.random() * 6));
      const club = FICTIONAL_CLUBS[Math.floor(Math.random() * FICTIONAL_CLUBS.length)];
      const wage = Math.round((Math.pow(Math.max(1, baseOvr - 58), 2.1) * 45) / 100) * 100 + 1200;
      const marketValue = wage * 65;

      return {
        id: 'p_' + nextPlayerId + '_' + Math.floor(Math.random() * 999),
        name: last + ' ' + first,
        pos,
        age,
        ovr: baseOvr,
        pot,
        club: club.name,
        league: club.league,
        wage,
        agentFeePct: 8,
        goalBonus: Math.round(wage * 0.25),
        marketValue,
        morale: 78 + Math.floor(Math.random() * 15),
        fitness: 84 + Math.floor(Math.random() * 14),
        injuryWeeks: 0,
        stats: generateStatsForPlayer(baseOvr, pos),
        goals: 0,
        assists: 0,
        hasOffer: Math.random() < 0.45,
        weeksLeft: 24 + Math.floor(Math.random() * 52)
      };
    }

    function createHighSchoolPlayer(schoolObj, scoutNetOwned = false) {
      nextPlayerId += 1;
      const school = schoolObj || FICTIONAL_HIGH_SCHOOLS[0];
      const first = HS_FIRST_NAMES[Math.floor(Math.random() * HS_FIRST_NAMES.length)];
      const last = HS_LAST_NAMES[Math.floor(Math.random() * HS_LAST_NAMES.length)];
      const useBonusPos = Math.random() < 0.6 && school.bonusPos;
      const pos = useBonusPos
        ? school.bonusPos[Math.floor(Math.random() * school.bonusPos.length)]
        : POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
      const age = 16 + Math.floor(Math.random() * 3);
      const gradeLabel = age === 16 ? '고1' : age === 17 ? '고2' : '고3';

      const isHotProspect = Math.random() < (scoutNetOwned ? 0.55 : 0.35);
      const statBase = isHotProspect ? 72 : 62;
      const stats = {
        spd: Math.min(92, statBase + Math.floor(Math.random() * 16)),
        fin: Math.min(92, statBase + (pos === 'FW' || pos === 'LW' ? 6 : 0) + Math.floor(Math.random() * 15)),
        pas: Math.min(92, statBase + (pos === 'CAM' || pos === 'CM' ? 6 : 0) + Math.floor(Math.random() * 15)),
        phy: Math.min(92, statBase + (pos === 'CB' || pos === 'FW' ? 5 : 0) + Math.floor(Math.random() * 15))
      };

      const hsMatches = 8 + Math.floor(Math.random() * 8);
      const attackingWeight = (pos === 'FW' || pos === 'LW') ? 1.35 : (pos === 'CAM' || pos === 'CM') ? 0.85 : 0.3;
      const hsGoals = Math.max(0, Math.round((stats.fin - 52) * 0.32 * attackingWeight + Math.random() * 4));
      const hsAssists = Math.max(0, Math.round((stats.pas - 52) * 0.28 + Math.random() * 4));
      const rawRating = 6.6 + ((stats.spd + stats.fin + stats.pas + stats.phy) / 4 - 60) * 0.055 + (hsGoals * 0.08 + hsAssists * 0.06);
      const hsRating = Math.min(9.6, Math.max(6.5, Number(rawRating.toFixed(1))));

      const baseOvr = Math.min(71, Math.max(58, Math.round((stats.spd + stats.fin + stats.pas + stats.phy) / 4 * 0.84)));
      const potBonus = isHotProspect ? 18 + Math.floor(Math.random() * 8) : 13 + Math.floor(Math.random() * 7);
      const pot = Math.min(94, Math.max(78, baseOvr + potBonus));
      const wage = Math.round((700 + (baseOvr - 58) * 65) / 50) * 50;
      const marketValue = wage * 55 + (pot - 78) * 6000;

      let scoutNote = '기본기가 탄탄한 고교 주전';
      if (hsRating >= 8.3 && hsGoals >= 8) scoutNote = '🔥 고교 주말리그 득점왕 후보 · 초고교급 결정력';
      else if (hsRating >= 8.2) scoutNote = '🌟 스카우트 만장일치 A급 고교 에이스';
      else if (stats.spd >= 82) scoutNote = '⚡ 전국구 스피드 레이서 · 측면을 파괴하는 유망주';
      else if (stats.pas >= 82) scoutNote = '🎯 탈고교급 시야와 킬패스를 갖춘 플레이메이커';
      else if (stats.phy >= 82) scoutNote = '🛡️ 성인 무대에서도 통할 탄탄한 피지컬';

      return {
        id: 'hs_' + nextPlayerId + '_' + Math.floor(Math.random() * 999),
        name: last + ' ' + first,
        pos,
        age,
        gradeLabel,
        ovr: baseOvr,
        pot,
        isHighSchool: true,
        schoolId: school.id,
        schoolName: school.name,
        club: school.name + ' (고교리그)',
        league: school.region + ' 고교리그',
        wage,
        agentFeePct: 9,
        goalBonus: Math.round(wage * 0.25),
        marketValue,
        morale: 86,
        fitness: 92,
        injuryWeeks: 0,
        goals: hsGoals,
        assists: hsAssists,
        hsMatches,
        hsRating,
        stats,
        scoutNote,
        hasOffer: hsRating >= 8.0 || Math.random() < 0.6,
        weeksLeft: 52
      };
    }

    function createInitialState() {
      nextPlayerId = 100;
      const starter1 = {
        id: 'p_starter_1',
        name: '김 도윤',
        pos: 'FW',
        age: 19,
        ovr: 68,
        pot: 84,
        club: '한강 유나이티드',
        league: 'K-메트로 리그',
        wage: 2800,
        agentFeePct: 8,
        goalBonus: 700,
        marketValue: 180000,
        morale: 86,
        fitness: 92,
        injuryWeeks: 0,
        stats: { spd: 76, fin: 74, pas: 65, phy: 68 },
        goals: 2,
        assists: 1,
        hasOffer: true,
        weeksLeft: 36
      };
      const starter2 = {
        id: 'p_starter_2',
        name: '마테오 실바',
        pos: 'CAM',
        age: 22,
        ovr: 73,
        pot: 83,
        club: '리스본 애슬레틱',
        league: '아틀란틱 리그',
        wage: 6400,
        agentFeePct: 7,
        goalBonus: 1500,
        marketValue: 420000,
        morale: 74,
        fitness: 78,
        injuryWeeks: 0,
        stats: { spd: 72, fin: 70, pas: 81, phy: 67 },
        goals: 1,
        assists: 4,
        hasOffer: false,
        weeksLeft: 48
      };

      const initialSchool = FICTIONAL_HIGH_SCHOOLS[0];
      return {
        season: 1,
        week: 1,
        age: 30,
        rep: 12,
        agencyCash: 25000,
        personalCash: 5000,
        ap: 3,
        activeTab: 'clients',
        scoutSubTab: 'hs',
        currentSchoolId: initialSchool.id,
        clients: [starter1, starter2],
        scoutPool: [createRandomPlayer(1), createRandomPlayer(2), createRandomPlayer(2), createRandomPlayer(3)],
        hsScoutPool: [
          createHighSchoolPlayer(initialSchool, false),
          createHighSchoolPlayer(initialSchool, false),
          createHighSchoolPlayer(initialSchool, false)
        ],
        ownedUpgrades: [],
        ownedItems: [],
        logs: [
          '⚽ 에이전시 설립 완료! 소속 선수 2명과 함께 30세 시즌을 시작합니다.',
          '🏫 [스카우트] 탭에서 고교 주말리그 유망주와 프로 선수를 구분해 깔끔하게 살펴보세요.'
        ]
      };
    }

    let state = createInitialState();
    let activeNegotiationPlayerId = null;

    function saveState() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.clients)) {
            if (!parsed.currentSchoolId) parsed.currentSchoolId = FICTIONAL_HIGH_SCHOOLS[0].id;
            if (!parsed.scoutSubTab) parsed.scoutSubTab = 'hs';
            parsed.clients.forEach(ensurePlayerStatusAndStats);
            if (Array.isArray(parsed.scoutPool)) parsed.scoutPool.forEach(ensurePlayerStatusAndStats);
            if (!Array.isArray(parsed.hsScoutPool) || parsed.hsScoutPool.length === 0) {
              const sch = FICTIONAL_HIGH_SCHOOLS.find(h => h.id === parsed.currentSchoolId) || FICTIONAL_HIGH_SCHOOLS[0];
              parsed.hsScoutPool = [
                createHighSchoolPlayer(sch, false),
                createHighSchoolPlayer(sch, false),
                createHighSchoolPlayer(sch, false)
              ];
            } else {
              parsed.hsScoutPool.forEach(ensurePlayerStatusAndStats);
            }
            state = parsed;
          }
        }
      } catch (e) {
        state = createInitialState();
      }
    }

    let toastTimer = null;
    function showToast(msg) {
      const container = document.getElementById('toast-container');
      const box = document.getElementById('toast-box');
      if (!container || !box) return;
      box.textContent = msg;
      container.classList.remove('opacity-0');
      container.classList.add('opacity-100');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        container.classList.remove('opacity-100');
        container.classList.add('opacity-0');
      }, 2400);
    }

    function addLog(msg) {
      state.logs.unshift(`[S${state.season} W${state.week}] ${msg}`);
      if (state.logs.length > 30) state.logs.pop();
    }

    function formatMoney(n) {
      return '$' + Math.round(n).toLocaleString('en-US');
    }

    function switchTab(tabName) {
      state.activeTab = tabName;
      ['clients', 'scouting', 'agency', 'lifestyle'].forEach(t => {
        const view = document.getElementById('view-' + t);
        const btn = document.getElementById('tab-btn-' + t);
        if (view) view.classList.toggle('hidden', t !== tabName);
        if (btn) {
          btn.className = t === tabName
            ? 'tab-nav-btn py-3 flex flex-col items-center gap-0.5 text-emerald-400 font-bold text-xs border-t-2 border-emerald-400'
            : 'tab-nav-btn py-3 flex flex-col items-center gap-0.5 text-slate-400 font-medium text-xs border-t-2 border-transparent';
        }
      });
      playTone(480, 0.04);
      saveState();
    }

    function switchScoutSubTab(subTab) {
      state.scoutSubTab = subTab;
      const hsView = document.getElementById('subview-hs-scouting');
      const proView = document.getElementById('subview-pro-scouting');
      const hsBtn = document.getElementById('btn-scout-sub-hs');
      const proBtn = document.getElementById('btn-scout-sub-pro');
      const schoolBadge = document.getElementById('current-school-badge');

      if (hsView) hsView.classList.toggle('hidden', subTab !== 'hs');
      if (proView) proView.classList.toggle('hidden', subTab !== 'pro');
      if (schoolBadge) schoolBadge.classList.toggle('hidden', subTab !== 'hs');

      if (hsBtn && proBtn) {
        if (subTab === 'hs') {
          hsBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 transition';
          proBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition';
        } else {
          proBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-400 text-slate-950 transition';
          hsBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition';
        }
      }
      playTone(500, 0.04);
      saveState();
    }

    function encouragePlayer(playerId) {
      if (state.ap < 1) return showToast('행동력(AP)이 부족합니다! 다음 주로 넘어가세요.');
      const p = state.clients.find(c => c.id === playerId);
      if (!p) return;
      ensurePlayerStatusAndStats(p);
      state.ap -= 1;

      const wasInjured = p.injuryWeeks > 0;
      p.morale = Math.min(100, p.morale + 14);
      p.fitness = Math.min(100, p.fitness + 18);
      if (p.injuryWeeks > 0) p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);

      if (wasInjured && p.injuryWeeks === 0) {
        addLog(`🏥 ${p.name} 선수 전담 재활 케어 완료! 부상에서 조기 복귀했습니다.`);
        showToast(`${p.name} 부상 완치 & 컨디션 회복!`);
      } else if (!p.hasOffer && Math.random() < 0.65) {
        p.hasOffer = true;
        addLog(`📣 ${p.name} 선수 케어 및 언론 홍보 성공! 사기(${p.morale})·건강(${p.fitness}%) 회복 및 오퍼 도착!`);
        showToast(`${p.name} 컨디션 회복 + 오퍼 도착!`);
      } else {
        addLog(`🤝 ${p.name} 선수 멘탈·컨디션 케어 완료 (감정 ${p.morale}, 건강 ${p.fitness}%).`);
        showToast(`${p.name} 감정 +14 · 건강 +18% 회복!`);
      }
      playTone(620, 0.08);
      saveState();
      renderAll();
    }

    function openNegotiationModal(playerId) {
      const p = state.clients.find(c => c.id === playerId);
      if (!p) return;
      if (state.ap < 1) return showToast('협상에는 1 AP가 필요합니다.');
      activeNegotiationPlayerId = playerId;
      document.getElementById('neg-wage-slider').value = '115';
      document.getElementById('neg-bonus-slider').value = '100';
      document.getElementById('neg-fee-select').value = String(p.agentFeePct || 8);
      document.getElementById('neg-clause-select').value = 'standard';

      const targetClub = FICTIONAL_CLUBS[Math.min(FICTIONAL_CLUBS.length - 1, Math.floor((p.ovr - 60) / 3))] || FICTIONAL_CLUBS[0];
      document.getElementById('neg-club-badge').textContent = p.hasOffer ? `이적 오퍼 · ${targetClub.name}` : `재계약 협상 · ${p.club}`;
      document.getElementById('neg-title').textContent = `${p.name} (${p.pos} · OVR ${p.ovr})`;
      document.getElementById('neg-subtitle').textContent = `현 주급 ${formatMoney(p.wage)} · 시장가치 ${formatMoney(p.marketValue)}`;

      updateNegotiationPreview();
      const modal = document.getElementById('negotiation-modal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      playTone(540, 0.06);
    }

    function closeNegotiationModal() {
      activeNegotiationPlayerId = null;
      const modal = document.getElementById('negotiation-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    function getNegotiationOfferDetails() {
      const p = state.clients.find(c => c.id === activeNegotiationPlayerId);
      if (!p) return null;
      const wagePct = Number(document.getElementById('neg-wage-slider').value || 110);
      const bonusPct = Number(document.getElementById('neg-bonus-slider').value || 100);
      const feePct = Number(document.getElementById('neg-fee-select').value || 8);
      const clause = document.getElementById('neg-clause-select').value;

      const proposedWage = Math.round((p.wage * (wagePct / 100)) / 100) * 100;
      const baseSigningBonus = Math.round(p.wage * 6);
      const proposedBonus = Math.round((baseSigningBonus * (bonusPct / 100)) / 500) * 500;
      const commission = calculateContractCommission(proposedWage, proposedBonus, feePct);

      const buffs = computeAgentBuffs(state.ownedUpgrades, state.ownedItems);
      let chance = 82 - (wagePct - 100) * 0.75 - (bonusPct - 100) * 0.22;
      if (feePct === 5) chance += 10;
      if (feePct === 10) chance -= 12;
      if (clause === 'club_friendly') chance += 12;
      if (clause === 'player_friendly') chance -= 10;
      if (p.hasOffer) chance += 8;
      chance += buffs.negBonus + Math.min(12, Math.floor(state.rep / 5));
      chance = Math.max(15, Math.min(95, Math.round(chance)));

      return { p, proposedWage, proposedBonus, feePct, clause, commission, chance };
    }

    function updateNegotiationPreview() {
      const details = getNegotiationOfferDetails();
      if (!details) return;
      document.getElementById('neg-wage-val').textContent = `${formatMoney(details.proposedWage)} / 주`;
      document.getElementById('neg-bonus-val').textContent = formatMoney(details.proposedBonus);
      document.getElementById('neg-expected-commission').textContent = formatMoney(details.commission);
      const chanceEl = document.getElementById('neg-chance-display');
      chanceEl.textContent = `${details.chance}%`;
      chanceEl.className = details.chance >= 70
        ? 'text-sm font-extrabold text-emerald-400'
        : details.chance >= 45
          ? 'text-sm font-extrabold text-amber-400'
          : 'text-sm font-extrabold text-rose-400';
    }

    function submitNegotiation() {
      const details = getNegotiationOfferDetails();
      if (!details) return;
      if (state.ap < 1) return showToast('행동력이 부족합니다.');
      state.ap -= 1;
      const { p, proposedWage, feePct, clause, commission, chance } = details;

      if (Math.random() * 100 <= chance) {
        if (p.hasOffer) {
          const newClub = FICTIONAL_CLUBS[Math.floor(Math.random() * FICTIONAL_CLUBS.length)];
          p.club = newClub.name;
          p.league = newClub.league;
        }
        p.wage = proposedWage;
        p.agentFeePct = feePct;
        p.goalBonus = clause === 'player_friendly' ? Math.round(proposedWage * 0.35) : Math.round(proposedWage * 0.22);
        p.weeksLeft = 104;
        p.hasOffer = false;
        p.morale = Math.min(100, p.morale + 15);
        state.agencyCash += commission;
        state.rep += 3;
        addLog(`✍️ [계약 타결] ${p.name} (${p.club}) 주급 ${formatMoney(p.wage)}, 수수료 ${formatMoney(commission)} 입금!`);
        showToast(`협상 타결! 법인 +${formatMoney(commission)}`);
        playTone(740, 0.12, 'triangle');
      } else {
        p.morale = Math.max(25, p.morale - 10);
        p.hasOffer = false;
        addLog(`❌ [협상 결렬] ${p.name} 협상이 결렬되어 선수의 감정(사기)이 하락했습니다.`);
        showToast('협상이 결렬되었습니다.');
        playTone(240, 0.12, 'sawtooth');
      }
      closeNegotiationModal();
      saveState();
      renderAll();
    }

    function signScoutedPlayer(playerId) {
      const buffs = computeAgentBuffs(state.ownedUpgrades, state.ownedItems);
      if (state.clients.length >= buffs.maxClients) return showToast(`최대 관리 인원(${buffs.maxClients}명)에 도달했습니다!`);
      if (state.ap < 1) return showToast('선수 영입에는 1 AP가 필요합니다.');
      const idx = state.scoutPool.findIndex(s => s.id === playerId);
      if (idx === -1) return;
      const target = state.scoutPool[idx];
      const signCost = Math.round(target.wage * 1.5);
      if (state.agencyCash < signCost) return showToast(`법인 계좌 잔액이 부족합니다 (${formatMoney(signCost)} 필요).`);

      state.ap -= 1;
      state.agencyCash -= signCost;
      const chance = Math.min(95, Math.max(35, 68 + buffs.scoutBonus + Math.floor(state.rep / 3) - (target.ovr - 68) * 2));
      if (Math.random() * 100 <= chance) {
        state.scoutPool.splice(idx, 1);
        ensurePlayerStatusAndStats(target);
        state.clients.push(target);
        state.rep += 1;
        addLog(`🌟 [신규 고객] ${target.name} (${target.pos}, OVR ${target.ovr}) 선수와 에이전트 전속 계약 체결!`);
        showToast(`${target.name} 영입 성공!`);
        playTone(680, 0.1, 'triangle');
      } else {
        addLog(`💬 ${target.name} 선수가 타 에이전시의 제안을 선택해 영입에 실패했습니다.`);
        showToast('영입 설득에 실패했습니다.');
        playTone(290, 0.09);
      }
      saveState();
      renderAll();
    }

    function refreshScoutingPool() {
      if (state.ap < 1) return showToast('스카우트 갱신에 1 AP가 필요합니다.');
      if (state.agencyCash < 1500) return showToast('법인 자금 $1,500이 필요합니다.');
      state.ap -= 1;
      state.agencyCash -= 1500;
      const tierBoost = state.ownedUpgrades.includes('scout_net') ? 2 : 1;
      state.scoutPool = [
        createRandomPlayer(tierBoost),
        createRandomPlayer(tierBoost),
        createRandomPlayer(tierBoost + 1),
        createRandomPlayer(tierBoost + 1)
      ];
      addLog('🔍 스카우트 팀이 프로 유망주 및 FA 선수 4명의 리포트를 갱신했습니다.');
      showToast('스카우트 명단 갱신 완료!');
      playTone(580, 0.07);
      saveState();
      renderAll();
    }

    function visitHighSchool(schoolId) {
      const school = FICTIONAL_HIGH_SCHOOLS.find(h => h.id === schoolId);
      if (!school) return;
      if (state.ap < 1) return showToast('고교 현장 시찰에는 1 AP가 필요합니다.');
      if (state.agencyCash < school.travelCost) return showToast(`출장비 ${formatMoney(school.travelCost)}가 부족합니다.`);

      state.ap -= 1;
      state.agencyCash -= school.travelCost;
      state.currentSchoolId = school.id;
      const hasScoutNet = state.ownedUpgrades.includes('scout_net');
      state.hsScoutPool = [
        createHighSchoolPlayer(school, hasScoutNet),
        createHighSchoolPlayer(school, hasScoutNet),
        createHighSchoolPlayer(school, hasScoutNet)
      ];
      const topAce = [...state.hsScoutPool].sort((a, b) => b.hsRating - a.hsRating)[0];
      addLog(`🏫 [${school.name} 시찰] 에이스 ${topAce.name}(평점 ${topAce.hsRating}, ${topAce.goals}골 ${topAce.assists}도움) 등 3명 발굴.`);
      showToast(`${school.name} 시찰 완료!`);
      playTone(610, 0.08);
      saveState();
      renderAll();
    }

    function signHighSchoolPlayer(playerId) {
      const buffs = computeAgentBuffs(state.ownedUpgrades, state.ownedItems);
      if (state.clients.length >= buffs.maxClients) return showToast(`최대 관리 인원(${buffs.maxClients}명)에 도달했습니다!`);
      if (state.ap < 1) return showToast('고교 유망주 영입 설득에는 1 AP가 필요합니다.');
      const idx = (state.hsScoutPool || []).findIndex(s => s.id === playerId);
      if (idx === -1) return;
      const target = state.hsScoutPool[idx];
      const signCost = Math.round(target.wage * 1.2);
      if (state.agencyCash < signCost) return showToast(`법인 자금이 부족합니다 (장학·계약 추진비 ${formatMoney(signCost)} 필요).`);

      state.ap -= 1;
      state.agencyCash -= signCost;
      const chance = Math.min(96, Math.max(45, 76 + buffs.scoutBonus + Math.floor(state.rep / 3) - Math.round((target.hsRating - 7.5) * 8)));
      if (Math.random() * 100 <= chance) {
        state.hsScoutPool.splice(idx, 1);
        const debutClub = FICTIONAL_CLUBS.find(c => c.tier === 1) || FICTIONAL_CLUBS[6];
        const signedClient = ensurePlayerStatusAndStats({
          ...target,
          club: `${target.schoolName} ➔ ${debutClub.name} 입단예정`,
          league: debutClub.league,
          hasOffer: true
        });
        state.clients.push(signedClient);
        state.rep += 2;
        addLog(`🎓 [고교 유망주 영입] ${target.schoolName} ${target.name} (${target.gradeLabel}, 잠재 ${target.pot}) 전속 계약 체결!`);
        showToast(`${target.name} (${target.schoolName}) 고객 합류!`);
        playTone(740, 0.11, 'triangle');
      } else {
        addLog(`😅 ${target.schoolName} ${target.name} 학부모 설득에 실패했습니다.`);
        showToast('학부모 및 선수 설득에 실패했습니다.');
        playTone(280, 0.09);
      }
      saveState();
      renderAll();
    }

    function transferDividend(grossAmount) {
      if (state.agencyCash < grossAmount) return showToast('법인 계좌 잔액이 부족합니다.');
      const net = calculateNetDividend(grossAmount);
      state.agencyCash -= grossAmount;
      state.personalCash += net;
      addLog(`💸 법인 ${formatMoney(grossAmount)} 배당 인출 (세금 15% 공제 후 개인 +${formatMoney(net)}).`);
      showToast(`개인 계좌로 ${formatMoney(net)} 입금 완료!`);
      playTone(660, 0.08);
      saveState();
      renderAll();
    }

    function buyAgencyUpgrade(upgradeId) {
      if (state.ownedUpgrades.includes(upgradeId)) return;
      const upg = AGENCY_UPGRADES.find(u => u.id === upgradeId);
      if (!upg) return;
      if (state.agencyCash < upg.cost) return showToast('법인 계좌 잔액이 부족합니다.');
      state.agencyCash -= upg.cost;
      state.ownedUpgrades.push(upgradeId);
      const buffs = computeAgentBuffs(state.ownedUpgrades, state.ownedItems);
      if (upgradeId === 'office_expand') state.ap += 1;
      state.rep += 4;
      addLog(`🏢 [법인 투자] '${upg.name}' 도입 완료! (${upg.effectLabel})`);
      showToast(`${upg.name} 도입 완료!`);
      playTone(720, 0.1, 'triangle');
      saveState();
      renderAll();
    }

    function buyLifestyleItem(itemId) {
      if (state.ownedItems.includes(itemId)) return;
      const item = LIFESTYLE_ITEMS.find(i => i.id === itemId);
      if (!item) return;
      if (state.personalCash < item.price) return showToast('개인 계좌 잔액이 부족합니다! 배당금을 인출하세요.');
      state.personalCash -= item.price;
      state.ownedItems.push(itemId);
      state.rep += item.repBonus;
      addLog(`⌚ [컬렉션 구매] '${item.name}' 획득! 명성 +${item.repBonus}, 협상력 +${item.negBonus}% 상승.`);
      showToast(`${item.name} 구매 완료!`);
      playTone(790, 0.11, 'triangle');
      saveState();
      renderAll();
    }

    function advanceWeek() {
      const buffs = computeAgentBuffs(state.ownedUpgrades, state.ownedItems);
      const hasPhysio = state.ownedUpgrades.includes('physio');
      let totalWeeklyCommission = 0;
      let matchHighlights = [];

      state.clients.forEach(p => {
        ensurePlayerStatusAndStats(p);
        const fee = calculateWeeklyAgencyFee(p.wage, p.agentFeePct);
        totalWeeklyCommission += fee;
        p.weeksLeft = Math.max(1, p.weeksLeft - 1);

        // 부상 중인 경우 경기 결장 및 회복 진행
        if (p.injuryWeeks > 0) {
          p.injuryWeeks = Math.max(0, p.injuryWeeks - (hasPhysio ? 2 : 1));
          p.fitness = Math.min(100, p.fitness + (hasPhysio ? 18 : 12));
          if (p.injuryWeeks === 0) matchHighlights.push(`${p.name} 부상 복귀!`);
          return;
        }

        // 경기 소화로 인한 체력 소모 (전담 코치 보유 시 소모 감소)
        const fatigueLoss = hasPhysio ? (3 + Math.floor(Math.random() * 4)) : (6 + Math.floor(Math.random() * 6));
        p.fitness = Math.max(35, p.fitness - fatigueLoss);

        // 체력이 낮을 때 부상 발생 확률
        if (p.fitness < 60 && Math.random() < (hasPhysio ? 0.06 : 0.18)) {
          p.injuryWeeks = 1 + Math.floor(Math.random() * 2);
          p.morale = Math.max(30, p.morale - 10);
          matchHighlights.push(`${p.name} 경미한 부상(${p.injuryWeeks}주)`);
          return;
        }

        const perfRoll = Math.random() * 100 + (p.morale - 70) * 0.25 + (p.fitness - 75) * 0.2;
        if (perfRoll > 76) {
          p.goals += 1;
          p.morale = Math.min(100, p.morale + 4);
          const goalCut = Math.round(p.goalBonus * (p.agentFeePct / 100));
          totalWeeklyCommission += goalCut;
          matchHighlights.push(`${p.name} 득점!(+${formatMoney(goalCut)})`);
          if (p.ovr < p.pot && Math.random() < ((hasPhysio ? 0.45 : 0.25) + (p.age <= 19 ? 0.12 : 0))) {
            p.ovr += 1;
            p.stats.spd = Math.min(99, p.stats.spd + 1);
            p.stats.fin = Math.min(99, p.stats.fin + 1);
            p.stats.pas = Math.min(99, p.stats.pas + 1);
            p.stats.phy = Math.min(99, p.stats.phy + 1);
            p.marketValue = Math.round(p.marketValue * 1.12);
            matchHighlights.push(`${p.name} OVR ${p.ovr} 상승!`);
          }
          if (Math.random() < 0.35) p.hasOffer = true;
        } else if (perfRoll > 55) {
          p.assists += 1;
          p.morale = Math.min(100, p.morale + 2);
          if (Math.random() < 0.2) p.hasOffer = true;
        } else if (perfRoll < 38) {
          p.morale = Math.max(30, p.morale - 4);
        }
      });

      if (Array.isArray(state.hsScoutPool)) {
        state.hsScoutPool.forEach(hp => {
          hp.hsMatches = (hp.hsMatches || 8) + 1;
          if (Math.random() < 0.45) hp.goals += 1;
          if (Math.random() < 0.35) hp.assists += 1;
        });
      }

      const netAgencyDelta = totalWeeklyCommission - buffs.upkeep;
      state.agencyCash += netAgencyDelta;

      state.week += 1;
      if (state.week > WEEKS_PER_SEASON) {
        state.week = 1;
        state.season += 1;
        state.age += 1;
        state.clients.forEach(p => { p.age += 1; p.fitness = 95; });
        addLog(`🎉 새 시즌 개막! 에이전트 나이 ${state.age}세 시즌이 시작됩니다.`);
      }

      state.ap = buffs.maxAp;
      const highlightText = matchHighlights.length > 0 ? matchHighlights.slice(0, 2).join(' · ') : '소속 선수 전원 무난한 리그 경기 소화';
      addLog(`📊 주간 정산: 수수료 +${formatMoney(totalWeeklyCommission)}, 유지비 -${formatMoney(buffs.upkeep)} (${highlightText})`);

      if (state.age >= RETIREMENT_AGE) openRetirementModal();
      else showToast(`다음 주 진행 (순수익 ${netAgencyDelta >= 0 ? '+' : ''}${formatMoney(netAgencyDelta)})`);

      playTone(500, 0.06);
      saveState();
      renderAll();
    }

    function openRetirementModal() {
      const modal = document.getElementById('retirement-modal');
      const totalNetWorth = state.agencyCash + state.personalCash;
      document.getElementById('retirement-summary-text').textContent =
        `60세 정년 은퇴를 축하합니다! 총 명성 ${state.rep}, 소속 선수 ${state.clients.length}명, 법인·개인 통합 자산 ${formatMoney(totalNetWorth)} 및 컬렉션 아이템 ${state.ownedItems.length}개를 달성하며 전설적인 축구 에이전트로 이름을 남겼습니다.`;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function resetCareer() {
      state = createInitialState();
      saveState();
      document.getElementById('retirement-modal').classList.add('hidden');
      document.getElementById('retirement-modal').classList.remove('flex');
      renderAll();
      showToast('새 에이전트 커리어를 시작합니다.');
    }

    function renderStatMiniGrid(st) {
      const s = st || { spd: 70, fin: 70, pas: 70, phy: 70 };
      const item = (label, val) => `
        <div class="bg-slate-950/90 border border-slate-800/80 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">${label}</span>
          <span class="text-xs font-bold ${val >= 80 ? 'text-amber-300' : val >= 72 ? 'text-emerald-300' : 'text-white'}">${val}</span>
        </div>
      `;
      return `
        <div class="grid grid-cols-4 gap-1.5">
          ${item('스피드', s.spd)}
          ${item('결정력', s.fin)}
          ${item('패스', s.pas)}
          ${item('피지컬', s.phy)}
        </div>
      `;
    }

    function renderAll() {
      const buffs = computeAgentBuffs(state.ownedUpgrades, state.ownedItems);
      document.getElementById('rep-badge').textContent = `명성 ${state.rep}`;
      document.getElementById('date-display').textContent = `${state.season}시즌 ${state.week}주차 · 나이 ${state.age}세 (은퇴 ${RETIREMENT_AGE}세)`;
      document.getElementById('agency-cash-display').textContent = formatMoney(state.agencyCash);
      document.getElementById('personal-cash-display').textContent = formatMoney(state.personalCash);
      document.getElementById('weekly-upkeep-label').textContent = `-${formatMoney(buffs.upkeep)}/주`;
      document.getElementById('buff-summary-label').textContent = `+${buffs.negBonus}% 협상`;
      document.getElementById('ap-display').textContent = `${state.ap} / ${buffs.maxAp} AP`;
      document.getElementById('client-count-badge').textContent = `${state.clients.length} / ${buffs.maxClients}명`;
      document.getElementById('total-personal-assets').textContent = `보유 아이템 ${state.ownedItems.length} / ${LIFESTYLE_ITEMS.length}개`;

      const latestLine = document.getElementById('latest-log-line');
      if (latestLine && state.logs.length > 0) latestLine.textContent = state.logs[0];

      document.getElementById('log-feed').innerHTML = state.logs.map((l, idx) => `
        <div class="${idx === 0 ? 'text-emerald-300 font-semibold' : 'text-slate-400'} leading-snug">${l}</div>
      `).join('');

      document.getElementById('clients-list').innerHTML = state.clients.map(p => {
        ensurePlayerStatusAndStats(p);
        const weeklyCut = calculateWeeklyAgencyFee(p.wage, p.agentFeePct);
        const emotion = getEmotionBadgeInfo(p.morale);
        const health = getHealthBadgeInfo(p.fitness, p.injuryWeeks);

        return `
          <div class="bg-slate-900/90 border ${p.hasOffer ? 'border-emerald-500/50' : 'border-slate-800/90'} rounded-2xl p-4 flex flex-col justify-between gap-3.5">
            <div class="space-y-3">
              <!-- Card Top: Identity & OVR -->
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-800 text-emerald-400">${p.pos}</span>
                    <h3 class="font-bold text-base text-white">${p.name}</h3>
                    <span class="text-xs text-slate-400">${p.age}세${p.schoolName ? ' · ' + p.schoolName : ''}</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">${p.club} · 계약 잔여 ${p.weeksLeft}주</p>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-extrabold text-amber-300">OVR ${p.ovr}</div>
                  <div class="text-[11px] text-slate-400">잠재력 ${p.pot}</div>
                </div>
              </div>

              <!-- Emotion & Health Badges -->
              <div class="flex items-center flex-wrap gap-1.5">
                <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${emotion.cls}">${emotion.text}</span>
                <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${health.cls}">${health.text}</span>
                <span class="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800">시즌 ${p.goals}골 ${p.assists}도움</span>
              </div>

              <!-- 4 Core Stats -->
              ${renderStatMiniGrid(p.stats)}

              <!-- Clean Financial Line -->
              <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80 text-slate-300">
                <span>주급 <b class="text-white">${formatMoney(p.wage)}</b> (${p.agentFeePct}%)</span>
                <span>주간 수수료 <b class="text-emerald-400">+${formatMoney(weeklyCut)}</b></span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 pt-1">
              <button type="button" data-action="negotiate" data-id="${p.id}" class="flex-1 py-2.5 rounded-xl font-bold text-xs transition ${p.hasOffer ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}">
                ${p.hasOffer ? '🔥 이적 오퍼 협상 (1 AP)' : '📝 재계약 협상 (1 AP)'}
              </button>
              <button type="button" data-action="encourage" data-id="${p.id}" class="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition">
                💚 케어/홍보 (1 AP)
              </button>
            </div>
          </div>
        `;
      }).join('');

      const currentSchool = FICTIONAL_HIGH_SCHOOLS.find(h => h.id === state.currentSchoolId) || FICTIONAL_HIGH_SCHOOLS[0];
      const schoolBadge = document.getElementById('current-school-badge');
      if (schoolBadge) schoolBadge.textContent = `시찰교: ${currentSchool.name} (${currentSchool.specialty})`;

      const hsListEl = document.getElementById('high-school-list');
      if (hsListEl) {
        hsListEl.innerHTML = FICTIONAL_HIGH_SCHOOLS.map(sch => {
          const isCurrent = sch.id === currentSchool.id;
          return `
            <button type="button" data-action="visit-school" data-id="${sch.id}" class="text-left p-2.5 rounded-xl border transition ${isCurrent ? 'bg-amber-500/15 border-amber-400 text-white' : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'}">
              <div class="flex items-center justify-between gap-1">
                <span class="font-bold text-xs ${isCurrent ? 'text-amber-300' : 'text-white'}">🏫 ${sch.name}</span>
                <span class="text-[10px] text-slate-400">${formatMoney(sch.travelCost)}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">${sch.specialty}</div>
            </button>
          `;
        }).join('');
      }

      const hsPoolEl = document.getElementById('hs-scouting-list');
      if (hsPoolEl) {
        hsPoolEl.innerHTML = (state.hsScoutPool || []).map(hp => {
          ensurePlayerStatusAndStats(hp);
          const signCost = Math.round(hp.wage * 1.2);
          const chance = Math.min(96, Math.max(45, 76 + buffs.scoutBonus + Math.floor(state.rep / 3) - Math.round((hp.hsRating - 7.5) * 8)));
          const emotion = getEmotionBadgeInfo(hp.morale);
          const health = getHealthBadgeInfo(hp.fitness, hp.injuryWeeks);

          return `
            <div class="bg-slate-900/90 border ${hp.hsRating >= 8.0 ? 'border-amber-500/40' : 'border-slate-800'} rounded-2xl p-3.5 flex flex-col justify-between gap-3">
              <div class="space-y-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300">${hp.pos}</span>
                    <h4 class="font-bold text-sm text-white">${hp.name} <span class="text-xs font-normal text-slate-400">(${hp.age}세·${hp.gradeLabel || '고교'})</span></h4>
                  </div>
                  <span class="text-xs font-bold text-amber-300">OVR ${hp.ovr} <span class="text-slate-400 font-normal">/ 잠재 ${hp.pot}</span></span>
                </div>

                <div class="flex items-center justify-between text-xs bg-slate-950/90 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                  <span class="text-slate-300">${hp.hsMatches || 10}경기 <b>${hp.goals}골 ${hp.assists}도움</b></span>
                  <span class="font-bold text-amber-300">평점 ${hp.hsRating}</span>
                </div>

                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${emotion.cls}">${emotion.text}</span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${health.cls}">${health.text}</span>
                </div>

                ${renderStatMiniGrid(hp.stats)}
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <div class="text-[11px] text-slate-400">
                  추진비 <b class="text-emerald-400">${formatMoney(signCost)}</b> · 성공 <b class="text-amber-300">${chance}%</b>
                </div>
                <button type="button" data-action="sign-hs" data-id="${hp.id}" class="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition">
                  🎓 고객 영입 (1 AP)
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      document.getElementById('scouting-list').innerHTML = state.scoutPool.map(p => {
        ensurePlayerStatusAndStats(p);
        const signCost = Math.round(p.wage * 1.5);
        const chance = Math.min(95, Math.max(35, 68 + buffs.scoutBonus + Math.floor(state.rep / 3) - (p.ovr - 68) * 2));
        const emotion = getEmotionBadgeInfo(p.morale);
        const health = getHealthBadgeInfo(p.fitness, p.injuryWeeks);

        return `
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div class="space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-800 text-sky-400">${p.pos}</span>
                  <h3 class="font-bold text-sm text-white">${p.name} (${p.age}세)</h3>
                </div>
                <span class="text-xs font-bold text-amber-300">OVR ${p.ovr} / 잠재 ${p.pot}</span>
              </div>
              <p class="text-xs text-slate-400">${p.club} · 예상 주급 ${formatMoney(p.wage)}</p>

              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${emotion.cls}">${emotion.text}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${health.cls}">${health.text}</span>
              </div>

              ${renderStatMiniGrid(p.stats)}
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div class="text-xs text-slate-400">추진비 <b class="text-emerald-400">${formatMoney(signCost)}</b> · 성공 <b class="text-amber-300">${chance}%</b></div>
              <button type="button" data-action="sign-scout" data-id="${p.id}" class="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition">영입 제안 (1 AP)</button>
            </div>
          </div>
        `;
      }).join('');

      document.getElementById('agency-upgrades-list').innerHTML = AGENCY_UPGRADES.map(u => {
        const owned = state.ownedUpgrades.includes(u.id);
        return `
          <div class="bg-slate-900/90 border ${owned ? 'border-emerald-500/40' : 'border-slate-800'} rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div class="flex items-center justify-between">
                <h4 class="font-bold text-sm text-white">${u.name}</h4>
                <span class="text-xs font-semibold px-2 py-0.5 rounded ${owned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}">${owned ? '도입 완료' : formatMoney(u.cost)}</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">${u.desc}</p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <span class="text-xs text-rose-400">유지비 +${formatMoney(u.upkeep)}/주</span>
              <button type="button" data-action="buy-upgrade" data-id="${u.id}" ${owned ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${owned ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'}">${owned ? '적용 중' : '법인 자금으로 투자'}</button>
            </div>
          </div>
        `;
      }).join('');

      document.getElementById('lifestyle-items-list').innerHTML = LIFESTYLE_ITEMS.map(item => {
        const owned = state.ownedItems.includes(item.id);
        return `
          <div class="bg-slate-900/90 border ${owned ? 'border-sky-500/50' : 'border-slate-800'} rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div class="flex items-center justify-between">
                <h4 class="font-bold text-sm text-white">${item.name}</h4>
                <span class="text-xs font-bold ${owned ? 'text-sky-400' : 'text-amber-300'}">${owned ? '보유 중' : formatMoney(item.price)}</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">${item.desc}</p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <span class="text-xs text-sky-300">협상 +${item.negBonus}% · 영입 +${item.scoutBonus}% · 명성 +${item.repBonus}</span>
              <button type="button" data-action="buy-item" data-id="${item.id}" ${owned ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${owned ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-400 hover:bg-sky-300 text-slate-950'}">${owned ? '장착 완료' : '개인 계좌로 구매'}</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function runSelfCheck() {
      const comm = calculateContractCommission(10000, 100000, 10);
      console.assert(comm === 62000, 'Commission math check failed');
      const netDiv = calculateNetDividend(10000);
      console.assert(netDiv === 8500, 'Dividend tax math check failed');
      const buffs = computeAgentBuffs(['lawyer', 'office_expand'], ['suit', 'watch']);
      console.assert(buffs.negBonus === 12 && buffs.maxClients === 8 && buffs.maxAp === 4, 'Buff calculation check failed');
      const testHs = createHighSchoolPlayer(FICTIONAL_HIGH_SCHOOLS[0], true);
      console.assert(testHs.age >= 16 && testHs.age <= 18 && testHs.stats && typeof testHs.fitness === 'number', 'High school player & health check failed');
    }

    window.addEventListener('DOMContentLoaded', () => {
      runSelfCheck();
      loadState();
      renderAll();
      switchTab(state.activeTab || 'clients');
      switchScoutSubTab(state.scoutSubTab || 'hs');

      document.getElementById('btn-next-week').addEventListener('click', advanceWeek);
      document.getElementById('btn-sound-toggle').addEventListener('click', (e) => {
        soundEnabled = !soundEnabled;
        e.currentTarget.textContent = soundEnabled ? '🔊 효과음' : '🔇 음소거';
      });
      document.getElementById('btn-reset-game').addEventListener('click', resetCareer);
      document.getElementById('btn-refresh-scouting').addEventListener('click', refreshScoutingPool);
      document.getElementById('btn-payout-10k').addEventListener('click', () => transferDividend(10000));
      document.getElementById('btn-payout-50k').addEventListener('click', () => transferDividend(50000));

      document.getElementById('btn-toggle-logs').addEventListener('click', (e) => {
        const feed = document.getElementById('log-feed');
        const hidden = feed.classList.toggle('hidden');
        e.currentTarget.textContent = hidden ? '기록 더보기 ▾' : '접기 ▴';
      });

      document.getElementById('btn-scout-sub-hs').addEventListener('click', () => switchScoutSubTab('hs'));
      document.getElementById('btn-scout-sub-pro').addEventListener('click', () => switchScoutSubTab('pro'));

      document.getElementById('btn-close-neg').addEventListener('click', closeNegotiationModal);
      document.getElementById('btn-cancel-neg').addEventListener('click', closeNegotiationModal);
      document.getElementById('btn-submit-neg').addEventListener('click', submitNegotiation);
      document.getElementById('neg-wage-slider').addEventListener('input', updateNegotiationPreview);
      document.getElementById('neg-bonus-slider').addEventListener('input', updateNegotiationPreview);
      document.getElementById('neg-fee-select').addEventListener('change', updateNegotiationPreview);
      document.getElementById('neg-clause-select').addEventListener('change', updateNegotiationPreview);
      document.getElementById('btn-restart-career').addEventListener('click', resetCareer);

      document.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
      });

      document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'negotiate') openNegotiationModal(id);
        else if (action === 'encourage') encouragePlayer(id);
        else if (action === 'sign-scout') signScoutedPlayer(id);
        else if (action === 'visit-school') visitHighSchool(id);
        else if (action === 'sign-hs') signHighSchoolPlayer(id);
        else if (action === 'buy-upgrade') buyAgencyUpgrade(id);
        else if (action === 'buy-item') buyLifestyleItem(id);
      });
    });
  </script>
</body>
</html>
```

## 9. 권장 `.gitignore` 설정

Public 레포지토리에서 모바일 서명 키나 환경변수가 유출되지 않도록 루트에 `.gitignore` 파일로 아래 항목을 등록하세요.

```text
# Environment & Secrets
.env
.env.*

# Android / iOS Signing Keys
*.keystore
*.jks
*.p12
*.mobileprovision

# Build & Dependencies
node_modules/
dist/
android/app/build/
.DS_Store
```