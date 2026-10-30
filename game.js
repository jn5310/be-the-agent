'use strict';
// Be The Agent: 축구 선수 에이전트 텍스트 게임 (주간 진행, 가상 세계 리그·선수, 자동 저장)

// ===== 1. 상수와 세계 데이터 =====
const SAVE_KEY = 'be-the-agent:save';
const BACKUP_KEY = 'be-the-agent:save:backup'; // 읽지 못한 세이브를 지우지 않고 보관
const SAVE_VERSION = 8;
const WEEKS = 52;
const SQUAD = 24;
const WORLD_SEED = 20261030; // 구단 이름·전력은 모든 게임에서 같게 고정
const START_REP = 12;
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
  return { s, g, club: clubOf(s), nat, name: makeName(nat, r), pos: POS_BY_SLOT[s % SQUAD], ability: core.ability, pot: core.pot, birth: core.birth, start: (born - 1) * WEEKS + 1 };
}

// 주급: 능력에 따라 가파르게 오름 (능력 40 ≈ $210, 60 ≈ $5K, 80 ≈ $126K)
function weeklyWage(ability) {
  const v = 210 * Math.exp(0.16 * (ability - 40));
  const step = v < 1000 ? 10 : v < 10000 ? 50 : v < 100000 ? 500 : 5000;
  return Math.round(v / step) * step;
}
const commissionOf = wage => Math.round(wage * FEE_RATE);
// 운영비: 회사를 세우기 전(혼자)에는 전화·교통비 정도, 세운 뒤에는 사무실 운영비
const companyUpkeep = () => UPKEEP_BASE + UPKEEP_PER_CLIENT * state.clients.length;
const upkeepNow = () => (state.founded ? companyUpkeep() : TUNE.soloUpkeep[0] + TUNE.soloUpkeep[1] * state.clients.length);

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

// 피지컬 코치(소속 선수만): 성장은 +N%(소수점은 확률로, 잠재력까지), 하락은 확률로 1 줄임
function coachStep(step, room) {
  const lv = state.invest.coach;
  if (step > 0) {
    const add = step * TUNE.coachGrow[lv];
    return Math.min(room, step + Math.floor(add) + (Math.random() < add % 1 ? 1 : 0));
  }
  return step < 0 && Math.random() < TUNE.coachAge[lv] ? step + 1 : step;
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

// 새 게임은 회사 없이 혼자 시작 (founded = false). 돈은 모두 내 돈이고, 회사를 세우면 그 돈이 법인 자금이 됨
function newGame() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  state = {
    version: SAVE_VERSION, seed, season: 1, week: 1,
    agencyCash: TUNE.soloCash, rep: START_REP, ap: TUNE.soloAp, debtWeeks: 0, over: false, founded: false,
    personalCash: 0, invest: newInvest(), items: [], scouted: {}, watch: [], alumni: [], intros: {},
    clients: [], cooldowns: {}, logs: [], summary: null, moved: {}, events: [], nextEventId: 1,
    natCut: {}, stats: newCareerStats(),
    ui: { ...DEFAULT_UI },
    world: newWorld(seed)
  };
  state.natCut = computeNatCut();
  state.clients = pickStartingClients();
  const who = state.clients.map(c => `${getPlayer(c.s).name}(${c.how})`).join(', ');
  addLog(`에이전트 자격을 따고 혼자 일을 시작했습니다. ${who}의 대리인이 됐습니다. 회사는 아직 없습니다.`);
  saveState();
}

// 시작 선수와의 인연: 혼자 시작하는 에이전트가 처음 맡는 두 사람은 아는 사이
const START_TIES = ['고향 후배', '대학 은사의 제자', '동네 축구교실에서 가르친 아이', '친구의 동생', '단골 식당 사장님의 아들', '고등학교 축구부 후배'];

// 시작 선수 두 명: 한국 국적, 능력 45~66, 유망주 1·중견 1, 능력 62 이상과 GK는 1명까지
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
  // 주급 합계가 TUNE.soloWage 안인 조합을 고름 → 혼자 시작해도 주간 수지가 소폭 흑자
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
    for (const [lo, hi, n] of [[18, 21, 1], [22, 27, 1]]) {
      for (const p of pool) {
        if (chosen.filter(c => ageOf(c) >= lo && ageOf(c) <= hi).length === n) break;
        if (fits(p, lo, hi)) chosen.push(p);
      }
    }
    const total = chosen.reduce((n, p) => n + weeklyWage(p.ability), 0);
    if (chosen.length === 2 && total >= TUNE.soloWage[0] && total <= TUNE.soloWage[1]) break;
  }
  const ties = [...START_TIES];
  for (let i = ties.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ties[i], ties[j]] = [ties[j], ties[i]];
  }
  return chosen.map((p, i) => newClient(p, contractEnd(p, 1), TUNE.satStart, TUNE.bondStart, ties[i]));
}

// 소속 선수 기록: 슬롯·세대·계약 만료·주급·만족·마지막 면담·재협상 가능 주·만료 알림 보낸 계약
// st = 이번 구간 기록(시즌·구단별), hist = 지난 구간들, playRate = 최근 출전 비율, capped = 국가대표 경험
// bond = 유대(0~100), since = 함께하기 시작한 절대 주차, how = 인연(만난 계기), memo = 유대가 바뀐 최근 일 [{ w, t, n }]
const newClient = (p, end, sat, bond, how) => ({
  s: p.s, g: p.g, end, wage: weeklyWage(p.ability), sat, met: 0, negUntil: 0, warned: 0,
  st: newStint(p.club, worldStats(p, state.season, state.week)), hist: [], playRate: 0.6, capped: false,
  bond, since: absWeek(), how, memo: [], tales: []
});
// 에이전시 커리어 통계 (기록 탭·시뮬레이션용)
const newCareerStats = () => ({ lost: 0, transfers: 0, dream: 0, callups: 0, renewTry: 0, renewWin: 0, signed: 0 });

function addLog(text) {
  state.logs.unshift(`${state.season}시즌 ${state.week}주 · ${text}`);
  if (state.logs.length > 80) state.logs.length = 80;
}

// ===== 6. 주간 진행 =====
const cash = v => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const signedCash = v => (v >= 0 ? `+${cash(v)}` : cash(v));
const cooldownKey = p => `${p.s}-${p.g}`; // 슬롯-세대 키: 영입 대기·스카우트 기록·관심 목록에 같이 씀

function advanceWeek() {
  if (state.over) return;
  const w = state.world;
  for (let s = 0; s < SLOTS; s++) {
    const f = nextForm(w.form[s], Math.random());
    w.delta[s] = f - w.form[s];
    w.form[s] = f;
    w.fsum[s] += f;
  }

  // 주간 정산: 수수료 수입 - 운영비 - 투자 유지비
  const income = state.clients.reduce((n, c) => n + clientIncome(c), 0);
  const upkeep = upkeepNow();
  const fixed = investUpkeep();
  state.agencyCash += income - upkeep - fixed;

  state.week += 1;
  if (state.week > WEEKS) endSeason();
  state.ap = weeklyAp();
  const now = absWeek();
  for (const key of Object.keys(state.cooldowns)) if (state.cooldowns[key] <= now) delete state.cooldowns[key];
  for (const key of Object.keys(state.intros)) if (state.intros[key] <= now) delete state.intros[key];
  const week = weeklyClients();

  addLog(week.lines.length ? `경기: ${week.lines.join(', ')}` : '이번 주 소속 선수 경기 없음');
  addLog(`정산 ${signedCash(income - upkeep - fixed)} (수수료 ${cash(income)}, 운영비 ${cash(upkeep)}${fixed ? `, 투자 유지비 ${cash(fixed)}` : ''})`);
  checkDebt();
  saveState();
  return week.added;
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
    const L = c.st.L;
    return { name: p.name, age: ageOf(p), ability: p.ability, value: valueOf(p), apps: L[0], goals: L[1], rating: L[0] ? L[3] / L[0] / 10 : 0, caps: c.st.N[0], nat: p.nat.id };
  });
  for (const c of state.clients) archiveStint(c);
  for (let s = 0; s < SLOTS; s++) {
    w.favg[s] = Math.round((w.fsum[s] / WEEKS) * 2);
    w.fsum[s] = 0;
  }

  // 성장·하락: 이번 시즌 나이와 평균 폼 기준. 소속 선수는 피지컬 코치 효과를 더함
  // 같은 반복에서 국가대표 기준용 국적·능력도 모음 (선수 전체를 두 번 읽지 않게)
  const rg = rng(hash(state.seed, 6, state.season));
  const natIdx = new Uint8Array(SLOTS);
  const abil = new Uint8Array(SLOTS);
  const coached = new Set(state.invest.coach ? state.clients.map(c => c.s) : []);
  let coachGain = 0; // 코치 덕분에 더 오르거나 덜 내려간 능력 합계 (결산 창에 표시)
  for (let s = 0; s < SLOTS; s++) {
    const r = rng(hash(state.seed, s, w.gen[s]));
    const c = coreStats(s, r);
    let step = growthStep(state.season - c.birth, c.ability, c.pot, w.favg[s] / 2, rg());
    if (coached.has(s)) {
      const plain = step;
      step = coachStep(step, c.pot - c.ability);
      coachGain += step - plain;
    }
    w.grow[s] = clamp(w.grow[s] + step, 40 - c.base, 90 - c.base);
    abil[s] = clamp(c.base + w.grow[s], 40, 90);
    natIdx[s] = nationalityFor(c.club, r).i;
  }

  state.week = 1;
  state.season += 1;

  // 소속 선수는 33세 미만이면 이탈하지 않음 (은퇴만 함)
  const r = rng(hash(state.seed, 5, state.season));
  const clientSlots = new Set(state.clients.map(c => c.s));
  let retired = 0;
  const gone = new Uint8Array(SLOTS);
  for (let s = 0; s < SLOTS; s++) {
    const age = slotAge(s);
    if (clientSlots.has(s) && age < 33) continue;
    if (r() < leaveChance(age)) {
      gone[s] = 1;
      w.gen[s] += 1;
      w.gseason[s] = state.season;
      w.form[s] = randInt(4, 7, r);
      w.delta[s] = 0;
      w.favg[s] = 11;
      w.grow[s] = 0;
      delete state.moved[s];
      retired += 1;
    }
  }
  dropRetiredKeys();

  const rows = [];
  let valueFrom = 0;
  let valueTo = 0;
  state.clients = state.clients.filter((c, i) => {
    if (w.gen[c.s] !== c.g) {
      // 은퇴식: 오래 함께했거나 유대가 깊으면 고마움을 전하고(평판), 아주 깊으면 은퇴 후 그 나라 스카우트로 합류
      const seasons = Math.floor((absWeek() - c.since) / WEEKS); // 시즌이 막 넘어간 때라 지금 주 - 시작 주 = 함께한 주
      const farewell = c.bond >= TUNE.farewellBond || seasons >= 2;
      const scout = farewell && c.bond >= TUNE.alumniBond && state.alumni.length < TUNE.alumniMax;
      const rep = farewell ? gainRep(1) : 0;
      if (scout) state.alumni.push({ name: before[i].name, nat: before[i].nat, season: state.season - 1 });
      rows.push({ name: before[i].name, ageFrom: before[i].age, retired: true, farewell, scout, seasons, bond: c.bond, rep, nat: before[i].nat });
      return false;
    }
    const p = getPlayer(c.s);
    const value = valueOf(p);
    const b = before[i];
    rows.push({ name: p.name, ageFrom: b.age, ageTo: ageOf(p), abilityFrom: b.ability, abilityTo: p.ability, valueFrom: b.value, valueTo: value, apps: b.apps, goals: b.goals, rating: b.rating, caps: b.caps });
    c.st = newStint(p.club);
    valueFrom += before[i].value;
    valueTo += value;
    return true;
  });

  state.natCut = natCutFrom(natIdx, abil, gone); // 새로 들어온 17~23세는 대표팀 기준에서 뺌
  // 평판: 소속 선수 몸값 합계 변화율 × 10 (±3까지)
  const repChange = valueFrom > 0 ? clamp(Math.round(((valueTo - valueFrom) / valueFrom) * 10), -3, 3) : 0;
  if (repChange > 0) gainRep(repChange);
  else state.rep = Math.max(0, state.rep + repChange);
  state.summary = { season: state.season - 1, rows, retired, repChange, coachGain, seen: false };
  addLog(`${state.season - 1}시즌 종료. 평판 ${repChange >= 0 ? '+' : ''}${repChange}. 세계에서 ${retired.toLocaleString('ko-KR')}명이 은퇴하거나 떠나고 새 선수가 들어왔습니다.`);
}

// ===== 영입·해지 =====
const recruitCost = p => Math.round((500 + weeklyWage(p.ability)) / 100) * 100;

// 성공 확률: 평판이 선수 수준((능력-40)×2)보다 높을수록 오름, 21세 이하 +10, 스카우트망 보너스, 내 선수가 소개한 후배 +, 5~90%
const recruitChance = p => clamp(Math.round(60 + state.rep - (p.ability - 40) * 2 + (ageOf(p) <= 21 ? 10 : 0) + TUNE.scoutRecruit[state.invest.scout] + (introActive(p) ? TUNE.introBonus : 0)), 5, 90);

// 영입을 막는 이유 (없으면 빈 문자열)
function recruitBlock(p) {
  if (state.over) return '파산한 게임입니다';
  if (state.clients.some(c => c.s === p.s)) return '이미 소속 선수입니다';
  if (state.clients.length >= clientLimit()) {
    if (!state.founded) return `혼자서는 ${TUNE.soloLimit}명까지 맡을 수 있습니다. 에이전시 탭에서 회사를 세우면 ${TUNE.limitBase}명이 됩니다`;
    return `소속 선수가 한도(${clientLimit()}명)에 찼습니다. 평판 ${TUNE.limitStep}마다 1명씩 늘어납니다 (최대 ${TUNE.limitMax}명)${state.invest.office ? '' : '. 에이전시 탭의 사무실 확장으로 1명 더 맡을 수 있습니다'}`;
  }
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
    const [lo, hi] = potRange(p); // 계약하면 잠재력을 정확히 알게 됨
    // 혼자 일할 때 직접 데려온 선수는 처음부터 더 가까움
    const how = !state.founded ? '혼자 일할 때 직접 찾아가 데려옴' : state.scouted[cooldownKey(p)] ? '스카우트 보고서를 보고 영입' : '연락해서 영입';
    state.clients.push(newClient(p, contractEnd(p, absWeek()), 75, state.founded ? TUNE.bondNew : TUNE.bondSolo, how));
    state.watch = state.watch.filter(k => k !== cooldownKey(p));
    state.stats.signed += 1;
    const got = gainRep(gain);
    const reveal = lo === hi ? '' : ` 잠재력은 ${p.pot}였습니다 (보이던 범위 ${lo}~${hi}).`;
    addLog(`${p.name} 영입 성공 (비용 ${cash(cost)}, 평판 +${got}).${reveal}`);
    toast(lo === hi ? `${p.name} 선수와 계약했습니다.` : `${p.name} 선수와 계약했습니다. 잠재력은 ${p.pot}입니다.`);
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
  state.events = state.events.filter(e => e.s !== s || e.type === 'tip');
  state.rep = Math.max(0, state.rep - 1);
  addLog(`${p.name} 선수와 계약을 해지했습니다 (평판 -1).`);
  saveState();
  return true;
}

// ===== 6-2. 만족도·협상·소식·경기 기록 (3~4단계) =====
// 밸런스 숫자는 모두 여기서 조정합니다. tools/sim.js가 이 값을 바꿔 가며 수천 판을 돌려 봅니다.
const TUNE = {
  ap: 2,                                      // 주당 행동력
  natSquad: 30,                               // 국가대표 후보 인원 (국적별 상위 30명)
  repGain: 1, repSoftCap: 120,                // 평판 오름폭 = 기본 × (1 - 평판/120)
  limitBase: 6, limitStep: 40, limitMax: 7,   // 소속 한도: 6명에서 시작, 평판 40이 되면 7명 (8명이면 84%의 주가 바빠서 줄임)
  satStart: 70, satWarn: 35, satLeave: 20, satDecay: 1, mainMiss: 1, happyBonus: 1, keepChance: 0.75,
  meetGain: 12, meetGap: 4,
  renewWindow: 26, renewRetry: 2, renewBase: [80, 55, 30],
  transferCut: 0.02, dealShare: 0.25,
  eventTtl: 2, eventMax: 3,
  // offerFirst: 첫 시즌 후반 첫 이적 보너스. 7단계부터 혼자 시작해 선수가 2~3명뿐이라 0.06 → 0.12
  offerBase: 0.018, offerStar: 0.025, offerForm: 0.015, offerFree: 0.1, offerYouth: 0.02, offerFirst: 0.12, dreamChance: 0.02, dreamReach: 4, offerRespect: 0.5,
  consentBase: 50, consentStep: 12,
  // poachStar: 몸값 $300만 이상 스타를 노리는 다른 에이전시. 7단계에서 유대가 시험받는 순간을 늘리려고 0.002 → 0.004
  playtimeChance: 0.09, raiseChance: 0.08, poachBase: 0.0015, poachStar: 0.004, poachLow: 0.04, sponsorChance: 0.05, snsChance: 0.008,
  injuryChance: 0.008, interviewChance: 0.015, familyChance: 0.008, tipChance: 0.06,
  // 5단계 법인 투자: 단계별 [도입비, 주간 유지비]와 단계별 효과 (효과 배열의 0번 = 투자 안 함)
  lawyerLv: [[20000, 200], [150000, 800], [800000, 3500]], lawyerWage: [0, 0.05, 0.1, 0.15], lawyerCounter: [0, 5, 10, 15],
  scoutLv: [[20000, 200], [120000, 700], [700000, 3000]], scoutRecruit: [0, 4, 7, 10], scoutTips: [1, 3, 5, 7],
  coachLv: [[25000, 250], [180000, 900], [900000, 3500]], coachGrow: [0, 0.2, 0.35, 0.5], coachAge: [0, 0.25, 0.5, 0.75], coachInjury: [0, 0.25, 0.5, 0.75],
  officeLv: [[400000, 1800]], officeLimit: [0, 1],
  // 개인 아이템 가격·평판 (ITEMS 순서), 배당 세금, 배당할 때 법인에 남기는 운영 자금(주)
  itemPrice: [5000, 25000, 100000, 400000, 1500000, 6000000], itemRep: [1, 1, 2, 2, 3, 4],
  tax: 0.15, reserveWeeks: 4,
  // 6단계 유망주 찾기: 스카우트 횟수별 잠재력 범위 폭(마지막 0 = 정확히 앎), 스카우트망 단계별로 이미 스카우트한 것처럼 치는 횟수,
  // 범위로 보이는 나이(이보다 많으면 다 자라서 정확히 보임), 관심 목록 인원, 찾기 결과 수, 찾기에 넣는 최소 영입 확률
  potWidth: [16, 8, 4, 0], scoutKnow: [0, 1, 1, 2], potAgeMax: 23, scoutMax: 300, watchMax: 20, findMax: 20, findChance: 20,
  // 7단계 개인 에이전트로 시작: 시작 자금, 시작 두 선수 주급 합 범위, 혼자일 때 한도·운영비 [기본, 선수당], 회사 설립 조건(평판·자금)과 설립비
  soloCash: 10000, soloWage: [4500, 7500], soloLimit: 3, soloAp: 1, soloUpkeep: [250, 25], foundRep: 16, foundCash: 35000, foundCost: 15000,
  // 선수와의 유대(0~100): 시작 값(시작 선수, 혼자일 때 영입, 회사 세운 뒤 영입), 함께 지낸 몇 주마다 +1, 회사 세울 때 +, 면담 +
  // 효과는 유대 bondFrom을 넘는 만큼: 붙잡을 확률 + (유대 - bondFrom) × bondKeep, 이적 동의 + (유대 - bondFrom) × bondConsent(%p)
  // 유대 bondCalm 이상이면 만족이 격주로만 떨어짐
  bondStart: 60, bondSolo: 35, bondNew: 20, bondTime: 13, bondFound: 5, bondMeet: 1, bondFrom: 40, bondKeep: 0.002, bondConsent: 0.15, bondCalm: 70,
  // 8단계 관계 이야기: 조건(TALES)을 채운 선수에게 매주 taleChance 확률로 찾아옴(선수마다 이야기마다 한 번)
  // 후배 소개: 영입 확률 +introBonus%p가 introWeeks주 동안. 은퇴식: 유대 farewellBond 이상이거나 2시즌 이상 함께했으면 평판 +1,
  // 유대 alumniBond 이상이면 은퇴 후 그 나라 스카우트로 합류(그 나라 유망주 스카우트 +1번, 최대 alumniMax명)
  taleChance: 0.05, introBonus: 15, introWeeks: 26, farewellBond: 60, alumniBond: 70, alumniMax: 5
};
// 평판 오르는 양은 평판이 높을수록 줄어듦 (30시즌 커리어 동안 천천히 오르게). 소수점은 확률로 반올림
function gainRep(n) {
  const add = n * TUNE.repGain * Math.max(0.1, 1 - state.rep / TUNE.repSoftCap);
  const before = state.rep;
  state.rep = Math.min(100, state.rep + Math.floor(add) + (Math.random() < add % 1 ? 1 : 0));
  return state.rep - before;
}
// 주당 행동력: 혼자일 때는 손이 모자라 TUNE.soloAp, 회사를 세우면 TUNE.ap
const weeklyAp = () => (state.founded ? TUNE.ap : TUNE.soloAp);
const clientLimit = () => (state.founded ? Math.min(TUNE.limitMax, TUNE.limitBase + Math.floor(state.rep / TUNE.limitStep)) + TUNE.officeLimit[state.invest.office] : TUNE.soloLimit);
const maxClients = () => TUNE.limitMax + Math.max(...TUNE.officeLimit); // 세이브 검사용 최대 인원

