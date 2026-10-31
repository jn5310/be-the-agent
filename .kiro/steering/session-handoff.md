---
inclusion: always
---

# 새 세션에서 이어 하기 (인수인계)

인수인계 문서: `AGENTS.md` 0장(지금 상태·사용자 결정 대기·다음에 할 일·주의) + 이 파일(절차) + `game-design.md`(설계 원칙).

## 시작할 때
1. `AGENTS.md` 0장(지금 상태·다음에 할 일)을 먼저 읽습니다. 규칙은 1장, 수식은 5장, 재미 지표는 8장입니다. 0장의 "사용자 결정 대기"가 있으면 그것부터 확인합니다.
2. PR 상태를 확인합니다: `gh api "repos/jn5310/be-the-agent/pulls?state=all&per_page=5" --jq '.[] | "#\(.number) \(.state) \(.head.ref)"'`
3. 열린 PR이 없고 `main`이 최신이면 `main`에서 새 브랜치(`phaseN-...` 또는 `fix-...`)를 만듭니다. `main`에 바로 커밋하지 않습니다. 머지 안 된 PR 위에서 일할 때는 그 브랜치에서 새 브랜치를 따고, PR `base`는 `main`으로 둡니다(이 리포는 머지 후 브랜치를 지우지 않아서, 쌓은 PR의 base가 자동으로 바뀌지 않음).

## 사용자와 일하는 방식
- 항상 한국어로 답합니다.
- **답할 때마다 추천을 하나 넣습니다 (사용자 요청).** 고를 것이 있으면 "선택지 | 추천" 표로 주고, 결정마다 추천은 하나만 둡니다. 일을 끝내고 보고할 때도 마지막에 다음 후보와 추천 하나를 붙입니다. 질문에 답만 하는 경우에도 남은 결정이 있으면 그 추천을 한 줄로 다시 적습니다.
- 사용자가 "추천대로"라고 답하면 그 답에 있던 추천을 모두 그대로 진행하고 다시 묻지 않습니다.
- 범위가 바뀌는 큰 결정은 만들기 전에 먼저 묻습니다. 세부 수치는 추천안으로 진행한 뒤 보고합니다.
- 보고 순서: PR 링크 → 들어간 것 → 숫자로 확인한 것 → 남은 문제·사용자가 볼 점 → 다음 후보와 추천 하나. 짧게 씁니다.
- GitHub 설정처럼 사용자가 직접 해야 하는 일은 클릭 경로로 안내합니다. Pages 설정 API는 이 환경에서 403이 납니다.
- 밸런스는 직접 느낌만으로 정하지 않습니다. `node tools/sim.js --games 1000 --all`(18단계 약 27분, 성실한 봇 1,000판만은 약 6분)로 수천 판을 돌려 지표로 판단하고, 결과를 PR에 적습니다.
- 5단계 이후에는 다른 게임의 요소를 하나씩 가져와 넣습니다. 새 작업을 시작할 때 후보를 "선택지 | 추천" 표로 먼저 드립니다 (`game-design.md` "기능을 넣는 방식").
- 화면을 새로 만들거나 크게 바꿀 때는 디자인 시안 2~3개를 이미지로 만들어 PR에 보여 주고 사용자가 고르게 합니다(8단계부터). 기능은 가장 작은 시안으로 먼저 넣고, 고르면 그 시안으로 바꿉니다.

## 작업 순서 (매 단계)
1. 코드 수정 → `node --check game.js` → 쓰지 않는 함수가 없는지 확인
2. 확률·수치를 바꿨다면 `TUNE`에서 바꾸고 시뮬레이션 1,000판 이상
3. 브라우저 확인 (아래 방법), 390px·360px, 콘솔 오류 0, 자가 검증 통과. 한국어와 영어 둘 다 봅니다(새 글은 `L(한국어, 영어)`, 영어 화면에 한글이 남지 않았는지)
4. 세이브 구조가 바뀌면 `SAVE_VERSION`을 올리고 이전 버전 변환 + 왕복 테스트
5. `index.html`의 `?v=` 숫자 올리기, 새 화면 요소는 `REQUIRED_IDS`에 추가
6. `AGENTS.md`(0장 포함)·`README.md` 갱신 → 커밋 → 푸시 → PR(`gh api .../pulls`, `gh pr create`는 안 됨)

