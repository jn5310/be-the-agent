# 이미지 필요 목록과 생성 프롬프트

이 문서가 **그림 관련 내용의 유일한 자리**입니다(필요한 그림, 만드는 프롬프트, 받은 뒤 처리). 다른 문서에는 그림 프롬프트를 쓰지 않습니다.

## 0. 먼저 알아 둘 것

- **지금 게임에는 이미지가 한 장도 없습니다** [확인: `index.html`·`style.css`에 `<img>`·`url(` 이미지·아이콘·매니페스트가 없음]. 글자와 색만으로 완성돼 있고, 그래서 오프라인에서도 가볍게 돕니다.
- **꼭 필요한 건 앱 아이콘 하나뿐입니다.** 휴대폰 홈 화면에 추가하면 아이콘 파일이 없어서 기기가 알아서 만든 기본 모양(첫 글자나 화면 조각)이 나올 것으로 [추정]합니다(실기기로 확인하지는 않았습니다). 나머지는 있으면 좋은 정도(선택)입니다.
- **결정이 필요한 것 하나:** `CLAUDE.md` 기술 스택은 "게임 파일은 `index.html`·`style.css`·`game.js`·`fonts/`뿐"입니다. 그림 파일을 넣으려면 `img/` 폴더(와 아이콘 매니페스트)를 허용하는 한 줄을 `CLAUDE.md`에 더해야 합니다. 그림을 받아 넣기로 정했을 때 그 한 줄을 같이 고칩니다(지금은 고치지 않았습니다).
- 글자(한국어)가 그림에 들어가면 영어 화면에 한글이 남으므로 **그림 안에는 글자를 넣지 않습니다.** 필요한 글자는 코드가 따로 얹습니다.

## 1. 한눈에 보기

| 번호 | 어디에 쓰나 | 크기·형식 | 필요도 | 만드는 방법 |
|---|---|---|---|---|
| ICON-01 | 홈 화면 앱 아이콘 (iPhone·Android) | 1024×1024 PNG 원본 → 180/192/512 + 가장자리 여유판 512 | **필요** | AI 이미지 |
| ICON-02 | 브라우저 탭 아이콘 | SVG 한 개(2KB 이하, `index.html`에 직접 넣어도 됨) | 필요 | Claude Code가 SVG로 직접 그림 (이미지 생성 불필요) |
| SHARE-01 | 링크를 공유할 때 미리보기 | 1200×630 PNG | 선택 | AI 이미지 + 제목은 코드로 얹음 |
| INTRO-01 | 처음 실행 안내 시트 맨 위 (`docs/review/18-ui.md` 4장 B안을 할 때만) | 716×400 WebP, 40KB 이하 | 선택 | AI 이미지 |
| TALE-01~04 | 관계 이야기 장면 카드 4종 (11시의 전화·가족 결혼식·후배 소개·인터뷰의 고마움) | 각 716×400 WebP, 30KB 이하 | 선택 | AI 이미지 |
| TALE-05 | 은퇴식 결산 문구 위 | 716×400 WebP, 30KB 이하 | 선택 | AI 이미지 |

필요도 "선택"은 안 만들어도 게임이 그대로 돕니다. 코딩 원칙 ①("안 써도 되는가")에 따라, 그림을 넣는 일은 사용자가 "넣자"고 할 때만 진행합니다. 관계를 강조하는 게임이라 TALE 시리즈가 가장 효과가 클 것으로 [추정]하지만 측정한 적은 없습니다.

전체 그림 용량 목표: 합쳐서 **300KB 이하**(첫 로딩과 오프라인 저장에 부담이 없게). 실제 크기는 받은 뒤 잽니다.

## 2. 공통 지침 (모든 프롬프트 앞에 붙임)

