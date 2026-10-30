'use strict';
// Be The Agent 1단계: 주간 진행, 가상 세계 리그·선수, 자동 저장

// ===== 1. 상수와 세계 데이터 =====
const SAVE_KEY = 'be-the-agent:save';
const SAVE_VERSION = 2;
const WEEKS = 52;
const SQUAD = 24;
const WORLD_SEED = 20261030; // 구단 이름·전력은 모든 게임에서 같게 고정
const START_CASH = 25000;
const START_REP = 12;
const CLIENT_LIMIT = 8;
const AP_PER_WEEK = 3;
const FEE_RATE = 0.08;       // 수수료: 소속 선수 주급의 8%
const UPKEEP_BASE = 550;     // 주간 운영비 기본
const UPKEEP_PER_CLIENT = 50;
const DEBT_LIMIT = 8;        // 자금 마이너스가 8주 이어지면 파산
const RETRY_WEEKS = 4;       // 영입 실패 후 다시 제안까지 기다리는 주
const POS_BY_SLOT = 'GK GK GK DF DF DF DF DF DF DF DF MF MF MF MF MF MF MF MF FW FW FW FW FW'.split(' ');
const POS_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };

// 국가: [코드, 이름, 지역, 이름 풀, 구단 접미어, 1부 수준, 부별 팀 수, 도시]
const COUNTRY_DATA = [
  ['ENG', '잉글랜드', '5대 리그', 'en', 'EN', 78, [20, 24, 24, 24], '런던 맨체스터 리버풀 버밍엄 리즈 셰필드 브리스틀 뉴캐슬 노팅엄 레스터 사우샘프턴 포츠머스 플리머스 더비 스토크 코번트리 브라이턴 노리치 입스위치 레딩 선덜랜드 미들즈브러 볼턴 위건 블랙풀 프레스턴 헐 옥스퍼드 케임브리지 엑서터 요크 칼라일 체스터 배스 스윈던 노샘프턴 루턴 왓퍼드 피터버러 본머스'],
  ['ESP', '스페인', '5대 리그', 'es', 'ES', 78, [20, 22, 20, 20], '마드리드 바르셀로나 발렌시아 세비야 빌바오 사라고사 말라가 무르시아 팔마 라스팔마스 알리칸테 코르도바 바야돌리드 비고 히혼 그라나다 오비에도 산탄데르 팜플로나 알메리아 카디스 우에스카 레가네스 헤타페 엘체 카스테욘 부르고스 타라고나 레리다 히로나 테네리페 바다호스 살라망카 톨레도 우엘바'],
  ['GER', '독일', '5대 리그', 'de', 'DE', 77, [18, 18, 20], '베를린 뮌헨 함부르크 쾰른 프랑크푸르트 슈투트가르트 뒤셀도르프 도르트문트 에센 라이프치히 브레멘 드레스덴 하노버 뉘른베르크 뒤스부르크 보훔 빌레펠트 본 만하임 카를스루에 아우크스부르크 비스바덴 킬 아헨 브라운슈바이크 마인츠 로스토크 프라이부르크 하이델베르크 레겐스부르크 오스나브뤼크 파더보른'],
  ['ITA', '이탈리아', '5대 리그', 'it', 'IT', 77, [20, 20, 20], '로마 밀라노 나폴리 토리노 팔레르모 제노바 볼로냐 피렌체 바리 카타니아 베네치아 베로나 메시나 파도바 트리에스테 브레시아 파르마 모데나 레조칼라브리아 페루자 리보르노 칼리아리 페스카라 살레르노 베르가모 피사 레체 크레모나 코모 우디네 비첸차 스페치아 안코나'],
  ['FRA', '프랑스', '5대 리그', 'fr', 'FR', 75, [18, 18, 18], '파리 마르세유 리옹 툴루즈 니스 낭트 스트라스부르 몽펠리에 보르도 릴 렌 랭스 르아브르 생테티엔 툴롱 그르노블 디종 앙제 님 브레스트 르망 아미앵 투르 리모주 클레르몽페랑 메스 낭시 캉 로리앙 오세르'],
  ['NED', '네덜란드', '유럽', 'nl', 'NL', 70, [18, 20], '암스테르담 로테르담 헤이그 위트레흐트 에인트호번 흐로닝언 틸뷔르흐 알메러 브레다 네이메헌 아펠도른 하를럼 아른험 엔스헤데 즈볼레 마스트리흐트 레이던 도르드레흐트 헤이렌베인 알크마르'],
  ['POR', '포르투갈', '유럽', 'pt', 'PT', 70, [18, 18], '리스본 포르투 브라가 기마랑이스 코임브라 아베이루 파루 세투발 레이리아 비제우 푼샬 에보라 아마도라 오에이라스 마토지뉴스 아로우카 샤베스 포르티망'],
  ['BEL', '벨기에', '유럽', 'nl', 'NL', 68, [16, 16], '브뤼셀 안트베르펜 헨트 브뤼허 리에주 샤를루아 루뱅 메헬렌 몽스 나뮈르 하설트 코르트레이크 오스텐더 헹크 신트트라위던 베스테를로'],
  ['TUR', '튀르키예', '유럽', 'tr', 'TR', 68, [18, 20], '이스탄불 앙카라 이즈미르 부르사 안탈리아 코냐 아다나 가지안테프 카이세리 트라브존 삼순 에스키셰히르 말라티아 시바스 리제 데니즐리 마니사 코자엘리 사카리아 디야르바키르'],
  ['SCO', '스코틀랜드', '유럽', 'en', 'EN', 63, [12, 10], '글래스고 에든버러 애버딘 던디 인버네스 퍼스 스털링 페이즐리 킬마녹 마더웰 리빙스턴 해밀턴 폴커크 에어'],
  ['AUT', '오스트리아', '유럽', 'de', 'DE', 63, [12, 16], '빈 그라츠 린츠 잘츠부르크 인스브루크 클라겐푸르트 장크트푈텐 필라흐 벨스 도른비른 슈타이어 레오벤'],
  ['SUI', '스위스', '유럽', 'de', 'DE', 64, [12, 10], '취리히 제네바 바젤 베른 로잔 루체른 장크트갈렌 루가노 빈터투어 시옹 툰 아라우'],
  ['GRE', '그리스', '유럽', 'gr', 'GR', 62, [14, 16], '아테네 테살로니키 파트라스 피레우스 이라클리온 라리사 볼로스 이오아니나 트리폴리 하니아 칼라마타 세레스 크산티 아그리니오 카발라'],
  ['DEN', '덴마크', '유럽', 'nord', 'NORD', 63, [12, 12], '코펜하겐 오르후스 오덴세 올보르 에스비에르 라네르스 호르센스 바일레 실케보르 헤르닝 비보르 쾨게 프레데리시아 로스킬레'],
  ['NOR', '노르웨이', '유럽', 'nord', 'NORD', 61, [16, 16], '오슬로 베르겐 트론헤임 스타방에르 크리스티안산 트롬쇠 드라멘 프레드릭스타 산네피오르 보되 몰데 올레순 하우게순 릴레함메르 시엔 퇸스베르그'],
  ['SWE', '스웨덴', '유럽', 'nord', 'NORD', 61, [16, 16], '스톡홀름 예테보리 말뫼 웁살라 베스테로스 외레브로 린셰핑 헬싱보리 옌셰핑 노르셰핑 룬드 우메오 예블레 보로스 칼마르 할름스타드'],
  ['CZE', '체코', '유럽', 'cz', 'SLAV', 62, [16, 16], '프라하 브르노 오스트라바 플젠 리베레츠 올로모우츠 우스티 흐라데츠크랄로베 파르두비체 즐린 하비르조프 오파바 테플리체 야블로네츠 믈라다볼레슬라프 카르비나'],
  ['POL', '폴란드', '유럽', 'pl', 'SLAV', 62, [18, 18], '바르샤바 크라쿠프 우치 브로츠와프 포즈난 그단스크 슈체친 비드고슈치 루블린 비아위스토크 카토비체 그디니아 쳉스토호바 라돔 키엘체 토룬 글리비체 자브제'],
  ['CRO', '크로아티아', '유럽', 'slav', 'SLAV', 62, [10, 12], '자그레브 스플리트 리예카 오시예크 자다르 풀라 슬라본스키브로드 카를로바츠 바라주딘 시베니크 두브로브니크 빈코브치'],
  ['SRB', '세르비아', '유럽', 'slav', 'SLAV', 61, [16, 16], '베오그라드 노비사드 니시 크라구예바츠 수보티차 즈레냐닌 판체보 차차크 노비파자르 크랄레보 스메데레보 레스코바츠 발례보 우지체'],
  ['UKR', '우크라이나', '유럽', 'ua', 'SLAV', 62, [16, 16], '키이우 하르키우 오데사 드니프로 도네츠크 자포리자 르비우 크리비리흐 미콜라이우 마리우폴 루한스크 빈니차 폴타바 체르니히우 체르카시 수미'],
  ['RUS', '러시아', '유럽', 'ru', 'SLAV', 64, [16, 18], '모스크바 상트페테르부르크 노보시비르스크 예카테린부르크 카잔 니즈니노브고로드 첼랴빈스크 사마라 옴스크 로스토프 우파 크라스노야르스크 보로네시 페름 볼고그라드 크라스노다르 튜멘 이르쿠츠크'],
  ['ROU', '루마니아', '유럽', 'ro', 'RO', 59, [16, 16], '부쿠레슈티 클루지나포카 티미쇼아라 이아시 콘스탄차 크라이오바 브라쇼브 갈라치 플로이에슈티 오라데아 브러일라 아라드 피테슈티 시비우 바커우 보토샤니'],
  ['HUN', '헝가리', '유럽', 'hu', 'HU', 58, [12, 16], '부다페스트 데브레첸 세게드 미슈콜츠 페치 죄르 니레지하저 케치케메트 세케슈페헤르바르 솜바트헤이 솔노크 에게르'],
  ['IRL', '아일랜드', '유럽', 'en', 'EN', 55, [10, 10], '더블린 코크 리머릭 골웨이 워터퍼드 드로이더 던독 슬라이고 브레이 애슬론'],
  ['BRA', '브라질', '남미', 'pt', 'PT', 71, [20, 20], '상파울루 리우데자네이루 벨루오리존치 포르투알레그리 쿠리치바 사우바도르 헤시피 포르탈레자 고이아니아 벨렝 마나우스 캄피나스 산투스 플로리아노폴리스 나타우 마세이오 쿠이아바 주앙페소아 조인빌리 크리시우마'],
  ['ARG', '아르헨티나', '남미', 'es', 'ES', 68, [24, 24], '부에노스아이레스 코르도바 로사리오 멘도사 라플라타 투쿠만 마르델플라타 살타 산타페 산후안 레시스텐시아 네우켄 바이아블랑카 파라나 코리엔테스 포사다스 아베야네다 라누스 킬메스 반필드'],
  ['URU', '우루과이', '남미', 'es', 'ES', 63, [16, 14], '몬테비데오 살토 파이산두 라스피에드라스 리베라 말도나도 타쿠아렘보 멜로 메르세데스 아르티가스 미나스 콜로니아'],
  ['COL', '콜롬비아', '남미', 'es', 'ES', 63, [20, 16], '보고타 메데인 칼리 바랑키야 카르타헤나 부카라망가 페레이라 마니살레스 쿠쿠타 이바게 산타마르타 비야비센시오 파스토 몬테리아 네이바 툰하'],
  ['CHI', '칠레', '남미', 'es', 'ES', 61, [16, 16], '산티아고 발파라이소 콘셉시온 안토파가스타 비냐델마르 테무코 랑카과 탈카 아리카 이키케 치얀 라세레나 오소르노 푸에르토몬트'],
  ['PAR', '파라과이', '남미', 'es', 'ES', 60, [12, 16], '아순시온 시우다드델에스테 루케 엔카르나시온 산로렌소 카피아타 람바레 페르난도데라모라 콘셉시온 비야리카 필라르 카아과수'],
  ['ECU', '에콰도르', '남미', 'es', 'ES', 61, [16, 10], '키토 과야킬 쿠엥카 산토도밍고 마찰라 만타 포르토비에호 암바토 리오밤바 로하 이바라 에스메랄다스'],
  ['PER', '페루', '남미', 'es', 'ES', 58, [18, 14], '리마 아레키파 트루히요 치클라요 피우라 쿠스코 이키토스 우앙카요 타크나 이카 카하마르카 푸노 우아라스 카야오'],
  ['BOL', '볼리비아', '남미', 'es', 'ES', 55, [16, 14], '라파스 산타크루스 코차밤바 수크레 오루로 타리하 포토시 엘알토 몬테로 트리니다드'],
  ['VEN', '베네수엘라', '남미', 'es', 'ES', 56, [14, 14], '카라카스 마라카이보 바르키시메토 마투린 메리다 산크리스토발 쿠마나 시우다드과야나 푸에르토라크루스 마라카이 바리나스 코로'],
  ['USA', '미국', '북중미', 'en', 'EN', 64, [28, 24], '뉴욕 로스앤젤레스 시카고 휴스턴 피닉스 필라델피아 샌안토니오 샌디에이고 댈러스 오스틴 시애틀 덴버 보스턴 애틀랜타 마이애미 포틀랜드 내슈빌 샬럿 올랜도 탬파 세인트루이스 캔자스시티 솔트레이크 새크라멘토 피츠버그 신시내티 콜럼버스 디트로이트 밀워키 라스베이거스 앨버커키 오클랜드 루이빌 멤피스'],
  ['MEX', '멕시코', '북중미', 'es', 'ES', 66, [18, 16], '멕시코시티 과달라하라 몬테레이 푸에블라 티후아나 후아레스 톨루카 케레타로 메리다 칸쿤 아카풀코 베라크루스 치와와 아과스칼리엔테스 모렐리아 산루이스포토시 쿨리아칸 마사틀란 토레온 오악사카'],
  ['CAN', '캐나다', '북중미', 'en', 'EN', 57, [8, 10], '토론토 밴쿠버 몬트리올 캘거리 에드먼턴 오타와 위니펙 핼리팩스 해밀턴 빅토리아 퀘벡 리자이나'],
  ['CRC', '코스타리카', '북중미', 'es', 'ES', 56, [12, 12], '산호세 알라후엘라 에레디아 카르타고 리몬 푼타레나스 리베리아 산카를로스 페레스셀레돈 과나카스테'],
  ['KOR', '대한민국', '아시아·오세아니아', 'ko', 'KO', 62, [12, 14], '서울 부산 인천 대구 대전 광주 울산 수원 창원 성남 고양 용인 청주 전주 천안 안산 포항 제주 김해 춘천 원주 목포 여수 진주'],
  ['JPN', '일본', '아시아·오세아니아', 'ja', 'JA', 64, [20, 20], '도쿄 요코하마 오사카 나고야 삿포로 고베 교토 후쿠오카 가와사키 사이타마 히로시마 센다이 지바 기타큐슈 니가타 하마마쓰 시즈오카 오카야마 구마모토 가고시마 나가사키 마쓰야마 가나자와'],
  ['CHN', '중국', '아시아·오세아니아', 'zh', 'ZH', 60, [16, 16], '베이징 상하이 광저우 선전 톈진 충칭 청두 우한 항저우 난징 시안 칭다오 다롄 선양 창춘 정저우 지난 쿤밍'],
  ['KSA', '사우디아라비아', '아시아·오세아니아', 'ar', 'AR', 65, [18, 18], '리야드 제다 메카 메디나 담맘 타이프 부라이다 코바르 아브하 하일 나지란 지잔 타북 알아흐사 카르즈 주바일'],
  ['QAT', '카타르', '아시아·오세아니아', 'ar', 'AR', 60, [12, 10], '도하 알라이얀 알와크라 알코르 움살랄 알샤말 두칸 메사이드'],
  ['UAE', '아랍에미리트', '아시아·오세아니아', 'ar', 'AR', 60, [14, 14], '두바이 아부다비 샤르자 알아인 아지만 라스알카이마 푸자이라 움알쿠와인 칼바 딥바'],
  ['IRN', '이란', '아시아·오세아니아', 'fa', 'EN', 59, [16, 18], '테헤란 마슈하드 이스파한 카라즈 시라즈 타브리즈 곰 아흐바즈 케르만샤 라슈트 케르만 야즈드 아라크 아르다빌 반다르아바스 하마단'],
  ['UZB', '우즈베키스탄', '아시아·오세아니아', 'uz', 'EN', 55, [14, 14], '타슈켄트 사마르칸트 나망간 안디잔 부하라 페르가나 카르시 누쿠스 코칸드 지자흐 테르메즈 나보이'],
  ['THA', '태국', '아시아·오세아니아', 'th', 'EN', 55, [16, 16], '방콕 치앙마이 논타부리 파타야 촌부리 나콘랏차시마 콘깬 우돈타니 부리람 핫야이 수판부리 랏차부리 아유타야 푸껫'],
  ['VIE', '베트남', '아시아·오세아니아', 'vi', 'EN', 53, [14, 12], '하노이 호찌민 하이퐁 다낭 껀터 후에 나짱 빈 타인호아 남딘 꾸이년 하띤'],
  ['IDN', '인도네시아', '아시아·오세아니아', 'id', 'EN', 53, [18, 16], '자카르타 수라바야 반둥 메단 스마랑 마카사르 팔렘방 탕에랑 데폭 보고르 말랑 욕야카르타 발리 발릭파판 폰티아낙 파당'],
  ['AUS', '호주', '아시아·오세아니아', 'en', 'EN', 59, [12, 12], '시드니 멜버른 브리즈번 퍼스 애들레이드 골드코스트 캔버라 뉴캐슬 울런공 호바트 질롱 타운즈빌 케언스 다윈'],
  ['EGY', '이집트', '아프리카', 'ar', 'AR', 59, [18, 20], '카이로 알렉산드리아 기자 포트사이드 수에즈 룩소르 아스완 만수라 탄타 이스마일리아 자가지그 파이윰 민야 아시우트 다만후르 소하그'],
  ['MAR', '모로코', '아프리카', 'ar', 'AR', 60, [16, 16], '카사블랑카 라바트 마라케시 페스 탕헤르 아가디르 메크네스 우지다 케니트라 테투안 사피 엘자디다 나도르 베니멜랄'],
  ['TUN', '튀니지', '아프리카', 'ar', 'AR', 58, [16, 16], '튀니스 스팍스 수스 카이루안 비제르트 가베스 아리아나 가프사 모나스티르 메드닌 나불 베자'],
  ['ALG', '알제리', '아프리카', 'ar', 'AR', 57, [16, 16], '알제 오랑 콩스탕틴 안나바 블리다 바트나 세티프 시디벨아베스 비스크라 틀렘센 베자이아 티지우주'],
  ['RSA', '남아프리카공화국', '아프리카', 'za', 'EN', 57, [16, 16], '요하네스버그 케이프타운 더반 프리토리아 포트엘리자베스 블룸폰테인 이스트런던 피터마리츠버그 폴로콰네 음봄벨라 킴벌리 소웨토 러스텐버그'],
  ['NGA', '나이지리아', '아프리카', 'af', 'EN', 53, [20, 16], '라고스 아부자 카노 이바단 포트하커트 베닌시티 에누구 카두나 아베오쿠타 조스 일로린 와리 오웨리 우요 아바'],
  ['GHA', '가나', '아프리카', 'af', 'EN', 53, [18, 16], '아크라 쿠마시 타코라디 타말레 케이프코스트 오부아시 테마 코포리두아 수냐니 호']
];