// 지금 소속 구단: 이적한 선수는 moved[슬롯] = 구단 번호 (능력·이름은 처음 구단 기준 그대로)
const clubOf = s => CLUBS[state.moved[s] ?? Math.floor(s / SQUAD)];
const clubLevel = club => tierLevel(club.country, club.t) + club.off;

// 구단 명단: 원래 슬롯에서 떠난 선수는 빼고 이적해 온 선수는 더함
function clubSlots(club) {
  const list = [];
  for (let k = 0; k < SQUAD; k++) {
    const s = club.id * SQUAD + k;
    if (state.moved[s] === undefined) list.push(s);
  }
  for (const [s, id] of Object.entries(state.moved)) if (id === club.id) list.push(Number(s));
  return list;
}

// --- 대회 일정: 리그 1~46주, 47~52주 휴식기. 컵 6라운드, 대륙 대회 조별 6경기 + 8강·4강·결승, A매치 4번 ---
const LEAGUE_WEEKS = 46;
const NT_WEEKS = [10, 20, 32, 42];
const CUP_WEEKS = [6, 14, 22, 30, 38, 44];
const CONT_WEEKS = [4, 8, 12, 16, 24, 28, 36, 40, 45];
const CONT_NAME = { '5대 리그': '유럽 클럽 챔피언십', 유럽: '유럽 클럽 챔피언십', 남미: '남미 클럽 컵', 북중미: '북중미 클럽 컵', '아시아·오세아니아': '아시아 클럽 챔피언십', 아프리카: '아프리카 클럽 챔피언십' };
const COMPS = ['L', 'C', 'K', 'N']; // 리그, 국내 컵, 대륙 대회, 국가대표

const contSlots = country => (country.i < BIG5 ? 4 : country.level >= 66 ? 3 : country.level >= 60 ? 2 : 1);
const inContinental = club => club.t === 0 && club.rank < contSlots(club.country);
const bigStage = club => club.t === 0 && (club.country.i < BIG5 || inContinental(club));
const compName = (key, club, nat) => (key === 'L' ? leagueName(club.country, club.t) : key === 'C' ? `${club.country.name} 컵` : key === 'K' ? CONT_NAME[club.country.region] : `${nat.name} 국가대표`);

function leagueGames(club, week) {
  if (week > LEAGUE_WEEKS) return 0;
  const total = 2 * (club.country.tiers[club.t] - 1);
  return Math.floor((week * total) / LEAGUE_WEEKS) - Math.floor(((week - 1) * total) / LEAGUE_WEEKS);
}

// 컵·대륙 대회 성적은 구단·시즌마다 정해짐: 몇 경기까지 갔는지, 우승했는지
const runCache = new Map();
function compRun(club, season, key) {
  const id = `${state.seed}:${club.id}:${season}:${key}`;
  if (runCache.has(id)) return runCache.get(id);
  let out = { games: 0, won: false };
  if (key === 'C') {
    const r = rng(hash(state.seed, club.id, season, 31));
    const p = clamp(0.55 + (clubLevel(club) - tierLevel(club.country, 0)) * 0.03, 0.12, 0.85);
    out = { games: CUP_WEEKS.length, won: true };
    for (let g = 1; g <= CUP_WEEKS.length; g++) if (r() > p) { out = { games: g, won: false }; break; }
  } else if (inContinental(club)) {
    const r = rng(hash(state.seed, club.id, season, 37));
    const p = clamp(0.3 + (clubLevel(club) - 72) * 0.03, 0.05, 0.8);
    out = { games: 6, won: false };
    if (r() < p + 0.15) {
      out = { games: CONT_WEEKS.length, won: true };
      for (let g = 7; g <= CONT_WEEKS.length; g++) if (r() > p) { out = { games: g, won: false }; break; }
    }
  }
  if (runCache.size > 20000) runCache.clear();
  runCache.set(id, out);
  return out;
}

function weekGames(club, season, week) {
  const ci = CUP_WEEKS.indexOf(week);
  const ki = CONT_WEEKS.indexOf(week);
  return {
    L: leagueGames(club, week),
    C: ci >= 0 && ci < compRun(club, season, 'C').games ? 1 : 0,
    K: ki >= 0 && ki < compRun(club, season, 'K').games ? 1 : 0
  };
}

// --- 경기: 능력이 구단 수준보다 높을수록, 폼이 좋을수록 자주 뛰고 잘함 ---
const POS_GOAL = { FW: 0.42, MF: 0.13, DF: 0.04, GK: 0 };
const POS_ASSIST = { FW: 0.17, MF: 0.21, DF: 0.07, GK: 0.01 };
const startChance = (ability, level, form) => clamp(0.6 + (ability - level) * 0.05 + (form - 5.5) * 0.03, 0.08, 0.97);

// 한 경기 결과 (못 뛰면 null). hard = 대륙 대회·A매치
function playMatch(p, level, form, r, hard) {
  const d = p.ability - level;
  if (r() > startChance(p.ability, level, form)) return null;
  const rating = clamp(6.4 + d * 0.05 + (form - 5.5) * 0.12 - (hard ? 0.3 : 0) + (r() - 0.5) * 1.6, 4.5, 9.8);
  const atk = POS_GOAL[p.pos] * clamp(1 + d * 0.04, 0.4, 1.8) * (0.8 + form * 0.04) * (hard ? 0.7 : 1);
  const goals = (r() < atk ? 1 : 0) + (r() < atk * atk * 0.4 ? 1 : 0);
  return { rating, goals, assists: r() < POS_ASSIST[p.pos] * clamp(1 + d * 0.03, 0.5, 1.6) ? 1 : 0 };
}

// 기록 한 줄: [출전, 골, 도움, 평점 합 × 10]
const emptyStats = () => ({ L: [0, 0, 0, 0], C: [0, 0, 0, 0], K: [0, 0, 0, 0], N: [0, 0, 0, 0] });
function addMatch(row, m) {
  if (!m) return;
  row[0] += 1;
  row[1] += m.goals;
  row[2] += m.assists;
  row[3] += Math.round(m.rating * 10);
}

// 국가대표 기준: 국적별로 30번째(TUNE.natSquad)로 잘하는 선수의 능력. natIdx·abil = 슬롯별 국적 번호·능력, skip = 빼고 셀 슬롯
function natCutFrom(natIdx, abil, skip) {
  const lists = COUNTRIES.map(() => []);
  for (let s = 0; s < SLOTS; s++) if (!skip || !skip[s]) lists[natIdx[s]].push(abil[s]);
  const cut = {};
  lists.forEach((arr, i) => {
    if (!arr.length) return;
    arr.sort((a, b) => b - a);
    cut[COUNTRIES[i].id] = arr[Math.min(TUNE.natSquad - 1, arr.length - 1)];
  });
  return cut;
}

function computeNatCut() {
  const natIdx = new Uint8Array(SLOTS);
  const abil = new Uint8Array(SLOTS);
  for (let s = 0; s < SLOTS; s++) {
    const r = rng(hash(state.seed, s, state.world.gen[s]));
    const core = coreStats(s, r);
    abil[s] = core.ability;
    natIdx[s] = nationalityFor(core.club, r).i;
  }
  return natCutFrom(natIdx, abil, null);
}
const natCutOf = p => state.natCut[p.nat.id] ?? 99;
const isNationalPick = p => p.ability >= natCutOf(p);

// 소속이 아닌 선수의 시즌 기록: 매번 같은 값이 나오게 시드로 계산 (폼은 평균 5.5로 봄)
function worldStats(p, season, upto) {
  const st = emptyStats();
  const r = rng(hash(state.seed, p.s, p.g, season, 41));
  const level = clubLevel(p.club);
  const nt = isNationalPick(p);
  for (let w = 1; w < upto; w++) {
    const g = weekGames(p.club, season, w);
    for (let i = 0; i < g.L; i++) addMatch(st.L, playMatch(p, level, 5.5, r, false));
    if (g.C) addMatch(st.C, playMatch(p, level, 5.5, r, false));
    if (g.K) addMatch(st.K, playMatch(p, level, 5.5, r, true));
    if (nt && NT_WEEKS.includes(w)) for (let i = 0; i < 2; i++) addMatch(st.N, playMatch(p, natCutOf(p) + 2, 5.5, r, true));
  }
  return st;
}

// 소속 선수 기록 구간: 시즌·구단이 바뀌면 hist로 옮기고 새로 시작
const newStint = (club, stats) => ({ season: state.season, club: club.id, ...(stats || emptyStats()) });
function archiveStint(c) {
  if (COMPS.some(k => c.st[k][0] > 0) || c.st.season === state.season) c.hist.unshift(c.st);
  if (c.hist.length > 20) c.hist.length = 20;
}

// --- 선수 성향과 원하는 조건 (시드로 정해짐) ---
const PRIORITY = { money: '돈', play: '출전 시간', stage: '큰 무대', home: '고향', stable: '안정' };
const PRIORITY_WEIGHTS = [['money', 3], ['play', 3], ['stage', 2], ['home', 1.5], ['stable', 1.5]];
const ABROAD = { no: '해외 이적 싫어함', any: '국내·해외 상관없음', yes: '해외 진출 원함' };
const prefCache = new Map();

function prefsOf(p) {
  const id = `${state.seed}:${p.s}:${p.g}`;
  if (prefCache.has(id)) return prefCache.get(id);
  const r = rng(hash(state.seed, p.s, p.g, 77));
  let x = r() * 11;
  let main = 'stable';
  for (const [key, weight] of PRIORITY_WEIGHTS) if ((x -= weight) < 0) { main = key; break; }
  const abroad = main === 'home' ? 'no' : main === 'stage' ? 'yes' : ['no', 'any', 'any', 'yes'][Math.floor(r() * 4)];
  const young = ageOf(p) <= 23 && p.pot - p.ability >= 8;
  const years = main === 'stable' ? 4 : young ? 2 : r() < 0.5 ? 2 : 4;
  const home = p.nat;
  let pool = main === 'home'
    ? home.clubs.flat().slice(0, 12)
    : CLUBS.filter(c => clubLevel(c) >= p.pot - 6 && clubLevel(c) <= p.pot + 8 && (abroad === 'no' ? c.country === home : abroad === 'yes' ? c.country !== home : true));
  if (!pool.length) pool = home.clubs[0];
  const pref = { main, abroad, years, wageMul: main === 'money' ? 1.25 : main === 'stable' ? 0.95 : 1.1, dream: pool[Math.floor(r() * pool.length)].id };
  if (prefCache.size > 5000) prefCache.clear();
  prefCache.set(id, pref);
  return pref;
}

// 구단이 보는 실력: 23세 이하는 잠재력의 40%를 미리 쳐줌 (유망주 계약이 커지는 이유)
const marketAbility = p => (ageOf(p) <= 23 ? Math.round(p.ability + (p.pot - p.ability) * 0.4) : p.ability);
const wantWage = (p, pref) => Math.round((weeklyWage(marketAbility(p)) * pref.wageMul) / 50) * 50;

// 선수 입장에서 조건 점검: [{ key, ok, text }]. 주된 성향은 2배, 꿈의 구단은 +3
function fitChecks(p, pref, club, wage, years) {
  const want = wantWage(p, pref);
  const sc = startChance(p.ability, clubLevel(club), 5.5);
  const domestic = club.country === p.nat;
  const checks = [
    { key: 'money', ok: wage >= want, text: `주급 ${cash(wage)} (원하는 금액 ${cash(want)})` },
    { key: 'play', ok: sc >= 0.6, text: sc >= 0.6 ? `주전 가능성 높음 (출전 ${Math.round(sc * 100)}%)` : `벤치 위험 (출전 ${Math.round(sc * 100)}%)` },
    { key: 'stage', ok: bigStage(club), text: bigStage(club) ? '큰 무대 (상위 1부·대륙 대회)' : '큰 무대 아님' }
  ];
  if (pref.abroad !== 'any') checks.push({ key: 'home', ok: pref.abroad === 'no' ? domestic : !domestic, text: domestic ? `${p.nat.name} 구단` : `해외 구단 (${club.country.name})` });
  if (years) checks.push({ key: 'stable', ok: Math.abs(years - pref.years) <= 1, text: `계약 ${years}시즌 (원하는 기간 ${pref.years}시즌)` });
  if (club.id === pref.dream) checks.push({ key: 'dream', ok: true, text: '꿈의 구단' });
  return checks;
}
const fitScore = (checks, pref) => checks.reduce((n, ch) => n + (ch.key === 'dream' ? 3 : (ch.ok ? 1 : -1) * (ch.key === pref.main ? 2 : 1)), 0);
const consentChance = score => clamp(Math.round(TUNE.consentBase + score * TUNE.consentStep), 5, 95);
const moodText = score => (score >= 3 ? '아주 좋아함' : score >= 1 ? '좋아함' : score >= 0 ? '보통' : score >= -2 ? '싫어함' : '아주 싫어함');

const clientOf = s => state.clients.find(c => c.s === s);
const isFreeAgent = c => c.end < absWeek();
const clientIncome = c => (isFreeAgent(c) ? 0 : commissionOf(c.wage));
const dealFee = wage => Math.round(wage * WEEKS * FEE_RATE * TUNE.dealShare);
const addSat = (c, n) => (c.sat = clamp(c.sat + n, 0, 100));

// --- 선수와의 유대 (7단계): 만족은 매주 오르내리는 기분, 유대는 함께 쌓는 관계 ---
// 유대가 바뀐 일은 최근 3개까지 기억해서 선수 상세에 보여 줌
function addBond(c, n, memo) {
  const before = c.bond;
  c.bond = clamp(c.bond + n, 0, 100);
  if (memo && c.bond !== before) {
    c.memo.unshift({ w: absWeek(), t: memo, n: c.bond - before });
    if (c.memo.length > 3) c.memo.length = 3;
  }
}
const BOND_TIERS = [[85, '가족 같음'], [60, '끈끈함'], [30, '믿음'], [0, '서먹함']];
const bondName = n => BOND_TIERS.find(([lo]) => n >= lo)[1];
// 유대 효과는 유대가 TUNE.bondFrom을 넘는 만큼만 (갓 만난 선수는 효과 없음)
const bondKeepBonus = c => Math.max(0, c.bond - TUNE.bondFrom) * TUNE.bondKeep;
const bondConsentBonus = c => Math.round(Math.max(0, c.bond - TUNE.bondFrom) * TUNE.bondConsent);
// "함께한 지 1시즌 12주"
function togetherText(c) {
  const weeks = Math.max(0, absWeek() - c.since);
  const seasons = Math.floor(weeks / WEEKS);
  return `함께한 지 ${seasons ? `${seasons}시즌 ` : ''}${weeks % WEEKS}주`;
}

// --- 관계 이야기 (8단계): 유대가 깊어진 선수에게 한 번씩 찾아오는 이야기. c.tales = [{ k, w: 시작 주, t: 고른 답 }] ---
const TALE_KEYS = ['call', 'wedding', 'junior', 'praise']; // 필요한 유대가 낮은 순
const FAMILY = ['누나', '형', '사촌 누나', '여동생'];
const taleSeen = (c, key) => c.tales.some(t => t.k === key);
// 조건: 아직 안 본 이야기, 유대가 need 이상, 함께한 지 weeks주 이상 (이야기는 시간과 함께 찾아옴)
const taleOpen = (c, key) => c.bond >= EVENT_TYPES[key].tale.need && absWeek() - c.since >= EVENT_TYPES[key].tale.weeks;
const taleReady = (c, key) => !taleSeen(c, key) && taleOpen(c, key);
const startTale = (c, key) => c.tales.push({ k: key, w: absWeek(), t: '' });
// 다음 이야기 안내: 조건을 채운 이야기가 있으면 곧 찾아온다고, 아니면 필요한 유대
function nextTaleText(c) {
  const left = TALE_KEYS.filter(k => !taleSeen(c, k));
  if (!left.length) return '이 선수와의 이야기를 모두 함께했습니다.';
  if (left.some(k => taleOpen(c, k))) return '유대가 충분히 깊어져 새 이야기가 찾아올 수 있습니다.';
  const next = EVENT_TYPES[left[0]].tale;
  const time = next.weeks >= WEEKS ? `${next.weeks / WEEKS}시즌` : `${next.weeks}주`;
  return `다음 이야기는 유대 ${next.need} 이상, 함께한 지 ${time}부터 열립니다 (지금 유대 ${c.bond}, ${togetherText(c)}).`;
}