**스타일:** 평평한 벡터 일러스트(flat vector illustration), 단순한 도형, 굵은 윤곽선 없음, 부드러운 그림자 없음. 얼굴은 목·눈코입 없는 단순한 실루엣 또는 뒷모습.
**색:** 게임 색과 맞춥니다. 잔디 초록 `#0b5d3b`, 밝은 초록 `#12b76a`, 따뜻한 주황 `#ea580c`(관계 이야기 색), 연한 주황 바탕 `#fff1e6`, 밝은 회색 `#f2f4f7`, 진한 글자색 `#101828`. 이 외 색은 최대 한 가지.
**공통 영어 문장 (프롬프트 끝에 붙임):**
`Flat vector illustration, limited palette (deep grass green #0b5d3b, bright green #12b76a, warm orange #ea580c, light gray #f2f4f7, near-black #101828), simple geometric shapes, faceless silhouettes, no text, no letters, no numbers, no logos, no watermark, no real brand or club emblems, no jerseys with numbers or sponsors, clean uncluttered composition, generous empty margins.`

**공통 금지 (법적 안전 규칙, `CLAUDE.md`):**
- 실존 구단·리그·선수·감독·에이전트·스타디움·로고·유니폼·대회 트로피 모양을 그리지 않습니다. 이름이나 스타일을 따라 달라는 문장(특정 화가·스튜디오·게임 이름)도 프롬프트에 쓰지 않습니다.
- 다른 게임의 화면·캐릭터·아이콘을 닮게 만들지 않습니다.
- 실존 인물처럼 보이는 얼굴을 만들지 않습니다(그래서 얼굴 없는 실루엣).
- **상업 이용이 허용된 생성 도구**로만 만듭니다. 도구 이름·모델·만든 날짜·이용 약관 링크를 받은 날 이 문서 7장 기록표에 적습니다.

## 3. 항목별 프롬프트

### ICON-01. 홈 화면 앱 아이콘
쓰는 곳: 홈 화면에 추가했을 때, 앱 전환 화면. 모서리 둥글림은 휴대폰이 알아서 하므로 **정사각형 그대로**, 투명 배경 금지(iPhone은 투명 배경을 검게 칠함).
```
App icon, a single bold emblem centered in a square: a simple briefcase silhouette whose clasp is a small football (soccer ball) made of one circle with a few pentagon shapes, a thin pitch center-circle line behind it. Deep grass green (#0b5d3b) solid background, white and bright green (#12b76a) emblem, warm orange (#ea580c) used only for a small accent on the clasp. Emblem occupies the central 60% of the square so it survives circular cropping. 1024x1024, square, no rounded corners, no transparency, no text. [공통 영어 문장]
```
후보 2장을 받아 하나를 고릅니다. 받은 뒤: 180·192·512로 줄이고, 가장자리 여유판(maskable)은 같은 그림을 중앙 60% 안에 두고 초록 바탕을 가득 채웁니다.

### ICON-02. 브라우저 탭 아이콘
이미지 생성이 필요 없습니다. ICON-01의 윤곽(축구공이 달린 가방)을 단색 SVG 한 개(2KB 이하)로 Claude Code가 직접 그립니다. 프롬프트: `ICON-01을 보고 같은 모양의 단순한 favicon.svg를 만들어. 색은 잔디 초록 바탕에 흰색 하나.`

### SHARE-01. 링크 공유 미리보기 (선택)
```
Wide banner, 1200x630. Left half: empty deep grass green (#0b5d3b) gradient area reserved for a title that will be added later by code. Right half: a faceless silhouette of a person in a suit shaking hands with a faceless young footballer silhouette in a plain unmarked jersey, with three small silhouettes of other young players behind them, a pitch center-circle line on the ground. Warm orange (#ea580c) used only for the ball. [공통 영어 문장]
```
받은 뒤: 제목 "Be The Agent"는 글꼴 Pretendard로 코드(SVG→PNG)에서 얹습니다. 이 그림은 게임 안에서는 쓰지 않습니다.

### INTRO-01. 처음 실행 안내 시트 그림 (선택)
```
Header illustration, 716x400, landscape. A faceless silhouette of a person in a suit standing on a green football pitch at dawn, holding a phone, with a small group of faceless young player silhouettes in the distance. Warm orange (#ea580c) soft sunrise glow as the only warm element, deep grass green ground, light gray sky. Calm, hopeful mood. Keep the top 20% and the bottom 20% visually quiet so a dialog title can sit near them. [공통 영어 문장]
```