// 구단 이름 접미어 (실존 구단명에 흔한 유나이티드·시티·레알 등은 쓰지 않음)
const CLUB_SUFFIX = {
  EN: '크라운 로열스 팰컨스 코메츠 스톰 하버 포지 에어로 블레이즈 스피어스 나이츠 헤럴드',
  ES: '솔라르 미라도르 로호 베르데 토레 루세로 코메타 마레아 센티넬라 세레노',
  PT: '솔라르 폰치 아줄 베르멜류 마레 코메타 토헤 하이우 플로레스타 파홀',
  DE: '1904 1911 1923 로트 블라우 슈바르츠 아들러 슈테른 블리츠 뢰베',
  IT: '네로 로소 아추로 비앙코 아퀼라 토레 코메타 피아마 레오네 루체',
  FR: '에투알 루주 블뢰 누아르 페닉스 코메트 쿠론 토네르 플라므 오리종',
  NL: '스테르 레이우 블라우 로더 코메트 스톰 아델라르 포르트',
  NORD: '스타르 뢰베 외른 스톰 노르드 코메트 피오르 링',
  SLAV: '오를로 그롬 부랴 코메타 루치 야스트레브 베테르 볼크',
  TR: '아슬란 카르탈 일디즈 귀네시 프르트나 샤힌 데니즈 체이란',
  GR: '아에토스 아스트라피 헬리오스 티탄 키클로스 네펠리 포보스 칼리스토',
  AR: '알사크르 알바드르 알카와킵 알라드 알바흐르 알사하브 알샴스 알카마르',
  RO: '불투르 소아레 아크빌라 푸르투나 코메타 페닉스',
  HU: '서시 투룰 빌람 칠러그 비허르 오로슬란',
  KO: '웨이브스 호크스 마린스 블레이즈 코메츠 스톰 팰컨스 크라운',
  JA: '스텔라 코메타 아퀼라 플람마 루체 벤토 마레 솔레',
  ZH: '룽 펑황 톈마 훙싱 하이양 진싱 뤼인 레이팅'
};