## 이 샌드박스에서 확인하는 요령
- **Claude Code 클라우드 컨테이너(18단계 마무리 때)에서는 다릅니다:** 리포는 `/home/user/be-the-agent`, 임시 파일은 세션 스크래치 폴더에 둡니다. Playwright는 `require('playwright')`가 바로 되고 브라우저도 깔려 있습니다(`playwright install` 하지 않음). `bta.local` 라우팅 방식은 그대로 씁니다. `gh`·`gh api`는 없어서 PR은 GitHub MCP 도구(`create_pull_request`)로 만듭니다. 4코어라 `--all` 1,000판은 약 50분, 성실한 봇 1,000판은 약 5분입니다. 긴 명령은 백그라운드(`run_in_background`, 제한 2시간)로 돌리고 결과 파일을 봅니다. acorn은 `/opt/node-tools/node_modules/acorn`입니다. 아래 요령은 Kiro 샌드박스 기준입니다.
- Playwright는 `file://`를 막고, 파이썬 서버 같은 백그라운드 서버도 막힙니다. `page.route('http://bta.local/**', ...)`로 리포 파일을 직접 돌려주고 `http://bta.local/`을 엽니다.
- 8단계 후속부터 게임이 Pretendard(`fonts/`)를 직접 불러와서, 헤드리스 스크린샷에도 한글이 실제 폭으로 보입니다. `page.route`가 `.woff2`를 `font/woff2`로 돌려주기만 하면 됩니다. 줄바꿈·넘침 검사도 이제 실제와 같습니다. 찍기 전에 `await page.evaluate(() => document.fonts.ready)`로 글꼴을 기다립니다.
- 다른 글꼴과 비교하는 이미지(디자인 시안 등)가 필요하면 GitHub API로 OFL 글꼴을 받아 `page.addStyleTag`의 `@font-face`로 덮어씁니다. 홈 폴더는 읽기 전용이라 `_scratch/fonts`에 둡니다.
  `gh api -H "Accept: application/vnd.github.raw" "repos/sun-typeface/SUIT/contents/fonts/static/woff2/SUIT-Regular.woff2" > _scratch/fonts/SUIT-Regular.woff2`
  시안 이미지는 `docs/design/`에 PNG로 넣고 PR 본문에 `raw.githubusercontent.com` 주소로 보여 줍니다.