### TALE-01~05. 관계 이야기 장면 (선택)
모든 TALE 그림은 연한 주황 바탕(`#fff1e6`) 위에 놓이는 카드 그림이므로, 배경은 `#fff1e6`에 가깝게, 주인공 선수는 얼굴 없는 실루엣, 에이전트는 양복 실루엣으로 통일합니다. 같은 선수가 되풀이해 나오므로 **같은 체형·같은 단색 유니폼(번호·로고 없음)**으로 맞춥니다.

| 번호 | 장면 | 영어 장면 설명 |
|---|---|---|
| TALE-01 | 밤 11시의 전화 | `A faceless agent silhouette sitting on a sofa at night in a dim room, a phone glowing in his hand, a window with a dark blue sky and a small moon.` |
| TALE-02 | 가족 결혼식 | `Faceless guests in formal clothes standing around a simple flower arch at a small outdoor wedding, one young footballer silhouette in a suit and the agent silhouette side by side, warm lanterns.` |
| TALE-03 | 후배 소개 | `A faceless young footballer silhouette in a plain unmarked jersey introducing a smaller younger faceless silhouette to the agent, standing at the edge of a training pitch, a ball on the grass.` |
| TALE-04 | 인터뷰의 고마움 | `A faceless footballer silhouette in front of a plain microphone backdrop with a few blank microphone shapes, turning slightly toward a faceless agent silhouette standing at the side of the frame, warm spotlight.` |
| TALE-05 | 은퇴식 | `A faceless older footballer silhouette on an empty pitch at sunset holding a plain unmarked jersey, the agent silhouette applauding beside him, long soft shadows, scattered fallen leaves.` |

각 프롬프트는 `Scene, 716x400 landscape, background close to #fff1e6, [위 영어 장면 설명] [공통 영어 문장]`으로 씁니다.

## 4. 받은 뒤 처리 (Claude Code가 함)
1. 형식·크기를 표대로 맞추고 용량을 잽니다(합계 300KB 이하). PNG는 압축, 장면 그림은 WebP.
2. 사용 자리마다 `alt`(그림 설명) 글을 `L(한국어, 영어)`로 붙입니다. 장식이면 `alt=""`로 읽기 프로그램이 건너뛰게 합니다.
3. 느린 회선에서도 글이 먼저 보이게 그림은 `loading="lazy"`와 크기(`width`·`height`)를 지정해 화면이 출렁이지 않게 합니다. 움직임이 필요하면 `transform`·`opacity`만(`CLAUDE.md`).
4. 오프라인에서도 보이게 그림 파일 경로는 상대 경로로, 외부 주소는 쓰지 않습니다. 배포할 때마다 `index.html`의 `?v=`를 올립니다.
5. 7장 기록표에 출처를 적습니다.

## 5. 그림 파일을 리포에 넣는 법
- **추천:** Claude Code 작업 화면에 그림을 첨부하고 "docs/ART_PROMPTS.md의 ICON-01 그림이야. 4장대로 img/에 넣고 연결해줘."라고 보냅니다. 첨부한 그림 파일이 작업 환경으로 그대로 전달되는지는 확인하지 못했습니다 [미확인]. 안 되면 아래 방법으로 올립니다.
- 대안: GitHub 웹(휴대폰 브라우저의 데스크톱 보기)에서 저장소 → Add file → Upload files로 `img/` 폴더에 올린 뒤 같은 요청을 보냅니다.

## 6. 진행 순서 제안
1. (결정) 그림 파일을 리포에 넣는 것을 허용할지 → 허용하면 `CLAUDE.md` 기술 스택에 `img/` 한 줄.
2. ICON-01 후보 2장 → 하나 선택 → ICON-02(favicon.svg) → 넣기. 이것만으로 홈 화면 추가 품질이 확 달라집니다.
3. 처음 실행 안내 시트(`first-season`)를 할 때 INTRO-01. 관계 이야기 그림(TALE-01~05)은 이야기 장면을 더 다듬고 싶을 때.

## 7. 출처 기록표 (그림을 받을 때마다 채움)
| 번호 | 만든 도구·모델 | 만든 날짜 | 이용 약관 링크 | 상업 이용 | 비고 |
|---|---|---|---|---|---|
| (아직 없음) | | | | | |