// 이름 풀: [이름 순서, 이름, 성] (fl: 이름 성, lf: 성 이름, join: 성이름)
const NAME_DATA = {
  ko: ['join', '민준 서준 도윤 예준 시우 하준 주원 지호 지후 준우 준서 건우 도현 현우 지훈 우진 선우 서진 연우 유준 정우 승우 승현 시윤 준혁 은우 지환 승민 지우 유찬 윤우 민성 준영 시후 진우 지원 수호 재윤 시현 태윤 동현 재원 민혁 성민 영재 태민 상우 용준 대현 경민',
    '김 김 김 김 이 이 이 박 박 최 정 강 조 윤 장 임 한 오 서 신 권 황 안 송 류 전 홍 고 문 양 손 배 백 허 유 남 심 노 하 곽 성 차 주 우 구 민 나 진 지 엄 채 원 천 방 공 현'],
  ja: ['lf', '하루토 소타 하야토 하루키 렌 다이키 쇼타 가이토 리쿠 유마 다쿠미 겐타 류세이 쇼 고타 유이토 소마 가즈키 료타 쓰바사 마사토 히로키 유키 나오키 슌 고헤이 다이스케 유스케 겐지 아키라',
    '사토 스즈키 다카하시 다나카 와타나베 이토 야마모토 나카무라 고바야시 가토 요시다 야마다 사사키 야마구치 마쓰모토 이노우에 기무라 하야시 시미즈 야마자키 모리 이케다 하시모토 이시카와 야마시타 오가와 이시이 하세가와 곤도 사이토 사카모토 아오키 후지타 니시무라 후쿠다 오타 다케우치 노무라 마쓰다 스기야마'],
  zh: ['join', '웨이 하오 양 펑 젠 밍 위 카이 쥔 보 빈 타오 신 즈하오 위천 이판 쥔제 자하오 위헝 쯔양 톈위 밍하오 하오란 쯔한 원보 루이 천위 이밍 쉬둥 자러',
    '왕 리 장 류 천 양 황 자오 우 저우 쉬 쑨 마 주 후 궈 허 가오 린 뤄 정 량 셰 쑹 탕 한 펑 덩 차오 위안'],
  en: ['fl', '잭 해리 올리버 조지 찰리 토머스 제임스 윌리엄 조슈아 대니얼 라이언 루이스 매슈 네이선 샘 벤 애덤 리스 코너 제이크 딜런 에런 리엄 오언 숀 로스 앨피 타일러 브랜던 루크 앤드루 마이클 크리스 조 이선 알렉스 데이비드 피터 스티븐 마크',
    '스미스 존스 테일러 브라운 데이비스 에번스 톰프슨 휴스 그린 홀 우드 해리스 클라크 잭슨 터너 힐 무어 쿠퍼 워드 모리스 킹 베이커 해리슨 모건 앨런 스콧 필립스 왓슨 파커 프라이스 베넷 그리피스 리처드슨 마셜 엘리스 콜린스 미첼 그레이엄 머리 스튜어트 피셔 하디 로저스 리드 포스터 웹'],
  es: ['fl', '알레한드로 다니엘 파블로 하비에르 다비드 세르히오 카를로스 미겔 안드레스 마누엘 호르헤 루이스 디에고 페르난도 라파엘 알바로 이반 아드리안 마르코스 곤살로 니콜라스 마티아스 산티아고 세바스티안 펠리페 에밀리아노 호아킨 이그나시오 토마스 우고 빅토르 로드리고 크리스티안 가브리엘 에두아르도 오스카르 하이메 라울 엔리케 마리오',
    '가르시아 로드리게스 곤살레스 페르난데스 로페스 마르티네스 산체스 페레스 고메스 마르틴 히메네스 에르난데스 디아스 모레노 무뇨스 알바레스 로메로 알론소 구티에레스 나바로 도밍게스 바스케스 라미레스 세라노 몰리나 모랄레스 오르티스 델가도 카스트로 오르테가 루비오 마린 이글레시아스 메디나 가리도 코르테스 카스티요 레예스 아코스타 로하스 베니테스 카브레라 아길라르 피게로아 팔라시오스'],
  pt: ['fl', '주앙 페드루 치아구 히카르두 브루누 안드레 미겔 하파엘 마테우스 가브리에우 루카스 펠리피 비토르 이고르 헤나투 다니에우 루이스 카이우 에베르통 마르쿠스 파울루 세르지우 누누 곤살루 디오구 후벵 로드리구 엔히키 레안드루 플라비우',
    '실바 산투스 페헤이라 페레이라 올리베이라 소자 코스타 호드리게스 마르팅스 고메스 로페스 히베이루 아우베스 카르발류 피레스 멘드스 누네스 소아르스 리마 아라우주 바르보자 호샤 카르도주 테이셰이라 코헤이아 비에이라 바치스타 몬테이루 프레이타스 모레이라'],
  fr: ['fl', '뤼카 위고 테오 루이 라파엘 아르튀르 쥘 마티스 레오 가브리엘 아담 폴 토마 니콜라 앙투안 바티스트 막심 알렉상드르 쥘리앵 로맹 얀 브누아 시몽 바스티앙 뱅자맹 클레망 마티외 앙토니 올리비에 에티엔',
    '마르탱 베르나르 뒤부아 토마 로베르 리샤르 프티 뒤랑 르루아 모로 시몽 로랑 르페브르 미셸 다비드 베르트랑 루 뱅상 푸르니에 모렐 지라르 앙드레 메르시에 뒤퐁 랑베르 보네 프랑수아 르그랑 가르니에 포르 루소 게랭 페랭 모랭 고티에 블랑'],
  de: ['fl', '루카스 레온 펠릭스 막시밀리안 파울 요나스 루카 엘리아스 노아 핀 벤 팀 니클라스 얀 요나탄 율리안 플로리안 다비트 마르코 토비아스 케빈 마누엘 토마스 크리스토프 마티아스 슈테판 도미니크 파비안 카이 말테 하네스 니코 로빈 안드레아스 미하엘 지몬 필리프 사샤 데니스 마리오',
    '뮐러 슈미트 슈나이더 피셔 베버 마이어 바그너 베커 슐츠 호프만 셰퍼 코흐 바우어 리히터 클라인 볼프 슈뢰더 노이만 슈바르츠 치머만 크뤼거 하르트만 랑게 베르너 크라우제 레만 쾰러 헤르만 쾨니히 발터 후버 카이저 푹스 페터스 랑 슈미츠 짐머 부슈 프랑케'],
  it: ['fl', '로렌초 레오나르도 프란체스코 알레산드로 마티아 안드레아 가브리엘레 토마소 리카르도 에도아르도 마테오 조반니 페데리코 다비데 루카 마르코 니콜로 피에트로 시모네 잔루카 파비오 스테파노 크리스티안 다니엘레 알베르토 클라우디오 조르조 사무엘레 에마누엘레 자코모',
    '로시 루소 페라리 에스포지토 비앙키 로마노 콜롬보 리치 마리노 그레코 브루노 갈로 콘티 데루카 코스타 조르다노 리초 롬바르디 모레티 바르바리 폰타나 산토로 마리니 리날디 카루소 페라라 갈리 마르티니 레오네 롱고 젠틸레 마르티넬리 비탈레 세라 코폴라 데산티스 다미코 파리시 벨로 구이디'],
  nl: ['fl', '단 셈 뤼크 밀란 레비 노아 핀 바스 테이스 스테인 예스퍼르 뤼번 요리스 브람 팀 예서 닐스 바르트 쿤 예룬 퇸 스벤 마츠 라이언 토마스 얀 아르너 피터르 바우터르 시모너',
    '얀선 바커르 피서르 스밋 메이르 뮐더르 보스 포스 페테르스 헨드릭스 판레이우언 데커르 브라우어르 데이크스트라 스미츠 코크 야코프스 페이터르스 얀선스 마스 빌럼스 클라스 호선스 바우터르스 스테번스 데스메트 판담 페르묄런 판덴베르흐 더흐로트 더한 플라선'],
  nord: ['fl', '라스무스 마티아스 미켈 프레데리크 마그누스 올리베르 에밀 빅토르 오스카르 루카스 알렉산데르 안데르스 요나스 헨리크 시몬 야코브 토마스 마르틴 시구르 칼 에리크 레오 닐스 페르 이사크 요아킴 크리스토페르 비에른 아르비드 울리크',
    '한센 닐센 옌센 페데르센 안데르센 라르센 쇠렌센 라스무센 크리스텐센 올센 요한센 칼손 닐손 에릭손 라르손 안데르손 요한손 페테르손 올손 스벤손 베리 린드 할보르센 스트란드 묄레르 마센 크리스티안센 베르그 홀름 룬드'],
  pl: ['fl', '야쿠프 카츠페르 필리프 미코와이 바르토시 마테우시 카롤 파베우 토마시 아담 크시슈토프 미하우 피오트르 우카시 그제고시 다비드 마르친 시몬 보이치에흐 아르카디우시 다미안 프셰미스와프 라파우 세바스티안 얀',
    '노바크 코발스키 비시니에프스키 부이치크 코발치크 카민스키 시만스키 보즈니아크 돔브로프스키 코즐로프스키 얀코프스키 마주르 크비아트코프스키 크라프치크 카치마레크 피오트로프스키 그라보프스키 자용츠 파브워프스키 미할스키 크룰 비에초레크 야보르스키 마예프스키 올셰프스키'],
  cz: ['fl', '얀 야쿠프 토마시 다비트 루카시 온드제이 페트르 미할 필리프 보이테흐 아담 마테이 시몬 파벨 이르지 마레크 다니엘 라디슬라프 밀란 마르틴 바츨라프 즈데녜크 루보시 로만 카렐',
    '노바크 스보보다 노보트니 드보르자크 체르니 프로하스카 쿠체라 베셀리 호라크 네메츠 포코르니 마레크 포스피실 하예크 크랄 루지치카 베네시 파타크 시마 브라베츠 코바르시 우르반 블라제크 셰베크 야노우셰크'],
  slav: ['fl', '루카 이반 마르코 마테오 요시프 안테 니콜라 페타르 스테판 밀로시 두샨 네마냐 알렉산다르 브라니슬라프 마리오 도마고이 데얀 보르나 크리스티얀 토미슬라프 다리오 우로시 라자르 필립 블라디미르 즈보니미르 미할로 데니스 레오 니코',
    '호르바트 바비치 마리치 유리치 노바코비치 코바체비치 크네제비치 마르코비치 페트로비치 요바노비치 니콜리치 일리치 파블로비치 밀로셰비치 토도로비치 조르제비치 스테바노비치 라도비치 부코비치 루키치 바실리예비치 사비치 블라제비치 그르구리치 시미치 마티예비치 쿠지치 밀레티치'],
  ua: ['fl', '올렉산드르 안드리 드미트로 세르히 미하일로 볼로디미르 빅토르 막심 일리야 아르템 로만 예우헨 이반 바실 보흐단 타라스 유리 올레흐 데니스 키릴 미콜라 페트로 나자르 블라디슬라우 오스타프',
    '코발렌코 본다렌코 트카첸코 크라우첸코 셰우추크 보이코 코발추크 모로즈 리센코 폴리시추크 사우첸코 루덴코 마르첸코 레우첸코 클리멘코 파우렌코 페트렌코 마투시추크 야레멘코 시도렌코 마르추크 흐리호렌코 오멜첸코 사벤코 쿠즈멘코'],
  ru: ['fl', '알렉산드르 드미트리 세르게이 안드레이 알렉세이 미하일 이반 막심 니키타 아르툠 일리야 키릴 로만 파벨 표도르 이고리 블라디미르 다닐 예고르 마트베이 빅토르 유리 데니스 콘스탄틴 니콜라이',
    '이바노프 스미르노프 쿠즈네초프 포포프 바실리예프 페트로프 소콜로프 미하일로프 노비코프 표도로프 모로조프 볼코프 알렉세예프 레베데프 세묘노프 예고로프 파블로프 코즐로프 스테파노프 니콜라예프 오를로프 안드레예프 마카로프 니키틴 자하로프 자이체프 솔로비요프 보리소프 야코블레프 그리고리예프'],
  tr: ['fl', '메흐메트 무스타파 아흐메트 알리 휘세인 하산 이브라힘 이스마일 오스만 유수프 무라트 엠레 부라크 케렘 아르다 하칸 오잔 에네스 우우르 세르칸 오우즈 바르시 메르트 칸 에게 셀추크 오칸 토르가 바투한 이이트',
    '일마즈 카야 데미르 샤힌 첼리크 일디즈 일드름 외즈튀르크 아이든 외즈데미르 아르슬란 도안 클르치 아스란 체틴 카라 코치 쿠르트 외즈칸 심셰크 폴라트 악타시 귀네시 바이라크 아크소이 우잔 에르템 칼칸 코르크마즈 타시'],
  gr: ['fl', '기오르고스 요안니스 콘스탄티노스 디미트리오스 니콜라오스 파나요티스 바실리오스 크리스토스 아타나시오스 미할리스 에방겔로스 스타브로스 안토니오스 소티리오스 페트로스 알렉산드로스 아나스타시오스 엘레프테리오스 타소스 야니스',
    '파파도풀로스 파파스 게오르기우 디미트리우 니콜라우 콘스탄티누 바실리우 요안누 카라야니스 파파니콜라우 마크리스 알렉시우 스타브루 테오도루 미할리디스 안토니우 파나요투 하치스 카라마니스 테오도라키스 파파다키스 니콜라이디스 게오르가코풀로스 스필리오풀로스 코치아스'],
  ar: ['fl', '무함마드 아흐마드 알리 오마르 칼리드 유세프 하산 이브라힘 압둘라 파이살 마흐무드 사우드 술탄 나세르 타리크 카림 함자 아민 야신 빌랄 아이만 아델 와엘 라시드 사미르 사이드 마지드 자이드 아나스 이스마일',
    '알하르비 알카흐타니 알오타이비 알샴마리 알아흐마디 알가므디 알자흐라니 알말리키 엘사예드 아브델라흐만 압델아지즈 벤살라 부지드 엘암라니 벤나세르 엘카디리 만수르 아바스 하다드 사브리 엘마스리 파루크 슈크리 함디 야히아 벤유세프 엘하다드 부알렘 벤아마르 지야니'],
  fa: ['fl', '알리 메흐디 레자 호세인 모함마드 아미르 사이드 마수드 아라시 밀라드 사만 바히드 에산 카림 오미드 파르하드 하미드 나비드 마지드 아바스',
    '모함마디 호세이니 아마디 레자에이 카리미 무사비 자파리 라히미 헤이다리 사데기 헤다야티 나자피 아크바리 타헤리 에브라히미 졸파가리 골라미 바게리 모라디 자말리'],
  af: ['fl', '치디 에메카 오비나 은남디 체디 투니 아데몰라 바요 셰운 쿤레 코피 크와메 콰베나 야우 코조 쿠아쿠 에마누엘 사무엘 대니얼 피터 조지프 스티븐 아이작 프린스 이브라힘 무사 우스만 압둘라히 시디크 유수프',
    '오콘쿼 오코예 은와추쿠 에제 오비 아데예미 오군데 바바 오세이 멘사 아산테 아체암퐁 아도 아피아 오포리 단소 아모아 아게망 크와르테이 오카포르 아쿠 벨로 알리유 에비네 오니에부치 아조쿠 오그부 이체 오파레 쿠포르'],
  za: ['fl', '시포 타보 만들라 템바 루소 반디 테보호 브라이언 테렌스 퍼시 론웬 시야 루세코 은코시 프린스 키스 시브시소 루카 마지 탐사카',
    '은코시 즈와네 마흘랑구 은데벨레 모코에나 들라미니 마부자 은투리 마시레 쿠말로 시톨레 마테베 모쇠오 은들로부 체벨레 마카 피텔라 음바타 시방데 카바'],
  th: ['fl', '솜차이 아피왓 수파촉 나타퐁 끼띠퐁 위라퐁 차이야퐁 타나왓 수폰 위차이 사릿 니폰 워라웃 시티차이 꽁끄릿 포라민 끄릿사다 수라찻 파타라 아논',
    '차이야웡 수완나랏 시리퐁 짠타웡 깨우깐야 퐁사왓 롯차나 위롯 분쏨 인타폰 짜런숙 텅깨우 시사뭇 깜마니 분타웡 아룬삭 수티삭 퐁쁘라섯 차이숙 랏따나'],
  vi: ['lf', '반남 득안 탄푹 반캉 꽝빈 후이호앙 득롱 반선 띠엔훙 꾸옥안 쑤언남 탄빈 민득 호아이남 득타인 반쭝 띠엔동 민뚜언 반타인 탄롱',
    '응우옌 응우옌 응우옌 쩐 쩐 레 팜 호앙 판 부 당 부이 도 호 응오 즈엉 리'],
  id: ['fl', '리즈키 안디 부디 아궁 리키 하리스 판디 야코브 다니엘 사디드 위라 디마스 람단 하리 바구스 일한 테구 파잘 라마 유다',
    '프라세티오 사푸트라 위자야 하디 누그로호 산토소 쿠수마 세티아완 히다야트 하르얀토 위보워 수산토 구나완 위디안토 마울라나 피르만샤 라흐맛 수기야르토 아리피안 하르토노'],
  uz: ['fl', '오타베크 자수르 엘도르 아지즈 쇼흐루흐 자혼기르 오스톤 아브로르 사르도르 베흐조드 도스톤 아크말 우미드 루스탐 티무르 파루흐 아지즈베크 잠시드 바흐티요르 이스로일',
    '카리모프 라시도프 유수포프 알리예프 투르소노프 에르가셰프 마흐무도프 사이도프 하이다로프 나자로프 아브두라흐모노프 이스마일로프 사파로프 우스모노프 미르자예프 할리로프 토지예프 노르마토프 쇼디예프 율다셰프'],
  hu: ['fl', '벤체 마테 다니엘 도미니크 아담 레벤테 마르톤 다비드 졸트 어틸러 페렌츠 라슬로 가보르 이슈트반 샨도르 야노시 터마시 크리스토프 롤란드 노르베르트 벌라주 보톤드 빌모시 밀란 로베르트',
    '너지 코바치 토트 서보 호르바트 버르거 키시 몰나르 네메트 퍼르커시 벌로그 퍼프 터카치 유하스 러커토시 메사로시 올라흐 시몬 라츠 페케테 서르커 보로시 머저르 쇠케 커토너'],
  ro: ['fl', '안드레이 알렉산드루 이오누트 미하이 스테판 라즈반 플로린 보그단 크리스티안 마리우스 다리우스 코스민 가브리엘 아드리안 블라드 니콜라에 소린 발렌틴 이온 오비디우 비오렐 로베르트 다니엘 루카 데니스',
    '포페스쿠 이오네스쿠 포파 라두 디누 스탄 스토이카 제오르제스쿠 마테이 콘스탄틴 세르반 루푸 무레샨 투도르 디아코누 올테아누 바실레 마리네스쿠 니쿨레스쿠 크리스테아 미트레아 두미트루 네아구 일리에 도브레']
};