// 후배 소개: 같은 나라 구단에서 20세 이하·잠재력 여유 10 이상·영입 확률 20% 이상, 아직 내 선수가 아닌 선수 중 잠재력이 가장 높은 선수
function findJunior(p) {
  let best = null;
  for (const club of p.nat.clubs.flat()) {
    for (const s of clubSlots(club)) {
      const j = getPlayer(s);
      if (j.nat !== p.nat || ageOf(j) > 20 || j.pot - j.ability < 10 || clientOf(s) || recruitChance(j) < 20) continue;
      if (!best || j.pot > best.pot) best = j;
    }
  }
  return best ? best.s : null;
}

// 은퇴 후 스카우트로 합류한 옛 선수: 그 나라 유망주는 스카우트를 한 번 더 보낸 것처럼 보임
const alumniKnow = p => (state.alumni.some(a => a.nat === p.nat.id) ? 1 : 0);
const introActive = p => (state.intros[cooldownKey(p)] || 0) > absWeek();

function removeClient(c, reason, repLoss) {
  state.clients = state.clients.filter(x => x !== c);
  state.events = state.events.filter(e => e.s !== c.s || e.type === 'tip');
  state.rep = Math.max(0, state.rep - repLoss);
  addLog(`${getPlayer(c.s).name} 선수가 ${reason} (평판 -${repLoss}).`);
  state.stats.lost += 1;
}

// 면담: 1 AP, 만족 +12, 같은 선수는 4주에 한 번
function meetBlock(c) {
  if (state.ap < 1) return '이번 주 행동력(AP)을 다 썼습니다';
  const since = absWeek() - c.met;
  if (c.met && since < TUNE.meetGap) return `${TUNE.meetGap - since}주 뒤에 다시 면담할 수 있습니다`;
  return '';
}

function meet(s) {
  const c = clientOf(s);
  const block = c ? meetBlock(c) : '소속 선수가 아닙니다';
  if (block) return toast(block);
  state.ap -= 1;
  c.met = absWeek();
  addSat(c, TUNE.meetGain);
  addBond(c, TUNE.bondMeet, '따로 만나 이야기함');
  addLog(`${getPlayer(s).name} 선수와 면담했습니다 (만족 +${TUNE.meetGain} → ${c.sat}, 유대 +${TUNE.bondMeet}).`);
  saveState();
}

// --- 재계약: 주급 3단계 × 기간(2·4시즌). 구단은 어린 선수에게 긴 계약, 30세 이상에게 짧은 계약을 선호 ---
const RENEW_LEVELS = [['적정 주급', 1], ['+25% 요구', 1.25], ['+50% 요구', 1.5]];
const RENEW_YEARS = [2, 4];

function renewTerms(c, p, level, years = 2) {
  const [label, mul] = RENEW_LEVELS[level];
  // 변호사가 있으면 같은 수락 확률로 주급을 더 받아냄
  const wage = Math.round((weeklyWage(marketAbility(p)) * mul * (1 + TUNE.lawyerWage[state.invest.lawyer])) / 50) * 50;
  const age = ageOf(p);
  const clubLikes = age <= 23 ? (years === 4 ? 10 : 0) : age >= 30 ? (years === 2 ? 10 : -10) : 0;
  const chance = clamp(Math.round(TUNE.renewBase[level] + Math.min(15, state.rep / 4) + (p.ability - clubLevel(p.club)) * 2 - (isFreeAgent(c) ? 10 : 0) + clubLikes), 10, 95);
  const pref = prefsOf(p);
  const checks = fitChecks(p, pref, p.club, wage, years);
  const score = fitScore(checks, pref);
  return { label, wage, years, chance, fee: dealFee(wage), checks, score, satGain: clamp(4 + score * 2, -10, 15) };
}

function renewBlock(c) {
  const left = c.end - absWeek();
  if (left > TUNE.renewWindow) return `계약 만료 ${TUNE.renewWindow}주 전부터 협상할 수 있습니다 (남은 ${left}주)`;
  if (state.ap < 1) return '이번 주 행동력(AP)을 다 썼습니다';
  if (c.negUntil > absWeek()) return `구단이 ${c.negUntil - absWeek()}주 뒤에 다시 만나자고 합니다`;
  return '';
}

function renew(s, level, years = 2) {
  const c = clientOf(s);
  const block = c ? renewBlock(c) : '소속 선수가 아닙니다';
  if (block) return toast(block);
  const p = getPlayer(s);
  const t = renewTerms(c, p, level, years);
  state.ap -= 1;
  state.stats.renewTry += 1;
  if (Math.random() * 100 < t.chance) {
    c.wage = t.wage;
    c.end = absWeek() + WEEKS * years;
    addSat(c, t.satGain);
    addBond(c, 3, '재계약을 성사시킴');
    state.agencyCash += t.fee;
    gainRep(1);
    state.stats.renewWin += 1;
    addLog(`${p.name} 재계약 성공: 주급 ${cash(t.wage)}, ${years}시즌, 수수료 +${cash(t.fee)}, 선수 반응 ${moodText(t.score)} (만족 ${t.satGain >= 0 ? '+' : ''}${t.satGain})`);
    toast(`재계약 성공! 수수료 +${cash(t.fee)}`);
  } else {
    c.negUntil = absWeek() + TUNE.renewRetry;
    addSat(c, -8);
    addBond(c, -2, '재계약 협상이 결렬됨');
    addLog(`${p.name} 재계약 협상 결렬 (만족 -8). ${TUNE.renewRetry}주 뒤 다시 협상할 수 있습니다.`);
    toast('구단이 조건을 거절했습니다.');
  }
  saveState();
}

// --- 이적 제안: 지금 구단 이상, 선수 능력 근처 수준 구단에서 옴. 가끔 꿈의 구단 ---
function makeOffer(c, p) {
  const r = Math.random;
  const pref = prefsOf(p);
  const dream = CLUBS[pref.dream];
  let club = null;
  if (dream !== p.club && clubLevel(dream) <= p.ability + TUNE.dreamReach && r() < TUNE.dreamChance) club = dream;
  else {
    // 구단도 선수 성향을 알기 때문에 대부분(TUNE.offerRespect) 해외·국내 뜻에 맞는 곳에서 제안함
    const lo = Math.max(clubLevel(p.club), p.ability - 8);
    const hi = p.ability + 3;
    const respect = pref.abroad !== 'any' && r() < TUNE.offerRespect;
    const pool = CLUBS.filter(x => x !== p.club && clubLevel(x) >= lo && clubLevel(x) <= hi
      && (!respect || (pref.abroad === 'no' ? x.country === p.nat : x.country !== p.nat)));
    if (!pool.length) return null;
    club = pool[Math.floor(r() * pool.length)];
  }
  const base = Math.max(c.wage, weeklyWage(Math.max(marketAbility(p), Math.round(clubLevel(club)))));
  const wage = Math.round((base * (1.1 + r() * 0.3)) / 50) * 50;
  const fee = isFreeAgent(c) ? 0 : Math.round((valueOf(p) * (0.8 + r() * 0.5)) / 5000) * 5000;
  return { club: club.id, wage, fee, years: 2 + Math.floor(r() * 3) };
}

const offerCut = d => Math.round(d.fee * TUNE.transferCut) + dealFee(d.wage);
const counterChance = () => clamp(Math.round(45 + state.rep / 5), 45, 80) + TUNE.lawyerCounter[state.invest.lawyer];
// 이적 동의: 조건 점수 + 유대 (믿는 에이전트가 권하면 따라옴)
function offerFit(p, d) {
  const pref = prefsOf(p);
  const checks = fitChecks(p, pref, CLUBS[d.club], d.wage, d.years || 3);
  const score = fitScore(checks, pref);
  const c = clientOf(p.s);
  const bond = c ? bondConsentBonus(c) : 0;
  return { checks, score, bond, consent: clamp(consentChance(score) + bond, 5, 95) };
}

function transfer(c, d) {
  const p = getPlayer(c.s);
  const from = p.club;
  const to = CLUBS[d.club];
  const fit = offerFit(p, d);
  archiveStint(c);
  if (to.id === Math.floor(c.s / SQUAD)) delete state.moved[c.s];
  else state.moved[c.s] = to.id;
  c.st = newStint(to);
  const gain = offerCut(d);
  c.wage = d.wage;
  c.end = absWeek() + WEEKS * (d.years || 3);
  addSat(c, clamp(5 + fit.score * 2, -10, 20));
  addBond(c, fit.score >= 1 ? 5 : 2, fit.score >= 1 ? `원하던 ${to.name} 이적을 성사시킴` : `${to.name} 이적을 성사시킴`);
  state.agencyCash += gain;
  const got = gainRep(2);
  state.stats.transfers += 1;
  if (to.id === prefsOf(p).dream) state.stats.dream += 1;
  toast(`이적 성사! 수수료 +${cash(gain)}`);
  return `${p.name} 이적: ${from.name} → ${to.name} (${leagueName(to.country, to.t)}), 주급 ${cash(d.wage)}, 수수료 +${cash(gain)}, 평판 +${got}, 선수 반응 ${moodText(fit.score)}`;
}

// 수락: 선수 동의 확률을 굴림
function acceptOffer(c, p, d) {
  if (Math.random() * 100 < offerFit(p, d).consent) return transfer(c, d);
  addSat(c, -2);
  return `${p.name} 선수가 ${CLUBS[d.club].name} 이적을 원하지 않아 무산됐습니다 (만족 -2).`;
}

function counterOffer(c, p, d) {
  if (Math.random() * 100 < counterChance()) {
    const better = { ...d, wage: Math.round((d.wage * 1.2) / 50) * 50, fee: Math.round(d.fee * 1.1) };
    return `더 요구해서 조건이 올랐습니다. ${acceptOffer(c, p, better)}`;
  }
  addSat(c, -5);
  addBond(c, -2, '더 요구하다 이적 제안이 날아감');
  return `${CLUBS[d.club].name}이(가) 제안을 거둬들였습니다 (${p.name} 만족 -5, 유대 -2).`;
}

// 다른 에이전시 접근: 만족·유대가 높을수록 붙잡기 쉬움 (만족 80 → 85%, 50 → 70%, 30 → 60%, 유대 60이면 +18%p). 실패하면 떠남
const keepChanceOf = c => clamp(0.45 + c.sat / 200 + (TUNE.keepChance - 0.75) + bondKeepBonus(c), 0.3, 0.95);
function keepClient(c, p, chance, gain, how) {
  if (how === '직접 만나') c.met = absWeek();
  if (Math.random() < chance) {
    addSat(c, gain);
    const bond = how === '직접 만나' ? 5 : 1;
    addBond(c, bond, how === '직접 만나' ? '다른 에이전시가 왔을 때 직접 만나 붙잡음' : '보너스를 주고 붙잡음');
    return `${p.name} 선수를 ${how} 붙잡았습니다 (만족 +${gain}, 유대 +${bond}).`;
  }
  removeClient(c, `${how} 붙잡으려 했지만 다른 에이전시로 옮겼습니다`, 2);
  return '';
}

