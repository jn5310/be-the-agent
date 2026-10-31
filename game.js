'use strict';
// Be The Agent: 축구 선수 에이전트 텍스트 게임 (주간 진행, 가상 세계 리그·선수, 자동 저장)

// ===== 1. 상수와 세계 데이터 =====
const SAVE_KEY = 'be-the-agent:save';
const BACKUP_KEY = 'be-the-agent:save:backup'; // 읽지 못한 세이브를 지우지 않고 보관
const SAVE_VERSION = 12; // 13단계: 부 배치·대륙 대회 참가 구단·부상 (세계 배열은 v11과 같음)
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

// --- 언어 (영어 버전 준비): 'ko' | 'en'. 기기 설정이라 세이브에 넣지 않고 따로 저장. L(한국어, 영어)는 지금 언어의 글을 고름 ---
// 저장되는 글(로그)은 그때의 언어로 남고, 선수 이름·인연·기억·뉴스는 데이터로 저장해서 언어를 바꾸면 같이 바뀜
const LANG_KEY = 'be-the-agent:lang';
let LANG = 'ko';
const L = (ko, en) => (LANG === 'en' ? en : ko);
function initLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ko' || saved === 'en') return (LANG = saved);
  } catch (e) {
    // 저장소를 못 쓰면 브라우저 언어로
  }
  LANG = typeof navigator !== 'undefined' && navigator.language && !/^ko/i.test(navigator.language) ? 'en' : 'ko';
  return LANG;
}
// 저장해 두는 한국어 문구(인연·기억·이야기 답)의 영어: M(한국어, 영어)로 등록하고 한국어를 돌려줌, 화면에서 phrase()로 바꿈
const PHRASES = new Map();
function M(ko, en) {
  PHRASES.set(ko, en);
  return ko;
}
// 함수 안에서 저장하는 기억·인연 문구 (불러온 세이브도 바로 번역되게 처음에 한꺼번에 등록)
const MEMO = {
  meet: M('따로 만나 이야기함', "Sat down with him one-on-one"),
  renewWin: M('재계약을 성사시킴', "Got his new contract done"),
  renewLose: M('재계약 협상이 결렬됨', "Contract talks broke down"),
  counterLost: M('더 요구하다 이적 제안이 날아감', "Pushed too hard and the offer fell through"),
  keptInPerson: M('다른 에이전시가 왔을 때 직접 만나 붙잡음', "Met him in person to keep him when a rival agency came"),
  keptBonus: M('보너스를 주고 붙잡음', "Kept him with a bonus"),
  poachIgnored: M('다른 에이전시 접근을 내버려 둠', "Did nothing when a rival agency came for him"),
  firstCap: M('첫 국가대표 발탁을 함께 기뻐함', "Celebrated his first national team call-up together"),
  founded: M('회사를 세울 때 함께함', "Was there when you founded the agency"),
  howSolo: M('혼자 일할 때 직접 찾아가 데려옴', "You went to see him yourself while working alone"),
  howScout: M('스카우트 보고서를 보고 영입', "Signed after reading a scouting report"),
  howCall: M('연락해서 영입', "Signed after you got in touch"),
  howOld: M('예전부터 함께한 선수', "A player you have worked with for years"),
  // 13단계 시즌 고비
  trophy: M('우승을 함께 기뻐함', 'Celebrated a trophy together'),
  promoted: M('승격을 함께 기뻐함', 'Celebrated promotion together'),
  injured: M('부상 소식에 바로 달려옴', 'Rushed over when he got injured'),
  // 15단계 임대
  loaned: M('뛸 곳을 찾아 임대를 보내 줌', 'Found him a loan where he could play'),
  loanBack: M('임대에서 많이 뛰고 돌아와 고마워함', 'Came back from a busy loan grateful'),
  // 17단계 임대 뒤 완전 이적: 임대 구단의 제안을 거절하고 돌아오게 함 (선수가 남고 싶어 했을 때 / 돌아오고 싶어 했을 때)
  buyRefused: M('남고 싶어 한 임대 팀의 완전 이적 제안을 거절함', 'Turned down the permanent move he wanted at his loan club'),
  buyBack: M('돌아오고 싶은 마음을 들어줌', 'Respected his wish to come back to his own club')
};
// 영어 셈: pl(3, 'week') → "3 weeks"
const pl = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// 이름 나열: 영어는 "A and B", "A, B and C", 한국어는 쉼표로
const listText = items => (LANG === 'en' && items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items.join(', '));
const num = n => n.toLocaleString(L('ko-KR', 'en-US'));
function phrase(text) {
  if (LANG !== 'en' || !text) return text;
  const noReply = '(답하지 않음) ';
  if (text.startsWith(noReply)) return `(no reply) ${phrase(text.slice(noReply.length))}`;
  if (PHRASES.has(text)) return PHRASES.get(text);
  // 17단계: 임대로 뛰던 구단에 완전 이적 ("정든 런던 크라운에 남게 해 줌")
  const stayed = text.match(/^정든 (.+)에 남게 해 줌$/);
  if (stayed) {
    const club = CLUB_BY_KO.get(stayed[1]);
    return `Let him stay on at ${club ? club.en : stayed[1]}, where he had settled`;
  }
  const moved = text.match(/^(원하던 )?(.+) 이적을 성사시킴$/);
  if (moved) {
    const club = CLUB_BY_KO.get(moved[2]);
    return `${moved[1] ? 'Landed the move he wanted, to ' : 'Sealed his move to '}${club ? club.en : moved[2]}`;
  }
  return text;
}

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

// 영어 세계 데이터: 한국어 목록과 같은 순서·같은 개수 ("|"로 나눔, 띄어쓰기가 있는 이름이 있어서)
// 국가: [영어 이름, 도시]
const COUNTRY_EN = {
  ENG: ['England', 'London|Manchester|Liverpool|Birmingham|Leeds|Sheffield|Bristol|Newcastle|Nottingham|Leicester|Southampton|Portsmouth|Plymouth|Derby|Stoke|Coventry|Brighton|Norwich|Ipswich|Reading|Sunderland|Middlesbrough|Bolton|Wigan|Blackpool|Preston|Hull|Oxford|Cambridge|Exeter|York|Carlisle|Chester|Bath|Swindon|Northampton|Luton|Watford|Peterborough|Bournemouth'],
  ESP: ['Spain', 'Madrid|Barcelona|Valencia|Seville|Bilbao|Zaragoza|Málaga|Murcia|Palma|Las Palmas|Alicante|Córdoba|Valladolid|Vigo|Gijón|Granada|Oviedo|Santander|Pamplona|Almería|Cádiz|Huesca|Leganés|Getafe|Elche|Castellón|Burgos|Tarragona|Lleida|Girona|Tenerife|Badajoz|Salamanca|Toledo|Huelva'],
  GER: ['Germany', 'Berlin|Munich|Hamburg|Cologne|Frankfurt|Stuttgart|Düsseldorf|Dortmund|Essen|Leipzig|Bremen|Dresden|Hanover|Nuremberg|Duisburg|Bochum|Bielefeld|Bonn|Mannheim|Karlsruhe|Augsburg|Wiesbaden|Kiel|Aachen|Braunschweig|Mainz|Rostock|Freiburg|Heidelberg|Regensburg|Osnabrück|Paderborn'],
  ITA: ['Italy', 'Rome|Milan|Naples|Turin|Palermo|Genoa|Bologna|Florence|Bari|Catania|Venice|Verona|Messina|Padua|Trieste|Brescia|Parma|Modena|Reggio Calabria|Perugia|Livorno|Cagliari|Pescara|Salerno|Bergamo|Pisa|Lecce|Cremona|Como|Udine|Vicenza|La Spezia|Ancona'],
  FRA: ['France', 'Paris|Marseille|Lyon|Toulouse|Nice|Nantes|Strasbourg|Montpellier|Bordeaux|Lille|Rennes|Reims|Le Havre|Saint-Étienne|Toulon|Grenoble|Dijon|Angers|Nîmes|Brest|Le Mans|Amiens|Tours|Limoges|Clermont-Ferrand|Metz|Nancy|Caen|Lorient|Auxerre'],
  NED: ['Netherlands', 'Amsterdam|Rotterdam|The Hague|Utrecht|Eindhoven|Groningen|Tilburg|Almere|Breda|Nijmegen|Apeldoorn|Haarlem|Arnhem|Enschede|Zwolle|Maastricht|Leiden|Dordrecht|Heerenveen|Alkmaar'],
  POR: ['Portugal', 'Lisbon|Porto|Braga|Guimarães|Coimbra|Aveiro|Faro|Setúbal|Leiria|Viseu|Funchal|Évora|Amadora|Oeiras|Matosinhos|Arouca|Chaves|Portimão'],
  BEL: ['Belgium', 'Brussels|Antwerp|Ghent|Bruges|Liège|Charleroi|Leuven|Mechelen|Mons|Namur|Hasselt|Kortrijk|Ostend|Genk|Sint-Truiden|Westerlo'],
  TUR: ['Türkiye', 'Istanbul|Ankara|Izmir|Bursa|Antalya|Konya|Adana|Gaziantep|Kayseri|Trabzon|Samsun|Eskişehir|Malatya|Sivas|Rize|Denizli|Manisa|Kocaeli|Sakarya|Diyarbakir'],
  SCO: ['Scotland', 'Glasgow|Edinburgh|Aberdeen|Dundee|Inverness|Perth|Stirling|Paisley|Kilmarnock|Motherwell|Livingston|Hamilton|Falkirk|Ayr'],
  AUT: ['Austria', 'Vienna|Graz|Linz|Salzburg|Innsbruck|Klagenfurt|St. Pölten|Villach|Wels|Dornbirn|Steyr|Leoben'],
  SUI: ['Switzerland', 'Zurich|Geneva|Basel|Bern|Lausanne|Lucerne|St. Gallen|Lugano|Winterthur|Sion|Thun|Aarau'],
  GRE: ['Greece', 'Athens|Thessaloniki|Patras|Piraeus|Heraklion|Larissa|Volos|Ioannina|Tripoli|Chania|Kalamata|Serres|Xanthi|Agrinio|Kavala'],
  DEN: ['Denmark', 'Copenhagen|Aarhus|Odense|Aalborg|Esbjerg|Randers|Horsens|Vejle|Silkeborg|Herning|Viborg|Køge|Fredericia|Roskilde'],
  NOR: ['Norway', 'Oslo|Bergen|Trondheim|Stavanger|Kristiansand|Tromsø|Drammen|Fredrikstad|Sandefjord|Bodø|Molde|Ålesund|Haugesund|Lillehammer|Skien|Tønsberg'],
  SWE: ['Sweden', 'Stockholm|Gothenburg|Malmö|Uppsala|Västerås|Örebro|Linköping|Helsingborg|Jönköping|Norrköping|Lund|Umeå|Gävle|Borås|Kalmar|Halmstad'],
  CZE: ['Czechia', 'Prague|Brno|Ostrava|Plzeň|Liberec|Olomouc|Ústí|Hradec Králové|Pardubice|Zlín|Havířov|Opava|Teplice|Jablonec|Mladá Boleslav|Karviná'],
  POL: ['Poland', 'Warsaw|Kraków|Łódź|Wrocław|Poznań|Gdańsk|Szczecin|Bydgoszcz|Lublin|Białystok|Katowice|Gdynia|Częstochowa|Radom|Kielce|Toruń|Gliwice|Zabrze'],
  CRO: ['Croatia', 'Zagreb|Split|Rijeka|Osijek|Zadar|Pula|Slavonski Brod|Karlovac|Varaždin|Šibenik|Dubrovnik|Vinkovci'],
  SRB: ['Serbia', 'Belgrade|Novi Sad|Niš|Kragujevac|Subotica|Zrenjanin|Pančevo|Čačak|Novi Pazar|Kraljevo|Smederevo|Leskovac|Valjevo|Užice'],
  UKR: ['Ukraine', 'Kyiv|Kharkiv|Odesa|Dnipro|Donetsk|Zaporizhzhia|Lviv|Kryvyi Rih|Mykolaiv|Mariupol|Luhansk|Vinnytsia|Poltava|Chernihiv|Cherkasy|Sumy'],
  RUS: ['Russia', 'Moscow|St. Petersburg|Novosibirsk|Yekaterinburg|Kazan|Nizhny Novgorod|Chelyabinsk|Samara|Omsk|Rostov|Ufa|Krasnoyarsk|Voronezh|Perm|Volgograd|Krasnodar|Tyumen|Irkutsk'],
  ROU: ['Romania', 'Bucharest|Cluj-Napoca|Timișoara|Iași|Constanța|Craiova|Brașov|Galați|Ploiești|Oradea|Brăila|Arad|Pitești|Sibiu|Bacău|Botoșani'],
  HUN: ['Hungary', 'Budapest|Debrecen|Szeged|Miskolc|Pécs|Győr|Nyíregyháza|Kecskemét|Székesfehérvár|Szombathely|Szolnok|Eger'],
  IRL: ['Ireland', 'Dublin|Cork|Limerick|Galway|Waterford|Drogheda|Dundalk|Sligo|Bray|Athlone'],
  BRA: ['Brazil', 'São Paulo|Rio de Janeiro|Belo Horizonte|Porto Alegre|Curitiba|Salvador|Recife|Fortaleza|Goiânia|Belém|Manaus|Campinas|Santos|Florianópolis|Natal|Maceió|Cuiabá|João Pessoa|Joinville|Criciúma'],
  ARG: ['Argentina', 'Buenos Aires|Córdoba|Rosario|Mendoza|La Plata|Tucumán|Mar del Plata|Salta|Santa Fe|San Juan|Resistencia|Neuquén|Bahía Blanca|Paraná|Corrientes|Posadas|Avellaneda|Lanús|Quilmes|Banfield'],
  URU: ['Uruguay', 'Montevideo|Salto|Paysandú|Las Piedras|Rivera|Maldonado|Tacuarembó|Melo|Mercedes|Artigas|Minas|Colonia'],
  COL: ['Colombia', 'Bogotá|Medellín|Cali|Barranquilla|Cartagena|Bucaramanga|Pereira|Manizales|Cúcuta|Ibagué|Santa Marta|Villavicencio|Pasto|Montería|Neiva|Tunja'],
  CHI: ['Chile', 'Santiago|Valparaíso|Concepción|Antofagasta|Viña del Mar|Temuco|Rancagua|Talca|Arica|Iquique|Chillán|La Serena|Osorno|Puerto Montt'],
  PAR: ['Paraguay', 'Asunción|Ciudad del Este|Luque|Encarnación|San Lorenzo|Capiatá|Lambaré|Fernando de la Mora|Concepción|Villarrica|Pilar|Caaguazú'],
  ECU: ['Ecuador', 'Quito|Guayaquil|Cuenca|Santo Domingo|Machala|Manta|Portoviejo|Ambato|Riobamba|Loja|Ibarra|Esmeraldas'],
  PER: ['Peru', 'Lima|Arequipa|Trujillo|Chiclayo|Piura|Cusco|Iquitos|Huancayo|Tacna|Ica|Cajamarca|Puno|Huaraz|Callao'],
  BOL: ['Bolivia', 'La Paz|Santa Cruz|Cochabamba|Sucre|Oruro|Tarija|Potosí|El Alto|Montero|Trinidad'],
  VEN: ['Venezuela', 'Caracas|Maracaibo|Barquisimeto|Maturín|Mérida|San Cristóbal|Cumaná|Ciudad Guayana|Puerto La Cruz|Maracay|Barinas|Coro'],
  USA: ['United States', 'New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|Austin|Seattle|Denver|Boston|Atlanta|Miami|Portland|Nashville|Charlotte|Orlando|Tampa|St. Louis|Kansas City|Salt Lake|Sacramento|Pittsburgh|Cincinnati|Columbus|Detroit|Milwaukee|Las Vegas|Albuquerque|Oakland|Louisville|Memphis'],
  MEX: ['Mexico', 'Mexico City|Guadalajara|Monterrey|Puebla|Tijuana|Juárez|Toluca|Querétaro|Mérida|Cancún|Acapulco|Veracruz|Chihuahua|Aguascalientes|Morelia|San Luis Potosí|Culiacán|Mazatlán|Torreón|Oaxaca'],
  CAN: ['Canada', 'Toronto|Vancouver|Montreal|Calgary|Edmonton|Ottawa|Winnipeg|Halifax|Hamilton|Victoria|Quebec City|Regina'],
  CRC: ['Costa Rica', 'San José|Alajuela|Heredia|Cartago|Limón|Puntarenas|Liberia|San Carlos|Pérez Zeledón|Guanacaste'],
  KOR: ['South Korea', 'Seoul|Busan|Incheon|Daegu|Daejeon|Gwangju|Ulsan|Suwon|Changwon|Seongnam|Goyang|Yongin|Cheongju|Jeonju|Cheonan|Ansan|Pohang|Jeju|Gimhae|Chuncheon|Wonju|Mokpo|Yeosu|Jinju'],
  JPN: ['Japan', 'Tokyo|Yokohama|Osaka|Nagoya|Sapporo|Kobe|Kyoto|Fukuoka|Kawasaki|Saitama|Hiroshima|Sendai|Chiba|Kitakyushu|Niigata|Hamamatsu|Shizuoka|Okayama|Kumamoto|Kagoshima|Nagasaki|Matsuyama|Kanazawa'],
  CHN: ['China', "Beijing|Shanghai|Guangzhou|Shenzhen|Tianjin|Chongqing|Chengdu|Wuhan|Hangzhou|Nanjing|Xi'an|Qingdao|Dalian|Shenyang|Changchun|Zhengzhou|Jinan|Kunming"],
  KSA: ['Saudi Arabia', 'Riyadh|Jeddah|Mecca|Medina|Dammam|Taif|Buraidah|Khobar|Abha|Hail|Najran|Jizan|Tabuk|Al-Ahsa|Al-Kharj|Jubail'],
  QAT: ['Qatar', 'Doha|Al Rayyan|Al Wakrah|Al Khor|Umm Salal|Al Shamal|Dukhan|Mesaieed'],
  UAE: ['UAE', 'Dubai|Abu Dhabi|Sharjah|Al Ain|Ajman|Ras Al Khaimah|Fujairah|Umm Al Quwain|Kalba|Dibba'],
  IRN: ['Iran', 'Tehran|Mashhad|Isfahan|Karaj|Shiraz|Tabriz|Qom|Ahvaz|Kermanshah|Rasht|Kerman|Yazd|Arak|Ardabil|Bandar Abbas|Hamadan'],
  UZB: ['Uzbekistan', 'Tashkent|Samarkand|Namangan|Andijan|Bukhara|Fergana|Qarshi|Nukus|Kokand|Jizzakh|Termez|Navoiy'],
  THA: ['Thailand', 'Bangkok|Chiang Mai|Nonthaburi|Pattaya|Chonburi|Nakhon Ratchasima|Khon Kaen|Udon Thani|Buriram|Hat Yai|Suphanburi|Ratchaburi|Ayutthaya|Phuket'],
  VIE: ['Vietnam', 'Hanoi|Ho Chi Minh City|Haiphong|Da Nang|Can Tho|Hue|Nha Trang|Vinh|Thanh Hoa|Nam Dinh|Quy Nhon|Ha Tinh'],
  IDN: ['Indonesia', 'Jakarta|Surabaya|Bandung|Medan|Semarang|Makassar|Palembang|Tangerang|Depok|Bogor|Malang|Yogyakarta|Bali|Balikpapan|Pontianak|Padang'],
  AUS: ['Australia', 'Sydney|Melbourne|Brisbane|Perth|Adelaide|Gold Coast|Canberra|Newcastle|Wollongong|Hobart|Geelong|Townsville|Cairns|Darwin'],
  EGY: ['Egypt', 'Cairo|Alexandria|Giza|Port Said|Suez|Luxor|Aswan|Mansoura|Tanta|Ismailia|Zagazig|Faiyum|Minya|Asyut|Damanhur|Sohag'],
  MAR: ['Morocco', 'Casablanca|Rabat|Marrakesh|Fez|Tangier|Agadir|Meknes|Oujda|Kenitra|Tetouan|Safi|El Jadida|Nador|Beni Mellal'],
  TUN: ['Tunisia', 'Tunis|Sfax|Sousse|Kairouan|Bizerte|Gabès|Ariana|Gafsa|Monastir|Medenine|Nabeul|Béja'],
  ALG: ['Algeria', 'Algiers|Oran|Constantine|Annaba|Blida|Batna|Sétif|Sidi Bel Abbès|Biskra|Tlemcen|Béjaïa|Tizi Ouzou'],
  RSA: ['South Africa', 'Johannesburg|Cape Town|Durban|Pretoria|Port Elizabeth|Bloemfontein|East London|Pietermaritzburg|Polokwane|Mbombela|Kimberley|Soweto|Rustenburg'],
  NGA: ['Nigeria', 'Lagos|Abuja|Kano|Ibadan|Port Harcourt|Benin City|Enugu|Kaduna|Abeokuta|Jos|Ilorin|Warri|Owerri|Uyo|Aba'],
  GHA: ['Ghana', 'Accra|Kumasi|Takoradi|Tamale|Cape Coast|Obuasi|Tema|Koforidua|Sunyani|Ho']
};

// 구단 이름 접미어 영어 (CLUB_SUFFIX와 같은 순서)
const CLUB_SUFFIX_EN = {
  EN: 'Crown|Royals|Falcons|Comets|Storm|Harbour|Forge|Aero|Blaze|Spears|Knights|Herald',
  ES: 'Solar|Mirador|Rojo|Verde|Torre|Lucero|Cometa|Marea|Centinela|Sereno',
  PT: 'Solar|Ponte|Azul|Vermelho|Maré|Cometa|Torre|Raio|Floresta|Farol',
  DE: '1904|1911|1923|Rot|Blau|Schwarz|Adler|Stern|Blitz|Löwe',
  IT: 'Nero|Rosso|Azzurro|Bianco|Aquila|Torre|Cometa|Fiamma|Leone|Luce',
  FR: 'Étoile|Rouge|Bleu|Noir|Phénix|Comète|Couronne|Tonnerre|Flamme|Horizon',
  NL: 'Ster|Leeuw|Blauw|Rode|Komeet|Storm|Adelaar|Poort',
  NORD: 'Star|Løve|Ørn|Storm|Nord|Komet|Fjord|Ring',
  SLAV: 'Orlo|Grom|Burya|Kometa|Luch|Yastreb|Veter|Volk',
  TR: 'Aslan|Kartal|Yildiz|Güneş|Firtina|Şahin|Deniz|Ceylan',
  GR: 'Aetos|Astrapi|Helios|Titan|Kyklos|Nefeli|Fovos|Kallisto',
  AR: 'Al Saqr|Al Badr|Al Kawakib|Al Raad|Al Bahr|Al Sahab|Al Shams|Al Qamar',
  RO: 'Vultur|Soare|Acvila|Furtuna|Cometa|Fenix',
  HU: 'Sas|Turul|Villám|Csillag|Vihar|Oroszlán',
  KO: 'Waves|Hawks|Marines|Blaze|Comets|Storm|Falcons|Crown',
  JA: 'Stella|Cometa|Aquila|Flamma|Luce|Vento|Mare|Sole',
  ZH: 'Long|Fenghuang|Tianma|Hongxing|Haiyang|Jinxing|Lüyin|Leiting'
};

// 이름 풀 영어: [이름, 성] (NAME_DATA와 같은 순서). 영어 이름 순서는 한국·중국·베트남은 성 이름, 나머지는 이름 성
const NAME_EN = {
  ko: ['Min-jun|Seo-jun|Do-yun|Ye-jun|Si-woo|Ha-jun|Ju-won|Ji-ho|Ji-hoo|Jun-woo|Jun-seo|Gun-woo|Do-hyun|Hyun-woo|Ji-hoon|Woo-jin|Sun-woo|Seo-jin|Yeon-woo|Yu-jun|Jung-woo|Seung-woo|Seung-hyun|Si-yun|Jun-hyuk|Eun-woo|Ji-hwan|Seung-min|Ji-woo|Yu-chan|Yun-woo|Min-sung|Jun-young|Si-hoo|Jin-woo|Ji-won|Su-ho|Jae-yun|Si-hyun|Tae-yun|Dong-hyun|Jae-won|Min-hyuk|Sung-min|Young-jae|Tae-min|Sang-woo|Yong-jun|Dae-hyun|Kyung-min',
    'Kim|Kim|Kim|Kim|Lee|Lee|Lee|Park|Park|Choi|Jung|Kang|Cho|Yoon|Jang|Lim|Han|Oh|Seo|Shin|Kwon|Hwang|Ahn|Song|Ryu|Jeon|Hong|Ko|Moon|Yang|Son|Bae|Baek|Heo|Yoo|Nam|Shim|Noh|Ha|Kwak|Sung|Cha|Joo|Woo|Koo|Min|Na|Jin|Ji|Eom|Chae|Won|Cheon|Bang|Gong|Hyun'],
  ja: ['Haruto|Sota|Hayato|Haruki|Ren|Daiki|Shota|Kaito|Riku|Yuma|Takumi|Kenta|Ryusei|Sho|Kota|Yuito|Soma|Kazuki|Ryota|Tsubasa|Masato|Hiroki|Yuki|Naoki|Shun|Kohei|Daisuke|Yusuke|Kenji|Akira',
    'Sato|Suzuki|Takahashi|Tanaka|Watanabe|Ito|Yamamoto|Nakamura|Kobayashi|Kato|Yoshida|Yamada|Sasaki|Yamaguchi|Matsumoto|Inoue|Kimura|Hayashi|Shimizu|Yamazaki|Mori|Ikeda|Hashimoto|Ishikawa|Yamashita|Ogawa|Ishii|Hasegawa|Kondo|Saito|Sakamoto|Aoki|Fujita|Nishimura|Fukuda|Ota|Takeuchi|Nomura|Matsuda|Sugiyama'],
  zh: ['Wei|Hao|Yang|Peng|Jian|Ming|Yu|Kai|Jun|Bo|Bin|Tao|Xin|Zihao|Yuchen|Yifan|Junjie|Jiahao|Yuheng|Ziyang|Tianyu|Minghao|Haoran|Zihan|Wenbo|Rui|Chenyu|Yiming|Xudong|Jiale',
    'Wang|Li|Zhang|Liu|Chen|Yang|Huang|Zhao|Wu|Zhou|Xu|Sun|Ma|Zhu|Hu|Guo|He|Gao|Lin|Luo|Zheng|Liang|Xie|Song|Tang|Han|Feng|Deng|Cao|Yuan'],
  en: ['Jack|Harry|Oliver|George|Charlie|Thomas|James|William|Joshua|Daniel|Ryan|Lewis|Matthew|Nathan|Sam|Ben|Adam|Reece|Connor|Jake|Dylan|Aaron|Liam|Owen|Sean|Ross|Alfie|Tyler|Brandon|Luke|Andrew|Michael|Chris|Joe|Ethan|Alex|David|Peter|Steven|Mark',
    'Smith|Jones|Taylor|Brown|Davies|Evans|Thompson|Hughes|Green|Hall|Wood|Harris|Clarke|Jackson|Turner|Hill|Moore|Cooper|Ward|Morris|King|Baker|Harrison|Morgan|Allen|Scott|Phillips|Watson|Parker|Price|Bennett|Griffiths|Richardson|Marshall|Ellis|Collins|Mitchell|Graham|Murray|Stewart|Fisher|Hardy|Rogers|Reid|Foster|Webb'],
  es: ['Alejandro|Daniel|Pablo|Javier|David|Sergio|Carlos|Miguel|Andrés|Manuel|Jorge|Luis|Diego|Fernando|Rafael|Álvaro|Iván|Adrián|Marcos|Gonzalo|Nicolás|Matías|Santiago|Sebastián|Felipe|Emiliano|Joaquín|Ignacio|Tomás|Hugo|Víctor|Rodrigo|Cristian|Gabriel|Eduardo|Óscar|Jaime|Raúl|Enrique|Mario',
    'García|Rodríguez|González|Fernández|López|Martínez|Sánchez|Pérez|Gómez|Martín|Jiménez|Hernández|Díaz|Moreno|Muñoz|Álvarez|Romero|Alonso|Gutiérrez|Navarro|Domínguez|Vázquez|Ramírez|Serrano|Molina|Morales|Ortiz|Delgado|Castro|Ortega|Rubio|Marín|Iglesias|Medina|Garrido|Cortés|Castillo|Reyes|Acosta|Rojas|Benítez|Cabrera|Aguilar|Figueroa|Palacios'],
  pt: ['João|Pedro|Thiago|Ricardo|Bruno|André|Miguel|Rafael|Matheus|Gabriel|Lucas|Felipe|Vitor|Igor|Renato|Daniel|Luís|Caio|Everton|Marcus|Paulo|Sérgio|Nuno|Gonçalo|Diogo|Rúben|Rodrigo|Henrique|Leandro|Flávio',
    'Silva|Santos|Ferreira|Pereira|Oliveira|Souza|Costa|Rodrigues|Martins|Gomes|Lopes|Ribeiro|Alves|Carvalho|Pires|Mendes|Nunes|Soares|Lima|Araújo|Barbosa|Rocha|Cardoso|Teixeira|Correia|Vieira|Batista|Monteiro|Freitas|Moreira'],
  fr: ['Lucas|Hugo|Théo|Louis|Raphaël|Arthur|Jules|Mathis|Léo|Gabriel|Adam|Paul|Thomas|Nicolas|Antoine|Baptiste|Maxime|Alexandre|Julien|Romain|Yann|Benoît|Simon|Bastien|Benjamin|Clément|Mathieu|Anthony|Olivier|Étienne',
    'Martin|Bernard|Dubois|Thomas|Robert|Richard|Petit|Durand|Leroy|Moreau|Simon|Laurent|Lefebvre|Michel|David|Bertrand|Roux|Vincent|Fournier|Morel|Girard|André|Mercier|Dupont|Lambert|Bonnet|François|Legrand|Garnier|Faure|Rousseau|Guérin|Perrin|Morin|Gauthier|Blanc'],
  de: ['Lukas|Leon|Felix|Maximilian|Paul|Jonas|Luca|Elias|Noah|Finn|Ben|Tim|Niklas|Jan|Jonathan|Julian|Florian|David|Marco|Tobias|Kevin|Manuel|Thomas|Christoph|Matthias|Stefan|Dominik|Fabian|Kai|Malte|Hannes|Niko|Robin|Andreas|Michael|Simon|Philipp|Sascha|Dennis|Mario',
    'Müller|Schmidt|Schneider|Fischer|Weber|Meyer|Wagner|Becker|Schulz|Hoffmann|Schäfer|Koch|Bauer|Richter|Klein|Wolf|Schröder|Neumann|Schwarz|Zimmermann|Krüger|Hartmann|Lange|Werner|Krause|Lehmann|Köhler|Herrmann|König|Walter|Huber|Kaiser|Fuchs|Peters|Lang|Schmitz|Zimmer|Busch|Franke'],
  it: ['Lorenzo|Leonardo|Francesco|Alessandro|Mattia|Andrea|Gabriele|Tommaso|Riccardo|Edoardo|Matteo|Giovanni|Federico|Davide|Luca|Marco|Niccolò|Pietro|Simone|Gianluca|Fabio|Stefano|Cristian|Daniele|Alberto|Claudio|Giorgio|Samuele|Emanuele|Giacomo',
    "Rossi|Russo|Ferrari|Esposito|Bianchi|Romano|Colombo|Ricci|Marino|Greco|Bruno|Gallo|Conti|De Luca|Costa|Giordano|Rizzo|Lombardi|Moretti|Barbieri|Fontana|Santoro|Marini|Rinaldi|Caruso|Ferrara|Galli|Martini|Leone|Longo|Gentile|Martinelli|Vitale|Serra|Coppola|De Santis|D'Amico|Parisi|Bello|Guidi"],
  nl: ['Daan|Sem|Luuk|Milan|Levi|Noah|Finn|Bas|Thijs|Stijn|Jesper|Ruben|Joris|Bram|Tim|Jesse|Niels|Bart|Koen|Jeroen|Teun|Sven|Mats|Ryan|Thomas|Jan|Arne|Pieter|Wouter|Simon',
    'Jansen|Bakker|Visser|Smit|Meijer|Mulder|Bos|Vos|Peters|Hendriks|Van Leeuwen|Dekker|Brouwer|Dijkstra|Smits|Kok|Jacobs|Peeters|Janssens|Maes|Willems|Claes|Goossens|Wouters|Stevens|De Smet|Van Dam|Vermeulen|Van den Berg|De Groot|De Haan|Plassen'],
  nord: ['Rasmus|Mathias|Mikkel|Frederik|Magnus|Oliver|Emil|Viktor|Oskar|Lukas|Alexander|Anders|Jonas|Henrik|Simon|Jakob|Thomas|Martin|Sigurd|Karl|Erik|Leo|Nils|Per|Isak|Joakim|Kristoffer|Bjørn|Arvid|Ulrik',
    'Hansen|Nielsen|Jensen|Pedersen|Andersen|Larsen|Sørensen|Rasmussen|Christensen|Olsen|Johansen|Karlsson|Nilsson|Eriksson|Larsson|Andersson|Johansson|Pettersson|Olsson|Svensson|Berg|Lind|Halvorsen|Strand|Møller|Madsen|Christiansen|Berge|Holm|Lund'],
  pl: ['Jakub|Kacper|Filip|Mikołaj|Bartosz|Mateusz|Karol|Paweł|Tomasz|Adam|Krzysztof|Michał|Piotr|Łukasz|Grzegorz|Dawid|Marcin|Szymon|Wojciech|Arkadiusz|Damian|Przemysław|Rafał|Sebastian|Jan',
    'Nowak|Kowalski|Wiśniewski|Wójcik|Kowalczyk|Kamiński|Szymański|Woźniak|Dąbrowski|Kozłowski|Jankowski|Mazur|Kwiatkowski|Krawczyk|Kaczmarek|Piotrowski|Grabowski|Zając|Pawłowski|Michalski|Król|Wieczorek|Jaworski|Majewski|Olszewski'],
  cz: ['Jan|Jakub|Tomáš|David|Lukáš|Ondřej|Petr|Michal|Filip|Vojtěch|Adam|Matěj|Šimon|Pavel|Jiří|Marek|Daniel|Ladislav|Milan|Martin|Václav|Zdeněk|Luboš|Roman|Karel',
    'Novák|Svoboda|Novotný|Dvořák|Černý|Procházka|Kučera|Veselý|Horák|Němec|Pokorný|Marek|Pospíšil|Hájek|Král|Růžička|Beneš|Paták|Šíma|Brabec|Kovář|Urban|Blažek|Šebek|Janoušek'],
  slav: ['Luka|Ivan|Marko|Mateo|Josip|Ante|Nikola|Petar|Stefan|Miloš|Dušan|Nemanja|Aleksandar|Branislav|Mario|Domagoj|Dejan|Borna|Kristijan|Tomislav|Dario|Uroš|Lazar|Filip|Vladimir|Zvonimir|Mihailo|Denis|Leo|Niko',
    'Horvat|Babić|Marić|Jurić|Novaković|Kovačević|Knežević|Marković|Petrović|Jovanović|Nikolić|Ilić|Pavlović|Milošević|Todorović|Đorđević|Stevanović|Radović|Vuković|Lukić|Vasiljević|Savić|Blažević|Grgurić|Šimić|Matijević|Kuzić|Miletić'],
  ua: ['Oleksandr|Andriy|Dmytro|Serhiy|Mykhailo|Volodymyr|Viktor|Maksym|Illia|Artem|Roman|Yevhen|Ivan|Vasyl|Bohdan|Taras|Yuriy|Oleh|Denys|Kyrylo|Mykola|Petro|Nazar|Vladyslav|Ostap',
    'Kovalenko|Bondarenko|Tkachenko|Kravchenko|Shevchuk|Boyko|Kovalchuk|Moroz|Lysenko|Polishchuk|Savchenko|Rudenko|Marchenko|Levchenko|Klymenko|Pavlenko|Petrenko|Matusiuk|Yaremenko|Sydorenko|Marchuk|Hryhorenko|Omelchenko|Savenko|Kuzmenko'],
  ru: ['Aleksandr|Dmitri|Sergei|Andrei|Aleksei|Mikhail|Ivan|Maksim|Nikita|Artyom|Ilya|Kirill|Roman|Pavel|Fyodor|Igor|Vladimir|Danil|Yegor|Matvei|Viktor|Yuri|Denis|Konstantin|Nikolai',
    'Ivanov|Smirnov|Kuznetsov|Popov|Vasilyev|Petrov|Sokolov|Mikhailov|Novikov|Fyodorov|Morozov|Volkov|Alekseyev|Lebedev|Semyonov|Yegorov|Pavlov|Kozlov|Stepanov|Nikolayev|Orlov|Andreyev|Makarov|Nikitin|Zakharov|Zaitsev|Solovyov|Borisov|Yakovlev|Grigoryev'],
  tr: ['Mehmet|Mustafa|Ahmet|Ali|Hüseyin|Hasan|İbrahim|İsmail|Osman|Yusuf|Murat|Emre|Burak|Kerem|Arda|Hakan|Ozan|Enes|Uğur|Serkan|Oğuz|Baris|Mert|Kaan|Ege|Selçuk|Okan|Tolga|Batuhan|Yiğit',
    'Yilmaz|Kaya|Demir|Şahin|Çelik|Yildiz|Yildirim|Öztürk|Aydin|Özdemir|Arslan|Doğan|Kiliç|Aslan|Çetin|Kara|Koç|Kurt|Özkan|Şimşek|Polat|Aktaş|Güneş|Bayrak|Aksoy|Uzun|Ertem|Kalkan|Korkmaz|Taş'],
  gr: ['Giorgos|Ioannis|Konstantinos|Dimitrios|Nikolaos|Panagiotis|Vasilios|Christos|Athanasios|Michalis|Evangelos|Stavros|Antonios|Sotirios|Petros|Alexandros|Anastasios|Eleftherios|Tasos|Giannis',
    'Papadopoulos|Pappas|Georgiou|Dimitriou|Nikolaou|Konstantinou|Vasiliou|Ioannou|Karagiannis|Papanikolaou|Makris|Alexiou|Stavrou|Theodorou|Michailidis|Antoniou|Panagiotou|Chatzis|Karamanis|Theodorakis|Papadakis|Nikolaidis|Georgakopoulos|Spiliopoulos|Kotsias'],
  ar: ['Mohammed|Ahmad|Ali|Omar|Khalid|Youssef|Hassan|Ibrahim|Abdullah|Faisal|Mahmoud|Saud|Sultan|Nasser|Tariq|Karim|Hamza|Amin|Yassin|Bilal|Ayman|Adel|Wael|Rashid|Samir|Said|Majid|Zaid|Anas|Ismail',
    'Al-Harbi|Al-Qahtani|Al-Otaibi|Al-Shammari|Al-Ahmadi|Al-Ghamdi|Al-Zahrani|Al-Malki|El-Sayed|Abdelrahman|Abdelaziz|Ben Salah|Bouzid|El Amrani|Ben Nasser|El Kadiri|Mansour|Abbas|Haddad|Sabri|El-Masry|Farouk|Shoukry|Hamdi|Yahia|Ben Youssef|El Haddad|Boualem|Ben Amar|Ziyani'],
  fa: ['Ali|Mehdi|Reza|Hossein|Mohammad|Amir|Saeed|Masoud|Arash|Milad|Saman|Vahid|Ehsan|Karim|Omid|Farhad|Hamid|Navid|Majid|Abbas',
    'Mohammadi|Hosseini|Ahmadi|Rezaei|Karimi|Mousavi|Jafari|Rahimi|Heydari|Sadeghi|Hedayati|Najafi|Akbari|Taheri|Ebrahimi|Zolfaghari|Gholami|Bagheri|Moradi|Jamali'],
  af: ['Chidi|Emeka|Obinna|Nnamdi|Chiedu|Tunji|Ademola|Bayo|Seun|Kunle|Kofi|Kwame|Kwabena|Yaw|Kojo|Kwaku|Emmanuel|Samuel|Daniel|Peter|Joseph|Stephen|Isaac|Prince|Ibrahim|Musa|Usman|Abdullahi|Siddiq|Yusuf',
    'Okonkwo|Okoye|Nwachukwu|Eze|Obi|Adeyemi|Ogunde|Baba|Osei|Mensah|Asante|Acheampong|Addo|Appiah|Ofori|Danso|Amoah|Agyemang|Quartey|Okafor|Aku|Bello|Aliyu|Ebine|Onyebuchi|Azoku|Ogbu|Ike|Opare|Kuffour'],
  za: ['Sipho|Thabo|Mandla|Themba|Luso|Bandi|Teboho|Brian|Terrence|Percy|Ronwen|Siya|Luseko|Nkosi|Prince|Keith|Sibusiso|Luka|Mazi|Thamsanqa',
    'Nkosi|Zwane|Mahlangu|Ndebele|Mokoena|Dlamini|Mabuza|Ntuli|Masire|Khumalo|Sithole|Mathebe|Moshoeu|Ndlovu|Tshabalala|Maka|Pitela|Mbatha|Sibande|Kaba'],
  th: ['Somchai|Apiwat|Supachok|Nattapong|Kittipong|Weerapong|Chaiyapong|Thanawat|Suphon|Wichai|Sarit|Niphon|Worawut|Sittichai|Kongkrit|Poramin|Kritsada|Surachat|Phattara|Anon',
    'Chaiyawong|Suwannarat|Siripong|Chanthawong|Kaewkanya|Phongsawat|Rotchana|Wirot|Boonsom|Inthaphon|Charoensuk|Thongkaew|Sisamut|Kammani|Boonthawong|Arunsak|Suthisak|Phongprasoet|Chaisuk|Rattana'],
  vi: ['Van Nam|Duc Anh|Thanh Phuc|Van Khang|Quang Binh|Huy Hoang|Duc Long|Van Son|Tien Hung|Quoc Anh|Xuan Nam|Thanh Binh|Minh Duc|Hoai Nam|Duc Thanh|Van Trung|Tien Dong|Minh Tuan|Van Thanh|Thanh Long',
    'Nguyen|Nguyen|Nguyen|Tran|Tran|Le|Pham|Hoang|Phan|Vu|Dang|Bui|Do|Ho|Ngo|Duong|Ly'],
  id: ['Rizky|Andi|Budi|Agung|Riki|Haris|Fandi|Yakob|Daniel|Sadid|Wira|Dimas|Ramdan|Hari|Bagus|Ilhan|Teguh|Fajar|Rama|Yuda',
    'Prasetyo|Saputra|Wijaya|Hadi|Nugroho|Santoso|Kusuma|Setiawan|Hidayat|Haryanto|Wibowo|Susanto|Gunawan|Widianto|Maulana|Firmansyah|Rahmat|Sugiarto|Arifian|Hartono'],
  uz: ['Otabek|Jasur|Eldor|Aziz|Shohruh|Jahongir|Oston|Abror|Sardor|Behzod|Doston|Akmal|Umid|Rustam|Timur|Farrukh|Azizbek|Jamshid|Bakhtiyor|Isroil',
    'Karimov|Rashidov|Yusupov|Aliyev|Tursunov|Ergashev|Mahmudov|Saidov|Haydarov|Nazarov|Abdurahmonov|Ismailov|Safarov|Usmonov|Mirzayev|Khalilov|Tojiyev|Normatov|Shodiyev|Yuldashev'],
  hu: ['Bence|Máté|Dániel|Dominik|Ádám|Levente|Márton|Dávid|Zsolt|Attila|Ferenc|László|Gábor|István|Sándor|János|Tamás|Kristóf|Roland|Norbert|Balázs|Botond|Vilmos|Milán|Róbert',
    'Nagy|Kovács|Tóth|Szabó|Horváth|Varga|Kiss|Molnár|Németh|Farkas|Balogh|Papp|Takács|Juhász|Lakatos|Mészáros|Oláh|Simon|Rácz|Fekete|Szarka|Boros|Magyar|Szőke|Katona'],
  ro: ['Andrei|Alexandru|Ionuț|Mihai|Ștefan|Răzvan|Florin|Bogdan|Cristian|Marius|Darius|Cosmin|Gabriel|Adrian|Vlad|Nicolae|Sorin|Valentin|Ion|Ovidiu|Viorel|Robert|Daniel|Luca|Denis',
    'Popescu|Ionescu|Popa|Radu|Dinu|Stan|Stoica|Georgescu|Matei|Constantin|Șerban|Lupu|Mureșan|Tudor|Diaconu|Olteanu|Vasile|Marinescu|Niculescu|Cristea|Mitrea|Dumitru|Neagu|Ilie|Dobre']
};
// 영어 이름 순서: 한국·중국·베트남은 성 이름, 나머지는 이름 성
const EN_FAMILY_FIRST = new Set(['ko', 'zh', 'vi']);

// 해외 진출 선수 국적 가중치
const EXPORT_WEIGHTS = 'BRA:10 ARG:7 FRA:6 ESP:5 POR:4 ENG:3 GER:3 ITA:3 NED:3 BEL:2 CRO:2 SRB:2 URU:2 COL:2 NGA:3 GHA:2 MAR:2 ALG:1 EGY:1 TUN:1 ' +
  'JPN:2 KOR:2 USA:2 MEX:1 DEN:2 NOR:1 SWE:2 POL:2 CZE:1 AUT:1 SUI:1 TUR:1 GRE:1 UKR:1 RUS:1 ROU:1 HUN:1 CHI:1 PAR:1 ECU:1 ' +
  'PER:1 VEN:1 BOL:1 SCO:1 IRL:1 CAN:1 CRC:1 AUS:1 IRN:1 RSA:1 CHN:1 THA:1 VIE:1 IDN:1 UZB:1';

// --- 12단계 세계 확장: 새 나라 47개 (기존 58개국 뒤에 붙임). 모양은 COUNTRY_DATA와 같음 ---
const COUNTRY_DATA_2 = [
  ['CYP', '키프로스', '유럽', 'gr', 'GR', 59, [14, 16, 16, 16], '니코시아 리마솔 라르나카 파포스 파랄림니 스트로볼로스 아라디푸 라카타미아 아야나파 달리 라치아 입소나스 예르마소야 키티 페이아 폴리스 아크나 데리니아 소티라 리오페트리 크실로파구 오르미디아 아티에누 코키노트리미티아 에피스코피 콜로시 아카키 페리스테로나 드로몰락시아 키소네르가'],
  ['ISR', '이스라엘', '유럽', 'he', 'HE', 60, [14, 16, 16, 16], '텔아비브 예루살렘 하이파 베르셰바 네타냐 아슈도드 페타티크바 리숀레지온 홀론 라마트간 바트얌 헤르츨리야 크파르사바 라아나나 아슈켈론 레호보트 나사렛 아풀라 티베리아스 에일라트 키르야트시모나 나하리야 하데라 로드 라믈레 사크닌 아코 디모나 키르야트가트 예후드'],
  ['BUL', '불가리아', '유럽', 'bg', 'SLAV', 57, [16, 16, 16, 16], '소피아 플로브디프 바르나 부르가스 루세 스타라자고라 플레벤 슬리벤 도브리치 슈멘 페르니크 하스코보 얌볼 파자르지크 블라고에프그라드 벨리코투르노보 브라차 가브로보 비딘 몬타나 크르잘리 큐스텐딜 로베치 실리스트라 라즈그라드 스몰랸 사모코프 보테브그라드 포모리에 네세바르'],
  ['SVK', '슬로바키아', '유럽', 'sk', 'SLAV', 58, [12, 16, 16, 16], '브라티슬라바 코시체 프레쇼프 질리나 반스카비스트리차 니트라 트르나바 트렌친 마르틴 포프라트 프리에비자 즈볼렌 포바슈스카비스트리차 노베잠키 미할로우체 스피슈스카노바베스 코마르노 피에슈탸니 세니차 스칼리차 루좀베로크 두브니차 토폴차니 후메네 바르데요우 루체네츠 리마우스카소보타 두나이스카스트레다 갈란타 레보차'],
  ['SVN', '슬로베니아', '유럽', 'sl', 'SLAV', 57, [10, 16, 16, 16], '류블랴나 마리보르 첼레 크라니 코페르 벨레녜 노보메스토 프투이 트르보블레 캄니크 예세니체 노바고리차 돔잘레 무르스카소보타 슈코퓌아로카 이졸라 피란 포스토이나 로가슈카슬라티나 크르슈코 브레지체 슬로벤그라데츠 라도블리차 아이도프시치나 그로수플례 리티야 자고리예 코체비예 블레드'],
  ['BIH', '보스니아 헤르체고비나', '유럽', 'bs', 'SLAV', 56, [12, 16, 16, 16], '사라예보 바냐루카 투즐라 제니차 모스타르 비하치 브르치코 비옐리나 프리예도르 트라브니크 도보이 차진 고라주데 즈보르니크 리브노 비소코 그라차니차 루카바츠 시로키브리예그 차플리나 그라다차츠 테슬리치 브라투나츠 트레비녜 포차 야이체 코니츠 산스키모스트 부고이노 카칸'],
  ['MNE', '몬테네그로', '유럽', 'slav', 'SLAV', 50, [10, 10, 12, 12], '포드고리차 닉시치 헤르체그노비 플레블랴 비옐로폴레 체티녜 바르 베라네 부드바 울치니 티바트 코토르 로자예 다닐로브그라드 모이코바츠 플라브 콜라신 플루지네 안드리예비차 투지 골루보브치 자블랴크'],
  ['MKD', '북마케도니아', '유럽', 'mk', 'SLAV', 51, [12, 12, 14, 14], '스코페 비톨라 쿠마노보 프릴레프 테토보 벨레스 슈티프 오흐리드 고스티바르 스트루미차 카바다르치 코차니 키체보 스트루가 라도비시 게브겔리야 데바르 크리바팔랑카 스베티니콜레 네고티노 델체보 비니차 레센 프로비슈티프'],
  ['ALB', '알바니아', '유럽', 'sq', 'SQ', 52, [10, 14, 14, 14], '티라나 두러스 블로러 엘바산 슈코더르 피에르 코르처 베라트 루슈녜 포그라데츠 카버여 라치 쿠커스 레저 지로카스트라 사란더 파토스 페슈코피 부렐 크루여 테펠레너 퍼르메트'],
  ['FIN', '핀란드', '유럽', 'fi', 'FI', 55, [12, 10, 12, 12], '헬싱키 에스포 탐페레 반타 투르쿠 오울루 위베스퀼레 라티 쿠오피오 포리 코우볼라 요엔수 라펜란타 해멘린나 바사 세이내요키 로바니에미 미켈리 코트카 살로 포르보 코콜라 휘빙캐 라우마 야코브스타드 마리에함 케미 이살미'],
  ['ISL', '아이슬란드', '유럽', 'is', 'NORD', 53, [12, 12, 12, 12], '레이캬비크 코파보귀르 하프나르피외르뒤르 아퀴레이리 가르다바이르 모스펠스바이르 아크라네스 셀포스 케플라비크 그린다비크 베스트만나에이야르 이사피외르뒤르 사우다르크로퀴르 에이일스스타디르 후사비크 보르가르네스 크베라게르디 올라프스비크 달비크 세이디스피외르뒤르 회픈 시글뤼피외르뒤르 블뢴뒤오스 네스카우프스타뒤르'],
  ['FRO', '페로 제도', '유럽', 'nord', 'NORD', 46, [10, 10, 10, 10], '토르스하운 클락스비크 루나비크 트베로이리 바구르 푸글라피외르 산다바구르 미드바구르 쇠르바구르 에이디 괴타 콜라피외르 스코알리 토프티르 산두르 크발바 호위비크 아르기르 베스트만나 크비비크 레이르비크 비다레이디'],
  ['LUX', '룩셈부르크', '유럽', 'fr', 'FR', 50, [16, 14, 14, 14], '룩셈부르크 에슈쉬르알제트 디페르당주 뒤들랑주 에텔브뤼크 디키르히 빌츠 에히테르나흐 레미히 그레벤마허 메르슈 베르트랑주 슈트라센 에스페랑주 자넴 페탕주 카일 몽도르프 슈타인포르트 로당주 비센 클레르보 비안덴'],
  ['WAL', '웨일스', '유럽', 'cy', 'EN', 49, [12, 16, 16, 16], '카디프 스완지 뉴포트 렉섬 뱅거 애버리스트위스 발라 배리 브리젠드 카나번 카마던 콜윈베이 플린트 해버퍼드웨스트 란디드노 라넬리 머서티드빌 니스 뉴타운 폰티프리드 포트탤벗 릴 홀리헤드 프레스타틴 애먼퍼드 쿰브란 케어필리 몰드 버클리 웰시풀 에버베일'],
  ['NIR', '북아일랜드', '유럽', 'en', 'EN', 50, [12, 12, 14, 14], '벨파스트 데리 리즈번 뉴리 아마 뱅어 크레이개번 밸리미나 콜레인 란 캐릭퍼거스 포터다운 러건 던개넌 에니스킬런 오마 뉴타운애비 앤트림 밸리클레어 밴브리지 리머버디 쿡스타운 다운패트릭 스트라베인 할리우드 코머 매허러펠트 뉴타우너즈 밸리머니 포트스튜어트'],
  ['MLT', '몰타', '유럽', 'mt', 'EN', 47, [12, 14, 14, 14], '발레타 비르키르카라 모스타 코르미 자바르 슬리에마 산주안 낙사르 제이툰 라바트 함룬 마르사스칼라 프구라 제부지 스위에키 파올라 아타르드 비르제부자 타르시엔 그지라 멜리에하 마르사 플로리아나 시지에위 루카 주리에크 빅토리아 나두르 셰우키야'],
  ['EST', '에스토니아', '유럽', 'et', 'ET', 48, [10, 10, 10, 10], '탈린 타르투 나르바 패르누 코흐틀라예르베 빌리안디 라크베레 마르두 쿠레사레 실라매 발가 버루 이흐비 합살루 케일라 파이데 엘바 사우에 펄바 이게바 라플라'],
  ['LVA', '라트비아', '유럽', 'lv', 'LV', 51, [10, 10, 12, 12], '리가 다우가우필스 리에파야 옐가바 유르말라 벤츠필스 레제크네 발미에라 오그레 투쿰스 체시스 살라스필스 쿨디가 올라이네 사울크라스티 바우스카 시굴다 예카브필스 탈시 도벨레 크라슬라바 마도나'],
  ['LTU', '리투아니아', '유럽', 'lt', 'LT', 50, [10, 14, 14, 14], '빌뉴스 카우나스 클라이페다 샤울레이 파네베지스 알리투스 마리얌폴레 마제이케이 요나바 우테나 케다이니아이 텔셰이 타우라게 우크메르게 비사기나스 플룽게 크레팅가 팔랑가 라드빌리슈키스 드루스키닌카이 로키슈키스 비르자이 가르그주다이 엘렉트레나이'],
  ['BLR', '벨라루스', '유럽', 'ru', 'SLAV', 54, [16, 16, 14, 14], '민스크 호멜 마힐료우 비쳅스크 흐로드나 브레스트 바브루이스크 바라나비치 바리사우 핀스크 오르샤 마지르 살리호르스크 나바폴라츠크 말라제치나 폴라츠크 즐로빈 스베틀라호르스크 레치차 슬루츠크 조지나 슬로님 칼린카비치 스마르혼'],
  ['MDA', '몰도바', '유럽', 'ro', 'RO', 52, [10, 12, 12, 12], '키시너우 티라스폴 벌치 벤데르 르브니차 카훌 웅게니 소로카 오르헤이 콤라트 체아디르룽가 스트러셰니 커우셰니 드로키아 에디네츠 흔체슈티 플로레슈티 이알로베니 슨제레이 두버사리'],
  ['GEO', '조지아', '유럽', 'ka', 'KA', 55, [10, 10, 10, 16], '트빌리시 쿠타이시 바투미 루스타비 주그디디 고리 포티 삼트레디아 호니 텔라비 오주르게티 제스타포니 마르네울리 하슈리 세나키 치아투라 트키불리 보르조미 라고데히 아할치헤 카스피 므츠헤타 사가레조 시그나기'],
  ['ARM', '아르메니아', '유럽', 'hy', 'HY', 52, [10, 12, 12, 12], '예레반 귬리 바나조르 바가르샤파트 아보뱐 카판 흐라즈단 아르마비르 아르타샤트 이제반 고리스 차렌차반 아라라트 마시스 세반 아슈타라크 딜리잔 시시안 알라베르디 스테파나반 가바르 메그리'],
  ['AZE', '아제르바이잔', '유럽', 'az', 'TR', 56, [10, 12, 12, 12], '바쿠 간자 숨가이트 밍게체비르 시르반 나흐치반 셰키 렌케란 예블라흐 쿠바 가발라 샤마히 사비라바드 아그스타파 자가탈라 바르다 이미실리 살리안 괴이차이 마살리 아스타라 하치마스'],
  ['KAZ', '카자흐스탄', '유럽', 'kk', 'TR', 56, [14, 14, 14, 14], '알마티 아스타나 심켄트 카라간다 악토베 타라즈 파블로다르 외스케멘 세메이 아티라우 코스타나이 크즐로르다 오랄 페트로파블 악타우 테미르타우 투르키스탄 콕셰타우 탈디코르간 에키바스투즈 루드니 자나오젠 발하시 제즈카즈간'],
  ['IND', '인도', '아시아·오세아니아', 'in', 'EN', 50, [12, 12, 14, 14], '콜카타 뭄바이 벵갈루루 첸나이 델리 파나지 마르가오 바스코다가마 코치 하이데라바드 잠셰드푸르 구와하티 실롱 임팔 아이자울 푸네 아마다바드 러크나우 코지코드 트리반드룸 루디아나 찬디가르 부바네스와르 란치 나그푸르 인도르 자이푸르 마두라이 코임바토르 비샤카파트남'],
  ['MAS', '말레이시아', '아시아·오세아니아', 'ms', 'EN', 50, [14, 14, 16, 16], '쿠알라룸푸르 조호르바루 이포 조지타운 쿠칭 코타키나발루 샤알람 클랑 프탈링자야 믈라카 콴탄 알로르스타르 코타바루 쿠알라트렝가누 스렘반 미리 산다칸 타와우 시부 바투파핫 무아르 캉가르 테메를로 타이핑 슬라양 카장 수방자야 세팡'],
  ['SGP', '싱가포르', '아시아·오세아니아', 'ms', 'EN', 46, [10, 10, 10, 10], '탐피니스 주롱 우드랜즈 셍캉 펑골 호우강 비샨 앙모키오 토아파요 베독 클레멘티 이슌 셈바왕 부킷바톡 부킷판장 초아추캉 파시르리스 게일랑 칼랑 퀸스타운 마린퍼레이드 부킷메라'],
  ['IRQ', '이라크', '아시아·오세아니아', 'ar', 'AR', 55, [20, 20, 16, 16], '바그다드 바스라 모술 아르빌 술라이마니야 나자프 카르발라 나시리야 키르쿠크 두호크 힐라 라마디 쿠트 디와니야 아마라 바쿠바 팔루자 사마와 사마라 자호 티크리트 쿠파 할라브자 하디사 움카스르 주바이르 탈아파르'],
  ['JOR', '요르단', '아시아·오세아니아', 'ar', 'AR', 54, [12, 14, 14, 14], '암만 자르카 이르비드 루사이파 아카바 마다바 살트 마프라크 제라시 아즐룬 카라크 타필라 마안 람사 사하브 와디무사 데이르알라 수웨일레 나우르 쿠프란자'],
  ['OMA', '오만', '아시아·오세아니아', 'ar', 'AR', 51, [14, 14, 14, 14], '무스카트 살랄라 소하르 니즈와 수르 이브리 바르카 루스타크 부라이미 사함 바우샤르 시브 이브라 무트라 카부라 수와이크 이즈키 바흘라 아담 하이마 두큼'],
  ['KUW', '쿠웨이트', '아시아·오세아니아', 'ar', 'AR', 51, [10, 10, 10, 10], '쿠웨이트시티 하왈리 살미야 자흐라 파르와니야 아흐마디 무바라크알카비르 파하힐 카이탄 사바히야 망가프 피르두스 리가이 술라이비야 아르디야 와프라'],
  ['BHR', '바레인', '아시아·오세아니아', 'ar', 'AR', 50, [10, 10, 10, 10], '마나마 무하라크 리파 이사타운 하마드타운 시트라 부다이야 지드하프스 아왈리 디라즈 말키야 사르 투블리 주페어'],
  ['NZL', '뉴질랜드', '아시아·오세아니아', 'en', 'EN', 50, [10, 10, 12, 12], '오클랜드 웰링턴 크라이스트처치 해밀턴 타우랑가 더니든 파머스턴노스 넬슨 네이피어 로토루아 뉴플리머스 팡가레이 인버카길 왕가누이 기즈번 헤이스팅스 어퍼허트 로어허트 포리루아 퀸스타운 티마루 블레넘 매스터턴 레빈'],
  ['SEN', '세네갈', '아프리카', 'wa', 'FR', 55, [14, 14, 16, 16], '다카르 투바 티에스 카올락 생루이 지갱쇼르 음부르 디우르벨 루가 탐바쿤다 콜다 카프린 피킨 뤼피스크 게디아웨 리샤르톨 티바완 마탐 세디우 케두구 포도르 음바케 파티크 조알'],
  ['CIV', '코트디부아르', '아프리카', 'ci', 'FR', 55, [14, 16, 16, 16], '아비장 야무수크로 부아케 달로아 산페드로 코로고 만 가냐 디보 세겔라 본두쿠 오디엔네 그랑바상 아부아소 아냐마 뱅제르빌 수브레 다나네 기글로 카티올라 부나 아디아케 티아살레 아그보빌'],
  ['CMR', '카메룬', '아프리카', 'ci', 'FR', 54, [18, 16, 16, 16], '두알라 야운데 가루아 바멘다 마루아 바푸삼 응가운데레 베르투아 림베 에데아 쿰바 은콩삼바 부에아 에볼로와 쿠세리 크리비 상멜리마 품반 드샹 음발마요 바피아 음부다 바팡 기데르'],
  ['MLI', '말리', '아프리카', 'wa', 'FR', 52, [16, 16, 16, 16], '바마코 시카소 몹티 쿠티알라 카예스 세구 가오 팀북투 키달 산 부구니 칼라반코로 카티 니오노 젠네 마르칼라 키타 니오로 쿨리코로 바풀라베 두엔차 반디아가라 케니에바'],
  ['KEN', '케냐', '아프리카', 'ea', 'EN', 49, [18, 18, 16, 16], '나이로비 몸바사 키수무 나쿠루 엘도레트 티카 말린디 키탈레 가리사 카카메가 니에리 마차코스 메루 키시 부시아 나이바샤 케리초 엠부 키투이 와지르 라무 카지아도 무랑가 붕고마 호마베이 미고리 난유키'],
  ['COD', '콩고민주공화국', '아프리카', 'cd', 'FR', 54, [16, 16, 16, 16], '킨샤사 루붐바시 음부지마이 키상가니 마타디 카낭가 리카시 콜웨지 고마 부카부 음반다카 반둔두 킥위트 부니아 우비라 칼레미 보마 베니 부템보 게메나 이시로 무안다 킨두 치카파'],
  ['ANG', '앙골라', '아프리카', 'pt', 'PT', 51, [16, 16, 16, 16], '루안다 우암부 로비투 벵겔라 쿠이투 루방구 말란즈 나미브 소유 카빈다 우이즈 사우리무 숨브 온지바 메농그 루에나 둔두 은달라탄두 카쿠아쿠 비아나 카툼벨라 카젱가 카마쿠파 카샤'],
  ['ZAM', '잠비아', '아프리카', 'zm', 'EN', 51, [18, 16, 16, 16], '루사카 키트웨 은돌라 카브웨 칭골라 무풀리라 리빙스턴 루안샤 카사마 치파타 몽구 솔웨지 마자부카 초마 은첼렝게 만사 페타우케 몬제 카피리음포시 칼로모 시아봉가 음피카 이소카 칠랑가'],
  ['HON', '온두라스', '북중미', 'es', 'ES', 53, [10, 10, 12, 12], '테구시갈파 산페드로술라 라세이바 촐루테카 코마야과 엘프로그레소 촐로마 단리 시과테페케 후티칼파 푸에르토코르테스 라리마 비야누에바 텔라 산타로사데코판 토코아 오모아 나카오메 카타카마스 라파스 산로렌소 그라시아스'],
  ['GUA', '과테말라', '북중미', 'es', 'ES', 50, [12, 12, 14, 14], '과테말라시티 케찰테낭고 에스킨틀라 믹스코 비야누에바 코반 마사테낭고 치말테낭고 푸에르토바리오스 레탈룰레우 후티아파 할라파 치키물라 살라마 솔롤라 토토니카판 우에우에테낭고 안티과 산마르코스 사카파 플로레스 코아테페케 아마티틀란 산타루시아'],
  ['PAN', '파나마', '북중미', 'es', 'ES', 52, [10, 12, 12, 12], '파나마시티 콜론 다비드 산미겔리토 라초레라 아라이한 산티아고 치트레 라스타블라스 페노노메 아과둘세 보케테 알미란테 창기놀라 차메 안톤 나타 소나'],
  ['SLV', '엘살바도르', '북중미', 'es', 'ES', 49, [12, 10, 12, 12], '산살바도르 산타아나 산미겔 소야팡고 산타테클라 아포파 메히카노스 델가도 아우아차판 우술루탄 손소나테 코후테페케 찰라테낭고 라우니온 일로팡고 산비센테 수치토토 라리베르타드 메타판 아카후틀라'],
  ['JAM', '자메이카', '북중미', 'en', 'EN', 50, [14, 12, 12, 12], '킹스턴 몬테고베이 스패니시타운 포트모어 메이펜 맨더빌 오초리오스 포트앤토니오 모런트베이 블랙리버 사바나라마 팰머스 린스테드 올드하버 크리스티애나 포트마리아 브라운스타운 산타크루스 루시 스튜어트타운']
];
// 새 나라 영어: [영어 이름, 도시]
const COUNTRY_EN_2 = {
  CYP: ['Cyprus', 'Nicosia|Limassol|Larnaca|Paphos|Paralimni|Strovolos|Aradippou|Lakatamia|Ayia Napa|Dali|Latsia|Ypsonas|Germasogeia|Kiti|Peyia|Polis|Achna|Deryneia|Sotira|Liopetri|Xylofagou|Ormideia|Athienou|Kokkinotrimithia|Episkopi|Kolossi|Akaki|Peristerona|Dromolaxia|Kissonerga'],
  ISR: ['Israel', 'Tel Aviv|Jerusalem|Haifa|Beersheba|Netanya|Ashdod|Petah Tikva|Rishon LeZion|Holon|Ramat Gan|Bat Yam|Herzliya|Kfar Saba|Raanana|Ashkelon|Rehovot|Nazareth|Afula|Tiberias|Eilat|Kiryat Shmona|Nahariya|Hadera|Lod|Ramla|Sakhnin|Acre|Dimona|Kiryat Gat|Yehud'],
  BUL: ['Bulgaria', 'Sofia|Plovdiv|Varna|Burgas|Ruse|Stara Zagora|Pleven|Sliven|Dobrich|Shumen|Pernik|Haskovo|Yambol|Pazardzhik|Blagoevgrad|Veliko Tarnovo|Vratsa|Gabrovo|Vidin|Montana|Kardzhali|Kyustendil|Lovech|Silistra|Razgrad|Smolyan|Samokov|Botevgrad|Pomorie|Nesebar'],
  SVK: ['Slovakia', 'Bratislava|Košice|Prešov|Žilina|Banská Bystrica|Nitra|Trnava|Trenčín|Martin|Poprad|Prievidza|Zvolen|Považská Bystrica|Nové Zámky|Michalovce|Spišská Nová Ves|Komárno|Piešťany|Senica|Skalica|Ružomberok|Dubnica|Topoľčany|Humenné|Bardejov|Lučenec|Rimavská Sobota|Dunajská Streda|Galanta|Levoča'],
  SVN: ['Slovenia', 'Ljubljana|Maribor|Celje|Kranj|Koper|Velenje|Novo Mesto|Ptuj|Trbovlje|Kamnik|Jesenice|Nova Gorica|Domžale|Murska Sobota|Škofja Loka|Izola|Piran|Postojna|Rogaška Slatina|Krško|Brežice|Slovenj Gradec|Radovljica|Ajdovščina|Grosuplje|Litija|Zagorje|Kočevje|Bled'],
  BIH: ['Bosnia and Herzegovina', 'Sarajevo|Banja Luka|Tuzla|Zenica|Mostar|Bihać|Brčko|Bijeljina|Prijedor|Travnik|Doboj|Cazin|Goražde|Zvornik|Livno|Visoko|Gračanica|Lukavac|Široki Brijeg|Čapljina|Gradačac|Teslić|Bratunac|Trebinje|Foča|Jajce|Konjic|Sanski Most|Bugojno|Kakanj'],
  MNE: ['Montenegro', 'Podgorica|Nikšić|Herceg Novi|Pljevlja|Bijelo Polje|Cetinje|Bar|Berane|Budva|Ulcinj|Tivat|Kotor|Rožaje|Danilovgrad|Mojkovac|Plav|Kolašin|Plužine|Andrijevica|Tuzi|Golubovci|Žabljak'],
  MKD: ['North Macedonia', 'Skopje|Bitola|Kumanovo|Prilep|Tetovo|Veles|Štip|Ohrid|Gostivar|Strumica|Kavadarci|Kočani|Kičevo|Struga|Radoviš|Gevgelija|Debar|Kriva Palanka|Sveti Nikole|Negotino|Delčevo|Vinica|Resen|Probištip'],
  ALB: ['Albania', 'Tirana|Durrës|Vlorë|Elbasan|Shkodër|Fier|Korçë|Berat|Lushnjë|Pogradec|Kavajë|Laç|Kukës|Lezhë|Gjirokastër|Sarandë|Patos|Peshkopi|Burrel|Krujë|Tepelenë|Përmet'],
  FIN: ['Finland', 'Helsinki|Espoo|Tampere|Vantaa|Turku|Oulu|Jyväskylä|Lahti|Kuopio|Pori|Kouvola|Joensuu|Lappeenranta|Hämeenlinna|Vaasa|Seinäjoki|Rovaniemi|Mikkeli|Kotka|Salo|Porvoo|Kokkola|Hyvinkää|Rauma|Jakobstad|Mariehamn|Kemi|Iisalmi'],
  ISL: ['Iceland', 'Reykjavík|Kópavogur|Hafnarfjörður|Akureyri|Garðabær|Mosfellsbær|Akranes|Selfoss|Keflavík|Grindavík|Vestmannaeyjar|Ísafjörður|Sauðárkrókur|Egilsstaðir|Húsavík|Borgarnes|Hveragerði|Ólafsvík|Dalvík|Seyðisfjörður|Höfn|Siglufjörður|Blönduós|Neskaupstaður'],
  FRO: ['Faroe Islands', 'Tórshavn|Klaksvík|Runavík|Tvøroyri|Vágur|Fuglafjørður|Sandavágur|Miðvágur|Sørvágur|Eiði|Gøta|Kollafjørður|Skáli|Toftir|Sandur|Hvalba|Hoyvík|Argir|Vestmanna|Kvívík|Leirvík|Viðareiði'],
  LUX: ['Luxembourg', 'Luxembourg|Esch-sur-Alzette|Differdange|Dudelange|Ettelbruck|Diekirch|Wiltz|Echternach|Remich|Grevenmacher|Mersch|Bertrange|Strassen|Hesperange|Sanem|Pétange|Kayl|Mondorf|Steinfort|Rodange|Bissen|Clervaux|Vianden'],
  WAL: ['Wales', 'Cardiff|Swansea|Newport|Wrexham|Bangor|Aberystwyth|Bala|Barry|Bridgend|Caernarfon|Carmarthen|Colwyn Bay|Flint|Haverfordwest|Llandudno|Llanelli|Merthyr Tydfil|Neath|Newtown|Pontypridd|Port Talbot|Rhyl|Holyhead|Prestatyn|Ammanford|Cwmbran|Caerphilly|Mold|Buckley|Welshpool|Ebbw Vale'],
  NIR: ['Northern Ireland', 'Belfast|Derry|Lisburn|Newry|Armagh|Bangor|Craigavon|Ballymena|Coleraine|Larne|Carrickfergus|Portadown|Lurgan|Dungannon|Enniskillen|Omagh|Newtownabbey|Antrim|Ballyclare|Banbridge|Limavady|Cookstown|Downpatrick|Strabane|Holywood|Comber|Magherafelt|Newtownards|Ballymoney|Portstewart'],
  MLT: ['Malta', 'Valletta|Birkirkara|Mosta|Qormi|Żabbar|Sliema|San Ġwann|Naxxar|Żejtun|Rabat|Ħamrun|Marsaskala|Fgura|Żebbuġ|Swieqi|Paola|Attard|Birżebbuġa|Tarxien|Gżira|Mellieħa|Marsa|Floriana|Siġġiewi|Luqa|Żurrieq|Victoria|Nadur|Xewkija'],
  EST: ['Estonia', 'Tallinn|Tartu|Narva|Pärnu|Kohtla-Järve|Viljandi|Rakvere|Maardu|Kuressaare|Sillamäe|Valga|Võru|Jõhvi|Haapsalu|Keila|Paide|Elva|Saue|Põlva|Jõgeva|Rapla'],
  LVA: ['Latvia', 'Riga|Daugavpils|Liepāja|Jelgava|Jūrmala|Ventspils|Rēzekne|Valmiera|Ogre|Tukums|Cēsis|Salaspils|Kuldīga|Olaine|Saulkrasti|Bauska|Sigulda|Jēkabpils|Talsi|Dobele|Krāslava|Madona'],
  LTU: ['Lithuania', 'Vilnius|Kaunas|Klaipėda|Šiauliai|Panevėžys|Alytus|Marijampolė|Mažeikiai|Jonava|Utena|Kėdainiai|Telšiai|Tauragė|Ukmergė|Visaginas|Plungė|Kretinga|Palanga|Radviliškis|Druskininkai|Rokiškis|Biržai|Gargždai|Elektrėnai'],
  BLR: ['Belarus', 'Minsk|Gomel|Mogilev|Vitebsk|Grodno|Brest|Bobruisk|Baranovichi|Borisov|Pinsk|Orsha|Mozyr|Soligorsk|Novopolotsk|Molodechno|Polotsk|Zhlobin|Svetlogorsk|Rechitsa|Slutsk|Zhodino|Slonim|Kalinkovichi|Smorgon'],
  MDA: ['Moldova', 'Chișinău|Tiraspol|Bălți|Bender|Rîbnița|Cahul|Ungheni|Soroca|Orhei|Comrat|Ceadîr-Lunga|Strășeni|Căușeni|Drochia|Edineț|Hîncești|Florești|Ialoveni|Sîngerei|Dubăsari'],
  GEO: ['Georgia', 'Tbilisi|Kutaisi|Batumi|Rustavi|Zugdidi|Gori|Poti|Samtredia|Khoni|Telavi|Ozurgeti|Zestaponi|Marneuli|Khashuri|Senaki|Chiatura|Tkibuli|Borjomi|Lagodekhi|Akhaltsikhe|Kaspi|Mtskheta|Sagarejo|Sighnaghi'],
  ARM: ['Armenia', 'Yerevan|Gyumri|Vanadzor|Vagharshapat|Abovyan|Kapan|Hrazdan|Armavir|Artashat|Ijevan|Goris|Charentsavan|Ararat|Masis|Sevan|Ashtarak|Dilijan|Sisian|Alaverdi|Stepanavan|Gavar|Meghri'],
  AZE: ['Azerbaijan', 'Baku|Ganja|Sumgait|Mingachevir|Shirvan|Nakhchivan|Shaki|Lankaran|Yevlakh|Quba|Gabala|Shamakhi|Sabirabad|Agstafa|Zaqatala|Barda|Imishli|Salyan|Goychay|Masally|Astara|Khachmaz'],
  KAZ: ['Kazakhstan', 'Almaty|Astana|Shymkent|Karaganda|Aktobe|Taraz|Pavlodar|Oskemen|Semey|Atyrau|Kostanay|Kyzylorda|Oral|Petropavl|Aktau|Temirtau|Turkistan|Kokshetau|Taldykorgan|Ekibastuz|Rudny|Zhanaozen|Balkhash|Zhezkazgan'],
  IND: ['India', 'Kolkata|Mumbai|Bengaluru|Chennai|Delhi|Panaji|Margao|Vasco da Gama|Kochi|Hyderabad|Jamshedpur|Guwahati|Shillong|Imphal|Aizawl|Pune|Ahmedabad|Lucknow|Kozhikode|Trivandrum|Ludhiana|Chandigarh|Bhubaneswar|Ranchi|Nagpur|Indore|Jaipur|Madurai|Coimbatore|Visakhapatnam'],
  MAS: ['Malaysia', 'Kuala Lumpur|Johor Bahru|Ipoh|George Town|Kuching|Kota Kinabalu|Shah Alam|Klang|Petaling Jaya|Malacca|Kuantan|Alor Setar|Kota Bharu|Kuala Terengganu|Seremban|Miri|Sandakan|Tawau|Sibu|Batu Pahat|Muar|Kangar|Temerloh|Taiping|Selayang|Kajang|Subang Jaya|Sepang'],
  SGP: ['Singapore', 'Tampines|Jurong|Woodlands|Sengkang|Punggol|Hougang|Bishan|Ang Mo Kio|Toa Payoh|Bedok|Clementi|Yishun|Sembawang|Bukit Batok|Bukit Panjang|Choa Chu Kang|Pasir Ris|Geylang|Kallang|Queenstown|Marine Parade|Bukit Merah'],
  IRQ: ['Iraq', 'Baghdad|Basra|Mosul|Erbil|Sulaymaniyah|Najaf|Karbala|Nasiriyah|Kirkuk|Duhok|Hillah|Ramadi|Kut|Diwaniyah|Amarah|Baqubah|Fallujah|Samawah|Samarra|Zakho|Tikrit|Kufa|Halabja|Haditha|Umm Qasr|Zubair|Tal Afar'],
  JOR: ['Jordan', 'Amman|Zarqa|Irbid|Russeifa|Aqaba|Madaba|Salt|Mafraq|Jerash|Ajloun|Karak|Tafilah|Maan|Ramtha|Sahab|Wadi Musa|Deir Alla|Sweileh|Naur|Kufranja'],
  OMA: ['Oman', 'Muscat|Salalah|Sohar|Nizwa|Sur|Ibri|Barka|Rustaq|Buraimi|Saham|Bawshar|Seeb|Ibra|Muttrah|Khabourah|Suwaiq|Izki|Bahla|Adam|Haima|Duqm'],
  KUW: ['Kuwait', 'Kuwait City|Hawalli|Salmiya|Jahra|Farwaniya|Ahmadi|Mubarak Al-Kabeer|Fahaheel|Khaitan|Sabahiya|Mangaf|Firdous|Riggae|Sulaibiya|Ardiya|Wafra'],
  BHR: ['Bahrain', 'Manama|Muharraq|Riffa|Isa Town|Hamad Town|Sitra|Budaiya|Jidhafs|Awali|Diraz|Malkiya|Saar|Tubli|Juffair'],
  NZL: ['New Zealand', 'Auckland|Wellington|Christchurch|Hamilton|Tauranga|Dunedin|Palmerston North|Nelson|Napier|Rotorua|New Plymouth|Whangarei|Invercargill|Whanganui|Gisborne|Hastings|Upper Hutt|Lower Hutt|Porirua|Queenstown|Timaru|Blenheim|Masterton|Levin'],
  SEN: ['Senegal', 'Dakar|Touba|Thiès|Kaolack|Saint-Louis|Ziguinchor|Mbour|Diourbel|Louga|Tambacounda|Kolda|Kaffrine|Pikine|Rufisque|Guédiawaye|Richard-Toll|Tivaouane|Matam|Sédhiou|Kédougou|Podor|Mbacké|Fatick|Joal'],
  CIV: ['Ivory Coast', 'Abidjan|Yamoussoukro|Bouaké|Daloa|San-Pédro|Korhogo|Man|Gagnoa|Divo|Séguéla|Bondoukou|Odienné|Grand-Bassam|Aboisso|Anyama|Bingerville|Soubré|Danané|Guiglo|Katiola|Bouna|Adiaké|Tiassalé|Agboville'],
  CMR: ['Cameroon', 'Douala|Yaoundé|Garoua|Bamenda|Maroua|Bafoussam|Ngaoundéré|Bertoua|Limbe|Edéa|Kumba|Nkongsamba|Buea|Ebolowa|Kousséri|Kribi|Sangmélima|Foumban|Dschang|Mbalmayo|Bafia|Mbouda|Bafang|Guider'],
  MLI: ['Mali', 'Bamako|Sikasso|Mopti|Koutiala|Kayes|Ségou|Gao|Timbuktu|Kidal|San|Bougouni|Kalaban Coro|Kati|Niono|Djenné|Markala|Kita|Nioro|Koulikoro|Bafoulabé|Douentza|Bandiagara|Kéniéba'],
  KEN: ['Kenya', 'Nairobi|Mombasa|Kisumu|Nakuru|Eldoret|Thika|Malindi|Kitale|Garissa|Kakamega|Nyeri|Machakos|Meru|Kisii|Busia|Naivasha|Kericho|Embu|Kitui|Wajir|Lamu|Kajiado|Muranga|Bungoma|Homa Bay|Migori|Nanyuki'],
  COD: ['DR Congo', 'Kinshasa|Lubumbashi|Mbuji-Mayi|Kisangani|Matadi|Kananga|Likasi|Kolwezi|Goma|Bukavu|Mbandaka|Bandundu|Kikwit|Bunia|Uvira|Kalemie|Boma|Beni|Butembo|Gemena|Isiro|Muanda|Kindu|Tshikapa'],
  ANG: ['Angola', 'Luanda|Huambo|Lobito|Benguela|Kuito|Lubango|Malanje|Namibe|Soyo|Cabinda|Uíge|Saurimo|Sumbe|Ondjiva|Menongue|Luena|Dundo|Ndalatando|Cacuaco|Viana|Catumbela|Cazenga|Camacupa|Caxito'],
  ZAM: ['Zambia', 'Lusaka|Kitwe|Ndola|Kabwe|Chingola|Mufulira|Livingstone|Luanshya|Kasama|Chipata|Mongu|Solwezi|Mazabuka|Choma|Nchelenge|Mansa|Petauke|Monze|Kapiri Mposhi|Kalomo|Siavonga|Mpika|Isoka|Chilanga'],
  HON: ['Honduras', 'Tegucigalpa|San Pedro Sula|La Ceiba|Choluteca|Comayagua|El Progreso|Choloma|Danlí|Siguatepeque|Juticalpa|Puerto Cortés|La Lima|Villanueva|Tela|Santa Rosa de Copán|Tocoa|Omoa|Nacaome|Catacamas|La Paz|San Lorenzo|Gracias'],
  GUA: ['Guatemala', 'Guatemala City|Quetzaltenango|Escuintla|Mixco|Villa Nueva|Cobán|Mazatenango|Chimaltenango|Puerto Barrios|Retalhuleu|Jutiapa|Jalapa|Chiquimula|Salamá|Sololá|Totonicapán|Huehuetenango|Antigua|San Marcos|Zacapa|Flores|Coatepeque|Amatitlán|Santa Lucía'],
  PAN: ['Panama', 'Panama City|Colón|David|San Miguelito|La Chorrera|Arraiján|Santiago|Chitré|Las Tablas|Penonomé|Aguadulce|Boquete|Almirante|Changuinola|Chame|Antón|Natá|Soná'],
  SLV: ['El Salvador', 'San Salvador|Santa Ana|San Miguel|Soyapango|Santa Tecla|Apopa|Mejicanos|Delgado|Ahuachapán|Usulután|Sonsonate|Cojutepeque|Chalatenango|La Unión|Ilopango|San Vicente|Suchitoto|La Libertad|Metapán|Acajutla'],
  JAM: ['Jamaica', 'Kingston|Montego Bay|Spanish Town|Portmore|May Pen|Mandeville|Ocho Rios|Port Antonio|Morant Bay|Black River|Savanna-la-Mar|Falmouth|Linstead|Old Harbour|Christiana|Port Maria|Browns Town|Santa Cruz|Lucea|Stewart Town']
};
// 기존 나라에 더하는 부(팀 수)와 그 부 구단에 먼저 쓰는 작은 도시 [한국어, 영어] (5대 리그는 6부까지, 나머지는 4부까지)
const MORE_TIERS = {
  ENG: [[24, 24], '스티버니지 크롤리 바넷 대거넘 그림즈비 스컨소프 게이츠헤드 하틀풀 달링턴 체스터필드 매클스필드 키더민스터 헤리퍼드 토키 요빌 워킹 메이드스톤 올더숏 이스틀리 올트링엄 사우스포트 촐리 탬워스 케터링 게인즈버러 벅스턴 스페니무어 블라이스 워킹턴 켄들 랭커스터 텔퍼드 슈루즈베리 글로스터 첼트넘 웨이머스 트루로 첼름스퍼드 다트퍼드 브롬리 서턴 질링엄 크루 로치데일 올덤 모어캠 맨스필드 링컨 돈캐스터 반즐리 허더즈필드 브래드퍼드 스톡포트 월솔 콜체스터 샐퍼드', 'Stevenage|Crawley|Barnet|Dagenham|Grimsby|Scunthorpe|Gateshead|Hartlepool|Darlington|Chesterfield|Macclesfield|Kidderminster|Hereford|Torquay|Yeovil|Woking|Maidstone|Aldershot|Eastleigh|Altrincham|Southport|Chorley|Tamworth|Kettering|Gainsborough|Buxton|Spennymoor|Blyth|Workington|Kendal|Lancaster|Telford|Shrewsbury|Gloucester|Cheltenham|Weymouth|Truro|Chelmsford|Dartford|Bromley|Sutton|Gillingham|Crewe|Rochdale|Oldham|Morecambe|Mansfield|Lincoln|Doncaster|Barnsley|Huddersfield|Bradford|Stockport|Walsall|Colchester|Salford'],
  ESP: [[20, 20], '폰페라다 루고 오렌세 페롤 폰테베드라 산티아고데콤포스텔라 아빌레스 랑그레오 토렐라베가 로그로뇨 비토리아 에이바르 이룬 투델라 소리아 세고비아 아빌라 사모라 레온 팔렌시아 탈라베라 카세레스 메리다 리나레스 하엔 우베다 알헤시라스 마르베야 헤레스 세우타 멜리야 로르카 카르타헤나 알바세테 쿠엥카 테루엘 레우스 사바델 테라사 바달로나 만레사 이비사 엘다 알코이 간디아', 'Ponferrada|Lugo|Ourense|Ferrol|Pontevedra|Santiago de Compostela|Avilés|Langreo|Torrelavega|Logroño|Vitoria|Eibar|Irún|Tudela|Soria|Segovia|Ávila|Zamora|León|Palencia|Talavera|Cáceres|Mérida|Linares|Jaén|Úbeda|Algeciras|Marbella|Jerez|Ceuta|Melilla|Lorca|Cartagena|Albacete|Cuenca|Teruel|Reus|Sabadell|Terrassa|Badalona|Manresa|Ibiza|Elda|Alcoy|Gandía'],
  GER: [[18, 18, 18], '겔젠키르헨 묀헨글라트바흐 볼프스부르크 레버쿠젠 진스하임 퓌르트 잉골슈타트 잔트하우젠 하이덴하임 다름슈타트 오펜바흐 카셀 에르푸르트 예나 켐니츠 츠비카우 마그데부르크 할레 코트부스 포츠담 뤼베크 올덴부르크 메펜 뮌스터 페를 부퍼탈 오버하우젠 크레펠트 뒤렌 코블렌츠 트리어 자르브뤼켄 홈부르크 피르마젠스 카이저슬라우테른 울름 알렌 로이틀링겐 포르츠하임 운터하힝 부르크하우젠 뷔르츠부르크 슈바인푸르트 바이로이트 밤베르크 호프 파사우 로젠하임 메밍겐 켐프텐 기센 풀다 함 지겐 리프슈타트 노르데르슈테트 플렌스부르크 노이뮌스터 힐데스하임 괴팅겐', 'Gelsenkirchen|Mönchengladbach|Wolfsburg|Leverkusen|Sinsheim|Fürth|Ingolstadt|Sandhausen|Heidenheim|Darmstadt|Offenbach|Kassel|Erfurt|Jena|Chemnitz|Zwickau|Magdeburg|Halle|Cottbus|Potsdam|Lübeck|Oldenburg|Meppen|Münster|Verl|Wuppertal|Oberhausen|Krefeld|Düren|Koblenz|Trier|Saarbrücken|Homburg|Pirmasens|Kaiserslautern|Ulm|Aalen|Reutlingen|Pforzheim|Unterhaching|Burghausen|Würzburg|Schweinfurt|Bayreuth|Bamberg|Hof|Passau|Rosenheim|Memmingen|Kempten|Gießen|Fulda|Hamm|Siegen|Lippstadt|Norderstedt|Flensburg|Neumünster|Hildesheim|Göttingen'],
  ITA: [[20, 20, 20], '아스콜리 아벨리노 베네벤토 카탄차로 코센차 크로토네 포자 타란토 포텐차 마테라 브린디시 안드리아 바를레타 트라파니 시라쿠사 라구사 아그리젠토 사사리 올비아 테르니 아레초 시에나 루카 프라토 피스토이아 엠폴리 카라라 리미니 체세나 포를리 라벤나 페라라 레조에밀리아 피아첸차 만토바 레코 몬차 바레세 노바라 알레산드리아 베르첼리 쿠네오 아스티 비엘라 사보나 산레모 트레비소 바사노 트렌토 볼차노 포르데노네 사수올로 카르피 프로시노네 라티나 비테르보 테라모 키에티 캄포바소 카세르타 구비오 페르모 마체라타 페사로', 'Ascoli|Avellino|Benevento|Catanzaro|Cosenza|Crotone|Foggia|Taranto|Potenza|Matera|Brindisi|Andria|Barletta|Trapani|Siracusa|Ragusa|Agrigento|Sassari|Olbia|Terni|Arezzo|Siena|Lucca|Prato|Pistoia|Empoli|Carrara|Rimini|Cesena|Forlì|Ravenna|Ferrara|Reggio Emilia|Piacenza|Mantova|Lecco|Monza|Varese|Novara|Alessandria|Vercelli|Cuneo|Asti|Biella|Savona|Sanremo|Treviso|Bassano|Trento|Bolzano|Pordenone|Sassuolo|Carpi|Frosinone|Latina|Viterbo|Teramo|Chieti|Campobasso|Caserta|Gubbio|Fermo|Macerata|Pesaro'],
  FRA: [[16, 16, 16], '랑스 갱강 반 캥페르 라발 니오르 푸아티에 라로셸 앙굴렘 포 바욘 페르피냥 베지에 세트 아비뇽 아를 마르티그 오바뉴 칸 앙티브 프레쥐스 아작시오 바스티아 안시 샹베리 발랑스 부르캉브레스 빌프랑슈 로안 로데즈 알비 샤토루 오를레앙 샤르트르 루앙 셰르부르 됭케르크 불로뉴 칼레 발랑시엔 보베 크레테유 베르사유 스당 에피날 뮐루즈 콜마르 벨포르 브장송 소쇼 트루아', 'Lens|Guingamp|Vannes|Quimper|Laval|Niort|Poitiers|La Rochelle|Angoulême|Pau|Bayonne|Perpignan|Béziers|Sète|Avignon|Arles|Martigues|Aubagne|Cannes|Antibes|Fréjus|Ajaccio|Bastia|Annecy|Chambéry|Valence|Bourg-en-Bresse|Villefranche|Roanne|Rodez|Albi|Châteauroux|Orléans|Chartres|Rouen|Cherbourg|Dunkerque|Boulogne|Calais|Valenciennes|Beauvais|Créteil|Versailles|Sedan|Épinal|Mulhouse|Colmar|Belfort|Besançon|Sochaux|Troyes'],
  NED: [[18, 18], '펜로 시타르트 케르크라더 에먼 아선 데펜터르 헹엘로 알멜로 오스 헬몬트 발베이크 덴보스 스파컨뷔르흐 카트베이크 레인스뷔르흐 바렌드레흐트 노르트베이크 아메르스포르트 힐베르쉼 퓌르메런트', 'Venlo|Sittard|Kerkrade|Emmen|Assen|Deventer|Hengelo|Almelo|Oss|Helmond|Waalwijk|Den Bosch|Spakenburg|Katwijk|Rijnsburg|Barendrecht|Noordwijk|Amersfoort|Hilversum|Purmerend'],
  POR: [[18, 16], '빌라노바드가이아 바르셀루스 파솔스페헤이라 페나피엘 빌라두콘드 포보아드바르징 파말리캉 토헤스베드라스 산타렝 카스텔루브랑쿠 과르다 브라간사 비아나두카스텔루 폰타델가다 앙그라두에로이스무 올량 라구스 베자', 'Vila Nova de Gaia|Barcelos|Paços de Ferreira|Penafiel|Vila do Conde|Póvoa de Varzim|Famalicão|Torres Vedras|Santarém|Castelo Branco|Guarda|Bragança|Viana do Castelo|Ponta Delgada|Angra do Heroísmo|Olhão|Lagos|Beja'],
  BEL: [[16, 16], '로셀라레 이퍼르 아알스트 신트니클라스 투르나이 무스크론 베르비에 외펜 할레 빌보르더 투른하우트 헤일 로멜 데인제 오우데나르더 라루비에르', 'Roeselare|Ieper|Aalst|Sint-Niklaas|Tournai|Mouscron|Verviers|Eupen|Halle|Vilvoorde|Turnhout|Geel|Lommel|Deinze|Oudenaarde|La Louvière'],
  TUR: [[18, 18], '에르주룸 반 엘라즈 바트만 샨르우르파 오르두 기레순 아마스야 토카트 초룸 볼루 뒤즈제 종굴다크 카라뷔크 크르클라렐리 에디르네 테키르다 발르케시르', 'Erzurum|Van|Elazig|Batman|Sanliurfa|Ordu|Giresun|Amasya|Tokat|Çorum|Bolu|Düzce|Zonguldak|Karabük|Kirklareli|Edirne|Tekirdağ|Balikesir'],
  SCO: [[10, 10], '아브로스 몬트로즈 피터헤드 엘긴 커크콜디 던펌린 알로아 그리녹 덤바턴 스트랜라 앤넌 덤프리스 카우든비스 브레친', 'Arbroath|Montrose|Peterhead|Elgin|Kirkcaldy|Dunfermline|Alloa|Greenock|Dumbarton|Stranraer|Annan|Dumfries|Cowdenbeath|Brechin'],
  AUT: [[16, 16], '볼프스베르크 하르트베르크 리트 알타흐 브레겐츠 루스테나우 크렘스 아이젠슈타트 바덴 비너노이슈타트 카펜베르크 마테르스부르크 그뢰디히 쿠프슈타인 암슈테텐', 'Wolfsberg|Hartberg|Ried|Altach|Bregenz|Lustenau|Krems|Eisenstadt|Baden|Wiener Neustadt|Kapfenberg|Mattersburg|Grödig|Kufstein|Amstetten'],
  SUI: [[16, 16], '샤프하우젠 빌 뇌샤텔 프리부르 이베르동 프라우엔펠트 쿠어 벨린초나 크리엔스 추크 졸로투른 올텐 브리그 라쇼드퐁 니옹', 'Schaffhausen|Biel|Neuchâtel|Fribourg|Yverdon|Frauenfeld|Chur|Bellinzona|Kriens|Zug|Solothurn|Olten|Brig|La Chaux-de-Fonds|Nyon'],
  GRE: [[16, 16], '코린토스 아르타 카르디차 트리칼라 코자니 베리아 드라마 코모티니 알렉산드루폴리 리바디아 라미아 할키다 피르고스 레팀노 로도스 케르키라', 'Korinthos|Arta|Karditsa|Trikala|Kozani|Veria|Drama|Komotini|Alexandroupoli|Livadeia|Lamia|Chalkida|Pyrgos|Rethymno|Rhodes|Corfu'],
  DEN: [[12, 14], '나이스트베드 홀베크 슬라겔세 뉘쾨빙 스벤보르 하데르슬레우 쇠네르보르 아벤로 콜링 스키베 링뷔 브뢴비 예링 프레데릭스하운', 'Næstved|Holbæk|Slagelse|Nykøbing|Svendborg|Haderslev|Sønderborg|Aabenraa|Kolding|Skive|Lyngby|Brøndby|Hjørring|Frederikshavn'],
  NOR: [[14, 14], '사릅스보르 하마르 기외비크 콩스빙에르 라르비크 아렌달 그림스타 에게르순 모이라나 나르비크 하르스타 알타 레방에르 크리스티안순', 'Sarpsborg|Hamar|Gjøvik|Kongsvinger|Larvik|Arendal|Grimstad|Egersund|Mo i Rana|Narvik|Harstad|Alta|Levanger|Kristiansund'],
  SWE: [[16, 14], '쇠데르텔리에 순스발 외스테르순드 루레오 셸레프테오 팔룬 칼스타드 트롤헤탄 바르베리 크리스티안스타드 란스크로나 트렐레보리 벡셰 비스뷔', 'Södertälje|Sundsvall|Östersund|Luleå|Skellefteå|Falun|Karlstad|Trollhättan|Varberg|Kristianstad|Landskrona|Trelleborg|Växjö|Visby'],
  CZE: [[16, 16], '프로스티요프 프르제로프 지흘라바 체스케부데요비체 타보르 피세크 프르지브람 클라드노 콜린 흐루딤 트르시네츠 비트코비체 호도닌 즈노이모 브르제츨라프 우헤르스케흐라디슈테', 'Prostějov|Přerov|Jihlava|České Budějovice|Tábor|Písek|Příbram|Kladno|Kolín|Chrudim|Třinec|Vítkovice|Hodonín|Znojmo|Břeclav|Uherské Hradiště'],
  POL: [[18, 18], '오폴레 지엘로나구라 고주프 레그니차 왈브지흐 엘블롱크 올슈틴 플로츠크 브워츠와베크 칼리시 코닌 레시노 타르누프 노비송치 제슈프 스탈로바볼라 자모시치 수바우키', 'Opole|Zielona Góra|Gorzów|Legnica|Wałbrzych|Elbląg|Olsztyn|Płock|Włocławek|Kalisz|Konin|Leszno|Tarnów|Nowy Sącz|Rzeszów|Stalowa Wola|Zamość|Suwałki'],
  CRO: [[16, 16], '벨리카고리차 시사크 비로비티차 비예로바르 코프리브니차 차코베츠 고스피치 마카르스카 솔린 트로기르 크닌 포레치 로비니 우마그 사모보르 자프레시치', 'Velika Gorica|Sisak|Virovitica|Bjelovar|Koprivnica|Čakovec|Gospić|Makarska|Solin|Trogir|Knin|Poreč|Rovinj|Umag|Samobor|Zaprešić'],
  SRB: [[16, 16], '소코바냐 자예차르 보르 피로트 브라네 프로쿠플레 크루셰바츠 야고디나 파라친 시드 솜보르 키킨다 브르샤츠 루마 샤바츠 로즈니차', 'Sokobanja|Zaječar|Bor|Pirot|Vranje|Prokuplje|Kruševac|Jagodina|Paraćin|Šid|Sombor|Kikinda|Vršac|Ruma|Šabac|Loznica'],
  UKR: [[16, 14], '테르노필 이바노프랑키우스크 루츠크 리우네 지토미르 흐멜니츠키 체르니우치 우즈호로드 크로피우니츠키 크레멘추크 카미안스케 니코폴 오렉산드리야 베르디안스크', 'Ternopil|Ivano-Frankivsk|Lutsk|Rivne|Zhytomyr|Khmelnytskyi|Chernivtsi|Uzhhorod|Kropyvnytskyi|Kremenchuk|Kamianske|Nikopol|Oleksandriia|Berdiansk'],
  RUS: [[16, 16], '야로슬라블 툴라 랴잔 칼루가 브랸스크 쿠르스크 벨고로드 리페츠크 탐보프 펜자 사란스크 오렌부르크 아스트라한 마하치칼라 그로즈니 소치', 'Yaroslavl|Tula|Ryazan|Kaluga|Bryansk|Kursk|Belgorod|Lipetsk|Tambov|Penza|Saransk|Orenburg|Astrakhan|Makhachkala|Grozny|Sochi'],
  ROU: [[16, 16], '수체아바 피아트라네암츠 바이아마레 사투마레 잘러우 비스트리차 투르구무레슈 알바율리아 데바 후네도아라 레시차 드로베타투르누세베린 슬라티나 알렉산드리아 지우르지우 칼라라시', 'Suceava|Piatra Neamț|Baia Mare|Satu Mare|Zalău|Bistrița|Târgu Mureș|Alba Iulia|Deva|Hunedoara|Reșița|Drobeta-Turnu Severin|Slatina|Alexandria|Giurgiu|Călărași'],
  HUN: [[16, 16], '베스프렘 터터바녀 셰케이 커포슈바르 너지커니저 잘라에게르세그 파파 쇼프론 두너우이바로시 에르드 바츠 살고터랸 커진츠바르치커 베케슈처버 메죄쾨베슈드 키슈바르다', 'Veszprém|Tatabánya|Szekszárd|Kaposvár|Nagykanizsa|Zalaegerszeg|Pápa|Sopron|Dunaújváros|Érd|Vác|Salgótarján|Kazincbarcika|Békéscsaba|Mezőkövesd|Kisvárda'],
  IRL: [[12, 12], '킬케니 웩스퍼드 칼로 털러모어 멀링가 나반 캐번 모너핸 레터케니 캐슬바 트랄리 클론멜 엔니스 롱퍼드', 'Kilkenny|Wexford|Carlow|Tullamore|Mullingar|Navan|Cavan|Monaghan|Letterkenny|Castlebar|Tralee|Clonmel|Ennis|Longford'],
  BRA: [[20, 20], '우베를란지아 히베이랑프레투 소로카바 상주제두스캄푸스 주이스지포라 론드리나 마링가 카시아스두술 펠로타스 샤페코 블루메나우 비토리아 아라카주 테레지나 상루이스 캄피나그란지 카루아루 페트롤리나 이타보라이 볼타헤돈다 브라질리아 아나폴리스 포르투벨류 마카파', 'Uberlândia|Ribeirão Preto|Sorocaba|São José dos Campos|Juiz de Fora|Londrina|Maringá|Caxias do Sul|Pelotas|Chapecó|Blumenau|Vitória|Aracaju|Teresina|São Luís|Campina Grande|Caruaru|Petrolina|Itaboraí|Volta Redonda|Brasília|Anápolis|Porto Velho|Macapá'],
  ARG: [[20, 20], '라리오하 산티아고델에스테로 후후이 카타마르카 산루이스 리오쿠아르토 비야마리아 라파엘라 후닌 탄딜 올라바리아 트렐레우 코모도로리바다비아 우수아이아 바릴로체 산니콜라스 캄파나 사라테 메를로 모론 템페를레이', 'La Rioja|Santiago del Estero|Jujuy|Catamarca|San Luis|Río Cuarto|Villa María|Rafaela|Junín|Tandil|Olavarría|Trelew|Comodoro Rivadavia|Ushuaia|Bariloche|San Nicolás|Campana|Zárate|Merlo|Morón|Temperley'],
  URU: [[14, 14], '플로리다 두라스노 트레인타이트레스 로차 산호세데마요 프라이벤토스 카넬로네스 판도 시우다드델라코스타 카르멜로 돌로레스 영', 'Florida|Durazno|Treinta y Tres|Rocha|San José de Mayo|Fray Bentos|Canelones|Pando|Ciudad de la Costa|Carmelo|Dolores|Young'],
  COL: [[16, 16], '아르메니아 투룰루아 팔미라 부에나벤투라 소가모소 두이타마 지파키라 소아차 엔비가도 이타구이 리오네그로 바예두파르 신셀레호 리오아차 포파얀 플로렌시아', 'Armenia|Tuluá|Palmira|Buenaventura|Sogamoso|Duitama|Zipaquirá|Soacha|Envigado|Itagüí|Rionegro|Valledupar|Sincelejo|Riohacha|Popayán|Florencia'],
  CHI: [[14, 14], '칼라마 코피아포 오바예 킬로타 산펠리페 로스앙헬레스 쿠리코 리나레스 발디비아 푼타아레나스 산안토니오 멜리피야 푸엔테알토 마이푸', 'Calama|Copiapó|Ovalle|Quillota|San Felipe|Los Ángeles|Curicó|Linares|Valdivia|Punta Arenas|San Antonio|Melipilla|Puente Alto|Maipú'],
  PAR: [[16, 16], '페드로후안카바예로 코로넬오비에도 산에스타니슬라오 카아세페 파라과리 이타우구아 마리아노로케알론소 림피오 아레구아 카라페과 산페드로 카아사파 오르케타 살토델과이라', 'Pedro Juan Caballero|Coronel Oviedo|San Estanislao|Caacupé|Paraguarí|Itauguá|Mariano Roque Alonso|Limpio|Areguá|Carapeguá|San Pedro|Caazapá|Horqueta|Salto del Guairá'],
  ECU: [[12, 12], '케베도 바바오요 라타쿵가 툴칸 아소게스 밀라그로 라리베르타드 엘코카 푸요 테나 마차치 산타엘레나', 'Quevedo|Babahoyo|Latacunga|Tulcán|Azogues|Milagro|La Libertad|El Coca|Puyo|Tena|Machachi|Santa Elena'],
  PER: [[16, 16], '훌리아카 아야쿠초 우아누코 푸칼파 타라포토 모케과 일로 침보테 우아초 피스코 툼베스 차차포야스 하엔 아방카이', 'Juliaca|Ayacucho|Huánuco|Pucallpa|Tarapoto|Moquegua|Ilo|Chimbote|Huacho|Pisco|Tumbes|Chachapoyas|Jaén|Abancay'],
  BOL: [[14, 14], '야쿠이바 리베랄타 과야라메린 비야존 투피사 우유니 키야코요 사카바 코비하 카미리 베르메호 와르네스', 'Yacuiba|Riberalta|Guayaramerín|Villazón|Tupiza|Uyuni|Quillacollo|Sacaba|Cobija|Camiri|Bermejo|Warnes'],
  VEN: [[14, 14], '바르셀로나 발렌시아 산펠리페 아카리과 과나레 산페르난도 투쿠피타 엘티그레 카루파노 푸에르토아야쿠초 산후안데로스모로스 로스테케스', 'Barcelona|Valencia|San Felipe|Acarigua|Guanare|San Fernando|Tucupita|El Tigre|Carúpano|Puerto Ayacucho|San Juan de los Morros|Los Teques'],
  USA: [[16, 16], '로체스터 버펄로 하트퍼드 프로비던스 리치먼드 노퍽 롤리 그린빌 찰스턴 서배너 잭슨빌 버밍햄 채터누가 녹스빌 렉싱턴 인디애나폴리스 털사 엘패소 투손 리노 보이시 스포캔 오마하 디모인', 'Rochester|Buffalo|Hartford|Providence|Richmond|Norfolk|Raleigh|Greenville|Charleston|Savannah|Jacksonville|Birmingham|Chattanooga|Knoxville|Lexington|Indianapolis|Tulsa|El Paso|Tucson|Reno|Boise|Spokane|Omaha|Des Moines'],
  MEX: [[16, 16], '셀라야 레온 이라푸아토 사카테카스 두랑고 에르모시요 시우다드오브레곤 로스모치스 테픽 콜리마 쿠에르나바카 파추카 틀락스칼라 비야에르모사 툭스틀라 캄페체 체투말 탐피코', 'Celaya|León|Irapuato|Zacatecas|Durango|Hermosillo|Ciudad Obregón|Los Mochis|Tepic|Colima|Cuernavaca|Pachuca|Tlaxcala|Villahermosa|Tuxtla|Campeche|Chetumal|Tampico'],
  CAN: [[10, 12], '서리 미시소가 브램턴 런던 키치너 윈저 오샤와 세인트캐서린스 서드베리 선더베이 새스커툰 켈로나 몽크턴 프레더릭턴 가티노 셔브룩', 'Surrey|Mississauga|Brampton|London|Kitchener|Windsor|Oshawa|St. Catharines|Sudbury|Thunder Bay|Saskatoon|Kelowna|Moncton|Fredericton|Gatineau|Sherbrooke'],
  CRC: [[12, 12], '그레시아 산라몬 팔마레스 투리알바 과필레스 니코야 산타크루스 케포스 시우다드네일리 산비토 데삼파라도스 쿠리다밧', 'Grecia|San Ramón|Palmares|Turrialba|Guápiles|Nicoya|Santa Cruz|Quepos|Ciudad Neily|San Vito|Desamparados|Curridabat'],
  KOR: [[16, 16], '화성 평택 시흥 김포 파주 양주 의정부 남양주 구리 하남 이천 안양 부천 광명 당진 서산 아산 경주 거제 통영 양산 순천 광양 군산 익산 강릉 속초 충주', 'Hwaseong|Pyeongtaek|Siheung|Gimpo|Paju|Yangju|Uijeongbu|Namyangju|Guri|Hanam|Icheon|Anyang|Bucheon|Gwangmyeong|Dangjin|Seosan|Asan|Gyeongju|Geoje|Tongyeong|Yangsan|Suncheon|Gwangyang|Gunsan|Iksan|Gangneung|Sokcho|Chungju'],
  JPN: [[20, 16], '미토 우쓰노미야 마에바시 고후 나가노 마쓰모토 도야마 후쿠이 기후 누마즈 후지에다 이와타 도요하시 나라 와카야마 돗토리 마쓰에 도쿠시마 다카마쓰 고치 이마바리 기타카미 아키타 야마가타 모리오카 하치노헤 이와키 후쿠시마 오이타 미야자키 사가 오키나와', 'Mito|Utsunomiya|Maebashi|Kofu|Nagano|Matsumoto|Toyama|Fukui|Gifu|Numazu|Fujieda|Iwata|Toyohashi|Nara|Wakayama|Tottori|Matsue|Tokushima|Takamatsu|Kochi|Imabari|Kitakami|Akita|Yamagata|Morioka|Hachinohe|Iwaki|Fukushima|Oita|Miyazaki|Saga|Okinawa'],
  CHN: [[16, 16], '쑤저우 우시 닝보 원저우 샤먼 푸저우 난창 창사 허페이 스자좡 타이위안 후허하오터 란저우 시닝 인촨 우루무치 하얼빈 옌볜 다퉁 웨이팡 쯔보 메이저우', 'Suzhou|Wuxi|Ningbo|Wenzhou|Xiamen|Fuzhou|Nanchang|Changsha|Hefei|Shijiazhuang|Taiyuan|Hohhot|Lanzhou|Xining|Yinchuan|Ürümqi|Harbin|Yanbian|Datong|Weifang|Zibo|Meizhou'],
  KSA: [[16, 16], '얀부 라비그 우나이자 알라스 하파르알바틴 사카카 아라르 알바하 비샤 카미스무샤이트 알쿠라이야트 둡바 알울라 다란', 'Yanbu|Rabigh|Unaizah|Ar Rass|Hafar Al-Batin|Sakakah|Arar|Al Bahah|Bisha|Khamis Mushait|Al Qurayyat|Duba|Al-Ula|Dhahran'],
  QAT: [[10, 10], '알다옌 알샤하니야 무아이테르 알카리티야트 알게웨이리야 마디낫알샤말 루와이스 알와브 움바브 알카라나', 'Al Daayen|Al Shahaniya|Muaither|Al Kharitiyat|Al Ghuwariyah|Madinat ash Shamal|Ar Ruways|Al Waab|Umm Bab|Al Karaana'],
  UAE: [[12, 12], '알다프라 루와이스 마디나트자예드 하타 디바알히슨 코르파칸 하므리야 알자이드 마사피 알나흐다 제벨알리 알카와니즈', 'Al Dhafra|Ruwais|Madinat Zayed|Hatta|Dibba Al-Hisn|Khor Fakkan|Hamriyah|Al Dhaid|Masafi|Al Nahda|Jebel Ali|Al Khawaneej'],
  IRN: [[16, 16], '자헤단 카즈빈 잔잔 사리 고르간 우르미아 산난다지 호람아바드 일람 셈난 비르잔드 부셰르 아바단 데즈풀 카샨 사브제바르', 'Zahedan|Qazvin|Zanjan|Sari|Gorgan|Urmia|Sanandaj|Khorramabad|Ilam|Semnan|Birjand|Bushehr|Abadan|Dezful|Kashan|Sabzevar'],
  UZB: [[14, 14], '우르겐치 히바 굴리스탄 치르치크 알말리크 앙그렌 베카바드 마르길란 쿠바 샤흐리삽즈 데나우 자라프샨', 'Urgench|Khiva|Gulistan|Chirchiq|Olmaliq|Angren|Bekabad|Margilan|Quva|Shahrisabz|Denov|Zarafshon'],
  THA: [[16, 16], '라용 사뭇쁘라깐 빠툼타니 나콘빠톰 깐짜나부리 핏사눌록 람빵 치앙라이 수랏타니 뜨랑 송클라 시사켓 우본랏차타니 나콘사완', 'Rayong|Samut Prakan|Pathum Thani|Nakhon Pathom|Kanchanaburi|Phitsanulok|Lampang|Chiang Rai|Surat Thani|Trang|Songkhla|Sisaket|Ubon Ratchathani|Nakhon Sawan'],
  VIE: [[12, 12], '빈즈엉 동나이 롱안 꽝닌 하이즈엉 타이빈 빈푹 박닌 꽝남 플레이꾸 부온마투옷 붕따우', 'Binh Duong|Dong Nai|Long An|Quang Ninh|Hai Duong|Thai Binh|Vinh Phuc|Bac Ninh|Quang Nam|Pleiku|Buon Ma Thuot|Vung Tau'],
  IDN: [[16, 16], '수라카르타 마두라 시도아르조 그레식 클라텐 치레본 타식말라야 세랑 브카시 람풍 잠비 벵쿨루 아체 마나도 쿠팡 자야푸라', 'Surakarta|Madura|Sidoarjo|Gresik|Klaten|Cirebon|Tasikmalaya|Serang|Bekasi|Lampung|Jambi|Bengkulu|Aceh|Manado|Kupang|Jayapura'],
  AUS: [[14, 14], '선샤인코스트 투움바 매카이 록햄프턴 번버리 밸러랫 벤디고 와가와가 탐워스 론서스턴 앨리스스프링스 마운트갬비어 오렌지 배서스트', 'Sunshine Coast|Toowoomba|Mackay|Rockhampton|Bunbury|Ballarat|Bendigo|Wagga Wagga|Tamworth|Launceston|Alice Springs|Mount Gambier|Orange|Bathurst'],
  EGY: [[16, 16], '베니수에프 쿠스 키나 마르사마트루 아리시 후르가다 샤름엘셰이크 카프르엘셰이크 다미에타 시빈엘콤 바나 미트감르 말라위 에드푸', 'Beni Suef|Qus|Qena|Marsa Matruh|Arish|Hurghada|Sharm El Sheikh|Kafr El Sheikh|Damietta|Shibin El Kom|Banha|Mit Ghamr|Mallawi|Edfu'],
  MAR: [[16, 16], '베르칸 타자 크니프라 세타트 모하메디아 쿠리브가 에사우이라 와르자자트 에라시디아 이프란 알호세이마 라라슈 크사르엘케비르 티즈니트', 'Berkane|Taza|Khenifra|Settat|Mohammedia|Khouribga|Essaouira|Ouarzazate|Errachidia|Ifrane|Al Hoceima|Larache|Ksar El Kebir|Tiznit'],
  TUN: [[16, 16], '제르바 자르지스 토죄르 케빌리 시디부지드 카세린 엘케프 실리아나 젠두바 함맘리프 라데스 마디아 마트뢰르 엘제마', 'Djerba|Zarzis|Tozeur|Kebili|Sidi Bouzid|Kasserine|El Kef|Siliana|Jendouba|Hammam-Lif|Radès|Mahdia|Mateur|El Djem'],
  ALG: [[16, 16], '젤파 메데아 칠레프 모스타가넴 렐리잔 마스카라 사이다 티아레트 라그와트 가르다이아 우아르글라 엘우에드 스키크다 겔마', 'Djelfa|Médéa|Chlef|Mostaganem|Relizane|Mascara|Saïda|Tiaret|Laghouat|Ghardaïa|Ouargla|El Oued|Skikda|Guelma'],
  RSA: [[16, 16], '저미스턴 베노니 복스버그 스프링스 페리니힝 클레르크스도르프 포체프스트룸 위트뱅크 뉴캐슬 리처즈베이 조지 업잉턴 마피켕 토호얀도우', 'Germiston|Benoni|Boksburg|Springs|Vereeniging|Klerksdorp|Potchefstroom|Witbank|Newcastle|Richards Bay|George|Upington|Mahikeng|Thohoyandou'],
  NGA: [[16, 16], '아쿠레 오그보모쇼 오숑보 아도에키티 로코자 마쿠르디 미나 바우치 곰베 요라 마이두구리 소코토 카치나 칼라바르 아사바 아우카', 'Akure|Ogbomosho|Osogbo|Ado Ekiti|Lokoja|Makurdi|Minna|Bauchi|Gombe|Yola|Maiduguri|Sokoto|Katsina|Calabar|Asaba|Awka'],
  GHA: [[16, 16], '와 볼가탕가 테치만 은카우카우 위네바 둔크와 타르콰 아샤이만 은사왐 악심 엘미나', 'Wa|Bolgatanga|Techiman|Nkawkaw|Winneba|Dunkwa|Tarkwa|Ashaiman|Nsawam|Axim|Elmina']
};
// 새 이름 풀 [이름 순서, 이름, 성]과 영어 [이름, 성]
const NAME_DATA_2 = {
  he: ['fl', '에란 오메르 요나탄 도르 탈 이타이 리엘 다니엘 아비 니르 로이 엘리 샤하르 오르 길 아미르 노암 이도 오프리 요아브 이단 오하드',
    '코헨 레비 미즈라히 페레츠 비톤 다한 아브라함 프리드만 샤피라 아줄라이 말카 오하나 카츠 가비존 암살렘 하다드 바루크 벤시몬 골란 샤케드'],
  bg: ['fl', '게오르기 이반 디미타르 페타르 니콜라이 스토얀 토도르 블라디미르 마르틴 크리스티안 보리스 스베토슬라프 안톤 플라멘 일리야 바실 키릴 벤치슬라프 라도슬라프 즈드라브코',
    '페트로프 이바노프 게오르기에프 디미트로프 니콜로프 스토야노프 토도로프 일리예프 안겔로프 콜레프 마리노프 포포프 미하일로프 키릴로프 흐리스토프 야네프 파블로프 바실레프 라데프 츠베트코프 슬라보프 돈체프'],
  sk: ['fl', '유라이 마레크 마르틴 토마시 미할 페테르 루카시 야쿠프 다비드 온드레이 로베르트 마투시 파트리크 아담 레네 로만 스타니슬라프 이반 야로슬라프 밀로시',
    '코바치 호르바트 바르가 토트 발라시 노바크 폴라크 크라이초비치 후다크 심코 미시크 루카치 바란 콜라르 오라베츠 크메티 바르토시 우르반 가이도시 마자르'],
  sl: ['fl', '루카 얀 지가 니크 팀 미하 블라시 네이츠 잔 로크 마티츠 야카 가슈페르 알랴시 벤야민 안드라시 도멘 에리크 틸렌 클레멘',
    '노바크 호르바트 코바치치 크라인츠 주판치치 포토치니크 믈라카르 코스 비드마르 골로브 투르크 크랄 주판 비자크 흐리바르 카우치치 로즈만 카스텔리츠 코렌 자가르 페테크 파블린 콜라르 예레브'],
  bs: ['fl', '에딘 하리스 아메르 에미르 아드난 케난 엘비르 아르민 알미르 미르자 세나드 에르메딘 무하메드 아미르 엘다르 네르민 에니스 다미르 베다드 아르넬',
    '호지치 하지치 코바체비치 델리치 베기치 메흐메도비치 살리호비치 하사노비치 후시치 알리치 스마이치 무이치 할릴로비치 아흐메토비치 무라토비치 오메로비치 카리치 함지치 셰히치 차우셰비치'],
  mk: ['fl', '고란 알렉산다르 다르코 보얀 스테판 니콜라 아리얀 티호미르 야니 필립 마르코 디미타르 이반 마리오 빅토르 다비드 안드레이 블라트코 즐라트코 사슈코',
    '트라이코프스키 니콜로프스키 스토야노프스키 리스토프스키 벨코프스키 스피로프스키 토도로프스키 포포프스키 디미트로프스키 안겔로프스키 페트로프스키 요바노프스키 코스토프스키 파블로프스키 조르지에프스키 마르코프스키 일리에프스키 미트레프스키 아타나소프스키 즈드라브코프스키'],
  sq: ['fl', '아르벤 베스니크 에르말 크리스티안 소콜 아르디안 도리안 엔드리트 발론 아를린드 베킴 파토스 겐티안 로리크 슈켈전 레이 인드리트 아르브노르 윌베르 아곤',
    '베리샤 크라스니치 호자 가시 샬라 켈멘디 모리나 라마 바이라미 이스마일리 카치 무치 차니 레카 두슈쿠 하사니 아브디우 무스타파 비티치 제치리 레제피 자페리 알리미 바샤'],
  fi: ['fl', '테무 미코 유카 요니 유호 라우리 에로 온니 아투 엘리아스 레오 발테리 로페 산테리 니코 빌레 안티 투오마스 사미 예세',
    '코르호넨 비르타넨 매키넨 니에미넨 매켈래 해맬래이넨 라이네 헤이키넨 코스키넨 얘르비넨 레흐토넨 레흐티넨 사리넨 살미넨 헤이노넨 니에미 헤이킬래 킨누넨 살로넨 투루넨 라이티넨 투오미넨 란타넨 카랴라이넨'],
  is: ['fl', '아론 귈비 요한 알프레드 비르키르 회르뒤르 라그나르 카우리 루나르 아르노르 홀마르 스베리르 이사크 하콘 욘 안드리 알베르트 비다르 에이뒤르 스테판 비야르니 다비드 에이나르',
    '군나르손 시귀르드손 그뷔드뮌드손 욘손 에이나르손 마그뉘손 올라프손 크리스티아운손 스테파운손 요하네손 비외른손 아우르나손 할도르손 소르다르손 잉가손 파울손 비야르나손 헬가손 하우크손 프리드릭손'],
  cy: ['fl', '딜런 리스 개러스 에런 벤 조 오웨인 이완 게신 휴 요안 카이 모건 토모스 엘리스 로드리 에미르 스테판 알레드 다비드',
    '존스 윌리엄스 데이비스 에번스 토머스 로버츠 휴스 루이스 그리피스 프라이스 에드워즈 리스 로이드 오언 파월 프리처드 패리 하월스 르웰린 본 퓨 보언 젠킨스'],
  mt: ['fl', '조지프 루크 커트 안드레이 클레이턴 라이언 장 테디 잭 후안 스티브 제이크 매슈 칼 가브리엘 니컬러스 브랜던 숀 닐 시릴',
    '보르그 카밀레리 벨라 파루자 잠미트 갈레아 미칼레프 그레크 아타르드 스피테리 아초파르디 미프수드 아지우스 파체 삼무트 카사르 무스카트 본니치 슈에레브 페네크 데보노 셈브리 카루아나 브리파 가우치'],
  et: ['fl', '카를 마르트 라스무스 마르쿠스 헨리 케빈 요나스 마티아스 로베르트 마르틴 라우노 아르투르 심 콘스탄틴 세르게이 에리크 크리스티안 타비 안드레스 카렐',
    '탐 사르 세프 매기 카스크 쿠크 레바네 일베스 패른 코펠 레피크 쿠스크 라우드 바헤르 칼라스 릴 오츠 키비 라우르 테데르 캉구르 맨드 퀴트'],
  lv: ['fl', '야니스 안드리스 크리스탑스 아르투르스 로베르츠 에드가르스 마르틴시 다비스 라이비스 알렉세이스 블라디슬라브스 글렙스 에두아르츠 카를리스 발레리스 루돌프스 긴츠 톰스 페테리스 리하르츠',
    '베르진시 칼닌시 오졸스 얀손스 리에핀시 크루민시 발로디스 클랴빈시 자린시 페테르손스 비톨스 오졸린시 그린베르그스 라치스 실린시 에글리티스 즈비르불리스 스프로기스 타라소브스 이바노브스'],
  lt: ['fl', '토마스 만타스 루카스 유스타스 도나타스 비킨타스 그비다스 아르비다스 에드가라스 파울류스 로카스 도만타스 카롤리스 에르네스타스 리나스 빌류스 에밀리유스 마리우스 사울류스 다리우스',
    '카즐라우스카스 얀카우스카스 페트라우스카스 스탄케비치우스 바실리아우스카스 주카우스카스 부트쿠스 파울라우스카스 우르보나스 카발리아우스카스 바라나우스카스 나비츠카스 림쿠스 루코셰비치우스 포치우스 라마나우스카스 사비츠카스 사칼라우스카스 모츠쿠스 바이트쿠스'],
  ka: ['fl', '기오르기 레반 니카 루카 사바 다비트 라샤 오타르 주라브 이라클리 구람 토르니케 발레리 자바 베카 안조르 메라브 니콜로스 바호 기가',
    '베리제 카파나제 겔라시빌리 마이수라제 기오르가제 로미제 마말라제 치클라우리 코바히제 고기차이시빌리 후치시빌리 자파리제 즈바니아 아바시제 키크나제 돌리제 치헤이제 나텔라시빌리 바실라제 메스히'],
  hy: ['fl', '아람 호바네스 고르 티그란 아르투르 카렌 나레크 바한 다비트 에드가르 아르만 하이크 레본 사르기스 게보르크 알렉산드르 에리크 로베르트 바라즈다트 아르타크',
    '페트로샨 하코뱐 사르그샨 하루튜냔 그리고랸 호바니샨 가자랸 카라페탼 아베티샨 므크르트찬 바르다냔 하차트랸 마르티로샨 포고샨 아바갼 갈스탼 마누캰 시모냔 자카랸 바바얀'],
  az: ['fl', '엘빈 라밀 라샤드 에민 투랄 오르한 마히르 나미크 부가르 루파트 캄란 루슬란 엘누르 알리 무라드 파리드 아이딘 토랄 샤흐리야르 일킨',
    '맘마도프 알리예프 후세이노프 하사노프 굴리예프 이스마일로프 압둘라예프 자파로프 르자예프 바바예프 카리모프 무스타파예프 나시로프 바이라모프 마흐무도프 아가예프 살라호프 이브라기모프 카지모프 라히모프'],
  kk: ['fl', '누를란 예를란 아스하트 바우르잔 이슬람베크 막사트 아바트 테미를란 예르케불란 다우렌 아이볼 술탄 루슬란 아르만 다미르 알리베크 자슬란 세리크잔 올자스 바크티야르',
    '아흐메토프 이스카코프 오마로프 베코프 사르세노프 카시모프 라히모프 무하노프 우테게노프 아베노프 주마베코프 켄제베코프 베이세노프 툴레게노프 누를라노프 세리코프 볼라토프 예르메코프 다울레토프 사파로프'],
  in: ['fl', '아미트 라비 로히트 비크람 아르준 카란 디팍 산자이 라제시 수레시 마노지 아자이 비자이 나빈 프라카시 하리시 키란 안키트 바룬 가우라브',
    '샤르마 베르마 굽타 파텔 레디 나이르 메논 필라이 라오 아이어 차테르지 바네르지 무케르지 고시 두타 바트 조시 쿨카르니 데사이 차우한'],
  ms: ['fl', '아흐마드 무함마드 하피즈 아이만 하킴 다니알 하지크 이르판 아미르 샤룰 나즈미 파즐리 아즈미 아리프 루크만 자키 아즈리프 피르다우스 이즈완 사이풀',
    '라시드 유소프 이스마일 이브라힘 하미드 라자크 압둘라 오스만 마흐무드 자카리아 카말 하산 살레 자아파르 노르딘 아지즈 사마드 라흐만 와하브 하룬'],
  wa: ['fl', '무사 셰이크 이브라히마 마마두 압둘라예 파페 라민 우스만 바바카르 모두 말리크 살리우 알리운 유수프 아마두 부바카르 술레이만 세이두 아다마 시디',
    '디오프 은디아예 사르 디알로 파예 게예 섹 소우 바 시세 음바예 디우프 팔 니앙 티암 은다오 시 와데 트라오레 케이타 쿨리발리 디아라 시소코 둠비아 코나테 상가레 사마세쿠'],
  ci: ['fl', '야오 쿠아시 윌프리드 세르주 프랑크 장필리프 세바스티앵 시몽 이브라힘 세코 니콜라 오딜롱 크리스티앙 아메드 제레미 에마뉘엘 앙드레 조르주 클린턴 마르크 장 파트리크 스테판 앙투안',
    '쿠아시 코네 밤바 투레 야오 쿠아메 디오망데 상가레 코낭 캉가 포파나 아케 아크파 은고노 에솜바 음본도 아탕가나 에방가 음바르가 아베가 빌롱 포초 캄가 은조야'],
  ea: ['fl', '마이클 빅터 에릭 브라이언 케네디 조지프 덩컨 콜린스 마수드 아유브 케네스 클리프턴 로런스 벤슨 패트릭 앤서니 리처드 엘비스 모지스 데니스',
    '오티에노 오디암보 음왕기 오몬디 카마우 오치엥 온양고 웨케사 주마 무투아 은조로게 키프로티치 오두오르 오위노 오우마 음부루 와풀라 바라사 체루이요트 왐부아'],
  cd: ['fl', '트레소르 글로디 피스통 에리티에 메르베유 조엘 가엘 크리스티앙 조나탕 리키 그라스 다리오 아마니 야니크 디외메르시 세드리크 샹셀 아르튀르 메샤크 실라스 테오 잭슨',
    '카송고 일룽가 은고이 음푸투 치망가 루쿠사 무코코 카옘베 마쿠수 치볼라 칼룰루 카바셀레 물룸바 음포쿠 카봉고 로콩가 음부유 칼론지 은콩골로 칸다'],
  zm: ['fl', '콜린스 모지스 조지프 이매뉴얼 기프트 에번스 기븐 펠릭스 브라이언 켈빈 앨런 오거스틴 벤슨 스펜서 아이작 프레디 마틴 로이 클리퍼드 에드워드',
    '피리 반다 물렝가 므완사 칠레셰 카브웨 룽구 무손다 찬다 므윌라 사칼라 캉와 차마 음베웨 줄루 템보 찬사 응고마 칼룽가 브왈랴']
};
const NAME_EN_2 = {
  he: ['Eran|Omer|Yonatan|Dor|Tal|Itay|Liel|Daniel|Avi|Nir|Roy|Eli|Shahar|Or|Gil|Amir|Noam|Ido|Ofri|Yoav|Idan|Ohad',
    'Cohen|Levi|Mizrahi|Peretz|Biton|Dahan|Avraham|Friedman|Shapira|Azulay|Malka|Ohana|Katz|Gabizon|Amsalem|Haddad|Baruch|Bensimon|Golan|Shaked'],
  bg: ['Georgi|Ivan|Dimitar|Petar|Nikolay|Stoyan|Todor|Vladimir|Martin|Kristian|Boris|Svetoslav|Anton|Plamen|Iliya|Vasil|Kiril|Ventsislav|Radoslav|Zdravko',
    'Petrov|Ivanov|Georgiev|Dimitrov|Nikolov|Stoyanov|Todorov|Iliev|Angelov|Kolev|Marinov|Popov|Mihaylov|Kirilov|Hristov|Yanev|Pavlov|Vasilev|Radev|Tsvetkov|Slavov|Donchev'],
  sk: ['Juraj|Marek|Martin|Tomáš|Michal|Peter|Lukáš|Jakub|Dávid|Ondrej|Róbert|Matúš|Patrik|Adam|René|Roman|Stanislav|Ivan|Jaroslav|Miloš',
    'Kováč|Horváth|Varga|Tóth|Baláž|Novák|Polák|Krajčovič|Hudák|Šimko|Mišík|Lukáč|Baran|Kollár|Oravec|Kmeť|Bartoš|Urban|Gajdoš|Maďar'],
  sl: ['Luka|Jan|Žiga|Nik|Tim|Miha|Blaž|Nejc|Žan|Rok|Matic|Jaka|Gašper|Aljaž|Benjamin|Andraž|Domen|Erik|Tilen|Klemen',
    'Novak|Horvat|Kovačič|Krajnc|Zupančič|Potočnik|Mlakar|Kos|Vidmar|Golob|Turk|Kralj|Zupan|Bizjak|Hribar|Kavčič|Rozman|Kastelic|Koren|Žagar|Petek|Pavlin|Kolar|Jereb'],
  bs: ['Edin|Haris|Amer|Emir|Adnan|Kenan|Elvir|Armin|Almir|Mirza|Senad|Ermedin|Muhamed|Amir|Eldar|Nermin|Enis|Damir|Vedad|Arnel',
    'Hodžić|Hadžić|Kovačević|Delić|Begić|Mehmedović|Salihović|Hasanović|Husić|Alić|Smajić|Mujić|Halilović|Ahmetović|Muratović|Omerović|Karić|Hamzić|Šehić|Čaušević'],
  mk: ['Goran|Aleksandar|Darko|Bojan|Stefan|Nikola|Arijan|Tihomir|Jani|Filip|Marko|Dimitar|Ivan|Mario|Viktor|David|Andrej|Vlatko|Zlatko|Saško',
    'Trajkovski|Nikolovski|Stojanovski|Ristovski|Velkovski|Spirovski|Todorovski|Popovski|Dimitrovski|Angelovski|Petrovski|Jovanovski|Kostovski|Pavlovski|Gjorgjievski|Markovski|Ilievski|Mitrevski|Atanasovski|Zdravkovski'],
  sq: ['Arben|Besnik|Ermal|Kristjan|Sokol|Ardian|Dorian|Endrit|Valon|Arlind|Bekim|Fatos|Gentian|Lorik|Shkelzen|Rei|Indrit|Arbnor|Ylber|Agon',
    'Berisha|Krasniqi|Hoxha|Gashi|Shala|Kelmendi|Morina|Rama|Bajrami|Ismajli|Kaçi|Muçi|Çani|Leka|Dushku|Hasani|Avdiu|Mustafa|Bytyqi|Zeqiri|Rexhepi|Xhaferi|Alimi|Basha'],
  fi: ['Teemu|Mikko|Jukka|Joni|Juho|Lauri|Eero|Onni|Aatu|Elias|Leo|Valtteri|Roope|Santeri|Niko|Ville|Antti|Tuomas|Sami|Jesse',
    'Korhonen|Virtanen|Mäkinen|Nieminen|Mäkelä|Hämäläinen|Laine|Heikkinen|Koskinen|Järvinen|Lehtonen|Lehtinen|Saarinen|Salminen|Heinonen|Niemi|Heikkilä|Kinnunen|Salonen|Turunen|Laitinen|Tuominen|Rantanen|Karjalainen'],
  is: ['Aron|Gylfi|Jóhann|Alfreð|Birkir|Hörður|Ragnar|Kári|Rúnar|Arnór|Hólmar|Sverrir|Ísak|Hákon|Jón|Andri|Albert|Viðar|Eiður|Stefán|Bjarni|Davíð|Einar',
    'Gunnarsson|Sigurðsson|Guðmundsson|Jónsson|Einarsson|Magnússon|Ólafsson|Kristjánsson|Stefánsson|Jóhannesson|Björnsson|Árnason|Halldórsson|Þórðarson|Ingason|Pálsson|Bjarnason|Helgason|Hauksson|Friðriksson'],
  cy: ['Dylan|Rhys|Gareth|Aaron|Ben|Joe|Owain|Iwan|Gethin|Huw|Ioan|Cai|Morgan|Tomos|Elis|Rhodri|Emyr|Steffan|Aled|Dafydd',
    'Jones|Williams|Davies|Evans|Thomas|Roberts|Hughes|Lewis|Griffiths|Price|Edwards|Rees|Lloyd|Owen|Powell|Pritchard|Parry|Howells|Llewellyn|Vaughan|Pugh|Bowen|Jenkins'],
  mt: ['Joseph|Luke|Kurt|Andrei|Clayton|Ryan|Jean|Teddy|Zach|Juan|Steve|Jake|Matthew|Karl|Gabriel|Nicholas|Brandon|Shaun|Neil|Cyril',
    'Borg|Camilleri|Vella|Farrugia|Zammit|Galea|Micallef|Grech|Attard|Spiteri|Azzopardi|Mifsud|Agius|Pace|Sammut|Cassar|Muscat|Bonnici|Xuereb|Fenech|Debono|Schembri|Caruana|Briffa|Gauci'],
  et: ['Karl|Mart|Rasmus|Markus|Henri|Kevin|Joonas|Mattias|Robert|Martin|Rauno|Artur|Siim|Konstantin|Sergei|Erik|Kristjan|Taavi|Andres|Kaarel',
    'Tamm|Saar|Sepp|Mägi|Kask|Kukk|Rebane|Ilves|Pärn|Koppel|Lepik|Kuusk|Raud|Vaher|Kallas|Lill|Ots|Kivi|Laur|Teder|Kangur|Mänd|Kütt'],
  lv: ['Jānis|Andris|Kristaps|Artūrs|Roberts|Edgars|Mārtiņš|Dāvis|Raivis|Aleksejs|Vladislavs|Glebs|Eduards|Kārlis|Valērijs|Rūdolfs|Gints|Toms|Pēteris|Rihards',
    'Bērziņš|Kalniņš|Ozols|Jansons|Liepiņš|Krūmiņš|Balodis|Kļaviņš|Zariņš|Pētersons|Vītols|Ozoliņš|Grīnbergs|Lācis|Siliņš|Eglītis|Zvirbulis|Sproģis|Tarasovs|Ivanovs'],
  lt: ['Tomas|Mantas|Lukas|Justas|Donatas|Vykintas|Gvidas|Arvydas|Edgaras|Paulius|Rokas|Domantas|Karolis|Ernestas|Linas|Vilius|Emilijus|Marius|Saulius|Darius',
    'Kazlauskas|Jankauskas|Petrauskas|Stankevičius|Vasiliauskas|Žukauskas|Butkus|Paulauskas|Urbonas|Kavaliauskas|Baranauskas|Navickas|Rimkus|Lukoševičius|Pocius|Ramanauskas|Savickas|Sakalauskas|Mockus|Vaitkus'],
  ka: ['Giorgi|Levan|Nika|Luka|Saba|Davit|Lasha|Otar|Zurab|Irakli|Guram|Tornike|Valeri|Jaba|Beka|Anzor|Merab|Nikoloz|Vakho|Giga',
    'Beridze|Kapanadze|Gelashvili|Maisuradze|Giorgadze|Lomidze|Mamaladze|Tsiklauri|Kobakhidze|Gogichaishvili|Khutsishvili|Japaridze|Zhvania|Abashidze|Kiknadze|Dolidze|Chkheidze|Natelashvili|Basiladze|Meskhi'],
  hy: ['Aram|Hovhannes|Gor|Tigran|Artur|Karen|Narek|Vahan|Davit|Edgar|Arman|Hayk|Levon|Sargis|Gevorg|Aleksandr|Erik|Robert|Varazdat|Artak',
    'Petrosyan|Hakobyan|Sargsyan|Harutyunyan|Grigoryan|Hovhannisyan|Ghazaryan|Karapetyan|Avetisyan|Mkrtchyan|Vardanyan|Khachatryan|Martirosyan|Poghosyan|Avagyan|Galstyan|Manukyan|Simonyan|Zakaryan|Babayan'],
  az: ['Elvin|Ramil|Rashad|Emin|Tural|Orkhan|Mahir|Namik|Vugar|Rufat|Kamran|Ruslan|Elnur|Ali|Murad|Farid|Aydin|Toral|Shahriyar|Ilkin',
    'Mammadov|Aliyev|Huseynov|Hasanov|Guliyev|Ismayilov|Abdullayev|Jafarov|Rzayev|Babayev|Karimov|Mustafayev|Nasirov|Bayramov|Mahmudov|Agayev|Salakhov|Ibragimov|Kazimov|Rahimov'],
  kk: ['Nurlan|Yerlan|Askhat|Baurzhan|Islambek|Maksat|Abat|Temirlan|Yerkebulan|Dauren|Aibol|Sultan|Ruslan|Arman|Damir|Alibek|Zhaslan|Serikzhan|Olzhas|Bakhtiyar',
    'Akhmetov|Iskakov|Omarov|Bekov|Sarsenov|Kassymov|Rakhimov|Mukhanov|Utegenov|Abenov|Zhumabekov|Kenzhebekov|Beisenov|Tulegenov|Nurlanov|Serikov|Bolatov|Ermekov|Dauletov|Saparov'],
  in: ['Amit|Ravi|Rohit|Vikram|Arjun|Karan|Deepak|Sanjay|Rajesh|Suresh|Manoj|Ajay|Vijay|Naveen|Prakash|Harish|Kiran|Ankit|Varun|Gaurav',
    'Sharma|Verma|Gupta|Patel|Reddy|Nair|Menon|Pillai|Rao|Iyer|Chatterjee|Banerjee|Mukherjee|Ghosh|Dutta|Bhat|Joshi|Kulkarni|Desai|Chauhan'],
  ms: ['Ahmad|Muhammad|Hafiz|Aiman|Hakim|Danial|Haziq|Irfan|Amir|Shahrul|Nazmi|Fazly|Azmi|Arif|Lukman|Zaki|Azrif|Firdaus|Izwan|Saiful',
    'Rashid|Yusoff|Ismail|Ibrahim|Hamid|Razak|Abdullah|Osman|Mahmud|Zakaria|Kamal|Hassan|Salleh|Jaafar|Nordin|Aziz|Samad|Rahman|Wahab|Harun'],
  wa: ['Moussa|Cheikh|Ibrahima|Mamadou|Abdoulaye|Pape|Lamine|Ousmane|Babacar|Modou|Malick|Saliou|Alioune|Youssouf|Amadou|Boubacar|Souleymane|Seydou|Adama|Sidy',
    'Diop|Ndiaye|Sarr|Diallo|Faye|Gueye|Seck|Sow|Ba|Cissé|Mbaye|Diouf|Fall|Niang|Thiam|Ndao|Sy|Wade|Traoré|Keita|Coulibaly|Diarra|Sissoko|Doumbia|Konaté|Sangaré|Samassékou'],
  ci: ['Yao|Kouassi|Wilfried|Serge|Franck|Jean-Philippe|Sébastien|Simon|Ibrahim|Seko|Nicolas|Odilon|Christian|Hamed|Jérémie|Emmanuel|André|Georges|Clinton|Marc|Jean|Patrick|Stéphane|Antoine',
    'Kouassi|Koné|Bamba|Touré|Yao|Kouamé|Diomandé|Sangaré|Konan|Kanga|Fofana|Aké|Akpa|Ngono|Essomba|Mvondo|Atangana|Ebanga|Mbarga|Abega|Bilong|Fotso|Kamga|Njoya'],
  ea: ['Michael|Victor|Eric|Brian|Kennedy|Joseph|Duncan|Collins|Masoud|Ayub|Kenneth|Clifton|Lawrence|Benson|Patrick|Anthony|Richard|Elvis|Moses|Dennis',
    'Otieno|Odhiambo|Mwangi|Omondi|Kamau|Ochieng|Onyango|Wekesa|Juma|Mutua|Njoroge|Kiprotich|Oduor|Owino|Ouma|Mburu|Wafula|Barasa|Cheruiyot|Wambua'],
  cd: ['Trésor|Glody|Fiston|Héritier|Merveille|Joël|Gaël|Christian|Jonathan|Ricky|Grâce|Dario|Amani|Yannick|Dieumerci|Cédric|Chancel|Arthur|Meschack|Silas|Théo|Jackson',
    'Kasongo|Ilunga|Ngoy|Mputu|Tshimanga|Lukusa|Mukoko|Kayembe|Makusu|Tshibola|Kalulu|Kabasele|Mulumba|Mpoku|Kabongo|Lokonga|Mbuyu|Kalonji|Nkongolo|Kanda'],
  zm: ['Collins|Moses|Joseph|Emmanuel|Gift|Evans|Given|Felix|Brian|Kelvin|Allan|Augustine|Benson|Spencer|Isaac|Freddy|Martin|Roy|Clifford|Edward',
    'Phiri|Banda|Mulenga|Mwansa|Chileshe|Kabwe|Lungu|Musonda|Chanda|Mwila|Sakala|Kangwa|Chama|Mbewe|Zulu|Tembo|Chansa|Ngoma|Kalunga|Bwalya']
};
// 새 구단 이름 접미어 [한국어, 영어]
const CLUB_SUFFIX_2 = {
  HE: ['코하브 바라크 아리 갈 샤하르 오페크 아이트 타마르', 'Kokhav|Barak|Ari|Gal|Shahar|Ofek|Ayit|Tamar'],
  SQ: ['일 루페 디엘리 우이쿠 스투히아 코메타 허나 발러', 'Yll|Rrufe|Dielli|Ujku|Stuhia|Kometa|Hëna|Valë'],
  FI: ['카르후 쿠르키 뮈르스키 태흐티 살라마 수시 쿠 알토', 'Karhu|Kurki|Myrsky|Tähti|Salama|Susi|Kuu|Aalto'],
  ET: ['태흐트 토름 코트카스 훈트 밸크 라이네', 'Täht|Torm|Kotkas|Hunt|Välk|Laine'],
  LV: ['즈바이그즈네 베트라 에르글리스 빌크스 지벤스 빌니스', 'Zvaigzne|Vētra|Ērglis|Vilks|Zibens|Vilnis'],
  LT: ['즈바이그주데 아우드라 에렐리스 빌카스 자이바스 아우슈라', 'Žvaigždė|Audra|Erelis|Vilkas|Žaibas|Aušra'],
  KA: ['바르스크블라비 카리 아르치비 므겔리 엘바 탈가 로미 므제', 'Varskvlavi|Kari|Artsivi|Mgeli|Elva|Talga|Lomi|Mze'],
  HY: ['아스트그 아르치브 가일 아레브 므리크 카이차크 알리크 아류츠', 'Astgh|Artsiv|Gayl|Arev|Mrrik|Kaytsak|Alik|Aryuts']
};
// 새 게임(세계 규칙 2)에서 더하는 해외 진출 국적 가중치. 기존 세이브의 기존 구단 선수는 예전 가중치 그대로
const EXPORT_WEIGHTS_2 = 'SEN:4 CIV:4 CMR:3 MLI:3 COD:2 KEN:1 ZAM:1 ANG:1 BIH:2 MNE:1 MKD:1 ALB:2 SVN:1 SVK:1 BUL:1 GEO:2 ARM:1 AZE:1 ISR:1 FIN:1 ISL:1 WAL:1 NIR:1 JAM:2 HON:1 PAN:1 KAZ:1 LTU:1 LVA:1 EST:1 BLR:1 MDA:1 CYP:1 LUX:1 GUA:1 SLV:1 IRQ:1 JOR:1 IND:1 NZL:1 MAS:1 MLT:1 FRO:1 KUW:1 OMA:1 BHR:1 SGP:1';
// 새 이름 풀에서 실존 유명 선수와 겹치는 조합
const BLOCKED_NAMES_2 = '도르_페레츠 다니엘_페레츠 아비_코헨 니르_비톤 요나탄_코헨 마르틴_페트로프 게오르기_이바노프 니콜라이_미하일로프 토도르_야네프 크리스티안_디미트로프 아르민_호지치 알렉산다르_트라이코프스키 스테판_리스토프스키 다르코_벨코프스키 블라트코_스토야노프스키 스테판_스피로프스키 발론_베리샤 아르디안_이스마일리 안티_니에미 니코_해맬래이넨 귈비_시귀르드손 아론_군나르손 비르키르_비야르나손 라그나르_시귀르드손 카우리_아우르나손 요한_그뷔드뮌드손 회르뒤르_마그뉘손 알베르트_그뷔드뮌드손 아르노르_시귀르드손 스베리르_잉가손 리스_윌리엄스 에런_휴스 이완_로버츠 안드레이_아지우스 스티브_보르그 잭_무스카트 마리우스_스탄케비치우스 에드가라스_얀카우스카스 도나타스_카즐라우스카스 게보르크_가자랸 아르타크_그리고랸 토랄_바이라모프 에민_마흐무도프 엘빈_맘마도프 로히트_샤르마 무사_시소코 세이두_케이타 마마두_디아라 파페_사르 파페_게예 압둘라예_디알로 무사_코나테 이브라히마_코나테 이브라히마_상가레 세이두_둠비아 부바카르_트라오레 아다마_트라오레 아마두_디알로 마마두_사르 파페_시세 무사_은디아예 이브라히마_니앙 세코_포파나 크리스티앙_쿠아메 윌프리드_캉가 이브라힘_상가레 에릭_오몬디 트레소르_음푸투 크리스티앙_카바셀레 이매뉴얼_반다';

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
const OLD_COUNTRIES = COUNTRY_DATA.length; // 11단계까지 있던 58개국
// 나라: 11단계까지 있던 부(oldTiers) 뒤에 늘린 부(MORE_TIERS)를 붙임. 새 나라는 모든 부가 새 부
const COUNTRIES = [...COUNTRY_DATA, ...COUNTRY_DATA_2].map(([id, name, region, pool, suffix, level, tiers, cities], i) => {
  const en = COUNTRY_EN[id] || COUNTRY_EN_2[id];
  const more = MORE_TIERS[id] || [[], '', ''];
  return {
    i, id, ko: name, en: en[0], region, pool, suffix, level, tiers: tiers.concat(more[0]), oldTiers: i < OLD_COUNTRIES ? tiers.length : 0,
    cities: cities.split(' '), citiesEn: en[1].split('|'), towns: more[1] ? more[1].split(' ') : [], townsEn: more[2] ? more[2].split('|') : [], clubs: [],
    get name() { return LANG === 'en' ? this.en : this.ko; }
  };
});
const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
const NAME_ALL = { ...NAME_DATA, ...NAME_DATA_2 };
const NAME_ALL_EN = { ...NAME_EN, ...NAME_EN_2 };
const NAMES = Object.fromEntries(Object.entries(NAME_ALL).map(([k, [order, first, last]]) =>
  [k, { order, first: first.split(' '), last: last.split(' '), firstEn: NAME_ALL_EN[k][0].split('|'), lastEn: NAME_ALL_EN[k][1].split('|') }]));
const NEW_POOLS = new Set(Object.keys(NAME_DATA_2));
const BLOCKED_NEW = new Set(BLOCKED_NAMES_2.split(' ').map(n => n.replace(/_/g, ' ')));
const weightsList = text => text.split(' ').flatMap(s => {
  const [id, w] = s.split(':');
  return Array(Number(w)).fill(id);
});
const EXPORTERS = weightsList(EXPORT_WEIGHTS); // 11단계까지의 해외 진출 국적 (예전 세이브의 기존 구단 선수는 이대로)
const EXPORTERS_ALL = EXPORTERS.concat(weightsList(EXPORT_WEIGHTS_2));
const suffixOf = key => (CLUB_SUFFIX[key] ? [CLUB_SUFFIX[key].split(' '), CLUB_SUFFIX_EN[key].split('|')] : [CLUB_SUFFIX_2[key][0].split(' '), CLUB_SUFFIX_2[key][1].split('|')]);

// 부별 평균 수준: 5대 리그는 1~4부 7씩, 5·6부 5씩 낮아짐. 나머지는 2부 8, 3부 6, 4부 5 (11단계까지 있던 부는 예전과 같음)
const TIER_DROP = [[0, 7, 14, 21, 26, 31], [0, 8, 14, 19]];
const tierLevel = (country, t) => country.level - TIER_DROP[country.i < BIG5 ? 0 : 1][t];
const leagueName = (country, t) => L(`${country.name} ${t + 1}부`, `${country.name} Div. ${t + 1}`);

// 구단: 부별로 강한 순서, 큰 도시부터 배정. 11단계까지 있던 구단(번호 0~2001)은 그때와 같은 순서·같은 난수로 먼저 만들고(세이브 호환),
// 늘린 부와 새 나라 구단은 그 뒤 번호로 붙임. t0 = 처음 부(선수를 만들 때 씀), t = 지금 부
const CLUBS = [];
const makers = COUNTRIES.map(country => {
  const [suffixes, suffixesEn] = suffixOf(country.suffix);
  return { r: rng(hash(WORLD_SEED, country.i)), used: new Set(), n: 0, m: 0, suffixes, suffixesEn };
});
function addClub(country, t, k, size, ko, en, r, list) {
  const club = { id: CLUBS.length, ko, en, country, t, t0: t, rank: k, off: 6 - (12 * k) / Math.max(1, size - 1) + (r() - 0.5) * 2, get name() { return LANG === 'en' ? this.en : this.ko; } };
  CLUBS.push(club);
  list.push(club);
}
for (const country of COUNTRIES) {
  const mk = makers[country.i];
  for (let t = 0; t < country.oldTiers; t++) {
    const size = country.tiers[t];
    const list = [];
    for (let k = 0; k < size; k++, mk.n++) {
      const city = country.cities[mk.n % country.cities.length];
      let si = Math.floor(mk.r() * mk.suffixes.length);
      let name = `${city} ${mk.suffixes[si % mk.suffixes.length]}`;
      while (mk.used.has(name)) name = `${city} ${mk.suffixes[++si % mk.suffixes.length]}`;
      mk.used.add(name);
      addClub(country, t, k, size, name, `${country.citiesEn[mk.n % country.cities.length]} ${mk.suffixesEn[si % mk.suffixes.length]}`, mk.r, list);
    }
    country.clubs.push(list);
  }
}
const OLD_CLUBS = CLUBS.length; // 2,002
// 늘린 부·새 나라: 작은 도시(towns)부터 쓰고 모자라면 큰 도시에 두 번째 구단. 한 도시의 접미어를 다 쓰면 다음 도시로
for (const country of COUNTRIES) {
  const mk = makers[country.i];
  const ko = country.towns.concat(country.cities);
  const en = country.townsEn.concat(country.citiesEn);
  const len = mk.suffixes.length;
  for (let t = country.oldTiers; t < country.tiers.length; t++) {
    const size = country.tiers[t];
    const list = [];
    for (let k = 0; k < size; k++) {
      let si = Math.floor(mk.r() * len);
      let tries = 0;
      while (mk.used.has(`${ko[mk.m % ko.length]} ${mk.suffixes[si % len]}`)) {
        si += 1;
        if (++tries % len === 0) mk.m += 1;
      }
      const c = mk.m % ko.length;
      const name = `${ko[c]} ${mk.suffixes[si % len]}`;
      mk.used.add(name);
      mk.m += 1;
      addClub(country, t, k, size, name, `${en[c]} ${mk.suffixesEn[si % len]}`, mk.r, list);
    }
    country.clubs.push(list);
  }
}
// 13단계 승강: 나라별 구단 전체(처음 부·순위 순, 바뀌지 않음). 지금 부(club.t)와 부별 명단(country.clubs)은 state.tierOf로 다시 만듦
for (const country of COUNTRIES) country.all = country.clubs.flat();
const START_TIERS = CLUBS.map(c => c.t0).join(''); // 처음 부 배치 (새 게임, 예전 세이브)
const SLOTS = CLUBS.length * SQUAD;
const OLD_SLOTS = OLD_CLUBS * SQUAD; // 48,048: 11단계까지의 세이브 크기
// 세계 규칙: state.wv 2 = 12단계 이후 새 게임, 1 = 예전 세이브(기존 구단 선수는 예전 규칙 그대로 만들어 같은 선수가 됨)
const oldRules = s => s < OLD_SLOTS && state.wv < 2;
const abilityFloor = s => (oldRules(s) ? 40 : 30); // 하부 리그가 깊어져 능력 하한을 30으로 (예전 선수는 40)
const CLUB_BY_KO = new Map(CLUBS.map(c => [c.ko, c])); // 저장된 한국어 구단 이름 → 구단 (기억 문구 번역용)

// ===== 4. 선수: 시드·슬롯·세대가 같으면 항상 같은 선수 =====
const AGE_ADJ = [-10, -8, -6, -4.5, -3, -2, -1, -0.5, -0.5, 0, 0, 0, 0, 0, -1, -2, -3, -4.5]; // 17~34세

// 생성 당시 나이: 첫 세대 17~34세(25세 전후가 많음), 빈자리에 들어온 새 선수 17~23세
const creationAge = (r, g) => (g === 0 ? 17 + Math.floor(((r() + r()) / 2) * 18) : 17 + Math.floor(r() * 7));

// 시즌 말 이탈 확률(나이별): 은퇴·하부 리그 이동을 합친 값. 30시즌 동안 나이 분포가 안정되도록 맞춤
const leaveChance = age => (age <= 22 ? 0.02 : age <= 29 ? 0.03 : age <= 32 ? 0.07 : age === 33 ? 0.15 : age === 34 ? 0.3 : age === 35 ? 0.5 : age === 36 ? 0.75 : 1);

// 국적: 처음 구단(club = 슬롯의 원래 구단)과 처음 부 기준. 새 게임은 새 나라 선수도 해외 리그로 진출
function nationalityFor(club, r) {
  const c = club.country;
  const domestic = c.i < BIG5 ? (club.t0 === 0 ? 0.55 : 0.75) : (club.t0 === 0 ? 0.82 : 0.9);
  if (r() < domestic) return c;
  const list = club.id < OLD_CLUBS && state.wv < 2 ? EXPORTERS : EXPORTERS_ALL;
  let id;
  do id = pick(list, r); while (id === c.id);
  return COUNTRY_BY_ID[id];
}

const koName = (pool, fi, li) => (pool.order === 'join' ? pool.last[li] + pool.first[fi] : pool.order === 'lf' ? `${pool.last[li]} ${pool.first[fi]}` : `${pool.first[fi]} ${pool.last[li]}`);
// 이름 키 "풀|이름 번호|성 번호" → 지금 언어 이름 (은퇴한 선수 이름도 언어를 바꾸면 같이 바뀌게 저장해 둠)
function nameFromKey(key) {
  const [k, fi, li] = String(key).split('|');
  const pool = NAMES[k];
  if (!pool || pool.first[fi] === undefined || pool.last[li] === undefined) return '';
  if (LANG !== 'en') return koName(pool, fi, li);
  return EN_FAMILY_FIRST.has(k) ? `${pool.lastEn[li]} ${pool.firstEn[fi]}` : `${pool.firstEn[fi]} ${pool.lastEn[li]}`;
}
// 실존 유명 선수와 겹치면 다시 뽑음 (한국어 이름으로 확인). 난수를 쓰는 순서는 예전과 같음
function makeName(country, r) {
  const pool = NAMES[country.pool];
  let fi = 0;
  let li = 0;
  let name = '';
  for (let i = 0; i < 8; i++) {
    fi = Math.floor(r() * pool.first.length);
    li = Math.floor(r() * pool.last.length);
    name = koName(pool, fi, li);
    if (!BLOCKED_NAMES.has(name) && !(NEW_POOLS.has(country.pool) && BLOCKED_NEW.has(name))) break;
  }
  return { ko: name, key: `${country.pool}|${fi}|${li}` };
}

// 숫자 부분: 나이·능력·잠재력. 난수 순서를 바꾸면 기존 세이브의 선수가 바뀌므로 유지
function coreStats(s, r) {
  const w = state.world;
  const club = CLUBS[Math.floor(s / SQUAD)];
  const age0 = creationAge(r, w.gen[s]);
  const noise = (r() + r() + r() - 1.5) * 5 + (r() < 0.02 ? 6 : 0);
  const lo = abilityFloor(s);
  const base = clamp(Math.round(tierLevel(club.country, club.t0) + club.off + AGE_ADJ[age0 - 17] + noise), lo, 90);
  const headroom = Math.max(0, 24 - age0) * (0.8 + r() * 1.6) + r() * 3 + (r() < 0.03 ? 8 : 0);
  const pot = clamp(Math.round(base + headroom), base, 95);
  return { club, base, pot, ability: clamp(base + w.grow[s], lo, 90), birth: w.gseason[s] - age0 };
}

function getPlayer(s) {
  const w = state.world;
  const g = w.gen[s];
  const born = w.gseason[s]; // 이 세대가 등장한 시즌
  const r = rng(hash(state.seed, s, g));
  const core = coreStats(s, r);
  const nat = nationalityFor(core.club, r);
  const nm = makeName(nat, r);
  return { s, g, club: clubOf(s), nat, name: LANG === 'en' ? nameFromKey(nm.key) : nm.ko, ko: nm.ko, nk: nm.key, pos: POS_BY_SLOT[s % SQUAD], ability: core.ability, pot: core.pot, birth: core.birth, start: (born - 1) * WEEKS + 1 };
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
// 13단계: 23세 이하는 출전 비율(mins, 0~1)도 반영. 그 나이 평균 출전(TUNE.minutesMid)보다 많이 뛸수록 더 자람 (mins가 없으면 그대로)
function growthStep(age, ability, pot, avgForm, x, mins) {
  if (age <= 28) {
    const rate = age <= 20 ? 0.3 : age <= 23 ? 0.22 : 0.12;
    const formMul = 0.7 + ((avgForm - 1) / 9) * 0.6;
    const minsMul = age <= 23 && mins !== undefined ? 1 + TUNE.minutesGrow * (mins - TUNE.minutesMid[clamp(age, 17, 23) - 17]) : 1;
    return Math.max(0, Math.min(pot - ability, Math.round((pot - ability) * rate * formMul * minsMul * (0.6 + x * 0.8))));
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
const weekLabel = abs => L(`${Math.floor((abs - 1) / WEEKS) + 1}시즌 ${((abs - 1) % WEEKS) + 1}주`, `S${Math.floor((abs - 1) / WEEKS) + 1} W${((abs - 1) % WEEKS) + 1}`);

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
    version: SAVE_VERSION, seed, season: 1, week: 1, wv: 2, tierOf: START_TIERS, cont: null,
    agencyCash: TUNE.soloCash, rep: START_REP, ap: TUNE.soloAp, debtWeeks: 0, over: false, founded: false,
    personalCash: 0, invest: newInvest(), items: [], scouted: {}, watch: [], alumni: [], intros: {},
    news: [], needs: [], deals: newDeals(),
    clients: [], cooldowns: {}, logs: [], summary: null, moved: {}, events: [], nextEventId: 1,
    natCut: {}, stats: newCareerStats(),
    ui: { ...DEFAULT_UI },
    world: newWorld(seed)
  };
  applyTiers();
  state.natCut = computeNatCut();
  state.clients = pickStartingClients();
  const who = listText(state.clients.map(c => `${getPlayer(c.s).name} (${phrase(c.how)})`));
  addLog(L(`에이전트 자격을 따고 혼자 일을 시작했습니다. ${who}의 대리인이 됐습니다. 회사는 아직 없습니다.`,
    `You earned your agent licence and started out on your own, representing ${who}. There is no company yet.`));
  // 1시즌 1주는 여름 이적 기간 중이라 구단들이 이미 보강을 찾고 있음
  if (windowAt()) refreshNeeds(windowAt());
  saveState();
}
// 이번 이적 기간 결산: 이적 건수, 가장 비싼 이적(이름·이적료·데려간 구단)
const newDeals = () => ({ n: 0, fee: 0, nm: '', nk: '', to: -1 });

// 시작 선수와의 인연: 혼자 시작하는 에이전트가 처음 맡는 두 사람은 아는 사이
const START_TIES = [M('고향 후배', 'a kid from your hometown'), M('대학 은사의 제자', "your old professor's protégé"), M('동네 축구교실에서 가르친 아이', 'a kid you coached at the local football school'),
  M('친구의 동생', "your friend's younger brother"), M('단골 식당 사장님의 아들', "the son of your favourite restaurant's owner"), M('고등학교 축구부 후배', 'a junior from your high-school team')];

// 시작 선수 두 명: 한국 국적, 능력 45~66, 유망주 1·중견 1, 능력 62 이상과 GK는 1명까지
function pickStartingClients() {
  const r = rng(hash(state.seed, 99));
  const kor = COUNTRY_BY_ID.KOR;
  const pool = [];
  for (const club of kor.all) {
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
      return age >= lo && age <= hi && !chosen.includes(p) && !chosen.some(c => c.ko === p.ko)
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
// hunt = 이적 요청을 받아 새 구단을 알아보는 마감 절대 주차 (0 = 안 알아봄), pitch = 추천해 둔 구단 { club, until } (10단계)
const newClient = (p, end, sat, bond, how) => ({
  s: p.s, g: p.g, end, wage: weeklyWage(p.ability), sat, met: 0, negUntil: 0, warned: 0,
  st: newStint(p.club, worldStats(p, state.week)), hist: [], playRate: 0.6, capped: false,
  bond, since: absWeek(), how, memo: [], tales: [], hunt: 0, pitch: null, out: null, lw: null, loan: null, noLoan: 0
});
// 에이전시 커리어 통계 (기록 탭·시뮬레이션용)
const newCareerStats = () => ({ lost: 0, transfers: 0, dream: 0, callups: 0, renewTry: 0, renewWin: 0, signed: 0, loans: 0, loanBuys: 0 });

function addLog(text) {
  state.logs.unshift(`${L(`${state.season}시즌 ${state.week}주`, `S${state.season} W${state.week}`)} · ${text}`);
  if (state.logs.length > 80) state.logs.length = 80;
}

// ===== 6. 주간 진행 =====
const GAME_OVER = () => L('파산한 게임입니다', 'This game has ended in bankruptcy');
const MINE = n => L(`내 선수 ${n}`, `Mine ${n}`);
const BACK = () => L('← 돌아가기', '← Back');
const NOT_CLIENT = () => L('소속 선수가 아닙니다', "He isn't your client");
const NO_AP = () => L('이번 주 행동력(AP)을 다 썼습니다', "You've used all your action points (AP) this week");
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

  const closing = isDeadline() ? windowAt() : null; // 지난주가 마감일이었으면 이번 주에 이적 기간이 닫힘
  state.week += 1;
  if (state.week > WEEKS) endSeason();
  state.ap = weeklyAp();
  const now = absWeek();
  for (const key of Object.keys(state.cooldowns)) if (state.cooldowns[key] <= now) delete state.cooldowns[key];
  for (const key of Object.keys(state.intros)) if (state.intros[key] <= now) delete state.intros[key];
  const week = weeklyClients();
  const open = windowAt();
  if (open && state.week === open.from) refreshNeeds(open);
  if (open) worldSignings(open);

  addLog(week.lines.length ? L(`경기: ${week.lines.join(', ')}`, `Matches: ${week.lines.join(', ')}`) : L('이번 주 소속 선수 경기 없음', 'No matches for your players this week'));
  addLog(L(`정산 ${signedCash(income - upkeep - fixed)} (수수료 ${cash(income)}, 운영비 ${cash(upkeep)}${fixed ? `, 투자 유지비 ${cash(fixed)}` : ''})`,
    `Weekly balance ${signedCash(income - upkeep - fixed)} (commission ${cash(income)}, running costs ${cash(upkeep)}${fixed ? `, investment upkeep ${cash(fixed)}` : ''})`));
  // 이적 시장 소식은 정산 다음에 남겨서 내 선수 탭 맨 위에 보이게
  const win = windowAt();
  if (closing) {
    addLog(L(`${closing.name}이 끝났습니다. 다음은 ${nextWindow().win.name}(${nextWindow().win.from}주부터)입니다. 그때까지는 무소속 선수 제안만 옵니다.`,
      `The ${closing.name} has closed. Next up is the ${nextWindow().win.name} (from week ${nextWindow().win.from}). Until then, only free agents get offers.`));
    pushNews({ k: 'close', win: WINDOWS.indexOf(closing), n: state.deals.n, fee: state.deals.fee, nm: state.deals.nm, nk: state.deals.nk, to: state.deals.to });
    state.needs = [];
  }
  if (win && state.week === win.from) addLog(L(`${win.name}이 열렸습니다. 마감은 ${weekLabel(windowEnd(win))}이고, 마감 주에는 막판 제안이 몰립니다.`,
    `The ${win.name} is open. The deadline is ${weekLabel(windowEnd(win))}, and last-minute bids pile up in that final week.`));
  if (isDeadline()) addLog(L(`이적 마감일입니다. 이번 주가 지나면 ${win.name}이 닫힙니다. 막판 제안은 이번 주 안에 답해야 합니다.`,
    `It's deadline day. The ${win.name} shuts after this week, so last-minute bids must be answered now.`));
  // 13단계 시즌 고비: 지난주가 컵 결승·대륙 대회 결승·리그 마지막 라운드였으면 우승·승강 소식 (기록 맨 위에 보이게 마지막에)
  const last = state.week - 1;
  if (last === CUP_WEEKS[CUP_WEEKS.length - 1]) cupFinale();
  if (last === CONT_WEEKS[CONT_WEEKS.length - 1]) contFinale();
  let bids = 0;
  if (last === LEAGUE_WEEKS) {
    leagueFinale();
    bids = loanBids(); // 17단계: 리그가 끝나면 임대 구단이 완전 이적을 제안할지 정함
  }
  checkDebt();
  saveState();
  return week.added + bids;
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
    addLog(L(`자금 마이너스가 ${DEBT_LIMIT}주 이어져 에이전시가 파산했습니다.`, `Your cash stayed negative for ${DEBT_LIMIT} weeks. The agency has gone bankrupt.`));
  } else {
    addLog(L(`자금이 마이너스입니다 (평판 -1). ${DEBT_LIMIT - state.debtWeeks}주 안에 흑자로 돌리지 못하면 파산합니다.`,
      `Cash is negative (reputation -1). Get back into the black within ${pl(DEBT_LIMIT - state.debtWeeks, 'week')} or the agency goes bankrupt.`));
  }
}

// 시즌 말 결산용: 이번 시즌 리그 경기를 가장 많이 뛴 구단의 최종 순위와 승강, 뛴 대회 중 우승한 것 (시즌을 넘기기 전에 계산)
// { c: 나라, t: 부, rk: 순위, n: 팀 수, mv: 승격 1·강등 -1, tr: ['L0'(1부 우승)·'L2'(3부 우승)·'C'(컵)·'K'(대륙 대회)] }, 리그에서 못 뛰었으면 null
// 리그 우승은 그 구단에서 리그 5경기 이상, 컵·대륙 대회 우승은 그 대회 1경기 이상 뛰었을 때만. 승강은 시즌 끝에도 그 구단 소속일 때만(무소속·이적했으면 빼고)
function seasonFinish(c) {
  const stints = [c.st, ...c.hist.filter(h => h.season === state.season)];
  const main = stints.reduce((a, b) => (b.L[0] > a.L[0] ? b : a));
  if (!main.L[0]) return null;
  const club = CLUBS[main.club];
  const row = tableRow(club, finalTable(club.country, club.t));
  const zone = zoneOf(club.country, club.t, row.rk);
  // 승강은 다음 시즌에도 그 구단에서 뛸 때만: 이번 시즌으로 임대가 끝나면 소속 구단으로 돌아가니 임대 구단 승강은 관계없고,
  // 임대 구단에 완전 이적했으면(17단계) 그 구단 승강이 선수 일
  const next = c.loan && loanEnding(c) ? homeClub(c.s) : clubOf(c.s);
  const still = !isFreeAgent(c) && next === club;
  const tr = [];
  for (const st of stints) {
    const at = CLUBS[st.club];
    if (st.L[0] >= 5 && tableRow(at, finalTable(at.country, at.t)).rk === 1) tr.push(`L${at.t}`);
    if (st.C[0] && compRun(at, 'C').won) tr.push('C');
    if (st.K[0] && compRun(at, 'K').won) tr.push('K');
  }
  return { c: club.country.i, t: club.t, rk: row.rk, n: club.country.tiers[club.t], mv: !still ? 0 : zone === 'up' ? 1 : zone === 'down' ? -1 : 0, tr: [...new Set(tr)], ln: main.ln ? 1 : 0 };
}

// 시즌 말: 평균 폼 확정, 성장·하락, 나이 +1(시즌에서 계산), 승강, 은퇴와 새 선수 교체, 평판 반영, 결산 작성
function endSeason() {
  const w = state.world;
  const before = state.clients.map(c => {
    const p = getPlayer(c.s);
    const L = c.st.L;
    return { name: p.ko, nk: p.nk, age: ageOf(p), ability: p.ability, value: valueOf(p), apps: L[0], goals: L[1], rating: L[0] ? L[3] / L[0] / 10 : 0, caps: c.st.N[0], nat: p.nat.id, fin: seasonFinish(c) };
  });
  for (const c of state.clients) archiveStint(c);
  for (let s = 0; s < SLOTS; s++) {
    w.favg[s] = Math.round((w.fsum[s] / WEEKS) * 2);
    w.fsum[s] = 0;
  }

  // 성장·하락: 이번 시즌 나이와 평균 폼 기준. 소속 선수는 피지컬 코치 효과를 더함
  // 23세 이하는 출전 비율도 반영: 소속 선수는 최근 출전 비율(playRate), 세계 선수는 지금 구단에서의 출전 확률
  // 같은 반복에서 국가대표 기준용 국적·능력도 모음 (선수 전체를 두 번 읽지 않게)
  const rg = rng(hash(state.seed, 6, state.season));
  const natIdx = new Uint8Array(SLOTS);
  const abil = new Uint8Array(SLOTS);
  const coached = new Set(state.invest.coach ? state.clients.map(c => c.s) : []);
  const minutes = new Map(state.clients.map(c => [c.s, c.playRate]));
  let coachGain = 0; // 코치 덕분에 더 오르거나 덜 내려간 능력 합계 (결산 창에 표시)
  for (let s = 0; s < SLOTS; s++) {
    const r = rng(hash(state.seed, s, w.gen[s]));
    const c = coreStats(s, r);
    const age = state.season - c.birth;
    const mins = age > 23 ? undefined : minutes.has(s) ? minutes.get(s) : startChance(c.ability, clubLevel(clubOf(s)), 5.5);
    let step = growthStep(age, c.ability, c.pot, w.favg[s] / 2, rg(), mins);
    if (coached.has(s)) {
      const plain = step;
      step = coachStep(step, c.pot - c.ability);
      coachGain += step - plain;
    }
    const lo = abilityFloor(s);
    w.grow[s] = clamp(w.grow[s] + step, lo - c.base, 90 - c.base);
    abil[s] = clamp(c.base + w.grow[s], lo, 90);
    natIdx[s] = nationalityFor(c.club, r).i;
  }

  // 13단계 승강: 마지막 순위표로 부를 바꾸고 다음 시즌 대륙 대회 참가 구단을 정함 (5대 리그 1부·대륙 대회 우승은 결산 창에)
  const champs = COUNTRIES.slice(0, BIG5).map(country => finalTable(country, 0)[0].club.id);
  const contWin = CONT_GROUPS.map(group => contOf(group).final).filter(Boolean).map(f => f.club);
  const moves = seasonMoves();
  state.week = 1;
  state.season += 1;
  state.tierOf = moves.tierOf;
  state.cont = moves.cont;
  applyTiers();

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
      if (scout) state.alumni.push({ name: before[i].name, nk: before[i].nk, nat: before[i].nat, season: state.season - 1 });
      rows.push({ name: before[i].name, nk: before[i].nk, ageFrom: before[i].age, retired: true, farewell, scout, seasons, bond: c.bond, rep, nat: before[i].nat, fin: before[i].fin });
      return false;
    }
    if (c.loan && c.loan.until < absWeek()) endLoan(c, false); // 15단계: 임대는 시즌 끝에 돌아옴
    const p = getPlayer(c.s);
    const value = valueOf(p);
    const b = before[i];
    rows.push({ name: p.ko, nk: p.nk, ageFrom: b.age, ageTo: ageOf(p), abilityFrom: b.ability, abilityTo: p.ability, valueFrom: b.value, valueTo: value, apps: b.apps, goals: b.goals, rating: b.rating, caps: b.caps, fin: b.fin });
    // 다음 시즌 끝까지인 임대(여름 이적 기간 뒤쪽에 감)는 새 시즌 기록도 임대 구간 (빠지면 돌아올 때 47~52주 구간의 0경기로 셈)
    c.st = c.loan ? { ...newStint(p.club), ln: 1 } : newStint(p.club);
    valueFrom += before[i].value;
    valueTo += value;
    return true;
  });

  applyLoans(); // 은퇴한 선수의 임대 정리
  state.natCut = natCutFrom(natIdx, abil, gone); // 새로 들어온 17~23세는 대표팀 기준에서 뺌
  // 평판: 소속 선수 몸값 합계 변화율 × 10 (±3까지)
  const repChange = valueFrom > 0 ? clamp(Math.round(((valueTo - valueFrom) / valueFrom) * 10), -3, 3) : 0;
  if (repChange > 0) gainRep(repChange);
  else state.rep = Math.max(0, state.rep + repChange);
  state.summary = { season: state.season - 1, rows, retired, repChange, coachGain, champs, contWin, seen: false };
  addLog(L(`${state.season - 1}시즌 종료. 평판 ${repChange >= 0 ? '+' : ''}${repChange}. 세계에서 ${num(retired)}명이 은퇴하거나 떠나고 새 선수가 들어왔습니다. 승격·강등한 구단은 새 시즌부터 바뀐 부에서 뜁니다.`,
    `Season ${state.season - 1} is over. Reputation ${repChange >= 0 ? '+' : ''}${repChange}. Around the world, ${num(retired)} players retired or left and new ones arrived. Promoted and relegated clubs start the new season in their new divisions.`));
}

// ===== 영입·해지 =====
const recruitCost = p => Math.round((500 + weeklyWage(p.ability)) / 100) * 100;

// 성공 확률: 평판이 선수 수준((능력-40)×2)보다 높을수록 오름, 21세 이하 +10, 스카우트망 보너스, 내 선수가 소개한 후배 +, 5~90%
const recruitChance = p => clamp(Math.round(60 + state.rep - (p.ability - 40) * 2 + (ageOf(p) <= 21 ? 10 : 0) + TUNE.scoutRecruit[state.invest.scout] + (introActive(p) ? TUNE.introBonus : 0)), 5, 90);

// 영입을 막는 이유 (없으면 빈 문자열)
function recruitBlock(p) {
  if (state.over) return GAME_OVER();
  if (state.clients.some(c => c.s === p.s)) return L('이미 소속 선수입니다', 'He is already your client');
  if (state.clients.length >= clientLimit()) {
    if (!state.founded) return L(`혼자서는 ${TUNE.soloLimit}명까지 맡을 수 있습니다. 에이전시 탭에서 회사를 세우면 ${TUNE.limitBase}명이 됩니다`,
      `On your own you can manage ${TUNE.soloLimit} players. Found a company in the Agency tab to raise that to ${TUNE.limitBase}`);
    return L(`소속 선수가 한도(${clientLimit()}명)에 찼습니다. 평판 ${TUNE.limitStep}마다 1명씩 늘어납니다 (최대 ${TUNE.limitMax}명)${state.invest.office ? '' : '. 에이전시 탭의 사무실 확장으로 1명 더 맡을 수 있습니다'}`,
      `Your roster is full (${clientLimit()} players). Every ${TUNE.limitStep} reputation adds one more slot (up to ${TUNE.limitMax})${state.invest.office ? '' : '. A bigger office in the Agency tab adds one more'}`);
  }
  if (state.ap < 1) return NO_AP();
  if (state.agencyCash < 0) return L('자금이 마이너스라 영입할 수 없습니다', "You can't sign anyone while your cash is negative");
  if (state.agencyCash < recruitCost(p)) return L(`자금이 부족합니다 (${cash(recruitCost(p))} 필요)`, `Not enough cash (${cash(recruitCost(p))} needed)`);
  const until = state.cooldowns[cooldownKey(p)];
  if (until > absWeek()) return L(`거절당한 선수입니다. ${until - absWeek()}주 뒤 다시 제안할 수 있습니다`, `He turned you down. You can try again in ${pl(until - absWeek(), 'week')}`);
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
    const how = !state.founded ? MEMO.howSolo : state.scouted[cooldownKey(p)] ? MEMO.howScout : MEMO.howCall;
    state.clients.push(newClient(p, contractEnd(p, absWeek()), 75, state.founded ? TUNE.bondNew : TUNE.bondSolo, how));
    state.watch = state.watch.filter(k => k !== cooldownKey(p));
    state.stats.signed += 1;
    const got = gainRep(gain);
    const reveal = lo === hi ? '' : L(` 잠재력은 ${p.pot}였습니다 (보이던 범위 ${lo}~${hi}).`, ` His potential turned out to be ${p.pot} (the visible range was ${lo}–${hi}).`);
    addLog(L(`${p.name} 영입 성공 (비용 ${cash(cost)}, 평판 +${got}).${reveal}`, `Signed ${p.name} (cost ${cash(cost)}, reputation +${got}).${reveal}`));
    toast(lo === hi ? L(`${p.name} 선수와 계약했습니다.`, `You signed ${p.name}.`) : L(`${p.name} 선수와 계약했습니다. 잠재력은 ${p.pot}입니다.`, `You signed ${p.name}. His potential is ${p.pot}.`));
  } else {
    state.cooldowns[cooldownKey(p)] = absWeek() + RETRY_WEEKS;
    addLog(L(`${p.name} 영입 실패 (비용 ${cash(cost)}). ${RETRY_WEEKS}주 뒤 다시 제안할 수 있습니다.`, `${p.name} turned you down (cost ${cash(cost)}). You can try again in ${pl(RETRY_WEEKS, 'week')}.`));
    toast(L('영입 제안이 거절됐습니다.', 'Your offer was turned down.'));
  }
  saveState();
}

function release(s) {
  const i = state.clients.findIndex(c => c.s === s);
  if (i < 0) return false;
  const p = getPlayer(s);
  if (!confirm(L(`${p.name} 선수와 계약을 해지할까요? 평판이 1 내려갑니다.`, `End your contract with ${p.name}? Your reputation drops by 1.`))) return false;
  state.clients.splice(i, 1);
  applyLoans();
  state.events = state.events.filter(e => e.s !== s || e.type === 'tip');
  state.rep = Math.max(0, state.rep - 1);
  addLog(L(`${p.name} 선수와 계약을 해지했습니다 (평판 -1).`, `You ended your contract with ${p.name} (reputation -1).`));
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
  // renewBase: 13단계에서 [80, 55, 30] → [76, 51, 26]. 이적 요청으로 아래 수준 구단에 가서 구단 수준보다 잘하는 선수가 늘어 재계약이 쉬워져서(77% → 74%)
  renewWindow: 26, renewRetry: 2, renewBase: [76, 51, 26],
  transferCut: 0.02, dealShare: 0.25,
  eventTtl: 2, eventMax: 3,
  // offerBase: 13단계에서 0.018 → 0.015. 이적 요청을 받아 알아보면 아래 수준 구단도 제안해 이적이 늘어서(시즌당 2.1건 → 1.8건)
  // 17단계에서 0.015 → 0.014. 임대 뒤 완전 이적이 이적 길을 하나 더 열어서(400판: 시즌당 2.08건 → 1.90건)
  // offerFirst: 첫 시즌 첫 이적 보너스. 7단계부터 혼자 시작해 선수가 2~3명뿐이라 0.06 → 0.12.
  // 9단계부터 이적 기간(22주부터 11주)에만 붙어서 0.12 → 0.25 (1시즌 안 첫 이적·회사 설립을 8단계 수준으로)
  offerBase: 0.014, offerStar: 0.025, offerForm: 0.015, offerFree: 0.1, offerYouth: 0.02, offerFirst: 0.25, dreamChance: 0.02, dreamReach: 4, offerRespect: 0.5,
  consentBase: 50, consentStep: 12,
  // poachStar: 몸값 $300만 이상 스타를 노리는 다른 에이전시. 7단계에서 유대가 시험받는 순간을 늘리려고 0.002 → 0.004
  playtimeChance: 0.09, raiseChance: 0.08, poachBase: 0.0018, poachStar: 0.004, poachLow: 0.04, sponsorChance: 0.05, snsChance: 0.008,
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
  taleChance: 0.05, introBonus: 15, introWeeks: 26, farewellBond: 60, alumniBond: 70, alumniMax: 5,
  // 9단계 이적 시장: 계약 중인 선수의 이적 제안은 이적 기간에만, 기간 안에는 windowBoost배, 마감 주는 deadlineBoost배 더(막판 제안)
  // 이적 요청: 지금 구단 조건 점수가 askFit 이하인 선수가 이적 기간에 askChance 확률로 새 구단을 찾아 달라고 함.
  // 알아봐 주면 마감까지 그 선수 제안이 huntBoost배, 마감까지 못 찾으면 만족 -huntMiss
  windowBoost: 2.6, deadlineBoost: 2, askFit: -2, askChance: 0.04, huntBoost: 1.8, huntMiss: 3,
  // 10단계 세계 뉴스: 이적 기간이 열리면 구단 needSample곳을 살펴, 주전 평균이 구단 수준보다 needGap 이상 낮은 포지션을 "보강 필요"로 (최대 needMax곳,
  // 그중 needNews곳은 뉴스로). 이적 기간 매주 signWeek건(마감 주는 deadlineBoost배) 세계 이적이 실제로 일어남.
  // 내 선수 제안이 보강이 필요한 구단에서 올 확률 needOffer, 추천(1 AP)하면 마감까지 그 선수 제안 pitchBoost배·그 구단에서 올 확률 pitchClub
  // pitchBoost 1.5면 시즌당 이적 2.25건(목표 2건 이하)이라 1.2. 이적이 늘어 선수를 덜 잃어서 windowBoost 2.8 → 2.6, poachBase 0.0015 → 0.0018
  needSample: 400, needGap: 2, needMax: 40, needNews: 6, signWeek: 3, needOffer: 0.5, pitchBoost: 1.2, pitchClub: 0.7, newsMax: 60,
  // 13단계 경기 결과: 한 팀 평균 득점, 홈 이점, 전력 1 차이의 득점 기울기, 시즌 기세 폭(±). 1부 20팀 400시즌 시험에서
  // 경기당 2.75골, 홈 승 47%·무 23%·원정 승 30%, 우승 승점 82(38경기), 가장 강한 팀 우승 50%, 승격팀 잔류 55%, 한 부 차이 컵 이변 26%
  goalBase: 1.3, homeAdv: 0.3, goalStep: 0.12, formSpread: 2.5,
  // 시즌 고비의 만족 변화: 리그 우승, 승격, 강등(빼는 값), 컵·대륙 대회 우승. 우승하면 유대 +trophyBond
  titleSat: 5, upSat: 5, downSat: 6, cupSat: 4, trophyBond: 2,
  // 부상으로 빠지는 주 [최소, 최대] (전문 재활을 지원하면 절반으로).
  // 23세 이하 성장 × (1 + minutesGrow × (출전 비율 - 그 나이 평균)): minutesMid = 17~23세 세계 선수의 평균 출전 확률(새 게임에서 잰 값 0.21~0.56).
  // 세계 평균은 그대로이고, 17세가 주전으로 뛰면(97%) 성장 +23%, 23세가 벤치(8%)면 -14%
  injuryWeeks: [2, 6], minutesGrow: 0.3, minutesMid: [0.21, 0.26, 0.33, 0.39, 0.47, 0.51, 0.56],
  // 15단계 임대: 지금 구단 출전 확률이 loanBench 미만인 소속 선수만, 후보 구단은 수준이 능력 -loanRange ~ 능력(주전 가능)인 곳 loanPick곳.
  // 임대를 가면 만족 +loanSat·유대 +loanBond, 돌아올 때 리그 loanApps경기 이상 뛰었으면 유대 +loanBack
  loanBench: 0.45, loanRange: 6, loanPick: 3, loanSat: 5, loanBond: 3, loanBack: 2, loanApps: 10,
  // 17단계 임대 뒤 완전 이적: 리그가 끝난 다음 주(47주)에, 이번 시즌으로 임대가 끝나는 선수가 임대 구단에서 리그 buyApps경기 이상 뛰었으면
  // 그 구단이 완전 이적을 제안할 확률 = buyBase + (임대 동안 리그 평균 평점 - buyMid) × buyStep (0 ~ buyMax). 이적료는 몸값의 buyFee배.
  // 임대 선수 평균 평점은 가운데 6.53(10~90%: 6.20~6.82, 성실한 봇 200판)이라 절반쯤이 제안을 받음.
  // 돌아오게 하면: 남고 싶어 했으면 만족 -buyStaySat·유대 -buyStayBond, 돌아오고 싶어 했으면 만족 +buyBackSat·유대 +buyBackBond
  buyApps: 8, buyMid: 6.5, buyBase: 0.5, buyStep: 1.5, buyMax: 0.85, buyFee: [0.8, 1.1], buyStaySat: 4, buyStayBond: 3, buyBackSat: 2, buyBackBond: 2
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

// 소속 구단(계약한 구단): 이적한 선수는 moved[슬롯] = 구단 번호 (능력·이름은 처음 구단 기준 그대로)
const homeClub = s => CLUBS[state.moved[s] ?? Math.floor(s / SQUAD)];
// 15단계 임대: 소속 선수의 임대(c.loan)를 슬롯 → 임대 구단 번호로 모아 둠 (applyLoans가 state.clients로 다시 만듦)
let loanOf = new Map();
function applyLoans() {
  loanOf = new Map(state.clients.filter(c => c.loan).map(c => [c.s, c.loan.club]));
}
// 지금 뛰는 구단: 임대 중이면 임대 구단, 아니면 소속 구단
const clubOf = s => (loanOf.has(s) ? CLUBS[loanOf.get(s)] : homeClub(s));
// 구단 수준은 처음 부(t0) 기준으로 고정 (13단계 승강으로 부가 바뀌어도 선수단은 그대로라서. 승격팀은 위 부에서 약한 편, 강등팀은 아래 부에서 강한 편)
const clubLevel = club => tierLevel(club.country, club.t0) + club.off;

// 구단 명단: 원래 슬롯에서 떠난 선수는 빼고 이적해 온 선수는 더함. 15단계: 임대 간 선수는 임대 구단 명단에
function clubSlots(club) {
  const list = [];
  for (let k = 0; k < SQUAD; k++) {
    const s = club.id * SQUAD + k;
    if (state.moved[s] === undefined && !loanOf.has(s)) list.push(s);
  }
  for (const [s, id] of Object.entries(state.moved)) if (id === club.id && !loanOf.has(Number(s))) list.push(Number(s));
  for (const [s, id] of loanOf) if (id === club.id) list.push(s);
  return list;
}

// --- 대회 일정: 리그 1~46주, 47~52주 휴식기. 컵 6라운드, 대륙 대회 조별 6경기 + 8강·4강·결승, A매치 4번 ---
const LEAGUE_WEEKS = 46;
const NT_WEEKS = [10, 20, 32, 42];
const CUP_WEEKS = [6, 14, 22, 30, 38, 44];
const CONT_WEEKS = [4, 8, 12, 16, 24, 28, 36, 40, 45];
// 대륙 대회 이름 [한국어, 영어] (지역 이름이 키)
const CONT_NAME = { '5대 리그': ['유럽 클럽 챔피언십', 'European Club Championship'], 유럽: ['유럽 클럽 챔피언십', 'European Club Championship'], 남미: ['남미 클럽 컵', 'South American Club Cup'],
  북중미: ['북중미 클럽 컵', 'North & Central American Club Cup'], '아시아·오세아니아': ['아시아 클럽 챔피언십', 'Asian Club Championship'], 아프리카: ['아프리카 클럽 챔피언십', 'African Club Championship'] };
const REGION_EN = { '5대 리그': 'Big Five', 유럽: 'Europe', 남미: 'South America', 북중미: 'North & Central America', '아시아·오세아니아': 'Asia & Oceania', 아프리카: 'Africa' };
const regionName = region => L(region, REGION_EN[region]);
// 13단계: 유럽은 참가 구단이 많아 수준 순 32팀씩 세 대회로 나눔 (챔피언십·리그·콘퍼런스 리그). 다른 지역은 32팀 이하라 한 대회
const CONT_SPLIT = 32;
const CONT_LOWER = [['유럽 클럽 리그', 'European Club League'], ['유럽 콘퍼런스 리그', 'European Conference League']];
const contTitle = (region, ci = 0) => (ci ? CONT_LOWER[ci - 1] : CONT_NAME[region]);
const COMPS = ['L', 'C', 'K', 'N']; // 리그, 국내 컵, 대륙 대회, 국가대표

// --- 9단계 이적 시장 (축구 감독 게임의 이적 기간·마감일에서 가져옴): 여름 이적 기간은 47주부터 다음 시즌 6주까지, 겨울은 22~26주.
// 마지막 주가 마감일. 계약 중인 선수의 이적 제안은 이적 기간에만 오고, 무소속 선수는 언제든 계약할 수 있음(자유 계약)
const WINDOWS = [{ ko: '여름 이적 기간', en: 'summer transfer window', from: 47, to: 6 }, { ko: '겨울 이적 기간', en: 'winter transfer window', from: 22, to: 26 }]
  .map(w => ({ ...w, get name() { return L(this.ko, this.en); } }));
const inWindow = (win, week) => (win.from <= win.to ? week >= win.from && week <= win.to : week >= win.from || week <= win.to);
const windowAt = (week = state.week) => WINDOWS.find(win => inWindow(win, week)) || null;
const windowLeft = (win, week = state.week) => (week <= win.to ? win.to - week : WEEKS - week + win.to); // 0 = 이번 주가 마감일
const windowEnd = win => absWeek() + windowLeft(win);                                                // 마감일의 절대 주차
const isDeadline = () => Boolean(windowAt()) && windowLeft(windowAt()) === 0;
// 다음 이적 기간: { win, wait: 열리기까지 남은 주 }
function nextWindow(week = state.week) {
  return WINDOWS.map(win => ({ win, wait: (win.from - week + WEEKS) % WEEKS })).sort((a, b) => a.wait - b.wait)[0];
}

// ===== 13단계: 리그 순위표·승강·국내 컵·대륙 대회 =====
// 결과는 모두 시드로 정해짐(같은 게임이면 언제 다시 계산해도 같음). 저장하는 것은 부 배치(state.tierOf)와 대륙 대회 참가 구단(state.cont)뿐
// 구단 전력 = 구단 수준(고정) + 시즌 기세(시즌마다 ±TUNE.formSpread). 득점은 푸아송 분포: 한 팀 평균 TUNE.goalBase골에서
// 전력 1 차이마다 TUNE.goalStep, 홈 경기는 TUNE.homeAdv만큼 기울어짐. 컵·토너먼트에서 비기면 승부차기
const contSlots = country => (country.i < BIG5 ? 4 : country.level >= 66 ? 3 : country.level >= 60 ? 2 : 1);
const CONT_GROUPS = ['유럽', '남미', '북중미', '아시아·오세아니아', '아프리카']; // 5대 리그와 유럽은 같은 대회
const contGroup = region => (region === '5대 리그' ? '유럽' : region);
let contSet = new Set(); // 이번 시즌 대륙 대회 참가 구단 (state.cont, applyTiers에서 채움)
const inContinental = club => contSet.has(club.id);
const bigStage = club => club.t === 0 && (club.country.i < BIG5 || inContinental(club));
const compName = (key, club, nat) => (key === 'L' ? leagueName(club.country, club.t) : key === 'C' ? L(`${club.country.name} 컵`, `${club.country.name} Cup`)
  : key === 'K' ? L(...contTitle(club.country.region, compRun(club, 'K').ci || 0)) : L(`${nat.name} 국가대표`, `${nat.name} national team`));
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// 승강 팀 수: 맞닿은 두 부 중 작은 쪽이 18팀 이상이면 3팀, 12팀 이상이면 2팀, 아니면 1팀
const moveCount = (country, t) => {
  const n = Math.min(country.tiers[t], country.tiers[t + 1]);
  return n >= 18 ? 3 : n >= 12 ? 2 : 1;
};
// 순위의 뜻: 'cont' 대륙 대회 진출권(1부), 'up' 승격, 'down' 강등, '' 그 밖
function zoneOf(country, t, rk) {
  if (t === 0 && rk <= contSlots(country)) return 'cont';
  if (t > 0 && rk <= moveCount(country, t - 1)) return 'up';
  if (t + 1 < country.tiers.length && rk > country.tiers[t] - moveCount(country, t)) return 'down';
  return '';
}

// 결과 캐시: 부 배치가 바뀌거나 다른 게임을 불러오면(applyTiers) 비움
const seasonCache = new Map();
const cupCache = new Map();
const contCache = new Map();

// 대륙 대회 참가 구단: 나라마다 1부 순위 상위 contSlots팀. 대회마다 4의 배수(4팀씩 조)가 되게, 수준 높은 나라의 다음 순위 구단을 더함
// order(나라) = 그 나라 1부 구단을 순위 순으로
function contEntrants(order) {
  const out = [];
  for (const group of CONT_GROUPS) {
    const picked = [];
    const next = [];
    for (const country of COUNTRIES.filter(c => contGroup(c.region) === group)) {
      const list = order(country);
      picked.push(...list.slice(0, contSlots(country)));
      if (list[contSlots(country)]) next.push(list[contSlots(country)]);
    }
    next.sort((a, b) => b.country.level - a.country.level || a.country.i - b.country.i);
    while (picked.length % 4 && next.length) picked.push(next.shift());
    out.push(...picked.map(c => c.id));
  }
  return out;
}

// 부 배치를 구단(club.t)과 부별 명단(country.clubs)에 반영. 부 안에서는 처음 부·순위 순(전력 순에 가까움)
// 대륙 대회 참가 구단이 없으면(새 게임·예전 세이브) 1부 전력 순으로 정함
function applyTiers() {
  for (const country of COUNTRIES) {
    const lists = country.tiers.map(() => []);
    for (const club of country.all) {
      club.t = state.tierOf.charCodeAt(club.id) - 48;
      lists[club.t].push(club);
    }
    country.clubs = lists;
  }
  if (!state.cont) state.cont = contEntrants(country => country.clubs[0]);
  contSet = new Set(state.cont);
  applyLoans();
  seasonCache.clear();
  cupCache.clear();
  contCache.clear();
}

const seasonForm = club => {
  const r = rng(hash(state.seed, state.season, club.id, 73));
  return (r() + r() - 1) * TUNE.formSpread;
};
const clubPower = club => clubLevel(club) + seasonForm(club);

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function poisson(mean, r) {
  const lim = Math.exp(-mean);
  let k = 0;
  for (let p = r(); p > lim && k < 9; p *= r()) k += 1;
  return k;
}
// 한 경기 점수 [a 골, b 골]. home = a 쪽 홈 이점 (중립 경기장은 0)
function playScore(pa, pb, home, r) {
  const tilt = (TUNE.goalStep * (pa - pb) + home) / 2;
  return [poisson(TUNE.goalBase * Math.exp(tilt), r), poisson(TUNE.goalBase * Math.exp(-tilt), r)];
}
// 단판 승부 (컵·대륙 대회 토너먼트): 비기면 승부차기. 승부차기는 전력이 높은 쪽이 조금 유리(최대 60%), 이긴 쪽 3~5골
// 결과 { win, lose, gw, gl: 90분 점수(이긴 쪽 기준), kw, kl: 승부차기 점수(없으면 0) }
function knockout(a, b, power, home, r) {
  const pa = power.get(a.id);
  const pb = power.get(b.id);
  const [x, y] = playScore(pa, pb, home, r);
  if (x !== y) return x > y ? { win: a, lose: b, gw: x, gl: y, kw: 0, kl: 0 } : { win: b, lose: a, gw: y, gl: x, kw: 0, kl: 0 };
  const aWins = r() < 0.5 + clamp((pa - pb) * 0.01, -0.1, 0.1);
  const kw = 3 + Math.floor(r() * 3);
  const kl = kw - 1 - Math.floor(r() * 2);
  return { win: aWins ? a : b, lose: aWins ? b : a, gw: x, gl: y, kw, kl };
}

// 리그 일정 (원형 방식): 라운드마다 [홈 번호, 원정 번호] 쌍. 앞 절반(팀 수 - 1라운드) 뒤 홈·원정을 바꿔 한 번 더. 홀수 팀이면 라운드마다 한 팀이 쉼
const rrCache = new Map();
function roundRobin(n) {
  if (rrCache.has(n)) return rrCache.get(n);
  const m = n % 2 ? n + 1 : n;
  const ids = Array.from({ length: m }, (_, i) => i);
  const half = [];
  for (let k = 0; k < m - 1; k++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i];
      const b = ids[m - 1 - i];
      if (a < n && b < n) pairs.push((k + i) % 2 ? [b, a] : [a, b]);
    }
    half.push(pairs);
    ids.splice(1, 0, ids.pop());
  }
  const rounds = half.concat(half.map(pairs => pairs.map(([a, b]) => [b, a])));
  rrCache.set(n, rounds);
  return rounds;
}
const roundsOf = n => 2 * ((n % 2 ? n + 1 : n) - 1);
// 그 주까지 치른 리그 라운드 수: 1~46주에 고르게 나눔 (47주부터는 끝)
const roundsBy = (n, week) => Math.floor((clamp(week, 0, LEAGUE_WEEKS) * roundsOf(n)) / LEAGUE_WEEKS);
const playedRounds = (country, t) => roundsBy(country.tiers[t], state.week - 1);
const leagueOver = () => state.week > LEAGUE_WEEKS;

// 한 부의 이번 시즌: 구단 순서(시즌마다 섞음)와 라운드별 점수 g[(라운드 × 쌍 수 + 쌍) × 2 + 홈 0·원정 1]
function tierSeason(country, t) {
  const key = `${state.seed}:${state.season}:${country.i}:${t}`;
  let ts = seasonCache.get(key);
  if (ts) return ts;
  const r = rng(hash(state.seed, state.season, country.i, t, 71));
  const clubs = shuffle(country.clubs[t].slice(), r);
  const power = clubs.map(clubPower);
  const rounds = roundRobin(clubs.length);
  const per = Math.floor(clubs.length / 2);
  const g = new Uint8Array(rounds.length * per * 2);
  rounds.forEach((pairs, k) => pairs.forEach(([a, b], i) => {
    const [x, y] = playScore(power[a], power[b], TUNE.homeAdv, r);
    g[(k * per + i) * 2] = x;
    g[(k * per + i) * 2 + 1] = y;
  }));
  ts = { clubs, rounds, per, g, index: new Map(clubs.map((c, i) => [c.id, i])), tables: new Map() };
  if (seasonCache.size > 800) seasonCache.clear();
  seasonCache.set(key, ts);
  return ts;
}

// 순위표 (played라운드까지): 승점 → 득실차 → 다득점 → 구단 수준 순. 줄마다 최근 5경기('W'·'D'·'L')
function leagueTable(country, t, played = playedRounds(country, t)) {
  const ts = tierSeason(country, t);
  if (ts.tables.has(played)) return ts.tables.get(played);
  const rows = ts.clubs.map(club => ({ club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, last: [], rk: 0 }));
  const add = (row, f, a) => {
    row.p += 1;
    row.gf += f;
    row.ga += a;
    if (f > a) {
      row.w += 1;
      row.pts += 3;
    } else if (f === a) {
      row.d += 1;
      row.pts += 1;
    } else row.l += 1;
    row.last.push(f > a ? 'W' : f === a ? 'D' : 'L');
  };
  for (let k = 0; k < played; k++) {
    ts.rounds[k].forEach(([a, b], i) => {
      const x = ts.g[(k * ts.per + i) * 2];
      const y = ts.g[(k * ts.per + i) * 2 + 1];
      add(rows[a], x, y);
      add(rows[b], y, x);
    });
  }
  for (const row of rows) {
    row.gd = row.gf - row.ga;
    row.last = row.last.slice(-5);
  }
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || clubLevel(b.club) - clubLevel(a.club) || a.club.id - b.club.id);
  rows.forEach((row, i) => (row.rk = i + 1));
  ts.tables.set(played, rows);
  return rows;
}
const finalTable = (country, t) => leagueTable(country, t, roundsOf(country.tiers[t]));
const tableRow = (club, table = leagueTable(club.country, club.t)) => table.find(row => row.club === club);

// 이번 주 리그 경기 수 (모든 부가 짝수 팀이라 쉬는 팀이 없음)
function leagueGames(club, week) {
  const n = club.country.tiers[club.t];
  return roundsBy(n, week) - roundsBy(n, week - 1);
}

// 국내 컵: 지금 부·전력 순 상위 64팀(모자라면 상위 팀이 1라운드 부전승). 라운드마다 무작위 대진, 중립 경기, 비기면 승부차기
// runs: 구단 번호 → { mask: 뛴 라운드 비트, won, res: 라운드별 { f: 득점, a: 실점, pk: 승부차기 1 = 이김·2 = 짐 } }
// final: 결승 { club: 우승, opp: 준우승, f, a, pf, pa (승부차기) }
const NO_RUN = { mask: 0, won: false, res: [] };
function markKnockout(runs, k, i) {
  const w = runs.get(k.win.id);
  const l = runs.get(k.lose.id);
  w.mask |= 1 << i;
  l.mask |= 1 << i;
  w.res[i] = { f: k.gw, a: k.gl, pk: k.kw ? 1 : 0 };
  l.res[i] = { f: k.gl, a: k.gw, pk: k.kw ? 2 : 0 };
  return { club: k.win.id, opp: k.lose.id, f: k.gw, a: k.gl, pf: k.kw, pa: k.kl };
}
function cupOf(country) {
  const key = `${state.seed}:${state.season}:${country.i}`;
  let cup = cupCache.get(key);
  if (cup) return cup;
  const r = rng(hash(state.seed, state.season, country.i, 31));
  const seeds = country.clubs.flat().slice(0, 64);
  const runs = new Map(seeds.map(c => [c.id, { mask: 0, won: false, res: [] }]));
  const power = new Map(seeds.map(c => [c.id, clubPower(c)]));
  let waiting = seeds.slice(0, 64 - seeds.length);
  let alive = seeds.slice(64 - seeds.length);
  let final = null;
  for (let round = 0; round < CUP_WEEKS.length; round++) {
    shuffle(alive, r);
    const next = [];
    for (let i = 0; i + 1 < alive.length; i += 2) {
      const k = knockout(alive[i], alive[i + 1], power, 0, r);
      final = markKnockout(runs, k, round);
      next.push(k.win);
    }
    alive = waiting.concat(next);
    waiting = [];
  }
  runs.get(final.club).won = true;
  cup = { runs, final };
  if (cupCache.size > 300) cupCache.clear();
  cupCache.set(key, cup);
  return cup;
}

// 대륙 대회: 지역 참가 구단을 수준 순으로 32팀씩 나눠 대회를 만듦 (유럽은 챔피언십·리그·콘퍼런스 리그 세 대회, 다른 지역은 한 대회).
// 대회마다 수준 순 4개 포트로 4팀씩 조 편성(같은 나라는 되도록 다른 조), 조별 홈·원정 6경기(CONT_WEEKS 앞 6주).
// 조 순위 → 경기당 승점 → 경기당 득실 → 다득점 순 상위 8팀이 8강(1-8, 4-5, 2-7, 3-6). 8강·4강은 앞 시드 홈, 결승은 중립
// runs: 구단 번호 → { mask, won, res, gpos: 조 순위(0부터), ci: 대회 번호(0 = 지역 최상위 대회) }, finals: 대회별 결승, final = 최상위 대회 결승
function contOf(group) {
  const key = `${state.seed}:${state.season}:${group}`;
  let cont = contCache.get(key);
  if (cont) return cont;
  const r = rng(hash(state.seed, state.season, CONT_GROUPS.indexOf(group), 37));
  const all = state.cont.map(id => CLUBS[id]).filter(c => contGroup(c.country.region) === group).sort((a, b) => clubLevel(b) - clubLevel(a) || a.id - b.id);
  const runs = new Map();
  const finals = [];
  for (let ci = 0; ci * CONT_SPLIT < all.length; ci++) finals.push(playCont(all.slice(ci * CONT_SPLIT, (ci + 1) * CONT_SPLIT), runs, ci, r));
  cont = { runs, finals, final: finals[0] || null };
  if (contCache.size > 50) contCache.clear();
  contCache.set(key, cont);
  return cont;
}
function playCont(teams, runs, ci, r) {
  for (const c of teams) runs.set(c.id, { mask: 0, won: false, res: [], gpos: 0, ci });
  const power = new Map(teams.map(c => [c.id, clubPower(c)]));
  const size = Math.ceil(teams.length / 4);
  const groups = Array.from({ length: size }, () => []);
  for (let pot = 0; pot < 4; pot++) {
    for (const club of shuffle(teams.slice(pot * size, pot * size + size), r)) {
      const open = groups.filter(g => g.length === pot);
      (open.find(g => !g.some(x => x.country === club.country)) || open[0]).push(club);
    }
  }
  const standings = [];
  for (const list of groups) {
    const rows = list.map(club => ({ club, p: 0, pts: 0, gd: 0, gf: 0 }));
    roundRobin(list.length).forEach((pairs, k) => pairs.forEach(([a, b]) => {
      const [x, y] = playScore(power.get(list[a].id), power.get(list[b].id), TUNE.homeAdv, r);
      for (const [row, f, ag] of [[rows[a], x, y], [rows[b], y, x]]) {
        row.p += 1;
        row.gf += f;
        row.gd += f - ag;
        row.pts += f > ag ? 3 : f === ag ? 1 : 0;
        const run = runs.get(row.club.id);
        run.mask |= 1 << k;
        run.res[k] = { f, a: ag, pk: 0 };
      }
    }));
    rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || clubLevel(b.club) - clubLevel(a.club));
    rows.forEach((row, i) => {
      row.pos = i;
      runs.get(row.club.id).gpos = i;
      standings.push(row);
    });
  }
  const per = (row, key) => row[key] / Math.max(1, row.p);
  standings.sort((a, b) => a.pos - b.pos || per(b, 'pts') - per(a, 'pts') || per(b, 'gd') - per(a, 'gd') || per(b, 'gf') - per(a, 'gf') || clubLevel(b.club) - clubLevel(a.club));
  let bracket = [0, 7, 3, 4, 1, 6, 2, 5].map(i => (standings[i] ? standings[i].club : null));
  let final = null;
  for (let stage = 6; stage < CONT_WEEKS.length; stage++) {
    const next = [];
    for (let i = 0; i < bracket.length; i += 2) {
      const [a, b] = [bracket[i], bracket[i + 1]];
      if (!a || !b) {
        next.push(a || b);
        continue;
      }
      const k = knockout(a, b, power, stage < CONT_WEEKS.length - 1 ? TUNE.homeAdv : 0, r);
      final = markKnockout(runs, k, stage);
      next.push(k.win);
    }
    bracket = next;
  }
  if (bracket[0]) runs.get(bracket[0].id).won = true;
  return final;
}

// 이번 시즌 컵(C)·대륙 대회(K) 성적
function compRun(club, key) {
  if (key === 'C') return cupOf(club.country).runs.get(club.id) || NO_RUN;
  return inContinental(club) ? contOf(contGroup(club.country.region)).runs.get(club.id) || NO_RUN : NO_RUN;
}

function weekGames(club, week) {
  const ci = CUP_WEEKS.indexOf(week);
  const ki = CONT_WEEKS.indexOf(week);
  return { L: leagueGames(club, week), C: ci < 0 ? 0 : (compRun(club, 'C').mask >> ci) & 1, K: ki < 0 ? 0 : (compRun(club, 'K').mask >> ki) & 1 };
}

// 그 주 구단 경기 결과 (구단 입장): [{ key: 'L'·'C'·'K', f: 득점, a: 실점, pk }]
function weekResults(club, week) {
  const out = [];
  const ts = tierSeason(club.country, club.t);
  const me = ts.index.get(club.id);
  const n = ts.clubs.length;
  for (let k = roundsBy(n, week - 1); k < roundsBy(n, week); k++) {
    const i = ts.rounds[k].findIndex(([a, b]) => a === me || b === me);
    const x = ts.g[(k * ts.per + i) * 2];
    const y = ts.g[(k * ts.per + i) * 2 + 1];
    out.push(ts.rounds[k][i][0] === me ? { key: 'L', f: x, a: y, pk: 0 } : { key: 'L', f: y, a: x, pk: 0 });
  }
  for (const [key, weeks] of [['C', CUP_WEEKS], ['K', CONT_WEEKS]]) {
    const i = weeks.indexOf(week);
    const run = i < 0 ? NO_RUN : compRun(club, key);
    if ((run.mask >> i) & 1) out.push({ key, ...run.res[i] });
  }
  return out;
}

// 한 나라의 시즌 말 승강: 마지막 순위표로 위 부 하위 팀과 아래 부 상위 팀을 바꿈 (부마다 팀 수는 그대로)
// moves = 구단 번호 → 다음 시즌 부 (바뀌는 구단만), first = 1부 최종 순위 순 구단
function countryMoves(country) {
  const finals = country.tiers.map((n, t) => finalTable(country, t));
  const moves = new Map();
  for (let t = 0; t + 1 < country.tiers.length; t++) {
    const k = moveCount(country, t);
    for (const row of finals[t].slice(-k)) moves.set(row.club.id, t + 1);
    for (const row of finals[t + 1].slice(0, k)) moves.set(row.club.id, t);
  }
  return { moves, first: finals[0].map(row => row.club) };
}
// 시즌 말: 모든 나라의 승강과 다음 시즌 대륙 대회 참가 구단 (1부 최종 순위로)
function seasonMoves() {
  const tiers = state.tierOf.split('');
  const firsts = new Map();
  for (const country of COUNTRIES) {
    const { moves, first } = countryMoves(country);
    for (const [id, t] of moves) tiers[id] = String(t);
    firsts.set(country, first);
  }
  return { tierOf: tiers.join(''), cont: contEntrants(country => firsts.get(country)) };
}

// --- 경기: 능력이 구단 수준보다 높을수록, 폼이 좋을수록 자주 뛰고 잘함 ---
const POS_GOAL = { FW: 0.42, MF: 0.13, DF: 0.04, GK: 0 };
const POS_ASSIST = { FW: 0.17, MF: 0.21, DF: 0.07, GK: 0.01 };
const startChance = (ability, level, form) => clamp(0.6 + (ability - level) * 0.05 + (form - 5.5) * 0.03, 0.08, 0.97);

// 한 경기 결과 (못 뛰면 null). hard = 대륙 대회·A매치
// 13단계: 팀 경기 결과(res = { f, a })를 알면 골·도움은 팀 득점을 넘지 않고, 이기면 평점 +0.25·지면 -0.25 (난수 쓰는 순서는 그대로)
function playMatch(p, level, form, r, hard, res) {
  const d = p.ability - level;
  if (r() > startChance(p.ability, level, form)) return null;
  let rating = clamp(6.4 + d * 0.05 + (form - 5.5) * 0.12 - (hard ? 0.3 : 0) + (r() - 0.5) * 1.6, 4.5, 9.8);
  const atk = POS_GOAL[p.pos] * clamp(1 + d * 0.04, 0.4, 1.8) * (0.8 + form * 0.04) * (hard ? 0.7 : 1);
  let goals = (r() < atk ? 1 : 0) + (r() < atk * atk * 0.4 ? 1 : 0);
  let assists = r() < POS_ASSIST[p.pos] * clamp(1 + d * 0.03, 0.5, 1.6) ? 1 : 0;
  if (res) {
    goals = Math.min(goals, res.f);
    assists = Math.min(assists, res.f - goals);
    rating = clamp(rating + (res.f > res.a ? 0.25 : res.f < res.a ? -0.25 : 0), 4.5, 9.8);
  }
  return { rating, goals, assists };
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

// 소속이 아닌 선수의 이번 시즌 기록: 매번 같은 값이 나오게 시드로 계산 (폼은 평균 5.5로 봄)
function worldStats(p, upto) {
  const st = emptyStats();
  const r = rng(hash(state.seed, p.s, p.g, state.season, 41));
  const level = clubLevel(p.club);
  const nt = isNationalPick(p);
  for (let w = 1; w < upto; w++) {
    const g = weekGames(p.club, w);
    for (let i = 0; i < g.L; i++) addMatch(st.L, playMatch(p, level, 5.5, r, false));
    if (g.C) addMatch(st.C, playMatch(p, level, 5.5, r, false));
    if (g.K) addMatch(st.K, playMatch(p, level, 5.5, r, true));
    if (nt && NT_WEEKS.includes(w)) for (let i = 0; i < 2; i++) addMatch(st.N, playMatch(p, natCutOf(p) + 2, 5.5, r, true));
  }
  return st;
}

// 소속 선수 기록 구간: 시즌·구단이 바뀌면 hist로 옮기고 새로 시작
// 13단계: t = 그때 부 (승강으로 구단의 부가 바뀌어도 지난 기록은 그 시즌 부로 보임)
const newStint = (club, stats) => ({ season: state.season, club: club.id, t: club.t, ...(stats || emptyStats()) });
function archiveStint(c) {
  if (COMPS.some(k => c.st[k][0] > 0) || c.st.season === state.season) c.hist.unshift(c.st);
  if (c.hist.length > 20) c.hist.length = 20;
}

// --- 선수 성향과 원하는 조건 (시드로 정해짐) ---
const PRIORITY = { money: ['돈', 'money'], play: ['출전 시간', 'playing time'], stage: ['큰 무대', 'the big stage'], home: ['고향', 'home'], stable: ['안정', 'stability'] };
const PRIORITY_WEIGHTS = [['money', 3], ['play', 3], ['stage', 2], ['home', 1.5], ['stable', 1.5]];
const ABROAD = { no: ['해외 이적 싫어함', "doesn't want to move abroad"], any: ['국내·해외 상관없음', 'happy at home or abroad'], yes: ['해외 진출 원함', 'wants to play abroad'] };
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
  // 고향 구단 후보는 처음 부·순위 순 상위 12팀 (승강으로 바뀌지 않게 고정된 순서)
  let pool = main === 'home'
    ? home.all.slice(0, 12)
    : CLUBS.filter(c => clubLevel(c) >= p.pot - 6 && clubLevel(c) <= p.pot + 8 && (abroad === 'no' ? c.country === home : abroad === 'yes' ? c.country !== home : true));
  if (!pool.length) pool = home.all.filter(c => c.t0 === 0);
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
    { key: 'money', ok: wage >= want, text: L(`주급 ${cash(wage)} (원하는 금액 ${cash(want)})`, `Wage ${cash(wage)} (wants ${cash(want)})`) },
    { key: 'play', ok: sc >= 0.6, text: sc >= 0.6 ? L(`주전 가능성 높음 (출전 ${Math.round(sc * 100)}%)`, `Likely starter (plays ${Math.round(sc * 100)}%)`) : L(`벤치 위험 (출전 ${Math.round(sc * 100)}%)`, `Risk of the bench (plays ${Math.round(sc * 100)}%)`) },
    { key: 'stage', ok: bigStage(club), text: bigStage(club) ? L('큰 무대 (상위 1부·대륙 대회)', 'Big stage (top flight / continental)') : L('큰 무대 아님', 'Not a big stage') }
  ];
  if (pref.abroad !== 'any') checks.push({ key: 'home', ok: pref.abroad === 'no' ? domestic : !domestic, text: domestic ? L(`${p.nat.name} 구단`, `Club in ${p.nat.name}`) : L(`해외 구단 (${club.country.name})`, `Club abroad (${club.country.name})`) });
  if (years) checks.push({ key: 'stable', ok: Math.abs(years - pref.years) <= 1, text: L(`계약 ${years}시즌 (원하는 기간 ${pref.years}시즌)`, `${years}-season contract (wants ${pref.years})`) });
  if (club.id === pref.dream) checks.push({ key: 'dream', ok: true, text: L('꿈의 구단', 'Dream club') });
  return checks;
}
const fitScore = (checks, pref) => checks.reduce((n, ch) => n + (ch.key === 'dream' ? 3 : (ch.ok ? 1 : -1) * (ch.key === pref.main ? 2 : 1)), 0);
const consentChance = score => clamp(Math.round(TUNE.consentBase + score * TUNE.consentStep), 5, 95);
const moodText = score => (score >= 3 ? L('아주 좋아함', 'Delighted') : score >= 1 ? L('좋아함', 'Pleased') : score >= 0 ? L('보통', 'Neutral') : score >= -2 ? L('싫어함', 'Unhappy') : L('아주 싫어함', 'Very unhappy'));

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
const BOND_TIERS = [[85, '가족 같음', 'Like family'], [60, '끈끈함', 'Close'], [30, '믿음', 'Trusting'], [0, '서먹함', 'Distant']];
const bondName = n => { const t = BOND_TIERS.find(([lo]) => n >= lo); return L(t[1], t[2]); };
// 유대 효과는 유대가 TUNE.bondFrom을 넘는 만큼만 (갓 만난 선수는 효과 없음)
const bondKeepBonus = c => Math.max(0, c.bond - TUNE.bondFrom) * TUNE.bondKeep;
const bondConsentBonus = c => Math.round(Math.max(0, c.bond - TUNE.bondFrom) * TUNE.bondConsent);
// "함께한 지 1시즌 12주"
function togetherText(c) {
  const weeks = Math.max(0, absWeek() - c.since);
  const seasons = Math.floor(weeks / WEEKS);
  return L(`함께한 지 ${seasons ? `${seasons}시즌 ` : ''}${weeks % WEEKS}주`, `Together ${seasons ? `${pl(seasons, 'season')}, ` : ''}${pl(weeks % WEEKS, 'week')}`);
}

// --- 관계 이야기 (8단계): 유대가 깊어진 선수에게 한 번씩 찾아오는 이야기. c.tales = [{ k, w: 시작 주, t: 고른 답 }] ---
const TALE_KEYS = ['call', 'wedding', 'junior', 'praise']; // 필요한 유대가 낮은 순
const FAMILY = ['누나', '형', '사촌 누나', '여동생']; // 세이브에 한국어로 남으므로 화면에서 FAMILY_EN으로
const FAMILY_EN = { 누나: 'older sister', 형: 'older brother', '사촌 누나': 'cousin', 여동생: 'younger sister' };
const familyName = who => L(who, FAMILY_EN[who] || who);
const taleSeen = (c, key) => c.tales.some(t => t.k === key);
// 조건: 아직 안 본 이야기, 유대가 need 이상, 함께한 지 weeks주 이상 (이야기는 시간과 함께 찾아옴)
const taleOpen = (c, key) => c.bond >= EVENT_TYPES[key].tale.need && absWeek() - c.since >= EVENT_TYPES[key].tale.weeks;
const taleReady = (c, key) => !taleSeen(c, key) && taleOpen(c, key);
const startTale = (c, key) => c.tales.push({ k: key, w: absWeek(), t: '' });
// 결혼하는 가족은 선수마다 정해져 있음 (소식과 이야기 앨범에 같이 씀)
const familyOf = c => FAMILY[hash(state.seed, c.s, c.g, 61) % FAMILY.length];
const taleTitle = (c, key) => (key === 'wedding' ? L(`${familyOf(c)} 결혼식`, `His ${familyName(familyOf(c))}'s wedding`) : L(...EVENT_TYPES[key].tale.title));
// 이야기 앨범 한 칸 (디자인 시안 B): 함께한 이야기는 고른 답·주·유대, 찾아온 이야기는 답 기다림,
// 조건을 채운 이야기는 찾아올 수 있다고, 잠긴 이야기는 제목을 숨기고 못 채운 조건과 지금 값
function albumTile(c, key) {
  const tale = EVENT_TYPES[key].tale;
  const seen = c.tales.find(t => t.k === key);
  if (seen && seen.t) {
    const memo = seen.t.replace('(답하지 않음) ', '');
    const opt = EVENT_TYPES[key].options.find(o => o.memo === memo);
    const bond = opt && opt.bond ? L(` · 유대 ${opt.bond > 0 ? '+' : ''}${opt.bond}`, ` · bond ${opt.bond > 0 ? '+' : ''}${opt.bond}`) : '';
    return { cls: memo !== seen.t || (opt && opt.bond < 0) ? 'done cold' : 'done', title: taleTitle(c, key), sub: phrase(seen.t), meta: `${weekLabel(seen.w)}${bond}` };
  }
  if (seen) return { cls: 'now', title: taleTitle(c, key), sub: L('지금 찾아온 이야기입니다', 'This story is happening now'), meta: L('내 선수 탭 소식에서 답해 주세요', 'Answer it in your news on the Players tab') };
  if (taleOpen(c, key)) return { cls: 'open', title: taleTitle(c, key), sub: L(`유대 ${tale.need} 이상이 됐습니다`, `Bond has reached ${tale.need}`), meta: L('때가 되면 찾아옵니다', "It'll come when the moment is right") };
  // 잠긴 칸: 아직 못 채운 조건을 제목에, 지금 값을 아래에
  const time = tale.weeks >= WEEKS ? L(`${tale.weeks / WEEKS}시즌`, pl(tale.weeks / WEEKS, 'season')) : L(`${tale.weeks}주`, pl(tale.weeks, 'week'));
  const bondOk = c.bond >= tale.need;
  const timeOk = absWeek() - c.since >= tale.weeks;
  const together = togetherText(c).replace(L('함께한 지 ', 'Together '), '');
  return {
    cls: 'locked',
    title: L(`잠김 · ${bondOk ? `함께한 지 ${time}` : `유대 ${tale.need}`}`, `Locked · ${bondOk ? `${time} together` : `bond ${tale.need}`}`),
    sub: bondOk ? L('유대 조건은 채웠습니다', 'Bond requirement met') : timeOk ? L('함께한 시간은 채웠습니다', 'Time requirement met') : L(`함께한 지 ${time}부터`, `Unlocks after ${time} together`),
    meta: L(`지금 ${bondOk ? together : timeOk ? `유대 ${c.bond}` : `유대 ${c.bond} · ${together}`}`, `Now: ${bondOk ? together : timeOk ? `bond ${c.bond}` : `bond ${c.bond} · ${together}`}`)
  };
}

// 후배 소개: 같은 나라 구단에서 20세 이하·잠재력 여유 10 이상·영입 확률 20% 이상, 아직 내 선수가 아닌 선수 중 잠재력이 가장 높은 선수
function findJunior(p) {
  let best = null;
  for (const club of p.nat.all) {
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
  applyLoans();
  state.events = state.events.filter(e => e.s !== c.s || e.type === 'tip');
  state.rep = Math.max(0, state.rep - repLoss);
  addLog(L(`${getPlayer(c.s).name} 선수가 ${reason[0]} (평판 -${repLoss}).`, `${getPlayer(c.s).name} ${reason[1]} (reputation -${repLoss}).`));
  state.stats.lost += 1;
}

// 면담: 1 AP, 만족 +12, 같은 선수는 4주에 한 번
function meetBlock(c) {
  if (state.ap < 1) return NO_AP();
  const since = absWeek() - c.met;
  if (c.met && since < TUNE.meetGap) return L(`${TUNE.meetGap - since}주 뒤에 다시 면담할 수 있습니다`, `You can meet him again in ${pl(TUNE.meetGap - since, 'week')}`);
  return '';
}

function meet(s) {
  const c = clientOf(s);
  const block = c ? meetBlock(c) : NOT_CLIENT();
  if (block) return toast(block);
  state.ap -= 1;
  c.met = absWeek();
  addSat(c, TUNE.meetGain);
  addBond(c, TUNE.bondMeet, MEMO.meet);
  addLog(L(`${getPlayer(s).name} 선수와 면담했습니다 (만족 +${TUNE.meetGain} → ${c.sat}, 유대 +${TUNE.bondMeet}).`, `You met ${getPlayer(s).name} (morale +${TUNE.meetGain} → ${c.sat}, bond +${TUNE.bondMeet}).`));
  saveState();
}

// --- 재계약: 주급 3단계 × 기간(2·4시즌). 구단은 어린 선수에게 긴 계약, 30세 이상에게 짧은 계약을 선호 ---
const RENEW_LEVELS = [[['적정 주급', 'Fair wage'], 1], [['+25% 요구', 'Ask +25%'], 1.25], [['+50% 요구', 'Ask +50%'], 1.5]];
const RENEW_YEARS = [2, 4];

function renewTerms(c, p, level, years = 2) {
  const [names, mul] = RENEW_LEVELS[level];
  // 13단계: 지금 주급이 적정 주급보다 많으면(이적하며 올랐을 때) 깎지 않음. 그때는 지금 주급 유지 · +10% · +20%
  const fair = weeklyWage(marketAbility(p)) * mul;
  const keep = (c.wage || 0) * (1 + (mul - 1) * 0.4);
  const fromNow = keep > fair;
  const label = !fromNow ? L(...names) : level === 0 ? L('지금 주급 유지', 'Keep current wage') : L(`지금 주급 +${Math.round((mul - 1) * 40)}% 요구`, `Ask +${Math.round((mul - 1) * 40)}% on current`);
  // 변호사가 있으면 같은 수락 확률로 주급을 더 받아냄
  const wage = Math.round(((fromNow ? keep : fair) * (1 + TUNE.lawyerWage[state.invest.lawyer])) / 50) * 50;
  const age = ageOf(p);
  const clubLikes = age <= 23 ? (years === 4 ? 10 : 0) : age >= 30 ? (years === 2 ? 10 : -10) : 0;
  const home = Number.isInteger(c.s) ? homeClub(c.s) : p.club; // 15단계: 임대 중이어도 재계약은 소속 구단과
  const chance = clamp(Math.round(TUNE.renewBase[level] + Math.min(15, state.rep / 4) + (p.ability - clubLevel(home)) * 2 - (isFreeAgent(c) ? 10 : 0) + clubLikes), 10, 95);
  const pref = prefsOf(p);
  const checks = fitChecks(p, pref, home, wage, years);
  const score = fitScore(checks, pref);
  return { label, wage, years, chance, fee: dealFee(wage), checks, score, satGain: clamp(4 + score * 2, -10, 15) };
}

function renewBlock(c) {
  const left = c.end - absWeek();
  if (left > TUNE.renewWindow) return L(`계약 만료 ${TUNE.renewWindow}주 전부터 협상할 수 있습니다 (남은 ${left}주)`, `Talks open ${pl(TUNE.renewWindow, 'week')} before the contract ends (${pl(left, 'week')} left)`);
  if (state.ap < 1) return NO_AP();
  if (c.negUntil > absWeek()) return L(`구단이 ${c.negUntil - absWeek()}주 뒤에 다시 만나자고 합니다`, `The club wants to meet again in ${pl(c.negUntil - absWeek(), 'week')}`);
  return '';
}

function renew(s, level, years = 2) {
  const c = clientOf(s);
  const block = c ? renewBlock(c) : NOT_CLIENT();
  if (block) return toast(block);
  const p = getPlayer(s);
  const t = renewTerms(c, p, level, years);
  state.ap -= 1;
  state.stats.renewTry += 1;
  if (Math.random() * 100 < t.chance) {
    c.wage = t.wage;
    c.end = absWeek() + WEEKS * years;
    addSat(c, t.satGain);
    addBond(c, 3, MEMO.renewWin);
    state.agencyCash += t.fee;
    gainRep(1);
    state.stats.renewWin += 1;
    addLog(L(`${p.name} 재계약 성공: 주급 ${cash(t.wage)}, ${years}시즌, 수수료 +${cash(t.fee)}, 선수 반응 ${moodText(t.score)} (만족 ${t.satGain >= 0 ? '+' : ''}${t.satGain})`,
      `${p.name} renewed: wage ${cash(t.wage)}, ${pl(years, 'season')}, commission +${cash(t.fee)}, player reaction ${moodText(t.score)} (morale ${t.satGain >= 0 ? '+' : ''}${t.satGain})`));
    toast(L(`재계약 성공! 수수료 +${cash(t.fee)}`, `Contract renewed! Commission +${cash(t.fee)}`));
  } else {
    c.negUntil = absWeek() + TUNE.renewRetry;
    addSat(c, -8);
    addBond(c, -2, MEMO.renewLose);
    addLog(L(`${p.name} 재계약 협상 결렬 (만족 -8). ${TUNE.renewRetry}주 뒤 다시 협상할 수 있습니다.`, `Contract talks for ${p.name} broke down (morale -8). You can try again in ${pl(TUNE.renewRetry, 'week')}.`));
    toast(L('구단이 조건을 거절했습니다.', 'The club rejected your terms.'));
  }
  saveState();
}

// --- 이적 제안: 지금 구단 이상, 선수 능력 근처 수준 구단에서 옴. 가끔 꿈의 구단 ---
function makeOffer(c, p) {
  const r = Math.random;
  const pref = prefsOf(p);
  const dream = CLUBS[pref.dream];
  // 13단계: 새 구단을 알아보는 선수(이적 요청)·무소속 선수는 지금보다 낮은 수준의 구단에서도 제안이 옴 (뛸 곳을 찾는 이적).
  // 예전에는 벤치 선수가 이적을 요청해도 지금 구단 수준 이상에서만 제안이 와서 제안이 하나도 없을 때가 많았음
  const stepDown = c.hunt >= absWeek() || isFreeAgent(c);
  const lo = stepDown ? p.ability - 8 : Math.max(clubLevel(p.club), p.ability - 8);
  const hi = p.ability + 3;
  // 10단계: 내가 추천해 둔 구단, 그 포지션 보강이 필요한 구단(수준이 맞을 때)이 먼저 제안함
  const pitched = pitching(c) ? CLUBS[c.pitch.club] : null;
  const needy = state.needs.map(n => CLUBS[n.club]).filter((x, i) => state.needs[i].pos === p.pos && x !== p.club && clubLevel(x) >= lo && clubLevel(x) <= hi);
  let club = null;
  let from = '';
  if (pitched && pitched !== p.club && r() < TUNE.pitchClub) [club, from] = [pitched, 'pitch'];
  else if (dream !== p.club && clubLevel(dream) <= p.ability + TUNE.dreamReach && r() < TUNE.dreamChance) club = dream;
  else if (needy.length && r() < TUNE.needOffer) [club, from] = [needy[Math.floor(r() * needy.length)], 'need'];
  else {
    // 구단도 선수 성향을 알기 때문에 대부분(TUNE.offerRespect) 해외·국내 뜻에 맞는 곳에서 제안함
    const respect = pref.abroad !== 'any' && r() < TUNE.offerRespect;
    const pool = CLUBS.filter(x => x !== p.club && clubLevel(x) >= lo && clubLevel(x) <= hi
      && (!respect || (pref.abroad === 'no' ? x.country === p.nat : x.country !== p.nat)));
    if (!pool.length) return null;
    club = pool[Math.floor(r() * pool.length)];
  }
  // 13단계: 지금보다 낮은 수준 구단은 지금 주급을 맞춰 주지 않음 (능력에 맞는 주급의 0.9~1.2배). 뛸 곳을 찾는 대신 돈은 덜 받을 수 있음
  const down = clubLevel(club) < clubLevel(p.club);
  const base = weeklyWage(Math.max(marketAbility(p), Math.round(clubLevel(club))));
  const wage = Math.round(((down ? base : Math.max(c.wage, base)) * (down ? 0.9 + r() * 0.3 : 1.1 + r() * 0.3)) / 50) * 50;
  const fee = isFreeAgent(c) ? 0 : Math.round((valueOf(p) * (0.8 + r() * 0.5)) / 5000) * 5000;
  // late = 이적 마감일에 온 막판 제안 (그 주 안에 답해야 함), from = 'pitch'(내가 추천한 구단)·'need'(보강이 필요한 구단)
  return { club: club.id, wage, fee, years: 2 + Math.floor(r() * 3), late: isDeadline(), from };
}

// 여러 문장 중 하나를 고름: 같은 선수·같은 일에는 늘 같은 문장 (새로고침해도 바뀌지 않게)
const pickLine = (lines, ...keys) => lines[hash(state.seed, ...keys) % lines.length];
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
  if (c.loan) {
    c.loan = null; // 임대 중에는 제안이 오지 않지만, 남아 있던 제안을 받으면 임대는 끝남
    applyLoans();
  }
  const p = getPlayer(c.s);
  const from = p.club;
  const to = CLUBS[d.club];
  const fit = offerFit(p, d);
  // 17단계: 임대로 뛰던 구단에 완전 이적이면 뉴스·기억이 다르고(ln = 1), 이번 시즌 기록은 임대 구간에 이어서 씀 (같은 구단 기록이 둘로 나뉘지 않게)
  const stay = d.from === 'loan';
  if (!stay || c.st.club !== to.id) {
    archiveStint(c);
    c.st = newStint(to);
  }
  if (to.id === Math.floor(c.s / SQUAD)) delete state.moved[c.s];
  else state.moved[c.s] = to.id;
  const gain = offerCut(d);
  c.wage = d.wage;
  c.end = absWeek() + WEEKS * (d.years || 3);
  c.hunt = 0; // 새 구단을 찾았으니 알아보기 끝
  c.pitch = null;
  state.needs = state.needs.filter(n => !(n.club === to.id && n.pos === p.pos));
  if (windowAt()) countDeal(p, d.fee, to.id);
  pushNews({ k: 'mine', s: c.s, g: c.g, nm: p.ko, nk: p.nk, from: from.id, to: to.id, pos: p.pos, fee: d.fee, age: ageOf(p), ab: p.ability, ...(stay ? { ln: 1 } : {}) });
  addSat(c, clamp(5 + fit.score * 2, -10, 20));
  // 기억은 한국어로 저장, 화면에서 phrase()
  addBond(c, fit.score >= 1 ? 5 : 2, fit.score >= 1 ? (stay ? `정든 ${to.ko}에 남게 해 줌` : `원하던 ${to.ko} 이적을 성사시킴`) : `${to.ko} 이적을 성사시킴`);
  state.agencyCash += gain;
  const got = gainRep(2);
  state.stats.transfers += 1;
  if (stay) state.stats.loanBuys += 1;
  if (to.id === prefsOf(p).dream) state.stats.dream += 1;
  toast(L(`${stay ? '완전 이적' : '이적'} 성사! 수수료 +${cash(gain)}`, `${stay ? 'Permanent move' : 'Transfer'} done! Commission +${cash(gain)}`));
  return L(`${p.name} ${stay ? '임대 뒤 완전 이적' : '이적'}: ${from.name} → ${to.name} (${leagueName(to.country, to.t)}), 주급 ${cash(d.wage)}, 수수료 +${cash(gain)}, 평판 +${got}, 선수 반응 ${moodText(fit.score)}`,
    `${p.name} ${stay ? 'loan made permanent' : 'transfer'}: ${from.name} → ${to.name} (${leagueName(to.country, to.t)}), wage ${cash(d.wage)}, commission +${cash(gain)}, reputation +${got}, player reaction ${moodText(fit.score)}`);
}

// 수락: 선수 동의 확률을 굴림
function acceptOffer(c, p, d) {
  if (Math.random() * 100 < offerFit(p, d).consent) return transfer(c, d);
  addSat(c, -2);
  return L(`${p.name} 선수가 ${CLUBS[d.club].name} 이적을 원하지 않아 무산됐습니다 (만족 -2).`, `${p.name} didn't want to join ${CLUBS[d.club].name}, so the deal fell through (morale -2).`);
}

function counterOffer(c, p, d) {
  if (Math.random() * 100 < counterChance()) {
    const better = { ...d, wage: Math.round((d.wage * 1.2) / 50) * 50, fee: Math.round(d.fee * 1.1) };
    return `${L('더 요구해서 조건이 올랐습니다.', 'You pushed for more and the terms improved.')} ${acceptOffer(c, p, better)}`;
  }
  addSat(c, -5);
  addBond(c, -2, MEMO.counterLost);
  return L(`${named(CLUBS[d.club].name, '이', '가')} 제안을 거둬들였습니다 (${p.name} 만족 -5, 유대 -2).`, `${CLUBS[d.club].name} withdrew the offer (${p.name} morale -5, bond -2).`);
}

// 다른 에이전시 접근: 만족·유대가 높을수록 붙잡기 쉬움 (만족 80 → 85%, 50 → 70%, 30 → 60%, 유대 60이면 +18%p). 실패하면 떠남
const keepChanceOf = c => clamp(0.45 + c.sat / 200 + (TUNE.keepChance - 0.75) + bondKeepBonus(c), 0.3, 0.95);
function keepClient(c, p, chance, gain, inPerson) {
  if (inPerson) c.met = absWeek();
  if (Math.random() < chance) {
    addSat(c, gain);
    const bond = inPerson ? 5 : 1;
    addBond(c, bond, inPerson ? MEMO.keptInPerson : MEMO.keptBonus);
    return inPerson ? L(`${p.name} 선수를 직접 만나 붙잡았습니다 (만족 +${gain}, 유대 +${bond}).`, `You met ${p.name} in person and kept him (morale +${gain}, bond +${bond}).`)
      : L(`${p.name} 선수를 보너스를 주고 붙잡았습니다 (만족 +${gain}, 유대 +${bond}).`, `A bonus kept ${p.name} with you (morale +${gain}, bond +${bond}).`);
  }
  removeClient(c, inPerson ? ['직접 만나 붙잡으려 했지만 다른 에이전시로 옮겼습니다', 'joined another agency even though you met him in person']
    : ['보너스를 주고 붙잡으려 했지만 다른 에이전시로 옮겼습니다', 'joined another agency despite your bonus offer'], 2);
  return '';
}

// 소식 종류: chance(c, p) 주간 확률, text·quote(p, d, c), options[{ label, ap, cost, bond, memo, go, run }], def = 답이 없을 때 고르는 번호
// bond = 그 선택으로 바뀌는 유대(버튼에 표시), memo = 선수가 기억하는 일 (M(한국어, 영어): 한국어로 저장하고 화면에서 바꿈)
// 글은 모두 L(한국어, 영어). 상황 글(text)과 선수의 말(quote)은 여러 문장 중 소식마다 정해진 하나(vary, 소식을 만들 때 d.v)
// 정해 둔 문장 하나: 같은 소식에는 늘 같은 문장, salt로 상황 글과 선수의 말을 따로 고름
const vary = (d, lines, salt = 0) => lines[hash((d && d.v) || 0, salt) % lines.length](d);
const SAY = (ko, en) => () => L(ko, en); // 선수의 말 한 줄
// 이적 제안 앞머리: 추천해 둔 구단·보강이 필요한 구단·꿈의 구단
function offerHead(p, d) {
  const club = CLUBS[d.club];
  const dream = club.id === prefsOf(p).dream;
  // 13단계: 제안한 구단의 리그 순위도 ("잉글랜드 1부 3위")
  const played = playedRounds(club.country, club.t);
  const row = played ? tableRow(club) : null;
  const rk = row ? (leagueOver() ? [` 최종 ${row.rk}위`, `, finished ${ordinal(row.rk)}`] : [` ${row.rk}위`, `, ${ordinal(row.rk)}`]) : ['', ''];
  // 17단계: 임대 구단의 완전 이적 제안은 리그가 끝난 뒤라, 남으면 다음 시즌 어디서 뛰는지(승격·강등·대륙 대회)도 붙임
  const zone = row && leagueOver() && d.from === 'loan' ? zoneOf(club.country, club.t, row.rk) : '';
  const mv = { up: [' · 승격 확정', ', promoted'], down: [' · 강등 확정', ', relegated'], cont: [' · 대륙 대회 진출', ', into continental competition'] }[zone] || ['', ''];
  return {
    ko: `${d.from === 'pitch' ? '추천해 둔 ' : d.from === 'need' ? `${POS_NAME[p.pos][0]} 보강이 필요한 ` : ''}${dream ? '꿈의 구단 ' : ''}${club.ko}(${club.country.ko} ${club.t + 1}부${rk[0]}${mv[0]})`,
    en: `${club.en} (${club.country.en} Div. ${club.t + 1}${rk[1]}${mv[1]}${dream ? ', his dream club' : ''}${d.from === 'pitch' ? ', the club you pitched him to' : d.from === 'need' ? `, short of a ${POS_NAME[p.pos][1]}` : ''})`
  };
}
const feeText = d => (d.fee ? L(`이적료 ${money(d.fee)}`, `a ${money(d.fee)} fee`) : L('자유 이적', 'free transfer'));

// 마감일 막판 제안을 받은 선수의 말
const LATE_LINES = [
  SAY('구단에서 자정까지 답을 달래요. 에이전트님이 괜찮다고 하시면 저는 바로 사인할게요.', 'They want an answer by midnight. If you say it\'s right, I\'ll sign straight away.'),
  SAY('마지막 날에 이런 제안이 올 줄은 몰랐어요. 솔직히 손이 떨려요. 어떻게 하면 좋을까요?', 'I never expected an offer like this on the last day. Honestly, my hands are shaking. What should I do?'),
  SAY('오늘 안에 정하지 않으면 다음 이적 기간까지 기다려야 하잖아요. 에이전트님 판단을 믿을게요.', 'If we don\'t decide today, we wait for the next window. I\'ll trust your judgement.'),
  SAY('서류는 벌써 다 와 있대요. 저는 짐 쌀 준비도 됐어요. 에이전트님 생각은 어떠세요?', 'Apparently the paperwork is already there. I\'m ready to pack my bags. What do you think?'),
  SAY('전화가 계속 울려요. 다른 사람 말은 안 들을게요. 에이전트님이 정해 주세요.', 'My phone won\'t stop ringing. I\'m not listening to anyone else. You make the call.')
];
// 꿈의 구단·추천해 둔 구단에서 제안이 왔을 때 선수의 말
const DREAM_LINES = [
  SAY('어릴 때 방에 이 구단 포스터를 붙여 놨었어요. 정말 저한테 연락이 온 거예요?', 'I had this club\'s poster on my bedroom wall as a kid. Did they really call about me?'),
  SAY('꿈인지 생시인지 모르겠어요. 이 유니폼을 입는 게 제 평생 목표였거든요.', 'I can\'t tell if I\'m dreaming. Wearing this shirt has been my goal my whole life.'),
  SAY('아버지께 아직 말 안 했어요. 계약서에 사인하는 날 같이 전화하고 싶어요.', 'I haven\'t told my dad yet. I want us to call him together the day I sign.')
];
const PITCH_LINES = [
  SAY('저를 추천해 주셨다더니 정말 연락이 왔네요. 에이전트님 덕분이에요.', 'You said you\'d put my name forward, and they actually called. That\'s all you.'),
  SAY('구단 사람들이 에이전트님 얘기를 하더라고요. 저를 정말 잘 소개해 주셨나 봐요.', 'The club kept mentioning you. You must have sold me really well.'),
  SAY('제가 직접 연락했으면 이런 제안은 못 받았을 거예요. 믿고 맡기길 잘했어요.', 'I\'d never have got an offer like this on my own. I\'m glad I trusted you with it.')
];
// 이적 요청: 선수가 가장 중요하게 여기는 조건에 따라 털어놓는 말
const ASK_LINES = {
  money: [
    SAY('솔직히 말할게요. 제 가치를 제대로 알아주는 팀에서 뛰고 싶어요.', 'I\'ll be honest. I want to play for a team that values me properly.'),
    SAY('같은 일을 하는데 저만 덜 받는 것 같아요. 이번 기회에 옮기고 싶어요.', 'I feel like I\'m paid less than everyone for the same work. I want to use this window to move.'),
    SAY('부모님 집 대출을 제가 갚기로 했거든요. 지금 주급으로는 몇 년이 걸릴지 모르겠어요.', 'I promised to pay off my parents\' mortgage. On this wage I don\'t know how many years it\'ll take.')
  ],
  play: [
    SAY('벤치에서 또 한 시즌을 보내고 싶지 않아요. 매주 뛸 수 있는 팀이면 어디든 좋아요.', 'I can\'t spend another season on the bench. Anywhere I can play every week is fine.'),
    SAY('훈련은 누구보다 열심히 하는데 경기에 못 나가요. 이대로면 제가 무너질 것 같아요.', 'I train harder than anyone and still don\'t play. If this goes on, I\'ll fall apart.'),
    SAY('감독님 눈에 제가 안 보이나 봐요. 저를 원하는 팀에서 다시 증명하고 싶어요.', 'The coach just doesn\'t see me. I want to prove myself again somewhere that wants me.')
  ],
  stage: [
    SAY('큰 무대에서 뛰어 보고 싶어요. 지금 아니면 그런 기회가 다시 안 올 것 같아요.', 'I want to play on the big stage. If not now, I don\'t think the chance will come again.'),
    SAY('대륙 대회 중계를 볼 때마다 저기 서 있는 제 모습을 상상해요. 한번 도전해 보고 싶어요.', 'Every time I watch continental games, I picture myself out there. I want to give it a go.'),
    SAY('여기서도 행복하지만, 제 한계가 어디까지인지 알고 싶어요. 더 높은 곳에서요.', 'I\'m happy here, but I want to find out where my limit is. Higher up.')
  ],
  home: [
    SAY('요즘 집 생각이 많이 나요. 가족 곁에서 뛸 수 있는 팀을 찾아 주실 수 있을까요?', 'I\'ve been missing home a lot. Could you find me a team near my family?'),
    SAY('부모님이 경기장에 오실 수 있는 곳에서 뛰고 싶어요. 그게 제 꿈이었거든요.', 'I want to play where my parents can come to the stadium. That was always my dream.'),
    SAY('할머니가 요즘 많이 편찮으세요. 가까이에 있고 싶어요.', 'My grandmother has been really unwell lately. I want to be close by.')
  ],
  stable: [
    SAY('여기서는 제 자리가 안 보여요. 오래 마음 놓고 뛸 수 있는 팀을 찾고 싶어요.', 'I can\'t see a future for me here. I want a team where I can settle for years.'),
    SAY('해마다 불안한 건 이제 지쳤어요. 저를 길게 믿어 줄 팀으로 가고 싶어요.', 'I\'m tired of worrying every year. I want to go somewhere that believes in me long-term.'),
    SAY('여자친구랑 이제 집을 구하려고 해요. 몇 년은 한곳에 있고 싶어요.', 'My girlfriend and I are looking for a place together. I want to stay put for a few years.')
  ]
};

const EVENT_TYPES = {
  offer: {
    // 9단계: 계약 중인 선수는 이적 기간에만 제안이 옴. 기간 안에는 windowBoost배, 마감 주는 deadlineBoost배 더, 새 구단을 알아보는 중이면 huntBoost배.
    // 무소속 선수 제안(offerFree)은 기간과 관계없이 옴. 아직 이적이 없으면 첫 시즌 22주부터(겨울·여름 이적 기간) 제안이 늘어남: 첫 큰 거래를 1시즌 안에 맛보게
    chance: (c, p) => {
      if (c.loan) return 0; // 15단계: 임대 중에는 이적 제안이 없음
      const free = isFreeAgent(c) ? TUNE.offerFree : 0;
      const win = windowAt();
      if (!win) return free;
      const base = TUNE.offerBase + (p.ability >= clubLevel(p.club) + 3 ? TUNE.offerStar : 0) + (state.world.form[c.s] >= 8 ? TUNE.offerForm : 0)
        + (ageOf(p) <= 21 && p.pot - p.ability >= 10 ? TUNE.offerYouth : 0);
      const boost = TUNE.windowBoost * (windowLeft(win) === 0 ? TUNE.deadlineBoost : 1) * (c.hunt >= absWeek() ? TUNE.huntBoost : 1) * (pitching(c) ? TUNE.pitchBoost : 1);
      const first = !state.stats.transfers && state.season === 1 && state.week >= 22 ? TUNE.offerFirst : 0;
      return base * boost + first + free;
    },
    make: makeOffer,
    text: (p, d) => {
      const h = offerHead(p, d);
      const years = d.years || 3;
      return vary(d, [
        () => L(`${h.ko}에서 ${p.name} 선수 영입을 제안했습니다. 주급 ${cash(d.wage)}, ${years}시즌, ${feeText(d)}. 성사되면 내 수수료 ${cash(offerCut(d))}.`,
          `${h.en} have bid for ${p.name}: ${cash(d.wage)} a week for ${pl(years, 'season')}, ${feeText(d)}. If it goes through, your commission is ${cash(offerCut(d))}.`),
        () => L(`${h.ko}에서 정식 제안서가 도착했습니다. ${p.name} 선수에게 주급 ${cash(d.wage)}, ${years}시즌 계약을 내밀었습니다 (${feeText(d)}). 내 수수료 ${cash(offerCut(d))}.`,
          `A formal offer has arrived from ${h.en}. They want ${p.name} on ${cash(d.wage)} a week for ${pl(years, 'season')} (${feeText(d)}). Your cut: ${cash(offerCut(d))}.`),
        () => L(`${h.ko}에서 ${p.name} 선수를 꼭 데려가고 싶다며 연락이 왔습니다. 주급 ${cash(d.wage)} · ${years}시즌 · ${feeText(d)}. 성사되면 수수료 ${cash(offerCut(d))}.`,
          `${h.en} called to say they really want ${p.name}. The offer: ${cash(d.wage)} a week, ${pl(years, 'season')}, ${feeText(d)}. Commission if it happens: ${cash(offerCut(d))}.`)
      ]);
    },
    // 마감일 막판 제안, 꿈의 구단, 추천해 둔 구단 제안에는 선수의 말이 붙음
    quote: (p, d) => (d.late ? vary(d, LATE_LINES, 1) : CLUBS[d.club].id === prefsOf(p).dream ? vary(d, DREAM_LINES, 1) : d.from === 'pitch' ? vary(d, PITCH_LINES, 1) : ''),
    fit: (p, d) => offerFit(p, d),
    options: [
      { label: (p, d) => L(`수락한다 (선수 동의 ${offerFit(p, d).consent}%)`, `Accept (player agrees ${offerFit(p, d).consent}%)`), run: acceptOffer },
      { label: () => L(`더 요구한다 (구단 수락 ${counterChance()}%)`, `Push for more (club agrees ${counterChance()}%)`), run: counterOffer },
      { label: () => L('거절한다', 'Turn it down'), run: (c, p) => (addSat(c, -3), L(`${p.name} 이적 제안을 거절했습니다 (만족 -3).`, `You turned down the offer for ${p.name} (morale -3).`)) }
    ],
    def: 2
  },
  // 17단계 임대 뒤 완전 이적: 리그가 끝난 다음 주(47주)에 loanBids가 만듦 (주마다 굴리는 확률이 없어서 chance 없음).
  // d = { club: 임대 구단, wage, fee, years, from: 'loan', ap: 임대 동안 리그 경기, gl: 골, rt: 평균 평점×10 }.
  // 선수 마음(buyWish)에 따라 선수의 말과 "돌아오게 한다"의 만족·유대가 다름
  buy: {
    text: (p, d) => {
      const h = offerHead(p, d);
      const home = homeClub(p.s).name;
      const years = d.years || 3;
      const rt = (d.rt / 10).toFixed(1);
      const perf = L(`리그 ${d.ap}경기 평균 평점 ${rt}${d.gl ? `(${d.gl}골)` : ''}`, `${pl(d.ap, 'league game')}, averaging ${rt}${d.gl ? ` with ${pl(d.gl, 'goal')}` : ''}`);
      return vary(d, [
        () => L(`임대 구단 ${h.ko}에서 ${p.name} 선수를 완전히 데려가고 싶다고 합니다. 임대 동안 ${perf}. 제안은 주급 ${cash(d.wage)}, ${years}시즌, 이적료 ${money(d.fee)}(소속 구단 ${home}에 지급)이고, 성사되면 내 수수료 ${cash(offerCut(d))}입니다.`,
          `${h.en}, where ${p.name} is on loan, want to sign him for good. On loan he has played ${perf}. They offer ${cash(d.wage)} a week for ${pl(years, 'season')} and a ${money(d.fee)} fee to ${home}. Your commission if it goes through: ${cash(offerCut(d))}.`),
        () => L(`${h.ko} 단장이 직접 전화했습니다. 임대로 온 ${p.name} 선수(${perf})를 보내고 싶지 않다며 완전 이적을 제안합니다. 주급 ${cash(d.wage)} · ${years}시즌 · 이적료 ${money(d.fee)}. 내 수수료 ${cash(offerCut(d))}.`,
          `The sporting director of ${h.en} rang you himself. He doesn't want to let ${p.name} go after his loan (${perf}) and is offering a permanent deal: ${cash(d.wage)} a week, ${pl(years, 'season')}, a ${money(d.fee)} fee to ${home}. Your cut: ${cash(offerCut(d))}.`),
        () => L(`시즌 마지막 경기에서 ${h.ko} 팬들이 ${p.name} 선수 이름을 연호했습니다. 구단이 곧바로 완전 이적 제안서를 보냈습니다. 주급 ${cash(d.wage)}, ${years}시즌, 이적료 ${money(d.fee)}(${home}에 지급). 성사되면 수수료 ${cash(offerCut(d))}. (임대 동안 ${perf})`,
          `At the last game of the season, fans of ${h.en} sang ${p.name}'s name. The club have followed up with a permanent offer: ${cash(d.wage)} a week for ${pl(years, 'season')}, a ${money(d.fee)} fee to ${home}. Commission if it happens: ${cash(offerCut(d))}. (On loan: ${perf}.)`)
      ]);
    },
    quote: (p, d) => vary(d, BUY_LINES[buyWish(p, d)], 1),
    // 두 구단 비교: 출전 확률과 내 주 수수료 (남기면 뛰고, 돌아가면 벤치일 수 있음)
    note: (p, d, c) => {
      const back = Math.round(startChance(p.ability, clubLevel(homeClub(p.s)), 5.5) * 100);
      const here = Math.round(startChance(p.ability, clubLevel(CLUBS[d.club]), 5.5) * 100);
      return L(`출전 확률 ${homeClub(p.s).name} ${back}% · 이 구단 ${here}% · 완전 이적하면 내 주 수수료 ${cash(commissionOf(c.wage))} → ${cash(commissionOf(d.wage))}`,
        `Starts: ${homeClub(p.s).name} ${back}%, here ${here}% · your weekly commission if he stays: ${cash(commissionOf(c.wage))} → ${cash(commissionOf(d.wage))}`);
    },
    fit: (p, d) => offerFit(p, d),
    options: [
      { label: (p, d) => L(`완전 이적에 동의한다 (선수 동의 ${offerFit(p, d).consent}%)`, `Agree the permanent move (player agrees ${offerFit(p, d).consent}%)`), run: acceptOffer },
      { label: () => L(`더 요구한다 (구단 수락 ${counterChance()}%)`, `Push for more (club agrees ${counterChance()}%)`), run: counterOffer },
      { label: (p, d) => ({ stay: L('돌아오게 한다 · 남고 싶어 함', 'Bring him back · he wants to stay'), back: L('돌아오게 한다 · 돌아오고 싶어 함', 'Bring him back · as he wants') }[buyWish(p, d)] || L('돌아오게 한다', 'Bring him back')),
        bond: (p, d) => ({ stay: -TUNE.buyStayBond, back: TUNE.buyBackBond }[buyWish(p, d)] || 0),
        memo: (p, d) => ({ stay: MEMO.buyRefused, back: MEMO.buyBack }[buyWish(p, d)] || ''),
        run: (c, p, d) => {
          const wish = buyWish(p, d);
          const sat = wish === 'stay' ? -TUNE.buyStaySat : wish === 'back' ? TUNE.buyBackSat : 0;
          addSat(c, sat);
          const back = homeClub(p.s).name;
          return wish === 'stay' ? L(`${CLUBS[d.club].name}의 완전 이적 제안을 거절했습니다. 남고 싶어 하던 ${p.name} 선수가 시즌이 끝나면 ${back}에 돌아옵니다 (만족 -${TUNE.buyStaySat}).`,
            `You turned down ${CLUBS[d.club].name}'s permanent offer. ${p.name}, who wanted to stay, returns to ${back} at the end of the season (morale -${TUNE.buyStaySat}).`)
            : wish === 'back' ? L(`${CLUBS[d.club].name}의 완전 이적 제안을 거절했습니다. ${p.name} 선수는 바라던 대로 시즌이 끝나면 ${back}에 돌아옵니다 (만족 +${TUNE.buyBackSat}).`,
              `You turned down ${CLUBS[d.club].name}'s permanent offer. As he hoped, ${p.name} returns to ${back} at the end of the season (morale +${TUNE.buyBackSat}).`)
            : L(`${CLUBS[d.club].name}의 완전 이적 제안을 거절했습니다. ${p.name} 선수는 시즌이 끝나면 ${back}에 돌아옵니다.`, `You turned down ${CLUBS[d.club].name}'s permanent offer. ${p.name} returns to ${back} at the end of the season.`);
        } }
    ],
    def: 2
  },
  playtime: {
    // 다쳤거나 쉬는 중, 무소속이면 출전 불만이 오지 않음
    chance: (c, p) => (c.playRate < 0.45 && state.week <= LEAGUE_WEEKS && !c.out && !isFreeAgent(c) ? TUNE.playtimeChance * (prefsOf(p).main === 'play' ? 1.5 : 1) : 0),
    text: (p, d) => vary(d, [
      () => L(`${p.name} 선수가 출전 시간이 부족하다며 불만을 털어놓았습니다.`, `${p.name} has opened up about his lack of playing time.`),
      () => L(`${p.name} 선수가 경기가 끝나자마자 전화를 걸어왔습니다. 또 벤치였습니다.`, `${p.name} rang you the moment the final whistle went. He was on the bench again.`),
      () => L(`${p.name} 선수가 훈련장 주차장에서 기다리고 있었습니다. 요즘 출전 기회가 거의 없습니다.`, `${p.name} was waiting for you in the training-ground car park. He has barely played lately.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('몸은 최고인데 기회가 없어요. 이러다 감을 잃을까 봐 무서워요.', 'I\'m in the best shape of my life and I\'m not getting chances. I\'m scared I\'ll lose my touch.'),
      SAY('관중석에 있는 가족 보기가 민망해요. 매주 저 보러 오시는데.', 'I\'m embarrassed to look at my family in the stands. They come every week to watch me.'),
      SAY('감독님이 저한테 말도 안 걸어요. 제가 뭘 잘못했는지라도 알고 싶어요.', 'The coach doesn\'t even speak to me. I just want to know what I did wrong.'),
      SAY('10분이라도 좋아요. 뛰기만 하면 보여 줄 수 있어요.', 'Even ten minutes would do. If I get on the pitch, I can show them.')
    ], 1),
    options: [
      { label: () => L('면담하며 다독인다', 'Sit down and reassure him'), bond: 3, memo: M('출전 불만을 들어 줌', 'Listened when he was frustrated about playing time'), ap: 1,
        run: (c, p) => ((c.met = absWeek()), addSat(c, 10), L(`${p.name} 선수를 다독였습니다 (만족 +10).`, `You reassured ${p.name} (morale +10).`)) },
      { label: () => L('구단에 출전 보장을 요구한다 (반반)', 'Demand guaranteed minutes from the club (50/50)'), bond: 2, memo: M('구단에 출전 보장을 요구해 줌', 'Went to the club to demand minutes for him'),
        run: (c, p) => (Math.random() < 0.5 ? (addSat(c, 12), (c.playRate = Math.max(c.playRate, 0.6)), L(`구단이 출전을 약속했습니다 (${p.name} 만족 +12).`, `The club promised him more minutes (${p.name} morale +12).`))
          : (addSat(c, -4), L(`구단이 요구를 무시했습니다 (${p.name} 만족 -4).`, `The club ignored the request (${p.name} morale -4).`))) },
      { label: () => L('참으라고 한다', 'Tell him to be patient'), bond: -4, memo: M('출전 불만에 참으라고 함', 'Told him to just be patient about playing time'),
        run: (c, p) => (addSat(c, -8), L(`${p.name} 선수가 서운해합니다 (만족 -8).`, `${p.name} feels let down (morale -8).`)) }
    ],
    def: 2
  },
  raise: {
    chance: (c, p) => (!isFreeAgent(c) && wantWage(p, prefsOf(p)) >= c.wage * 1.4 ? TUNE.raiseChance : 0),
    text: (p, d, c) => vary(d, [
      () => L(`${p.name} 선수가 주급(${cash(c.wage)})이 적다며 재계약을 원합니다. 원하는 금액은 ${cash(wantWage(p, prefsOf(p)))} 정도입니다.`,
        `${p.name} thinks his wage (${cash(c.wage)}) is too low and wants a new deal. He is after about ${cash(wantWage(p, prefsOf(p)))}.`),
      () => L(`${p.name} 선수가 동료들의 주급 이야기를 듣고 왔습니다. 지금 ${cash(c.wage)}인데, ${cash(wantWage(p, prefsOf(p)))} 정도는 받아야 한다고 생각합니다.`,
        `${p.name} has heard what his teammates earn. He's on ${cash(c.wage)} and thinks he deserves around ${cash(wantWage(p, prefsOf(p)))}.`),
      () => L(`${p.name} 선수가 먼저 다음 계약 얘기를 꺼냈습니다. 지금 주급이 ${cash(c.wage)}인데, ${cash(wantWage(p, prefsOf(p)))} 정도면 마음 편히 뛸 수 있겠다고 합니다.`,
        `${p.name} brought up his next contract before you could. He's on ${cash(c.wage)} a week and says around ${cash(wantWage(p, prefsOf(p)))} would let him play with a clear head.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('돈 얘기 꺼내기 정말 싫었는데요… 제가 팀에 기여하는 만큼은 받고 싶어요.', 'I really hate bringing up money... but I want to be paid for what I bring to the team.'),
      SAY('저보다 덜 뛰는 선수가 두 배를 받는대요. 그 얘기 듣고 잠이 안 왔어요.', 'Apparently a guy who plays less than me earns double. I couldn\'t sleep after hearing that.'),
      SAY('욕심내는 거 아니에요. 그냥 제 가치를 인정받고 싶은 거예요.', 'I\'m not being greedy. I just want my worth to be recognised.')
    ], 1),
    options: [
      { label: () => L('재계약 협상을 준비한다', 'Start preparing a new contract'), bond: 1, memo: M('주급 고민에 재계약을 약속함', 'Promised to work on a new contract when he worried about his wage'), go: true,
        run: (c, p) => (addSat(c, 2), L(`${p.name} 선수에게 재계약을 준비하겠다고 했습니다 (만족 +2).`, `You told ${p.name} you'd prepare a new contract (morale +2).`)) },
      { label: () => L('다음에 하자고 달랜다', 'Ask him to wait'), bond: -3, memo: M('주급 고민을 미룸', 'Put off his wage concerns'),
        run: (c, p) => (addSat(c, -6), L(`${p.name} 선수가 실망했습니다 (만족 -6).`, `${p.name} is disappointed (morale -6).`)) }
    ],
    def: 1
  },
  sponsor: {
    chance: (c, p) => (state.world.form[c.s] >= 8 && valueOf(p) >= 500000 ? TUNE.sponsorChance : 0),
    make: (c, p) => ({ cut: Math.max(1000, Math.round((valueOf(p) * 0.01) / 100) * 100) }),
    text: (p, d) => vary(d, [
      () => L(`스포츠 브랜드가 요즘 폼이 좋은 ${p.name} 선수에게 광고를 제안했습니다. 내 몫은 ${cash(d.cut)}입니다.`, `A sportswear brand wants ${p.name}, who is in great form, for an ad campaign. Your share is ${cash(d.cut)}.`),
      () => L(`축구화 회사에서 ${p.name} 선수와 1년 광고 계약을 하고 싶어 합니다. 에이전시 몫은 ${cash(d.cut)}입니다.`, `A boot company wants a one-year deal with ${p.name}. The agency's share is ${cash(d.cut)}.`),
      () => L(`${p.name} 선수의 최근 골 장면이 화제가 되자 음료 회사에서 광고를 제안했습니다. 내 몫 ${cash(d.cut)}.`, `After ${p.name}'s latest goal went viral, a drinks company offered him an advert. Your share: ${cash(d.cut)}.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('제 얼굴이 버스 정류장에 붙는다고요? 엄마가 엄청 좋아하시겠다.', 'My face on bus stops? My mum is going to love that.'),
      SAY('광고 찍어 본 적이 없어서 떨려요. 옆에 있어 주실 거죠?', 'I\'ve never shot an advert. I\'m nervous. You\'ll be there, right?'),
      SAY('브랜드는 에이전트님이 골라 주세요. 저는 축구만 잘하면 되죠?', 'You pick the brand. I just need to keep playing well, right?')
    ], 1),
    options: [
      { label: () => L('계약한다', 'Sign the deal'), bond: 1, memo: M('광고 계약을 잡아 줌', 'Landed him an advertising deal'),
        run: (c, p, d) => {
          state.agencyCash += d.cut;
          addSat(c, 3);
          const rep = gainRep(1);
          return L(`${p.name} 광고 계약: 자금 +${cash(d.cut)}, 평판 +${rep}, 만족 +3`, `${p.name} ad deal: cash +${cash(d.cut)}, reputation +${rep}, morale +3`);
        } },
      { label: () => L('거절한다', 'Decline'), run: (c, p) => L(`${p.name} 광고 제안을 거절했습니다.`, `You declined the ad offer for ${p.name}.`) }
    ],
    def: 1
  },
  sns: {
    chance: () => TUNE.snsChance,
    text: (p, d) => vary(d, [
      () => L(`${p.name} 선수의 SNS 글이 논란이 됐습니다.`, `A social media post by ${p.name} has caused a storm.`),
      () => L(`${p.name} 선수가 새벽에 올린 글이 캡처돼 퍼지고 있습니다. 기자들이 연락해 옵니다.`, `A late-night post by ${p.name} is being screenshotted and shared. Journalists are calling.`),
      () => L(`${p.name} 선수가 팬과 SNS에서 말다툼을 벌였고, 기사가 났습니다.`, `${p.name} got into an argument with a fan online, and it has made the papers.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('그런 뜻이 아니었어요. 제가 말을 너무 짧게 썼나 봐요… 어떡하죠?', 'That\'s not what I meant. I guess I wrote it too bluntly... what do I do?'),
      SAY('휴대폰을 못 보겠어요. 알림이 계속 와요.', 'I can\'t look at my phone. The notifications won\'t stop.'),
      SAY('제가 잘못한 건 알아요. 그래도 혼자 감당하긴 너무 무서워요.', 'I know I messed up. But I\'m too scared to face this alone.')
    ], 1),
    options: [
      { label: () => L('사과문을 함께 낸다', 'Write an apology together'), bond: 1, memo: M('논란 때 사과문을 함께 냄', 'Wrote an apology with him during the controversy'), cost: () => 1000,
        run: (c, p) => (addSat(c, 2), L(`${p.name} 선수와 사과문을 냈습니다 (만족 +2).`, `You and ${p.name} released an apology (morale +2).`)) },
      { label: () => L('법적으로 대응한다', 'Take legal action'), bond: 3, memo: M('논란 때 앞장서 감싸 줌', 'Stood up for him when the controversy hit'), cost: () => 5000,
        run: (c, p) => {
          addSat(c, 6);
          const rep = gainRep(1);
          return L(`${p.name} 선수를 감쌌습니다 (평판 +${rep}, 만족 +6).`, `You defended ${p.name} (reputation +${rep}, morale +6).`);
        } },
      { label: () => L('무시한다', 'Ignore it'), bond: -4, memo: M('논란을 외면함', 'Looked the other way during the controversy'),
        run: (c, p) => ((state.rep = Math.max(0, state.rep - 2)), addSat(c, -4), L(`${p.name} 논란을 내버려 뒀습니다 (평판 -2, 만족 -4).`, `You let the ${p.name} story run (reputation -2, morale -4).`)) }
    ],
    def: 2
  },
  injury: {
    // 13단계: 다치면 wk주 동안 경기에 못 나감 (c.out). 전문 재활을 지원하면 그 절반을 앞당기고, 구단에만 맡기면 1주 더 걸림
    chance: c => (c.out ? 0 : TUNE.injuryChance * (1 - TUNE.coachInjury[state.invest.coach])),
    make: c => {
      const wk = randInt(TUNE.injuryWeeks[0], TUNE.injuryWeeks[1], Math.random);
      c.out = { w: absWeek() + wk, k: 'inj' };
      return { cost: Math.max(1000, Math.round(c.wage / 100) * 100), wk };
    },
    text: (p, d) => {
      const wk = d.wk ? L(`${d.wk}주`, pl(d.wk, 'week')) : L('몇 주', 'a few weeks');
      return vary(d, [
        () => L(`${p.name} 선수가 훈련 중 다쳤습니다. ${wk} 정도 경기에 못 나갑니다.`, `${p.name} picked up an injury in training and will miss about ${wk}.`),
        () => L(`${p.name} 선수가 경기 도중 발목을 잡고 쓰러졌습니다. 구단은 ${wk} 정도 걸린다고 봅니다.`, `${p.name} went down clutching his ankle during the match. The club expects him out for about ${wk}.`),
        () => L(`${p.name} 선수의 허벅지 근육이 올라왔습니다. ${wk} 동안 쉬어야 하고, 무리하면 더 길어질 수 있습니다.`, `${p.name} has tweaked his thigh. He needs ${wk} off, and pushing it could make it worse.`)
      ]);
    },
    quote: (p, d) => vary(d, [
      SAY('괜찮아요, 금방 돌아올 거예요… 그런데 솔직히 좀 무서워요.', 'I\'m fine, I\'ll be back soon... but honestly, I\'m a bit scared.'),
      SAY('하필 지금이에요. 이제 막 자리를 잡았는데.', 'Why now? I\'d only just won my place.'),
      SAY('엄마한테는 별거 아니라고 해 주세요. 걱정 많이 하시거든요.', 'Please tell my mum it\'s nothing. She worries a lot.'),
      SAY('재활은 혼자 하면 너무 외로워요. 가끔 들러 주실 수 있어요?', 'Rehab on your own is so lonely. Could you drop by now and then?')
    ], 1),
    options: [
      { label: (p, d) => L(`전문 재활을 지원한다${d.wk ? ` (복귀 ${Math.ceil(d.wk / 2)}주 앞당김)` : ''}`, `Pay for specialist rehab${d.wk ? ` (back ${pl(Math.ceil(d.wk / 2), 'week')} sooner)` : ''}`),
        bond: 4, memo: M('다쳤을 때 재활을 지원함', 'Paid for his rehab when he was injured'), cost: d => d.cost,
        run: (c, p, d) => {
          const back = d.wk ? Math.ceil(d.wk / 2) : 0;
          if (c.out && c.out.k === 'inj') c.out.w = Math.max(absWeek(), c.out.w - back);
          state.world.form[c.s] = Math.max(state.world.form[c.s], 5);
          addSat(c, 6);
          return back ? L(`${p.name} 재활 지원: 복귀 ${back}주 앞당김, 폼 회복, 만족 +6`, `${p.name}'s rehab is funded: back ${pl(back, 'week')} sooner, form restored, morale +6`)
            : L(`${p.name} 재활 지원: 폼 회복, 만족 +6`, `${p.name}'s rehab is funded: form restored, morale +6`);
        } },
      { label: (p, d) => L(`구단 의료진에 맡긴다${d.wk ? ' (복귀 1주 늦어짐)' : ''}`, `Leave it to the club medics${d.wk ? ' (back a week later)' : ''}`), bond: -2, memo: M('다쳤을 때 구단에만 맡김', 'Left his injury entirely to the club'),
        run: (c, p, d) => {
          if (c.out && c.out.k === 'inj' && d.wk) c.out.w += 1;
          state.world.form[c.s] = Math.max(1, state.world.form[c.s] - 3);
          addSat(c, -3);
          return L(`${p.name} 회복이 더딥니다 (폼 -3, 만족 -3).`, `${p.name} is recovering slowly (form -3, morale -3).`);
        } }
    ],
    def: 1
  },
  interview: {
    chance: (c, p) => (valueOf(p) >= 300000 ? TUNE.interviewChance : 0),
    text: (p, d) => vary(d, [
      () => L(`방송사에서 ${p.name} 선수 인터뷰를 요청했습니다.`, `A TV channel has asked to interview ${p.name}.`),
      () => L(`스포츠 잡지가 ${p.name} 선수를 표지 인터뷰로 다루고 싶어 합니다.`, `A sports magazine wants ${p.name} for a cover interview.`),
      () => L(`인기 축구 팟캐스트에서 ${p.name} 선수를 초대했습니다.`, `A popular football podcast has invited ${p.name} on.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('카메라 앞에서는 말이 잘 안 나와요. 미리 같이 연습해 주실래요?', 'I freeze up in front of cameras. Will you practise with me first?'),
      SAY('어떤 질문이 나올지 무서워요. 이상한 말 하면 막아 주세요.', 'I\'m scared of what they\'ll ask. Stop me if I say something stupid.'),
      SAY('좋아요! 할 얘기 많아요. 고향 얘기도 해도 되죠?', 'Great! I\'ve got plenty to say. Can I talk about my hometown too?')
    ], 1),
    options: [
      { label: () => L('인터뷰에 응한다', 'Do the interview'), bond: 1, memo: M('인터뷰를 함께 준비함', 'Prepared for an interview together'), ap: 1,
        run: (c, p) => {
          addSat(c, 2);
          const rep = gainRep(1);
          return L(`${p.name} 인터뷰가 화제가 됐습니다 (평판 +${rep}, 만족 +2).`, `${p.name}'s interview got people talking (reputation +${rep}, morale +2).`);
        } },
      { label: () => L('거절한다', 'Decline'), run: (c, p) => L(`${p.name} 인터뷰를 거절했습니다.`, `You declined the interview for ${p.name}.`) }
    ],
    def: 1
  },
  poach: {
    // 다른 에이전시는 몸값 높은 선수를 노리고, 불만이 큰 선수에게 더 자주 접근함
    chance: (c, p) => TUNE.poachBase + (valueOf(p) >= 3e6 ? TUNE.poachStar : 0) + (c.sat < 50 ? TUNE.poachLow : 0),
    text: (p, d) => vary(d, [
      () => L(`다른 에이전시가 ${p.name} 선수에게 접근하고 있습니다.`, `A rival agency is circling ${p.name}.`),
      () => L(`큰 에이전시 대표가 ${p.name} 선수 가족과 저녁을 먹었다는 이야기가 들립니다.`, `Word is that the boss of a big agency had dinner with ${p.name}'s family.`),
      () => L(`${p.name} 선수에게 다른 에이전시가 더 낮은 수수료를 내걸었습니다.`, `Another agency has offered ${p.name} a lower commission to switch.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('그쪽에서 연락이 왔어요. 숨기기 싫어서 먼저 말씀드리는 거예요.', 'They got in touch. I\'m telling you first because I don\'t want to hide anything.'),
      SAY('조건이 좋긴 하더라고요… 그래도 에이전트님 생각을 듣고 싶어요.', 'Their terms do sound good... but I want to hear what you think.'),
      SAY('솔직히 흔들려요. 요즘 저한테 신경을 덜 쓰시는 것 같았거든요.', 'Honestly, I\'m tempted. It felt like you weren\'t paying me much attention lately.')
    ], 1),
    options: [
      { label: (p, d, c) => L(`직접 만나 붙잡는다 (${Math.round(keepChanceOf(c) * 100)}%)`, `Meet him and make your case (${Math.round(keepChanceOf(c) * 100)}%)`), ap: 1,
        run: (c, p) => keepClient(c, p, keepChanceOf(c), 15, true) },
      { label: (p, d, c) => L(`보너스를 준다 (${Math.round((keepChanceOf(c) + 0.1) * 100)}%)`, `Offer a bonus (${Math.round((keepChanceOf(c) + 0.1) * 100)}%)`), cost: (d, c) => c.wage,
        run: (c, p) => keepClient(c, p, keepChanceOf(c) + 0.1, 12, false) },
      {
        label: () => L('그냥 둔다 (반반)', 'Do nothing (50/50)'),
        run: (c, p) => {
          if (Math.random() < 0.5) {
            removeClient(c, ['다른 에이전시로 옮겼습니다', 'left for another agency'], 2);
            return '';
          }
          addSat(c, -5);
          addBond(c, -3, MEMO.poachIgnored);
          return L(`${p.name} 선수가 일단 남았지만 흔들립니다 (만족 -5, 유대 -3).`, `${p.name} is staying for now, but he's wavering (morale -5, bond -3).`);
        }
      }
    ],
    def: 2
  },
  family: {
    chance: () => TUNE.familyChance,
    text: (p, d) => vary(d, [
      () => L(`${p.name} 선수가 가족 일로 며칠 쉬고 싶어 합니다.`, `${p.name} wants a few days off for a family matter.`),
      () => L(`${p.name} 선수의 아버지가 입원하셨습니다. 선수는 며칠 고향에 다녀오고 싶어 합니다.`, `${p.name}'s father is in hospital. He wants to go home for a few days.`),
      () => L(`${p.name} 선수의 조카가 태어났습니다. 가족이 모이는 자리에 꼭 가고 싶어 합니다.`, `${p.name}'s niece has just been born, and he badly wants to be there when the family gathers.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('경기 하나 빠지는 거 알아요. 그래도 이번엔 가족 곁에 있어야 할 것 같아요.', 'I know I\'ll miss a game. But this time I think I need to be with my family.'),
      SAY('감독님한테 직접 말할 용기가 안 나요. 에이전트님이 도와주실 수 있어요?', 'I don\'t have the nerve to ask the coach myself. Could you help?'),
      SAY('돌아오면 두 배로 뛸게요. 약속해요.', 'When I\'m back I\'ll work twice as hard. I promise.')
    ], 1),
    options: [
      // 13단계: 허락하면 이번 주 경기에 빠짐 (선수의 말처럼)
      { label: () => L('휴가를 허락한다 (이번 주 경기 결장)', "Let him go (misses this week's games)"), bond: 5, memo: M('가족 일에 휴가를 허락함', 'Let him take time off for his family'),
        run: (c, p) => {
          if (!c.out) c.out = { w: absWeek() + 1, k: 'fam' };
          state.world.form[c.s] = Math.max(1, state.world.form[c.s] - 1);
          addSat(c, 8);
          return L(`${p.name} 휴가 허락: 이번 주 경기에 빠집니다 (폼 -1, 만족 +8).`, `${p.name} goes home for a few days and misses this week's games (form -1, morale +8).`);
        } },
      { label: () => L('거절한다', 'Say no'), bond: -5, memo: M('가족 일에 휴가를 거절함', 'Refused him time off for his family'),
        run: (c, p) => (addSat(c, -6), L(`${p.name} 선수가 서운해합니다 (만족 -6).`, `${p.name} feels let down (morale -6).`)) }
    ],
    def: 1
  },
  expiring: {
    chance: c => (c.warned !== c.end && c.end - absWeek() <= 8 && c.end >= absWeek() ? 1 : 0),
    make: c => ((c.warned = c.end), {}),
    text: (p, d, c) => vary(d, [
      () => L(`${p.name} 선수 계약이 ${c.end - absWeek()}주 뒤에 끝납니다. 끝나면 무소속이 되어 수수료가 끊깁니다.`,
        `${p.name}'s contract ends in ${pl(c.end - absWeek(), 'week')}. After that he's a free agent and your commission stops.`),
      () => L(`${p.name} 선수 계약 만료가 ${c.end - absWeek()}주 남았습니다. 구단은 아직 아무 말이 없습니다.`,
        `${p.name} has ${pl(c.end - absWeek(), 'week')} left on his contract. The club hasn't said a word yet.`),
      () => L(`${p.name} 선수 계약이 ${c.end - absWeek()}주 남았습니다. 벌써 다른 구단 스카우트들이 경기장에 나타나기 시작했습니다.`,
        `${p.name} has ${pl(c.end - absWeek(), 'week')} left on his deal, and scouts from other clubs have started turning up at his games.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('구단이 저를 잡을 생각이 있는 걸까요? 요즘 그 생각만 해요.', 'Do you think the club wants to keep me? It\'s all I think about.'),
      SAY('계약 얘기는 에이전트님만 믿고 있어요.', 'I\'m leaving the contract entirely in your hands.'),
      SAY('다른 팀 얘기가 들려도 흔들리지 않을게요. 대신 에이전트님이 제 다음을 꼭 챙겨 주세요.', 'Whatever I hear from other clubs, I won\'t get distracted. Just make sure you look after what comes next for me.')
    ], 1),
    options: [
      { label: () => L('재계약 협상하러 간다', 'Go and negotiate a renewal'), go: true, run: (c, p) => L(`${p.name} 재계약을 준비합니다.`, `You start preparing ${p.name}'s renewal.`) },
      { label: () => L('나중에', 'Later'), run: () => '' }
    ],
    def: 1
  },
  // 9단계 이적 요청: 지금 구단이 잘 안 맞는 선수가 이적 기간에 새 구단을 찾아 달라고 털어놓음 (마감까지 2주 이상 남았을 때)
  ask: {
    chance: (c, p) => {
      const win = windowAt();
      if (!win || windowLeft(win) < 2 || isFreeAgent(c) || c.hunt >= absWeek() || c.loan) return 0;
      return fitScore(fitChecks(p, prefsOf(p), p.club, c.wage, 0), prefsOf(p)) <= TUNE.askFit ? TUNE.askChance : 0;
    },
    text: (p, d) => vary(d, [
      () => L(`${p.name} 선수가 이번 이적 기간에 팀을 옮기고 싶다고 털어놓았습니다.`, `${p.name} has told you he wants to move before this transfer window closes.`),
      () => L(`${p.name} 선수가 조용히 할 말이 있다며 찾아왔습니다. 이번 기간에 떠나고 싶어 합니다.`, `${p.name} came to see you quietly. He wants to leave before the window shuts.`),
      () => L(`${p.name} 선수가 훈련이 끝난 뒤 따로 전화를 걸어 왔습니다. 이번 이적 기간 안에 새 팀을 찾고 싶다고 합니다.`, `${p.name} called you privately after training. He wants to find a new team before this window closes.`)
    ]),
    quote: (p, d) => vary(d, ASK_LINES[prefsOf(p).main], 1),
    options: [
      {
        label: () => L('새 구단을 알아본다', 'Start looking for a new club'), ap: 1, bond: 3, memo: M('이적을 원할 때 새 구단을 알아봐 줌', 'Went looking for a new club when he wanted to move'),
        run: (c, p) => ((c.hunt = windowEnd(windowAt())), addSat(c, 4), L(`${p.name} 선수의 새 구단을 알아봅니다. 마감까지 이적 제안이 더 자주 옵니다 (만족 +4).`,
          `You start sounding out clubs for ${p.name}. Offers will come more often until the deadline (morale +4).`))
      },
      {
        // 유대가 깊으면 남자는 말을 믿고 따라오지만, 아니면 서운해함
        label: () => L('남아서 자리를 찾자고 설득한다', 'Persuade him to stay and fight for his place'),
        run: (c, p) => (c.bond >= TUNE.bondCalm ? (addSat(c, 2), L(`${p.name} 선수가 에이전트를 믿고 남아서 버텨 보기로 했습니다 (만족 +2).`, `${p.name} trusts you and agrees to stay and fight (morale +2).`))
          : (addSat(c, -3), L(`${p.name} 선수가 설득을 받아들였지만 표정이 어둡습니다 (만족 -3).`, `${p.name} goes along with it, but he doesn't look happy (morale -3).`)))
      },
      { label: () => L('지금은 때가 아니라고 한다', "Tell him now isn't the time"), bond: -3, memo: M('이적을 원할 때 들어주지 않음', "Didn't listen when he wanted to move"),
        run: (c, p) => (addSat(c, -5), L(`${p.name} 선수가 실망했습니다 (만족 -5).`, `${p.name} is disappointed (morale -5).`)) }
    ],
    def: 2
  },
  // --- 8단계 관계 이야기: 유대가 깊어진 선수에게 선수마다 한 번씩 (make에서 시작한 것으로 기록) ---
  // tale = { title: [한국어, 영어], need: 필요한 유대, weeks: 함께한 주 }, quote = 선수의 말
  call: {
    tale: { title: ['밤 11시의 전화', 'The 11 p.m. call'], need: 45, weeks: 8 },
    chance: c => (taleReady(c, 'call') && c.sat < 65 ? TUNE.taleChance : 0),
    make: c => (startTale(c, 'call'), {}),
    text: (p, d) => vary(d, [
      () => L(`밤 11시, ${p.name} 선수에게서 전화가 왔습니다.`, `At 11 p.m., your phone lights up. It's ${p.name}.`),
      () => L(`밤 11시가 넘은 시간, ${p.name} 선수의 이름이 휴대폰에 떴습니다.`, `It's past 11 at night when ${p.name}'s name appears on your screen.`),
      () => L(`잠들려던 참에 ${p.name} 선수가 전화를 걸어왔습니다. 목소리가 낮습니다.`, `You're about to fall asleep when ${p.name} calls. His voice is low.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('요즘 경기가 너무 안 풀려서요… 그냥 에이전트님 목소리 듣고 싶었어요.', 'Nothing\'s going right on the pitch lately... I just wanted to hear your voice.'),
      SAY('숙소에 혼자 있으니까 별생각이 다 들어요. 제가 여기서 뭘 하고 있는 건지 모르겠어요.', 'Alone in my room, my mind goes everywhere. I don\'t know what I\'m doing here.'),
      SAY('오늘 경기 끝나고 아무하고도 말을 못 했어요. 에이전트님밖에 생각이 안 났어요.', 'I couldn\'t talk to anyone after today\'s game. You were the only person I thought of.'),
      SAY('늦게 죄송해요. 내일 다시 웃으려면 오늘 누군가한테 털어놔야 할 것 같아서요.', 'Sorry it\'s so late. If I want to smile again tomorrow, I need to get this off my chest tonight.')
    ], 1),
    options: [
      { label: () => L('지금 만나러 간다', 'Go and see him now'), ap: 1, bond: 4, memo: M('힘들 때 밤늦게 만나러 와 줌', 'Came to see him late at night when he was struggling'),
        run: (c, p) => ((c.met = absWeek()), addSat(c, 8), L(`${p.name} 선수를 밤늦게 만나 이야기를 들었습니다 (만족 +8).`, `You went to see ${p.name} late at night and listened (morale +8).`)) },
      { label: () => L('오래 통화하며 들어 준다', 'Stay on the phone and listen'), bond: 2, memo: M('밤늦은 전화를 오래 들어 줌', 'Stayed on the phone with him late into the night'),
        run: (c, p) => (addSat(c, 4), L(`${p.name} 선수와 오래 통화했습니다 (만족 +4).`, `You talked with ${p.name} for a long time (morale +4).`)) },
      { label: () => L('내일 얘기하자고 한다', 'Say you\'ll talk tomorrow'), bond: -2, memo: M('밤늦은 전화를 끊음', 'Cut short his late-night call'),
        run: (c, p) => L(`${p.name} 선수에게 내일 얘기하자고 했습니다.`, `You told ${p.name} you'd talk tomorrow.`) }
    ],
    def: 2
  },
  wedding: {
    tale: { title: ['가족 결혼식', 'A family wedding'], need: 60, weeks: 26 },
    chance: c => (taleReady(c, 'wedding') ? TUNE.taleChance : 0),
    make: c => (startTale(c, 'wedding'), { who: familyOf(c) }),
    text: (p, d) => vary(d, [
      () => L(`${p.name} 선수가 ${d.who} 결혼식에 초대했습니다.`, `${p.name} has invited you to his ${familyName(d.who)}'s wedding.`),
      () => L(`${p.name} 선수가 손글씨로 쓴 청첩장을 건넸습니다. ${d.who} 결혼식입니다.`, `${p.name} handed you a handwritten invitation to his ${familyName(d.who)}'s wedding.`),
      () => L(`${p.name} 선수가 들뜬 목소리로 전화했습니다. ${d.who} 결혼식 날짜가 잡혔는데, 에이전트님도 꼭 와 달라고 합니다.`, `${p.name} rang, sounding thrilled. His ${familyName(d.who)}'s wedding date is set, and he really wants you there.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('에이전트님이 와 주시면 가족들이 정말 좋아할 거예요. 저 무명일 때부터 챙겨 주신 분이라고 늘 얘기했거든요.', 'My family would love it if you came. I\'ve always told them you looked after me when nobody knew my name.'),
      SAY('엄마가 꼭 모셔 오래요. 에이전트님 자리는 가족석으로 해 뒀대요.', 'Mum insists you come. She\'s saved you a seat at the family table.'),
      SAY('바쁘신 거 알아요. 그래도 이날만큼은 제 옆에 계셔 주면 좋겠어요.', 'I know you\'re busy. But on this one day, I\'d love to have you there with me.')
    ], 1),
    options: [
      { label: () => L('직접 참석한다', 'Go in person'), ap: 1, cost: () => 500, bond: 5, memo: M('가족 결혼식에 직접 와 줌', "Came to his family's wedding in person"),
        run: (c, p) => (addSat(c, 6), L(`${p.name} 선수 가족 결혼식에 참석했습니다 (만족 +6).`, `You attended ${p.name}'s family wedding (morale +6).`)) },
      { label: () => L('선물만 보낸다', 'Just send a gift'), cost: () => 1000, bond: 2, memo: M('가족 결혼식에 선물을 보냄', "Sent a gift for his family's wedding"),
        run: (c, p) => (addSat(c, 2), L(`${p.name} 선수 가족에게 결혼 선물을 보냈습니다 (만족 +2).`, `You sent ${p.name}'s family a wedding gift (morale +2).`)) },
      { label: () => L('바빠서 못 간다', "Say you're too busy"), bond: -2, memo: M('가족 결혼식에 오지 못함', "Couldn't make it to his family's wedding"),
        run: (c, p) => L(`${p.name} 선수 가족 결혼식에 가지 못했습니다.`, `You couldn't make it to ${p.name}'s family wedding.`) }
    ],
    def: 2
  },
  junior: {
    // 이야기를 하나 이상 함께한 선수가 같은 나라 후배 유망주를 소개: 잘 아는 후배라 잠재력 범위가 좁고, 한동안 영입 확률이 오름
    tale: { title: ['후배 소개', 'A junior worth meeting'], need: 70, weeks: 52 },
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
      const bonus = L(`${TUNE.introWeeks}주 동안 영입 확률 +${TUNE.introBonus}%p.`, `Signing chance +${TUNE.introBonus} pts for ${pl(TUNE.introWeeks, 'week')}.`);
      return vary(d, [
        () => L(`${p.name} 선수가 후배 ${j.name}(${ageOf(j)}세 ${j.pos}, ${j.club.name}, 잠재력 ${potText(j)})${josa(j.name, '을', '를')} 소개했습니다. ${bonus}`,
          `${p.name} wants you to meet a younger player: ${j.name} (${ageOf(j)}, ${j.pos}, ${j.club.name}, potential ${potText(j)}). ${bonus}`),
        () => L(`훈련이 끝나고 ${p.name} 선수가 휴대폰으로 같은 나라 후배 ${j.name}(${ageOf(j)}세 ${j.pos}, ${j.club.name}, 잠재력 ${potText(j)})의 경기 영상을 보여 줍니다. ${bonus}`,
          `After training, ${p.name} shows you clips on his phone of ${j.name} (${ageOf(j)}, ${j.pos}, ${j.club.name}, potential ${potText(j)}), a youngster from back home. ${bonus}`),
        () => L(`"이 친구는 꼭 보셔야 해요." ${p.name} 선수가 ${j.club.name}에서 뛰는 후배 ${j.name}(${ageOf(j)}세 ${j.pos}, 잠재력 ${potText(j)})${josa(j.name, '을', '를')} 직접 소개했습니다. ${bonus}`,
          `"You have to see this kid." ${p.name} has personally recommended ${j.name} (${ageOf(j)}, ${j.pos}, potential ${potText(j)}), who plays for ${j.club.name}. ${bonus}`)
      ]);
    },
    quote: (p, d) => vary(d, [
      SAY('제가 제일 믿는 에이전트라고 말해 뒀어요. 한번 만나 봐 주세요.', 'I told him you\'re the agent I trust most. Please meet him.'),
      SAY('어릴 때 제 모습이랑 똑같아요. 저처럼 좋은 에이전트를 만나면 크게 될 거예요.', 'He\'s just like I was at his age. With an agent like you, he could go a long way.'),
      SAY('그 녀석 부모님이 걱정이 많으세요. 에이전트님 같은 분이면 안심하실 거예요.', 'His parents worry a lot. Someone like you would put their minds at rest.')
    ], 1),
    options: [
      { label: () => L('만나러 간다', 'Go and meet him'), go: 'junior', bond: 2, memo: M('소개해 준 후배를 만나 줌', 'Met the junior he recommended'),
        run: (c, p, d) => L(`${p.name} 선수가 소개한 ${getPlayer(d.junior).name} 선수를 보러 갑니다.`, `You go to see ${getPlayer(d.junior).name}, as ${p.name} suggested.`) },
      { label: () => L('지금은 어렵다고 말한다', "Say it isn't a good time"), memo: M('후배 소개를 정중히 미룸', 'Politely put off meeting the junior'),
        run: (c, p) => L(`${p.name} 선수의 소개를 정중히 미뤘습니다.`, `You politely put off ${p.name}'s introduction.`) }
    ],
    def: 1
  },
  praise: {
    tale: { title: ['인터뷰의 고마움', 'Thanks in an interview'], need: 85, weeks: 104 },
    chance: c => (taleReady(c, 'praise') ? TUNE.taleChance : 0),
    make: c => (startTale(c, 'praise'), {}),
    text: (p, d) => vary(d, [
      () => L(`${p.name} 선수가 방송 인터뷰에서 에이전트 이야기를 꺼냈습니다.`, `${p.name} brought you up in a TV interview.`),
      () => L(`경기 최우수 선수로 뽑힌 ${p.name} 선수가 소감을 말하다가 에이전트 이름을 불렀습니다.`, `Named man of the match, ${p.name} thanked you by name in his post-match interview.`),
      () => L(`${p.name} 선수의 긴 인터뷰 기사가 실렸습니다. 한 문단이 통째로 에이전트 이야기입니다.`, `A long interview with ${p.name} has come out. A whole paragraph is about you.`)
    ]),
    quote: (p, d) => vary(d, [
      SAY('제 커리어의 절반은 에이전트님 덕분이에요. 아무도 저를 모를 때 먼저 손을 내밀어 준 사람이에요.', 'Half my career is down to my agent. He reached out when nobody knew who I was.'),
      SAY('힘들 때 제 편이 돼 준 사람이 있어요. 오늘 이 상은 그분 몫도 있어요.', 'There\'s someone who stood by me when things were hard. Part of this award is his.'),
      SAY('계약서보다 제 얘기를 먼저 들어 준 에이전트예요. 그래서 지금까지 함께해요.', 'He\'s an agent who listened to me before he looked at a contract. That\'s why we\'re still together.'),
      SAY('어린 선수들한테 말하고 싶어요. 좋은 사람을 곁에 두라고요. 저는 운이 좋았어요.', 'I want to tell young players: keep good people around you. I was lucky.')
    ], 1),
    options: [
      { label: () => L('식사 자리를 만든다', 'Take him out for dinner'), ap: 1, cost: () => 300, bond: 3, memo: M('인터뷰 뒤 함께 식사함', 'Took him out for dinner after the interview'),
        run: (c, p) => {
          addSat(c, 5);
          const rep = gainRep(2);
          return L(`${p.name} 선수와 식사했습니다 (평판 +${rep}, 만족 +5).`, `You had dinner with ${p.name} (reputation +${rep}, morale +5).`);
        } },
      { label: () => L('고맙다고 문자를 보낸다', 'Send a thank-you text'), bond: 1, memo: M('인터뷰에 고맙다고 답함', 'Texted to thank him for the interview'),
        run: (c, p) => {
          const rep = gainRep(2);
          return L(`${p.name} 선수의 인터뷰가 화제가 됐습니다 (평판 +${rep}).`, `${p.name}'s interview got people talking (reputation +${rep}).`);
        } }
    ],
    def: 1
  },
  tip: {
    text: (p, d) => vary(d, [
      () => L(`${state.invest.scout ? '스카우트망이' : '아는 스카우트가'} ${p.club.name}의 ${ageOf(p)}세 ${p.pos} ${p.name}(능력 ${p.ability}, 잠재력 ${potText(p)})${josa(p.name, '을', '를')} 추천했습니다. 보고서가 함께 와서 범위가 한 단계 좁습니다.`,
        `${state.invest.scout ? 'Your scouting network' : 'A scout you know'} recommends ${p.name}, ${ageOf(p)}, ${p.pos} at ${p.club.name} (ability ${p.ability}, potential ${potText(p)}). The report narrows his range by one step.`),
      () => L(`${state.invest.scout ? '스카우트망에서' : '아는 스카우트에게서'} 메모가 왔습니다. "${p.club.name}의 ${ageOf(p)}세 ${p.pos} ${p.name}, 꼭 한번 보세요." (능력 ${p.ability}, 잠재력 ${potText(p)})`,
        `A note from ${state.invest.scout ? 'your scouting network' : 'a scout you know'}: "Have a look at ${p.name}, ${ageOf(p)}, ${p.pos} at ${p.club.name}." (ability ${p.ability}, potential ${potText(p)})`),
      () => L(`${state.invest.scout ? '스카우트망' : '아는 스카우트'} 보고서에 ${named(p.name, '이', '가')} 올라왔습니다. ${p.club.name}에서 뛰는 ${ageOf(p)}세 ${p.pos}입니다 (능력 ${p.ability}, 잠재력 ${potText(p)}).`,
        `${p.name} has come up in ${state.invest.scout ? "your scouting network's" : "a scout friend's"} report: ${ageOf(p)}, ${p.pos} at ${p.club.name} (ability ${p.ability}, potential ${potText(p)}).`)
    ]),
    options: [
      { label: () => L('선수를 보러 간다', 'Go and watch him'), go: true, run: (c, p) => L(`${p.name} 선수를 살펴봅니다.`, `You take a closer look at ${p.name}.`) },
      { label: () => L('넘긴다', 'Pass'), run: () => '' }
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

// 선택지의 유대 변화 (숫자, 또는 선수 마음에 따라 다르면 (p, d) => 숫자)
const optBond = (opt, p, d) => (typeof opt.bond === 'function' ? opt.bond(p, d) : opt.bond || 0);

function pushEvent(type, s, d) {
  // 이적 기간에 계약 중인 선수에게 온 제안은 마감일까지 답해야 함 (마감일 막판 제안은 그 주 안에)
  const c = clientOf(s);
  const win = type === 'offer' && c && !isFreeAgent(c) ? windowAt() : null;
  const until = absWeek() + TUNE.eventTtl;
  const data = d || {};
  data.v = hash(state.seed, state.nextEventId) % 1000; // 상황 글·선수의 말 중 어느 문장인지 (게임 난수는 쓰지 않음)
  state.events.push({ id: state.nextEventId++, type, s, g: state.world.gen[s], until: win ? Math.min(until, windowEnd(win)) : until, d: data });
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
  if (!auto && opt.ap && state.ap < opt.ap) return toast(NO_AP()), null;
  if (!auto && cost > state.agencyCash) return toast(L(`자금이 부족합니다 (${cash(cost)} 필요)`, `Not enough cash (${cash(cost)} needed)`)), null;
  state.events = state.events.filter(e => e !== ev);
  if (opt.ap) state.ap -= opt.ap;
  state.agencyCash -= cost;
  // 유대 변화·기억 문구는 답하기 전 상황으로 (17단계: 선수 마음에 따라 다른 답은 함수)
  const bond = optBond(opt, p, ev.d);
  const memo = typeof opt.memo === 'function' ? opt.memo(p, ev.d) : opt.memo;
  const result = opt.run(c, p, ev.d);
  // 답하지 않고 넘어간 것도 선수는 기억함
  if (bond && c && clientOf(ev.s)) addBond(c, bond, auto ? `(답하지 않음) ${memo}` : memo);
  // 관계 이야기는 고른 답을 이야기 기록에 남김
  const tale = type.tale && c ? c.tales.find(t => t.k === ev.type) : null;
  if (tale) tale.t = `${auto ? '(답하지 않음) ' : ''}${memo || opt.label(p, ev.d, c)}`;
  // 결과 문장이 마침표 없이 끝나면 붙여서 "만족 +3. 유대 +1."
  const bondNote = bond && c && result ? `${/[.!?]$/.test(result) ? '' : '.'} ${L('유대', 'Bond')} ${bond > 0 ? '+' : ''}${bond}.` : '';
  if (result) addLog(`${auto ? L('(답하지 않아 기본 처리) ', '(No reply, so the default was used) ') : ''}${result}${bondNote}`);
  // go = true면 이 선수 상세로, 문자열이면 소식에 담긴 다른 선수(예: 소개받은 후배)로 이동
  return opt.go ? (opt.go === true ? ev.s : ev.d[opt.go]) : null;
}

// 경기 결과 한 마디 (구단 입장): "2-1 승", "1-1 무(승부차기 승)" / "W 2-1", "D 1-1, won on pens"
function resultWord(res) {
  const score = `${res.f}-${res.a}`;
  if (res.f !== res.a) return res.f > res.a ? L(`${score} 승`, `W ${score}`) : L(`${score} 패`, `L ${score}`);
  if (res.pk) return res.pk === 1 ? L(`${score} 무(승부차기 승)`, `D ${score}, won on pens`) : L(`${score} 무(승부차기 패)`, `D ${score}, lost on pens`);
  return L(`${score} 무`, `D ${score}`);
}
const COMP_SHORT = { L: ['리그', 'league'], C: ['컵', 'cup'], K: ['대륙', 'continental'] };
// 팀 결과 묶음 " [리그 2-1 승 · 컵 1-0 승]" (결과가 없으면 빈 문자열). results = [{ key, f, a, pk }]
function teamText(results) {
  const parts = Object.entries(COMP_SHORT).map(([key, name]) => {
    const list = results.filter(r => r.key === key);
    return list.length ? `${L(...name)} ${list.map(resultWord).join(', ')}` : '';
  }).filter(Boolean);
  return parts.length ? ` [${parts.join(' · ')}]` : '';
}

// 소속 선수 한 주 경기: 구단 경기 결과에 맞춰 출전·골·평점을 기록하고 요약 문구를 돌려줌
// "김민수 7.4(1골) [리그 2-1 승 · 컵 1-1 무(승부차기 승)]". away = 부상('inj')·휴가('fam')면 경기도 A매치도 없이 그 사실만. 무소속이면 구단 경기 없음
// 14단계: 지난주 경기를 숫자로 남겨(c.lw) 카드에 지금 언어로 보여 줌 { w: 경기한 절대 주차, n: 경기 수, p: 뛴 경기, r: 평균 평점×10, g: 골, t: [[대회, 득점, 실점, 승부차기]], a: 결장 이유 }
function playClientWeek(c, p, week, away) {
  c.lw = { w: absWeek() - 1, n: 0, p: 0, r: 0, g: 0, t: [], a: away || '' };
  if (away) return away === 'inj' ? L(`${p.name} 부상으로 결장`, `${p.name} out injured`) : L(`${p.name} 휴가로 결장`, `${p.name} away on leave`);
  const results = isFreeAgent(c) ? [] : weekResults(p.club, week);
  const level = clubLevel(p.club);
  const form = state.world.form[c.s];
  let games = 0;
  let played = 0;
  let sum = 0;
  let goals = 0;
  const play = (key, lv, hard, res) => {
    games += 1;
    const m = playMatch(p, lv, form, Math.random, hard, res);
    addMatch(c.st[key], m);
    if (m) {
      played += 1;
      sum += m.rating;
      goals += m.goals;
    }
  };
  for (const res of results) play(res.key, level, res.key === 'K', res);
  if (games) c.playRate = c.playRate * 0.75 + (played / games) * 0.25;
  let call = '';
  if (NT_WEEKS.includes(week) && isNationalPick(p)) {
    const first = !c.capped;
    c.capped = true;
    play('N', natCutOf(p) + 2, true);
    play('N', natCutOf(p) + 2, true);
    addSat(c, first ? 6 : 3);
    if (first) {
      addBond(c, 5, MEMO.firstCap);
      pushNews({ k: 'call', s: c.s, g: c.g, nm: p.ko, nk: p.nk, nat: p.nat.id });
    }
    const got = first ? gainRep(2) : 0;
    state.stats.callups += 1;
    call = first ? L(` · 첫 국가대표 발탁! (평판 +${got})`, ` · first national team call-up! (reputation +${got})`) : L(' · 국가대표 소집', ' · on national team duty');
  }
  Object.assign(c.lw, { n: games, p: played, r: played ? Math.round((sum / played) * 10) : 0, g: goals, t: results.map(r => [r.key, r.f, r.a, r.pk]) });
  if (!games && !call) return '';
  const goalText = goals ? L(`(${goals}골)`, ` (${pl(goals, 'goal')})`) : '';
  return `${p.name} ${played ? `${(sum / played).toFixed(1)}${goalText}` : games ? L('결장', "didn't play") : ''}${teamText(results)}${call}`;
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
    // 13단계: 부상·휴가(c.out = { w: 다시 뛸 수 있는 절대 주차, k: 'inj'·'fam' }) 중에는 그 주 경기에 못 나감
    const away = c.out && now - 1 < c.out.w ? c.out.k : '';
    if (week >= 1) {
      const line = playClientWeek(c, p, week, away);
      if (line) lines.push(line);
    }
    if (c.out && c.out.w <= now) {
      if (c.out.k === 'inj') addLog(L(`${p.name} 선수가 부상에서 회복했습니다. 이번 주부터 다시 뛸 수 있습니다.`, `${p.name} has recovered from injury and is available again this week.`));
      c.out = null;
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
    // 이적 요청을 받고 알아봤지만 마감까지 새 구단을 못 찾음
    if (c.hunt && c.hunt < now) {
      c.hunt = 0;
      addSat(c, -TUNE.huntMiss);
      addLog(L(`마감까지 ${p.name} 선수의 새 구단을 찾지 못했습니다. 선수가 아쉬워합니다 (만족 -${TUNE.huntMiss}).`,
        `The window shut before you found ${p.name} a new club. He's disappointed (morale -${TUNE.huntMiss}).`));
    }
    if (left === -1 && c.loan) endLoan(c, true);
    if (left === -1) addLog(L(`${p.name} 선수 계약이 끝나 무소속이 됐습니다. 재계약하거나 이적시키기 전까지 수수료가 없습니다.`,
      `${p.name}'s contract has run out and he is now a free agent. You earn no fee until he re-signs or moves.`));
    if (c.sat < TUNE.satLeave) removeClient(c, ['불만이 쌓여 에이전시를 떠났습니다', 'grew unhappy and left the agency'], 2);
  }
  for (const ev of state.events.filter(e => e.until < now)) resolveEvent(ev.id, EVENT_TYPES[ev.type].def, true);

  let added = 0;
  for (const c of state.clients) {
    if (state.events.length >= TUNE.eventMax) break;
    if (state.events.some(e => e.s === c.s)) continue;
    const p = getPlayer(c.s);
    for (const [key, type] of Object.entries(EVENT_TYPES)) {
      // 유망주 추천(tip)·임대 뒤 완전 이적(buy)은 주마다 굴리지 않음 (chance 없음)
      if (!type.chance || Math.random() >= type.chance(c, p)) continue;
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
  lawyer: { names: ['변호사', 'Lawyer'], descs: ['계약서를 꼼꼼히 봐서 같은 조건에서 돈을 더 받아냅니다.', 'Reads every contract closely and squeezes more money out of the same deal.'],
    fx: lv => L(`재계약 주급 +${Math.round(TUNE.lawyerWage[lv] * 100)}% · 이적 "더 요구" 성공 +${TUNE.lawyerCounter[lv]}%p`, `Renewal wages +${Math.round(TUNE.lawyerWage[lv] * 100)}% · "Push for more" success +${TUNE.lawyerCounter[lv]} pts`) },
  scout: { names: ['스카우트망', 'Scouting network'], descs: ['선수 정보를 넓게 모아 영입이 쉬워집니다.', 'Gathers information far and wide, making signings easier.'],
    fx: lv => L(`영입 성공 +${TUNE.scoutRecruit[lv]}%p · 처음 보이는 잠재력 범위 폭 ${TUNE.potWidth[TUNE.scoutKnow[lv]]} · 유망주 추천은 후보 ${TUNE.scoutTips[lv]}명 중 잠재력이 가장 높은 선수`,
      `Signing success +${TUNE.scoutRecruit[lv]} pts · starting potential range width ${TUNE.potWidth[TUNE.scoutKnow[lv]]} · prospect tips pick the best of ${TUNE.scoutTips[lv]}`) },
  coach: { names: ['피지컬 코치', 'Fitness coach'], descs: ['소속 선수의 몸을 따로 관리합니다.', 'Looks after your players\' bodies personally.'],
    fx: lv => L(`시즌 말 성장 +${Math.round(TUNE.coachGrow[lv] * 100)}% · 30대 하락을 ${Math.round(TUNE.coachAge[lv] * 100)}% 확률로 1 줄임 · 부상 소식 -${Math.round(TUNE.coachInjury[lv] * 100)}%`,
      `End-of-season growth +${Math.round(TUNE.coachGrow[lv] * 100)}% · ${Math.round(TUNE.coachAge[lv] * 100)}% chance to soften decline after 30 · injuries -${Math.round(TUNE.coachInjury[lv] * 100)}%`) },
  office: { names: ['사무실 확장', 'Bigger office'], descs: ['직원을 늘려 선수를 더 맡습니다. 맡은 선수가 늘면 할 일도 늘어납니다.', 'More staff so you can take on more players. More players means more work.'],
    fx: lv => L(`소속 한도 +${TUNE.officeLimit[lv]}명`, `Roster limit +${TUNE.officeLimit[lv]}`) }
};
for (const t of Object.values(INVEST_TYPES)) Object.defineProperties(t, { name: { get() { return L(...this.names); } }, desc: { get() { return L(...this.descs); } } });
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
    { ok: state.rep >= TUNE.foundRep, text: L(`평판 ${TUNE.foundRep} 이상 (지금 ${state.rep})`, `Reputation ${TUNE.foundRep}+ (now ${state.rep})`) },
    { ok: state.agencyCash >= TUNE.foundCash, text: L(`자금 ${cash(TUNE.foundCash)} 이상 (지금 ${cash(state.agencyCash)}, 설립비 ${cash(TUNE.foundCost)} 포함)`, `Cash ${cash(TUNE.foundCash)}+ (now ${cash(state.agencyCash)}, includes the ${cash(TUNE.foundCost)} setup fee)`) },
    { ok: income >= after, text: L(`주간 수수료가 회사 운영비 이상 (${cash(income)} / ${cash(after)})`, `Weekly commission covers company costs (${cash(income)} / ${cash(after)})`) }
  ];
}
const foundBlock = () => (state.founded ? L('이미 회사를 세웠습니다', 'You have already founded the agency') : state.over ? GAME_OVER() : foundChecks().every(ch => ch.ok) ? '' : L('설립 조건을 아직 채우지 못했습니다', "You don't meet the founding conditions yet"));

function foundAgency() {
  const block = foundBlock();
  if (block) return toast(block);
  if (!confirm(L(`에이전시를 세울까요?\n설립비 ${cash(TUNE.foundCost)}, 남은 돈은 회사 자본금(법인 자금)이 됩니다.\n운영비가 주 ${cash(upkeepNow())}에서 ${cash(companyUpkeep())}로 오르고, 주당 AP ${TUNE.soloAp} → ${TUNE.ap}, 소속 한도 ${TUNE.limitBase}명, 법인 투자·배당이 열립니다.`,
    `Found your agency?\nSetup fee ${cash(TUNE.foundCost)}. The rest of your money becomes company capital.\nRunning costs rise from ${cash(upkeepNow())} to ${cash(companyUpkeep())} a week, AP goes from ${TUNE.soloAp} to ${TUNE.ap}, your roster limit becomes ${TUNE.limitBase}, and investments and dividends open up.`))) return;
  state.agencyCash -= TUNE.foundCost;
  state.founded = true;
  state.ap += TUNE.ap - TUNE.soloAp; // 직원이 생겨 이번 주부터 손이 늘어남
  for (const c of state.clients) addBond(c, TUNE.bondFound, MEMO.founded);
  const names = listText(state.clients.map(c => getPlayer(c.s).name));
  addLog(L(`에이전시를 세웠습니다 (설립비 ${cash(TUNE.foundCost)}). ${names ? `혼자 일할 때부터 함께한 ${names} 선수가 따라왔습니다 (유대 +${TUNE.bondFound}).` : ''}`,
    `You founded your agency (setup fee ${cash(TUNE.foundCost)}). ${names ? `${names}, who ${state.clients.length === 1 ? 'was' : 'were'} with you from the start, came along (bond +${TUNE.bondFound}).` : ''}`));
  toast(L('에이전시를 세웠습니다!', 'Your agency is up and running!'));
  saveState();
}

function investBlock(key) {
  const lv = state.invest[key];
  if (!state.founded) return L('회사를 세우면 투자할 수 있습니다', 'Found your agency to start investing');
  if (state.over) return GAME_OVER();
  if (lv >= investSteps(key).length) return L('최고 단계입니다', 'Already at the top level');
  const cost = investSteps(key)[lv][0];
  if (state.agencyCash < cost) return L(`법인 자금이 부족합니다 (${cash(cost)} 필요)`, `Not enough company cash (${cash(cost)} needed)`);
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
  const warn = net < 0 ? L(`\n주의: 도입하면 주간 수지가 ${signedCash(net)}로 적자가 됩니다.`, `\nWarning: this puts your weekly balance at ${signedCash(net)}, a loss.`) : '';
  if (!confirm(L(`${t.name} ${lv}단계를 도입할까요?\n도입비 ${cash(cost)} (돌려받지 못함)\n유지비 매주 ${cash(upkeep)}${warn}`, `Buy ${t.name} level ${lv}?\nSetup ${cash(cost)} (non-refundable)\nUpkeep ${cash(upkeep)} a week${warn}`))) return;
  state.agencyCash -= cost;
  state.invest[key] = lv;
  addLog(L(`${t.name} ${lv}단계 도입: 도입비 ${cash(cost)}, 유지비 주 ${cash(upkeep)} (${t.fx(lv)})`, `${t.name} level ${lv}: setup ${cash(cost)}, upkeep ${cash(upkeep)}/week (${t.fx(lv)})`));
  toast(L(`${t.name} ${lv}단계를 도입했습니다.`, `${t.name} level ${lv} is in place.`));
  saveState();
}

// 단계 낮추기: 유지비는 줄지만 도입비는 돌려받지 못함
function downgrade(key) {
  const t = INVEST_TYPES[key];
  const lv = state.invest[key];
  if (!lv) return;
  const upkeep = lv > 1 ? investSteps(key)[lv - 2][1] : 0;
  const what = lv > 1 ? L(`${t.name} ${lv - 1}단계로 줄일까요?`, `Drop ${t.name} to level ${lv - 1}?`) : L(`${t.name} 투자를 그만둘까요?`, `Stop investing in ${t.name}?`);
  if (!confirm(L(`${what}\n유지비 매주 ${cash(upkeep)}\n도입비는 돌려받지 못하고, 다시 올리려면 또 내야 합니다.`, `${what}\nUpkeep ${cash(upkeep)} a week\nSetup costs aren't refunded, and you'll pay them again to level back up.`))) return;
  state.invest[key] = lv - 1;
  addLog(L(`${t.name} ${lv > 1 ? `${lv - 1}단계로 줄임` : '투자 그만둠'} (유지비 주 ${cash(upkeep)})`, `${t.name} ${lv > 1 ? `down to level ${lv - 1}` : 'cancelled'} (upkeep ${cash(upkeep)}/week)`));
  saveState();
}

// 배당(법인 → 개인): 세금을 떼고, 운영 자금 몇 주치(TUNE.reserveWeeks)는 법인에 남김
const dividendRoom = () => Math.max(0, Math.floor((state.agencyCash - weeklySpend() * TUNE.reserveWeeks) / 100) * 100);
const afterTax = amount => Math.round(amount * (1 - TUNE.tax));

function payDividend(amount) {
  if (!state.founded) return toast(L('회사를 세우기 전에는 자금이 모두 내 돈이라 배당이 필요 없습니다', "Before you found a company, all the money is yours, so there's nothing to pay out"));
  if (state.over) return toast(GAME_OVER());
  if (!(amount > 0) || amount > dividendRoom()) return toast(L('배당할 수 있는 자금이 없습니다', 'There is nothing available to pay out'));
  const net = afterTax(amount);
  if (!confirm(L(`배당할까요?\n배당 ${cash(amount)} - 세금 ${cash(amount - net)} = 개인 자금 +${cash(net)}`, `Pay a dividend?\n${cash(amount)} - tax ${cash(amount - net)} = personal cash +${cash(net)}`))) return;
  state.agencyCash -= amount;
  state.personalCash += net;
  addLog(L(`배당 ${cash(amount)}: 세금 ${cash(amount - net)}, 개인 자금 +${cash(net)}`, `Dividend ${cash(amount)}: tax ${cash(amount - net)}, personal cash +${cash(net)}`));
  saveState();
}

// 개인 자금을 법인에 넣기: 세금 없음 (자금이 마이너스일 때 파산을 막는 데 씀)
function inject(amount) {
  if (state.over) return toast(GAME_OVER());
  if (!(amount > 0) || amount > state.personalCash) return toast(L('넣을 개인 자금이 없습니다', 'You have no personal cash to put in'));
  if (!confirm(L(`개인 자금 ${cash(amount)}${josa(cash(amount), '을', '를')} 법인에 넣을까요?\n넣을 때는 세금이 없고, 다시 꺼내려면 배당 세금 ${Math.round(TUNE.tax * 100)}%가 붙습니다.`,
    `Put ${cash(amount)} of your own money into the company?\nNo tax going in, but taking it out again costs ${Math.round(TUNE.tax * 100)}% dividend tax.`))) return;
  state.personalCash -= amount;
  state.agencyCash += amount;
  addLog(L(`개인 자금 ${cash(amount)}${josa(cash(amount), '을', '를')} 법인에 넣었습니다.`, `You put ${cash(amount)} of your own money into the company.`));
  saveState();
}

// 개인 아이템: 개인 자금으로 사고, 살 때 평판이 오름(평판이 높을수록 적게). 가격·평판은 TUNE.itemPrice·itemRep
// 회사를 세우기 전에는 자금이 모두 내 돈이라 자금에서 바로 삼
const ITEMS = [['suit', '맞춤 정장', 'Tailored suit'], ['watch', '명품 시계', 'Luxury watch'], ['sedan', '고급 세단', 'Luxury sedan'], ['box', '경기장 VIP 박스', 'Stadium VIP box'], ['penthouse', '펜트하우스', 'Penthouse'], ['yacht', '요트', 'Yacht']];
const itemName = i => L(ITEMS[i][1], ITEMS[i][2]);
const walletKey = () => (state.founded ? 'personalCash' : 'agencyCash');
// 개인 자산 = 개인 자금 + 가진 아이템 값 (나중에 은퇴 엔딩 점수로 씀)
const netWorth = () => state[walletKey()] + ITEMS.reduce((n, [id], i) => n + (state.items.includes(id) ? TUNE.itemPrice[i] : 0), 0);

function itemBlock(i) {
  if (state.over) return GAME_OVER();
  if (state.items.includes(ITEMS[i][0])) return L('이미 가지고 있습니다', 'You already own it');
  if (state[walletKey()] < TUNE.itemPrice[i]) return L(`${state.founded ? '개인 ' : ''}자금이 부족합니다 (${cash(TUNE.itemPrice[i])} 필요)`, `Not enough ${state.founded ? 'personal ' : ''}cash (${cash(TUNE.itemPrice[i])} needed)`);
  return '';
}

function buyItem(i) {
  const block = itemBlock(i);
  if (block) return toast(block);
  const id = ITEMS[i][0];
  const name = itemName(i);
  const lower = name[0].toLowerCase() + name.slice(1); // 문장 안에서 "the stadium VIP box" (VIP는 그대로)
  const price = TUNE.itemPrice[i];
  if (!confirm(L(`${named(name, '을', '를')} 살까요?\n가격 ${cash(price)} (${state.founded ? '개인 자금' : '내 돈'}, 되팔 수 없음)`, `Buy the ${lower}?\nPrice ${cash(price)} (${state.founded ? 'personal cash' : 'your own money'}, can't be resold)`))) return;
  state[walletKey()] -= price;
  state.items.push(id);
  const got = gainRep(TUNE.itemRep[i]);
  addLog(L(`${name} 구입: ${cash(price)}, 평판 +${got}`, `Bought: ${name}, ${cash(price)}, reputation +${got}`));
  toast(L(`${named(name, '을', '를')} 샀습니다. 평판 +${got}`, `You bought the ${lower}. Reputation +${got}`));
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
  return lo === hi ? String(lo) : L(`${lo}~${hi}`, `${lo}–${hi}`);
}

function scoutBlock(p) {
  if (state.over) return GAME_OVER();
  if (clientOf(p.s)) return L('소속 선수라 잠재력을 정확히 압니다', "He's your client, so you know his potential exactly");
  const [lo, hi] = potRange(p);
  if (lo === hi) return L('잠재력을 이미 정확히 압니다', 'You already know his exact potential');
  if (state.ap < 1) return NO_AP();
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
  addLog(L(`${p.name} 스카우트 보고서: 잠재력 ${text}`, `Scouting report on ${p.name}: potential ${text}`));
  toast(L(`스카우트 보고서: 잠재력 ${text}`, `Scouting report: potential ${text}`));
  saveState();
}

// 관심 목록: 슬롯-세대 키로 저장 (은퇴하면 시즌 말에 빠지고, 영입하면 빠짐)
function toggleWatch(s) {
  const key = cooldownKey(getPlayer(s));
  if (state.watch.includes(key)) state.watch = state.watch.filter(k => k !== key);
  else if (state.watch.length >= TUNE.watchMax) return toast(L(`관심 선수는 ${TUNE.watchMax}명까지 둘 수 있습니다`, `You can watch up to ${TUNE.watchMax} players`));
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

// ===== 6-5. 세계 뉴스 (10단계, 축구 감독 게임의 뉴스·구단 보강 정보에서 가져옴) =====
// 이적 기간이 열리면 주전이 약한 포지션이 있는 구단을 찾아 "보강 필요"로 알리고, 기간 동안 그 구단들이 실제로 선수를 데려옴.
// 뉴스는 글이 아니라 데이터로 저장하고(state.news) 화면에서 문장으로 만듦. 이름은 그때의 이름을 같이 저장(은퇴하면 슬롯 주인이 바뀌므로)
const POS_NAME = { GK: ['골키퍼', 'goalkeeper'], DF: ['수비수', 'defender'], MF: ['미드필더', 'midfielder'], FW: ['공격수', 'forward'] };
const posName = pos => L(...POS_NAME[pos]);
const STARTERS = { GK: 1, DF: 4, MF: 4, FW: 2 }; // 포지션별 주전 수
// 조사: 끝 글자의 받침으로 고름. 숫자로 끝나면 읽는 소리로(1904 → "사", 56 → "육", 60 → "십"), 모르는 글자면 "이(가)"처럼 둘 다
// 받침 번호: 0 = 없음, 8 = ㄹ, 그 밖 = 다른 받침, -1 = 모름
const DIGIT_JONG = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0]; // 영 일 이 삼 사 오 육 칠 팔 구
const ZERO_JONG = [17, 1, 4, 4]; // 끝이 0이면 자리 이름: 십(ㅂ) 백(ㄱ) 천(ㄴ) 만(ㄴ)
function lastJong(word) {
  const ch = word.charCodeAt(word.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) return (ch - 0xac00) % 28;
  const digits = word.match(/\d+$/);
  if (!digits) return -1;
  const zeros = digits[0].length - digits[0].replace(/0+$/, '').length;
  if (!zeros) return DIGIT_JONG[ch - 48];
  return zeros === digits[0].length ? 21 : ZERO_JONG[Math.min(zeros, 4) - 1];
}
function josa(word, a, b) {
  const j = lastJong(word);
  if (a === '으로') return j < 0 ? '(으)로' : j === 0 || j === 8 ? '로' : '으로';
  return j < 0 ? `${a}(${b})` : j ? a : b;
}
const named = (word, a, b) => word + josa(word, a, b); // "런던 크라운이", "뮌헨 1904가", "포르투로"

// 구단 포지션별 주전 평균 능력과 구단 수준의 차이 (클수록 약함). 주전 수보다 선수가 적으면 빈자리는 능력 40으로 침
function clubGaps(club) {
  const by = { GK: [], DF: [], MF: [], FW: [] };
  for (const s of clubSlots(club)) {
    const p = getPlayer(s);
    by[p.pos].push(p.ability);
  }
  return Object.entries(STARTERS).map(([pos, n]) => {
    const top = by[pos].sort((a, b) => b - a);
    const avg = Array.from({ length: n }, (_, i) => top[i] ?? 40).reduce((a, b) => a + b, 0) / n;
    return { pos, avg: Math.round(avg), gap: Math.round(clubLevel(club) - avg) };
  });
}

function pushNews(item) {
  state.news.unshift({ w: absWeek(), ...item });
  if (state.news.length > TUNE.newsMax) state.news.length = TUNE.newsMax;
}

// 이적 기간이 열릴 때: 구단을 골라(1부 우선) 약한 포지션을 찾고, 큰 구단부터 뉴스로
function refreshNeeds(win) {
  const until = windowEnd(win);
  const picked = new Set();
  for (let i = 0; i < TUNE.needSample * 3 && picked.size < TUNE.needSample; i++) {
    const club = CLUBS[Math.floor(Math.random() * CLUBS.length)];
    if (club.t === 0 || Math.random() < 0.45) picked.add(club);
  }
  const found = [];
  for (const club of picked) {
    const worst = clubGaps(club).sort((a, b) => b.gap - a.gap)[0];
    if (worst.gap >= TUNE.needGap) found.push({ club: club.id, pos: worst.pos, gap: worst.gap, avg: worst.avg, until });
  }
  found.sort((a, b) => CLUBS[a.club].t - CLUBS[b.club].t || b.gap - a.gap);
  state.needs = found.slice(0, TUNE.needMax);
  state.deals = { n: 0, fee: 0, nm: '', to: -1 };
  // 뉴스: 큰 구단 needNews곳 + 내 선수가 맞는 구단
  state.needs.forEach((need, i) => {
    if (i < TUNE.needNews || state.clients.some(c => !pitchFit(c, need))) pushNews({ k: 'need', club: need.club, pos: need.pos, gap: need.gap, avg: need.avg });
  });
}

// 보강이 필요한 구단이 데려갈 만한 선수인지: 구단 수준 -1 ~ +5, 같거나 약한 구단 소속(조금 위까지), 32세 이하
const fitsNeed = (p, club) => p.ability >= clubLevel(club) - 1 && p.ability <= clubLevel(club) + 5 && clubLevel(p.club) <= clubLevel(club) + 2 && ageOf(p) <= 32;

// 이적 기간 매주: 보강이 필요한 구단이 다른 구단 선수를 실제로 데려옴 (내 선수는 빼고, 내 선수 이적은 제안으로만)
function worldSignings(win) {
  const n = Math.round(TUNE.signWeek * (windowLeft(win) === 0 ? TUNE.deadlineBoost : 1));
  for (let i = 0; i < n && state.needs.length; i++) {
    const need = state.needs[Math.floor(Math.random() * state.needs.length)];
    const club = CLUBS[need.club];
    let best = null;
    for (let tries = 0; tries < 150; tries++) {
      const p = getPlayer(Math.floor(Math.random() * SLOTS));
      if (p.pos !== need.pos || p.club === club || clientOf(p.s) || !fitsNeed(p, club)) continue;
      // 구단 수준 +2 근처의 젊은 선수를 좋아함
      const score = -Math.abs(p.ability - clubLevel(club) - 2) - Math.max(0, ageOf(p) - 27) * 0.5;
      if (!best || score > best.score) best = { p, score };
    }
    if (!best) continue;
    const p = best.p;
    const from = p.club;
    const fee = Math.round((valueOf(p) * (0.9 + Math.random() * 0.5)) / 50000) * 50000;
    if (club.id === Math.floor(p.s / SQUAD)) delete state.moved[p.s];
    else state.moved[p.s] = club.id;
    state.needs = state.needs.filter(x => x !== need);
    countDeal(p, fee, club.id);
    pushNews({ k: 'sign', s: p.s, g: p.g, nm: p.ko, nk: p.nk, from: from.id, to: club.id, pos: p.pos, fee, age: ageOf(p), ab: p.ability, late: isDeadline() });
  }
}

// 이번 이적 기간 결산용: 이적 건수와 가장 비싼 이적
function countDeal(p, fee, to) {
  state.deals.n += 1;
  if (fee > state.deals.fee) Object.assign(state.deals, { fee, nm: p.ko, nk: p.nk, to });
}

// --- 13단계 시즌 고비: 컵 결승(44주)·대륙 대회 결승(45주)·리그 마지막 라운드(46주) 다음 주 ---
// 5대 리그·내 선수 나라의 우승 소식과, 내 선수 구단의 우승(만족·유대·평판)·승격(만족·유대)·강등(만족 -)
const clientTag = (c, p) => ({ s: c.s, g: c.g, nm: p.ko, nk: p.nk, my: 1 });
// 15단계: 임대 중이면 "임대 팀", 이번 시즌 끝에 임대가 끝나는지
const teamOf = c => (c.loan ? ['임대 팀', 'loan club'] : ['소속팀', 'club']);
const loanEnding = c => Boolean(c.loan && c.loan.until <= state.season * WEEKS);
const clientClubs = () => state.clients.filter(c => !isFreeAgent(c)).map(c => {
  const p = getPlayer(c.s);
  return { c, p, club: p.club };
});
function celebrate(c, sat, memo, rep) {
  addSat(c, sat);
  addBond(c, TUNE.trophyBond, memo);
  return rep ? gainRep(1) : 0;
}
const gainText = (sat, rep, bond = TUNE.trophyBond) => L(`만족 ${sat > 0 ? '+' : ''}${sat}${bond ? `, 유대 +${bond}` : ''}${rep ? `, 평판 +${rep}` : ''}`,
  `morale ${sat > 0 ? '+' : ''}${sat}${bond ? `, bond +${bond}` : ''}${rep ? `, reputation +${rep}` : ''}`);

function cupFinale() {
  const mine = clientClubs();
  for (const country of new Set([...COUNTRIES.slice(0, BIG5), ...mine.map(x => x.club.country)])) {
    const f = cupOf(country).final;
    const fan = mine.find(x => x.club.id === f.club);
    pushNews({ k: 'cup', club: f.club, opp: f.opp, t: CLUBS[f.club].t, tb: CLUBS[f.opp].t, ga: f.f, gb: f.a, pa: f.pf, pb: f.pa, ...(fan ? clientTag(fan.c, fan.p) : {}) });
  }
  for (const { c, p, club } of mine) {
    if (!compRun(club, 'C').won) continue;
    const rep = celebrate(c, TUNE.cupSat, MEMO.trophy, true);
    addLog(L(`${p.name} 선수의 ${teamOf(c)[0]} ${named(club.name, '이', '가')} ${club.country.name} 컵 우승을 차지했습니다 (${gainText(TUNE.cupSat, rep)}).`,
      `${p.name}'s ${teamOf(c)[1]} ${club.name} have won the ${club.country.name} Cup (${gainText(TUNE.cupSat, rep)}).`));
  }
}

function contFinale() {
  const mine = clientClubs();
  // 결승 소식: 지역 최상위 대회가 뉴스 맨 위에 오게 거꾸로 넣음 (유럽은 세 대회)
  const items = [];
  for (const group of CONT_GROUPS) {
    contOf(group).finals.forEach((f, ci) => {
      if (!f) return;
      const fan = mine.find(x => x.club.id === f.club);
      items.push({ k: 'cont', club: f.club, opp: f.opp, ci, t: CLUBS[f.club].t, tb: CLUBS[f.opp].t, ga: f.f, gb: f.a, pa: f.pf, pb: f.pa, ...(fan ? clientTag(fan.c, fan.p) : {}) });
    });
  }
  items.reverse().forEach(pushNews);
  for (const { c, p, club } of mine) {
    if (!compRun(club, 'K').won) continue;
    const rep = celebrate(c, TUNE.titleSat, MEMO.trophy, true);
    addLog(L(`${p.name} 선수의 ${teamOf(c)[0]} ${named(club.name, '이', '가')} ${compName('K', club)} 정상에 올랐습니다 (${gainText(TUNE.titleSat, rep)}).`,
      `${p.name}'s ${teamOf(c)[1]} ${club.name} are ${compName('K', club)} champions (${gainText(TUNE.titleSat, rep)}).`));
  }
}

function leagueFinale() {
  const mine = clientClubs();
  const shown = new Set();
  const champ = country => {
    if (shown.has(country)) return;
    shown.add(country);
    const [a, b] = finalTable(country, 0);
    const fan = mine.find(x => x.club === a.club);
    pushNews({ k: 'champ', club: a.club.id, t: 0, pts: a.pts, gap: a.pts - b.pts, ...(fan ? clientTag(fan.c, fan.p) : {}) });
  };
  COUNTRIES.slice(0, BIG5).forEach(champ);
  const told = new Set();
  for (const { c, p, club } of mine) {
    if (club.t === 0) champ(club.country);
    const row = tableRow(club, finalTable(club.country, club.t));
    const zone = zoneOf(club.country, club.t, row.rk);
    const where = leagueName(club.country, club.t);
    if (row.rk === 1 && club.t === 0) {
      const rep = celebrate(c, TUNE.titleSat, MEMO.trophy, true);
      addLog(L(`${p.name} 선수의 ${teamOf(c)[0]} ${named(club.name, '이', '가')} ${where} 우승을 차지했습니다 (${gainText(TUNE.titleSat, rep)}).`,
        `${p.name}'s ${teamOf(c)[1]} ${club.name} are ${where} champions (${gainText(TUNE.titleSat, rep)}).`));
    } else if (zone === 'up') {
      const rep = celebrate(c, TUNE.upSat, MEMO.promoted, row.rk === 1); // 아래 부 우승이면 평판도
      if (!told.has(club) && !loanEnding(c)) pushNews({ k: 'up', club: club.id, t: club.t, rk: row.rk, ...clientTag(c, p) });
      addLog(L(`${p.name} 선수의 ${teamOf(c)[0]} ${named(club.name, '이', '가')} ${where} ${row.rk === 1 ? '우승으로' : `${row.rk}위로`} 승격을 확정했습니다${loanEnding(c) ? '' : `. 다음 시즌은 ${club.t}부에서 뜁니다`} (${gainText(TUNE.upSat, rep)}).`,
        `${p.name}'s ${teamOf(c)[1]} ${club.name} ${row.rk === 1 ? 'won' : `finished ${ordinal(row.rk)} in`} ${where} and are promoted to Div. ${club.t}${loanEnding(c) ? '' : ', where he will play next season'} (${gainText(TUNE.upSat, rep)}).`));
    } else if (zone === 'down' && !loanEnding(c)) {
      addSat(c, -TUNE.downSat);
      if (!told.has(club)) pushNews({ k: 'down', club: club.id, t: club.t, rk: row.rk, ...clientTag(c, p) });
      addLog(L(`${p.name} 선수의 ${teamOf(c)[0]} ${named(club.name, '이', '가')} ${where} ${row.rk}위로 강등됐습니다. 다음 시즌은 ${club.t + 2}부에서 뜁니다 (만족 -${TUNE.downSat}).`,
        `${p.name}'s ${teamOf(c)[1]} ${club.name} finished ${ordinal(row.rk)} in ${where} and are relegated to Div. ${club.t + 2} (morale -${TUNE.downSat}).`));
    }
    told.add(club);
  }
}

// 내 선수 추천: 보강이 필요한 구단에, 그 포지션의 내 선수를 1 AP로 추천. 마감까지 그 선수 제안이 잦아지고 그 구단에서 올 가능성이 높음
// pitchFit = 이 선수가 이 구단에 맞는지 (빈 문자열이면 맞음), pitchBlock = 지금 추천할 수 있는지 (AP·이미 추천함까지)
function pitchFit(c, need) {
  const p = getPlayer(c.s);
  const club = CLUBS[need.club];
  if (c.loan) return L('임대 중입니다', 'He is out on loan');
  if (p.pos !== need.pos) return L('포지션이 맞지 않습니다', "His position doesn't fit");
  if (p.club === club) return L('이미 이 구단 선수입니다', 'He already plays for this club');
  if (clubLevel(club) > p.ability + TUNE.dreamReach) return L('이 구단에는 아직 능력이 모자랍니다', "He isn't good enough for this club yet");
  if (clubLevel(club) < p.ability - 8 || (!isFreeAgent(c) && clubLevel(club) < clubLevel(p.club) - 2)) return L('지금보다 낮은 수준의 구단입니다', 'This club is a step down for him');
  return '';
}
const pitching = c => Boolean(c.pitch && c.pitch.until >= absWeek());
function pitchBlock(c, need) {
  const fit = pitchFit(c, need);
  if (fit) return fit;
  if (need.until < absWeek()) return L('이적 기간이 끝났습니다', 'The transfer window has closed');
  if (pitching(c)) return c.pitch.club === need.club ? L('이미 이 구단에 추천했습니다', "You've already pitched him to this club") : L(`이미 ${CLUBS[c.pitch.club].name}에 추천했습니다`, `You've already pitched him to ${CLUBS[c.pitch.club].name}`);
  if (state.ap < 1) return NO_AP();
  return '';
}

function pitch(s, clubId) {
  const c = clientOf(s);
  const need = state.needs.find(n => n.club === clubId);
  if (!c || !need) return toast(L('이 구단은 더 이상 보강을 찾지 않습니다', 'This club is no longer looking'));
  const block = pitchBlock(c, need);
  if (block) return toast(block);
  state.ap -= 1;
  c.pitch = { club: clubId, until: need.until };
  const p = getPlayer(s);
  addLog(L(`${CLUBS[clubId].name}에 ${named(p.name, '을', '를')} 추천했습니다. 마감까지 이 구단에서 제안이 올 가능성이 높아집니다.`, `You pitched ${p.name} to ${CLUBS[clubId].name}. An offer from them is more likely until the deadline.`));
  toast(L(`${p.name} 선수를 추천했습니다`, `You pitched ${p.name}`));
  saveState();
}

// ===== 6-6. 임대 (15단계, 축구 감독 게임의 임대에서 가져옴) =====
// 지금 구단에서 벤치인 소속 선수(출전 확률 TUNE.loanBench 미만)를 이적 기간에 주전으로 뛸 수 있는 구단에 시즌 끝까지 보냄 (1 AP).
// 계약·주급·내 수수료는 소속 구단과 그대로. 임대 중에는 이적 제안·이적 요청·추천이 없고, 23세 이하는 많이 뛸수록 더 자람(13단계 출전 비율 성장)
// c.loan = { club: 임대 구단, until: 돌아오는 절대 주차(그 시즌 마지막 주) }, c.noLoan = 선수가 임대를 거절해 이번 이적 기간에는 다시 못 하는 마지막 주
const LOAN_LINES = [
  SAY('매주 뛸 수 있다니 꿈만 같아요. 돌아올 때는 다른 선수가 돼 있을게요.', "Playing every week sounds like a dream. I'll come back a different player."),
  SAY('벤치에서 기다리는 것보다 백 배 나아요. 기회를 만들어 주셔서 고마워요.', "Anything's better than waiting on the bench. Thanks for making this happen."),
  SAY('처음엔 좀 서운했는데, 생각해 보니 지금 저한테 필요한 건 경기더라고요.', 'I was a bit hurt at first, but what I need right now is games.'),
  SAY('새 동료들한테 제 이름 확실히 알리고 올게요. 지켜봐 주세요.', "I'll make sure my new teammates learn my name. Keep an eye on me.")
];
const LOAN_NO_LINES = [
  SAY('여기서 버티면 기회가 올 거예요. 지금 떠나면 지는 것 같아요.', 'If I stick it out here, my chance will come. Leaving now feels like giving up.'),
  SAY('거기는 제가 원하던 곳이 아니에요. 조금만 더 생각해 볼게요.', "That's not where I want to be. Let me think about it a bit more."),
  SAY('아래 리그로 가면 다시 못 올라올까 봐 겁나요.', "I'm scared that if I drop down, I'll never get back up.")
];
// 임대 기간: 그 시즌 마지막 주까지 (여름 이적 기간 47~52주에 가면 다음 시즌 끝까지)
const loanUntil = () => (state.week >= WINDOWS[0].from ? state.season * WEEKS + WEEKS : (state.season - 1) * WEEKS + WEEKS);
const benchChance = c => startChance(getPlayer(c.s).ability, clubLevel(homeClub(c.s)), 5.5);

// 임대를 막는 이유 (없으면 빈 문자열). ap = false면 AP는 보지 않음 (할 일 줄·화면 안내용)
function loanBlock(c, ap = true) {
  if (state.over) return GAME_OVER();
  if (c.loan) return L('이미 임대 중입니다', 'He is already out on loan');
  if (isFreeAgent(c)) return L('무소속 선수는 임대를 보낼 수 없습니다', "A free agent can't go out on loan");
  if (!windowAt()) return L(`이적 기간에만 임대를 보낼 수 있습니다 (${nextWindow().win.name}까지 ${nextWindow().wait}주)`, `Loans can only be arranged in a transfer window (${pl(nextWindow().wait, 'week')} until the ${nextWindow().win.name})`);
  const sc = benchChance(c);
  if (sc >= TUNE.loanBench) return L(`지금 구단에서 뛰고 있어 임대가 필요 없습니다 (출전 ${Math.round(sc * 100)}%)`, `He's playing enough at his club to stay (starts ${Math.round(sc * 100)}%)`);
  if (c.noLoan >= absWeek()) return L('이번 이적 기간에는 임대를 원하지 않습니다', "He doesn't want a loan this window");
  if (ap && state.ap < 1) return NO_AP();
  return '';
}

// 임대 후보 구단: 이적 기간마다 선수별로 정해진 loanPick곳 (구단 수준이 능력 -loanRange ~ 능력이라 주전으로 뜀).
// 해외 이적을 싫어하면 자기 나라 구단만, 아니면 소속 구단 나라 2곳 + 어디든 1곳. 수준 높은 순
const loanCache = new Map();
function loanClubs(c) {
  const win = windowAt();
  if (!win) return [];
  const key = `${state.seed}:${c.s}:${c.g}:${windowEnd(win)}`;
  if (loanCache.has(key)) return loanCache.get(key);
  const p = getPlayer(c.s);
  const pref = prefsOf(p);
  const home = homeClub(c.s);
  const fits = x => x !== home && clubLevel(x) <= p.ability && clubLevel(x) >= p.ability - TUNE.loanRange;
  const r = rng(hash(state.seed, c.s, c.g, windowEnd(win), 91));
  const out = [];
  const draw = (pool, n) => {
    const left = pool.filter(x => !out.includes(x));
    for (let i = 0; i < n && left.length; i++) out.push(left.splice(Math.floor(r() * left.length), 1)[0]);
  };
  if (pref.abroad === 'no') draw(p.nat.all.filter(fits), TUNE.loanPick);
  else {
    draw(home.country.all.filter(fits), TUNE.loanPick - 1);
    draw(CLUBS.filter(fits), TUNE.loanPick - out.length);
  }
  out.sort((a, b) => clubLevel(b) - clubLevel(a) || a.id - b.id);
  if (loanCache.size > 200) loanCache.clear();
  loanCache.set(key, out);
  return out;
}

// 선수 입장 점검 (주급·계약 기간은 그대로라 기간 점검은 뺌): 출전·큰 무대·국내/해외가 중요
function loanFit(c, club) {
  const p = getPlayer(c.s);
  const pref = prefsOf(p);
  const checks = fitChecks(p, pref, club, c.wage, 0);
  const score = fitScore(checks, pref);
  return { checks, score, consent: clamp(consentChance(score) + bondConsentBonus(c), 5, 95) };
}

function loan(s, clubId) {
  const c = clientOf(s);
  const block = c ? loanBlock(c) : NOT_CLIENT();
  if (block) return toast(block);
  const club = loanClubs(c).find(x => x.id === clubId);
  if (!club) return toast(L('이 구단은 임대 후보가 아닙니다', "This club isn't one of his loan options"));
  const p = getPlayer(s);
  state.ap -= 1;
  if (Math.random() * 100 >= loanFit(c, club).consent) {
    c.noLoan = windowEnd(windowAt());
    addSat(c, -2);
    addLog(L(`${p.name} 선수가 ${club.name} 임대를 원하지 않습니다 (만족 -2). "${pickLine(LOAN_NO_LINES, c.s, c.g, club.id)()}"`,
      `${p.name} doesn't want to go to ${club.name} on loan (morale -2). "${pickLine(LOAN_NO_LINES, c.s, c.g, club.id)()}"`));
    toast(L('선수가 임대를 원하지 않습니다.', "He doesn't want the loan."));
    saveState();
    return;
  }
  const home = homeClub(s);
  archiveStint(c);
  c.loan = { club: club.id, until: loanUntil() };
  applyLoans();
  c.st = { ...newStint(club), ln: 1 };
  c.hunt = 0;
  c.pitch = null;
  // 이적 기간에 남아 있던 이적 제안·이적 요청은 임대로 끝남
  state.events = state.events.filter(e => !(e.s === s && (e.type === 'offer' || e.type === 'ask')));
  addSat(c, TUNE.loanSat);
  addBond(c, TUNE.loanBond, MEMO.loaned);
  state.stats.loans += 1;
  pushNews({ k: 'loan', s, g: c.g, nm: p.ko, nk: p.nk, from: home.id, to: club.id, my: 1 });
  addLog(L(`${p.name} 선수가 ${named(club.name, '으로')} 임대를 떠납니다(${leagueName(club.country, club.t)}, ${weekLabel(c.loan.until)}까지, 만족 +${TUNE.loanSat}, 유대 +${TUNE.loanBond}). "${pickLine(LOAN_LINES, s, c.g, club.id)()}"`,
    `${p.name} joins ${club.name} (${leagueName(club.country, club.t)}) on loan until ${weekLabel(c.loan.until)} (morale +${TUNE.loanSat}, bond +${TUNE.loanBond}). "${pickLine(LOAN_LINES, s, c.g, club.id)()}"`));
  toast(L(`${p.name} 임대 성사!`, `${p.name}'s loan is agreed!`));
  saveState();
}

// 임대 끝: 소속 구단으로 돌아옴 (시즌 말, 또는 시즌 중 계약이 끝났을 때 mid = true). 많이 뛰었으면 유대, 뉴스·기록
function endLoan(c, mid) {
  if (!c.loan) return;
  const club = CLUBS[c.loan.club];
  const stint = mid ? c.st : c.hist.find(h => h.ln && h.club === club.id) || c.st;
  if (mid) archiveStint(c);
  c.loan = null;
  applyLoans();
  // 17단계: 임대가 끝나면(계약 만료로 일찍 끝날 때 포함) 임대 구단의 완전 이적 제안도 없어짐
  const lapsed = state.events.some(e => e.type === 'buy' && e.s === c.s);
  state.events = state.events.filter(e => !(e.type === 'buy' && e.s === c.s));
  const p = getPlayer(c.s);
  if (mid) c.st = newStint(p.club);
  const apps = stint.L[0];
  if (apps >= TUNE.loanApps) addBond(c, TUNE.loanBack, MEMO.loanBack);
  pushNews({ k: 'loan', back: 1, s: c.s, g: c.g, nm: p.ko, nk: p.nk, from: club.id, to: p.club.id, my: 1, apps, goals: stint.L[1] });
  addLog(L(`${p.name} 선수가 ${club.name} 임대를 마치고 돌아왔습니다 (리그 ${apps}경기 ${stint.L[1]}골${apps >= TUNE.loanApps ? `, 유대 +${TUNE.loanBack}` : ''}).${lapsed ? ' 임대가 끝나 완전 이적 제안도 없어졌습니다.' : ''}`,
    `${p.name} is back from his loan at ${club.name} (${pl(apps, 'league game')}, ${pl(stint.L[1], 'goal')}${apps >= TUNE.loanApps ? `, bond +${TUNE.loanBack}` : ''}).${lapsed ? ' With the loan over, the permanent offer has lapsed.' : ''}`));
}

// --- 17단계 임대 뒤 완전 이적 (축구 감독 게임의 "완전 이적 옵션이 붙은 임대"에서 가져옴) ---
// 리그가 끝난 다음 주(47주), 이번 시즌으로 임대가 끝나는 선수의 임대 구단이 임대 동안의 리그 경기 수·평점을 보고 완전 이적을 제안할지 정함.
// 받아들이면 그대로 그 구단 선수가 되고(이적료는 소속 구단에, 내 수수료는 보통 이적과 같음), 거절하면 시즌이 끝날 때 돌아옴
// 선수의 말: 남고 싶음(stay)·반반(mid)·돌아오고 싶음(back). 남고 싶은 선수는 정든 팀·매주 뛰는 기쁨, 돌아오고 싶은 선수는 원래 팀에서 증명하고 싶은 마음
const BUY_LINES = {
  stay: [
    SAY('여기 사람들은 제 이름을 불러 줘요. 오랜만에 축구가 다시 즐거워졌어요. 남고 싶어요.', "People here sing my name. For the first time in ages I'm enjoying football again. I want to stay."),
    SAY('매주 뛰면서 제가 어떤 선수인지 알게 됐어요. 이 팀에서 계속 크고 싶어요.', "Playing every week, I've found out what kind of player I am. I want to keep growing at this club."),
    SAY('벤치로 돌아가는 건 생각만 해도 싫어요. 에이전트님, 여기 남게 해 주실 수 있죠?', "I can't bear the thought of going back to the bench. You can make it so I stay, can't you?")
  ],
  mid: [
    SAY('좋은 팀이고 고마운 사람들이에요. 그래도 제 앞날이 걸린 일이니 에이전트님 생각을 먼저 듣고 싶어요.', "It's a good club and the people have been great to me. But it's my future, so I want to hear what you think first."),
    SAY('남아도 좋고 돌아가도 좋아요. 어느 쪽이 저한테 맞는지 같이 따져 봐요.', "I'd be fine staying or going back. Let's work out together which suits me."),
    SAY('솔직히 마음이 반반이에요. 에이전트님이 정해 주시면 따를게요.', "Honestly, I'm torn down the middle. Whatever you decide, I'll go with it.")
  ],
  back: [
    SAY('여기서 많이 배웠지만, 원래 팀에서 제 자리를 찾고 싶어요. 그러려고 임대를 간 거잖아요.', "I've learned a lot here, but I want to win my place back at my own club. That's why I went on loan in the first place."),
    SAY('고마운 제안인데요, 여기가 제가 오래 있을 곳인지는 잘 모르겠어요.', "It's a kind offer, but I'm not sure this is a place I'd stay for years."),
    SAY('이번 시즌으로 충분히 보여 준 것 같아요. 이제 돌아가서 증명할 차례예요.', "I think this season showed what I can do. Now it's time to go back and prove it.")
  ]
};
// 임대 구단이 완전 이적을 제안할 확률 (row = 임대 동안 리그 기록 [출전, 골, 도움, 평점 합×10])
const buyChance = row => (row[0] < TUNE.buyApps ? 0 : clamp(TUNE.buyBase + (row[3] / row[0] / 10 - TUNE.buyMid) * TUNE.buyStep, 0, TUNE.buyMax));
// 선수 마음: 이 제안의 조건 점수(보통 이적 제안과 같은 점검)가 1 이상이면 남고 싶어 함, -1 이하면 돌아오고 싶어 함
const buyWish = (p, d) => {
  const score = offerFit(p, d).score;
  return score >= 1 ? 'stay' : score <= -1 ? 'back' : 'mid';
};
// 지금 임대 구간 (임대 구단 기록이 아니면 null)
const loanStint = c => (c.loan && c.st.ln && c.st.club === c.loan.club ? c.st : null);

// 제안 조건: 주급은 13단계 낮은 수준 구단 제안처럼 능력에 맞는 주급의 0.9~1.2배(지금 주급을 맞춰 주지 않음), 이적료는 몸값의 buyFee배
function makeBuy(c, p, st) {
  const club = CLUBS[c.loan.club];
  const r = Math.random;
  const wage = Math.round((weeklyWage(Math.max(marketAbility(p), Math.round(clubLevel(club)))) * (0.9 + r() * 0.3)) / 50) * 50;
  const [lo, hi] = TUNE.buyFee;
  const fee = Math.round((valueOf(p) * (lo + r() * (hi - lo))) / 5000) * 5000;
  return { club: club.id, wage, fee, years: 2 + Math.floor(r() * 3), from: 'loan', ap: st.L[0], gl: st.L[1], rt: Math.round(st.L[3] / st.L[0]) };
}

// 47주: 이번 시즌으로 임대가 끝나는 선수마다 임대 구단의 결정. 제안하지 않으면 이유(경기 수·평점·확률)를 기록에 남김. 반환값 = 새로 온 제안 수
// 임대마다 한 번뿐인 기회라 소식 한도(선수마다 하나·전체 3건)를 넘어도 보냄 (다른 소식과 함께 와 있을 수 있음)
function loanBids() {
  let n = 0;
  for (const c of state.clients) {
    const st = loanStint(c);
    if (!st || !loanEnding(c) || isFreeAgent(c)) continue;
    const p = getPlayer(c.s);
    const club = CLUBS[c.loan.club];
    const chance = buyChance(st.L);
    if (Math.random() < chance) {
      pushEvent('buy', c.s, makeBuy(c, p, st));
      n += 1;
      continue;
    }
    const why = st.L[0] < TUNE.buyApps ? L(`리그 ${st.L[0]}경기로 ${TUNE.buyApps}경기가 안 됨`, `only ${pl(st.L[0], 'league game')}, fewer than ${TUNE.buyApps}`)
      : L(`리그 ${st.L[0]}경기 평균 평점 ${avgRating(st.L)} · 제안 가능성 ${Math.round(chance * 100)}%`, `${pl(st.L[0], 'league game')}, average ${avgRating(st.L)}, ${Math.round(chance * 100)}% chance`);
    addLog(L(`임대 구단 ${named(club.name, '은', '는')} ${p.name} 선수 완전 이적을 제안하지 않았습니다(${why}). 시즌이 끝나면 ${homeClub(c.s).name}에 돌아옵니다.`,
      `${club.name} have decided not to make ${p.name}'s move permanent (${why}). He returns to ${homeClub(c.s).name} at the end of the season.`));
  }
  return n;
}


// ===== 7. 저장·불러오기 =====
// 11단계까지(v1~v10): 세계 배열을 36진수 고정폭 문자열로 [키, 폭, 형식, 보정값], 선수 48,048명. 읽기만 함
const PACK_OLD = [['form', 1, Uint8Array, 0], ['delta', 1, Int8Array, 1], ['fsum', 2, Uint16Array, 0],
  ['favg', 1, Uint8Array, 0], ['gen', 2, Uint8Array, 0], ['gseason', 2, Uint16Array, 0], ['grow', 2, Int8Array, 128]];

function unpackArray(str, width, Type, bias) {
  const arr = new Type(str.length / width);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(str.slice(i * width, i * width + width), 36) - bias;
  return arr;
}

// 12단계부터(v11): 슬롯마다 한 글자씩 6가지. 글자는 JSON에서 이스케이프가 필요 없는 92가지(! ~ ~, "와 \ 제외)
// fd = (폼-1)×3 + 지난주 변화+1, fa = 이번 시즌 평균 폼×8, va = 지난 시즌 평균 폼×2, gn = 세대, ag = 지금 시즌 - 등장 시즌, gr = 성장치+30
const CODE = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).filter(ch => ch !== '"' && ch !== '\\').join('');
const CODE_VAL = new Int16Array(128).fill(-1);
for (let i = 0; i < CODE.length; i++) CODE_VAL[CODE.charCodeAt(i)] = i;
const WORLD_KEYS = ['fd', 'fa', 'va', 'gn', 'ag', 'gr'];

function codeString(valueAt) {
  const bytes = new Uint8Array(SLOTS);
  for (let s = 0; s < SLOTS; s++) bytes[s] = CODE.charCodeAt(clamp(valueAt(s), 0, CODE.length - 1));
  let out = '';
  for (let i = 0; i < SLOTS; i += 8192) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return out;
}

function packWorld(w) {
  const played = state.week - 1; // fsum에 더해진 주 수
  return {
    fd: codeString(s => (w.form[s] - 1) * 3 + w.delta[s] + 1),
    fa: codeString(s => (played ? Math.round((w.fsum[s] * 8) / played) : 0)),
    va: codeString(s => w.favg[s]),
    gn: codeString(s => w.gen[s]),
    ag: codeString(s => state.season - w.gseason[s]),
    gr: codeString(s => w.grow[s] + 30)
  };
}

// 빈 세계 배열 (불러올 때 채움)
const blankWorld = () => ({ form: new Uint8Array(SLOTS), delta: new Int8Array(SLOTS), fsum: new Uint16Array(SLOTS), favg: new Uint8Array(SLOTS).fill(11),
  gen: new Uint8Array(SLOTS), gseason: new Uint16Array(SLOTS).fill(1), grow: new Int8Array(SLOTS) });

function unpackWorld(dw, season, week) {
  const damaged = () => new Error(L('세계 정보가 손상되었습니다', 'world data is damaged'));
  const v = {};
  for (const key of WORLD_KEYS) {
    const str = dw[key];
    if (typeof str !== 'string' || str.length !== SLOTS) throw damaged();
    const arr = new Uint8Array(SLOTS);
    for (let s = 0; s < SLOTS; s++) {
      const n = CODE_VAL[str.charCodeAt(s)];
      if (n < 0) throw damaged();
      arr[s] = n;
    }
    v[key] = arr;
  }
  const w = blankWorld();
  for (let s = 0; s < SLOTS; s++) {
    w.form[s] = clamp(Math.floor(v.fd[s] / 3) + 1, 1, 10);
    w.delta[s] = (v.fd[s] % 3) - 1;
    w.fsum[s] = Math.round((v.fa[s] / 8) * (week - 1));
    w.favg[s] = clamp(v.va[s], 2, 20);
    w.gen[s] = v.gn[s];
    w.gseason[s] = Math.max(1, season - v.ag[s]);
    w.grow[s] = v.gr[s] - 30;
  }
  return w;
}

// v1~v10 세이브: 예전 48,048명 배열을 읽고, 늘어난 슬롯(늘린 부·새 나라 구단 선수)은 지금 시즌에 처음 등장한 선수로 채움
function unpackOldWorld(d) {
  const w = blankWorld();
  for (const [key, width, Type, bias] of PACK_OLD) {
    if (key === 'grow' && d.version === 1) continue;
    const str = d.world[key];
    if (typeof str !== 'string' || str.length !== OLD_SLOTS * width) throw new Error(L('세계 정보가 손상되었습니다', 'world data is damaged'));
    w[key].set(unpackArray(str, width, Type, bias));
  }
  const r = rng(hash(d.seed, 1, d.season));
  for (let s = OLD_SLOTS; s < SLOTS; s++) {
    w.form[s] = randInt(4, 7, r);
    w.fsum[s] = Math.round(5.5 * (d.week - 1));
    w.gseason[s] = d.season;
  }
  return w;
}

function serialize() {
  return JSON.stringify({ ...state, slots: SLOTS, world: packWorld(state.world) });
}

// 예전(v1~v6) 세이브도 읽음: 없는 값은 기본값(성장치 0, 만족 70, 투자 0단계, 스카우트 기록 없음, 이미 회사가 있음, 유대 40 등), 주급은 불러온 뒤 채움
function deserialize(text) {
  const d = JSON.parse(text);
  const int = v => Number.isInteger(v);
  if (!d || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, SAVE_VERSION].includes(d.version)) throw new Error(L('지원하지 않는 버전입니다', 'unsupported save version'));
  // v10까지는 12단계 전 세계(선수 48,048명), v11부터는 지금 세계
  const oldWorld = d.version < 11;
  if (d.slots !== (oldWorld ? OLD_SLOTS : SLOTS)) throw new Error(L('세계 구성이 다른 세이브입니다', 'this save is from a different world'));
  if (!int(d.seed) || !int(d.season) || d.season < 1 || !int(d.week) || d.week < 1 || d.week > WEEKS) throw new Error(L('날짜 정보가 올바르지 않습니다', 'invalid date'));
  if (!Number.isFinite(d.agencyCash) || !Number.isFinite(d.rep) || !Array.isArray(d.logs)) throw new Error(L('기본 정보가 올바르지 않습니다', 'invalid basic data'));
  // 3단계까지는 8명까지 둘 수 있었으므로 8명 세이브도 읽음 (한도 아래로 줄 때까지 영입만 막힘)
  if (!Array.isArray(d.clients) || d.clients.length > Math.max(8, maxClients()) || !d.clients.every(c => c && int(c.s) && c.s >= 0 && c.s < SLOTS && int(c.g) && int(c.end))) throw new Error(L('소속 선수 정보가 올바르지 않습니다', 'invalid player data'));
  if (!d.world || typeof d.world !== 'object') throw new Error(L('세계 정보가 없습니다', 'world data is missing'));
  const world = oldWorld ? unpackOldWorld(d) : unpackWorld(d.world, d.season, d.week);
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
    .filter(e => (e.type !== 'offer' && e.type !== 'buy') || (int(e.d.club) && e.d.club >= 0 && e.d.club < CLUBS.length && Number.isFinite(e.d.wage) && Number.isFinite(e.d.fee)))
    // 17단계 임대 뒤 완전 이적: 임대 동안 리그 경기·골·평점이 있어야 글을 만듦
    .filter(e => e.type !== 'buy' || (e.d.from === 'loan' && int(e.d.ap) && e.d.ap > 0 && int(e.d.gl) && int(e.d.rt)))
    .filter(e => (e.type !== 'junior' || (int(e.d.junior) && e.d.junior >= 0 && e.d.junior < SLOTS)) && (e.type !== 'wedding' || FAMILY.includes(e.d.who)));
  const nextEventId = Math.max(int(d.nextEventId) ? d.nextEventId : 1, ...events.map(e => e.id + 1));
  const intOr = (v, fallback) => (int(v) ? v : fallback);
  // 기록 한 구간: { season, club, L/C/K/N: [출전, 골, 도움, 평점합×10] }
  const cleanStint = st => (st && int(st.season) && int(st.club) && st.club >= 0 && st.club < CLUBS.length && COMPS.every(k => Array.isArray(st[k]) && st[k].length === 4 && st[k].every(n => int(n) && n >= 0))
    ? { season: st.season, club: st.club, ...(int(st.t) && st.t >= 0 && st.t < 6 ? { t: st.t } : {}), ...(st.ln === 1 ? { ln: 1 } : {}), ...Object.fromEntries(COMPS.map(k => [k, st[k].slice()])) } : null);
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
  const nkOk = v => typeof v === 'string' && /^[a-z]+\|\d+\|\d+$/.test(v) ? v : '';
  const alumni = (Array.isArray(d.alumni) ? d.alumni : []).filter(a => a && typeof a.name === 'string' && COUNTRY_BY_ID[a.nat] && int(a.season))
    .slice(0, TUNE.alumniMax).map(a => ({ name: a.name.slice(0, 20), nk: nkOk(a.nk), nat: a.nat, season: a.season }));
  const intros = {};
  if (d.intros && typeof d.intros === 'object') for (const [key, until] of Object.entries(d.intros).slice(-100)) if (keyOk(key) && int(until)) intros[key] = until;
  // 10단계 세계 뉴스: 아는 종류만, 구단·슬롯 번호가 맞는 것만. 보강 필요는 v9까지 없음(null = 불러온 뒤 다시 계산)
  const clubOk = v => int(v) && v >= 0 && v < CLUBS.length;
  const NEWS_KINDS = { need: n => clubOk(n.club) && STARTERS[n.pos], sign: n => clubOk(n.from) && clubOk(n.to) && int(n.s), mine: n => clubOk(n.from) && clubOk(n.to) && int(n.s),
    close: n => int(n.win) && WINDOWS[n.win], call: n => int(n.s) && COUNTRY_BY_ID[n.nat],
    // 13단계: 리그 우승, 내 선수 구단 승격·강등, 컵·대륙 대회 결승
    champ: n => clubOk(n.club) && int(n.pts), up: n => clubOk(n.club) && int(n.t) && int(n.rk), down: n => clubOk(n.club) && int(n.t) && int(n.rk),
    cup: n => clubOk(n.club) && clubOk(n.opp) && int(n.ga) && int(n.gb), loan: n => clubOk(n.from) && clubOk(n.to) && int(n.s), cont: n => clubOk(n.club) && clubOk(n.opp) && int(n.ga) && int(n.gb) && (n.ci === undefined || (int(n.ci) && n.ci >= 0 && n.ci <= CONT_LOWER.length)) };
  const NEWS_NUMS = ['w', 'club', 'gap', 'avg', 's', 'g', 'from', 'to', 'fee', 'age', 'ab', 'win', 'n', 'opp', 'ga', 'gb', 'pa', 'pb', 'pts', 't', 'tb', 'rk', 'my', 'ci', 'back', 'apps', 'goals', 'ln'];
  const news = (Array.isArray(d.news) ? d.news : []).filter(n => n && int(n.w) && NEWS_KINDS[n.k] && NEWS_KINDS[n.k](n)).slice(0, TUNE.newsMax).map(n => {
    const out = { k: n.k, nm: typeof n.nm === 'string' ? n.nm.slice(0, 30) : '', nk: nkOk(n.nk) };
    for (const key of NEWS_NUMS) if (Number.isFinite(n[key])) out[key] = n[key];
    if (STARTERS[n.pos]) out.pos = n.pos;
    if (COUNTRY_BY_ID[n.nat]) out.nat = n.nat;
    if (n.late === true) out.late = true;
    return out;
  });
  const needs = Array.isArray(d.needs) ? d.needs.filter(n => n && clubOk(n.club) && STARTERS[n.pos] && int(n.until)).slice(0, TUNE.needMax)
    .map(n => ({ club: n.club, pos: n.pos, gap: int(n.gap) ? n.gap : 0, avg: int(n.avg) ? n.avg : 0, until: n.until })) : null;
  const deals = d.deals && int(d.deals.n) ? { n: d.deals.n, fee: Number.isFinite(d.deals.fee) ? d.deals.fee : 0, nm: typeof d.deals.nm === 'string' ? d.deals.nm.slice(0, 30) : '', nk: nkOk(d.deals.nk), to: clubOk(d.deals.to) ? d.deals.to : -1 } : newDeals();
  // 13단계: 부 배치(구단마다 0~5 한 글자, 부마다 팀 수가 맞아야 함)와 대륙 대회 참가 구단(1부 구단만, 중복 없이).
  // 없거나(예전 세이브) 맞지 않으면 처음 배치와 1부 전력 순 (불러온 뒤 applyTiers에서 채움)
  const tiersOk = typeof d.tierOf === 'string' && d.tierOf.length === CLUBS.length && /^[0-5]+$/.test(d.tierOf)
    && COUNTRIES.every(country => country.tiers.every((n, t) => country.all.filter(c => d.tierOf.charCodeAt(c.id) - 48 === t).length === n));
  const tierOf = tiersOk ? d.tierOf : START_TIERS;
  const cont = tiersOk && Array.isArray(d.cont) && d.cont.length <= 400 && new Set(d.cont).size === d.cont.length && d.cont.every(id => clubOk(id) && tierOf[id] === '0') ? d.cont.slice() : null;
  // 알려진 필드만 옮김 (모르는 값이 상태에 섞이지 않게)
  return {
    version: SAVE_VERSION, seed: d.seed, season: d.season, week: d.week,
    // 세계 규칙(12단계): 예전 세이브는 1(기존 구단 선수를 예전 규칙으로 만듦), 새 게임은 2
    wv: oldWorld ? 1 : d.wv === 1 ? 1 : 2, tierOf, cont,
    agencyCash: d.agencyCash, rep: clamp(Math.round(d.rep), 0, 100),
    ap: int(d.ap) ? clamp(d.ap, 0, d.founded === false ? TUNE.soloAp : TUNE.ap) : d.founded === false ? TUNE.soloAp : TUNE.ap,
    debtWeeks: int(d.debtWeeks) ? clamp(d.debtWeeks, 0, DEBT_LIMIT) : 0,
    over: d.over === true, founded: d.founded !== false,
    personalCash: Number.isFinite(d.personalCash) ? Math.max(0, d.personalCash) : 0, invest, items, scouted, watch, alumni, intros, news, needs, deals,
    clients: d.clients.map(c => ({
      s: c.s, g: c.g, end: c.end, wage: Number.isFinite(c.wage) ? c.wage : null,
      sat: Number.isFinite(c.sat) ? clamp(Math.round(c.sat), 0, 100) : TUNE.satStart, met: intOr(c.met, 0), negUntil: intOr(c.negUntil, 0), warned: intOr(c.warned, 0),
      st: cleanStint(c.st), hist: Array.isArray(c.hist) ? c.hist.map(cleanStint).filter(Boolean).slice(0, 20) : [],
      playRate: Number.isFinite(c.playRate) ? clamp(c.playRate, 0, 1) : 0.6, capped: c.capped === true,
      // 7단계: 유대·함께한 시작 주·인연·기억 (예전 세이브는 유대 40, 시작 주는 불러온 뒤 기록으로 추정)
      bond: int(c.bond) ? clamp(c.bond, 0, 100) : 40, since: int(c.since) && c.since >= 1 ? c.since : null,
      how: typeof c.how === 'string' && c.how ? c.how.slice(0, 40) : MEMO.howOld,
      memo: (Array.isArray(c.memo) ? c.memo : []).filter(m => m && int(m.w) && typeof m.t === 'string' && int(m.n)).slice(0, 3).map(m => ({ w: m.w, t: m.t.slice(0, 60), n: clamp(m.n, -20, 20) })),
      // 8단계: 함께한 관계 이야기 (아는 이야기만, 이야기마다 한 번)
      tales: (Array.isArray(c.tales) ? c.tales : []).filter((t, i, arr) => t && TALE_KEYS.includes(t.k) && int(t.w) && arr.findIndex(x => x && x.k === t.k) === i)
        .map(t => ({ k: t.k, w: t.w, t: typeof t.t === 'string' ? t.t.slice(0, 60) : '' })),
      // 9단계: 이적 요청을 받아 새 구단을 알아보는 마감 주 (v8까지는 없음 = 0)
      hunt: int(c.hunt) && c.hunt > 0 ? c.hunt : 0,
      // 10단계: 추천해 둔 구단 (v9까지는 없음)
      pitch: c.pitch && int(c.pitch.club) && c.pitch.club >= 0 && c.pitch.club < CLUBS.length && int(c.pitch.until) ? { club: c.pitch.club, until: c.pitch.until } : null,
      // 13단계: 부상·휴가 (다시 뛸 수 있는 절대 주차)
      out: c.out && int(c.out.w) && (c.out.k === 'inj' || c.out.k === 'fam') ? { w: c.out.w, k: c.out.k } : null,
      // 14단계: 지난주 경기 (모양이 맞을 때만)
      lw: c.lw && ['w', 'n', 'p', 'r', 'g'].every(k => int(c.lw[k]) && c.lw[k] >= 0) && Array.isArray(c.lw.t) && c.lw.t.length <= 8
        && c.lw.t.every(r => Array.isArray(r) && ['L', 'C', 'K'].includes(r[0]) && [1, 2, 3].every(i => int(r[i]) && r[i] >= 0))
        ? { w: c.lw.w, n: c.lw.n, p: c.lw.p, r: c.lw.r, g: c.lw.g, t: c.lw.t.map(r => r.slice(0, 4)), a: c.lw.a === 'inj' || c.lw.a === 'fam' ? c.lw.a : '' } : null,
      // 15단계: 임대 { club, until }, 임대를 거절한 이적 기간 마지막 주
      loan: c.loan && clubOk(c.loan.club) && int(c.loan.until) ? { club: c.loan.club, until: c.loan.until } : null, noLoan: intOr(c.noLoan, 0)
    })),
    cooldowns, logs: d.logs.map(String).slice(0, 80), summary, moved, events, nextEventId,
    natCut: Object.keys(natCut).length ? natCut : null, stats, ui: cleanUi(d.ui, tierOf), world
  };
}

// 화면 위치 값 검사: 범위를 벗어나면 그 단계부터 기본값
// tierOf = 불러오는 세이브의 부 배치 (없으면 지금 배치)
function cleanUi(raw, tierOf) {
  const u = raw && typeof raw === 'object' ? raw : {};
  const index = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);
  const tab = ['clients', 'world', 'agency', 'log', 'news'].includes(u.tab) ? u.tab : 'clients';
  const country = index(u.country, COUNTRIES.length);
  const tier = country === null ? null : index(u.tier, COUNTRIES[country].tiers.length);
  const tierAt = id => (tierOf ? tierOf.charCodeAt(id) - 48 : CLUBS[id].t);
  const club = tier !== null && Number.isInteger(u.club) && CLUBS[u.club] && CLUBS[u.club].country.i === country && tierAt(u.club) === tier ? u.club : null;
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
  // 12단계: 예전 세이브에는 새 나라 국가대표 기준이 없어서 다시 계산
  if (!state.natCut || COUNTRIES.some(c => !(c.id in state.natCut))) state.natCut = computeNatCut();
  // v9까지 세이브: 이적 기간 중이면 보강이 필요한 구단을 지금 찾음
  if (state.needs === null) {
    state.needs = [];
    if (windowAt()) refreshNeeds(windowAt());
  }
  for (const c of state.clients) {
    const p = getPlayer(c.s);
    if (c.wage === null) c.wage = weeklyWage(p.ability);
    if (!c.st) c.st = newStint(p.club, worldStats(p, state.week));
    if (c.since === null) c.since = Math.min(absWeek(), (Math.min(c.st.season, ...c.hist.map(h => h.season)) - 1) * WEEKS + 1);
    // 17단계 전(15·16단계) 세이브: 두 시즌 임대의 둘째 시즌 기록 구간에 임대 표시가 없었음
    if (c.loan && c.st.club === c.loan.club) c.st.ln = 1;
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, serialize());
  } catch (e) {
    toast(L('저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.', "Couldn't save. Please check your browser storage."));
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
    applyTiers();
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
  downloadText(serialize(), `be-the-agent-${L(`${state.season}시즌-${state.week}주`, `s${state.season}-w${state.week}`)}.json`);
  toast(L('저장 파일을 내보냈습니다.', 'Save file exported.'));
}

function exportBackup() {
  const raw = readBackup();
  if (!raw) return;
  downloadText(raw, 'be-the-agent-backup.json');
  toast(L('백업 파일을 내보냈습니다.', 'Backup file exported.'));
}

// 불러온 세이브는 화면이 정상으로 그려진 뒤에만 저장
function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const previous = state;
    try {
      state = deserialize(String(reader.result));
      applyTiers();
      fillWages();
      render();
    } catch (e) {
      state = previous;
      applyTiers();
      render();
      toast(L(`불러오지 못했습니다: ${e.message}`, `Couldn't load the file: ${e.message}`));
      return;
    }
    saveState();
    resetHistory();
    toast(L('저장 파일을 불러왔습니다.', 'Save file loaded.'));
  };
  reader.readAsText(file);
}

// ===== 8. 화면 =====
const $ = id => document.getElementById(id);
const REGIONS = [...new Set(COUNTRIES.map(c => c.region))];
// 리그 탭 지역 버튼 이름 (짧게)
const REGION_CHIP = { '5대 리그': ['5대 리그', 'Big Five'], 유럽: ['유럽', 'Europe'], 남미: ['남미', 'S. America'], 북중미: ['북중미', 'N. America'], '아시아·오세아니아': ['아시아', 'Asia'], 아프리카: ['아프리카', 'Africa'] };
// 리그 탭에서 고른 지역 (화면 상태라 저장하지 않음). 고르기 전에는 내 첫 선수가 뛰는 지역
let worldRegion = null;
const regionNow = () => worldRegion ?? (state.clients[0] ? clubOf(state.clients[0].s).country.region : REGIONS[0]);
const LEAGUE_COUNT = COUNTRIES.reduce((n, c) => n + c.tiers.length, 0);
// index.html에 꼭 있어야 하는 요소 (배포 직후 옛 HTML이 캐시에 남아 있는지 확인용)
const REQUIRED_IDS = ['hdr-date', 'hdr-cash', 'hdr-rep', 'hdr-ap', 'view', 'btn-next', 'summary', 'summary-title', 'summary-body',
  'summary-close', 'gameover', 'gameover-body', 'gameover-new', 'gameover-close', 'toast', 'import-file', 'tab-agency',
  'scene', 'scene-who', 'scene-title', 'scene-body', 'scene-close'];

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
  const note = left < 0 ? ['bad', L('만료됨', 'Expired')] : left === 0 ? ['bad', L('이번 주 만료', 'Ends this week')] : left <= 8 ? ['warn', L(`만료 임박 · ${left}주`, `Ending soon · ${left}w`)] : ['', L(`남은 ${left}주`, `${left}w left`)];
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
  $('hdr-date').textContent = L(`${state.season}시즌 · ${state.week}주`, `S${state.season} · W${state.week}`);
  $('hdr-cash').textContent = cash(state.agencyCash);
  $('hdr-cash').classList.toggle('bad', state.agencyCash < 0);
  $('hdr-rep').textContent = String(state.rep);
  $('hdr-ap').textContent = `${state.ap}/${weeklyAp()}`;
  $('btn-next').disabled = state.over;
}

// 소속 선수 카드 (누르면 상세)
function satNode(c) {
  return el('span', c.sat < TUNE.satWarn ? 'bad' : c.sat < 50 ? 'warn' : '', L(`만족 ${c.sat}`, `Morale ${c.sat}`));
}
const bondNode = c => el('span', c.bond >= TUNE.bondCalm ? 'up' : '', L(`유대 ${bondName(c.bond)} ${c.bond}`, `Bond ${bondName(c.bond)} ${c.bond}`));

// 관계 단계 하트 3칸: 믿음·끈끈함·가족 같음 (디자인 시안 B)
function heartsNode(c) {
  const tiers = BOND_TIERS.filter(([lo]) => lo > 0);
  const got = tiers.filter(([lo]) => c.bond >= lo).length;
  const box = el('span', 'hearts');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', L(`관계 단계 ${got}/${tiers.length}`, `Relationship level ${got}/${tiers.length}`));
  tiers.forEach((_, i) => box.append(el('span', i < got ? 'on' : '', '♥')));
  return box;
}

// 선수와의 관계: 하트, 유대 단계, 함께한 기간, 인연, 유대가 주는 효과, 이야기 앨범, 선수가 기억하는 최근 일
function bondBlock(c) {
  const box = el('div', 'panel');
  const head = el('div', 'panel-head bond-head');
  const name = el('div', 'bond-name');
  name.append(heartsNode(c), el('strong', c.bond >= TUNE.bondCalm ? 'up' : '', L(`${bondName(c.bond)} · 유대 ${c.bond}/100`, `${bondName(c.bond)} · bond ${c.bond}/100`)));
  head.append(name, el('span', 'badge', togetherText(c)));
  const bar = el('span', 'bar bond-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = el('i');
  fill.style.width = `${c.bond}%`;
  bar.append(fill);
  const calm = c.bond >= TUNE.bondCalm ? L('서운한 일이 있어도 만족이 천천히 떨어짐', 'morale drops slowly even after a setback') : L(`유대 ${TUNE.bondCalm}부터 만족이 천천히 떨어짐`, `from bond ${TUNE.bondCalm}, morale drops more slowly`);
  const effect = c.bond > TUNE.bondFrom
    ? L(`유대 효과: 다른 에이전시가 와도 붙잡을 확률 +${Math.round(bondKeepBonus(c) * 100)}%p · 이적을 권하면 동의 +${bondConsentBonus(c)}%p · ${calm}`,
      `Bond effects: keeping him when a rival agency calls +${Math.round(bondKeepBonus(c) * 100)}\u00a0pts · agreeing to a move you suggest +${bondConsentBonus(c)}\u00a0pts · ${calm}`)
    : L(`유대가 ${TUNE.bondFrom}을 넘으면 다른 에이전시가 와도 붙잡기 쉬워지고, 이적을 권하면 잘 따라옵니다.`, `Above bond ${TUNE.bondFrom}, he is easier to keep from rival agencies and more willing to follow your advice on moves.`);
  box.append(head, bar, el('p', 'panel-line', L(`인연: ${phrase(c.how)}`, `How you met: ${phrase(c.how)}`)), el('p', 'sub', effect));
  // 이야기 앨범 4칸: 함께한 이야기, 찾아온 이야기, 곧 올 이야기, 잠긴 이야기(필요한 유대·기간)
  const tiles = TALE_KEYS.map(k => albumTile(c, k));
  box.append(el('h3', 'mini', L(`이야기 앨범 ${tiles.filter(t => t.cls.startsWith('done')).length}/${TALE_KEYS.length}`, `Story album ${tiles.filter(t => t.cls.startsWith('done')).length}/${TALE_KEYS.length}`)));
  const album = el('div', 'album');
  for (const t of tiles) {
    const tile = el('div', `tile ${t.cls}`);
    tile.append(el('strong', 'tile-title', t.title), el('span', 'tile-sub', t.sub), el('small', 'tile-meta', t.meta));
    album.append(tile);
  }
  box.append(album);
  // 선수가 기억하는 최근 일 (이야기와 같은 기억은 앨범에 있으니 한 번만)
  const told = c.tales.filter(t => t.t);
  const memos = c.memo.filter(m => !told.some(t => t.t === m.t));
  box.append(el('h3', 'mini', L('선수가 기억하는 일', 'What he remembers')));
  if (memos.length) {
    const line = el('div', 'timeline');
    for (const m of memos) {
      const row = el('p', m.n < 0 ? 'tl bad' : 'tl', L(`${m.t} (유대 ${m.n > 0 ? '+' : ''}${m.n})`, `${phrase(m.t)} (bond ${m.n > 0 ? '+' : ''}${m.n})`));
      row.append(el('small', '', ` · ${weekLabel(m.w)}`));
      line.append(row);
    }
    box.append(line);
  } else box.append(el('p', 'sub', L('함께 시간을 보내고 어려울 때 곁에 있어 주면 유대가 쌓입니다. 외면하면 줄어듭니다.', 'Bond grows when you spend time together and stand by him in hard moments. Turning away wears it down.')));
  return box;
}

const avgRating = row => (row[0] ? (row[3] / row[0] / 10).toFixed(1) : '-');
// 한 줄 요약: "리그 12경기 3골 · 평점 6.9 · 국가대표 2경기"
function statLine(st) {
  const parts = [L(`리그 ${st.L[0]}경기 ${st.L[1]}골 ${st.L[2]}도움 · 평점 ${avgRating(st.L)}`, `League: ${pl(st.L[0], 'app')}, ${pl(st.L[1], 'goal')}, ${pl(st.L[2], 'assist')} · rating ${avgRating(st.L)}`)];
  if (st.K[0]) parts.push(L(`대륙 대회 ${st.K[0]}경기`, `continental: ${pl(st.K[0], 'app')}`));
  if (st.N[0]) parts.push(L(`국가대표 ${st.N[0]}경기`, `international: ${pl(st.N[0], 'cap')}`));
  return parts.join(' · ');
}

function clientCard(c) {
  const p = getPlayer(c.s);
  const card = actButton('card', 'player', c.s);
  const top = el('span', 'card-top');
  top.append(posTag(p.pos), el('strong', 'name', p.name));
  if (isNationalPick(p)) top.append(el('span', 'badge mine', L('국가대표', 'International')));
  const out = outText(c);
  if (out) top.append(el('span', c.out.k === 'inj' ? 'badge bad' : 'badge warn', out));
  else if (c.loan) top.append(el('span', 'badge mine', L('임대', 'On loan')));
  top.append(el('span', 'abil', String(p.ability)));
  const stats = el('span', 'stats');
  stats.append(stat(L('잠재력', 'Potential'), potText(p)), stat(L('폼', 'Form'), formNode(p)), stat(L('몸값', 'Value'), money(valueOf(p))), stat(L('계약 만료', 'Contract'), contractNode(c.end)));
  const foot = el('span', 'card-foot');
  foot.append(satNode(c), ' · ', bondNode(c), isFreeAgent(c) ? L(' · 무소속: 수수료 없음', ' · Free agent: no commission') : L(` · 주급 ${cash(c.wage)} · 내 수수료 주 ${cash(commissionOf(c.wage))}`, ` · wage ${cash(c.wage)} · your cut ${cash(commissionOf(c.wage))}/wk`));
  card.append(top, el('span', 'meta', `${L(`${ageOf(p)}세`, `${ageOf(p)}`)} · ${p.nat.name} · ${clubLine(c, p)}`),
    abilityBar(p.ability), stats, el('span', 'card-line', statLine(c.st)));
  const last = lastWeekText(c);
  if (last) card.append(el('span', 'card-last', last));
  card.append(foot);
  return card;
}

// 13단계: 소속 구단 한 줄 "런던 크라운 · 잉글랜드 1부 3위" (무소속이면 "무소속 (전 소속 런던 크라운)")
function clubLine(c, p) {
  if (c && isFreeAgent(c)) return L(`무소속 (전 소속 ${p.club.name})`, `Free agent (last club ${p.club.name})`);
  const rank = rankText(p.club);
  return `${p.club.name}${c && c.loan ? L('(임대)', ' (loan)') : ''} · ${leagueName(p.club.country, p.club.t)}${rank ? L(` ${rank}`, ` · ${rank}`) : ''}`;
}
// 부상·휴가 표시: "부상 3주" / "휴가" (끝났으면 빈 문자열)
const outText = c => (c.out && c.out.w > absWeek() ? (c.out.k === 'inj' ? L(`부상 ${c.out.w - absWeek()}주`, `Injured ${c.out.w - absWeek()}w`) : L('휴가', 'On leave')) : '');

// 선수 입장 점검표: ✓/✗ 줄과 한 줄 결론
function checkList(checks, score, extra) {
  const box = el('div', 'checks');
  for (const ch of checks) box.append(el('p', ch.ok ? 'check ok' : 'check no', `${ch.ok ? '✓' : '✗'} ${ch.text}`));
  box.append(el('p', 'check-sum', `${L('선수 반응', 'Player reaction')}: ${moodText(score)}${extra ? ` · ${extra}` : ''}`));
  return box;
}

// 선택지에 붙는 표시 "1 AP · $500 · 유대 +5"와, AP·자금이 모자라서 막히는지 (소식 카드와 이야기 장면이 같이 씀)
function optionInfo(ev, opt, c) {
  const cost = opt.cost ? opt.cost(ev.d, c) : 0;
  const n = c ? optBond(opt, getPlayer(ev.s), ev.d) : 0;
  const bond = n ? L(`유대 ${n > 0 ? '+' : ''}${n}`, `bond ${n > 0 ? '+' : ''}${n}`) : '';
  return { tags: [opt.ap ? `${opt.ap} AP` : '', cost ? cash(cost) : '', bond].filter(Boolean).join(' · '), blocked: Boolean((opt.ap && state.ap < opt.ap) || cost > state.agencyCash) };
}
const dueText = (ev, type, p, c) => (ev.until > absWeek() ? L(`${ev.until - absWeek()}주 안에 답하지 않으면 "${type.options[type.def].label(p, ev.d, c)}"`, `No reply within ${pl(ev.until - absWeek(), 'week')} means "${type.options[type.def].label(p, ev.d, c)}"`) : L('이번 주까지 답해야 합니다', 'You must answer this week'));

// 이번 주 소식 카드: 선택지마다 AP·비용 표시, 모자라면 버튼을 막음
function newsCard(ev) {
  const type = EVENT_TYPES[ev.type];
  const p = getPlayer(ev.s);
  const c = clientOf(ev.s);
  // 관계 이야기는 따뜻한 색 카드에 이야기 이름·선수의 말을 크게 (디자인 시안 A)
  const card = el('article', type.tale ? 'news tale' : 'news');
  if (type.tale && c) {
    const lab = el('div', 'tale-lab');
    lab.append(el('span', 'tale-name', `${L('이야기', 'Story')} · ${taleTitle(c, ev.type)}`), el('span', 'badge warm', `${bondName(c.bond)} ${c.bond}`));
    card.append(lab);
  }
  if (ev.type === 'offer' && ev.d.late) card.append(el('p', 'news-tag', L('이적 마감일 막판 제안', 'Deadline-day bid')));
  if (ev.type === 'buy') card.append(el('p', 'news-tag', L('임대 뒤 완전 이적 제안', 'Loan-to-permanent offer')));
  card.append(el('p', 'news-text', type.text(p, ev.d, c)));
  const quote = type.quote ? type.quote(p, ev.d, c) : '';
  if (quote) card.append(el('p', 'quote', `"${quote}"`));
  // 17단계: 고를 때 견줄 숫자 한 줄 (임대 뒤 완전 이적: 두 구단 출전 확률과 내 주 수수료)
  if (type.note && c) card.append(el('p', 'news-bond', type.note(p, ev.d, c)));
  if (c) card.append(el('p', 'news-bond', type.tale ? L(`인연: ${c.how} · ${togetherText(c)}`, `How you met: ${phrase(c.how)} · ${togetherText(c)}`) : L(`관계: ${bondName(c.bond)} · 유대 ${c.bond} · ${c.how}`, `Relationship: ${bondName(c.bond)} · bond ${c.bond} · ${phrase(c.how)}`)));
  if (type.fit) {
    const fit = type.fit(p, ev.d);
    card.append(checkList(fit.checks, fit.score, L(`이적 동의 ${fit.consent}%${fit.bond ? ` (유대 +${fit.bond}%p 포함)` : ''}`, `${fit.consent}% likely to agree${fit.bond ? ` (incl. bond +${fit.bond} pts)` : ''}`)));
  }
  card.append(el('p', 'news-due', dueText(ev, type, p, c)));
  const actions = el('div', 'news-actions');
  type.options.forEach((opt, i) => {
    const info = optionInfo(ev, opt, c);
    const b = actButton('btn', 'event', ev.id, opt.label(p, ev.d, c) + (info.tags ? ` (${info.tags})` : ''));
    b.dataset.o = String(i);
    b.disabled = info.blocked;
    actions.append(b);
  });
  card.append(actions);
  return card;
}

// ===== 관계 이야기 장면 (디자인 시안 B): 다음 주를 누른 뒤 새로 찾아온 이야기를 아래에서 올라오는 시트로 =====
// 시트를 닫아도 이야기는 내 선수 탭 소식에 남음. 대기열은 저장하지 않음 (새로고침하면 소식 카드로만 보임)
let sceneQueue = [];

function openScene() {
  const dialog = $('scene');
  if (dialog.open || state.over) return;
  let ev = null;
  while (sceneQueue.length && !ev) {
    const id = sceneQueue.shift();
    ev = state.events.find(e => e.id === id && EVENT_TYPES[e.type].tale && clientOf(e.s)) || null;
  }
  if (!ev) return;
  const type = EVENT_TYPES[ev.type];
  const p = getPlayer(ev.s);
  const c = clientOf(ev.s);
  // 선수 얼굴(이름 첫 글자, 포지션 색 테두리), 이름·인연, 유대 단계
  const face = el('span', `face face-${p.pos}`, [...p.name][0]);
  face.setAttribute('aria-hidden', 'true');
  const info = el('div', 'scene-info');
  info.append(el('strong', 'scene-name', p.name), el('span', 'scene-meta', L(`${p.pos} · ${ageOf(p)}세 · ${c.how}`, `${p.pos} · ${ageOf(p)} · ${phrase(c.how)}`)), el('span', 'badge warm', `${bondName(c.bond)} ${c.bond}`));
  $('scene-who').replaceChildren(face, info);
  $('scene-title').textContent = type.text(p, ev.d, c);
  // 선수의 말을 크게, 그 아래 지금 사정(함께한 기간·만족·리그 평점)
  const ctx = [togetherText(c), L(`만족 ${c.sat}`, `morale ${c.sat}`), c.st.L[0] ? L(`이번 시즌 리그 평점 ${avgRating(c.st.L)}`, `league rating this season ${avgRating(c.st.L)}`) : ''].filter(Boolean).join(' · ');
  const actions = el('div', 'news-actions');
  type.options.forEach((opt, i) => {
    const o = optionInfo(ev, opt, c);
    // 첫 답이 가장 따뜻한 답이라 테두리를 강조
    const b = actButton(i === 0 ? 'scene-opt warm' : 'scene-opt', 'event', ev.id, el('span', 'opt-label', opt.label(p, ev.d, c)));
    if (o.tags) b.append(el('span', 'opt-tags', o.tags));
    b.dataset.o = String(i);
    b.disabled = o.blocked;
    actions.append(b);
  });
  $('scene-body').replaceChildren(el('p', 'scene-quote', `"${type.quote(p, ev.d, c)}"`), el('p', 'scene-ctx', ctx), actions,
    el('p', 'news-due', `${dueText(ev, type, p, c)} · ${L('닫아도 내 선수 탭 소식에 남습니다', "Closing this keeps it in your Players tab news")}`));
  dialog.showModal();
}

// 이적 시장 상태 한 줄: 열림(마감까지 n주)·마감일·닫힘(다음 기간까지 n주)
function marketLine() {
  const win = windowAt();
  if (!win) {
    const next = nextWindow();
    return el('p', 'market', L(`이적 시장 닫힘 · ${next.win.name}까지 ${next.wait}주 · 무소속 선수는 언제든 계약할 수 있습니다`, `Transfer market closed · ${pl(next.wait, 'week')} until the ${next.win.name} · free agents can sign any time`));
  }
  const left = windowLeft(win);
  if (left === 0) return el('p', 'market deadline', L(`이적 마감일 · 이번 주가 지나면 ${win.name}이 닫힙니다`, `Deadline day · the ${win.name} shuts after this week`));
  return el('p', 'market open', L(`${win.name} · 마감 ${weekLabel(windowEnd(win))}까지 ${left}주`, `${win.name[0].toUpperCase()}${win.name.slice(1)} · ${pl(left, 'week')} to the deadline (${weekLabel(windowEnd(win))})`));
}

// --- 세계 뉴스 화면 (10단계): 저장된 뉴스 데이터로 문장을 만듦. 같은 종류도 뉴스마다 정해진 여러 문장 중 하나 ---
const NEWS_TAG = { need: ['보강 필요', 'Needs'], sign: ['영입', 'Signing'], mine: ['내 선수 이적', 'Your player'], close: ['이적 시장 결산', 'Window closed'], call: ['국가대표', 'Call-up'],
  champ: ['리그 우승', 'Champions'], up: ['승격', 'Promoted'], down: ['강등', 'Relegated'], cup: ['컵 우승', 'Cup winners'], cont: ['대륙 대회 우승', 'Continental champions'], loan: ['임대', 'Loan'] };
// 저장해 둔 선수 이름: 이름 키가 있으면 지금 언어로, 없으면(예전 세이브) 저장한 이름 그대로
const storedName = (nm, nk) => (nk && nameFromKey(nk)) || nm;
// 뉴스 속 선수 이름: 지금도 같은 선수면 지금 이름, 은퇴해 슬롯 주인이 바뀌었으면 저장해 둔 이름
const newsName = n => (state.world.gen[n.s] === n.g ? getPlayer(n.s).name : storedName(n.nm, n.nk));
const clubLabel = id => L(`${CLUBS[id].name}(${leagueName(CLUBS[id].country, CLUBS[id].t)})`, `${CLUBS[id].name} (${leagueName(CLUBS[id].country, CLUBS[id].t)})`);

// 문장 틀 (한국어·영어). 구단 이름은 한국어는 리그를 앞에("잉글랜드 1부 런던 크라운이"), 영어는 뒤 괄호에. 같은 뉴스는 늘 같은 문장(pickLine)
const clubEn = id => `${CLUBS[id].en} (${CLUBS[id].country.en} Div. ${CLUBS[id].t + 1})`;
const clubKo = id => `${CLUBS[id].country.ko} ${CLUBS[id].t + 1}부 ${CLUBS[id].ko}`;
const NEWS_LINES = {
  need: [
    (id, pos, n) => L(`${named(clubKo(id), '이', '가')} ${pos[0]} 보강에 나섰습니다. 주전 ${pos[0]} 평균 능력이 ${named(String(n.avg), '으로')}, 구단 수준보다 ${n.gap} 낮습니다.`,
      `${clubEn(id)} are in the market for a ${pos[1]}. Their first-choice ${pos[1]}s average ${n.avg}, ${n.gap} below the club's level.`),
    (id, pos, n) => L(`${clubKo(id)} 감독이 "${pos[0]} 자리가 가장 고민"이라고 털어놓았습니다. 지금 주전 평균 능력은 ${n.avg}입니다.`,
      `The ${clubEn(id)} manager admits ${pos[1]} is "the position that keeps me up at night". His starters there average ${n.avg}.`),
    (id, pos, n) => L(`${named(clubKo(id), '이', '가')} 이번 이적 기간에 ${named(pos[0], '을', '를')} 찾고 있다는 소식입니다. 주전 평균 능력 ${named(String(n.avg), '으로')}는 모자라다는 판단입니다.`,
      `Word is that ${clubEn(id)} want a ${pos[1]} this window. They don't think an average of ${n.avg} is good enough.`),
    (id, pos) => L(`${clubKo(id)} 스카우트들이 ${pos[0]} 후보를 찾아 여러 경기장을 돌고 있습니다. 구단은 이번 기간 안에 데려오고 싶어 합니다.`,
      `${clubEn(id)} scouts have been spotted at grounds all over, hunting for a ${pos[1]}. The club wants a deal done this window.`),
    (id, pos, n) => L(`"${pos[0]} 한 명이면 순위가 달라진다." ${clubKo(id)} 주장이 공개적으로 보강을 요청했습니다 (주전 평균 능력 ${n.avg}).`,
      `"One good ${pos[1]} and our season changes." The ${clubEn(id)} captain has publicly asked for reinforcements (starters average ${n.avg}).`)
  ],
  sign: [
    (to, from, name, n) => L(`${named(clubKo(to), '이', '가')} ${clubKo(from)}의 ${POS_NAME[n.pos][0]} ${name}(${n.age}세, 능력 ${n.ab})${josa(name, '을', '를')} 이적료 ${money(n.fee)}에 영입했습니다.`,
      `${clubEn(to)} have signed ${POS_NAME[n.pos][1]} ${name} (${n.age}, ability ${n.ab}) from ${clubEn(from)} for ${money(n.fee)}.`),
    (to, from, name, n) => L(`${name}(${n.age}세 ${POS_NAME[n.pos][0]})${josa(name, '이', '가')} ${named(clubKo(from), '을', '를')} 떠나 ${clubKo(to)} 유니폼을 입습니다. 이적료는 ${money(n.fee)}입니다.`,
      `${name} (${n.age}, ${POS_NAME[n.pos][1]}) leaves ${clubEn(from)} to pull on the shirt of ${clubEn(to)}. The fee is ${money(n.fee)}.`),
    (to, from, name, n) => L(`${named(clubKo(to), '이', '가')} ${POS_NAME[n.pos][0]} 보강을 마쳤습니다. ${clubKo(from)}에서 능력 ${n.ab}의 ${named(name, '을', '를')} 데려왔습니다 (${money(n.fee)}).`,
      `${clubEn(to)} have found their ${POS_NAME[n.pos][1]}: ${name} (ability ${n.ab}) arrives from ${clubEn(from)} for ${money(n.fee)}.`),
    (to, from, name, n) => L(`${clubKo(to)} 팬들이 반길 소식입니다. ${clubKo(from)}의 ${named(name, '이', '가')} 합류했습니다. 구단이 쓴 이적료는 ${money(n.fee)}입니다.`,
      `Good news for ${clubEn(to)} fans: ${name} has joined from ${clubEn(from)}. The club paid ${money(n.fee)}.`),
    (to, from, name, n) => L(`${n.late ? '마감일 막판에 ' : ''}${named(clubKo(to), '이', '가')} 움직였습니다. ${clubKo(from)}의 ${POS_NAME[n.pos][0]} ${named(name, '을', '를')} ${money(n.fee)}에 데려갑니다.`,
      `${n.late ? 'A deadline-day swoop: ' : ''}${clubEn(to)} have moved for ${clubEn(from)} ${POS_NAME[n.pos][1]} ${name}, paying ${money(n.fee)}.`)
  ],
  mine: [
    (to, from, name, n) => L(`내 선수 ${named(name, '이', '가')} ${clubKo(from)}에서 ${named(clubKo(to), '으로')} 이적했습니다${n.fee ? ` (이적료 ${money(n.fee)})` : ' (자유 이적)'}. 기사에 에이전시 이름도 함께 실렸습니다.`,
      `Your player ${name} has moved from ${clubEn(from)} to ${clubEn(to)}${n.fee ? ` (fee ${money(n.fee)})` : ' (free transfer)'}. The papers mention your agency too.`),
    (to, from, name, n) => L(`${named(clubKo(to), '이', '가')} 내 선수 ${named(name, '을', '를')} 영입했다고 발표했습니다. ${n.fee ? `이적료는 ${money(n.fee)}입니다.` : '자유 이적입니다.'}`,
      `${clubEn(to)} have announced the signing of your player ${name}. ${n.fee ? `The fee is ${money(n.fee)}.` : 'He arrives on a free.'}`),
    (to, from, name) => L(`"새 팀에서 다시 시작합니다." ${clubKo(to)}에 입단한 내 선수 ${name}의 소감이 기사 제목이 됐습니다.`,
      `"A fresh start with a new team." Your player ${name}'s words on joining ${clubEn(to)} made the headline.`)
  ],
  // 17단계: 임대로 뛰던 구단에 완전 이적 (mine 뉴스에 ln = 1)
  mineLoan: [
    (to, from, name, n) => L(`내 선수 ${named(name, '이', '가')} 임대로 뛰던 ${clubKo(to)}에 완전 이적했습니다 (이적료 ${money(n.fee)}). ${named(CLUBS[from].ko, '을', '를')} 떠나 정든 팀에 남습니다.`,
      `Your player ${name} has made his loan at ${clubEn(to)} permanent (fee ${money(n.fee)}). He leaves ${CLUBS[from].en} to stay where he has settled.`),
    (to, from, name, n) => L(`${named(clubKo(to), '이', '가')} 임대로 데려왔던 내 선수 ${named(name, '을', '를')} 완전히 영입했습니다. 이적료는 ${money(n.fee)}입니다.`,
      `${clubEn(to)} have signed your player ${name} for good after his loan. The fee is ${money(n.fee)}.`),
    (to, from, name) => L(`"여기가 제 팀이에요." 임대를 마치고 ${clubKo(to)}에 남기로 한 내 선수 ${name}의 말이 기사 제목이 됐습니다.`,
      `"This is my club now." Your player ${name}'s words on staying at ${clubEn(to)} after his loan made the headline.`)
  ],
  call: [
    (nat, name) => L(`${nat.ko} 국가대표 명단이 발표됐습니다. 내 선수 ${named(name, '이', '가')} 처음으로 이름을 올렸습니다.`, `The ${nat.en} squad has been announced, and your player ${name} is in it for the first time.`),
    (nat, name) => L(`${name}, 생애 첫 ${nat.ko} 국가대표 발탁. 감독은 "꾸준함을 높이 샀다"고 말했습니다.`, `${name} earns his first ${nat.en} call-up. The coach praised his "consistency".`)
  ],
  // 13단계: 리그 우승 (1부). 내 선수 구단이면 선수 이름을 넣은 문장
  champ: [
    (id, n) => (n.gap ? L(`${named(clubKo(id), '이', '가')} 리그 우승을 차지했습니다. 승점 ${n.pts}점으로 2위와 ${n.gap}점 차입니다.`, `${clubEn(id)} have won the league on ${n.pts} points, ${n.gap} clear of second place.`)
      : L(`${named(clubKo(id), '이', '가')} 2위와 승점이 같았지만 골 득실에서 앞서 리그 우승을 차지했습니다 (승점 ${n.pts}).`, `${clubEn(id)} have won the league on goal difference after finishing level with second place on ${n.pts} points.`)),
    (id, n) => L(`${clubKo(id)}, 리그 정상에 올랐습니다. 마지막 라운드가 끝나고 우승 트로피를 들어 올렸습니다 (승점 ${n.pts}).`, `${clubEn(id)} are the champions. They lifted the trophy after the final round (${n.pts} points).`),
    (id, n) => L(`이번 시즌 ${CLUBS[id].country.ko} 1부 챔피언은 ${CLUBS[id].ko}입니다. 승점 ${n.pts}점으로 시즌을 마쳤습니다.`, `This season's ${CLUBS[id].country.en} champions are ${CLUBS[id].en}, who finished on ${n.pts} points.`)
  ],
  champMine: [
    (id, n, name) => L(`내 선수 ${name}의 소속팀 ${named(clubKo(id), '이', '가')} 리그 우승을 차지했습니다! 승점 ${n.pts}점입니다.`, `Your player ${name}'s club ${clubEn(id)} have won the league with ${n.pts} points!`),
    (id, n, name) => L(`${name}, 리그 챔피언! ${named(CLUBS[id].ko, '이', '가')} 승점 ${n.pts}점으로 ${CLUBS[id].country.ko} 1부 정상에 올랐습니다.`, `${name} is a league champion! ${CLUBS[id].en} finished top of the ${CLUBS[id].country.en} top flight on ${n.pts} points.`)
  ],
  // 내 선수 구단의 승격·강등 (n.t = 그 시즌 부, n.rk = 마지막 순위)
  up: [
    (id, n, name) => L(`내 선수 ${name}의 소속팀 ${named(CLUBS[id].ko, '이', '가')} ${CLUBS[id].country.ko} ${n.t + 1}부 ${n.rk === 1 ? '우승으로' : `${n.rk}위로`} ${n.t}부 승격을 확정했습니다.`,
      `Your player ${name}'s club ${CLUBS[id].en} ${n.rk === 1 ? 'won' : `finished ${ordinal(n.rk)} in`} ${CLUBS[id].country.en} Div. ${n.t + 1} and are promoted to Div. ${n.t}.`),
    (id, n, name) => L(`${named(CLUBS[id].ko, '이', '가')} 승격합니다. 내 선수 ${name}도 다음 시즌 ${CLUBS[id].country.ko} ${n.t}부 무대에 섭니다.`, `${CLUBS[id].en} are going up. Your player ${name} will play in ${CLUBS[id].country.en} Div. ${n.t} next season.`)
  ],
  down: [
    (id, n, name) => L(`${named(CLUBS[id].ko, '이', '가')} ${CLUBS[id].country.ko} ${n.t + 1}부 ${n.rk}위로 강등됐습니다. 내 선수 ${name}의 다음 시즌 무대는 ${n.t + 2}부입니다.`,
      `${CLUBS[id].en} finished ${ordinal(n.rk)} and are relegated from ${CLUBS[id].country.en} Div. ${n.t + 1}. Your player ${name} faces Div. ${n.t + 2} football next season.`),
    (id, n, name) => L(`${named(CLUBS[id].ko, '이', '가')} 끝내 강등을 피하지 못했습니다. 내 선수 ${named(name, '은', '는')} 고개를 숙인 채 경기장을 떠났습니다.`, `${CLUBS[id].en} couldn't escape the drop. Your player ${name} left the pitch with his head bowed.`)
  ],
  // 컵·대륙 대회 결승 (n.t·n.tb = 그때 두 구단의 부, 점수는 우승팀 기준, 비기면 승부차기 n.pa-n.pb)
  cup: [
    (id, n, name, a, b, sc) => (n.pa || n.pb ? L(`${CLUBS[id].country.ko} 컵 결승: ${named(a.ko, '이', '가')} ${named(b.ko, '과', '와')} ${n.ga}-${n.gb}로 비긴 뒤 승부차기 ${n.pa}-${n.pb}로 우승했습니다.`, `${CLUBS[id].country.en} Cup final: ${a.en} drew ${n.ga}-${n.gb} with ${b.en}, then won ${n.pa}-${n.pb} on penalties.`)
      : L(`${CLUBS[id].country.ko} 컵 결승: ${named(a.ko, '이', '가')} ${named(b.ko, '을', '를')} ${named(sc, '으로')} 꺾고 우승했습니다.`, `${CLUBS[id].country.en} Cup final: ${a.en} beat ${b.en} ${sc}.`)),
    (id, n, name, a, b, sc) => (n.t > n.tb || n.t > 0 ? L(`이변입니다. ${CLUBS[id].country.ko} ${n.t + 1}부 ${named(CLUBS[id].ko, '이', '가')} 컵 결승에서 ${named(b.ko, '을', '를')} 꺾고 우승했습니다 (${sc}${n.pa || n.pb ? `, 승부차기 ${n.pa}-${n.pb}` : ''}).`,
      `Upset! ${CLUBS[id].country.en} Div. ${n.t + 1} side ${CLUBS[id].en} have won the Cup, beating ${b.en} in the final (${sc}${n.pa || n.pb ? `, ${n.pa}-${n.pb} on penalties` : ''}).`)
      : L(`${named(a.ko, '이', '가')} ${CLUBS[id].country.ko} 컵을 들어 올렸습니다. 결승 상대 ${b.ko}, 점수 ${sc}${n.pa || n.pb ? `(승부차기 ${n.pa}-${n.pb})` : ''}.`, `${a.en} have lifted the ${CLUBS[id].country.en} Cup, beating ${b.en} ${sc} in the final${n.pa || n.pb ? ` (${n.pa}-${n.pb} on penalties)` : ''}.`))
  ],
  cupMine: [
    (id, n, name, a, b, sc) => L(`내 선수 ${name}의 소속팀 ${named(CLUBS[id].ko, '이', '가')} ${CLUBS[id].country.ko} 컵 정상에 올랐습니다. 결승에서 ${b.ko}에 ${sc}${n.pa || n.pb ? `(승부차기 ${n.pa}-${n.pb})` : ''} 승리.`,
      `Your player ${name}'s club ${CLUBS[id].en} have won the ${CLUBS[id].country.en} Cup, beating ${b.en} ${sc} in the final${n.pa || n.pb ? ` (${n.pa}-${n.pb} on penalties)` : ''}.`)
  ],
  cont: [
    (id, n, name, a, b, sc, comp) => (n.pa || n.pb ? L(`${comp[0]} 결승: ${named(a.ko, '이', '가')} ${named(b.ko, '과', '와')} ${n.ga}-${n.gb}로 비긴 뒤 승부차기 ${n.pa}-${n.pb}로 대륙 정상에 올랐습니다.`, `${comp[1]} final: ${a.en} drew ${n.ga}-${n.gb} with ${b.en} and won ${n.pa}-${n.pb} on penalties to become continental champions.`)
      : L(`${comp[0]} 결승: ${named(a.ko, '이', '가')} ${named(b.ko, '을', '를')} ${named(sc, '으로')} 꺾고 대륙 정상에 올랐습니다.`, `${comp[1]} final: ${a.en} beat ${b.en} ${sc} to become continental champions.`)),
    (id, n, name, a, b, sc, comp) => L(`${named(CLUBS[id].ko, '이', '가')} ${comp[0]} 우승 트로피를 들었습니다. 결승 상대는 ${CLUBS[n.opp].country.ko}의 ${CLUBS[n.opp].ko}, 점수는 ${sc}${n.pa || n.pb ? `(승부차기 ${n.pa}-${n.pb})` : ''}입니다.`,
      `${CLUBS[id].en} have lifted the ${comp[1]} trophy, beating ${CLUBS[n.opp].en} of ${CLUBS[n.opp].country.en} ${sc} in the final${n.pa || n.pb ? ` (${n.pa}-${n.pb} on penalties)` : ''}.`)
  ],
  // 15단계 내 선수 임대 (떠날 때 from = 소속 구단·to = 임대 구단, 돌아올 때 from = 임대 구단·to = 소속 구단)
  loan: [
    (n, name) => L(`내 선수 ${named(name, '이', '가')} ${named(clubKo(n.to), '으로')} 임대를 떠납니다. 시즌 끝까지 뛰고 ${CLUBS[n.from].ko}에 돌아옵니다.`,
      `Your player ${name} has joined ${clubEn(n.to)} on loan from ${CLUBS[n.from].en} until the end of the season.`),
    (n, name) => L(`"매주 뛰게 해 주겠다." ${clubKo(n.to)} 감독이 내 선수 ${name}의 임대 영입을 반겼습니다.`,
      `"He'll play every week." The ${clubEn(n.to)} manager has welcomed your player ${name} on loan.`)
  ],
  loanBack: [
    (n, name) => L(`내 선수 ${named(name, '이', '가')} ${CLUBS[n.from].ko} 임대를 마치고 ${named(CLUBS[n.to].ko, '으로')} 돌아왔습니다. 임대 동안 리그 ${n.apps}경기 ${n.goals}골.`,
      `Your player ${name} is back at ${CLUBS[n.to].en} after his loan at ${CLUBS[n.from].en}: ${pl(n.apps, 'league game')}, ${pl(n.goals, 'goal')}.`),
    (n, name) => L(`${CLUBS[n.from].ko} 팬들이 임대를 마친 ${name}에게 박수를 보냈습니다 (리그 ${n.apps}경기 ${n.goals}골).`,
      `${CLUBS[n.from].en} fans applauded ${name} as his loan came to an end (${pl(n.apps, 'league game')}, ${pl(n.goals, 'goal')}).`)
  ],
  contMine: [
    (id, n, name, a, b, sc, comp) => L(`내 선수 ${name}의 소속팀 ${named(CLUBS[id].ko, '이', '가')} ${comp[0]} 정상에 올랐습니다! 결승에서 ${CLUBS[n.opp].ko}에 ${sc}${n.pa || n.pb ? `(승부차기 ${n.pa}-${n.pb})` : ''} 승리.`,
      `Your player ${name}'s club ${CLUBS[id].en} are ${comp[1]} champions! They beat ${CLUBS[n.opp].en} ${sc} in the final${n.pa || n.pb ? ` (${n.pa}-${n.pb} on penalties)` : ''}.`)
  ]
};

// 뉴스 한 건: { tag, text, go: 누르면 갈 곳 [행동, 값] }
function newsText(n) {
  const pick = lines => pickLine(lines, n.w, n.club ?? n.to ?? 0, n.s ?? 0);
  if (n.k === 'need') return { tag: L(...NEWS_TAG.need), text: pick(NEWS_LINES.need)(n.club, POS_NAME[n.pos], n), go: ['clubAt', n.club] };
  if (n.k === 'sign' || n.k === 'mine') {
    const go = state.world.gen[n.s] === n.g ? ['player', n.s] : ['clubAt', n.to];
    return { tag: L(...NEWS_TAG[n.k]), text: pick(NEWS_LINES[n.ln ? 'mineLoan' : n.k])(n.to, n.from, newsName(n), n), go };
  }
  if (n.k === 'call') return { tag: L(...NEWS_TAG.call), text: pick(NEWS_LINES.call)(COUNTRY_BY_ID[n.nat], newsName(n)), go: state.world.gen[n.s] === n.g ? ['player', n.s] : null };
  // 13단계: 우승·승강·결승. my = 내 선수 구단 소식 (선수 이름이 들어간 문장, 누르면 선수 상세)
  const tag = NEWS_TAG[n.k] ? L(...NEWS_TAG[n.k]) : '';
  const fan = n.my ? newsName(n) : '';
  const goFan = n.my && state.world.gen[n.s] === n.g ? ['player', n.s] : ['clubAt', n.club];
  if (n.k === 'champ') return { tag, text: n.my ? pick(NEWS_LINES.champMine)(n.club, n, fan) : pick(NEWS_LINES.champ)(n.club, n), go: goFan };
  if (n.k === 'up' || n.k === 'down') return { tag, text: pick(NEWS_LINES[n.k])(n.club, n, fan), go: goFan };
  if (n.k === 'loan') return { tag, text: pick(NEWS_LINES[n.back ? 'loanBack' : 'loan'])(n, fan), go: state.world.gen[n.s] === n.g ? ['player', n.s] : ['clubAt', n.to] };
  if (n.k === 'cup' || n.k === 'cont') {
    // 컵은 부를, 대륙 대회는 나라를 구단 이름에 붙임 ("3부 요크 시티", "스페인의 마드리드 레알레스")
    const label = (id, t) => (n.k === 'cup' ? { ko: `${t + 1}부 ${CLUBS[id].ko}`, en: `${CLUBS[id].en} (Div. ${t + 1})` }
      : { ko: `${CLUBS[id].country.ko}의 ${CLUBS[id].ko}`, en: `${CLUBS[id].en} (${CLUBS[id].country.en})` });
    const a = label(n.club, n.t ?? CLUBS[n.club].t);
    const b = label(n.opp, n.tb ?? CLUBS[n.opp].t);
    const lines = n.my ? NEWS_LINES[`${n.k}Mine`] : NEWS_LINES[n.k];
    return { tag, text: pick(lines)(n.club, n, fan, a, b, `${n.ga}-${n.gb}`, contTitle(CLUBS[n.club].country.region, n.ci || 0)), go: goFan };
  }
  const win = WINDOWS[n.win];
  const who = storedName(n.nm, n.nk);
  const top = n.n && n.to >= 0 ? L(` 가장 비싼 이적은 ${named(CLUBS[n.to].ko, '으로')} 간 ${who}(${money(n.fee)})입니다.`, ` The biggest deal took ${who} to ${CLUBS[n.to].en} for ${money(n.fee)}.`) : '';
  return { tag: L(...NEWS_TAG.close), text: L(`${named(win.ko, '이', '가')} 끝났습니다. 이번 기간 세계에서 이적 ${n.n}건이 있었습니다.${top}`, `The ${win.en} has shut. There were ${pl(n.n, 'transfer')} around the world this window.${top}`), go: null };
}

// 뉴스 한 줄. 보강 필요 뉴스에는 맞는 내 선수를 추천하는 버튼
function newsRow(n) {
  const t = newsText(n);
  const box = el('div', `nitem nitem-${n.k}`);
  const body = t.go ? actButton('nbody', t.go[0], t.go[1]) : el('div', 'nbody');
  body.append(el('span', `ntag ntag-${n.k}${n.my ? ' ntag-my' : ''}`, t.tag), el('span', 'ntext', t.text), el('small', 'nmeta', weekLabel(n.w)));
  box.append(body);
  if (n.k === 'need') {
    const need = state.needs.find(x => x.club === n.club && x.pos === n.pos);
    if (need) box.append(...pitchButtons(need));
    else box.append(el('p', 'nmeta', L('보강을 마쳤거나 이적 기간이 끝났습니다.', 'They have filled the spot, or the window has closed.')));
  }
  return box;
}

// 이 보강에 맞는 내 선수마다 "추천" 버튼 (막히면 이유 표시)
function pitchButtons(need) {
  const out = [];
  for (const c of state.clients) {
    if (pitchFit(c, need)) continue;
    const p = getPlayer(c.s);
    const block = pitchBlock(c, need);
    const b = actButton('btn wide option', 'pitch', c.s);
    b.dataset.o = String(need.club);
    b.append(el('span', 'opt-title', L(`내 선수 ${p.name}(${p.pos}, 능력 ${p.ability}) 추천하기 (1 AP)`, `Pitch ${p.name} (${p.pos}, ability ${p.ability}) to them (1 AP)`)),
      el('span', 'opt-sub', block || L(`마감 ${weekLabel(need.until)}까지 이 선수 제안이 잦아지고 이 구단에서 올 가능성이 높아집니다`, `Until the deadline (${weekLabel(need.until)}), he gets offers more often, most likely from this club`)));
    b.disabled = Boolean(block);
    out.push(b);
  }
  return out;
}

// 내 선수 탭의 뉴스 상자 3건: 추천할 기회 1건 → 내 선수 소식 → 나머지는 최근 순 (추천 기회만으로 채우지 않게)
function newsBox() {
  if (!state.news.length) return null;
  const chance = n => n.k === 'need' && state.needs.some(x => x.club === n.club && x.pos === n.pos) && state.clients.some(c => !pitchFit(c, n));
  const first = state.news.find(chance);
  const mine = state.news.filter(n => n !== first && (n.k === 'mine' || n.k === 'call' || n.my));
  const rest = state.news.filter(n => n !== first && !mine.includes(n) && !chance(n));
  const top = [first, ...mine, ...rest].filter(Boolean).slice(0, 3);
  const box = el('section', 'panel news-box');
  const head = el('div', 'panel-head');
  head.append(el('strong', '', L('세계 뉴스', 'World news')), actButton('link', 'news', undefined, L(`전체 ${state.news.length}건 보기 →`, `See all ${state.news.length} →`)));
  box.append(head, ...top.map(newsRow));
  return box;
}

function renderNews(root) {
  root.append(actButton('back', 'up', undefined, BACK()), el('h1', 'title', L('세계 뉴스', 'World news')), marketLine());
  if (windowAt()) {
    root.append(el('h2', 'section', L(`보강이 필요한 구단 ${state.needs.length}곳`, `Clubs looking to strengthen: ${state.needs.length}`)));
    if (!state.needs.length) root.append(el('p', 'empty', L('이번 이적 기간에 보강을 찾던 구단들이 모두 선수를 구했습니다.', 'Every club that was shopping this window has found its player.')));
    for (const need of state.needs) {
      const box = el('div', 'nitem nitem-need');
      const body = actButton('nbody', 'clubAt', need.club);
      body.append(el('span', 'ntag ntag-need', posName(need.pos)), el('span', 'ntext', L(`${clubLabel(need.club)} · 주전 평균 능력 ${need.avg} (구단 수준보다 ${need.gap} 낮음)`, `${clubLabel(need.club)} · starters average ${need.avg} (${need.gap} below the club's level)`)));
      box.append(body, ...pitchButtons(need));
      root.append(box);
    }
  } else root.append(el('p', 'sub', L('이적 기간이 열리면 구단들이 보강할 포지션을 알리고, 기간 동안 실제로 선수를 데려옵니다.', 'When a window opens, clubs reveal the positions they want to strengthen, then go and sign players during it.')));
  root.append(el('h2', 'section', L(`최근 뉴스 ${state.news.length}건`, `Latest news (${state.news.length})`)));
  if (!state.news.length) root.append(el('p', 'empty', L('아직 뉴스가 없습니다.', 'No news yet.')));
  state.news.forEach(n => root.append(newsRow(n)));
}

// 14단계 처음 화면 (시안 A "할 일 먼저"): 상태 한 줄 → 이번 주 할 일(답할 소식 → 해 볼 만한 일) → 지난주 → 소속 선수 → 세계 뉴스
// 이번 주에 해 볼 만한 일: 소식 말고 지금 할 수 있는 일 (누르면 그 화면으로, 최대 4개)
function todoList() {
  const out = [];
  const now = absWeek();
  if (state.over) return out;
  if (!state.founded && !foundBlock()) out.push({ act: 'goTab', v: 2, text: L('회사를 세울 수 있습니다', 'You can found your company'), sub: L(`에이전시 탭 · AP ${TUNE.ap}, 소속 한도 ${TUNE.limitBase}명`, `Agency tab · ${TUNE.ap} AP, room for ${TUNE.limitBase} players`) });
  for (const c of state.clients) {
    const p = getPlayer(c.s);
    const left = c.end - now;
    if (left <= TUNE.renewWindow && c.negUntil <= now) {
      out.push({ act: 'player', v: c.s, text: L(`${p.name} 재계약 협상`, `Renew ${p.name}'s contract`), sub: isFreeAgent(c) ? L('무소속이라 수수료가 없습니다 · 1 AP', 'Free agent, so no commission · 1 AP') : L(`계약 만료까지 ${left}주 · 1 AP`, `${pl(left, 'week')} left on his deal · 1 AP`) });
    } else if (c.sat < 50 && !(c.met && now - c.met < TUNE.meetGap)) {
      out.push({ act: 'player', v: c.s, text: L(`${p.name} 면담`, `Meet ${p.name}`), sub: L(`만족 ${c.sat} · 면담하면 +${TUNE.meetGain} · 1 AP`, `Morale ${c.sat} · a meeting adds ${TUNE.meetGain} · 1 AP`) });
    } else if (!loanBlock(c, false)) {
      // 15단계: 벤치에 있는 선수 임대
      out.push({ act: 'player', v: c.s, text: L(`${p.name} 임대 보내기`, `Send ${p.name} out on loan`), sub: L(`지금 구단 출전 ${Math.round(benchChance(c) * 100)}% · 후보 ${TUNE.loanPick}곳 · 1 AP`, `Starts ${Math.round(benchChance(c) * 100)}% at his club · ${TUNE.loanPick} options · 1 AP`) });
    }
  }
  const pitchable = state.needs.filter(n => state.clients.some(c => !pitchFit(c, n) && !pitching(c))).length;
  if (pitchable) out.push({ act: 'news', text: L(`내 선수를 추천할 수 있는 구단 ${pitchable}곳`, `Clubs you could pitch a player to: ${pitchable}`), sub: L('보강이 필요한 구단 · 세계 뉴스 · 1 AP', 'Clubs looking to strengthen · World news · 1 AP') });
  const room = clientLimit() - state.clients.length;
  if (room > 0) out.push({ act: 'goTab', v: 1, text: L(`소속 자리가 ${room}명 남았습니다`, `Room for ${pl(room, 'more player')}`), sub: L('리그 탭에서 유망주 찾기 · 영입 제안 1 AP', 'Leagues tab · find prospects · an offer costs 1 AP') });
  return out.slice(0, 4);
}

// 카드의 지난주 한 줄: "지난주 7.4(1골) [리그 2-1 승]" (지난주에 경기가 없었으면 빈 문자열)
function lastWeekText(c) {
  const lw = c.lw;
  if (!lw || lw.w !== absWeek() - 1) return '';
  if (lw.a) return lw.a === 'inj' ? L('지난주 부상으로 결장', 'Last week: out injured') : L('지난주 휴가로 결장', 'Last week: on leave');
  if (!lw.n) return '';
  const perf = lw.p ? `${(lw.r / 10).toFixed(1)}${lw.g ? L(`(${lw.g}골)`, ` (${pl(lw.g, 'goal')})`) : ''}` : L('결장', "didn't play");
  return `${L('지난주', 'Last week:')} ${perf}${teamText(lw.t.map(([key, f, a, pk]) => ({ key, f, a, pk })))}`;
}

function renderClients(root) {
  const head = el('div', 'home-head');
  head.append(el('h1', 'title', L('내 선수', 'My players')), el('span', 'badge', L(`${state.founded ? '' : '혼자 · '}${state.clients.length}/${clientLimit()}명`, `${state.founded ? '' : 'Solo · '}${state.clients.length}/${clientLimit()}`)));
  const net = weeklyIncome() - weeklySpend();
  const money = el('p', 'sub', L(`주간 수수료 ${cash(weeklyIncome())} · 지출 ${cash(weeklySpend())} · 수지 `, `Commission ${cash(weeklyIncome())}/wk · costs ${cash(weeklySpend())} · net `));
  money.append(el('span', net < 0 ? 'down' : 'up', signedCash(net)));
  root.append(head, marketLine(), money);
  // 1) 이번 주 할 일: 답할 소식 카드, 그다음 해 볼 만한 일. 소식 카드를 못 그리면(잘못된 데이터) 그 소식만 버리고 화면은 계속 그림
  const cards = [];
  for (const ev of [...state.events]) {
    try {
      cards.push(newsCard(ev));
    } catch (e) {
      console.warn('소식을 그리지 못해 버립니다:', ev.type, e.message);
      state.events = state.events.filter(x => x !== ev);
    }
  }
  const todos = todoList();
  root.append(el('h2', 'section', cards.length ? L(`이번 주 할 일 · 답할 소식 ${cards.length}건`, `This week · ${pl(cards.length, 'story', 'stories')} to answer`) : L('이번 주 할 일', 'This week')));
  // 새 게임 첫 3주: 한 주에 하는 일을 한 줄로 안내
  if (state.season === 1 && state.week <= 3) root.append(el('p', 'guide', L('한 주는 이렇게 보냅니다: ① 소식에 답하고 ② 선수를 돌보고(면담·재계약·영입) ③ 다음 주 ▶를 누릅니다.', 'Each week: ① answer your news, ② look after your players (meetings, renewals, signings), ③ tap Next ▶.')));
  root.append(...cards);
  if (todos.length) {
    const list = el('div', 'list todo');
    for (const t of todos) list.append(rowButton(t.act, t.v, t.text, t.sub));
    root.append(list);
  }
  if (!cards.length && !todos.length) root.append(el('p', 'empty', state.over ? GAME_OVER() : L('이번 주에 답할 소식이 없습니다. 다음 주 ▶로 넘기세요.', 'Nothing needs an answer this week. Tap Next ▶.')));
  // 2) 지난주: 정산·경기 기록 최근 2줄 (전체는 기록 탭)
  if (state.logs.length) {
    const latest = el('div', 'latest');
    state.logs.slice(0, 2).forEach(line => latest.append(el('span', '', line)));
    root.append(el('h2', 'section', L('지난주', 'Last week')), latest);
  }
  // 3) 소속 선수 카드
  root.append(el('h2', 'section', L(`소속 선수 ${state.clients.length}/${clientLimit()}명`, `Your players ${state.clients.length}/${clientLimit()}`)));
  if (!state.clients.length) root.append(el('p', 'empty', L('소속 선수가 없습니다.', 'You have no players.')));
  state.clients.forEach(c => root.append(clientCard(c)));
  // 4) 세계 뉴스는 맨 아래 (추천 기회 → 내 선수 소식 → 최근 순)
  const nbox = newsBox();
  if (nbox) root.append(nbox);
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
    root.append(el('h1', 'title', L('리그', 'Leagues')), el('p', 'sub', L(`${COUNTRIES.length}개국 · ${LEAGUE_COUNT}개 리그 · 구단 ${num(CLUBS.length)}개 · 선수 ${num(SLOTS)}명`, `${COUNTRIES.length} countries · ${LEAGUE_COUNT} leagues · ${num(CLUBS.length)} clubs · ${num(SLOTS)} players`)));
    root.append(rowButton('news', undefined, L('세계 뉴스', 'World news'), windowAt() ? L(`보강이 필요한 구단 ${state.needs.length}곳 · 이번 이적 기간 이적 ${state.deals.n}건`, `${state.needs.length} clubs looking to strengthen · ${pl(state.deals.n, 'transfer')} this window`)
      : L(`최근 뉴스 ${state.news.length}건 · 이적 시장 닫힘`, `${state.news.length} recent stories · transfer market closed`)));
    renderScouting(root);
    // 12단계: 나라가 105개라 지역을 골라서 봄. 지역 안에서는 1부 수준이 높은 순
    const region = regionNow();
    const chips = el('div', 'segment seg3 region-chips');
    REGIONS.forEach((r, i) => chips.append(segButton('region', i, L(REGION_CHIP[r][0], REGION_CHIP[r][1]), r === region)));
    const list = el('div', 'list');
    const inRegion = COUNTRIES.filter(x => x.region === region).sort((a, b) => b.level - a.level || a.i - b.i);
    for (const c of inRegion) {
      const mine = state.clients.filter(cl => clubOf(cl.s).country === c).length;
      list.append(rowButton('country', c.i, c.name, L(`${c.tiers.length}부 · ${c.clubs.flat().length}팀 · 1부 수준 ${c.level}`, `${pl(c.tiers.length, 'division')} · ${c.clubs.flat().length} teams · top flight level ${c.level}`), mine ? MINE(mine) : ''));
    }
    root.append(el('h2', 'section', L('지역', 'Region')), chips, el('h2', 'section', L(`${regionName(region)} · ${inRegion.length}개국`, `${regionName(region)} · ${pl(inRegion.length, 'country', 'countries')}`)), list);
    return;
  }
  const country = COUNTRIES[ui.country];
  if (ui.tier === null) {
    root.append(actButton('back', 'up', undefined, L('← 전체 리그', '← All leagues')), el('h1', 'title', country.name), el('p', 'sub', L(`${country.region} · ${country.tiers.length}부까지`, `${regionName(country.region)} · ${pl(country.tiers.length, 'division')}`)));
    const list = el('div', 'list');
    country.clubs.forEach((clubs, t) => {
      const avg = clubs.reduce((n, club) => n + clubAverage(club), 0) / clubs.length;
      const mine = clubs.reduce((n, club) => n + clientCountIn(club), 0);
      // 13단계: 선두(리그가 끝났으면 우승) 구단
      const top = playedRounds(country, t) ? leagueTable(country, t)[0].club.name : '';
      const lead = top ? (leagueOver() ? L(` · 우승 ${top}`, ` · champions ${top}`) : L(` · 선두 ${top}`, ` · leaders ${top}`)) : '';
      list.append(rowButton('tier', t, leagueName(country, t), L(`${clubs.length}팀 · 평균 능력 ${avg.toFixed(0)}${lead}`, `${clubs.length} teams · average ability ${avg.toFixed(0)}${lead}`), mine ? MINE(mine) : ''));
    });
    root.append(list);
    return;
  }
  if (ui.club === null) {
    renderTable(root, country, ui.tier);
    return;
  }
  renderClub(root, CLUBS[ui.club]);
}

// 13단계 순위표: 순위·구단·경기·득실·승점. 줄 왼쪽 색 = 대륙 대회 진출권·승격·강등, 내 선수 구단은 배지
function renderTable(root, country, t) {
  const n = country.tiers[t];
  const played = playedRounds(country, t);
  const rounds = roundsOf(n);
  const status = !played ? L('개막 전 · 전력 순', 'Pre-season · by strength') : played >= rounds ? L('최종 순위', 'Final table') : L(`${played}/${rounds}라운드`, `Round ${played} of ${rounds}`);
  const rules = [t === 0 ? L(`상위 ${contSlots(country)}팀 대륙 대회`, `top ${contSlots(country)} to continental`) : L(`상위 ${moveCount(country, t - 1)}팀 승격`, `top ${moveCount(country, t - 1)} promoted`),
    t + 1 < country.tiers.length ? L(`하위 ${moveCount(country, t)}팀 강등`, `bottom ${moveCount(country, t)} relegated`) : ''].filter(Boolean).join(' · ');
  root.append(actButton('back', 'up', undefined, `← ${country.name}`), el('h1', 'title', leagueName(country, t)), el('p', 'sub', `${L(`${n}팀`, `${n} teams`)} · ${status} · ${rules}`));
  const table = el('div', 'ltable');
  const head = el('div', 'lt-row lt-head');
  head.append(el('span', 'lt-rk', '#'), el('span', 'lt-name', L('구단', 'Club')), el('span', 'lt-num', L('경기', 'P')), el('span', 'lt-num', L('득실', 'GD')), el('span', 'lt-pts', L('승점', 'Pts')));
  table.append(head);
  for (const row of leagueTable(country, t)) {
    const zone = played ? zoneOf(country, t, row.rk) : '';
    const b = actButton(`lt-row${zone ? ` z-${zone}` : ''}`, 'club', row.club.id);
    const name = el('span', 'lt-name');
    name.append(el('span', 'lt-club', row.club.name));
    const mine = clientCountIn(row.club);
    if (mine) name.append(el('span', 'badge mine', MINE(mine)));
    b.append(el('span', 'lt-rk', String(row.rk)), name, el('span', 'lt-num', String(row.p)), el('span', 'lt-num', row.gd > 0 ? `+${row.gd}` : String(row.gd)), el('span', 'lt-pts', String(row.pts)));
    table.append(b);
  }
  const legend = el('p', 'lt-legend');
  for (const [z, ko, en] of [['cont', '대륙 대회', 'Continental'], ['up', '승격', 'Promotion'], ['down', '강등', 'Relegation']]) {
    if ((z === 'cont' && t === 0) || (z === 'up' && t > 0) || (z === 'down' && t + 1 < country.tiers.length)) legend.append(el('span', `lt-key z-${z}`, L(ko, en)));
  }
  root.append(table, legend);
}

function renderClub(root, club) {
  const slots = clubSlots(club);
  const level = Math.round(clubLevel(club));
  root.append(actButton('back', 'up', undefined, `← ${leagueName(club.country, club.t)}`), el('h1', 'title', club.name),
    el('p', 'sub', L(`${leagueName(club.country, club.t)} · 구단 수준 ${level} · 선수 ${slots.length}명 · 평균 능력 ${clubAverage(club).toFixed(0)} · 선수를 누르면 상세`,
      `${leagueName(club.country, club.t)} · club level ${level} · ${slots.length} players · average ability ${clubAverage(club).toFixed(0)} · tap a player for details`)));
  root.append(seasonPanel(club));
  const need = state.needs.find(n => n.club === club.id);
  if (need) {
    const box = el('div', 'panel need-panel');
    box.append(el('strong', '', L(`${POS_NAME[need.pos][0]} 보강을 찾는 중`, `Looking for a ${POS_NAME[need.pos][1]}`)),
      el('p', 'sub', L(`주전 ${POS_NAME[need.pos][0]} 평균 능력 ${need.avg} (구단 수준보다 ${need.gap} 낮음) · 마감 ${weekLabel(need.until)}`, `Starting ${POS_NAME[need.pos][1]}s average ${need.avg} (${need.gap} below the club's level) · deadline ${weekLabel(need.until)}`)), ...pitchButtons(need));
    root.append(box);
  }
  const now = absWeek();
  const players = slots.map(getPlayer).sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.ability - a.ability);
  const list = el('div', 'list');
  for (const p of players) {
    const client = clientOf(p.s);
    list.append(playerRow(p, L(`계약 ${weekLabel(client ? client.end : contractEnd(p, now))}`, `contract to ${weekLabel(client ? client.end : contractEnd(p, now))}`)));
  }
  root.append(list);
}

// 13단계 구단의 이번 시즌: 리그 순위·승점·전적·최근 5경기, 국내 컵·대륙 대회 진행 상황
function seasonPanel(club) {
  const box = el('div', 'panel season-panel');
  box.append(el('strong', '', L(`${state.season}시즌`, `Season ${state.season}`)));
  const league = leagueName(club.country, club.t);
  if (!playedRounds(club.country, club.t)) box.append(el('p', 'panel-line', L(`${league} 개막 전`, `${league} hasn't kicked off yet`)));
  else {
    const row = tableRow(club);
    const zone = zoneOf(club.country, club.t, row.rk);
    const done = leagueOver();
    const word = done && row.rk === 1 ? L('우승', 'champions') : { cont: done ? L('대륙 대회 진출', 'continental place') : L('대륙 대회 진출권', 'continental place'),
      up: done ? L('승격', 'promoted') : L('승격권', 'promotion place'), down: done ? L('강등', 'relegated') : L('강등권', 'relegation zone') }[zone];
    const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
    // 순위 뒤 구역(대륙 대회·승격·강등)만 색으로
    const line = el('p', 'panel-line', L(`리그 ${done ? '최종 ' : ''}${row.rk}위`, `League: ${done ? 'finished ' : ''}${ordinal(row.rk)}`));
    if (word) line.append(' ', el('span', zone === 'down' ? 'down' : 'up', `(${word})`));
    line.append(L(` · 승점 ${row.pts} · ${row.p}경기 ${row.w}승 ${row.d}무 ${row.l}패 · 득실 ${gd}`, ` · ${row.pts} pts · P${row.p} W${row.w} D${row.d} L${row.l} · GD ${gd}`));
    box.append(line);
    const guide = el('p', 'form-guide');
    guide.append(el('span', 'fg-label', L('최근 5경기', 'Last 5')));
    for (const r of row.last) guide.append(el('span', `fg fg-${r}`, L({ W: '승', D: '무', L: '패' }[r], r)));
    box.append(guide);
  }
  box.append(el('p', 'panel-line', `${compName('C', club)}: ${compStatus(club, 'C')}`));
  if (inContinental(club)) box.append(el('p', 'panel-line', `${compName('K', club)}: ${compStatus(club, 'K')}`));
  return box;
}

// 선수 한 줄 (구단 명단·관심 선수·찾기 결과). 누르면 상세. tail = 줄 끝에 붙는 글
function playerRow(p, tail) {
  const client = clientOf(p.s);
  const row = actButton(client ? 'player mine' : 'player', 'player', p.s);
  const top = el('span', 'player-top');
  top.append(posTag(p.pos), el('strong', 'name', p.name), el('span', 'player-age', L(`${ageOf(p)}세 · ${p.nat.name}`, `${ageOf(p)} · ${p.nat.name}`)));
  if (client) top.append(el('span', 'badge mine', L('내 선수', 'Mine')));
  else if (state.watch.includes(cooldownKey(p))) top.append(el('span', 'badge', L('관심', 'Watching')));
  top.append(el('span', 'abil', String(p.ability)));
  const line = el('span', 'player-line');
  line.append(L(`잠재 ${potText(p)} · 폼 `, `Pot ${potText(p)} · form `), formNode(p), ` · ${money(valueOf(p))} · ${tail}`);
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
    watched.forEach(p => list.append(playerRow(p, L(`${p.club.name} · 영입 ${recruitChance(p)}%`, `${p.club.name} · signing ${recruitChance(p)}%`))));
    root.append(el('h2', 'section', L(`관심 선수 ${watched.length}/${TUNE.watchMax}명`, `Watch list ${watched.length}/${TUNE.watchMax}`)), list);
  }
  const box = el('div', 'panel');
  box.append(el('strong', '', L('유망주 찾기', 'Find prospects')),
    el('p', 'sub', L(`보이는 잠재력 범위의 위쪽이 높은 순으로 ${TUNE.findMax}명을 보여 줍니다 (영입 확률 ${TUNE.findChance}% 이상만). 잠재력은 스카우트를 보내야 정확해집니다.`,
      `Shows the ${TUNE.findMax} players whose visible potential range reaches highest (signing chance ${TUNE.findChance}%+ only). Send scouts to pin their potential down.`)));
  const ages = el('div', 'segment seg3');
  FIND_AGES.forEach(age => ages.append(segButton('findAge', age, L(`${age}세 이하`, `U${age + 1}`), age === findAge)));
  const poses = el('div', 'segment seg5');
  FIND_POS.forEach((pos, i) => poses.append(segButton('findPos', i, pos || L('전체', 'All'), pos === findPos)));
  box.append(ages, poses, actButton('btn wide', 'find', undefined, findList ? L('다시 찾기', 'Search again') : L('찾기', 'Search')));
  root.append(box);
  if (findList) {
    const list = el('div', 'list');
    const shown = findList.map(getPlayer).filter(p => !clientOf(p.s));
    shown.forEach(p => list.append(playerRow(p, L(`${p.club.name} · 영입 ${recruitChance(p)}%`, `${p.club.name} · signing ${recruitChance(p)}%`))));
    root.append(shown.length ? list : el('p', 'empty', L('조건에 맞는 선수가 없습니다.', 'No players match.')));
  }
}

function segButton(act, value, label, on) {
  const b = actButton(on ? 'seg on' : 'seg', act, value, label);
  b.setAttribute('aria-pressed', String(on));
  return b;
}

// 대회 단계 이름 [한국어, 영어 제목, 영어 문장 속]: 컵 라운드 0~5, 대륙 대회 6~8 = 8강·4강·결승 (0~5는 조별리그)
const CUP_STAGES = [['1라운드', 'Round 1', 'Round 1'], ['2라운드', 'Round 2', 'Round 2'], ['16강', 'Round of 16', 'the Round of 16'],
  ['8강', 'Quarter-finals', 'the quarter-finals'], ['4강', 'Semi-finals', 'the semi-finals'], ['결승', 'Final', 'the final']];
const stageOf = (key, i) => (key === 'K' ? CUP_STAGES[i - 3] : CUP_STAGES[i]);

// 대회 진행 상태: 지금까지 치른 경기로만 판단 (앞으로 결과는 미리 보여 주지 않음)
function compStatus(club, key) {
  if (key === 'K' && !inContinental(club)) return '';
  const run = compRun(club, key);
  if (!run.mask) return L('참가하지 않음', 'not entered');
  const weeks = key === 'C' ? CUP_WEEKS : CONT_WEEKS;
  const mine = weeks.map((w, i) => i).filter(i => (run.mask >> i) & 1);
  const played = mine.filter(i => weeks[i] < state.week).length;
  const next = mine.find(i => weeks[i] >= state.week);
  if (next !== undefined) {
    if (key === 'K' && next < 6) return played ? L(`조별리그 ${played}경기`, `group stage, ${pl(played, 'game')} played`) : L('조별리그 시작 전', 'group stage to come');
    const [ko, , enIn] = stageOf(key, next);
    if (!played) return next === 0 ? L(`${ko} 시작 전`, `${enIn} to come`) : L(`${ko}부터 출전`, `enters in ${enIn}`);
    if (key === 'K' && next === 6) return L(`조 ${run.gpos + 1}위로 8강 진출`, `through to the quarter-finals (${ordinal(run.gpos + 1)} in group)`);
    return L(`${ko} 진출`, `through to ${enIn}`);
  }
  if (run.won) return L('우승', 'Winners');
  const last = mine[mine.length - 1];
  if (key === 'K' && last < 6) return L(`조별리그 탈락 (조 ${run.gpos + 1}위)`, `out in the group stage (${ordinal(run.gpos + 1)} in group)`);
  return last === weeks.length - 1 ? L('결승 패배', 'lost the final') : L(`${stageOf(key, last)[0]} 탈락`, `out in ${stageOf(key, last)[2]}`);
}

// 리그 순위 한 마디: "3위" / "3rd" (리그가 아직 시작 전이면 빈 문자열). final이면 "최종 3위"
function rankText(club) {
  if (!playedRounds(club.country, club.t)) return '';
  const row = tableRow(club);
  return leagueOver() ? L(`최종 ${row.rk}위`, `finished ${ordinal(row.rk)}`) : L(`${row.rk}위`, ordinal(row.rk));
}

// 기록 표: 대회별 경기·골·도움·평점
function statsTable(st, club, nat, withStatus) {
  const table = el('table', 'stats-table');
  const head = el('tr');
  [L('대회', 'Competition'), L('경기', 'Apps'), L('골', 'Gls'), L('도움', 'Ast'), L('평점', 'Rtg')].forEach(h => head.append(el('th', '', h)));
  table.append(head);
  for (const key of COMPS) {
    const row = st[key];
    // 컵은 참가한 시즌이면, 대륙 대회는 참가 구단이면 경기가 없어도 줄을 보여 줌
    if (!row[0] && key !== 'L' && !(key === 'K' && inContinental(club)) && !(key === 'C' && withStatus && compRun(club, 'C').mask)) continue;
    const tr = el('tr');
    const status = !withStatus || key === 'N' ? '' : key === 'L' ? rankText(club) : compStatus(club, key);
    tr.append(el('td', '', compName(key, club, nat) + (status ? ` · ${status}` : '')), el('td', '', String(row[0])), el('td', '', String(row[1])), el('td', '', String(row[2])), el('td', '', avgRating(row)));
    table.append(tr);
  }
  return table;
}

// 지난 구간 표: 시즌·구단별 한 줄
function careerTable(hist, nat) {
  const table = el('table', 'stats-table');
  const head = el('tr');
  [L('시즌', 'Season'), L('구단', 'Club'), L('리그', 'League'), L('평점', 'Rtg'), L('대륙·대표', 'Cont · Intl')].forEach(h => head.append(el('th', '', h)));
  table.append(head);
  for (const st of hist) {
    const club = CLUBS[st.club];
    const tr = el('tr');
    tr.append(el('td', '', String(st.season)), el('td', '', `${club.name}${st.ln ? L('(임대)', ' (loan)') : ''} (${leagueName(club.country, st.t ?? club.t)})`),
      el('td', '', L(`${st.L[0]}경기 ${st.L[1]}골`, `${st.L[0]} apps ${st.L[1]} gls`)), el('td', '', avgRating(st.L)), el('td', '', `${st.K[0]} · ${st.N[0]}`));
    table.append(tr);
  }
  return table;
}

// 성향·원하는 조건과 지금 구단이 맞는지
function prefsBlock(p, c) {
  const pref = prefsOf(p);
  const dream = CLUBS[pref.dream];
  const box = el('div', 'prefs');
  box.append(el('p', '', L(`성향: ${PRIORITY[pref.main][0]} 중시 · ${ABROAD[pref.abroad][0]}`, `Cares most about ${PRIORITY[pref.main][1]} · ${ABROAD[pref.abroad][1]}`)),
    el('p', '', L(`꿈의 구단: ${dream.name} (${leagueName(dream.country, dream.t)})`, `Dream club: ${dream.name} (${leagueName(dream.country, dream.t)})`)),
    el('p', '', L(`원하는 조건: 주급 ${cash(wantWage(p, pref))} 이상 · ${pref.years}시즌 계약`, `Wants: ${cash(wantWage(p, pref))}+ a week · ${pl(pref.years, 'season')} contract`)));
  if (c) {
    const checks = fitChecks(p, pref, p.club, c.wage, 0);
    box.append(el('h3', 'mini', L('지금 구단은?', 'His current club?')), checkList(checks, fitScore(checks, pref)));
  }
  return box;
}

function nationalLine(p) {
  const cut = natCutOf(p);
  if (isNationalPick(p)) return L(`${p.nat.name} 국가대표 (기준 능력 ${cut})`, `${p.nat.name} international (cut-off ability ${cut})`);
  return L(`${p.nat.name} 국가대표 기준 능력 ${cut} · 지금 ${p.ability} (${cut - p.ability} 부족)`, `${p.nat.name} squad cut-off: ability ${cut} · now ${p.ability} (${cut - p.ability} short)`);
}

// 재계약: 기간을 고르면 주급 단계별 구단 수락 확률·선수 반응이 바뀜 (선택은 저장하지 않음)
let renewYears = 0;
function renewPanel(box, c, p) {
  const pref = prefsOf(p);
  const years = RENEW_YEARS.includes(renewYears) ? renewYears : pref.years >= 3 ? 4 : 2;
  const toggle = el('div', 'segment');
  RENEW_YEARS.forEach(y => {
    const b = actButton(y === years ? 'seg on' : 'seg', 'renewYears', y, L(`${y}시즌`, pl(y, 'season')));
    b.setAttribute('aria-pressed', String(y === years));
    toggle.append(b);
  });
  box.append(toggle);
  RENEW_LEVELS.forEach((_, i) => {
    const t = renewTerms(c, p, i, years);
    const b = actButton('btn wide option', 'renew', c.s);
    b.dataset.o = String(i);
    b.dataset.y = String(years);
    b.append(el('span', 'opt-title', L(`${t.label} · 주급 ${cash(t.wage)}`, `${t.label} · wage ${cash(t.wage)}`)),
      el('span', 'opt-sub', L(`구단 수락 ${t.chance}% · 선수 반응 ${moodText(t.score)} (만족 ${t.satGain >= 0 ? '+' : ''}${t.satGain}) · 수수료 ${cash(t.fee)}`, `Club agrees ${t.chance}% · player reaction ${moodText(t.score)} (morale ${t.satGain >= 0 ? '+' : ''}${t.satGain}) · commission ${cash(t.fee)}`)));
    box.append(b);
  });
  const mid = renewTerms(c, p, 0, years);
  const lawyer = state.invest.lawyer ? L(` 주급에 변호사 ${state.invest.lawyer}단계(+${Math.round(TUNE.lawyerWage[state.invest.lawyer] * 100)}%)가 들어 있습니다.`, ` Wages include your level ${state.invest.lawyer} lawyer (+${Math.round(TUNE.lawyerWage[state.invest.lawyer] * 100)}%).`) : '';
  box.append(checkList(mid.checks.filter(ch => ch.key !== 'money'), fitScore(mid.checks, pref), L('주급은 단계마다 다름', 'wage depends on the option')),
    el('p', 'sub', L(`결렬되면 만족 -8, ${TUNE.renewRetry}주 뒤 다시 협상할 수 있습니다. 구단은 어린 선수에게 긴 계약, 30세 이상에게 짧은 계약을 선호합니다.${lawyer}`,
      `If talks fail, morale -8 and you can try again in ${pl(TUNE.renewRetry, 'week')}. Clubs prefer long deals for young players and short ones for players over 30.${lawyer}`)));
}

// 소속 선수 상세: 면담, 재계약 협상, 해지
function clientActions(box, c, p) {
  box.append(el('p', 'sub', isFreeAgent(c)
    ? L('계약이 끝나 무소속입니다. 재계약하거나 이적 제안을 받아야 수수료가 다시 들어옵니다.', 'His contract has ended and he is a free agent. Commission resumes once he renews or moves.')
    : L(`내 수수료는 주 ${cash(commissionOf(c.wage))}(주급의 ${FEE_RATE * 100}%)입니다.`, `Your commission is ${cash(commissionOf(c.wage))} a week (${FEE_RATE * 100}% of his wage).`)));
  const meetMsg = meetBlock(c);
  const meetBtn = actButton('btn primary', 'meet', c.s, L(`면담 (1 AP, 만족 +${TUNE.meetGain}, 유대 +${TUNE.bondMeet})`, `Meet him (1 AP, morale +${TUNE.meetGain}, bond +${TUNE.bondMeet})`));
  meetBtn.disabled = Boolean(meetMsg);
  box.append(meetBtn);
  if (meetMsg) box.append(el('p', 'note', meetMsg));
  box.append(el('h2', 'section', L('재계약 협상 (1 AP)', 'Contract renewal (1 AP)')));
  const renewMsg = renewBlock(c);
  if (renewMsg) box.append(el('p', 'note', renewMsg));
  else renewPanel(box, c, p);
  loanPanel(box, c, p);
  box.append(el('h2', 'section', L('계약 해지', 'Release')), actButton('btn danger', 'release', c.s, L('계약 해지 (평판 -1)', 'Release him (reputation -1)')));
}

// 17단계: 임대 중인 선수의 완전 이적 전망 한 줄 (임대 성적 → 리그가 끝난 다음 주에 정할 제안 가능성)
function buyOutlook(c) {
  const club = CLUBS[c.loan.club].name;
  const decide = LEAGUE_WEEKS + 1;
  if (!loanEnding(c)) return L(`임대가 다음 시즌 끝까지라, 다음 시즌 리그가 끝나면(${decide}주) ${named(club, '이', '가')} 완전 이적을 제안할지 정합니다.`,
    `The loan runs until the end of next season, so ${club} will decide on a permanent move once next season's league ends (week ${decide}).`);
  if (state.events.some(e => e.type === 'buy' && e.s === c.s)) return L(`${named(club, '이', '가')} 완전 이적을 제안했습니다. 내 선수 탭 소식에서 답해 주세요.`, `${club} have offered to make the move permanent. Answer it in the Players tab.`);
  if (leagueOver()) return L(`이번 시즌이 끝나면 임대를 마치고 ${homeClub(c.s).name}에 돌아옵니다.`, `He returns to ${homeClub(c.s).name} when the season ends.`);
  const st = loanStint(c);
  const apps = st ? st.L[0] : 0;
  if (apps < TUNE.buyApps) return L(`임대 구단에서 리그 ${apps}경기를 뛰었습니다. ${TUNE.buyApps}경기 이상 뛰면 리그가 끝난 다음 주(${decide}주)에 ${named(club, '이', '가')} 완전 이적을 제안할 수 있습니다.`,
    `${pl(apps, 'league game')} for ${club} so far. With ${TUNE.buyApps} or more, they may offer a permanent move the week after the league ends (week ${decide}).`);
  return L(`임대 동안 리그 ${apps}경기 평균 평점 ${avgRating(st.L)}. 리그가 끝난 다음 주(${decide}주)에 ${named(club, '이', '가')} 완전 이적을 제안할지 정합니다. 지금 기록이면 제안 가능성 ${Math.round(buyChance(st.L) * 100)}%입니다.`,
    `On loan: ${pl(apps, 'league game')}, average rating ${avgRating(st.L)}. ${club} will decide on a permanent move the week after the league ends (week ${decide}). On this form the chance is ${Math.round(buyChance(st.L) * 100)}%.`);
}

// 15단계 임대 칸: 임대 중이면 안내, 소속 구단에서 벤치면(출전 확률 TUNE.loanBench 미만) 후보 구단마다 버튼 (출전·선수 동의·반응)
function loanPanel(box, c, p) {
  if (c.loan) {
    box.append(el('h2', 'section', L('임대', 'Loan')), el('p', 'sub', L(`${CLUBS[c.loan.club].name}에서 임대로 뛰는 중입니다(${weekLabel(c.loan.until)}까지). 소속 구단은 ${homeClub(c.s).name}이고 계약·주급·내 수수료는 그대로입니다.`,
      `He is on loan at ${CLUBS[c.loan.club].name} until ${weekLabel(c.loan.until)}. His club is still ${homeClub(c.s).name}, and his contract, wage and your commission are unchanged.`)),
    el('p', 'sub', buyOutlook(c)));
    return;
  }
  if (isFreeAgent(c) || benchChance(c) >= TUNE.loanBench) return;
  const block = loanBlock(c);
  const pct = Math.round(benchChance(c) * 100);
  box.append(el('h2', 'section', L('임대 (1 AP)', 'Loan (1 AP)')), el('p', 'sub', L(`지금 구단 출전 확률 ${pct}%. 임대를 가면 ${weekLabel(loanUntil())}까지 주전으로 뛰고 돌아옵니다. 계약·주급·내 수수료는 그대로이고, 23세 이하는 많이 뛸수록 더 자랍니다. 임대 구단에서 리그 ${TUNE.buyApps}경기 이상 뛰며 평점이 좋으면, 리그가 끝난 뒤 그 구단이 완전 이적을 제안하기도 합니다.`,
    `He starts ${pct}% of games at his club. On loan he would play regularly until ${weekLabel(loanUntil())}, then come back. His contract, wage and your commission stay the same, and players aged 23 or under develop faster with more minutes. If he plays ${TUNE.buyApps}+ league games there and rates well, the loan club may offer to make the move permanent once the league ends.`)));
  if (block && block !== NO_AP()) {
    box.append(el('p', 'note', block));
    return;
  }
  for (const club of loanClubs(c)) {
    const fit = loanFit(c, club);
    const rank = rankText(club);
    const abroad = club.country === p.nat ? '' : L(` · 해외(${club.country.name})`, ` · abroad (${club.country.name})`);
    const b = actButton('btn wide option', 'loan', c.s);
    b.dataset.o = String(club.id);
    b.append(el('span', 'opt-title', `${club.name} · ${leagueName(club.country, club.t)}${rank ? L(` ${rank}`, ` · ${rank}`) : ''}`),
      el('span', 'opt-sub', L(`출전 ${Math.round(startChance(p.ability, clubLevel(club), 5.5) * 100)}% · 선수 동의 ${fit.consent}% · ${moodText(fit.score)}${abroad}`,
        `Starts ${Math.round(startChance(p.ability, clubLevel(club), 5.5) * 100)}% · player agrees ${fit.consent}% · ${moodText(fit.score)}${abroad}`)));
    b.disabled = Boolean(block);
    box.append(b);
  }
  if (block) box.append(el('p', 'note', block));
  box.append(el('p', 'sub', L('선수가 거절하면 만족 -2, 이번 이적 기간에는 다시 임대를 보낼 수 없습니다.', "If he says no, morale -2 and you can't try another loan this window.")));
}

// 소속이 아닌 선수: 스카우트 보내기와 관심 목록
function scoutActions(box, p) {
  const [lo, hi] = potRange(p);
  box.append(el('h2', 'section', L('스카우트', 'Scouting')));
  if (lo === hi) box.append(el('p', 'sub', ageOf(p) > TUNE.potAgeMax ? L(`${TUNE.potAgeMax}세가 넘어 잠재력이 다 드러났습니다.`, `He's over ${TUNE.potAgeMax}, so his potential is plain to see.`) : L('스카우트 보고서로 잠재력을 정확히 압니다.', 'Your scouting reports give you his exact potential.')));
  else {
    const left = TUNE.potWidth.length - 1 - Math.min(scoutCount(p), TUNE.potWidth.length - 1);
    const b = actButton('btn wide option', 'scout', p.s);
    b.append(el('span', 'opt-title', L('스카우트 보내기 (1 AP)', 'Send a scout (1 AP)')), el('span', 'opt-sub', L(`지금 ${lo}~${hi} · ${left}번 더 보내면 정확히 압니다`, `Now ${lo}–${hi} · ${pl(left, 'more report')} to know exactly`)));
    const block = scoutBlock(p);
    b.disabled = Boolean(block);
    const alumni = alumniKnow(p) ? L(` ${p.nat.name}에서 스카우트로 일하는 옛 선수 덕분에 한 번 더 본 것처럼 보입니다.`, ` A former client scouting in ${p.nat.name} counts as one extra report.`) : '';
    box.append(el('p', 'sub', L(`잠재력은 범위로만 보입니다. 스카우트를 보낼수록 좁아지고, 영입하면 정확히 압니다.${alumni}`, `Potential only shows as a range. Each scout narrows it, and signing him reveals it exactly.${alumni}`)), b);
    if (block) box.append(el('p', 'note', block));
  }
  const watched = state.watch.includes(cooldownKey(p));
  box.append(actButton('btn wide', 'watch', p.s, watched ? L('★ 관심 선수에서 빼기', '★ Remove from watch list') : L(`☆ 관심 선수에 넣기 (${state.watch.length}/${TUNE.watchMax})`, `☆ Add to watch list (${state.watch.length}/${TUNE.watchMax})`)));
}

function renderPlayer(root, s) {
  const p = getPlayer(s);
  const client = clientOf(s);
  const wage = client ? client.wage : weeklyWage(p.ability);
  const head = el('div', 'detail-head');
  head.append(posTag(p.pos), el('h1', 'title', p.name), el('span', 'abil', String(p.ability)));
  root.append(actButton('back', 'up', undefined, BACK()), head,
    el('p', 'sub', `${L(`${ageOf(p)}세`, `Age ${ageOf(p)}`)} · ${p.nat.name} · ${clubLine(client, p)}`), abilityBar(p.ability));
  const info = el('div', 'stats detail-stats');
  // 13단계: 구단 수준과 그 구단에서의 출전 확률(폼 보통 기준)을 보여 줌 (출전·재계약·제안이 모두 이 차이로 정해짐)
  const level = clubLevel(p.club);
  info.append(stat(L('잠재력', 'Potential'), potText(p)), stat(L('폼', 'Form'), formNode(p)), stat(L('지난 시즌 평균 폼', 'Avg form last season'), (state.world.favg[s] / 2).toFixed(1)),
    stat(L('몸값', 'Value'), money(valueOf(p))), stat(L('주급', 'Wage'), cash(wage)), stat(L('계약 만료', 'Contract'), contractNode(client ? client.end : contractEnd(p, absWeek()))),
    stat(L('구단 수준', 'Club level'), String(Math.round(level))), stat(L('출전 확률', 'Starts'), `${Math.round(startChance(p.ability, level, 5.5) * 100)}%`));
  if (client) info.append(stat(L('만족', 'Morale'), satNode(client)));
  root.append(info);
  if (client && outText(client)) root.append(el('p', client.out.k === 'inj' ? 'note bad' : 'note', client.out.k === 'inj'
    ? L(`부상 중입니다. ${client.out.w - absWeek()}주 뒤부터 다시 뛸 수 있습니다.`, `He is injured and can play again in ${pl(client.out.w - absWeek(), 'week')}.`)
    : L('가족 일로 휴가 중이라 이번 주 경기에 빠집니다.', "He is on family leave and misses this week's games.")));
  if (client) root.append(el('h2', 'section', L('선수와의 관계', 'Your relationship')), bondBlock(client));

  root.append(el('h2', 'section', L(`${state.season}시즌 기록`, `Season ${state.season} stats`)), statsTable(client ? client.st : worldStats(p, state.week), p.club, p.nat, true),
    el('p', isNationalPick(p) ? 'sub up' : 'sub', nationalLine(p)));
  if (client && client.hist.length) root.append(el('h2', 'section', L('지난 기록', 'Career history')), careerTable(client.hist, p.nat));
  root.append(el('h2', 'section', L('성향과 원하는 조건', 'Priorities and wishes')), prefsBlock(p, client));

  const box = el('div', 'detail-actions');
  if (client) clientActions(box, client, p);
  else {
    scoutActions(box, p);
    const block = recruitBlock(p);
    const b = actButton('btn primary', 'recruit', s, L('영입 제안 (1 AP)', 'Make an offer (1 AP)'));
    b.disabled = Boolean(block);
    const plus = [state.invest.scout ? L(`스카우트망 +${TUNE.scoutRecruit[state.invest.scout]}%p`, `scouting network +${TUNE.scoutRecruit[state.invest.scout]} pts`) : '', introActive(p) ? L(`내 선수의 소개 +${TUNE.introBonus}%p`, `your client's introduction +${TUNE.introBonus} pts`) : ''].filter(Boolean).join(', ');
    box.append(el('p', 'sub', L(`영입 비용 ${cash(recruitCost(p))} · 성공 확률 ${recruitChance(p)}%${plus ? ` (${plus} 포함)` : ''} · 계약하면 수수료 주 ${cash(commissionOf(wage))}`,
      `Cost ${cash(recruitCost(p))} · success ${recruitChance(p)}%${plus ? ` (incl. ${plus})` : ''} · commission ${cash(commissionOf(wage))}/wk if he signs`)), b);
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
  head.append(el('strong', '', t.name), el('span', lv ? 'badge mine' : 'badge', L(`${lv}/${steps.length}단계`, `Level ${lv}/${steps.length}`)));
  box.append(head, el('p', 'sub', t.desc), el('p', 'panel-line', lv ? L(`지금: ${t.fx(lv)} · 유지비 주 ${cash(steps[lv - 1][1])}`, `Now: ${t.fx(lv)} · upkeep ${cash(steps[lv - 1][1])}/wk`) : L('지금: 투자 안 함', 'Now: not invested')));
  if (lv < steps.length) {
    const [cost, upkeep] = steps[lv];
    const block = investBlock(key);
    const b = actButton('btn wide option', 'invest', i);
    b.append(el('span', 'opt-title', L(`${lv + 1}단계로 올리기 · ${cash(cost)}`, `Upgrade to level ${lv + 1} · ${cash(cost)}`)), el('span', 'opt-sub', L(`${t.fx(lv + 1)} · 유지비 주 ${cash(upkeep)}`, `${t.fx(lv + 1)} · upkeep ${cash(upkeep)}/wk`)));
    b.disabled = Boolean(block);
    box.append(b);
    if (block) box.append(el('p', 'note', block));
  }
  if (lv) box.append(actButton('btn wide', 'downgrade', i, lv > 1 ? L(`${lv - 1}단계로 줄이기 (유지비 주 ${cash(steps[lv - 2][1])})`, `Drop to level ${lv - 1} (upkeep ${cash(steps[lv - 2][1])}/wk)`) : L('투자 그만두기 (유지비 없음)', 'Stop investing (no upkeep)')));
  return box;
}

function moneyPanel() {
  const box = el('div', 'panel');
  box.append(el('strong', '', L(`배당: 법인 → 개인 (세금 ${Math.round(TUNE.tax * 100)}%)`, `Dividend: company → you (tax ${Math.round(TUNE.tax * 100)}%)`)),
    el('p', 'sub', L(`배당할 수 있는 돈 ${cash(dividendRoom())} · 운영 자금 ${TUNE.reserveWeeks}주치(${cash(weeklySpend() * TUNE.reserveWeeks)})는 법인에 남깁니다.`, `Available ${cash(dividendRoom())} · ${pl(TUNE.reserveWeeks, 'week')} of running costs (${cash(weeklySpend() * TUNE.reserveWeeks)}) stays in the company.`)));
  [25, 50, 100].forEach(share => {
    const amount = dividendAmount(share);
    const b = actButton('btn wide option', 'dividend', share);
    b.append(el('span', 'opt-title', L(`${share === 100 ? '전부' : `${share}%`} 배당 · ${cash(amount)}`, `Pay out ${share === 100 ? 'all' : `${share}%`} · ${cash(amount)}`)), el('span', 'opt-sub', L(`세금 ${cash(amount - afterTax(amount))} · 개인 자금 +${cash(afterTax(amount))}`, `Tax ${cash(amount - afterTax(amount))} · personal cash +${cash(afterTax(amount))}`)));
    b.disabled = amount <= 0 || state.over;
    box.append(b);
  });
  if (state.personalCash > 0) {
    box.append(el('strong', 'panel-gap', L('개인 자금을 법인에 넣기 (세금 없음)', 'Put your own money into the company (no tax)')));
    [50, 100].forEach(share => {
      const amount = injectAmount(share);
      const b = actButton('btn wide', 'inject', share, L(`${share === 100 ? '전부' : '절반'} 넣기 · ${cash(amount)}`, `Put in ${share === 100 ? 'all' : 'half'} · ${cash(amount)}`));
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
    const short = !owned && state[walletKey()] < TUNE.itemPrice[i] ? L(` · ${state.founded ? '개인 ' : ''}자금 부족`, ` · not enough ${state.founded ? 'personal ' : ''}cash`) : '';
    const b = rowButton('item', i, itemName(i), L(`${money(TUNE.itemPrice[i])} · 평판 +${TUNE.itemRep[i]}${short}`, `${money(TUNE.itemPrice[i])} · reputation +${TUNE.itemRep[i]}${short}`), owned ? L('보유', 'Owned') : '');
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
  root.append(el('h1', 'title', L('에이전시 (아직 혼자)', 'Agency (still solo)')),
    el('p', 'sub', L(`회사 없이 혼자 일합니다. 선수는 ${TUNE.soloLimit}명까지, 손이 모자라 한 주에 AP ${TUNE.soloAp}만 쓰고, 운영비는 전화·교통비 정도입니다. 지금 자금은 모두 내 돈입니다.`,
      `You work alone, without a company. You can manage ${TUNE.soloLimit} players, you only have ${TUNE.soloAp} AP a week, and your costs are little more than phone bills and travel. All the cash is your own.`)));
  const flow = el('div', 'panel');
  flow.append(el('strong', net < 0 ? 'bad' : 'up', L(`주간 수지 ${signedCash(net)}`, `Weekly balance ${signedCash(net)}`)), el('p', 'panel-line', L(`수수료 ${cash(income)} - 운영비 ${cash(upkeepNow())}`, `Commission ${cash(income)} - running costs ${cash(upkeepNow())}`)));
  const box = el('div', 'panel');
  box.append(el('strong', '', L('에이전시 세우기', 'Found your agency')),
    el('p', 'sub', L(`세우면 주당 AP가 ${TUNE.soloAp}에서 ${TUNE.ap}로, 소속 한도가 ${TUNE.limitBase}명(평판이 오르면 더)이 되고 법인 투자·배당이 열립니다. 운영비는 주 ${cash(companyUpkeep())}(지금 선수 기준)로 오릅니다. 설립비를 낸 나머지 돈은 회사 자본금이 됩니다.`,
      `Founding raises your AP from ${TUNE.soloAp} to ${TUNE.ap} a week and your roster limit to ${TUNE.limitBase} (more as your reputation grows), and opens investments and dividends. Running costs rise to ${cash(companyUpkeep())} a week (for your current players). Whatever is left after the setup fee becomes company capital.`)));
  const checks = el('div', 'checks');
  for (const ch of foundChecks()) checks.append(el('p', ch.ok ? 'check ok' : 'check no', `${ch.ok ? '✓' : '✗'} ${ch.text}`));
  const b = actButton('btn wide option', 'found');
  b.append(el('span', 'opt-title', L(`에이전시 세우기 · 설립비 ${cash(TUNE.foundCost)}`, `Found the agency · setup fee ${cash(TUNE.foundCost)}`)), el('span', 'opt-sub', L(`함께해 온 선수들이 따라옵니다 (유대 +${TUNE.bondFound})`, `The players who've been with you come along (bond +${TUNE.bondFound})`)));
  b.disabled = Boolean(foundBlock());
  box.append(checks, b);
  root.append(flow, box, el('h2', 'section', L('개인 아이템', 'Personal items')),
    el('p', 'sub', L('지금은 내 돈으로 바로 삽니다. 살 때 평판이 오르고, 평판이 높을수록 덜 오릅니다. 설립 조건의 평판을 채우는 데도 씁니다.', 'For now you buy them with your own money. Each one raises your reputation (less as it gets higher), which also helps you meet the founding conditions.')), itemList());
  appendAlumni(root);
}

// 은퇴 후 스카우트로 합류한 옛 선수 (있을 때만)
function appendAlumni(root) {
  if (!state.alumni.length) return;
  const box = el('div', 'panel');
  box.append(el('strong', '', L(`옛 선수 스카우트 ${state.alumni.length}/${TUNE.alumniMax}명`, `Former clients scouting for you ${state.alumni.length}/${TUNE.alumniMax}`)),
    el('p', 'sub', L('은퇴한 뒤 고향에서 스카우트로 일하며, 그 나라 유망주를 한 번 더 봐 줍니다.', 'After retiring they scout back home and give you an extra look at prospects there.')));
  for (const a of state.alumni) box.append(el('p', 'panel-line', L(`${storedName(a.name, a.nk)} · ${COUNTRY_BY_ID[a.nat]?.name ?? ''} · ${a.season}시즌에 은퇴`, `${storedName(a.name, a.nk)} · ${COUNTRY_BY_ID[a.nat]?.name ?? ''} · retired in season ${a.season}`)));
  root.append(el('h2', 'section', L('옛 선수', 'Former clients')), box);
}

function renderAgency(root) {
  if (!state.founded) return renderSolo(root);
  const income = weeklyIncome();
  const upkeep = upkeepNow();
  const fixed = investUpkeep();
  const net = income - upkeep - fixed;
  root.append(el('h1', 'title', L('에이전시', 'Agency')),
    el('p', 'sub', L(`법인 자금 ${cash(state.agencyCash)} · 개인 자금 ${cash(state.personalCash)} · 개인 자산 ${money(netWorth())} (개인 자금 + 아이템)`, `Company cash ${cash(state.agencyCash)} · personal cash ${cash(state.personalCash)} · net worth ${money(netWorth())} (personal cash + items)`)));
  const flow = el('div', 'panel');
  flow.append(el('strong', net < 0 ? 'bad' : 'up', L(`주간 수지 ${signedCash(net)}`, `Weekly balance ${signedCash(net)}`)),
    el('p', 'panel-line', L(`수수료 ${cash(income)} - 운영비 ${cash(upkeep)} - 투자 유지비 ${cash(fixed)}`, `Commission ${cash(income)} - running costs ${cash(upkeep)} - investment upkeep ${cash(fixed)}`)));
  if (net < 0) flow.append(el('p', 'note', L('매주 적자입니다. 투자 단계를 낮추거나 개인 자금을 법인에 넣어 파산을 막으세요.', "You're losing money every week. Scale back investments or put in personal cash to avoid bankruptcy.")));
  root.append(flow, el('h2', 'section', L('법인 투자', 'Company investments')),
    el('p', 'sub', L('도입비는 한 번, 유지비는 매주 법인 자금에서 나갑니다. 단계를 낮추면 유지비가 줄지만 도입비는 돌려받지 못합니다.', 'Setup is paid once and upkeep every week from company cash. Scaling back lowers upkeep, but setup costs are never refunded.')));
  INVEST_KEYS.forEach((key, i) => root.append(investCard(key, i)));
  root.append(el('h2', 'section', L('자금 옮기기', 'Move money')), moneyPanel(), el('h2', 'section', L('개인 아이템', 'Personal items')),
    el('p', 'sub', L('개인 자금으로 삽니다. 살 때 평판이 오르고, 평판이 높을수록 덜 오릅니다.', 'Bought with personal cash. Each one raises your reputation, by less as it gets higher.')), itemList());
  appendAlumni(root);
}

function renderLog(root) {
  root.append(el('h1', 'title', L('기록', 'Log')));
  const k = state.stats;
  root.append(el('p', 'sub', L(`에이전시 기록: 영입 ${k.signed}명 · 이적 ${k.transfers}건(꿈의 구단 ${k.dream}건) · 재계약 ${k.renewWin}/${k.renewTry}건 성공 · 국가대표 소집 ${k.callups}번 · 떠난 선수 ${k.lost}명`,
    `Agency record: ${k.signed} signed · ${pl(k.transfers, 'transfer')} (dream clubs: ${k.dream}) · ${k.renewWin}/${k.renewTry} renewals done · ${pl(k.callups, 'call-up')} · ${k.lost} lost`)));
  if (state.summary) root.append(actButton('btn', 'summary', undefined, L(`${state.summary.season}시즌 결산 다시 보기`, `Review season ${state.summary.season}`)));
  const list = el('ol', 'log');
  state.logs.forEach(line => list.append(el('li', '', line)));
  root.append(list, el('h2', 'section', L('언어 · Language', 'Language · 언어')));
  // 언어는 기기 설정 (세이브와 따로). 기록 목록은 쓰던 때의 언어로 남음
  const langs = el('div', 'segment');
  langs.append(segButton('lang', 0, '한국어', LANG === 'ko'), segButton('lang', 1, 'English', LANG === 'en'));
  root.append(langs, el('p', 'sub', L('기록 목록은 그때의 언어로 남습니다. 선수 이름·구단·뉴스·인연은 바로 바뀝니다.', 'Past log entries stay in the language they were written in. Names, clubs, news and stories switch right away.')));
  // 16단계 움직임 설정 (기기 설정이라 세이브와 따로)
  const moves = el('div', 'segment');
  moves.append(segButton('motion', 0, L('켜기', 'On'), motionPref === 'on'), segButton('motion', 1, L('줄이기', 'Reduced'), motionPref === 'reduce'));
  root.append(el('h2', 'section', L('움직임', 'Motion')), moves, el('p', 'sub', systemCalm() ? L('기기 설정에서 동작 줄이기가 켜져 있어 움직임을 줄입니다.', 'Your device asks for reduced motion, so animations are kept to a minimum.')
    : L('화면이 바뀔 때 밀려 들어오고, 다음 주에 날짜와 자금이 움직이고, 우승 같은 순간에 축하 띠가 내려옵니다.', 'Screens slide in, the date and cash move when you advance a week, and big moments like trophies drop in a banner.')));
  root.append(el('h2', 'section', L('저장', 'Saving')));
  root.append(el('p', 'sub', L('진행 상황은 이 브라우저에 자동으로 저장됩니다. iPhone Safari는 7일 동안 이 사이트를 쓰지 않으면 저장을 지울 수 있으니, 홈 화면에 추가하거나 파일로 내보내 두세요.',
    "Progress saves automatically in this browser. iPhone Safari may clear it if you don't visit for 7 days, so add the game to your home screen or export a file.")));
  const actions = el('div', 'actions');
  actions.append(actButton('btn', 'export', undefined, L('파일로 내보내기', 'Export file')), actButton('btn', 'import', undefined, L('파일 불러오기', 'Import file')), actButton('btn danger', 'new', undefined, L('새 게임', 'New game')));
  root.append(actions);
  if (readBackup()) {
    root.append(el('p', 'sub', L('읽지 못했던 이전 세이브가 백업되어 있습니다. 파일로 받아 두면 나중에 복구를 시도할 수 있습니다.', 'An earlier save that could not be read is backed up. Download it so you can try to recover it later.')),
      actButton('btn', 'backup', undefined, L('이전 세이브 백업 내보내기', 'Export backed-up save')));
  }
}

// index.html에 고정으로 있는 글: 언어에 맞게 (한국어 글은 html에 그대로 있음)
// 다음 주 버튼: "Next week ▶"는 103px라 360~390px 폰의 버튼(글자 칸 73~81px)에서 두 줄이 됨 → 보이는 글은 "Next ▶", 읽어 주는 이름은 "Next week"
const STATIC_TEXT = [['.tab[data-tab=world]', '리그', 'Leagues'], ['#tab-agency', '에이전시', 'Agency'], ['.tab[data-tab=log]', '기록', 'Log'], ['#btn-next', '다음 주 ▶', 'Next ▶'],
  ['#summary-close', '확인', 'OK'], ['#gameover-title', '에이전시 파산', 'Agency bankrupt'], ['#gameover-new', '새 게임 시작', 'Start a new game'], ['#gameover-close', '기록만 보기', 'Just view the log'],
  ['#scene-close', '나중에 답하기', 'Answer later']];
function applyStaticText() {
  document.documentElement.lang = LANG;
  for (const [sel, ko, en] of STATIC_TEXT) {
    const node = document.querySelector(sel);
    if (node) node.textContent = L(ko, en);
  }
  const rep = $('hdr-rep');
  if (rep && rep.previousSibling) rep.previousSibling.textContent = L('평판 ', 'Rep ');
  const nav = document.querySelector('.bottombar');
  if (nav) nav.setAttribute('aria-label', L('메뉴', 'Menu'));
  const next = $('btn-next');
  if (next) next.setAttribute('aria-label', L('다음 주', 'Next week'));
}

// ===== 8-1. 움직임 (16단계, 시안 B "경기 하이라이트") =====
// 화면 이동은 짧게 밀려 들어옴(앞으로 → 오른쪽에서, 뒤로 → 왼쪽에서, 탭 → 아래에서 살짝)과 목록 줄줄이, 막대는 차오르고 하트는 하나씩.
// 다음 주를 누르면 버튼에 빛이 지나가고 날짜가 넘어가며 자금이 숫자로 움직이고 바뀐 만큼이 떠오름. 내 선수 우승·승격·첫 국가대표 같은 순간은
// 위에서 내려오는 축하 띠(강등은 차분한 띠). 답한 소식 카드는 옆으로 빠짐. 하단 탭은 선택 표시가 미끄러짐.
// transform·opacity만 움직여 폰에서 가볍게. 기기 "동작 줄이기"나 기록 탭 "움직임 줄이기"면 모두 멈춤(문서에 calm 클래스)
const MOTION_KEY = 'be-the-agent:motion';
let motionPref = 'on'; // 'on' | 'reduce' (기기 설정이라 세이브와 따로)
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const systemCalm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionOn = () => motionPref === 'on' && !systemCalm() && typeof document !== 'undefined' && typeof document.documentElement.animate === 'function';
function initMotion() {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    if (v === 'on' || v === 'reduce') motionPref = v;
  } catch (e) {
    // 저장소를 못 쓰면 켬
  }
  document.documentElement.classList.toggle('calm', !motionOn());
}
function setMotion(v) {
  motionPref = v;
  try {
    localStorage.setItem(MOTION_KEY, v);
  } catch (e) {
    // 이번 방문 동안만
  }
  document.documentElement.classList.toggle('calm', !motionOn());
}

let nextMotion = '';     // 다음 render()의 화면 움직임: 'forward' · 'back' · 'tab' · 'boot' · 'week' (빈 문자열 = 그 자리에서 다시 그림)
let shown = null;        // 상단 바에 마지막으로 보여 준 값 { cash, rep, ap, date }
let lastDepth = 0;       // 브라우저 기록 깊이 (뒤로가기인지 앞으로가기인지)
const hdrAnims = [];     // 상단 바 숫자 움직임 (다시 그리면 멈춤)
const counters = new Set();

// 화면이 바뀔 때: 화면 전체가 밀려 들어오고, 위쪽 10개 줄은 줄줄이, 막대는 왼쪽부터 차오르고 켜진 하트는 하나씩
function playScreen(root, kind) {
  const from = { forward: 'translateX(28px)', back: 'translateX(-28px)', tab: 'translateY(10px)', boot: 'translateY(6px)', week: 'none' }[kind] || 'none';
  if (from !== 'none') root.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: kind === 'back' ? 200 : 240, easing: EASE });
  const items = [...root.children].filter(n => !n.matches('.back, .title, h1, .home-head, .market, p.sub'))
    .flatMap(n => (n.matches('.list, .ltable') ? [...n.children] : [n])).slice(0, kind === 'week' ? 6 : 10);
  items.forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: (kind === 'week' ? 20 : 60) + i * 30, easing: EASE, fill: 'backwards' }));
  if (kind === 'week') return;
  root.querySelectorAll('.bar > i').forEach(i => i.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 520, delay: 120, easing: EASE, fill: 'backwards' }));
  root.querySelectorAll('.hearts .on').forEach((h, i) => h.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.7 }, { transform: 'scale(1)' }],
    { duration: 360, delay: 220 + i * 90, easing: EASE, fill: 'backwards' }));
}

// 자금 숫자가 from → to로 움직임 (끝으로 갈수록 느려짐). 진행은 보이지 않는 움직임의 시간으로 정해서 멈춰 찍을 수 있음(window.__motionTick)
function countUp(node, from, to, ms) {
  const anim = node.animate([{ opacity: 1 }, { opacity: 1 }], { duration: ms });
  hdrAnims.push(anim);
  const step = () => {
    const p = anim.effect.getComputedTiming().progress;
    node.textContent = cash(p === null ? to : from + (to - from) * (1 - (1 - p) ** 3));
    if (anim.playState === 'running') requestAnimationFrame(step);
  };
  counters.add(step);
  const done = () => counters.delete(step);
  anim.finished.then(() => ((node.textContent = cash(to)), done()), done);
  step();
}
if (typeof window !== 'undefined') window.__motionTick = () => counters.forEach(f => f());

// 바뀐 자금이 자금 아래에서 떠올랐다 사라짐 (+는 초록, -는 빨강)
function floatDelta(node, delta) {
  const bar = node.closest('.topbar');
  if (!bar) return;
  const r = node.getBoundingClientRect();
  const br = bar.getBoundingClientRect();
  const chip = el('span', `float-delta ${delta < 0 ? 'down' : 'up'}`, signedCash(delta));
  chip.setAttribute('aria-hidden', 'true');
  chip.style.left = `${r.left - br.left + r.width / 2}px`;
  chip.style.top = `${r.bottom - br.top}px`;
  bar.append(chip);
  const a = chip.animate([{ opacity: 0, transform: 'translate(-50%, 0)' }, { opacity: 1, transform: 'translate(-50%, 8px)', offset: 0.2 }, { opacity: 1, transform: 'translate(-50%, 12px)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%, 22px)' }],
    { duration: 1300, easing: 'ease-out' });
  hdrAnims.push(a);
  a.finished.then(() => chip.remove(), () => chip.remove());
}
const pulse = node => hdrAnims.push(node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], { duration: 340, easing: EASE }));
const flipIn = node => hdrAnims.push(node.animate([{ opacity: 0, transform: 'translateY(70%)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: EASE }));

// 상단 바 숫자가 바뀌었으면 움직임 (첫 화면과 움직임을 줄였을 때는 바로)
function headerMotion(week) {
  for (const a of hdrAnims.splice(0)) a.cancel();
  document.querySelectorAll('.topbar .float-delta').forEach(x => x.remove());
  const now = { cash: state.agencyCash, rep: state.rep, ap: state.ap, date: state.season * 100 + state.week };
  if (shown && motionOn()) {
    if (now.cash !== shown.cash) {
      countUp($('hdr-cash'), shown.cash, now.cash, week ? 700 : 360);
      floatDelta($('hdr-cash'), now.cash - shown.cash);
    }
    if (now.rep !== shown.rep) pulse($('hdr-rep'));
    if (now.ap !== shown.ap) pulse($('hdr-ap'));
    if (now.date !== shown.date) flipIn($('hdr-date'));
  }
  shown = now;
}

// 하단 탭 선택 표시: 고른 탭 뒤 둥근 바탕이 미끄러져 옴 (뉴스 화면처럼 탭이 없는 화면에서는 숨김)
function placePill() {
  const pill = document.querySelector('.tab-pill');
  if (!pill) return;
  const tab = document.querySelector('.tab[aria-current="page"]');
  pill.style.opacity = tab ? '1' : '0';
  if (!tab) return;
  pill.style.width = `${tab.offsetWidth}px`;
  pill.style.height = `${tab.offsetHeight}px`;
  pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
}

// 다음 주 버튼에 빛이 한 번 지나감
function sweepNext() {
  if (motionOn()) $('btn-next').animate([{ backgroundPosition: '150% 0' }, { backgroundPosition: '-50% 0' }], { duration: 520, easing: 'ease-out' });
}

// 내 선수의 큰 순간: 위에서 내려오는 띠 (축하는 색종이와 함께, 강등은 차분하게). 누르면 닫히고, 3.4초 뒤 저절로 닫힘
const MOMENT_KINDS = { cont: ['대륙 정상!', 'Continental champions!'], champ: ['리그 우승!', 'League champions!'], cup: ['컵 우승!', 'Cup winners!'],
  up: ['승격!', 'Promoted!'], call: ['첫 국가대표!', 'First call-up!'], down: ['강등', 'Relegated'] };
function pickMoment(fresh) {
  for (const k of Object.keys(MOMENT_KINDS)) {
    const n = fresh.find(x => x.k === k && (x.my || k === 'call'));
    if (n) return n;
  }
  return null;
}
function showMoment(n) {
  document.querySelectorAll('.moment').forEach(x => x.remove());
  const box = el('div', `moment${n.k === 'down' ? ' bad' : ''}`);
  box.setAttribute('role', 'status');
  box.append(el('strong', 'moment-title', L(...MOMENT_KINDS[n.k])), el('span', 'moment-text', newsText(n).text));
  document.body.append(box);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (!motionOn()) return box.remove();
    box.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, -10px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(() => box.remove(), () => box.remove());
  };
  box.addEventListener('click', close);
  setTimeout(close, 3400);
  if (!motionOn()) return;
  box.animate([{ opacity: 0, transform: 'translate(-50%, -18px) scale(0.96)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }], { duration: 300, easing: EASE });
  if (n.k === 'down') return;
  const colors = ['var(--accent)', 'var(--warn)', 'var(--warm)', 'var(--pos-MF)'];
  for (let i = 0; i < 16; i++) {
    const dot = el('span', 'confetti');
    dot.style.background = colors[i % colors.length];
    box.append(dot);
    const a = (i / 16) * Math.PI * 2;
    const d = 70 + (i % 3) * 26;
    dot.animate([{ opacity: 1, transform: 'translate(-50%, -50%) scale(0.5)' }, { opacity: 0, transform: `translate(calc(-50% + ${Math.round(Math.cos(a) * d)}px), calc(-50% + ${Math.round(Math.sin(a) * d * 0.55)}px)) rotate(${i * 45}deg) scale(1)` }],
      { duration: 950, delay: 120, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'backwards' }).finished.then(() => dot.remove(), () => dot.remove());
  }
}

// 답한 소식 카드는 옆으로 빠진 뒤 처리 (그동안 다른 버튼은 막음)
let motionBusy = false;
function dismissThen(card, run) {
  motionBusy = true;
  card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(28px) scale(0.98)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' })
    .finished.then(run, run).finally(() => (motionBusy = false));
}

function render() {
  renderHeader();
  const week = nextMotion === 'week';
  headerMotion(week);
  const root = $('view');
  root.replaceChildren();
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === state.ui.tab ? 'page' : 'false'));
  // 탭이 4개라 소식 수는 글자 대신 모서리 배지로 (360px 폰에서 줄바꿈 방지)
  applyStaticText();
  const clientsTab = document.querySelector('.tab[data-tab=clients]');
  clientsTab.textContent = L('내 선수', 'Players');
  clientsTab.setAttribute('aria-label', state.events.length ? L(`내 선수, 소식 ${state.events.length}건`, `Players, ${pl(state.events.length, 'news item')}`) : L('내 선수', 'Players'));
  if (state.events.length) clientsTab.append(el('span', 'count', String(state.events.length)));
  placePill();
  if (state.ui.player !== null) renderPlayer(root, state.ui.player);
  else if (state.ui.tab === 'world') renderWorld(root);
  else if (state.ui.tab === 'agency') renderAgency(root);
  else if (state.ui.tab === 'log') renderLog(root);
  else if (state.ui.tab === 'news') renderNews(root);
  else renderClients(root);
  if (nextMotion && motionOn()) playScreen(root, nextMotion);
  nextMotion = '';
}

// 13단계 결산 창 한 줄: "잉글랜드 2부 우승 · 1부 승격 · 컵 우승" (예전 세이브나 리그에서 못 뛴 선수는 빈 문자열)
function finText(fin) {
  const country = fin && Number.isInteger(fin.c) ? COUNTRIES[fin.c] : null;
  if (!country || !Number.isInteger(fin.t) || !Number.isInteger(fin.rk) || !Array.isArray(fin.tr)) return '';
  const title = fin.rk === 1 && fin.tr.includes(`L${fin.t}`);
  const parts = [title ? L(`${country.name} ${fin.t + 1}부 우승`, `${country.name} Div. ${fin.t + 1} champions`) : L(`${country.name} ${fin.t + 1}부 ${fin.rk}위`, `${ordinal(fin.rk)} in ${country.name} Div. ${fin.t + 1}`)];
  if (fin.ln) parts[0] += L(' (임대)', ' (on loan)');
  if (fin.mv === 1) parts.push(L(`${fin.t}부로 승격`, `promoted to Div. ${fin.t}`));
  if (fin.mv === -1) parts.push(L(`${fin.t + 2}부로 강등`, `relegated to Div. ${fin.t + 2}`));
  for (const tr of fin.tr) {
    if (title && tr === `L${fin.t}`) continue;
    parts.push(tr === 'C' ? L('컵 우승', 'Cup winners') : tr === 'K' ? L('대륙 대회 우승', 'continental champions') : L(`${Number(tr.slice(1)) + 1}부 우승`, `Div. ${Number(tr.slice(1)) + 1} champions`));
  }
  return parts.join(' · ');
}

// 시즌 결산 창
function openSummary() {
  const sm = state.summary;
  if (!sm) return;
  $('summary-title').textContent = L(`${sm.season}시즌 결산`, `Season ${sm.season} review`);
  const list = el('ul', 'summary-list');
  for (const row of sm.rows) {
    const li = el('li');
    const name = storedName(row.name, row.nk);
    li.append(el('strong', '', name));
    if (row.retired) {
      li.append(el('span', 'down', L(` ${row.ageFrom}세에 은퇴`, ` retired at ${row.ageFrom}`)));
      // 은퇴식: 오래 함께한 선수가 고마움을 전하고, 유대가 아주 깊으면 스카우트로 합류
      if (row.farewell) {
        const nat = COUNTRY_BY_ID[row.nat];
        li.append(el('span', 'summary-stats warmt', L(`${row.seasons ? `${row.seasons}시즌을 함께한 ` : ''}${name} 선수가 은퇴식에서 "처음부터 곁에 있어 준 에이전트에게 고맙다"고 말했습니다${row.rep ? ` (평판 +${row.rep})` : ''}.`,
          `At his farewell, ${name}${row.seasons ? `, your client for ${pl(row.seasons, 'season')},` : ''} thanked "the agent who was there from the very start"${row.rep ? ` (reputation +${row.rep})` : ''}.`)));
        if (row.scout && nat) li.append(el('span', 'summary-stats up', L(`은퇴 후 ${nat.name} 스카우트로 합류합니다. 이제 ${nat.name} 유망주는 스카우트를 한 번 더 보낸 것처럼 보입니다.`, `He'll scout ${nat.name} for you in retirement, so prospects from ${nat.name} now count one extra scouting report.`)));
      }
    }
    else {
      const diff = row.valueTo - row.valueFrom;
      const ability = row.abilityFrom === undefined ? '' : L(` · 능력 ${row.abilityFrom}→${row.abilityTo}`, ` · ability ${row.abilityFrom}→${row.abilityTo}`);
      li.append(L(` ${row.ageFrom}→${row.ageTo}세${ability} · 몸값 ${money(row.valueFrom)} → `, ` age ${row.ageFrom}→${row.ageTo}${ability} · value ${money(row.valueFrom)} → `), el('span', diff > 0 ? 'up' : diff < 0 ? 'down' : '', money(row.valueTo)));
      if (row.apps !== undefined) li.append(el('span', 'summary-stats', L(`리그 ${row.apps}경기 ${row.goals}골 · 평점 ${row.apps ? row.rating.toFixed(1) : '-'}${row.caps ? ` · 국가대표 ${row.caps}경기` : ''}`, `League: ${row.apps} apps, ${pl(row.goals, 'goal')} · rating ${row.apps ? row.rating.toFixed(1) : '-'}${row.caps ? ` · ${pl(row.caps, 'cap')}` : ''}`)));
    }
    // 13단계: 구단 최종 순위·승강·우승
    const fin = finText(row.fin);
    if (fin) li.append(el('span', `summary-stats ${row.fin.tr.length || row.fin.mv > 0 ? 'up' : row.fin.mv < 0 ? 'down' : ''}`, fin));
    list.append(li);
  }
  const rep = sm.repChange === undefined ? '' : L(`평판 ${sm.repChange >= 0 ? '+' : ''}${sm.repChange}. `, `Reputation ${sm.repChange >= 0 ? '+' : ''}${sm.repChange}. `);
  const coach = Number.isInteger(sm.coachGain) && sm.coachGain > 0 ? L(`피지컬 코치 덕분에 소속 선수 능력 +${sm.coachGain}. `, `Your fitness coach added +${sm.coachGain} ability across your players. `) : '';
  // 13단계: 5대 리그 1부와 대륙 대회 우승 구단
  const champs = Array.isArray(sm.champs) ? sm.champs.filter(id => CLUBS[id]) : [];
  const contWin = Array.isArray(sm.contWin) ? sm.contWin.filter(id => CLUBS[id]) : [];
  const world = [];
  if (champs.length) world.push(el('p', 'sub', L(`5대 리그 우승: ${champs.map(id => `${CLUBS[id].country.name} ${CLUBS[id].name}`).join(' · ')}.`, `Big Five champions: ${champs.map(id => `${CLUBS[id].name} (${CLUBS[id].country.name})`).join(' · ')}.`)));
  if (contWin.length) world.push(el('p', 'sub', L(`대륙 대회 우승: ${contWin.map(id => `${regionName(contGroup(CLUBS[id].country.region))} ${CLUBS[id].name}`).join(' · ')}.`, `Continental champions: ${contWin.map(id => `${CLUBS[id].name} (${regionName(contGroup(CLUBS[id].country.region))})`).join(' · ')}.`)));
  $('summary-body').replaceChildren(list, el('p', 'sub', L(`${rep}${coach}세계에서 ${num(sm.retired)}명이 은퇴하거나 떠나고 새 선수가 들어왔습니다.`, `${rep}${coach}Around the world, ${num(sm.retired)} players retired or left and new ones arrived.`)), ...world);
  const dialog = $('summary');
  if (!dialog.open) dialog.showModal();
}

// 파산 창
function openGameOver() {
  $('gameover-body').textContent = L(`자금 마이너스가 ${DEBT_LIMIT}주 이어져 ${state.season}시즌 ${state.week}주에 파산했습니다. 마지막 평판 ${state.rep}, 소속 선수 ${state.clients.length}명.`,
    `After ${DEBT_LIMIT} weeks in the red, the agency went bankrupt in season ${state.season}, week ${state.week}. Final reputation ${state.rep}, ${pl(state.clients.length, 'player')} on the books.`);
  const dialog = $('gameover');
  if (!dialog.open) dialog.showModal();
}

function startNewGame() {
  newGame();
  resetHistory();
  nextMotion = 'boot';
  render();
  window.scrollTo(0, 0);
  toast(L('새 게임을 시작했습니다.', 'A new game has started.'));
}

// ===== 화면 이동: 브라우저(안드로이드) 뒤로가기와 연결 =====
const historyDepth = () => (history.state && Number.isInteger(history.state.depth) ? history.state.depth : 0);

function resetHistory() {
  history.replaceState({ ui: { ...state.ui }, depth: 0, scroll: 0 }, '');
  lastDepth = 0;
}

// 앞으로 이동: 지금 위치의 스크롤을 기록해 두고 새 위치를 쌓음
function navigate(changes) {
  history.replaceState({ ...history.state, ui: { ...state.ui }, scroll: window.scrollY }, '');
  nextMotion = changes.tab !== undefined && changes.tab !== state.ui.tab ? 'tab' : 'forward';
  Object.assign(state.ui, changes);
  lastDepth = historyDepth() + 1;
  history.pushState({ ui: { ...state.ui }, depth: lastDepth, scroll: 0 }, '');
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
  nextMotion = 'back';
  render();
  window.scrollTo(0, 0);
}

function onPopState(e) {
  if (!e.state || !e.state.ui) return;
  state.ui = cleanUi(e.state.ui);
  const depth = Number.isInteger(e.state.depth) ? e.state.depth : 0;
  nextMotion = depth < lastDepth ? 'back' : 'forward';
  lastDepth = depth;
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
    if (confirm(L('진행 중인 게임을 지우고 새로 시작할까요? 되돌릴 수 없습니다.', 'Delete this game and start a new one? This cannot be undone.'))) startNewGame();
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
  if (act === 'news') return navigate({ tab: 'news', player: null });
  // 14단계 할 일 줄: 탭으로 이동 (리그 탭은 맨 위부터)
  if (act === 'goTab') return navigate(v === 1 ? { tab: 'world', player: null, country: null, tier: null, club: null } : { tab: ['clients', 'world', 'agency', 'log'][v] || 'clients', player: null });
  if (act === 'lang') return stay(() => setLang(v === 1 ? 'en' : 'ko'));
  if (act === 'motion') return stay(() => setMotion(v === 1 ? 'reduce' : 'on'));
  if (act === 'clubAt') return navigate({ tab: 'world', player: null, country: CLUBS[v].country.i, tier: CLUBS[v].t, club: v });
  if (act === 'pitch') return stay(() => pitch(v, o));
  if (act === 'loan') return stay(() => loan(v, o));
  if (act === 'region') return stay(() => (worldRegion = REGIONS[v] || REGIONS[0]));
  if (act === 'country') return navigate({ country: v, tier: null, club: null });
  if (act === 'tier') return navigate({ tier: v, club: null });
  if (act === 'club') return navigate({ club: v });
}

function bindEvents() {
  $('btn-next').addEventListener('click', () => {
    const first = state.nextEventId;
    const newsTop = state.news[0];
    sweepNext();
    const news = advanceWeek();
    nextMotion = 'week';
    render();
    // 16단계: 이번 주에 생긴 내 선수의 큰 순간 (결산·장면·파산 창이 뜨는 주에는 띠 대신 창)
    const fresh = [];
    for (const n of state.news) {
      if (n === newsTop) break;
      fresh.push(n);
    }
    const moment = pickMoment(fresh);
    // 이번 주에 새로 찾아온 관계 이야기는 장면 시트로 보여 줌 (결산 창이 뜨면 닫은 뒤에)
    sceneQueue = state.events.filter(e => e.id >= first && EVENT_TYPES[e.type].tale).map(e => e.id);
    if (state.over) openGameOver();
    else if (state.summary && !state.summary.seen) openSummary();
    else if (sceneQueue.length) openScene();
    else {
      if (moment) showMoment(moment);
      if (news) toast(L(`새 소식 ${news}건이 있습니다. 내 선수 탭에서 답해 주세요.`, `${pl(news, 'new story', 'new stories')}. Answer them in the Players tab.`));
    }
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
    if (!b || b.disabled || motionBusy) return;
    if (b.dataset.y) renewYears = Number(b.dataset.y);
    const run = () => onAction(b.dataset.act, b.dataset.v === undefined ? undefined : Number(b.dataset.v), Number(b.dataset.o));
    const card = b.dataset.act === 'event' && motionOn() ? b.closest('.news') : null;
    if (card) dismissThen(card, run);
    else run();
  });
  window.addEventListener('resize', placePill);
  $('summary-close').addEventListener('click', () => $('summary').close());
  $('summary').addEventListener('close', () => {
    if (state.summary && !state.summary.seen) {
      state.summary.seen = true;
      saveState();
    }
    openScene();
  });
  // 이야기 장면: 답을 고르면 시트를 닫고 소식 카드와 똑같이 처리, 닫으면 같은 주의 다음 이야기
  $('scene').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    $('scene').close();
    onAction(b.dataset.act, Number(b.dataset.v), Number(b.dataset.o));
  });
  $('scene-close').addEventListener('click', () => $('scene').close());
  $('scene').addEventListener('close', openScene);
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
  check(unpackArray('0z', 1, Uint8Array, 0).join() === '0,35', '예전 세이브 압축 읽기');
  // 12단계 세이브 글자: 92가지, 따옴표·역슬래시 없음, 글자 ↔ 값 왕복
  check(CODE.length === 92 && !/["\\]/.test(CODE) && [...CODE].every((ch, i) => CODE_VAL[ch.charCodeAt(0)] === i), '세이브 글자표');
  const a = getPlayer(1234), b = getPlayer(1234);
  check(a.name === b.name && a.ability === b.ability && a.pot >= a.ability && a.ability >= 40 && a.ability <= 90, '선수 생성은 결정적이고 범위를 지켜야 함');
  // 12단계 세계: 11단계까지의 구단 번호는 그대로(0~2001), 5대 리그 6부·나머지 4부, 늘린 부 선수는 능력 하한 30까지
  const deep = getPlayer(SLOTS - 1);
  check(OLD_CLUBS === 2002 && COUNTRIES.every((c, i) => c.tiers.length === (i < BIG5 ? 6 : 4) && c.clubs.length === c.tiers.length && c.clubs.every((l, t) => l.length === c.tiers[t]))
    && deep.ability >= abilityFloor(deep.s) && deep.ability <= 90, '세계 확장: 부 수·구단 수·능력 범위');
  check(contractEnd(a, absWeek() + 500) >= absWeek() + 500, '월드 선수 계약은 자동 갱신');
  check(weeklyWage(70) > weeklyWage(60) && weeklyWage(40) >= 200 && commissionOf(10000) === 800, '주급과 수수료(8%) 계산');
  check(growthStep(19, 50, 80, 5.5, 0.5) > 0 && growthStep(19, 80, 80, 5.5, 1) === 0 && growthStep(33, 70, 70, 5.5, 0.5) < 0, '성장은 잠재력까지, 30대 중반은 하락');
  check(growthStep(19, 50, 80, 9, 0.5) >= growthStep(19, 50, 80, 2, 0.5), '폼이 좋으면 더 크게 성장');
  const badUi = cleanUi({ tab: 'x', country: 999, tier: 0, club: 5, player: -1 });
  check(badUi.tab === 'clients' && badUi.country === null && badUi.tier === null && badUi.club === null && badUi.player === null, '잘못된 화면 위치는 기본값으로');
  const okUi = cleanUi({ tab: 'world', country: 0, tier: 3, club: CLUBS[0].id, player: 10 });
  check(okUi.country === 0 && okUi.tier === 3 && okUi.club === null && okUi.player === 10, '다른 부의 구단 번호는 버림');
  check(Object.values(EVENT_TYPES).every(t => t.options[t.def] && t.options.every(o => typeof o.run === 'function')), '소식마다 기본 선택지가 있어야 함');
  check(dealFee(10000) === 10400 && offerCut({ fee: 1000000, wage: 10000 }) === 30400, '계약·이적 수수료 계산');
  const tc = { end: absWeek() + 10, sat: 70, wage: 5000 };
  check(RENEW_LEVELS.every((_, i) => RENEW_YEARS.every(y => { const t = renewTerms(tc, a, i, y); return t.chance >= 10 && t.chance <= 95 && t.wage > 0; })), '재계약 확률은 10~95%');
  check(renewTerms(tc, a, 0).chance >= renewTerms(tc, a, 2).chance, '많이 요구할수록 성공 확률이 낮아야 함');
  const w1 = worldStats(a, 20), w2 = worldStats(a, 20), w3 = worldStats(a, 40);
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
  check(BOND_TIERS.every(([lo], i) => i === 0 || lo < BOND_TIERS[i - 1][0]) && bondName(0) === L('서먹함', 'Distant') && bondName(100) === L('가족 같음', 'Like family'), '유대 단계 이름');
  check(foundChecks().length === 3 && TUNE.foundCash > TUNE.foundCost && TUNE.soloLimit < TUNE.limitBase, '회사 설립: 조건 3개, 자금 조건은 설립비보다 큼, 혼자일 때 한도가 더 작음');
  // 17단계: 선수 마음에 따라 다른 유대 변화(함수)는 기억 문구도 함수
  check(Object.values(EVENT_TYPES).every(t => t.options.every(o => (typeof o.bond === 'function' ? typeof o.memo === 'function' : !o.bond || (typeof o.memo === 'string' && Math.abs(o.bond) <= 10)))), '소식 선택지의 유대 변화에는 기억 문구가 있어야 함');
  // 8단계: 관계 이야기는 필요한 유대가 낮은 순, 선수의 말과 기본 선택이 있고, 한 번 시작하면 다시 오지 않음
  check(TALE_KEYS.every((k, i) => EVENT_TYPES[k] && EVENT_TYPES[k].tale && typeof EVENT_TYPES[k].quote === 'function' && EVENT_TYPES[k].tale.need <= 100
    && (i === 0 || EVENT_TYPES[k].tale.need > EVENT_TYPES[TALE_KEYS[i - 1]].tale.need)), '관계 이야기: 필요한 유대 순서, 선수의 말');
  const tt = { s: 0, g: 0, bond: 100, sat: 50, tales: [], since: absWeek() - 4 * WEEKS };
  const readyBefore = taleReady(tt, 'wedding');
  startTale(tt, 'wedding');
  check(readyBefore && !taleReady(tt, 'wedding') && albumTile(tt, 'wedding').cls === 'now', '관계 이야기는 선수마다 한 번만');
  // 이야기 앨범 (시안 B): 고른 답의 유대 변화를 보여 주고, 답하지 않은 이야기는 흐리게, 조건을 못 채우면 잠김
  const wed = EVENT_TYPES.wedding.options;
  tt.tales[0].t = wed[0].memo;
  const done = albumTile(tt, 'wedding');
  tt.tales[0].t = `(답하지 않음) ${wed[wed.length - 1].memo}`;
  check(done.cls === 'done' && done.meta.endsWith(L(`유대 +${wed[0].bond}`, `bond +${wed[0].bond}`)) && albumTile(tt, 'wedding').cls === 'done cold'
    && albumTile(tt, 'praise').cls === 'open' && albumTile({ ...tt, bond: 0 }, 'praise').cls === 'locked', '이야기 앨범 칸 상태');
  check(TUNE.alumniBond >= TUNE.farewellBond && TUNE.introBonus > 0 && TUNE.introWeeks > 0, '은퇴식·옛 선수·후배 소개 값');
  // 9단계: 이적 기간은 여름(47~52주·1~6주)과 겨울(22~26주), 마감일은 6주·26주, 닫힌 주에는 계약 중인 선수에게 제안이 오지 않음
  const openWeeks = Array.from({ length: WEEKS }, (_, i) => windowAt(i + 1)).filter(Boolean).length;
  check(openWeeks === 17 && windowAt(47) === windowAt(6) && windowAt(26) && !windowAt(7) && !windowAt(27) && windowLeft(windowAt(6), 6) === 0
    && windowLeft(windowAt(47), 47) === 11 && windowLeft(windowAt(26), 26) === 0 && nextWindow(7).wait === 15 && nextWindow(27).wait === 20, '이적 기간·마감일 계산');
  const c0 = state.clients[0];
  if (c0) {
    const week0 = state.week;
    const contracted = { ...c0, end: absWeek() + 200, hunt: 0, loan: null }; // 임대 중이면 제안이 없으니 임대 없이 봄
    try {
      state.week = 10;
      const closed = EVENT_TYPES.offer.chance(contracted, getPlayer(c0.s));
      const free = EVENT_TYPES.offer.chance({ ...contracted, end: absWeek() - 1 }, getPlayer(c0.s));
      state.week = 25;
      const open = EVENT_TYPES.offer.chance(contracted, getPlayer(c0.s));
      state.week = 26;
      const late = EVENT_TYPES.offer.chance(contracted, getPlayer(c0.s));
      check(closed === 0 && free >= TUNE.offerFree && open > 0 && late > open, '닫힌 기간에는 무소속 선수만 제안, 마감 주에는 제안이 더 잦음');
    } finally {
      state.week = week0;
    }
  }
  // 13단계: 리그 일정은 모든 팀이 서로 홈·원정 한 번씩, 한 라운드에 한 번만. 모든 부는 짝수 팀(쉬는 팀 없음)
  check([3, 4, 10, 16, 28].every(n => {
    const rounds = roundRobin(n);
    const seen = new Set();
    const ok = rounds.length === roundsOf(n) && rounds.every(pairs => new Set(pairs.flat()).size === pairs.length * 2);
    rounds.flat().forEach(([a, b]) => seen.add(`${a}-${b}`));
    return ok && seen.size === n * (n - 1);
  }) && COUNTRIES.every(c => c.tiers.every(n => n % 2 === 0)), '리그 일정: 홈·원정 한 번씩, 라운드마다 한 경기');
  const eng = COUNTRIES[0];
  const club0 = eng.clubs[0][0];
  check(Array.from({ length: WEEKS }, (_, i) => leagueGames(club0, i + 1)).reduce((a, b) => a + b, 0) === roundsOf(eng.tiers[0]), '리그 경기 수: 46주 동안 라운드 수만큼');
  const table = finalTable(eng, 0);
  check(table.length === eng.tiers[0] && table.every((row, i) => row.rk === i + 1 && row.p === roundsOf(eng.tiers[0]) && row.w + row.d + row.l === row.p && row.pts === row.w * 3 + row.d)
    && table.reduce((n, row) => n + row.gd, 0) === 0 && finalTable(eng, 0) === table && leagueTable(eng, 0, 0).every(row => row.pts === 0), '순위표: 승점·득실 합, 같은 결과');
  // 승강: 부마다 팀 수 그대로, 아래 부 우승팀은 올라가고 위 부 꼴찌는 내려감
  check([eng, COUNTRY_BY_ID.CYP].every(country => {
    const { moves } = countryMoves(country);
    const tierOf = id => (moves.has(id) ? moves.get(id) : CLUBS[id].t);
    return country.tiers.every((n, t) => country.all.filter(c => tierOf(c.id) === t).length === n)
      && moves.get(finalTable(country, 1)[0].club.id) === 0 && moves.get(finalTable(country, 0)[country.tiers[0] - 1].club.id) === 1;
  }), '승강: 부마다 팀 수 그대로');
  // 컵·대륙 대회: 우승 구단은 하나, 결승까지 뜀. 대륙 대회 참가 구단은 조별리그 6경기
  check([eng, COUNTRY_BY_ID.KOR, COUNTRY_BY_ID.FRO].every(country => {
    const cup = cupOf(country);
    const winners = [...cup.runs.values()].filter(run => run.won);
    return winners.length === 1 && (winners[0].mask >> (CUP_WEEKS.length - 1)) & 1 && cup.final && cup.runs.get(cup.final.club).won && cup.runs.size === Math.min(64, country.all.length);
  }), '국내 컵: 우승 구단 하나');
  check(CONT_GROUPS.every(group => {
    const cont = contOf(group);
    return cont.finals.every((f, ci) => {
      const runs = [...cont.runs.values()].filter(run => run.ci === ci);
      return f && runs.length <= CONT_SPLIT && runs.filter(run => run.won).length === 1 && runs.every(run => (run.mask & 63) === 63) && runs.filter(run => (run.mask >> 6) & 1).length === Math.min(8, runs.length)
        && runs.filter(run => run.gpos === 0).every(run => (run.mask >> 6) & 1);
    });
  }) && state.cont.length % 4 === 0 && contOf('유럽').finals.length === 3, '대륙 대회: 대회마다 우승 하나, 조별리그 6경기, 8강 8팀(조 1위는 모두 진출), 유럽은 세 대회');
  const week1 = state.week;
  try {
    state.week = 1;
    check(compStatus(club0, 'C') !== L('우승', 'Winners') && rankText(club0) === '', '시즌 시작 전에는 결과를 미리 보여 주지 않음');
  } finally {
    state.week = week1;
  }
  check(playScore(80, 60, 0, rng(3)).every(g => g >= 0 && g <= 9) && resultWord({ f: 1, a: 1, pk: 1 }) === L('1-1 무(승부차기 승)', 'D 1-1, won on pens'), '경기 점수와 결과 글');
  // 15단계 임대: 돌아오는 주는 이번 시즌(여름 이적 기간 뒤쪽이면 다음 시즌) 마지막 주, 후보 구단은 주전으로 뛸 수 있는 곳 3곳까지·늘 같음
  check(loanUntil() > absWeek() && loanUntil() % WEEKS === 0, '임대 기간: 시즌 마지막 주까지');
  const lc = state.clients.find(c => !c.loan);
  if (lc && windowAt()) {
    const opts = loanClubs(lc);
    const ab = getPlayer(lc.s).ability;
    check(opts.length <= TUNE.loanPick && opts.every(x => clubLevel(x) <= ab && clubLevel(x) >= ab - TUNE.loanRange && x !== homeClub(lc.s)) && loanClubs(lc) === opts, '임대 후보: 주전 가능한 구단, 늘 같음');
  }
  // 17단계 임대 뒤 완전 이적: 리그 경기가 모자라면 제안 없음, 평점이 높을수록 잦고 buyMax까지. 선수 마음 세 가지마다 말이 있고, 기본 답은 돌아오게 함
  const apps0 = TUNE.buyApps;
  check(buyChance([apps0 - 1, 0, 0, 90 * (apps0 - 1)]) === 0 && buyChance([20, 0, 0, 1240]) < buyChance([20, 0, 0, 1400]) && buyChance([20, 0, 0, 1800]) === TUNE.buyMax
    && buyChance([20, 0, 0, 1000]) === 0 && ['stay', 'mid', 'back'].every(k => BUY_LINES[k].length >= 3) && !EVENT_TYPES.buy.chance && EVENT_TYPES.buy.def === 2, '임대 뒤 완전 이적: 제안 확률, 선수의 말, 기본 답');
  if (c0) {
    // 돌아오게 하는 답의 유대: 남고 싶어 하면 -, 반반이면 0, 돌아오고 싶어 하면 +
    const p0 = getPlayer(c0.s);
    const d0 = { club: homeClub(c0.s).id, wage: c0.wage, fee: 0, years: 3, from: 'loan', ap: 12, gl: 1, rt: 68 };
    check(Math.sign(optBond(EVENT_TYPES.buy.options[2], p0, d0)) === { stay: -1, mid: 0, back: 1 }[buyWish(p0, d0)], '임대 뒤 완전 이적: 선수 마음과 돌아오게 하는 답');
  }
  // 14단계 처음 화면: 할 일 줄은 4개까지, 지난주 줄은 바로 지난주 경기만
  const lw0 = { lw: { w: absWeek() - 1, n: 1, p: 1, r: 74, g: 1, t: [['L', 2, 1, 0]], a: '' } };
  check(todoList().length <= 4 && todoList().every(t => t.act && t.text) && lastWeekText(lw0) === L('지난주 7.4(1골) [리그 2-1 승]', 'Last week: 7.4 (1 goal) [league W 2-1]')
    && lastWeekText({ lw: { ...lw0.lw, w: absWeek() - 3 } }) === '', '처음 화면: 할 일 4개까지, 지난주 줄');
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

// 언어 바꾸기: 저장하고 화면을 다시 그림 (게임 상태는 그대로)
function setLang(lang) {
  LANG = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    // 저장소를 못 쓰면 이번 방문 동안만
  }
  applyStaticText();
}

function boot() {
  initLang();
  // 배포 직후 옛 index.html이 캐시에 남아 있으면 아무것도 저장하지 않고 안내만 함
  const missing = REQUIRED_IDS.filter(id => !$(id));
  if (missing.length) {
    console.warn('화면 요소가 없습니다:', missing.join(', '));
    const note = el('p', '', L('새 버전을 적용하는 중입니다. 1~2분 뒤 새로고침해 주세요. 저장된 진행 상황은 그대로입니다.', 'A new version is rolling out. Please refresh in a minute or two. Your saved progress is safe.'));
    note.style.cssText = 'position:fixed;left:16px;right:16px;top:40%;z-index:99;padding:16px;border:1px solid #067647;border-radius:12px;background:#ffffff;color:#101828;text-align:center';
    document.body.append(note);
    return;
  }
  const loaded = loadState();
  if (loaded !== 'ok') newGame();
  initMotion();
  const nav = document.querySelector('.bottombar');
  if (nav && !nav.querySelector('.tab-pill')) nav.prepend(el('span', 'tab-pill'));
  bindEvents();
  nextMotion = 'boot';
  const rendered = safeRender();
  // 첫 위치를 잡은 뒤부터 탭 표시가 미끄러짐
  requestAnimationFrame(() => document.querySelector('.tab-pill') && document.querySelector('.tab-pill').classList.add('ready'));
  resetHistory();
  const backupNote = L('이전 저장은 기록 탭에서 백업 파일로 받을 수 있습니다.', 'You can download the old save as a backup from the Log tab.');
  if (!rendered) toast(L(`화면을 그리지 못해 새 게임으로 시작했습니다. ${backupNote}`, `The screen couldn't be drawn, so a new game was started. ${backupNote}`));
  else if (loaded === 'broken') toast(L(`저장 데이터를 읽지 못해 새 게임으로 시작했습니다. ${backupNote}`, `Your save couldn't be read, so a new game was started. ${backupNote}`));
  if (state.over) openGameOver();
  else if (state.summary && !state.summary.seen) openSummary();
  runSelfCheck();
}

document.addEventListener('DOMContentLoaded', boot);