// 실존 유명 선수와 겹치는 조합은 다시 뽑음
const BLOCKED_NAMES = new Set(('양민혁 조현우 정승현 이승우 이민성 황선우 이토_히로키 스즈키_유이토 ' +
  '잭_해리슨 벤_데이비스 조슈아_킹 조_앨런 스티븐_데이비스 ' +
  '크리스티안_로메로 에밀리아노_마르티네스 루이스_디아스 산티아고_히메네스 하비에르_에르난데스 마르코스_알론소 세르히오_로메로 디에고_로페스 ' +
  '라울_히메네스 하비에르_마르티네스 루이스_가르시아 카를로스_산체스 라울_가르시아 니콜라스_곤살레스 니콜라스_도밍게스 디에고_고메스 ' +
  '로드리고_에르난데스 알레한드로_고메스 호아킨_산체스 치아구_실바 히카르두_카르발류 안드레_실바 누누_멘드스 디오구_코스타 ' +
  '히카르두_페레이라 브루누_아우베스 마테우스_누네스 파울루_소자 루카스_리마 안드레_고메스 가브리에우_바르보자 히카르두_코스타 ' +
  '세르지우_올리베이라 토마스_뮐러 요나스_호프만 니코_슐츠 로빈_코흐 마르코_리히터 하네스_볼프 안드레아_콘티 클라우디오_젠틸레 ' +
  '마르코_로시 헨리크_라르손 토마스_쇠렌센 라스무스_크리스텐센 마티아스_옌센 요나스_올손 이반_일리치 안드레이_세묘노프 ' +
  '부라크_일마즈 바르시_일마즈 알리_코치 오우즈_아이든 디미트리오스_파파도풀로스 이스마일_벤나세르 마흐무드_하산 아흐마드_하산 ' +
  '알리_카리미 밀라드_모함마디 오미드_에브라히미 마지드_호세이니 사무엘_쿠포르 스티븐_아피아 테보호_모코에나 템바_즈와네 ' +
  '사르도르_라시도프 졸트_너지 아담_너지 이오누트_라두 안드레이_라두').replace(/_/g, '\u00a0').split(' ').map(n => n.replace(/\u00a0/g, ' ')));

// 해외 진출 선수 국적 가중치
const EXPORT_WEIGHTS = 'BRA:10 ARG:7 FRA:6 ESP:5 POR:4 ENG:3 GER:3 ITA:3 NED:3 BEL:2 CRO:2 SRB:2 URU:2 COL:2 NGA:3 GHA:2 MAR:2 ALG:1 EGY:1 TUN:1 ' +
  'JPN:2 KOR:2 USA:2 MEX:1 DEN:2 NOR:1 SWE:2 POL:2 CZE:1 AUT:1 SUI:1 TUR:1 GRE:1 UKR:1 RUS:1 ROU:1 HUN:1 CHI:1 PAR:1 ECU:1 ' +
  'PER:1 VEN:1 BOL:1 SCO:1 IRL:1 CAN:1 CRC:1 AUS:1 IRN:1 RSA:1 CHN:1 THA:1 VIE:1 IDN:1 UZB:1';