// 소식 종류: chance(c, p) 주간 확률, text, options[{ label, ap, cost, bond, memo, go, run }], def = 답이 없을 때 고르는 번호
// bond = 그 선택으로 바뀌는 유대(버튼에 표시), memo = 선수가 기억하는 일
const EVENT_TYPES = {
  offer: {
    // 아직 이적이 없으면 첫 시즌 후반(27~46주)에 제안이 늘어남: 첫 큰 거래를 1시즌 안에 맛보게
    chance: (c, p) => TUNE.offerBase + (p.ability >= clubLevel(p.club) + 3 ? TUNE.offerStar : 0) + (state.world.form[c.s] >= 8 ? TUNE.offerForm : 0) + (isFreeAgent(c) ? TUNE.offerFree : 0)
      + (ageOf(p) <= 21 && p.pot - p.ability >= 10 ? TUNE.offerYouth : 0) + (!state.stats.transfers && state.season === 1 && state.week > 26 && state.week <= LEAGUE_WEEKS ? TUNE.offerFirst : 0),
    make: makeOffer,
    text: (p, d) => `${CLUBS[d.club].id === prefsOf(p).dream ? '꿈의 구단 ' : ''}${CLUBS[d.club].name}(${leagueName(CLUBS[d.club].country, CLUBS[d.club].t)})에서 ${p.name} 선수 영입을 제안했습니다. 주급 ${cash(d.wage)}, ${d.years || 3}시즌, ${d.fee ? `이적료 ${money(d.fee)}` : '자유 이적'}. 성사되면 내 수수료 ${cash(offerCut(d))}.`,
    fit: (p, d) => offerFit(p, d),
    options: [
      { label: (p, d) => `수락한다 (선수 동의 ${offerFit(p, d).consent}%)`, run: acceptOffer },
      { label: () => `더 요구한다 (구단 수락 ${counterChance()}%)`, run: counterOffer },
      { label: () => '거절한다', run: (c, p) => (addSat(c, -3), `${p.name} 이적 제안을 거절했습니다 (만족 -3).`) }
    ],
    def: 2
  },
  playtime: {
    chance: (c, p) => (c.playRate < 0.45 && state.week <= LEAGUE_WEEKS ? TUNE.playtimeChance * (prefsOf(p).main === 'play' ? 1.5 : 1) : 0),
    text: p => `${p.name} 선수가 출전 시간이 부족하다며 불만을 털어놓았습니다.`,
    options: [
      { label: () => '면담하며 다독인다', bond: 3, memo: '출전 불만을 들어 줌', ap: 1, run: (c, p) => (c.met = absWeek(), addSat(c, 10), `${p.name} 선수를 다독였습니다 (만족 +10).`) },
      { label: () => '구단에 출전 보장을 요구한다 (반반)', bond: 2, memo: '구단에 출전 보장을 요구해 줌', run: (c, p) => (Math.random() < 0.5 ? (addSat(c, 12), (c.playRate = Math.max(c.playRate, 0.6)), `구단이 출전을 약속했습니다 (${p.name} 만족 +12).`) : (addSat(c, -4), `구단이 요구를 무시했습니다 (${p.name} 만족 -4).`)) },
      { label: () => '참으라고 한다', bond: -4, memo: '출전 불만에 참으라고 함', run: (c, p) => (addSat(c, -8), `${p.name} 선수가 서운해합니다 (만족 -8).`) }
    ],
    def: 2
  },
  raise: {
    chance: (c, p) => (!isFreeAgent(c) && wantWage(p, prefsOf(p)) >= c.wage * 1.4 ? TUNE.raiseChance : 0),
    text: (p, d, c) => `${p.name} 선수가 주급(${cash(c.wage)})이 적다며 재계약을 원합니다. 원하는 금액은 ${cash(wantWage(p, prefsOf(p)))} 정도입니다.`,
    options: [
      { label: () => '재계약 협상을 준비한다', bond: 1, memo: '주급 고민에 재계약을 약속함', go: true, run: (c, p) => (addSat(c, 2), `${p.name} 선수에게 재계약을 준비하겠다고 했습니다 (만족 +2).`) },
      { label: () => '다음에 하자고 달랜다', bond: -3, memo: '주급 고민을 미룸', run: (c, p) => (addSat(c, -6), `${p.name} 선수가 실망했습니다 (만족 -6).`) }
    ],
    def: 1
  },
  sponsor: {
    chance: (c, p) => (state.world.form[c.s] >= 8 && valueOf(p) >= 500000 ? TUNE.sponsorChance : 0),
    make: (c, p) => ({ cut: Math.max(1000, Math.round((valueOf(p) * 0.01) / 100) * 100) }),
    text: (p, d) => `스포츠 브랜드가 요즘 폼이 좋은 ${p.name} 선수에게 광고를 제안했습니다. 내 몫은 ${cash(d.cut)}입니다.`,
    options: [
      { label: () => '계약한다', bond: 1, memo: '광고 계약을 잡아 줌', run: (c, p, d) => (state.agencyCash += d.cut, addSat(c, 3), `${p.name} 광고 계약: 자금 +${cash(d.cut)}, 평판 +${gainRep(1)}, 만족 +3`) },
      { label: () => '거절한다', run: (c, p) => `${p.name} 광고 제안을 거절했습니다.` }
    ],
    def: 1
  },
  sns: {
    chance: () => TUNE.snsChance,
    text: p => `${p.name} 선수의 SNS 글이 논란이 됐습니다.`,
    options: [
      { label: () => '사과문을 함께 낸다', bond: 1, memo: '논란 때 사과문을 함께 냄', cost: () => 1000, run: (c, p) => (addSat(c, 2), `${p.name} 선수와 사과문을 냈습니다 (만족 +2).`) },
      { label: () => '법적으로 대응한다', bond: 3, memo: '논란 때 앞장서 감싸 줌', cost: () => 5000, run: (c, p) => (addSat(c, 6), `${p.name} 선수를 감쌌습니다 (평판 +${gainRep(1)}, 만족 +6).`) },
      { label: () => '무시한다', bond: -4, memo: '논란을 외면함', run: (c, p) => (state.rep = Math.max(0, state.rep - 2), addSat(c, -4), `${p.name} 논란을 내버려 뒀습니다 (평판 -2, 만족 -4).`) }
    ],
    def: 2
  },
  injury: {
    chance: () => TUNE.injuryChance * (1 - TUNE.coachInjury[state.invest.coach]),
    make: c => ({ cost: Math.max(1000, Math.round(c.wage / 100) * 100) }),
    text: p => `${p.name} 선수가 훈련 중 다쳤습니다.`,
    options: [
      { label: () => '전문 재활을 지원한다', bond: 4, memo: '다쳤을 때 재활을 지원함', cost: d => d.cost, run: (c, p) => (state.world.form[c.s] = Math.max(state.world.form[c.s], 5), addSat(c, 6), `${p.name} 재활 지원: 폼 회복, 만족 +6`) },
      { label: () => '구단 의료진에 맡긴다', bond: -2, memo: '다쳤을 때 구단에만 맡김', run: (c, p) => (state.world.form[c.s] = Math.max(1, state.world.form[c.s] - 3), addSat(c, -3), `${p.name} 회복이 더딥니다 (폼 -3, 만족 -3).`) }
    ],
    def: 1
  },
  interview: {
    chance: (c, p) => (valueOf(p) >= 300000 ? TUNE.interviewChance : 0),
    text: p => `방송사에서 ${p.name} 선수 인터뷰를 요청했습니다.`,
    options: [
      { label: () => '인터뷰에 응한다', bond: 1, memo: '인터뷰를 함께 준비함', ap: 1, run: (c, p) => (addSat(c, 2), `${p.name} 인터뷰가 화제가 됐습니다 (평판 +${gainRep(1)}, 만족 +2).`) },
      { label: () => '거절한다', run: (c, p) => `${p.name} 인터뷰를 거절했습니다.` }
    ],
    def: 1
  },
  poach: {
    // 다른 에이전시는 몸값 높은 선수를 노리고, 불만이 큰 선수에게 더 자주 접근함
    chance: (c, p) => TUNE.poachBase + (valueOf(p) >= 3e6 ? TUNE.poachStar : 0) + (c.sat < 50 ? TUNE.poachLow : 0),
    text: p => `다른 에이전시가 ${p.name} 선수에게 접근하고 있습니다.`,
    options: [
      { label: (p, d, c) => `직접 만나 붙잡는다 (${Math.round(keepChanceOf(c) * 100)}%)`, ap: 1, run: (c, p) => keepClient(c, p, keepChanceOf(c), 15, '직접 만나') },
      { label: (p, d, c) => `보너스를 준다 (${Math.round((keepChanceOf(c) + 0.1) * 100)}%)`, cost: (d, c) => c.wage, run: (c, p) => keepClient(c, p, keepChanceOf(c) + 0.1, 12, '보너스를 주고') },
      {
        label: () => '그냥 둔다 (반반)',
        run: (c, p) => {
          if (Math.random() < 0.5) {
            removeClient(c, '다른 에이전시로 옮겼습니다', 2);
            return '';
          }
          addSat(c, -5);
          addBond(c, -3, '다른 에이전시 접근을 내버려 둠');
          return `${p.name} 선수가 일단 남았지만 흔들립니다 (만족 -5, 유대 -3).`;
        }
      }
    ],
    def: 2
  },
  family: {
    chance: () => TUNE.familyChance,
    text: p => `${p.name} 선수가 가족 일로 며칠 쉬고 싶어 합니다.`,
    options: [
      { label: () => '휴가를 허락한다', bond: 5, memo: '가족 일에 휴가를 허락함', run: (c, p) => (state.world.form[c.s] = Math.max(1, state.world.form[c.s] - 1), addSat(c, 8), `${p.name} 휴가 허락 (폼 -1, 만족 +8).`) },
      { label: () => '거절한다', bond: -5, memo: '가족 일에 휴가를 거절함', run: (c, p) => (addSat(c, -6), `${p.name} 선수가 서운해합니다 (만족 -6).`) }
    ],
    def: 1
  },
  expiring: {
    chance: c => (c.warned !== c.end && c.end - absWeek() <= 8 && c.end >= absWeek() ? 1 : 0),
    make: c => ((c.warned = c.end), {}),
    text: (p, d, c) => `${p.name} 선수 계약이 ${c.end - absWeek()}주 뒤에 끝납니다. 끝나면 무소속이 되어 수수료가 끊깁니다.`,
    options: [
      { label: () => '재계약 협상하러 간다', go: true, run: (c, p) => `${p.name} 재계약을 준비합니다.` },
      { label: () => '나중에', run: () => '' }
    ],
    def: 1
  },
  // --- 8단계 관계 이야기: 유대가 깊어진 선수에게 선수마다 한 번씩 (make에서 시작한 것으로 기록) ---
  // tale = { title, need: 필요한 유대, weeks: 함께한 주 }, quote = 선수의 말
  call: {
    tale: { title: '밤 11시의 전화', need: 45, weeks: 8 },
    chance: c => (taleReady(c, 'call') && c.sat < 65 ? TUNE.taleChance : 0),
    make: c => (startTale(c, 'call'), {}),
    text: p => `밤 11시, ${p.name} 선수에게서 전화가 왔습니다.`,
    quote: () => '요즘 경기가 너무 안 풀려서요… 그냥 에이전트님 목소리 듣고 싶었어요.',
    options: [
      { label: () => '지금 만나러 간다', ap: 1, bond: 4, memo: '힘들 때 밤늦게 만나러 와 줌', run: (c, p) => ((c.met = absWeek()), addSat(c, 8), `${p.name} 선수를 밤늦게 만나 이야기를 들었습니다 (만족 +8).`) },
      { label: () => '오래 통화하며 들어 준다', bond: 2, memo: '밤늦은 전화를 오래 들어 줌', run: (c, p) => (addSat(c, 4), `${p.name} 선수와 오래 통화했습니다 (만족 +4).`) },
      { label: () => '내일 얘기하자고 한다', bond: -2, memo: '밤늦은 전화를 끊음', run: (c, p) => `${p.name} 선수에게 내일 얘기하자고 했습니다.` }
    ],
    def: 2
  },
  wedding: {
    tale: { title: '가족 결혼식', need: 60, weeks: 26 },
    chance: c => (taleReady(c, 'wedding') ? TUNE.taleChance : 0),
    make: c => (startTale(c, 'wedding'), { who: FAMILY[hash(state.seed, c.s, c.g, 61) % FAMILY.length] }),
    text: (p, d) => `${p.name} 선수가 ${d.who} 결혼식에 초대했습니다.`,
    quote: () => '에이전트님이 와 주시면 가족들이 정말 좋아할 거예요. 저 무명일 때부터 챙겨 주신 분이라고 늘 얘기했거든요.',
    options: [
      { label: () => '직접 참석한다', ap: 1, cost: () => 500, bond: 5, memo: '가족 결혼식에 직접 와 줌', run: (c, p) => (addSat(c, 6), `${p.name} 선수 가족 결혼식에 참석했습니다 (만족 +6).`) },
      { label: () => '선물만 보낸다', cost: () => 1000, bond: 2, memo: '가족 결혼식에 선물을 보냄', run: (c, p) => (addSat(c, 2), `${p.name} 선수 가족에게 결혼 선물을 보냈습니다 (만족 +2).`) },
      { label: () => '바빠서 못 간다', bond: -2, memo: '가족 결혼식에 오지 못함', run: (c, p) => `${p.name} 선수 가족 결혼식에 가지 못했습니다.` }
    ],
    def: 2
  },
  junior: {
    // 이야기를 하나 이상 함께한 선수가 같은 나라 후배 유망주를 소개: 잘 아는 후배라 잠재력 범위가 좁고, 한동안 영입 확률이 오름
    tale: { title: '후배 소개', need: 70, weeks: 52 },
    chance: c => (taleReady(c, 'junior') && c.tales.length >= 1 ? TUNE.taleChance : 0),
    make: (c, p) => {
      const s = findJunior(p);
      if (s === null) return null;
      startTale(c, 'junior');
      const key = cooldownKey(getPlayer(s));
      state.scouted[key] = Math.max(state.scouted[key] || 0, 2);
      state.intros[key] = absWeek() + TUNE.introWeeks;
      return { junior: s };
    },
    text: (p, d) => {
      const j = getPlayer(d.junior);
      return `${p.name} 선수가 후배 ${j.name}(${ageOf(j)}세 ${j.pos}, ${j.club.name}, 잠재력 ${potText(j)})을(를) 소개했습니다. ${TUNE.introWeeks}주 동안 영입 확률 +${TUNE.introBonus}%p.`;
    },
    quote: () => '제가 제일 믿는 에이전트라고 말해 뒀어요. 한번 만나 봐 주세요.',
    options: [
      { label: () => '만나러 간다', go: 'junior', bond: 2, memo: '소개해 준 후배를 만나 줌', run: (c, p, d) => `${p.name} 선수가 소개한 ${getPlayer(d.junior).name} 선수를 보러 갑니다.` },
      { label: () => '지금은 어렵다고 말한다', run: (c, p) => `${p.name} 선수의 소개를 정중히 미뤘습니다.` }
    ],
    def: 1
  },
  praise: {
    tale: { title: '인터뷰의 고마움', need: 85, weeks: 104 },
    chance: c => (taleReady(c, 'praise') ? TUNE.taleChance : 0),
    make: c => (startTale(c, 'praise'), {}),
    text: p => `${p.name} 선수가 방송 인터뷰에서 에이전트 이야기를 꺼냈습니다.`,
    quote: () => '제 커리어의 절반은 에이전트님 덕분이에요. 아무도 저를 모를 때 먼저 손을 내밀어 준 사람이에요.',
    options: [
      { label: () => '식사 자리를 만든다', ap: 1, cost: () => 300, bond: 3, memo: '인터뷰 뒤 함께 식사함', run: (c, p) => (addSat(c, 5), `${p.name} 선수와 식사했습니다 (평판 +${gainRep(2)}, 만족 +5).`) },
      { label: () => '고맙다고 문자를 보낸다', bond: 1, memo: '인터뷰에 고맙다고 답함', run: (c, p) => `${p.name} 선수의 인터뷰가 화제가 됐습니다 (평판 +${gainRep(2)}).` }
    ],
    def: 1
  },
  tip: {
    text: p => `${state.invest.scout ? '스카우트망이' : '아는 스카우트가'} ${p.club.name}의 ${ageOf(p)}세 ${p.pos} ${p.name}(능력 ${p.ability}, 잠재력 ${potText(p)})를 추천했습니다. 보고서가 함께 와서 범위가 한 단계 좁습니다.`,
    options: [
      { label: () => '선수를 보러 간다', go: true, run: (c, p) => `${p.name} 선수를 살펴봅니다.` },
      { label: () => '넘긴다', run: () => '' }
    ],
    def: 1
  }
};

// 유망주 추천: 무작위로 훑어 20세 이하, 잠재력 여유 12 이상, 영입 확률 25% 이상인 후보를 찾음
// 스카우트망이 있으면 후보를 여러 명(TUNE.scoutTips) 모아 잠재력이 가장 높은 선수를 추천
function findTip() {
  const want = TUNE.scoutTips[state.invest.scout];
  let best = null;
  let found = 0;
  for (let i = 0; i < 300 * want && found < want; i++) {
    const s = Math.floor(Math.random() * SLOTS);
    const p = getPlayer(s);
    if (ageOf(p) <= 20 && p.pot - p.ability >= 12 && !clientOf(s) && recruitChance(p) >= 25) {
      found += 1;
      if (!best || p.pot > best.pot) best = p;
    }
  }
  return best ? best.s : null;
}

function pushEvent(type, s, d) {
  state.events.push({ id: state.nextEventId++, type, s, g: state.world.gen[s], until: absWeek() + TUNE.eventTtl, d: d || {} });
}

// 소식 답하기: AP·비용을 확인하고 결과를 기록. 반환값: 화면 이동할 선수 슬롯 또는 null
function resolveEvent(id, index, auto = false) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return null;
  const type = EVENT_TYPES[ev.type];
  const opt = type.options[index];
  const c = ev.type === 'tip' ? null : clientOf(ev.s);
  if (!opt || (ev.type !== 'tip' && !c)) {
    state.events = state.events.filter(e => e !== ev);
    return null;
  }
  const p = getPlayer(ev.s);
  const cost = opt.cost ? opt.cost(ev.d, c) : 0;
  if (!auto && opt.ap && state.ap < opt.ap) return toast('이번 주 행동력(AP)을 다 썼습니다'), null;
  if (!auto && cost > state.agencyCash) return toast(`자금이 부족합니다 (${cash(cost)} 필요)`), null;
  state.events = state.events.filter(e => e !== ev);
  if (opt.ap) state.ap -= opt.ap;
  state.agencyCash -= cost;
  const result = opt.run(c, p, ev.d);
  // 답하지 않고 넘어간 것도 선수는 기억함
  if (opt.bond && c && clientOf(ev.s)) addBond(c, opt.bond, auto ? `(답하지 않음) ${opt.memo}` : opt.memo);
  // 관계 이야기는 고른 답을 이야기 기록에 남김
  const tale = type.tale && c ? c.tales.find(t => t.k === ev.type) : null;
  if (tale) tale.t = `${auto ? '(답하지 않음) ' : ''}${opt.memo || opt.label(p, ev.d, c)}`;
  if (result) addLog(`${auto ? '(답하지 않아 기본 처리) ' : ''}${result}${opt.bond && c ? ` 유대 ${opt.bond > 0 ? '+' : ''}${opt.bond}.` : ''}`);
  // go = true면 이 선수 상세로, 문자열이면 소식에 담긴 다른 선수(예: 소개받은 후배)로 이동
  return opt.go ? (opt.go === true ? ev.s : ev.d[opt.go]) : null;
}

// 소속 선수 한 주 경기: 이번 주 경기와 A매치를 기록하고 요약 문구를 돌려줌
function playClientWeek(c, p, week) {
  const g = weekGames(p.club, state.season, week);
  const level = clubLevel(p.club);
  const form = state.world.form[c.s];
  let games = 0;
  let played = 0;
  let sum = 0;
  let goals = 0;
  const run = (key, n, lv, hard) => {
    for (let i = 0; i < n; i++) {
      games += 1;
      const m = playMatch(p, lv, form, Math.random, hard);
      addMatch(c.st[key], m);
      if (m) {
        played += 1;
        sum += m.rating;
        goals += m.goals;
      }
    }
  };
  run('L', g.L, level, false);
  run('C', g.C, level, false);
  run('K', g.K, level, true);
  if (games) c.playRate = c.playRate * 0.75 + (played / games) * 0.25;
  let call = '';
  if (NT_WEEKS.includes(week) && isNationalPick(p)) {
    const first = !c.capped;
    c.capped = true;
    run('N', 2, natCutOf(p) + 2, true);
    addSat(c, first ? 6 : 3);
    if (first) addBond(c, 5, '첫 국가대표 발탁을 함께 기뻐함');
    const got = first ? gainRep(2) : 0;
    state.stats.callups += 1;
    call = first ? ` · 첫 국가대표 발탁! (평판 +${got})` : ' · 국가대표 소집';
  }
  if (!games && !call) return '';
  return `${p.name} ${played ? `${(sum / played).toFixed(1)}${goals ? `(${goals}골)` : ''}` : games ? '결장' : ''}${call}`;
}

// 주말 처리: 경기, 만족도 변화(성향 반영), 무소속 전환, 이탈, 답 없는 소식 정리, 새 소식
function weeklyClients() {
  const now = absWeek();
  const w = state.world;
  const week = state.week - 1; // 방금 끝난 주
  const lines = [];
  for (const c of [...state.clients]) {
    const p = getPlayer(c.s);
    const pref = prefsOf(p);
    if (week >= 1) {
      const line = playClientWeek(c, p, week);
      if (line) lines.push(line);
    }
    const left = c.end - now;
    let d = -TUNE.satDecay;
    if (w.form[c.s] >= 8) d += 1;
    if (w.form[c.s] <= 3) d -= 1;
    if (left < 0) d -= 2;
    else if (left <= 8) d -= 1;
    // 가장 중요하게 여기는 조건이 지금 구단에서 안 맞으면 더 빨리 불만이 쌓이고, 잘 맞으면 천천히 쌓임
    const checks = fitChecks(p, pref, p.club, c.wage, 0);
    const main = checks.find(ch => ch.key === pref.main);
    if (main && !main.ok) d -= TUNE.mainMiss;
    if (fitScore(checks, pref) >= 3) d += TUNE.happyBonus;
    // 유대가 깊으면 서운한 일이 있어도 쉽게 식지 않음: 기본 감소가 격주로만
    if (c.bond >= TUNE.bondCalm && now % 2 === 0) d += TUNE.satDecay;
    addSat(c, d);
    // 함께 지낸 시간만큼 유대가 쌓임
    if (now > c.since && (now - c.since) % TUNE.bondTime === 0) addBond(c, 1);
    if (left === -1) addLog(`${p.name} 선수 계약이 끝나 무소속이 됐습니다. 재계약하거나 이적시키기 전까지 수수료가 없습니다.`);
    if (c.sat < TUNE.satLeave) removeClient(c, '불만이 쌓여 에이전시를 떠났습니다', 2);
  }
  for (const ev of state.events.filter(e => e.until < now)) resolveEvent(ev.id, EVENT_TYPES[ev.type].def, true);

  let added = 0;
  for (const c of state.clients) {
    if (state.events.length >= TUNE.eventMax) break;
    if (state.events.some(e => e.s === c.s)) continue;
    const p = getPlayer(c.s);
    for (const [key, type] of Object.entries(EVENT_TYPES)) {
      if (key === 'tip' || Math.random() >= type.chance(c, p)) continue;
      const d = type.make ? type.make(c, p) : {};
      if (d === null) continue;
      pushEvent(key, c.s, d);
      added += 1;
      break;
    }
  }
  if (state.events.length < TUNE.eventMax && state.rep >= 10 && Math.random() < TUNE.tipChance) {
    const s = findTip();
    if (s !== null) {
      pushEvent('tip', s);
      // 추천에는 스카우트 보고서 1번이 함께 옴
      const key = cooldownKey(getPlayer(s));
      state.scouted[key] = Math.max(state.scouted[key] || 0, 1);
      added += 1;
    }
  }
  return { added, lines };
}

// ===== 6-3. 자금 쓸 곳: 법인 투자·배당·개인 아이템 (5단계) =====
// 법인 투자: 단계별 [도입비, 주간 유지비]는 TUNE[키 + 'Lv'], 효과 숫자는 TUNE의 효과 배열
const INVEST_TYPES = {
  lawyer: { name: '변호사', desc: '계약서를 꼼꼼히 봐서 같은 조건에서 돈을 더 받아냅니다.', fx: lv => `재계약 주급 +${Math.round(TUNE.lawyerWage[lv] * 100)}% · 이적 "더 요구" 성공 +${TUNE.lawyerCounter[lv]}%p` },
  scout: { name: '스카우트망', desc: '선수 정보를 넓게 모아 영입이 쉬워집니다.', fx: lv => `영입 성공 +${TUNE.scoutRecruit[lv]}%p · 처음 보이는 잠재력 범위 폭 ${TUNE.potWidth[TUNE.scoutKnow[lv]]} · 유망주 추천은 후보 ${TUNE.scoutTips[lv]}명 중 잠재력이 가장 높은 선수` },
  coach: { name: '피지컬 코치', desc: '소속 선수의 몸을 따로 관리합니다.', fx: lv => `시즌 말 성장 +${Math.round(TUNE.coachGrow[lv] * 100)}% · 30대 하락을 ${Math.round(TUNE.coachAge[lv] * 100)}% 확률로 1 줄임 · 부상 소식 -${Math.round(TUNE.coachInjury[lv] * 100)}%` },
  office: { name: '사무실 확장', desc: '직원을 늘려 선수를 더 맡습니다. 맡은 선수가 늘면 할 일도 늘어납니다.', fx: lv => `소속 한도 +${TUNE.officeLimit[lv]}명` }
};
const INVEST_KEYS = Object.keys(INVEST_TYPES);
const newInvest = () => Object.fromEntries(INVEST_KEYS.map(k => [k, 0]));
const investSteps = key => TUNE[`${key}Lv`];
const investUpkeep = () => INVEST_KEYS.reduce((n, k) => n + (state.invest[k] ? investSteps(k)[state.invest[k] - 1][1] : 0), 0);
const weeklySpend = () => upkeepNow() + investUpkeep();

