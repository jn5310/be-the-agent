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
- 밸런스는 직접 느낌만으로 정하지 않습니다. `node tools/sim.js --games 1000 --all`(12단계부터 약 12분, 600판이면 약 7분)로 수천 판을 돌려 지표로 판단하고, 결과를 PR에 적습니다.
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
- Playwright는 `file://`를 막고, 파이썬 서버 같은 백그라운드 서버도 막힙니다. `page.route('http://bta.local/**', ...)`로 리포 파일을 직접 돌려주고 `http://bta.local/`을 엽니다.
- 8단계 후속부터 게임이 Pretendard(`fonts/`)를 직접 불러와서, 헤드리스 스크린샷에도 한글이 실제 폭으로 보입니다. `page.route`가 `.woff2`를 `font/woff2`로 돌려주기만 하면 됩니다. 줄바꿈·넘침 검사도 이제 실제와 같습니다. 찍기 전에 `await page.evaluate(() => document.fonts.ready)`로 글꼴을 기다립니다.
- 다른 글꼴과 비교하는 이미지(디자인 시안 등)가 필요하면 GitHub API로 OFL 글꼴을 받아 `page.addStyleTag`의 `@font-face`로 덮어씁니다. 홈 폴더는 읽기 전용이라 `_scratch/fonts`에 둡니다.
  `gh api -H "Accept: application/vnd.github.raw" "repos/sun-typeface/SUIT/contents/fonts/static/woff2/SUIT-Regular.woff2" > _scratch/fonts/SUIT-Regular.woff2`
  시안 이미지는 `docs/design/`에 PNG로 넣고 PR 본문에 `raw.githubusercontent.com` 주소로 보여 줍니다.
- 글꼴에 어떤 글자가 있는지는 `fc-query --format='%{charset}' 파일.woff2`로 봅니다(woff2도 읽음). pip·npm 설치는 막혀 있어서 fontTools 같은 도구로 글꼴을 고칠 수 없고, 고치면 예약 이름 때문에 이름도 바꿔야 하니 공식 파일만 씁니다(AGENTS.md 1장 1번).
- 이미지를 확인하는 도구는 같은 경로를 다시 읽으면 예전 이미지를 돌려줄 수 있습니다. 다시 그린 이미지는 새 이름으로 복사해서 확인합니다. 그림을 만드는 명령과 그 그림을 읽는 도구를 한 번에 부르면 병렬로 돌아 파일이 없다고 나옵니다. 따로 부릅니다.
- `<dialog>` 시트는 올라오는 애니메이션(0.25초)이 있어서, 위치를 잴 때는 400ms쯤 기다립니다.
- 언어(11단계): 언어 설정이 없으면 게임이 브라우저 언어를 따릅니다. 헤드리스 Chromium은 `en-US`라서, 한국어로 확인할 때는 `browser.newContext({ locale: 'ko-KR' })`, 영어는 `locale: 'en-US'`로 엽니다.
- 영어 화면 점검: 열린 화면·창의 글자 노드와 `aria-label`을 훑어 `[가-힣]`이 남았는지 봅니다(언어 버튼 "한국어", "Language · 언어"는 예외). 소식은 `d.v`를 0~59로 바꿔 가며 상황 글·선수의 말 변형을 모두 그려 봅니다. 한 줄이어야 하는 버튼(하단 탭)은 글자 노드의 `getClientRects()` 줄 수로 두 줄이 됐는지 봅니다(`scrollWidth`로는 줄바꿈을 못 잡음).
- 코드에서 짝 없는 한국어 글 찾기: eslint에 들어 있는 acorn(`$(npm root -g)/eslint/node_modules/acorn`)으로 `game.js`를 읽어, `L()`·`M()`·`SAY()`의 첫 인자가 아닌 곳에 한글이 있는 문자열을 찾습니다. 주석·`console`·자가 검증 메시지·조사 도구·세계 데이터는 빼고 봅니다.
- 게임 동작이 그대로인지(글만 바꿀 때): `Math.random`을 고정 시드로 바꾸고 봇 몇 판을 돌려 숫자 상태(자금·평판·선수·통계)의 해시를 바꾸기 전 파일과 비교합니다. `tools/sim.js`는 시드를 고정하지 않아 돌릴 때마다 조금씩 다릅니다.
- 셸 도구는 `run_in_background`를 켜도 120초가 지나면 명령을 끊습니다. `node tools/sim.js --games 1000 --all`(12단계부터 8코어 약 12분)은 `timeout`을 900000(15분)으로 주고 앞에서 돌립니다.
- Playwright 위치: `$(npm root -g)/@playwright/mcp/node_modules/playwright`, 브라우저는 `PLAYWRIGHT_BROWSERS_PATH=/inner_container/opt/playwright`로 지정합니다.
- 샌드박스는 인터넷이 안 돼서 실제 사이트를 열 수 없습니다. 배포는 `gh api repos/jn5310/be-the-agent/pages/builds/latest`로 확인합니다.
- 파일 쓰기 도구의 `/tmp`와 셸의 `/tmp`는 서로 다릅니다. 임시 파일은 리포 밖 `/projects/sandbox/_scratch`에 두고 끝나면 지웁니다.
- 따옴표·백틱이 많은 `node -e` 한 줄은 깨지기 쉽습니다. 스크립트 파일로 만들어 실행합니다.
- 한 번에 여러 도구를 부르면 병렬로 돌 수 있습니다. "PR 본문 파일 작성 → 푸시 → PR 생성"처럼 순서가 필요한 일은 따로 부릅니다.