// ===== 2. 공용 도구 =====
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 정수 해시: 입력이 같으면 항상 같은 값
function hash(...nums) {
  let h = 0x811c9dc5;
  for (const n of nums) {
    h = Math.imul(h ^ (n | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

// 시드 난수 (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const randInt = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));

// ===== 3. 세계: 국가·리그·구단 =====
const BIG5 = 5; // COUNTRY_DATA 앞 5개국
const COUNTRIES = COUNTRY_DATA.map(([id, name, region, pool, suffix, level, tiers, cities], i) =>
  ({ i, id, name, region, pool, suffix, level, tiers, cities: cities.split(' '), clubs: [] }));
const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
const NAMES = Object.fromEntries(Object.entries(NAME_DATA).map(([k, [order, first, last]]) =>
  [k, { order, first: first.split(' '), last: last.split(' ') }]));
const EXPORTERS = EXPORT_WEIGHTS.split(' ').flatMap(s => {
  const [id, w] = s.split(':');
  return Array(Number(w)).fill(id);
});

// 부별 평균 수준: 5대 리그는 부마다 7, 나머지는 8씩 낮아짐
const tierLevel = (country, t) => country.level - t * (country.i < BIG5 ? 7 : 8);
const leagueName = (country, t) => `${country.name} ${t + 1}부`;

// 구단: 부별로 강한 순서, 큰 도시부터 배정
const CLUBS = [];
for (const country of COUNTRIES) {
  const r = rng(hash(WORLD_SEED, country.i));
  const suffixes = CLUB_SUFFIX[country.suffix].split(' ');
  const used = new Set();
  let n = 0;
  country.tiers.forEach((size, t) => {
    const list = [];
    for (let k = 0; k < size; k++, n++) {
      const city = country.cities[n % country.cities.length];
      let si = Math.floor(r() * suffixes.length);
      let name = `${city} ${suffixes[si % suffixes.length]}`;
      while (used.has(name)) name = `${city} ${suffixes[++si % suffixes.length]}`;
      used.add(name);
      const club = { id: CLUBS.length, name, country, t, rank: k, off: 6 - (12 * k) / Math.max(1, size - 1) + (r() - 0.5) * 2 };
      CLUBS.push(club);
      list.push(club);
    }
    country.clubs.push(list);
  });
}
const SLOTS = CLUBS.length * SQUAD;

// ===== 4. 선수: 시드·슬롯·세대가 같으면 항상 같은 선수 =====
const AGE_ADJ = [-10, -8, -6, -4.5, -3, -2, -1, -0.5, -0.5, 0, 0, 0, 0, 0, -1, -2, -3, -4.5]; // 17~34세

// 생성 당시 나이: 첫 세대 17~34세(25세 전후가 많음), 빈자리에 들어온 새 선수 17~23세
const creationAge = (r, g) => (g === 0 ? 17 + Math.floor(((r() + r()) / 2) * 18) : 17 + Math.floor(r() * 7));

// 시즌 말 이탈 확률(나이별): 은퇴·하부 리그 이동을 합친 값. 30시즌 동안 나이 분포가 안정되도록 맞춤
const leaveChance = age => (age <= 22 ? 0.02 : age <= 29 ? 0.03 : age <= 32 ? 0.07 : age === 33 ? 0.15 : age === 34 ? 0.3 : age === 35 ? 0.5 : age === 36 ? 0.75 : 1);

function nationalityFor(club, r) {
  const c = club.country;
  const domestic = c.i < BIG5 ? (club.t === 0 ? 0.55 : 0.75) : (club.t === 0 ? 0.82 : 0.9);
  if (r() < domestic) return c;
  let id;
  do id = pick(EXPORTERS, r); while (id === c.id);
  return COUNTRY_BY_ID[id];
}

function makeName(country, r) {
  const pool = NAMES[country.pool];
  let name = '';
  for (let i = 0; i < 8; i++) {
    const first = pick(pool.first, r);
    const last = pick(pool.last, r);
    name = pool.order === 'join' ? last + first : pool.order === 'lf' ? `${last} ${first}` : `${first} ${last}`;
    if (!BLOCKED_NAMES.has(name)) break;
  }
  return name;
}

// 숫자 부분: 나이·능력·잠재력. 난수 순서를 바꾸면 기존 세이브의 선수가 바뀌므로 유지
function coreStats(s, r) {
  const w = state.world;
  const club = CLUBS[Math.floor(s / SQUAD)];
  const age0 = creationAge(r, w.gen[s]);
  const noise = (r() + r() + r() - 1.5) * 5 + (r() < 0.02 ? 6 : 0);
  const base = clamp(Math.round(tierLevel(club.country, club.t) + club.off + AGE_ADJ[age0 - 17] + noise), 40, 90);
  const headroom = Math.max(0, 24 - age0) * (0.8 + r() * 1.6) + r() * 3 + (r() < 0.03 ? 8 : 0);
  const pot = clamp(Math.round(base + headroom), base, 95);
  return { club, base, pot, ability: clamp(base + w.grow[s], 40, 90), birth: w.gseason[s] - age0 };
}

function getPlayer(s) {
  const w = state.world;
  const g = w.gen[s];
  const born = w.gseason[s]; // 이 세대가 등장한 시즌
  const r = rng(hash(state.seed, s, g));
  const core = coreStats(s, r);
  const nat = nationalityFor(core.club, r);
  return { s, g, club: core.club, nat, name: makeName(nat, r), pos: POS_BY_SLOT[s % SQUAD], ability: core.ability, pot: core.pot, birth: core.birth, start: (born - 1) * WEEKS + 1 };
}

// 주급: 능력에 따라 가파르게 오름 (능력 40 ≈ $210, 60 ≈ $5K, 80 ≈ $126K)
function weeklyWage(ability) {
  const v = 210 * Math.exp(0.16 * (ability - 40));
  const step = v < 1000 ? 10 : v < 10000 ? 50 : v < 100000 ? 500 : 5000;
  return Math.round(v / step) * step;
}
const commissionOf = wage => Math.round(wage * FEE_RATE);
const upkeepNow = () => UPKEEP_BASE + UPKEEP_PER_CLIENT * state.clients.length;

// 시즌 말 능력 변화: 28세까지는 잠재력 쪽으로(어릴수록 크게), 29세부터 하락. 평균 폼이 좋으면 조금 더 큼
function growthStep(age, ability, pot, avgForm, x) {
  if (age <= 28) {
    const rate = age <= 20 ? 0.3 : age <= 23 ? 0.22 : 0.12;
    const formMul = 0.7 + ((avgForm - 1) / 9) * 0.6;
    return Math.max(0, Math.min(pot - ability, Math.round((pot - ability) * rate * formMul * (0.6 + x * 0.8))));
  }
  if (age <= 31) return x < 0.5 ? 0 : -1;
  return -(1 + Math.floor(x * (age >= 34 ? 3 : 2)));
}

const ageOf = p => state.season - p.birth;

// 은퇴 판정용: 이름 등을 만들지 않고 나이만 계산
function slotAge(s) {
  const w = state.world;
  return state.season - (w.gseason[s] - creationAge(rng(hash(state.seed, s, w.gen[s])), w.gen[s]));
}

// 몸값: 능력에 따라 가파르게 오르고, 23세 이하 가산, 30세 이상 감산, 지난 시즌 평균 폼 소폭 반영
function marketValue(ability, age, pot, avgForm) {
  let v = 25000 * Math.exp(0.165 * (ability - 40));
  if (age <= 23) v *= 1 + (pot - ability) * 0.035;
  if (age >= 30) v *= Math.pow(0.85, age - 29);
  v *= 1 + (avgForm - 5.5) * 0.02;
  const step = v < 1e6 ? 5000 : v < 1e7 ? 50000 : 500000;
  return Math.max(5000, Math.round(v / step) * step);
}
const valueOf = p => marketValue(p.ability, ageOf(p), p.pot, state.world.favg[p.s] / 2);

// 폼: 매주 -1/0/+1, 8 이상이면 내려갈 확률을, 3 이하면 올라갈 확률을 높여 극단에 머물지 않게 함
const FORM_HIGH = [-1, -1, 0, 1];
const FORM_LOW = [-1, 0, 1, 1];
const FORM_MID = [-1, 0, 1];
function nextForm(f, x) {
  const steps = f >= 8 ? FORM_HIGH : f <= 3 ? FORM_LOW : FORM_MID;
  return clamp(f + steps[Math.floor(x * steps.length)], 1, 10);
}

// 계약 만료 시점(절대 주차). 소속 선수가 아니면 만료 때 구단이 자동 재계약
const absWeek = () => (state.season - 1) * WEEKS + state.week;
function contractEnd(p, now) {
  const r = rng(hash(state.seed, p.s, p.g, 7));
  let end = p.start + (p.g === 0 ? randInt(10, 208, r) : randInt(52, 156, r));
  while (end < now) end += randInt(52, 208, r);
  return end;
}
const weekLabel = abs => `${Math.floor((abs - 1) / WEEKS) + 1}시즌 ${((abs - 1) % WEEKS) + 1}주`;

// ===== 5. 상태 =====
let state = null;
const DEFAULT_UI = { tab: 'clients', country: null, tier: null, club: null, player: null };

function newWorld(seed) {
  const r = rng(hash(seed, 1));
  return {
    form: new Uint8Array(SLOTS).map(() => randInt(4, 7, r)),
    delta: new Int8Array(SLOTS),
    fsum: new Uint16Array(SLOTS),
    favg: new Uint8Array(SLOTS).fill(11), // 평균 폼 × 2 (처음엔 5.5)
    gen: new Uint8Array(SLOTS),
    gseason: new Uint16Array(SLOTS).fill(1),
    grow: new Int8Array(SLOTS) // 시즌 말 성장·하락 누적치
  };
}

function newGame() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  state = {
    version: SAVE_VERSION, seed, season: 1, week: 1,
    agencyCash: START_CASH, rep: START_REP, ap: AP_PER_WEEK, debtWeeks: 0, over: false,
    clients: [], cooldowns: {}, logs: [], summary: null,
    ui: { ...DEFAULT_UI },
    world: newWorld(seed)
  };
  state.clients = pickStartingClients();
  addLog(`에이전시를 열었습니다. 소속 선수 ${state.clients.length}명과 함께 시작합니다.`);
  saveState();
}

// 시작 소속 선수: 한국 국적, 능력 45~66, 유망주 2·중견 2·베테랑 1, 능력 62 이상과 GK는 1명까지
function pickStartingClients() {
  const r = rng(hash(state.seed, 99));
  const kor = COUNTRY_BY_ID.KOR;
  const pool = [];
  for (const club of kor.clubs.flat()) {
    for (let k = 0; k < SQUAD; k++) {
      const p = getPlayer(club.id * SQUAD + k);
      if (p.nat === kor && p.ability >= 45 && p.ability <= 66) pool.push(p);
    }
  }
  // 주급 합계가 $12K~16K인 조합을 고름 → 시작 주간 수지가 소폭 흑자
  let chosen = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    chosen = [];
    const fits = (p, lo, hi) => {
      const age = ageOf(p);
      return age >= lo && age <= hi && !chosen.includes(p) && !chosen.some(c => c.name === p.name)
        && (age > 21 || p.pot >= p.ability + 8)
        && (p.ability < 62 || !chosen.some(c => c.ability >= 62))
        && (p.pos !== 'GK' || !chosen.some(c => c.pos === 'GK'));
    };
    for (const [lo, hi, n] of [[18, 21, 2], [22, 27, 2], [28, 31, 1]]) {
      for (const p of pool) {
        if (chosen.filter(c => ageOf(c) >= lo && ageOf(c) <= hi).length === n) break;
        if (fits(p, lo, hi)) chosen.push(p);
      }
    }
    const total = chosen.reduce((n, p) => n + weeklyWage(p.ability), 0);
    if (chosen.length === 5 && total >= 12000 && total <= 16000) break;
  }
  return chosen.map(p => ({ s: p.s, g: p.g, end: contractEnd(p, 1), wage: weeklyWage(p.ability) }));
}

function addLog(text) {
  state.logs.unshift(`${state.season}시즌 ${state.week}주 · ${text}`);
  if (state.logs.length > 80) state.logs.length = 80;
}

// ===== 6. 주간 진행 =====
const cash = v => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const signedCash = v => (v >= 0 ? `+${cash(v)}` : cash(v));
const cooldownKey = p => `${p.s}-${p.g}`;

function advanceWeek() {
  if (state.over) return;
  const w = state.world;
  for (let s = 0; s < SLOTS; s++) {
    const f = nextForm(w.form[s], Math.random());
    w.delta[s] = f - w.form[s];
    w.form[s] = f;
    w.fsum[s] += f;
  }

  // 주간 정산: 수수료 수입 - 운영비
  const income = state.clients.reduce((n, c) => n + commissionOf(c.wage), 0);
  const upkeep = upkeepNow();
  state.agencyCash += income - upkeep;

  state.week += 1;
  if (state.week > WEEKS) endSeason();
  state.ap = AP_PER_WEEK;
  const now = absWeek();
  for (const key of Object.keys(state.cooldowns)) if (state.cooldowns[key] <= now) delete state.cooldowns[key];

  const moved = state.clients
    .filter(c => w.delta[c.s] !== 0)
    .map(c => `${getPlayer(c.s).name} ${w.form[c.s]}${w.delta[c.s] > 0 ? '▲' : '▼'}`);
  addLog(moved.length ? `폼 변화: ${moved.join(', ')}` : '소속 선수 폼 변화 없음');
  addLog(`정산 ${signedCash(income - upkeep)} (수수료 ${cash(income)}, 운영비 ${cash(upkeep)})`);
  checkDebt();
  saveState();
}

// 자금이 마이너스면 평판 -1, 8주 이어지면 파산
function checkDebt() {
  if (state.agencyCash >= 0) {
    state.debtWeeks = 0;
    return;
  }
  state.debtWeeks += 1;
  state.rep = Math.max(0, state.rep - 1);
  if (state.debtWeeks >= DEBT_LIMIT) {
    state.over = true;
    addLog(`자금 마이너스가 ${DEBT_LIMIT}주 이어져 에이전시가 파산했습니다.`);
  } else {
    addLog(`자금이 마이너스입니다 (평판 -1). ${DEBT_LIMIT - state.debtWeeks}주 안에 흑자로 돌리지 못하면 파산합니다.`);
  }
}

// 시즌 말: 평균 폼 확정, 성장·하락, 나이 +1(시즌에서 계산), 은퇴와 새 선수 교체, 평판 반영, 결산 작성
function endSeason() {
  const w = state.world;
  const before = state.clients.map(c => {
    const p = getPlayer(c.s);
    return { name: p.name, age: ageOf(p), ability: p.ability, value: valueOf(p) };
  });
  for (let s = 0; s < SLOTS; s++) {
    w.favg[s] = Math.round((w.fsum[s] / WEEKS) * 2);
    w.fsum[s] = 0;
  }

  // 성장·하락: 이번 시즌 나이와 평균 폼 기준
  const rg = rng(hash(state.seed, 6, state.season));
  for (let s = 0; s < SLOTS; s++) {
    const c = coreStats(s, rng(hash(state.seed, s, w.gen[s])));
    const step = growthStep(state.season - c.birth, c.ability, c.pot, w.favg[s] / 2, rg());
    w.grow[s] = clamp(w.grow[s] + step, 40 - c.base, 90 - c.base);
  }

  state.week = 1;
  state.season += 1;

  // 소속 선수는 33세 미만이면 이탈하지 않음 (은퇴만 함)
  const r = rng(hash(state.seed, 5, state.season));
  const clientSlots = new Set(state.clients.map(c => c.s));
  let retired = 0;
  for (let s = 0; s < SLOTS; s++) {
    const age = slotAge(s);
    if (clientSlots.has(s) && age < 33) continue;
    if (r() < leaveChance(age)) {
      w.gen[s] += 1;
      w.gseason[s] = state.season;
      w.form[s] = randInt(4, 7, r);
      w.delta[s] = 0;
      w.favg[s] = 11;
      w.grow[s] = 0;
      retired += 1;
    }
  }

  const rows = [];
  let valueFrom = 0;
  let valueTo = 0;
  state.clients = state.clients.filter((c, i) => {
    if (w.gen[c.s] !== c.g) {
      rows.push({ name: before[i].name, ageFrom: before[i].age, retired: true });
      return false;
    }
    const p = getPlayer(c.s);
    const value = valueOf(p);
    rows.push({ name: p.name, ageFrom: before[i].age, ageTo: ageOf(p), abilityFrom: before[i].ability, abilityTo: p.ability, valueFrom: before[i].value, valueTo: value });
    valueFrom += before[i].value;
    valueTo += value;
    return true;
  });

  // 평판: 소속 선수 몸값 합계 변화율 × 10 (±3까지)
  const repChange = valueFrom > 0 ? clamp(Math.round(((valueTo - valueFrom) / valueFrom) * 10), -3, 3) : 0;
  state.rep = clamp(state.rep + repChange, 0, 100);
  state.summary = { season: state.season - 1, rows, retired, repChange, seen: false };
  addLog(`${state.season - 1}시즌 종료. 평판 ${repChange >= 0 ? '+' : ''}${repChange}. 세계에서 ${retired.toLocaleString('ko-KR')}명이 은퇴하거나 떠나고 새 선수가 들어왔습니다.`);
}

// ===== 영입·해지 =====
const recruitCost = p => Math.round((500 + weeklyWage(p.ability)) / 100) * 100;

// 성공 확률: 평판이 선수 수준((능력-40)×2)보다 높을수록 오름, 21세 이하 +10, 5~90%
const recruitChance = p => clamp(Math.round(60 + state.rep - (p.ability - 40) * 2 + (ageOf(p) <= 21 ? 10 : 0)), 5, 90);

// 영입을 막는 이유 (없으면 빈 문자열)
function recruitBlock(p) {
  if (state.over) return '파산한 게임입니다';
  if (state.clients.some(c => c.s === p.s)) return '이미 소속 선수입니다';
  if (state.clients.length >= CLIENT_LIMIT) return `소속 선수가 한도(${CLIENT_LIMIT}명)에 찼습니다`;
  if (state.ap < 1) return '이번 주 행동력(AP)을 다 썼습니다';
  if (state.agencyCash < 0) return '자금이 마이너스라 영입할 수 없습니다';
  if (state.agencyCash < recruitCost(p)) return `자금이 부족합니다 (${cash(recruitCost(p))} 필요)`;
  const until = state.cooldowns[cooldownKey(p)];
  if (until > absWeek()) return `거절당한 선수입니다. ${until - absWeek()}주 뒤 다시 제안할 수 있습니다`;
  return '';
}

function recruit(s) {
  const p = getPlayer(s);
  const block = recruitBlock(p);
  if (block) {
    toast(block);
    return;
  }
  const cost = recruitCost(p);
  state.ap -= 1;
  state.agencyCash -= cost;
  if (Math.random() * 100 < recruitChance(p)) {
    const gain = 1 + Math.floor((p.ability - 40) / 15);
    state.clients.push({ s, g: p.g, end: contractEnd(p, absWeek()), wage: weeklyWage(p.ability) });
    state.rep = Math.min(100, state.rep + gain);
    addLog(`${p.name} 영입 성공 (비용 ${cash(cost)}, 평판 +${gain})`);
    toast(`${p.name} 선수와 계약했습니다.`);
  } else {
    state.cooldowns[cooldownKey(p)] = absWeek() + RETRY_WEEKS;
    addLog(`${p.name} 영입 실패 (비용 ${cash(cost)}). ${RETRY_WEEKS}주 뒤 다시 제안할 수 있습니다.`);
    toast('영입 제안이 거절됐습니다.');
  }
  saveState();
}

function release(s) {
  const i = state.clients.findIndex(c => c.s === s);
  if (i < 0) return false;
  const p = getPlayer(s);
  if (!confirm(`${p.name} 선수와 계약을 해지할까요? 평판이 1 내려갑니다.`)) return false;
  state.clients.splice(i, 1);
  state.rep = Math.max(0, state.rep - 1);
  addLog(`${p.name} 선수와 계약을 해지했습니다 (평판 -1).`);
  saveState();
  return true;
}

// ===== 7. 저장·불러오기 =====
// 세계 배열은 36진수 고정폭 문자열로 압축 저장 [키, 폭, 형식, 보정값]
const PACK = [['form', 1, Uint8Array, 0], ['delta', 1, Int8Array, 1], ['fsum', 2, Uint16Array, 0],
  ['favg', 1, Uint8Array, 0], ['gen', 2, Uint8Array, 0], ['gseason', 2, Uint16Array, 0], ['grow', 2, Int8Array, 128]];

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const DIGIT2 = Array.from({ length: 1296 }, (_, v) => DIGITS[Math.floor(v / 36)] + DIGITS[v % 36]);

function packArray(arr, width, bias) {
  const table = width === 1 ? DIGITS : DIGIT2;
  const parts = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) parts[i] = table[arr[i] + bias];
  return parts.join('');
}

function unpackArray(str, width, Type, bias) {
  const arr = new Type(str.length / width);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(str.slice(i * width, i * width + width), 36) - bias;
  return arr;
}

function serialize() {
  const world = {};
  for (const [key, width, , bias] of PACK) world[key] = packArray(state.world[key], width, bias);
  return JSON.stringify({ ...state, slots: SLOTS, world });
}

// 1단계(v1) 세이브도 읽음: 성장치 0, 행동력·빚·재제안 기록 기본값, 주급은 불러온 뒤 채움
function deserialize(text) {
  const d = JSON.parse(text);
  const int = v => Number.isInteger(v);
  if (!d || (d.version !== 1 && d.version !== SAVE_VERSION)) throw new Error('지원하지 않는 버전입니다');
  if (d.slots !== SLOTS) throw new Error('세계 구성이 다른 세이브입니다');
  if (!int(d.seed) || !int(d.season) || d.season < 1 || !int(d.week) || d.week < 1 || d.week > WEEKS) throw new Error('날짜 정보가 올바르지 않습니다');
  if (!Number.isFinite(d.agencyCash) || !Number.isFinite(d.rep) || !Array.isArray(d.logs)) throw new Error('기본 정보가 올바르지 않습니다');
  if (!Array.isArray(d.clients) || d.clients.length > CLIENT_LIMIT || !d.clients.every(c => c && int(c.s) && c.s >= 0 && c.s < SLOTS && int(c.g) && int(c.end))) throw new Error('소속 선수 정보가 올바르지 않습니다');
  if (!d.world) throw new Error('세계 정보가 없습니다');
  const world = {};
  for (const [key, width, Type, bias] of PACK) {
    const str = d.world[key];
    if (key === 'grow' && d.version === 1) {
      world.grow = new Int8Array(SLOTS);
      continue;
    }
    if (typeof str !== 'string' || str.length !== SLOTS * width) throw new Error('세계 정보가 손상되었습니다');
    world[key] = unpackArray(str, width, Type, bias);
  }
  const cooldowns = d.cooldowns && typeof d.cooldowns === 'object' ? d.cooldowns : {};
  return {
    ...d, version: SAVE_VERSION, logs: d.logs.map(String), world, cooldowns,
    ap: int(d.ap) ? clamp(d.ap, 0, AP_PER_WEEK) : AP_PER_WEEK,
    debtWeeks: int(d.debtWeeks) ? d.debtWeeks : 0,
    over: d.over === true,
    clients: d.clients.map(c => ({ s: c.s, g: c.g, end: c.end, wage: Number.isFinite(c.wage) ? c.wage : null })),
    ui: { ...DEFAULT_UI, ...d.ui }
  };
}

// 주급이 없는 소속 선수(v1 세이브)는 지금 능력 기준으로 채움
function fillWages() {
  for (const c of state.clients) if (c.wage === null) c.wage = weeklyWage(getPlayer(c.s).ability);
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, serialize());
  } catch (e) {
    toast('저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
  }
}