// --- 회사 설립 (7단계): 혼자 일하다 조건을 채우면 직접 세움 ---
// 조건: 평판, 자금(설립비 포함), 세운 뒤 운영비를 지금 수수료로 낼 수 있는지. [{ ok, text }]
function foundChecks() {
  const income = weeklyIncome();
  const after = companyUpkeep();
  return [
    { ok: state.rep >= TUNE.foundRep, text: `평판 ${TUNE.foundRep} 이상 (지금 ${state.rep})` },
    { ok: state.agencyCash >= TUNE.foundCash, text: `자금 ${cash(TUNE.foundCash)} 이상 (지금 ${cash(state.agencyCash)}, 설립비 ${cash(TUNE.foundCost)} 포함)` },
    { ok: income >= after, text: `주간 수수료가 회사 운영비 이상 (${cash(income)} / ${cash(after)})` }
  ];
}
const foundBlock = () => (state.founded ? '이미 회사를 세웠습니다' : state.over ? '파산한 게임입니다' : foundChecks().every(ch => ch.ok) ? '' : '설립 조건을 아직 채우지 못했습니다');

function foundAgency() {
  const block = foundBlock();
  if (block) return toast(block);
  if (!confirm(`에이전시를 세울까요?\n설립비 ${cash(TUNE.foundCost)}, 남은 돈은 회사 자본금(법인 자금)이 됩니다.\n운영비가 주 ${cash(upkeepNow())}에서 ${cash(companyUpkeep())}로 오르고, 주당 AP ${TUNE.soloAp} → ${TUNE.ap}, 소속 한도 ${TUNE.limitBase}명, 법인 투자·배당이 열립니다.`)) return;
  state.agencyCash -= TUNE.foundCost;
  state.founded = true;
  state.ap += TUNE.ap - TUNE.soloAp; // 직원이 생겨 이번 주부터 손이 늘어남
  for (const c of state.clients) addBond(c, TUNE.bondFound, '회사를 세울 때 함께함');
  const names = state.clients.map(c => getPlayer(c.s).name).join(', ');
  addLog(`에이전시를 세웠습니다 (설립비 ${cash(TUNE.foundCost)}). ${names ? `혼자 일할 때부터 함께한 ${names} 선수가 따라왔습니다 (유대 +${TUNE.bondFound}).` : ''}`);
  toast('에이전시를 세웠습니다!');
  saveState();
}

function investBlock(key) {
  const lv = state.invest[key];
  if (!state.founded) return '회사를 세우면 투자할 수 있습니다';
  if (state.over) return '파산한 게임입니다';
  if (lv >= investSteps(key).length) return '최고 단계입니다';
  const cost = investSteps(key)[lv][0];
  if (state.agencyCash < cost) return `법인 자금이 부족합니다 (${cash(cost)} 필요)`;
  return '';
}

// 투자 올리기: 도입비는 돌려받지 못하므로 확인
function invest(key) {
  const block = investBlock(key);
  if (block) return toast(block);
  const t = INVEST_TYPES[key];
  const lv = state.invest[key] + 1;
  const [cost, upkeep] = investSteps(key)[lv - 1];
  const net = weeklyIncome() - weeklySpend() - upkeep + (lv > 1 ? investSteps(key)[lv - 2][1] : 0);
  const warn = net < 0 ? `\n주의: 도입하면 주간 수지가 ${signedCash(net)}로 적자가 됩니다.` : '';
  if (!confirm(`${t.name} ${lv}단계를 도입할까요?\n도입비 ${cash(cost)} (돌려받지 못함)\n유지비 매주 ${cash(upkeep)}${warn}`)) return;
  state.agencyCash -= cost;
  state.invest[key] = lv;
  addLog(`${t.name} ${lv}단계 도입: 도입비 ${cash(cost)}, 유지비 주 ${cash(upkeep)} (${t.fx(lv)})`);
  toast(`${t.name} ${lv}단계를 도입했습니다.`);
  saveState();
}

// 단계 낮추기: 유지비는 줄지만 도입비는 돌려받지 못함
function downgrade(key) {
  const t = INVEST_TYPES[key];
  const lv = state.invest[key];
  if (!lv) return;
  const upkeep = lv > 1 ? investSteps(key)[lv - 2][1] : 0;
  const what = lv > 1 ? `${t.name} ${lv - 1}단계로 줄일까요?` : `${t.name} 투자를 그만둘까요?`;
  if (!confirm(`${what}\n유지비 매주 ${cash(upkeep)}\n도입비는 돌려받지 못하고, 다시 올리려면 또 내야 합니다.`)) return;
  state.invest[key] = lv - 1;
  addLog(`${t.name} ${lv > 1 ? `${lv - 1}단계로 줄임` : '투자 그만둠'} (유지비 주 ${cash(upkeep)})`);
  saveState();
}

// 배당(법인 → 개인): 세금을 떼고, 운영 자금 몇 주치(TUNE.reserveWeeks)는 법인에 남김
const dividendRoom = () => Math.max(0, Math.floor((state.agencyCash - weeklySpend() * TUNE.reserveWeeks) / 100) * 100);
const afterTax = amount => Math.round(amount * (1 - TUNE.tax));

function payDividend(amount) {
  if (!state.founded) return toast('회사를 세우기 전에는 자금이 모두 내 돈이라 배당이 필요 없습니다');
  if (state.over) return toast('파산한 게임입니다');
  if (!(amount > 0) || amount > dividendRoom()) return toast('배당할 수 있는 자금이 없습니다');
  const net = afterTax(amount);
  if (!confirm(`배당할까요?\n배당 ${cash(amount)} - 세금 ${cash(amount - net)} = 개인 자금 +${cash(net)}`)) return;
  state.agencyCash -= amount;
  state.personalCash += net;
  addLog(`배당 ${cash(amount)}: 세금 ${cash(amount - net)}, 개인 자금 +${cash(net)}`);
  saveState();
}

// 개인 자금을 법인에 넣기: 세금 없음 (자금이 마이너스일 때 파산을 막는 데 씀)
function inject(amount) {
  if (state.over) return toast('파산한 게임입니다');
  if (!(amount > 0) || amount > state.personalCash) return toast('넣을 개인 자금이 없습니다');
  if (!confirm(`개인 자금 ${cash(amount)}을(를) 법인에 넣을까요?\n넣을 때는 세금이 없고, 다시 꺼내려면 배당 세금 ${Math.round(TUNE.tax * 100)}%가 붙습니다.`)) return;
  state.personalCash -= amount;
  state.agencyCash += amount;
  addLog(`개인 자금 ${cash(amount)}을(를) 법인에 넣었습니다.`);
  saveState();
}

// 개인 아이템: 개인 자금으로 사고, 살 때 평판이 오름(평판이 높을수록 적게). 가격·평판은 TUNE.itemPrice·itemRep
// 회사를 세우기 전에는 자금이 모두 내 돈이라 자금에서 바로 삼
const ITEMS = [['suit', '맞춤 정장'], ['watch', '명품 시계'], ['sedan', '고급 세단'], ['box', '경기장 VIP 박스'], ['penthouse', '펜트하우스'], ['yacht', '요트']];
const walletKey = () => (state.founded ? 'personalCash' : 'agencyCash');
// 개인 자산 = 개인 자금 + 가진 아이템 값 (나중에 은퇴 엔딩 점수로 씀)
const netWorth = () => state[walletKey()] + ITEMS.reduce((n, [id], i) => n + (state.items.includes(id) ? TUNE.itemPrice[i] : 0), 0);

function itemBlock(i) {
  if (state.over) return '파산한 게임입니다';
  if (state.items.includes(ITEMS[i][0])) return '이미 가지고 있습니다';
  if (state[walletKey()] < TUNE.itemPrice[i]) return `${state.founded ? '개인 ' : ''}자금이 부족합니다 (${cash(TUNE.itemPrice[i])} 필요)`;
  return '';
}

function buyItem(i) {
  const block = itemBlock(i);
  if (block) return toast(block);
  const [id, name] = ITEMS[i];
  const price = TUNE.itemPrice[i];
  if (!confirm(`${name}을(를) 살까요?\n가격 ${cash(price)} (${state.founded ? '개인 자금' : '내 돈'}, 되팔 수 없음)`)) return;
  state[walletKey()] -= price;
  state.items.push(id);
  const got = gainRep(TUNE.itemRep[i]);
  addLog(`${name} 구입: ${cash(price)}, 평판 +${got}`);
  toast(`${name}을(를) 샀습니다. 평판 +${got}`);
  saveState();
}

// ===== 6-4. 유망주 찾기: 잠재력 범위·스카우트·관심 목록 (6단계) =====
// 스카우트 횟수: 직접 보낸 횟수 + 스카우트망 단계만큼 이미 본 것으로 침
const scoutCount = p => (state.scouted[cooldownKey(p)] || 0) + TUNE.scoutKnow[state.invest.scout] + alumniKnow(p);

// 잠재력 범위 [아래, 위]. 소속 선수와 다 자란 선수(TUNE.potAgeMax 초과)는 정확히 보임
// 진짜 잠재력이 범위 어디쯤인지는 선수마다 시드로 정해져 다시 봐도 같고, 스카우트할 때마다 이전 범위 안에서 좁아짐
function potRange(p, count = scoutCount(p)) {
  const n = Math.min(count, TUNE.potWidth.length - 1);
  if (!TUNE.potWidth[n] || clientOf(p.s) || ageOf(p) > TUNE.potAgeMax) return [p.pot, p.pot];
  const r = rng(hash(state.seed, p.s, p.g, 53));
  let lo = p.pot - Math.floor(r() * (TUNE.potWidth[0] + 1));
  let hi = lo + TUNE.potWidth[0];
  for (let i = 1; i <= n; i++) {
    const w = TUNE.potWidth[i];
    const min = Math.max(lo, p.pot - w);
    const max = Math.min(p.pot, hi - w);
    lo = min + Math.floor(r() * (max - min + 1));
    hi = lo + w;
  }
  return [Math.max(lo, p.ability), Math.min(hi, 95)];
}
function potText(p) {
  const [lo, hi] = potRange(p);
  return lo === hi ? String(lo) : `${lo}~${hi}`;
}

function scoutBlock(p) {
  if (state.over) return '파산한 게임입니다';
  if (clientOf(p.s)) return '소속 선수라 잠재력을 정확히 압니다';
  const [lo, hi] = potRange(p);
  if (lo === hi) return '잠재력을 이미 정확히 압니다';
  if (state.ap < 1) return '이번 주 행동력(AP)을 다 썼습니다';
  return '';
}

// 스카우트 보내기: 1 AP, 잠재력 범위가 한 단계 좁아짐 (기록은 최근 TUNE.scoutMax명)
function scout(s) {
  const p = getPlayer(s);
  const block = scoutBlock(p);
  if (block) return toast(block);
  state.ap -= 1;
  const key = cooldownKey(p);
  const n = (state.scouted[key] || 0) + 1;
  delete state.scouted[key]; // 다시 넣어 가장 최근으로
  state.scouted[key] = n;
  const keys = Object.keys(state.scouted);
  for (const old of keys.slice(0, Math.max(0, keys.length - TUNE.scoutMax))) delete state.scouted[old];
  const text = potText(p);
  addLog(`${p.name} 스카우트 보고서: 잠재력 ${text}`);
  toast(`스카우트 보고서: 잠재력 ${text}`);
  saveState();
}

// 관심 목록: 슬롯-세대 키로 저장 (은퇴하면 시즌 말에 빠지고, 영입하면 빠짐)
function toggleWatch(s) {
  const key = cooldownKey(getPlayer(s));
  if (state.watch.includes(key)) state.watch = state.watch.filter(k => k !== key);
  else if (state.watch.length >= TUNE.watchMax) return toast(`관심 선수는 ${TUNE.watchMax}명까지 둘 수 있습니다`);
  else state.watch.push(key);
  saveState();
}

// 은퇴해서 다른 선수가 들어온 슬롯의 스카우트 기록·관심 표시를 지움
function dropRetiredKeys() {
  const live = key => {
    const [s, g] = key.split('-').map(Number);
    return state.world.gen[s] === g;
  };
  for (const key of Object.keys(state.scouted)) if (!live(key)) delete state.scouted[key];
  state.watch = state.watch.filter(live);
}

// 유망주 찾기: 나이·포지션으로 거르고, 보이는 잠재력의 위쪽이 높은 순으로 (진짜 잠재력은 쓰지 않음)
// 소속 선수와 영입 확률이 TUNE.findChance% 미만인 선수는 뺌
function findProspects(maxAge, pos) {
  const out = [];
  for (let s = 0; s < SLOTS; s++) {
    if ((pos && POS_BY_SLOT[s % SQUAD] !== pos) || slotAge(s) > maxAge || clientOf(s)) continue;
    const p = getPlayer(s);
    if (recruitChance(p) < TUNE.findChance) continue;
    const [lo, hi] = potRange(p);
    out.push({ s, lo, hi });
  }
  out.sort((a, b) => b.hi - a.hi || b.lo - a.lo);
  return out.slice(0, TUNE.findMax).map(x => x.s);
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

// 예전(v1~v6) 세이브도 읽음: 없는 값은 기본값(성장치 0, 만족 70, 투자 0단계, 스카우트 기록 없음, 이미 회사가 있음, 유대 40 등), 주급은 불러온 뒤 채움
function deserialize(text) {
  const d = JSON.parse(text);
  const int = v => Number.isInteger(v);
  if (!d || ![1, 2, 3, 4, 5, 6, 7, SAVE_VERSION].includes(d.version)) throw new Error('지원하지 않는 버전입니다');
  if (d.slots !== SLOTS) throw new Error('세계 구성이 다른 세이브입니다');
  if (!int(d.seed) || !int(d.season) || d.season < 1 || !int(d.week) || d.week < 1 || d.week > WEEKS) throw new Error('날짜 정보가 올바르지 않습니다');
  if (!Number.isFinite(d.agencyCash) || !Number.isFinite(d.rep) || !Array.isArray(d.logs)) throw new Error('기본 정보가 올바르지 않습니다');
  // 3단계까지는 8명까지 둘 수 있었으므로 8명 세이브도 읽음 (한도 아래로 줄 때까지 영입만 막힘)
  if (!Array.isArray(d.clients) || d.clients.length > Math.max(8, maxClients()) || !d.clients.every(c => c && int(c.s) && c.s >= 0 && c.s < SLOTS && int(c.g) && int(c.end))) throw new Error('소속 선수 정보가 올바르지 않습니다');
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
  const cooldowns = {};
  if (d.cooldowns && typeof d.cooldowns === 'object') {
    for (const [key, until] of Object.entries(d.cooldowns)) if (int(until)) cooldowns[key] = until;
  }
  const summary = d.summary && typeof d.summary === 'object' && Array.isArray(d.summary.rows) ? d.summary : null;
  const moved = {};
  if (d.moved && typeof d.moved === 'object') {
    for (const [s, id] of Object.entries(d.moved)) if (int(Number(s)) && Number(s) >= 0 && Number(s) < SLOTS && int(id) && id >= 0 && id < CLUBS.length) moved[s] = id;
  }
  const events = (Array.isArray(d.events) ? d.events : []).filter(e => e && int(e.id) && EVENT_TYPES[e.type] && int(e.s) && e.s >= 0 && e.s < SLOTS && int(e.until))
    .map(e => ({ id: e.id, type: e.type, s: e.s, g: int(e.g) ? e.g : 0, until: e.until, d: e.d && typeof e.d === 'object' ? e.d : {} }))
    .filter(e => e.type !== 'offer' || (int(e.d.club) && e.d.club >= 0 && e.d.club < CLUBS.length && Number.isFinite(e.d.wage) && Number.isFinite(e.d.fee)))
    .filter(e => (e.type !== 'junior' || (int(e.d.junior) && e.d.junior >= 0 && e.d.junior < SLOTS)) && (e.type !== 'wedding' || FAMILY.includes(e.d.who)));
  const nextEventId = Math.max(int(d.nextEventId) ? d.nextEventId : 1, ...events.map(e => e.id + 1));
  const intOr = (v, fallback) => (int(v) ? v : fallback);
  // 기록 한 구간: { season, club, L/C/K/N: [출전, 골, 도움, 평점합×10] }
  const cleanStint = st => (st && int(st.season) && int(st.club) && st.club >= 0 && st.club < CLUBS.length && COMPS.every(k => Array.isArray(st[k]) && st[k].length === 4 && st[k].every(n => int(n) && n >= 0))
    ? { season: st.season, club: st.club, ...Object.fromEntries(COMPS.map(k => [k, st[k].slice()])) } : null);
  const natCut = {};
  if (d.natCut && typeof d.natCut === 'object') for (const [id, v] of Object.entries(d.natCut)) if (COUNTRY_BY_ID[id] && int(v)) natCut[id] = v;
  const stats = newCareerStats();
  if (d.stats && typeof d.stats === 'object') for (const key of Object.keys(stats)) if (int(d.stats[key]) && d.stats[key] >= 0) stats[key] = d.stats[key];
  // 5단계: 투자 단계(0~최고 단계), 가진 아이템(아는 것만, 중복 없이), 개인 자금
  const invest = newInvest();
  if (d.invest && typeof d.invest === 'object') for (const key of INVEST_KEYS) if (int(d.invest[key])) invest[key] = clamp(d.invest[key], 0, investSteps(key).length);
  const items = Array.isArray(d.items) ? ITEMS.map(([id]) => id).filter(id => d.items.includes(id)) : [];
  // 6단계: 스카우트 기록 {"슬롯-세대": 횟수}, 관심 목록 ["슬롯-세대"] (모양이 맞는 것만, 개수 제한)
  const keyOk = key => typeof key === 'string' && /^\d+-\d+$/.test(key) && Number(key.split('-')[0]) < SLOTS;
  const scouted = {};
  if (d.scouted && typeof d.scouted === 'object') {
    for (const [key, n] of Object.entries(d.scouted).slice(-TUNE.scoutMax)) if (keyOk(key) && int(n) && n > 0) scouted[key] = Math.min(n, TUNE.potWidth.length);
  }
  const watch = Array.isArray(d.watch) ? [...new Set(d.watch.filter(keyOk))].slice(0, TUNE.watchMax) : [];
  // 8단계: 옛 선수 스카우트 [{ name, nat, season }], 후배 소개 영입 보너스 {"슬롯-세대": 끝나는 주}
  const alumni = (Array.isArray(d.alumni) ? d.alumni : []).filter(a => a && typeof a.name === 'string' && COUNTRY_BY_ID[a.nat] && int(a.season))
    .slice(0, TUNE.alumniMax).map(a => ({ name: a.name.slice(0, 20), nat: a.nat, season: a.season }));
  const intros = {};
  if (d.intros && typeof d.intros === 'object') for (const [key, until] of Object.entries(d.intros).slice(-100)) if (keyOk(key) && int(until)) intros[key] = until;
  // 알려진 필드만 옮김 (모르는 값이 상태에 섞이지 않게)
  return {
    version: SAVE_VERSION, seed: d.seed, season: d.season, week: d.week,
    agencyCash: d.agencyCash, rep: clamp(Math.round(d.rep), 0, 100),
    ap: int(d.ap) ? clamp(d.ap, 0, d.founded === false ? TUNE.soloAp : TUNE.ap) : d.founded === false ? TUNE.soloAp : TUNE.ap,
    debtWeeks: int(d.debtWeeks) ? clamp(d.debtWeeks, 0, DEBT_LIMIT) : 0,
    over: d.over === true, founded: d.founded !== false,
    personalCash: Number.isFinite(d.personalCash) ? Math.max(0, d.personalCash) : 0, invest, items, scouted, watch, alumni, intros,
    clients: d.clients.map(c => ({
      s: c.s, g: c.g, end: c.end, wage: Number.isFinite(c.wage) ? c.wage : null,
      sat: Number.isFinite(c.sat) ? clamp(Math.round(c.sat), 0, 100) : TUNE.satStart, met: intOr(c.met, 0), negUntil: intOr(c.negUntil, 0), warned: intOr(c.warned, 0),
      st: cleanStint(c.st), hist: Array.isArray(c.hist) ? c.hist.map(cleanStint).filter(Boolean).slice(0, 20) : [],
      playRate: Number.isFinite(c.playRate) ? clamp(c.playRate, 0, 1) : 0.6, capped: c.capped === true,
      // 7단계: 유대·함께한 시작 주·인연·기억 (예전 세이브는 유대 40, 시작 주는 불러온 뒤 기록으로 추정)
      bond: int(c.bond) ? clamp(c.bond, 0, 100) : 40, since: int(c.since) && c.since >= 1 ? c.since : null,
      how: typeof c.how === 'string' && c.how ? c.how.slice(0, 40) : '예전부터 함께한 선수',
      memo: (Array.isArray(c.memo) ? c.memo : []).filter(m => m && int(m.w) && typeof m.t === 'string' && int(m.n)).slice(0, 3).map(m => ({ w: m.w, t: m.t.slice(0, 60), n: clamp(m.n, -20, 20) })),
      // 8단계: 함께한 관계 이야기 (아는 이야기만, 이야기마다 한 번)
      tales: (Array.isArray(c.tales) ? c.tales : []).filter((t, i, arr) => t && TALE_KEYS.includes(t.k) && int(t.w) && arr.findIndex(x => x && x.k === t.k) === i)
        .map(t => ({ k: t.k, w: t.w, t: typeof t.t === 'string' ? t.t.slice(0, 60) : '' }))
    })),
    cooldowns, logs: d.logs.map(String).slice(0, 80), summary, moved, events, nextEventId,
    natCut: Object.keys(natCut).length ? natCut : null, stats, ui: cleanUi(d.ui), world
  };
}

// 화면 위치 값 검사: 범위를 벗어나면 그 단계부터 기본값
function cleanUi(raw) {
  const u = raw && typeof raw === 'object' ? raw : {};
  const index = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);
  const tab = ['clients', 'world', 'agency', 'log'].includes(u.tab) ? u.tab : 'clients';
  const country = index(u.country, COUNTRIES.length);
  const tier = country === null ? null : index(u.tier, COUNTRIES[country].tiers.length);
  const club = tier === null ? null : COUNTRIES[country].clubs[tier].some(c => c.id === u.club) ? u.club : null;
  return { tab, country, tier, club, player: index(u.player, SLOTS) };
}