- 글꼴에 어떤 글자가 있는지는 `fc-query --format='%{charset}' 파일.woff2`로 봅니다(woff2도 읽음). pip·npm 설치는 막혀 있어서 fontTools 같은 도구로 글꼴을 고칠 수 없고, 고치면 예약 이름 때문에 이름도 바꿔야 하니 공식 파일만 씁니다(AGENTS.md 1장 1번).
- 이미지를 확인하는 도구는 같은 경로를 다시 읽으면 예전 이미지를 돌려줄 수 있습니다. 다시 그린 이미지는 새 이름으로 복사해서 확인합니다. 그림을 만드는 명령과 그 그림을 읽는 도구를 한 번에 부르면 병렬로 돌아 파일이 없다고 나옵니다. 따로 부릅니다.
- `<dialog>` 시트는 올라오는 애니메이션(0.25초)이 있어서, 위치를 잴 때는 400ms쯤 기다립니다.
- 16단계부터 화면 이동·다음 주에 움직임이 있습니다. 넘침·크기를 잴 때는 `await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))`로 끝나기를 기다리고, 움직임과 관계없는 화면 확인은 `browser.newContext({ reducedMotion: 'reduce' })`로 엽니다. 움직임 프레임을 찍을 때는 동작 직후 `document.getAnimations().forEach(a => a.pause())`, 프레임마다 `a.currentTime = t`와 `window.__motionTick()`(자금 숫자)을 부른 뒤 찍습니다. 답한 소식 카드는 0.18초 뒤에 처리되니, 누른 뒤 결과를 볼 때는 300ms쯤 기다립니다.
- 언어(11단계): 언어 설정이 없으면 게임이 브라우저 언어를 따릅니다. 헤드리스 Chromium은 `en-US`라서, 한국어로 확인할 때는 `browser.newContext({ locale: 'ko-KR' })`, 영어는 `locale: 'en-US'`로 엽니다.
- 영어 화면 점검: 열린 화면·창의 글자 노드와 `aria-label`을 훑어 `[가-힣]`이 남았는지 봅니다(언어 버튼 "한국어", "Language · 언어"는 예외). 소식은 `d.v`를 0~59로 바꿔 가며 상황 글·선수의 말 변형을 모두 그려 봅니다. 한 줄이어야 하는 버튼(하단 탭)은 글자 노드의 `getClientRects()` 줄 수로 두 줄이 됐는지 봅니다(`scrollWidth`로는 줄바꿈을 못 잡음).
- 코드에서 짝 없는 한국어 글 찾기: eslint에 들어 있는 acorn(`$(npm root -g)/eslint/node_modules/acorn`)으로 `game.js`를 읽어, `L()`·`M()`·`SAY()`의 첫 인자가 아닌 곳에 한글이 있는 문자열을 찾습니다. 주석·`console`·자가 검증 메시지·조사 도구·세계 데이터는 빼고 봅니다.
- 게임 동작이 그대로인지(글만 바꿀 때): `Math.random`을 고정 시드로 바꾸고 봇 몇 판을 돌려 숫자 상태(자금·평판·선수·통계)의 해시를 바꾸기 전 파일과 비교합니다. `tools/sim.js`는 시드를 고정하지 않아 돌릴 때마다 조금씩 다릅니다.
- 셸 도구는 `run_in_background`를 켜도 120초가 지나면 명령을 끊습니다. `node tools/sim.js --games 1000 --all`(18단계 8코어 약 27분)은 `timeout`을 1800000(30분, 도구 최대)으로 주고 앞에서 돌립니다. `nohup … &`로 띄워도 도구 호출이 끝나면 같이 끝납니다. 성실한 봇만 1,000판(약 6분)이면 900000으로 됩니다.
- Playwright 위치: `$(npm root -g)/@playwright/mcp/node_modules/playwright`, 브라우저는 `PLAYWRIGHT_BROWSERS_PATH=/inner_container/opt/playwright`로 지정합니다.
- 샌드박스는 인터넷이 안 돼서 실제 사이트를 열 수 없습니다. 배포는 `gh api repos/jn5310/be-the-agent/pages/builds/latest`로 확인합니다.
- 파일 쓰기 도구의 `/tmp`와 셸의 `/tmp`는 서로 다르고, 셸의 `/tmp`도 호출 사이에 지워질 수 있습니다. 임시 파일·실험용 복사본은 리포 밖 `/projects/sandbox/_scratch`에 두고 끝나면 지웁니다.
- 규칙 하나의 효과를 볼 때는 `_scratch/exp/`에 `game.js`와 `tools/sim.js`를 복사해 그 규칙만 끈 판과 켠 판을 같은 판 수로 돌려 비교합니다(13단계: 낮은 수준 구단 제안, 출전 비율 성장, 재계약 주급 바닥을 하나씩 끄고 비교함). 이적이 어디서 왔는지는 실험용 `sim.js`에서 `resolveEvent` 전후 `stats.transfers`를 보고 제안 종류별로 셉니다.
- 따옴표·백틱이 많은 `node -e` 한 줄은 깨지기 쉽습니다. 스크립트 파일로 만들어 실행합니다.
- 특정 상태 화면 찍기(17단계): Node에서 `tools/sim.js`의 `loadGame()`처럼 `game.js`를 불러 상태를 만들고(`Math.random`을 시드로 바꾸면 같은 상태) `serialize()`한 세이브를 `context.addInitScript`로 `localStorage`에 한 번 넣고 엽니다(`sessionStorage` 표시로 새로고침 때 다시 넣지 않게). 선수 동의 같은 굴림이 화면을 바꾸면 누르기 직전 `page.evaluate`로 `Math.random`을 잠깐 고정합니다(실제 확률은 Node에서 같은 세이브로 수백 번 돌려 따로 확인). 고정된 하단 바가 카드 스크린샷을 가리면 찍는 동안만 `.bottombar{visibility:hidden}` 스타일을 넣었다 뺍니다.
- 여러 장을 한 이미지로 묶을 때 페이지에 한글 캡션을 넣으면 헤드리스 크롬에 한글 글꼴이 없어 빈칸이 됩니다. `fonts/Pretendard-Bold.subset.woff2`를 data URL `@font-face`로 넣고 `document.fonts.ready`를 기다립니다.
- 코드 리뷰를 하위 작업으로 나눌 때는 `git archive HEAD`로 `_scratch/review/repo`에 스냅숏을 풀어 그 사본만 읽게 합니다(같은 리포를 고치는 중이면 읽는 쪽이 고치는 중인 파일을 보지 않게).
- 한 번에 여러 도구를 부르면 병렬로 돌 수 있습니다. "PR 본문 파일 작성 → 푸시 → PR 생성"처럼 순서가 필요한 일은 따로 부릅니다.
- 두 번 누르기 막기(17단계 리뷰 수정): 다음 주 버튼은 새 소식이 온 주 500ms·창을 닫은 뒤 350ms, 소식 답은 누른 뒤 450ms, 장면 답은 장면이 뜬 뒤 450ms 동안 무시합니다. 브라우저 시험에서 다음 주를 여러 번 누를 때는 600ms쯤 기다리고, 답을 이어서 누를 때도 500ms쯤 둡니다(안 그러면 눌림이 빠져 "기대와 다름"으로 보임).
- 두 탭 시험: 같은 `browser.newContext()`에서 `newPage()`를 두 번 열면 `localStorage`를 같이 쓰고 `storage` 이벤트도 옵니다. `addInitScript`는 탭마다 돌아서 세이브를 다시 넣으니, 세이브는 첫 탭에서 `localStorage.setItem` 뒤 새로고침으로 한 번만 넣습니다.
- 크롬은 사용자 동작이 없으면 `<dialog>`의 Esc(`cancel`)를 두 번까지만 막게 해 줘서, 세 번째 Esc나 안드로이드 뒤로가기에 `preventDefault()`를 해도 닫힙니다. 닫히면 안 되는 창은 `close`에서 다시 엽니다(다른 탭 창).
- 셸에서 `pgrep -f "패턴"`으로 기다리면 그 셸 명령 자체가 패턴에 걸려 끝나지 않습니다. `ps aux | grep -E "node (fuzz|ui-monkey)\.js" | grep -v grep`처럼 거릅니다.
- 고친 것을 확인하는 시험 세 가지(17단계 리뷰 수정 때 `_scratch/mytests`에서 씀, 리포에는 넣지 않음): ① Node 무작위 행동 퍼즈(`loadGame()`으로 불러 `G.ev('함수')`로 모든 행동을 틀린 대상까지 무작위로 부르고, 행동마다 돈·만족·계약이 유한한지, 몇 행동마다 `deserialize(serialize())`가 소식·뉴스·결산·선수를 그대로 돌려주는지 비교. 키 순서와 빈 기본값(`late: false`, `nm: ''`)은 무시) ② 브라우저 무작위 누르기(열린 창이 있으면 그 안 버튼만, 가끔 뒤로가기·새로고침. 매번 콘솔 오류·가로 넘침·화면 밖 요소·영어 화면 한글·상태 숫자를 봄. 사라지는 중인 알림(`.toast`)은 빼고 봄) ③ 고친 코드만 따로 리뷰(`semantic_reviewer`에 `git diff main`과 스냅숏을 줌). ③에서 고친 코드가 새로 만든 문제 8건을 찾았습니다.