// 반환값: 'ok' | 'none' | 'broken'
function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return 'none';
  }
  if (!raw) return 'none';
  try {
    state = deserialize(raw);
    fillWages();
    return 'ok';
  } catch (e) {
    console.warn('세이브 불러오기 실패:', e.message);
    return 'broken';
  }
}

function exportSave() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serialize()], { type: 'application/json' }));
  a.download = `be-the-agent-${state.season}시즌-${state.week}주.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('저장 파일을 내보냈습니다.');
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const previous = state;
    try {
      state = deserialize(String(reader.result));
      fillWages();
    } catch (e) {
      state = previous;
      toast(`불러오지 못했습니다: ${e.message}`);
      return;
    }
    saveState();
    render();
    toast('저장 파일을 불러왔습니다.');
  };
  reader.readAsText(file);
}

// ===== 8. 화면 =====
const $ = id => document.getElementById(id);
const REGIONS = [...new Set(COUNTRIES.map(c => c.region))];
const LEAGUE_COUNT = COUNTRIES.reduce((n, c) => n + c.tiers.length, 0);
let listScroll = 0; // 선수 상세에서 돌아올 때 목록 위치 복원

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// 몸값 표시: $1.25M, $850K
function money(v) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${v}`;
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function actButton(cls, act, value, ...children) {
  const b = el('button', cls);
  b.type = 'button';
  b.dataset.act = act;
  if (value !== undefined) b.dataset.v = String(value);
  b.append(...children);
  return b;
}