// 읽지 못한 세이브는 새 게임으로 덮기 전에 백업 칸으로 옮김
function backupSave(raw) {
  try {
    if (raw) localStorage.setItem(BACKUP_KEY, raw);
  } catch (e) {
    console.warn('세이브 백업 실패:', e.message);
  }
}

function readBackup() {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch (e) {
    return null;
  }
}

// 예전 세이브에 없던 값 채우기: 주급(v1), 국가대표 기준·이번 시즌 기록(v1~v3), 함께하기 시작한 주(v1~v6: 가장 오래된 기록 시즌의 첫 주)
function fillWages() {
  if (!state.natCut) state.natCut = computeNatCut();
  for (const c of state.clients) {
    const p = getPlayer(c.s);
    if (c.wage === null) c.wage = weeklyWage(p.ability);
    if (!c.st) c.st = newStint(p.club, worldStats(p, state.season, state.week));
    if (c.since === null) c.since = Math.min(absWeek(), (Math.min(c.st.season, ...c.hist.map(h => h.season)) - 1) * WEEKS + 1);
  }
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
    backupSave(raw);
    return 'broken';
  }
}

function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportSave() {
  downloadText(serialize(), `be-the-agent-${state.season}시즌-${state.week}주.json`);
  toast('저장 파일을 내보냈습니다.');
}

function exportBackup() {
  const raw = readBackup();
  if (!raw) return;
  downloadText(raw, 'be-the-agent-backup.json');
  toast('백업 파일을 내보냈습니다.');
}

// 불러온 세이브는 화면이 정상으로 그려진 뒤에만 저장
function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const previous = state;
    try {
      state = deserialize(String(reader.result));
      fillWages();
      render();
    } catch (e) {
      state = previous;
      render();
      toast(`불러오지 못했습니다: ${e.message}`);
      return;
    }
    saveState();
    resetHistory();
    toast('저장 파일을 불러왔습니다.');
  };
  reader.readAsText(file);
}

// ===== 8. 화면 =====
const $ = id => document.getElementById(id);
const REGIONS = [...new Set(COUNTRIES.map(c => c.region))];
const LEAGUE_COUNT = COUNTRIES.reduce((n, c) => n + c.tiers.length, 0);
// index.html에 꼭 있어야 하는 요소 (배포 직후 옛 HTML이 캐시에 남아 있는지 확인용)
const REQUIRED_IDS = ['hdr-date', 'hdr-cash', 'hdr-rep', 'hdr-ap', 'view', 'btn-next', 'summary', 'summary-title', 'summary-body',
  'summary-close', 'gameover', 'gameover-body', 'gameover-new', 'gameover-close', 'toast', 'import-file', 'tab-agency'];

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

const weeklyIncome = () => state.clients.reduce((n, c) => n + clientIncome(c), 0);

function renderHeader() {
  $('hdr-date').textContent = `${state.season}시즌 · ${state.week}주`;
  $('hdr-cash').textContent = cash(state.agencyCash);
  $('hdr-cash').classList.toggle('bad', state.agencyCash < 0);
  $('hdr-rep').textContent = String(state.rep);
  $('hdr-ap').textContent = `${state.ap}/${weeklyAp()}`;
  $('btn-next').disabled = state.over;
}

// 소속 선수 카드 (누르면 상세)
function satNode(c) {
  return el('span', c.sat < TUNE.satWarn ? 'bad' : c.sat < 50 ? 'warn' : '', `만족 ${c.sat}`);
}
const bondNode = c => el('span', c.bond >= TUNE.bondCalm ? 'up' : '', `유대 ${bondName(c.bond)} ${c.bond}`);