const posTag = pos => el('span', `pos pos-${pos}`, pos);

function formNode(p) {
  const w = state.world;
  const d = w.delta[p.s];
  const span = el('span', d > 0 ? 'up' : d < 0 ? 'down' : '', String(w.form[p.s]));
  if (d) span.append(el('span', 'arrow', d > 0 ? ' ▲' : ' ▼'));
  return span;
}

// 계약 표시: 만료 시점 + 남은 주 (8주 이하 임박, 지나면 만료)
function contractNode(end) {
  const left = end - absWeek();
  const box = el('span', 'contract', weekLabel(end));
  const note = left < 0 ? ['bad', '만료됨'] : left === 0 ? ['bad', '이번 주 만료'] : left <= 8 ? ['warn', `만료 임박 · ${left}주`] : ['', `남은 ${left}주`];
  box.append(el('small', note[0], note[1]));
  return box;
}

function stat(label, value) {
  const box = el('span', 'stat');
  const v = el('span', 'stat-value');
  v.append(value);
  box.append(el('span', 'stat-label', label), v);
  return box;
}

function abilityBar(ability) {
  const bar = el('span', 'bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = el('i');
  fill.style.width = `${((ability - 40) / 50) * 100}%`;
  bar.append(fill);
  return bar;
}

const weeklyIncome = () => state.clients.reduce((n, c) => n + commissionOf(c.wage), 0);

function renderHeader() {
  $('hdr-date').textContent = `${state.season}시즌 · ${state.week}주`;
  $('hdr-cash').textContent = cash(state.agencyCash);
  $('hdr-cash').classList.toggle('bad', state.agencyCash < 0);
  $('hdr-rep').textContent = String(state.rep);
  $('hdr-ap').textContent = `${state.ap}/${AP_PER_WEEK}`;
  $('btn-next').disabled = state.over;
}

// 소속 선수 카드 (누르면 상세)
function clientCard(c) {
  const p = getPlayer(c.s);
  const card = actButton('card', 'player', c.s);
  const top = el('span', 'card-top');
  top.append(posTag(p.pos), el('strong', 'name', p.name), el('span', 'abil', String(p.ability)));
  const stats = el('span', 'stats');
  stats.append(stat('잠재력', String(p.pot)), stat('폼', formNode(p)), stat('몸값', money(valueOf(p))), stat('계약 만료', contractNode(c.end)));
  card.append(top, el('span', 'meta', `${ageOf(p)}세 · ${p.nat.name} · ${p.club.name} · ${leagueName(p.club.country, p.club.t)}`),
    abilityBar(p.ability), stats, el('span', 'card-foot', `주급 ${cash(c.wage)} · 내 수수료 주 ${cash(commissionOf(c.wage))}`));
  return card;
}

function renderClients(root) {
  root.append(el('h1', 'title', '내 선수'),
    el('p', 'sub', `${state.clients.length}/${CLIENT_LIMIT}명 · 주간 수수료 ${cash(weeklyIncome())} · 운영비 ${cash(upkeepNow())}`));
  const latest = el('div', 'latest');
  state.logs.slice(0, 2).forEach(line => latest.append(el('span', '', line)));
  if (state.logs.length) root.append(latest);
  if (!state.clients.length) root.append(el('p', 'empty', '소속 선수가 없습니다.'));
  state.clients.forEach(c => root.append(clientCard(c)));
  if (state.clients.length < CLIENT_LIMIT && !state.over) root.append(el('p', 'sub', '리그 탭에서 선수를 누르면 영입 제안을 할 수 있습니다 (1 AP).'));
}

// 리그: 국가 → 부 → 구단 → 선수
function clubAverage(club) {
  let sum = 0;
  for (let k = 0; k < SQUAD; k++) sum += getPlayer(club.id * SQUAD + k).ability;
  return sum / SQUAD;
}

const clientCountIn = club => state.clients.filter(c => Math.floor(c.s / SQUAD) === club.id).length;

function rowButton(act, value, label, sub, badge) {
  const main = el('span', 'row-main');
  main.append(el('span', 'row-label', label), el('span', 'row-sub', sub));
  const b = actButton('row', act, value, main);
  if (badge) b.append(el('span', 'badge mine', badge));
  return b;
}

function renderWorld(root) {
  const ui = state.ui;
  if (ui.country === null) {
    root.append(el('h1', 'title', '리그'), el('p', 'sub', `${COUNTRIES.length}개국 · ${LEAGUE_COUNT}개 리그 · 구단 ${CLUBS.length.toLocaleString('ko-KR')}개 · 선수 ${SLOTS.toLocaleString('ko-KR')}명`));
    for (const region of REGIONS) {
      const list = el('div', 'list');
      for (const c of COUNTRIES.filter(x => x.region === region)) {
        const mine = state.clients.filter(cl => CLUBS[Math.floor(cl.s / SQUAD)].country === c).length;
        list.append(rowButton('country', c.i, c.name, `${c.tiers.length}부 · ${c.clubs.flat().length}팀`, mine ? `내 선수 ${mine}` : ''));
      }
      root.append(el('h2', 'section', region), list);
    }
    return;
  }
  const country = COUNTRIES[ui.country];
  if (ui.tier === null) {
    root.append(actButton('back', 'up', undefined, '← 전체 리그'), el('h1', 'title', country.name), el('p', 'sub', `${country.region} · ${country.tiers.length}부까지`));
    const list = el('div', 'list');
    country.clubs.forEach((clubs, t) => {
      const avg = clubs.reduce((n, club) => n + clubAverage(club), 0) / clubs.length;
      const mine = clubs.reduce((n, club) => n + clientCountIn(club), 0);
      list.append(rowButton('tier', t, leagueName(country, t), `${clubs.length}팀 · 평균 능력 ${avg.toFixed(0)}`, mine ? `내 선수 ${mine}` : ''));
    });
    root.append(list);
    return;
  }
  const clubs = country.clubs[ui.tier];
  if (ui.club === null) {
    root.append(actButton('back', 'up', undefined, `← ${country.name}`), el('h1', 'title', leagueName(country, ui.tier)), el('p', 'sub', `${clubs.length}팀 · 전력 순`));
    const list = el('div', 'list');
    clubs.forEach((club, i) => {
      const mine = clientCountIn(club);
      list.append(rowButton('club', club.id, `${i + 1}. ${club.name}`, `평균 능력 ${clubAverage(club).toFixed(0)}`, mine ? `내 선수 ${mine}` : ''));
    });
    root.append(list);
    return;
  }
  renderClub(root, CLUBS[ui.club]);
}

function renderClub(root, club) {
  root.append(actButton('back', 'up', undefined, `← ${leagueName(club.country, club.t)}`), el('h1', 'title', club.name),
    el('p', 'sub', `${leagueName(club.country, club.t)} · 선수 ${SQUAD}명 · 평균 능력 ${clubAverage(club).toFixed(0)} · 선수를 누르면 상세`));
  const now = absWeek();
  const mine = new Map(state.clients.map(c => [c.s, c]));
  const players = Array.from({ length: SQUAD }, (_, k) => getPlayer(club.id * SQUAD + k))
    .sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.ability - a.ability);
  const list = el('div', 'list');
  for (const p of players) {
    const client = mine.get(p.s);
    const row = actButton(client ? 'player mine' : 'player', 'player', p.s);
    const top = el('span', 'player-top');
    top.append(posTag(p.pos), el('strong', 'name', p.name), el('span', 'player-age', `${ageOf(p)}세 · ${p.nat.name}`));
    if (client) top.append(el('span', 'badge mine', '내 선수'));
    top.append(el('span', 'abil', String(p.ability)));
    const line = el('span', 'player-line');
    line.append(`잠재 ${p.pot} · 폼 `, formNode(p), ` · ${money(valueOf(p))} · 계약 ${weekLabel(client ? client.end : contractEnd(p, now))}`);
    row.append(top, line);
    list.append(row);
  }
  root.append(list);
}