// 선수와의 관계: 유대 단계, 함께한 기간, 인연, 유대가 주는 효과, 선수가 기억하는 최근 일
function bondBlock(c) {
  const box = el('div', 'panel');
  const head = el('div', 'panel-head');
  head.append(el('strong', c.bond >= TUNE.bondCalm ? 'up' : '', `${bondName(c.bond)} · 유대 ${c.bond}/100`), el('span', 'badge', togetherText(c)));
  const bar = el('span', 'bar bond-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = el('i');
  fill.style.width = `${c.bond}%`;
  bar.append(fill);
  const calm = c.bond >= TUNE.bondCalm ? '서운한 일이 있어도 만족이 천천히 떨어짐' : `유대 ${TUNE.bondCalm}부터 만족이 천천히 떨어짐`;
  const effect = c.bond > TUNE.bondFrom
    ? `유대 효과: 다른 에이전시가 와도 붙잡을 확률 +${Math.round(bondKeepBonus(c) * 100)}%p · 이적을 권하면 동의 +${bondConsentBonus(c)}%p · ${calm}`
    : `유대가 ${TUNE.bondFrom}을 넘으면 다른 에이전시가 와도 붙잡기 쉬워지고, 이적을 권하면 잘 따라옵니다.`;
  box.append(head, bar, el('p', 'panel-line', `인연: ${c.how}`), el('p', 'sub', effect));
  // 함께한 일: 관계 이야기(강조)와 선수가 기억하는 최근 일을 시간 순 한 줄로 (이야기와 같은 기억은 한 번만)
  const told = c.tales.filter(t => t.t);
  const items = [
    ...told.map(t => ({ w: t.w, text: t.t, tale: true })),
    ...c.memo.filter(m => !told.some(t => t.t === m.t)).map(m => ({ w: m.w, text: `${m.t} (유대 ${m.n > 0 ? '+' : ''}${m.n})`, bad: m.n < 0 }))
  ].sort((a, b) => b.w - a.w);
  box.append(el('h3', 'mini', `함께한 이야기 ${told.length}/${TALE_KEYS.length}`));
  if (items.length) {
    const line = el('div', 'timeline');
    for (const it of items) {
      const row = el('p', it.tale ? 'tl tale' : it.bad ? 'tl bad' : 'tl', it.text);
      row.append(el('small', '', ` · ${weekLabel(it.w)}`));
      line.append(row);
    }
    box.append(line);
  } else box.append(el('p', 'sub', '함께 시간을 보내고 어려울 때 곁에 있어 주면 유대가 쌓입니다. 외면하면 줄어듭니다.'));
  box.append(el('p', 'tale-next', nextTaleText(c)));
  return box;
}

const avgRating = row => (row[0] ? (row[3] / row[0] / 10).toFixed(1) : '-');
// 한 줄 요약: "리그 12경기 3골 · 평점 6.9 · 국가대표 2경기"
function statLine(st) {
  const parts = [`리그 ${st.L[0]}경기 ${st.L[1]}골 ${st.L[2]}도움 · 평점 ${avgRating(st.L)}`];
  if (st.K[0]) parts.push(`대륙 대회 ${st.K[0]}경기`);
  if (st.N[0]) parts.push(`국가대표 ${st.N[0]}경기`);
  return parts.join(' · ');
}

function clientCard(c) {
  const p = getPlayer(c.s);
  const card = actButton('card', 'player', c.s);
  const top = el('span', 'card-top');
  top.append(posTag(p.pos), el('strong', 'name', p.name));
  if (isNationalPick(p)) top.append(el('span', 'badge mine', '국가대표'));
  top.append(el('span', 'abil', String(p.ability)));
  const stats = el('span', 'stats');
  stats.append(stat('잠재력', potText(p)), stat('폼', formNode(p)), stat('몸값', money(valueOf(p))), stat('계약 만료', contractNode(c.end)));
  const foot = el('span', 'card-foot');
  foot.append(satNode(c), ' · ', bondNode(c), isFreeAgent(c) ? ' · 무소속: 수수료 없음' : ` · 주급 ${cash(c.wage)} · 내 수수료 주 ${cash(commissionOf(c.wage))}`);
  card.append(top, el('span', 'meta', `${ageOf(p)}세 · ${p.nat.name} · ${p.club.name} · ${leagueName(p.club.country, p.club.t)}`),
    abilityBar(p.ability), stats, el('span', 'card-line', statLine(c.st)), foot);
  return card;
}

// 선수 입장 점검표: ✓/✗ 줄과 한 줄 결론
function checkList(checks, score, extra) {
  const box = el('div', 'checks');
  for (const ch of checks) box.append(el('p', ch.ok ? 'check ok' : 'check no', `${ch.ok ? '✓' : '✗'} ${ch.text}`));
  box.append(el('p', 'check-sum', `선수 반응: ${moodText(score)}${extra ? ` · ${extra}` : ''}`));
  return box;
}

// 이번 주 소식 카드: 선택지마다 AP·비용 표시, 모자라면 버튼을 막음
function newsCard(ev) {
  const type = EVENT_TYPES[ev.type];
  const p = getPlayer(ev.s);
  const c = clientOf(ev.s);
  // 관계 이야기는 따뜻한 색 카드에 이야기 이름·선수의 말을 크게 (디자인 시안 A)
  const card = el('article', type.tale ? 'news tale' : 'news');
  if (type.tale && c) {
    const lab = el('div', 'tale-lab');
    lab.append(el('span', 'tale-name', `이야기 · ${type.tale.title}`), el('span', 'badge warm', `${bondName(c.bond)} ${c.bond}`));
    card.append(lab);
  }
  card.append(el('p', 'news-text', type.text(p, ev.d, c)));
  if (type.quote) card.append(el('p', 'quote', `"${type.quote(p, ev.d, c)}"`));
  if (c) card.append(el('p', 'news-bond', type.tale ? `인연: ${c.how} · ${togetherText(c)}` : `관계: ${bondName(c.bond)} · 유대 ${c.bond} · ${c.how}`));
  if (type.fit) {
    const fit = type.fit(p, ev.d);
    card.append(checkList(fit.checks, fit.score, `이적 동의 ${fit.consent}%${fit.bond ? ` (유대 +${fit.bond}%p 포함)` : ''}`));
  }
  card.append(el('p', 'news-due', ev.until > absWeek() ? `${ev.until - absWeek()}주 안에 답하지 않으면 "${type.options[type.def].label(p, ev.d, c)}"` : '이번 주까지 답해야 합니다'));
  const actions = el('div', 'news-actions');
  type.options.forEach((opt, i) => {
    const cost = opt.cost ? opt.cost(ev.d, c) : 0;
    const bond = opt.bond && c ? `유대 ${opt.bond > 0 ? '+' : ''}${opt.bond}` : '';
    const tags = [opt.ap ? `${opt.ap} AP` : '', cost ? cash(cost) : '', bond].filter(Boolean).join(' · ');
    const b = actButton('btn', 'event', ev.id, opt.label(p, ev.d, c) + (tags ? ` (${tags})` : ''));
    b.dataset.o = String(i);
    b.disabled = (opt.ap && state.ap < opt.ap) || cost > state.agencyCash;
    actions.append(b);
  });
  card.append(actions);
  return card;
}

function renderClients(root) {
  root.append(el('h1', 'title', '내 선수'),
    el('p', 'sub', `${state.founded ? '' : '혼자 일하는 중 · '}${state.clients.length}/${clientLimit()}명 · 주간 수수료 ${cash(weeklyIncome())} · 지출 ${cash(weeklySpend())}`));
  if (!state.founded && !foundBlock()) root.append(el('p', 'note up', '회사 설립 조건을 모두 채웠습니다. 에이전시 탭에서 회사를 세울 수 있습니다.'));
  // 소식 카드를 못 그리면(잘못된 데이터) 그 소식만 버리고 화면은 계속 그림
  const cards = [];
  for (const ev of [...state.events]) {
    try {
      cards.push(newsCard(ev));
    } catch (e) {
      console.warn('소식을 그리지 못해 버립니다:', ev.type, e.message);
      state.events = state.events.filter(x => x !== ev);
    }
  }
  if (cards.length) root.append(el('h2', 'section', `이번 주 소식 ${cards.length}건`), ...cards);
  const latest = el('div', 'latest');
  state.logs.slice(0, 2).forEach(line => latest.append(el('span', '', line)));
  if (state.logs.length) root.append(latest);
  if (!state.clients.length) root.append(el('p', 'empty', '소속 선수가 없습니다.'));
  state.clients.forEach(c => root.append(clientCard(c)));
  if (state.clients.length < clientLimit() && !state.over) root.append(el('p', 'sub', '리그 탭에서 선수를 누르면 영입 제안을 할 수 있습니다 (1 AP).'));
}

// 리그: 국가 → 부 → 구단 → 선수
function clubAverage(club) {
  const slots = clubSlots(club);
  return slots.reduce((n, s) => n + getPlayer(s).ability, 0) / slots.length;
}

const clientCountIn = club => state.clients.filter(c => clubOf(c.s) === club).length;

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
    renderScouting(root);
    for (const region of REGIONS) {
      const list = el('div', 'list');
      for (const c of COUNTRIES.filter(x => x.region === region)) {
        const mine = state.clients.filter(cl => clubOf(cl.s).country === c).length;
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
  const slots = clubSlots(club);
  root.append(actButton('back', 'up', undefined, `← ${leagueName(club.country, club.t)}`), el('h1', 'title', club.name),
    el('p', 'sub', `${leagueName(club.country, club.t)} · 선수 ${slots.length}명 · 평균 능력 ${clubAverage(club).toFixed(0)} · 선수를 누르면 상세`));
  const now = absWeek();
  const players = slots.map(getPlayer).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.ability - a.ability);
  const list = el('div', 'list');
  for (const p of players) {
    const client = clientOf(p.s);
    list.append(playerRow(p, `계약 ${weekLabel(client ? client.end : contractEnd(p, now))}`));
  }
  root.append(list);
}

// 선수 한 줄 (구단 명단·관심 선수·찾기 결과). 누르면 상세. tail = 줄 끝에 붙는 글
function playerRow(p, tail) {
  const client = clientOf(p.s);
  const row = actButton(client ? 'player mine' : 'player', 'player', p.s);
  const top = el('span', 'player-top');
  top.append(posTag(p.pos), el('strong', 'name', p.name), el('span', 'player-age', `${ageOf(p)}세 · ${p.nat.name}`));
  if (client) top.append(el('span', 'badge mine', '내 선수'));
  else if (state.watch.includes(cooldownKey(p))) top.append(el('span', 'badge', '관심'));
  top.append(el('span', 'abil', String(p.ability)));
  const line = el('span', 'player-line');
  line.append(`잠재 ${potText(p)} · 폼 `, formNode(p), ` · ${money(valueOf(p))} · ${tail}`);
  row.append(top, line);
  return row;
}

// 리그 탭 맨 위: 관심 선수와 유망주 찾기 (찾기 조건·결과는 저장하지 않음)
let findAge = 21;
let findPos = '';
let findList = null;
const FIND_AGES = [19, 21, 23];
const FIND_POS = ['', 'GK', 'DF', 'MF', 'FW'];

function renderScouting(root) {
  const watched = state.watch.map(key => key.split('-').map(Number)).filter(([s, g]) => state.world.gen[s] === g).map(([s]) => getPlayer(s));
  if (watched.length) {
    const list = el('div', 'list');
    watched.forEach(p => list.append(playerRow(p, `${p.club.name} · 영입 ${recruitChance(p)}%`)));
    root.append(el('h2', 'section', `관심 선수 ${watched.length}/${TUNE.watchMax}명`), list);
  }
  const box = el('div', 'panel');
  box.append(el('strong', '', '유망주 찾기'),
    el('p', 'sub', `보이는 잠재력 범위의 위쪽이 높은 순으로 ${TUNE.findMax}명을 보여 줍니다 (영입 확률 ${TUNE.findChance}% 이상만). 잠재력은 스카우트를 보내야 정확해집니다.`));
  const ages = el('div', 'segment seg3');
  FIND_AGES.forEach(age => ages.append(segButton('findAge', age, `${age}세 이하`, age === findAge)));
  const poses = el('div', 'segment seg5');
  FIND_POS.forEach((pos, i) => poses.append(segButton('findPos', i, pos || '전체', pos === findPos)));
  box.append(ages, poses, actButton('btn wide', 'find', undefined, findList ? '다시 찾기' : '찾기'));
  root.append(box);
  if (findList) {
    const list = el('div', 'list');
    const shown = findList.map(getPlayer).filter(p => !clientOf(p.s));
    shown.forEach(p => list.append(playerRow(p, `${p.club.name} · 영입 ${recruitChance(p)}%`)));
    root.append(shown.length ? list : el('p', 'empty', '조건에 맞는 선수가 없습니다.'));
  }
}

function segButton(act, value, label, on) {
  const b = actButton(on ? 'seg on' : 'seg', act, value, label);
  b.setAttribute('aria-pressed', String(on));
  return b;
}

// 대회 진행 상태: 지금까지 치른 경기로 판단 (앞으로 결과는 미리 보여 주지 않음)
function compStatus(club, key) {
  const run = compRun(club, state.season, key);
  const weeks = key === 'C' ? CUP_WEEKS : CONT_WEEKS;
  if (key === 'K' && !inContinental(club)) return '';
  const played = weeks.filter((w, i) => w < state.week && i < run.games).length;
  if (played < run.games || weeks[run.games - 1] >= state.week) return played ? `진행 중 (${played}경기)` : '시작 전';
  if (run.won) return '우승';
  if (key === 'K') return run.games <= 6 ? '조별리그 탈락' : ['8강 탈락', '4강 탈락', '결승 패배'][run.games - 7];
  return run.games === CUP_WEEKS.length ? '결승 패배' : `${run.games}라운드 탈락`;
}

// 기록 표: 대회별 경기·골·도움·평점
function statsTable(st, club, nat, withStatus) {
  const table = el('table', 'stats-table');
  const head = el('tr');
  ['대회', '경기', '골', '도움', '평점'].forEach(h => head.append(el('th', '', h)));
  table.append(head);
  for (const key of COMPS) {
    const row = st[key];
    if (!row[0] && key !== 'L' && !(key === 'K' && inContinental(club))) continue;
    const tr = el('tr');
    const status = withStatus && key !== 'L' && key !== 'N' ? compStatus(club, key) : '';
    tr.append(el('td', '', compName(key, club, nat) + (status ? ` · ${status}` : '')), el('td', '', String(row[0])), el('td', '', String(row[1])), el('td', '', String(row[2])), el('td', '', avgRating(row)));
    table.append(tr);
  }
  return table;
}

// 지난 구간 표: 시즌·구단별 한 줄
function careerTable(hist, nat) {
  const table = el('table', 'stats-table');
  const head = el('tr');
  ['시즌', '구단', '리그', '평점', '대륙·대표'].forEach(h => head.append(el('th', '', h)));
  table.append(head);
  for (const st of hist) {
    const club = CLUBS[st.club];
    const tr = el('tr');
    tr.append(el('td', '', String(st.season)), el('td', '', `${club.name} (${club.country.name} ${club.t + 1}부)`),
      el('td', '', `${st.L[0]}경기 ${st.L[1]}골`), el('td', '', avgRating(st.L)), el('td', '', `${st.K[0]} · ${st.N[0]}`));
    table.append(tr);
  }
  return table;
}

// 성향·원하는 조건과 지금 구단이 맞는지
function prefsBlock(p, c) {
  const pref = prefsOf(p);
  const dream = CLUBS[pref.dream];
  const box = el('div', 'prefs');
  box.append(el('p', '', `성향: ${PRIORITY[pref.main]} 중시 · ${ABROAD[pref.abroad]}`),
    el('p', '', `꿈의 구단: ${dream.name} (${leagueName(dream.country, dream.t)})`),
    el('p', '', `원하는 조건: 주급 ${cash(wantWage(p, pref))} 이상 · ${pref.years}시즌 계약`));
  if (c) {
    const checks = fitChecks(p, pref, p.club, c.wage, 0);
    box.append(el('h3', 'mini', '지금 구단은?'), checkList(checks, fitScore(checks, pref)));
  }
  return box;
}

function nationalLine(p) {
  const cut = natCutOf(p);
  if (isNationalPick(p)) return `${p.nat.name} 국가대표 (기준 능력 ${cut})`;
  return `${p.nat.name} 국가대표 기준 능력 ${cut} · 지금 ${p.ability} (${cut - p.ability} 부족)`;
}

// 재계약: 기간을 고르면 주급 단계별 구단 수락 확률·선수 반응이 바뀜 (선택은 저장하지 않음)
let renewYears = 0;
function renewPanel(box, c, p) {
  const pref = prefsOf(p);
  const years = RENEW_YEARS.includes(renewYears) ? renewYears : pref.years >= 3 ? 4 : 2;
  const toggle = el('div', 'segment');
  RENEW_YEARS.forEach(y => {
    const b = actButton(y === years ? 'seg on' : 'seg', 'renewYears', y, `${y}시즌`);
    b.setAttribute('aria-pressed', String(y === years));
    toggle.append(b);
  });
  box.append(toggle);
  RENEW_LEVELS.forEach((_, i) => {
    const t = renewTerms(c, p, i, years);
    const b = actButton('btn wide option', 'renew', c.s);
    b.dataset.o = String(i);
    b.dataset.y = String(years);
    b.append(el('span', 'opt-title', `${t.label} · 주급 ${cash(t.wage)}`),
      el('span', 'opt-sub', `구단 수락 ${t.chance}% · 선수 반응 ${moodText(t.score)} (만족 ${t.satGain >= 0 ? '+' : ''}${t.satGain}) · 수수료 ${cash(t.fee)}`));
    box.append(b);
  });
  const mid = renewTerms(c, p, 0, years);
  const lawyer = state.invest.lawyer ? ` 주급에 변호사 ${state.invest.lawyer}단계(+${Math.round(TUNE.lawyerWage[state.invest.lawyer] * 100)}%)가 들어 있습니다.` : '';
  box.append(checkList(mid.checks.filter(ch => ch.key !== 'money'), fitScore(mid.checks, pref), '주급은 단계마다 다름'),
    el('p', 'sub', `결렬되면 만족 -8, 2주 뒤 다시 협상할 수 있습니다. 구단은 어린 선수에게 긴 계약, 30세 이상에게 짧은 계약을 선호합니다.${lawyer}`));
}

// 소속 선수 상세: 면담, 재계약 협상, 해지
function clientActions(box, c, p) {
  box.append(el('p', 'sub', isFreeAgent(c)
    ? '계약이 끝나 무소속입니다. 재계약하거나 이적 제안을 받아야 수수료가 다시 들어옵니다.'
    : `내 수수료는 주 ${cash(commissionOf(c.wage))}(주급의 ${FEE_RATE * 100}%)입니다.`));
  const meetMsg = meetBlock(c);
  const meetBtn = actButton('btn primary', 'meet', c.s, `면담 (1 AP, 만족 +${TUNE.meetGain}, 유대 +${TUNE.bondMeet})`);
  meetBtn.disabled = Boolean(meetMsg);
  box.append(meetBtn);
  if (meetMsg) box.append(el('p', 'note', meetMsg));
  box.append(el('h2', 'section', '재계약 협상 (1 AP)'));
  const renewMsg = renewBlock(c);
  if (renewMsg) box.append(el('p', 'note', renewMsg));
  else renewPanel(box, c, p);
  box.append(el('h2', 'section', '계약 해지'), actButton('btn danger', 'release', c.s, '계약 해지 (평판 -1)'));
}

// 소속이 아닌 선수: 스카우트 보내기와 관심 목록
function scoutActions(box, p) {
  const [lo, hi] = potRange(p);
  box.append(el('h2', 'section', '스카우트'));
  if (lo === hi) box.append(el('p', 'sub', ageOf(p) > TUNE.potAgeMax ? `${TUNE.potAgeMax}세가 넘어 잠재력이 다 드러났습니다.` : '스카우트 보고서로 잠재력을 정확히 압니다.'));
  else {
    const left = TUNE.potWidth.length - 1 - Math.min(scoutCount(p), TUNE.potWidth.length - 1);
    const b = actButton('btn wide option', 'scout', p.s);
    b.append(el('span', 'opt-title', '스카우트 보내기 (1 AP)'), el('span', 'opt-sub', `지금 ${lo}~${hi} · ${left}번 더 보내면 정확히 압니다`));
    const block = scoutBlock(p);
    b.disabled = Boolean(block);
    const alumni = alumniKnow(p) ? ` ${p.nat.name}에서 스카우트로 일하는 옛 선수 덕분에 한 번 더 본 것처럼 보입니다.` : '';
    box.append(el('p', 'sub', `잠재력은 범위로만 보입니다. 스카우트를 보낼수록 좁아지고, 영입하면 정확히 압니다.${alumni}`), b);
    if (block) box.append(el('p', 'note', block));
  }
  const watched = state.watch.includes(cooldownKey(p));
  box.append(actButton('btn wide', 'watch', p.s, watched ? '★ 관심 선수에서 빼기' : `☆ 관심 선수에 넣기 (${state.watch.length}/${TUNE.watchMax})`));
}

function renderPlayer(root, s) {
  const p = getPlayer(s);
  const client = clientOf(s);
  const wage = client ? client.wage : weeklyWage(p.ability);
  const head = el('div', 'detail-head');
  head.append(posTag(p.pos), el('h1', 'title', p.name), el('span', 'abil', String(p.ability)));
  root.append(actButton('back', 'up', undefined, '← 돌아가기'), head,
    el('p', 'sub', `${ageOf(p)}세 · ${p.nat.name} · ${p.club.name} · ${leagueName(p.club.country, p.club.t)}`), abilityBar(p.ability));
  const info = el('div', 'stats detail-stats');
  info.append(stat('잠재력', potText(p)), stat('폼', formNode(p)), stat('지난 시즌 평균 폼', (state.world.favg[s] / 2).toFixed(1)),
    stat('몸값', money(valueOf(p))), stat('주급', cash(wage)), stat('계약 만료', contractNode(client ? client.end : contractEnd(p, absWeek()))));
  if (client) info.append(stat('만족', satNode(client)));
  root.append(info);
  if (client) root.append(el('h2', 'section', '선수와의 관계'), bondBlock(client));

  root.append(el('h2', 'section', `${state.season}시즌 기록`), statsTable(client ? client.st : worldStats(p, state.season, state.week), p.club, p.nat, true),
    el('p', isNationalPick(p) ? 'sub up' : 'sub', nationalLine(p)));
  if (client && client.hist.length) root.append(el('h2', 'section', '지난 기록'), careerTable(client.hist, p.nat));
  root.append(el('h2', 'section', '성향과 원하는 조건'), prefsBlock(p, client));

  const box = el('div', 'detail-actions');
  if (client) clientActions(box, client, p);
  else {
    scoutActions(box, p);
    const block = recruitBlock(p);
    const b = actButton('btn primary', 'recruit', s, '영입 제안 (1 AP)');
    b.disabled = Boolean(block);
    const plus = [state.invest.scout ? `스카우트망 +${TUNE.scoutRecruit[state.invest.scout]}%p` : '', introActive(p) ? `내 선수의 소개 +${TUNE.introBonus}%p` : ''].filter(Boolean).join(', ');
    box.append(el('p', 'sub', `영입 비용 ${cash(recruitCost(p))} · 성공 확률 ${recruitChance(p)}%${plus ? ` (${plus} 포함)` : ''} · 계약하면 수수료 주 ${cash(commissionOf(wage))}`), b);
    if (block) box.append(el('p', 'note', block));
  }
  root.append(box);
}

// 에이전시 탭: 자금 요약, 법인 투자, 자금 옮기기, 개인 아이템
const dividendAmount = share => Math.floor((dividendRoom() * share) / 10000) * 100;
const injectAmount = share => (share === 100 ? state.personalCash : Math.floor((state.personalCash * share) / 10000) * 100);

function investCard(key, i) {
  const t = INVEST_TYPES[key];
  const lv = state.invest[key];
  const steps = investSteps(key);
  const box = el('div', 'panel');
  const head = el('div', 'panel-head');
  head.append(el('strong', '', t.name), el('span', lv ? 'badge mine' : 'badge', `${lv}/${steps.length}단계`));
  box.append(head, el('p', 'sub', t.desc), el('p', 'panel-line', lv ? `지금: ${t.fx(lv)} · 유지비 주 ${cash(steps[lv - 1][1])}` : '지금: 투자 안 함'));
  if (lv < steps.length) {
    const [cost, upkeep] = steps[lv];
    const block = investBlock(key);
    const b = actButton('btn wide option', 'invest', i);
    b.append(el('span', 'opt-title', `${lv + 1}단계로 올리기 · ${cash(cost)}`), el('span', 'opt-sub', `${t.fx(lv + 1)} · 유지비 주 ${cash(upkeep)}`));
    b.disabled = Boolean(block);
    box.append(b);
    if (block) box.append(el('p', 'note', block));
  }
  if (lv) box.append(actButton('btn wide', 'downgrade', i, lv > 1 ? `${lv - 1}단계로 줄이기 (유지비 주 ${cash(steps[lv - 2][1])})` : '투자 그만두기 (유지비 없음)'));
  return box;
}

function moneyPanel() {
  const box = el('div', 'panel');
  box.append(el('strong', '', `배당: 법인 → 개인 (세금 ${Math.round(TUNE.tax * 100)}%)`),
    el('p', 'sub', `배당할 수 있는 돈 ${cash(dividendRoom())} · 운영 자금 ${TUNE.reserveWeeks}주치(${cash(weeklySpend() * TUNE.reserveWeeks)})는 법인에 남깁니다.`));
  [25, 50, 100].forEach(share => {
    const amount = dividendAmount(share);
    const b = actButton('btn wide option', 'dividend', share);
    b.append(el('span', 'opt-title', `${share === 100 ? '전부' : `${share}%`} 배당 · ${cash(amount)}`), el('span', 'opt-sub', `세금 ${cash(amount - afterTax(amount))} · 개인 자금 +${cash(afterTax(amount))}`));
    b.disabled = amount <= 0 || state.over;
    box.append(b);
  });
  if (state.personalCash > 0) {
    box.append(el('strong', 'panel-gap', '개인 자금을 법인에 넣기 (세금 없음)'));
    [50, 100].forEach(share => {
      const amount = injectAmount(share);
      const b = actButton('btn wide', 'inject', share, `${share === 100 ? '전부' : '절반'} 넣기 · ${cash(amount)}`);
      b.disabled = amount <= 0 || state.over;
      box.append(b);
    });
  }
  return box;
}

// 개인 아이템 목록 (혼자일 때는 내 돈, 회사를 세운 뒤에는 개인 자금으로 삼)
function itemList() {
  const list = el('div', 'list');
  ITEMS.forEach(([id, name], i) => {
    const owned = state.items.includes(id);
    const short = !owned && state[walletKey()] < TUNE.itemPrice[i] ? ` · ${state.founded ? '개인 ' : ''}자금 부족` : '';
    const b = rowButton('item', i, name, `${money(TUNE.itemPrice[i])} · 평판 +${TUNE.itemRep[i]}${short}`, owned ? '보유' : '');
    b.disabled = Boolean(itemBlock(i));
    if (owned) b.classList.add('owned');
    list.append(b);
  });
  return list;
}

// 회사를 세우기 전: 혼자 일하는 지금 상황과 설립 조건 점검표
function renderSolo(root) {
  const income = weeklyIncome();
  const net = income - upkeepNow();
  root.append(el('h1', 'title', '에이전시 (아직 혼자)'),
    el('p', 'sub', `회사 없이 혼자 일합니다. 선수는 ${TUNE.soloLimit}명까지, 손이 모자라 한 주에 AP ${TUNE.soloAp}만 쓰고, 운영비는 전화·교통비 정도입니다. 지금 자금은 모두 내 돈입니다.`));
  const flow = el('div', 'panel');
  flow.append(el('strong', net < 0 ? 'bad' : 'up', `주간 수지 ${signedCash(net)}`), el('p', 'panel-line', `수수료 ${cash(income)} - 운영비 ${cash(upkeepNow())}`));
  const box = el('div', 'panel');
  box.append(el('strong', '', '에이전시 세우기'),
    el('p', 'sub', `세우면 주당 AP가 ${TUNE.soloAp}에서 ${TUNE.ap}로, 소속 한도가 ${TUNE.limitBase}명(평판이 오르면 더)이 되고 법인 투자·배당이 열립니다. 운영비는 주 ${cash(companyUpkeep())}(지금 선수 기준)로 오릅니다. 설립비를 낸 나머지 돈은 회사 자본금이 됩니다.`));
  const checks = el('div', 'checks');
  for (const ch of foundChecks()) checks.append(el('p', ch.ok ? 'check ok' : 'check no', `${ch.ok ? '✓' : '✗'} ${ch.text}`));
  const b = actButton('btn wide option', 'found');
  b.append(el('span', 'opt-title', `에이전시 세우기 · 설립비 ${cash(TUNE.foundCost)}`), el('span', 'opt-sub', `함께해 온 선수들이 따라옵니다 (유대 +${TUNE.bondFound})`));
  b.disabled = Boolean(foundBlock());
  box.append(checks, b);
  root.append(flow, box, el('h2', 'section', '개인 아이템'),
    el('p', 'sub', '지금은 내 돈으로 바로 삽니다. 살 때 평판이 오르고, 평판이 높을수록 덜 오릅니다. 설립 조건의 평판을 채우는 데도 씁니다.'), itemList());
  appendAlumni(root);
}

// 은퇴 후 스카우트로 합류한 옛 선수 (있을 때만)
function appendAlumni(root) {
  if (!state.alumni.length) return;
  const box = el('div', 'panel');
  box.append(el('strong', '', `옛 선수 스카우트 ${state.alumni.length}/${TUNE.alumniMax}명`),
    el('p', 'sub', '은퇴한 뒤 고향에서 스카우트로 일하며, 그 나라 유망주를 한 번 더 봐 줍니다.'));
  for (const a of state.alumni) box.append(el('p', 'panel-line', `${a.name} · ${COUNTRY_BY_ID[a.nat]?.name ?? ''} · ${a.season}시즌에 은퇴`));
  root.append(el('h2', 'section', '옛 선수'), box);
}

function renderAgency(root) {
  if (!state.founded) return renderSolo(root);
  const income = weeklyIncome();
  const upkeep = upkeepNow();
  const fixed = investUpkeep();
  const net = income - upkeep - fixed;
  root.append(el('h1', 'title', '에이전시'),
    el('p', 'sub', `법인 자금 ${cash(state.agencyCash)} · 개인 자금 ${cash(state.personalCash)} · 개인 자산 ${money(netWorth())} (개인 자금 + 아이템)`));
  const flow = el('div', 'panel');
  flow.append(el('strong', net < 0 ? 'bad' : 'up', `주간 수지 ${signedCash(net)}`),
    el('p', 'panel-line', `수수료 ${cash(income)} - 운영비 ${cash(upkeep)} - 투자 유지비 ${cash(fixed)}`));
  if (net < 0) flow.append(el('p', 'note', '매주 적자입니다. 투자 단계를 낮추거나 개인 자금을 법인에 넣어 파산을 막으세요.'));
  root.append(flow, el('h2', 'section', '법인 투자'),
    el('p', 'sub', '도입비는 한 번, 유지비는 매주 법인 자금에서 나갑니다. 단계를 낮추면 유지비가 줄지만 도입비는 돌려받지 못합니다.'));
  INVEST_KEYS.forEach((key, i) => root.append(investCard(key, i)));
  root.append(el('h2', 'section', '자금 옮기기'), moneyPanel(), el('h2', 'section', '개인 아이템'),
    el('p', 'sub', '개인 자금으로 삽니다. 살 때 평판이 오르고, 평판이 높을수록 덜 오릅니다.'), itemList());
  appendAlumni(root);
}

function renderLog(root) {
  root.append(el('h1', 'title', '기록'));
  const k = state.stats;
  root.append(el('p', 'sub', `에이전시 기록: 영입 ${k.signed}명 · 이적 ${k.transfers}건(꿈의 구단 ${k.dream}건) · 재계약 ${k.renewWin}/${k.renewTry}건 성공 · 국가대표 소집 ${k.callups}번 · 떠난 선수 ${k.lost}명`));
  if (state.summary) root.append(actButton('btn', 'summary', undefined, `${state.summary.season}시즌 결산 다시 보기`));
  const list = el('ol', 'log');
  state.logs.forEach(line => list.append(el('li', '', line)));
  root.append(list, el('h2', 'section', '저장'));
  root.append(el('p', 'sub', '진행 상황은 이 브라우저에 자동으로 저장됩니다. iPhone Safari는 7일 동안 이 사이트를 쓰지 않으면 저장을 지울 수 있으니, 홈 화면에 추가하거나 파일로 내보내 두세요.'));
  const actions = el('div', 'actions');
  actions.append(actButton('btn', 'export', undefined, '파일로 내보내기'), actButton('btn', 'import', undefined, '파일 불러오기'), actButton('btn danger', 'new', undefined, '새 게임'));
  root.append(actions);
  if (readBackup()) {
    root.append(el('p', 'sub', '읽지 못했던 이전 세이브가 백업되어 있습니다. 파일로 받아 두면 나중에 복구를 시도할 수 있습니다.'),
      actButton('btn', 'backup', undefined, '이전 세이브 백업 내보내기'));
  }
}

function render() {
  renderHeader();
  const root = $('view');
  root.replaceChildren();
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === state.ui.tab ? 'page' : 'false'));
  // 탭이 4개라 소식 수는 글자 대신 모서리 배지로 (360px 폰에서 줄바꿈 방지)
  const clientsTab = document.querySelector('.tab[data-tab=clients]');
  clientsTab.textContent = '내 선수';
  clientsTab.setAttribute('aria-label', state.events.length ? `내 선수, 소식 ${state.events.length}건` : '내 선수');
  if (state.events.length) clientsTab.append(el('span', 'count', String(state.events.length)));
  if (state.ui.player !== null) renderPlayer(root, state.ui.player);
  else if (state.ui.tab === 'world') renderWorld(root);
  else if (state.ui.tab === 'agency') renderAgency(root);
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
    if (row.retired) {
      li.append(el('span', 'down', ` ${row.ageFrom}세에 은퇴`));
      // 은퇴식: 오래 함께한 선수가 고마움을 전하고, 유대가 아주 깊으면 스카우트로 합류
      if (row.farewell) {
        const nat = COUNTRY_BY_ID[row.nat];
        li.append(el('span', 'summary-stats warmt', `${row.seasons ? `${row.seasons}시즌을 함께한 ` : ''}${row.name} 선수가 은퇴식에서 "처음부터 곁에 있어 준 에이전트에게 고맙다"고 말했습니다${row.rep ? ` (평판 +${row.rep})` : ''}.`));
        if (row.scout && nat) li.append(el('span', 'summary-stats up', `은퇴 후 ${nat.name} 스카우트로 합류합니다. 이제 ${nat.name} 유망주는 스카우트를 한 번 더 보낸 것처럼 보입니다.`));
      }
    }
    else {
      const diff = row.valueTo - row.valueFrom;
      const ability = row.abilityFrom === undefined ? '' : ` · 능력 ${row.abilityFrom}→${row.abilityTo}`;
      li.append(` ${row.ageFrom}→${row.ageTo}세${ability} · 몸값 ${money(row.valueFrom)} → `, el('span', diff > 0 ? 'up' : diff < 0 ? 'down' : '', money(row.valueTo)));
      if (row.apps !== undefined) li.append(el('span', 'summary-stats', `리그 ${row.apps}경기 ${row.goals}골 · 평점 ${row.apps ? row.rating.toFixed(1) : '-'}${row.caps ? ` · 국가대표 ${row.caps}경기` : ''}`));
    }
    list.append(li);
  }
  const rep = sm.repChange === undefined ? '' : `평판 ${sm.repChange >= 0 ? '+' : ''}${sm.repChange}. `;
  const coach = Number.isInteger(sm.coachGain) && sm.coachGain > 0 ? `피지컬 코치 덕분에 소속 선수 능력 +${sm.coachGain}. ` : '';
  $('summary-body').replaceChildren(list, el('p', 'sub', `${rep}${coach}세계에서 ${sm.retired.toLocaleString('ko-KR')}명이 은퇴하거나 떠나고 새 선수가 들어왔습니다.`));
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
  resetHistory();
  render();
  window.scrollTo(0, 0);
  toast('새 게임을 시작했습니다.');
}