// 선수 상세: 소속이면 해지, 아니면 영입 제안
function renderPlayer(root, s) {
  const p = getPlayer(s);
  const client = state.clients.find(c => c.s === s);
  const wage = client ? client.wage : weeklyWage(p.ability);
  const head = el('div', 'detail-head');
  head.append(posTag(p.pos), el('h1', 'title', p.name), el('span', 'abil', String(p.ability)));
  root.append(actButton('back', 'up', undefined, '← 돌아가기'), head,
    el('p', 'sub', `${ageOf(p)}세 · ${p.nat.name} · ${p.club.name} · ${leagueName(p.club.country, p.club.t)}`), abilityBar(p.ability));
  const info = el('div', 'stats detail-stats');
  info.append(stat('잠재력', String(p.pot)), stat('폼', formNode(p)), stat('지난 시즌 평균 폼', (state.world.favg[s] / 2).toFixed(1)),
    stat('몸값', money(valueOf(p))), stat('주급', cash(wage)), stat('계약 만료', contractNode(client ? client.end : contractEnd(p, absWeek()))));
  root.append(info);
  const box = el('div', 'detail-actions');
  if (client) {
    box.append(el('p', 'sub', `소속 선수입니다. 내 수수료는 주 ${cash(commissionOf(wage))}(주급의 ${FEE_RATE * 100}%)입니다.`),
      actButton('btn danger', 'release', s, '계약 해지 (평판 -1)'));
  } else {
    const block = recruitBlock(p);
    const b = actButton('btn primary', 'recruit', s, '영입 제안 (1 AP)');
    b.disabled = Boolean(block);
    box.append(el('p', 'sub', `영입 비용 ${cash(recruitCost(p))} · 성공 확률 ${recruitChance(p)}% · 계약하면 수수료 주 ${cash(commissionOf(wage))}`), b);
    if (block) box.append(el('p', 'note', block));
  }
  root.append(box);
}

function renderLog(root) {
  root.append(el('h1', 'title', '기록'));
  if (state.summary) root.append(actButton('btn', 'summary', undefined, `${state.summary.season}시즌 결산 다시 보기`));
  const list = el('ol', 'log');
  state.logs.forEach(line => list.append(el('li', '', line)));
  root.append(list, el('h2', 'section', '저장'));
  root.append(el('p', 'sub', '진행 상황은 이 브라우저에 자동으로 저장됩니다. iPhone Safari는 7일 동안 이 사이트를 쓰지 않으면 저장을 지울 수 있으니, 홈 화면에 추가하거나 파일로 내보내 두세요.'));
  const actions = el('div', 'actions');
  actions.append(actButton('btn', 'export', undefined, '파일로 내보내기'), actButton('btn', 'import', undefined, '파일 불러오기'), actButton('btn danger', 'new', undefined, '새 게임'));
  root.append(actions);
}

function render() {
  renderHeader();
  const root = $('view');
  root.replaceChildren();
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === state.ui.tab ? 'page' : 'false'));
  if (state.ui.player !== null) renderPlayer(root, state.ui.player);
  else if (state.ui.tab === 'world') renderWorld(root);
  else if (state.ui.tab === 'log') renderLog(root);
  else renderClients(root);
}

// 시즌 결산 창
function openSummary() {
  const sm = state.summary;
  if (!sm) return;
  $('summary-title').textContent = `${sm.season}시즌 결산`;
  const list = el('ul', 'summary-list');
  for (const row of sm.rows) {
    const li = el('li');
    li.append(el('strong', '', row.name));
    if (row.retired) li.append(el('span', 'down', ` ${row.ageFrom}세에 은퇴`));
    else {
      const diff = row.valueTo - row.valueFrom;
      const ability = row.abilityFrom === undefined ? '' : ` · 능력 ${row.abilityFrom}→${row.abilityTo}`;
      li.append(` ${row.ageFrom}→${row.ageTo}세${ability} · 몸값 ${money(row.valueFrom)} → `, el('span', diff > 0 ? 'up' : diff < 0 ? 'down' : '', money(row.valueTo)));
    }
    list.append(li);
  }
  const rep = sm.repChange === undefined ? '' : `평판 ${sm.repChange >= 0 ? '+' : ''}${sm.repChange}. `;
  $('summary-body').replaceChildren(list, el('p', 'sub', `${rep}세계에서 ${sm.retired.toLocaleString('ko-KR')}명이 은퇴하거나 떠나고 새 선수가 들어왔습니다.`));
  const dialog = $('summary');
  if (!dialog.open) dialog.showModal();
}

// 파산 창
function openGameOver() {
  $('gameover-body').textContent = `자금 마이너스가 ${DEBT_LIMIT}주 이어져 ${state.season}시즌 ${state.week}주에 파산했습니다. 마지막 평판 ${state.rep}, 소속 선수 ${state.clients.length}명.`;
  const dialog = $('gameover');
  if (!dialog.open) dialog.showModal();
}

function startNewGame() {
  newGame();
  render();
  window.scrollTo(0, 0);
  toast('새 게임을 시작했습니다.');
}

function onAction(act, v) {
  const ui = state.ui;
  if (act === 'export') return exportSave();
  if (act === 'import') return $('import-file').click();
  if (act === 'summary') return openSummary();
  if (act === 'new') {
    if (confirm('진행 중인 게임을 지우고 새로 시작할까요? 되돌릴 수 없습니다.')) startNewGame();
    return;
  }
  let scroll = 0;
  if (act === 'player') {
    listScroll = window.scrollY;
    ui.player = v;
  } else if (act === 'recruit') {
    recruit(v);
    scroll = window.scrollY;
  } else if (act === 'release') {
    if (!release(v)) return;
    ui.player = null;
  } else if (act === 'country') Object.assign(ui, { country: v, tier: null, club: null });
  else if (act === 'tier') Object.assign(ui, { tier: v, club: null });
  else if (act === 'club') ui.club = v;
  else if (act === 'up') {
    if (ui.player !== null) {
      ui.player = null;
      scroll = listScroll;
    } else if (ui.club !== null) ui.club = null;
    else if (ui.tier !== null) ui.tier = null;
    else ui.country = null;
  }
  render();
  window.scrollTo(0, scroll);
}

function bindEvents() {
  $('btn-next').addEventListener('click', () => {
    advanceWeek();
    render();
    if (state.over) openGameOver();
    else if (state.summary && !state.summary.seen) openSummary();
  });
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    Object.assign(state.ui, { tab: b.dataset.tab, player: null });
    render();
    window.scrollTo(0, 0);
  }));
  $('view').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) onAction(b.dataset.act, b.dataset.v === undefined ? undefined : Number(b.dataset.v));
  });
  $('summary-close').addEventListener('click', () => $('summary').close());
  $('summary').addEventListener('close', () => {
    if (state.summary && !state.summary.seen) {
      state.summary.seen = true;
      saveState();
    }
  });
  $('gameover-new').addEventListener('click', () => {
    $('gameover').close();
    startNewGame();
  });
  $('gameover-close').addEventListener('click', () => $('gameover').close());
  $('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importSave(file);
    e.target.value = '';
  });
}

// ===== 9. 자가 검증 (콘솔) =====
function runSelfCheck() {
  const check = (ok, msg) => console.assert(ok, `[자가 검증] ${msg}`);
  check(marketValue(70, 26, 70, 5.5) > marketValue(60, 26, 60, 5.5), '능력이 높으면 몸값이 높아야 함');
  check(marketValue(60, 20, 80, 5.5) > marketValue(60, 26, 80, 5.5), '23세 이하는 몸값 가산');
  check(marketValue(60, 33, 60, 5.5) < marketValue(60, 29, 60, 5.5), '30세 이상은 몸값 감산');
  const mid = marketValue(65, 26, 65, 5.5);
  check(marketValue(65, 26, 65, 10) > mid && marketValue(65, 26, 65, 1) < mid && marketValue(65, 26, 65, 10) / mid < 1.12, '폼 반영은 10% 안쪽');
  const r = rng(1);
  let f = 5, inRange = true;
  for (let i = 0; i < 10000; i++) {
    f = nextForm(f, r());
    if (f < 1 || f > 10) inRange = false;
  }
  check(inRange, '폼은 1~10 안에 있어야 함');
  const sample = new Uint16Array([0, 35, 1295]);
  check(unpackArray(packArray(sample, 2, 0), 2, Uint16Array, 0).join() === '0,35,1295', '저장 압축 왕복');
  const a = getPlayer(1234), b = getPlayer(1234);
  check(a.name === b.name && a.ability === b.ability && a.pot >= a.ability && a.ability >= 40 && a.ability <= 90, '선수 생성은 결정적이고 범위를 지켜야 함');
  check(contractEnd(a, absWeek() + 500) >= absWeek() + 500, '월드 선수 계약은 자동 갱신');
  check(weeklyWage(70) > weeklyWage(60) && weeklyWage(40) >= 200 && commissionOf(10000) === 800, '주급과 수수료(8%) 계산');
  check(growthStep(19, 50, 80, 5.5, 0.5) > 0 && growthStep(19, 80, 80, 5.5, 1) === 0 && growthStep(33, 70, 70, 5.5, 0.5) < 0, '성장은 잠재력까지, 30대 중반은 하락');
  check(growthStep(19, 50, 80, 9, 0.5) >= growthStep(19, 50, 80, 2, 0.5), '폼이 좋으면 더 크게 성장');
  const grow = new Int8Array([-60, 0, 60]);
  check(unpackArray(packArray(grow, 2, 128), 2, Int8Array, 128).join() === '-60,0,60', '성장치 저장 왕복');
}

function boot() {
  const loaded = loadState();
  if (loaded !== 'ok') newGame();
  bindEvents();
  try {
    render();
  } catch (e) {
    console.error(e);
    newGame();
    render();
    toast('화면을 그리지 못해 새 게임으로 시작했습니다.');
  }
  if (loaded === 'broken') toast('저장 데이터를 읽지 못해 새 게임으로 시작했습니다.');
  if (state.over) openGameOver();
  else if (state.summary && !state.summary.seen) openSummary();
  runSelfCheck();
}

document.addEventListener('DOMContentLoaded', boot);