// ===== 화면 이동: 브라우저(안드로이드) 뒤로가기와 연결 =====
const historyDepth = () => (history.state && Number.isInteger(history.state.depth) ? history.state.depth : 0);

function resetHistory() {
  history.replaceState({ ui: { ...state.ui }, depth: 0, scroll: 0 }, '');
}

// 앞으로 이동: 지금 위치의 스크롤을 기록해 두고 새 위치를 쌓음
function navigate(changes) {
  history.replaceState({ ...history.state, ui: { ...state.ui }, scroll: window.scrollY }, '');
  Object.assign(state.ui, changes);
  history.pushState({ ui: { ...state.ui }, depth: historyDepth() + 1, scroll: 0 }, '');
  render();
  window.scrollTo(0, 0);
}

// 위로 이동: 쌓인 기록이 있으면 뒤로가기와 똑같이, 없으면(새로고침 직후 등) 한 단계 위로
function goUp() {
  if (historyDepth() > 0) {
    history.back();
    return;
  }
  const ui = state.ui;
  if (ui.player !== null) ui.player = null;
  else if (ui.club !== null) ui.club = null;
  else if (ui.tier !== null) ui.tier = null;
  else ui.country = null;
  resetHistory();
  render();
  window.scrollTo(0, 0);
}

function onPopState(e) {
  if (!e.state || !e.state.ui) return;
  state.ui = cleanUi(e.state.ui);
  render();
  window.scrollTo(0, e.state.scroll || 0);
}

// 행동 후 같은 화면을 다시 그리고 스크롤 위치 유지
function stay(fn) {
  const y = window.scrollY;
  fn();
  render();
  window.scrollTo(0, y);
}

function onAction(act, v, o) {
  if (act === 'export') return exportSave();
  if (act === 'backup') return exportBackup();
  if (act === 'import') return $('import-file').click();
  if (act === 'summary') return openSummary();
  if (act === 'new') {
    if (confirm('진행 중인 게임을 지우고 새로 시작할까요? 되돌릴 수 없습니다.')) startNewGame();
    return;
  }
  if (act === 'recruit') return stay(() => recruit(v));
  if (act === 'invest') return stay(() => invest(INVEST_KEYS[v]));
  if (act === 'downgrade') return stay(() => downgrade(INVEST_KEYS[v]));
  if (act === 'dividend') return stay(() => payDividend(dividendAmount(v)));
  if (act === 'inject') return stay(() => inject(injectAmount(v)));
  if (act === 'item') return stay(() => buyItem(v));
  if (act === 'found') return stay(foundAgency);
  if (act === 'scout') return stay(() => scout(v));
  if (act === 'watch') return stay(() => toggleWatch(v));
  if (act === 'findAge') return stay(() => ((findAge = v), (findList = findProspects(findAge, findPos))));
  if (act === 'findPos') return stay(() => ((findPos = FIND_POS[v]), (findList = findProspects(findAge, findPos))));
  if (act === 'find') return stay(() => (findList = findProspects(findAge, findPos)));
  if (act === 'meet') return stay(() => meet(v));
  if (act === 'renew') return stay(() => renew(v, o, renewYears || 2));
  if (act === 'renewYears') return stay(() => (renewYears = v));
  if (act === 'event') {
    const go = resolveEvent(v, o);
    saveState();
    if (go !== null) return navigate({ player: go });
    return stay(() => {});
  }
  if (act === 'release') {
    if (release(v)) goUp();
    return;
  }
  if (act === 'up') return goUp();
  if (act === 'player') {
    renewYears = 0;
    return navigate({ player: v });
  }
  if (act === 'country') return navigate({ country: v, tier: null, club: null });
  if (act === 'tier') return navigate({ tier: v, club: null });
  if (act === 'club') return navigate({ club: v });
}

function bindEvents() {
  $('btn-next').addEventListener('click', () => {
    const news = advanceWeek();
    render();
    if (state.over) openGameOver();
    else if (state.summary && !state.summary.seen) openSummary();
    else if (news) toast(`새 소식 ${news}건이 있습니다. 내 선수 탭에서 답해 주세요.`);
  });
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    if (state.ui.tab === b.dataset.tab && state.ui.player === null) {
      window.scrollTo(0, 0);
      return;
    }
    navigate({ tab: b.dataset.tab, player: null });
  }));
  window.addEventListener('popstate', onPopState);
  $('view').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) {
      if (b.dataset.y) renewYears = Number(b.dataset.y);
      onAction(b.dataset.act, b.dataset.v === undefined ? undefined : Number(b.dataset.v), Number(b.dataset.o));
    }
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
  const badUi = cleanUi({ tab: 'x', country: 999, tier: 0, club: 5, player: -1 });
  check(badUi.tab === 'clients' && badUi.country === null && badUi.tier === null && badUi.club === null && badUi.player === null, '잘못된 화면 위치는 기본값으로');
  const okUi = cleanUi({ tab: 'world', country: 0, tier: 3, club: CLUBS[0].id, player: 10 });
  check(okUi.country === 0 && okUi.tier === 3 && okUi.club === null && okUi.player === 10, '다른 부의 구단 번호는 버림');
  check(Object.values(EVENT_TYPES).every(t => t.options[t.def] && t.options.every(o => typeof o.run === 'function')), '소식마다 기본 선택지가 있어야 함');
  check(dealFee(10000) === 10400 && offerCut({ fee: 1000000, wage: 10000 }) === 30400, '계약·이적 수수료 계산');
  const tc = { end: absWeek() + 10, sat: 70, wage: 5000 };
  check(RENEW_LEVELS.every((_, i) => RENEW_YEARS.every(y => { const t = renewTerms(tc, a, i, y); return t.chance >= 10 && t.chance <= 95 && t.wage > 0; })), '재계약 확률은 10~95%');
  check(renewTerms(tc, a, 0).chance >= renewTerms(tc, a, 2).chance, '많이 요구할수록 성공 확률이 낮아야 함');
  const w1 = worldStats(a, state.season, 20), w2 = worldStats(a, state.season, 20), w3 = worldStats(a, state.season, 40);
  check(JSON.stringify(w1) === JSON.stringify(w2) && w3.L[0] >= w1.L[0], '월드 선수 기록은 결정적이고 주가 지나면 늘어남');
  check([-8, 0, 8].every(sc => consentChance(sc) >= 5 && consentChance(sc) <= 95) && consentChance(4) > consentChance(-4), '선수 동의 확률 5~95%, 조건이 좋을수록 높음');
  check(clientLimit() >= Math.min(TUNE.soloLimit, TUNE.limitBase) && clientLimit() <= maxClients(), '소속 한도 범위 (혼자일 때 포함)');
  // 5단계: 투자·배당·아이템
  const fx = { lawyer: ['lawyerWage', 'lawyerCounter'], scout: ['scoutRecruit', 'scoutTips'], coach: ['coachGrow', 'coachAge', 'coachInjury'], office: ['officeLimit'] };
  check(INVEST_KEYS.every(k => investSteps(k).every((st, i, arr) => st[0] > 0 && st[1] > 0 && (i === 0 || (st[0] > arr[i - 1][0] && st[1] > arr[i - 1][1])))), '투자는 단계가 오를수록 도입비·유지비가 커져야 함');
  check(INVEST_KEYS.every(k => fx[k].every(name => TUNE[name].length === investSteps(k).length + 1 && TUNE[name][0] === (name === 'scoutTips' ? 1 : 0))), '투자 효과 배열은 0단계(효과 없음)부터 최고 단계까지');
  check(80 + Math.max(...TUNE.lawyerCounter) <= 95, '변호사를 써도 "더 요구" 성공은 95% 이하');
  check(afterTax(100000) === 85000 && dividendRoom() >= 0 && dividendRoom() <= Math.max(0, state.agencyCash), '배당 세금 15%, 배당 가능액은 법인 자금 안');
  check(TUNE.itemPrice.length === ITEMS.length && TUNE.itemRep.length === ITEMS.length && TUNE.itemPrice.every((v, i) => i === 0 || v > TUNE.itemPrice[i - 1]), '아이템 가격·평판은 ITEMS 순서대로');
  check(coachStep(5, 3) <= 3 && coachStep(-2, 0) >= -2 && coachStep(-2, 0) <= -1, '코치 효과는 잠재력을 넘지 않고 하락을 1까지만 줄임');
  // 6단계: 잠재력 범위는 진짜 값을 품고, 스카우트할수록 이전 범위 안에서 좁아지고, 끝에는 정확해짐
  let rangesOk = true;
  for (let s = 0, tested = 0; s < SLOTS && tested < 40; s += 97) {
    const p = getPlayer(s);
    if (clientOf(s) || ageOf(p) > TUNE.potAgeMax) continue;
    tested += 1;
    let prev = [0, 99];
    TUNE.potWidth.forEach((w, n) => {
      const [lo, hi] = potRange(p, n);
      if (!(lo <= p.pot && p.pot <= hi && lo >= p.ability && hi <= 95 && hi - lo <= w && lo >= prev[0] && hi <= prev[1])) rangesOk = false;
      prev = [lo, hi];
    });
    if (potRange(p, 0).join() !== potRange(p, 0).join() || prev[0] !== prev[1]) rangesOk = false;
  }
  check(rangesOk, '잠재력 범위: 진짜 값 포함, 스카우트할수록 안쪽으로 좁아짐, 마지막은 정확');
  check(TUNE.scoutKnow.length === TUNE.scoutLv.length + 1 && TUNE.potWidth[TUNE.potWidth.length - 1] === 0, '스카우트망 단계별 기본 스카우트 횟수, 범위 폭 마지막은 0');
  // 7단계: 유대는 0~100, 기억은 3개까지, 유대를 더해도 확률은 범위 안
  const tb = { bond: 98, memo: [], sat: 100 };
  for (let i = 0; i < 5; i++) addBond(tb, 5, '시험');
  check(tb.bond === 100 && tb.memo.length === 1 && tb.memo[0].n === 2, '유대는 100에서 멈추고 바뀐 만큼만 기억');
  for (let i = 0; i < 5; i++) addBond(tb, -30, '시험');
  check(tb.bond === 0 && tb.memo.length === 3, '유대는 0에서 멈추고 기억은 3개까지');
  tb.bond = 100;
  check(keepChanceOf(tb) <= 0.95 && bondConsentBonus(tb) <= 10 && bondKeepBonus({ bond: TUNE.bondFrom }) === 0, '유대 효과: 붙잡기 95% 이하, 이적 동의 +10%p 이하, bondFrom 이하는 효과 없음');
  check(BOND_TIERS.every(([lo], i) => i === 0 || lo < BOND_TIERS[i - 1][0]) && bondName(0) === '서먹함' && bondName(100) === '가족 같음', '유대 단계 이름');
  check(foundChecks().length === 3 && TUNE.foundCash > TUNE.foundCost && TUNE.soloLimit < TUNE.limitBase, '회사 설립: 조건 3개, 자금 조건은 설립비보다 큼, 혼자일 때 한도가 더 작음');
  check(Object.values(EVENT_TYPES).every(t => t.options.every(o => !o.bond || (typeof o.memo === 'string' && Math.abs(o.bond) <= 10))), '소식 선택지의 유대 변화에는 기억 문구가 있어야 함');
  // 8단계: 관계 이야기는 필요한 유대가 낮은 순, 선수의 말과 기본 선택이 있고, 한 번 시작하면 다시 오지 않음
  check(TALE_KEYS.every((k, i) => EVENT_TYPES[k] && EVENT_TYPES[k].tale && typeof EVENT_TYPES[k].quote === 'function' && EVENT_TYPES[k].tale.need <= 100
    && (i === 0 || EVENT_TYPES[k].tale.need > EVENT_TYPES[TALE_KEYS[i - 1]].tale.need)), '관계 이야기: 필요한 유대 순서, 선수의 말');
  const tt = { bond: 100, sat: 50, tales: [], since: absWeek() - 4 * WEEKS };
  const readyBefore = taleReady(tt, 'wedding');
  startTale(tt, 'wedding');
  check(readyBefore && !taleReady(tt, 'wedding') && typeof nextTaleText(tt) === 'string', '관계 이야기는 선수마다 한 번만');
  check(TUNE.alumniBond >= TUNE.farewellBond && TUNE.introBonus > 0 && TUNE.introWeeks > 0, '은퇴식·옛 선수·후배 소개 값');
}

// 화면 그리기 실패: 위치를 처음으로 돌려 다시 그림 → 그래도 안 되면 지금 세이브를 백업하고 새 게임
function safeRender() {
  try {
    render();
    return true;
  } catch (e) {
    console.error(e);
  }
  state.ui = { ...DEFAULT_UI };
  try {
    render();
    return true;
  } catch (e) {
    console.error(e);
  }
  try {
    backupSave(serialize());
  } catch (e) {
    console.warn('백업용 직렬화 실패:', e.message);
  }
  newGame();
  render();
  return false;
}

function boot() {
  // 배포 직후 옛 index.html이 캐시에 남아 있으면 아무것도 저장하지 않고 안내만 함
  const missing = REQUIRED_IDS.filter(id => !$(id));
  if (missing.length) {
    console.warn('화면 요소가 없습니다:', missing.join(', '));
    const note = el('p', '', '새 버전을 적용하는 중입니다. 1~2분 뒤 새로고침해 주세요. 저장된 진행 상황은 그대로입니다.');
    note.style.cssText = 'position:fixed;left:16px;right:16px;top:40%;z-index:99;padding:16px;border:1px solid #34d399;border-radius:12px;background:#111a2e;color:#e2e8f0;text-align:center';
    document.body.append(note);
    return;
  }
  const loaded = loadState();
  if (loaded !== 'ok') newGame();
  bindEvents();
  const rendered = safeRender();
  resetHistory();
  const backupNote = '이전 저장은 기록 탭에서 백업 파일로 받을 수 있습니다.';
  if (!rendered) toast(`화면을 그리지 못해 새 게임으로 시작했습니다. ${backupNote}`);
  else if (loaded === 'broken') toast(`저장 데이터를 읽지 못해 새 게임으로 시작했습니다. ${backupNote}`);
  if (state.over) openGameOver();
  else if (state.summary && !state.summary.seen) openSummary();
  runSelfCheck();
}

document.addEventListener('DOMContentLoaded', boot);
