/* 보잇 · 일반보험 › 설계 도우미 (2026-11-25)
   업종·사업장 상황 → 필요한 보험 → 받을 서류 → 청약 전 확인 → 견적 요청서(팩스·출력·PDF)
   근거(이 파일의 문장은 아래 자료에 있는 내용만 씀)
   - gl.js 길잡이: 6개 손보사 사업장 배상·재산종합 약관 원문 + 국가법령정보센터 조문 (2026-10-28 확인)
   - 대표 제공 엑셀 「일반보험 약관 수집」(2026-11-23~24): 종목별 '가입·확인 자료', '가입·약관 점검 포인트'
     (DB·KB 공식 상품안내 기준, 일부는 약관 원문 미확보 → 화면에 '상품안내 기준' 표시)
   - 가입률: 보험연구원 2024 중소 제조기업 조사 (조사대상 기준, 시장 전체 수치 아님)
   - 의무보험 판정: index.html judgeDuty() 재사용 */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const td=()=>{ const d=new Date(Date.now()+9*3600e3); return d.toISOString().slice(0,10); };
const RATE_SRC="보험연구원 2024 중소 제조기업 조사";

/* 업종 → 기본 상황(체크는 설계사가 바꿀 수 있음). du = 의무보험 진단 업종 키 */
const BIZ=[
 ["rest","일반음식점","rest",["visit","food","gas"]],["cafe","카페·제과점(휴게음식점)","cafe",["visit","food"]],["bar","주점(단란·유흥)","bar",["visit","food"]],
 ["lodge","숙박업","lodge",["visit"]],["academy","학원·교습소","academy",["visit"]],["karaoke","노래연습장","karaoke",["visit"]],["pcroom","PC방","pcroom",["visit"]],
 ["gym","헬스장·체육시설","retail",["visit"]],["kids","키즈카페","retail",["visit","play"]],["beauty","미용실·네일숍","retail",["visit"]],
 ["laundry","세탁소·수선","retail",["visit","bail"]],["retail","소매점·서비스업","retail",["visit"]],["meat","정육점(식육판매업)","retail",["visit","make"]],["meatpk","식육포장처리업(고기 절단·포장)","factory",["make","staff"]],["online","온라인쇼핑몰","office",["make","web"]],
 ["maker","제조업(공장)","factory",["make","staff"]],["contract","인테리어·설비·전기 공사업","office",["work","staff"]],["landlord","건물 임대(건물주)","office",["visit"]],
 ["ware","물류·창고","ware",["bail","staff"]],["office","사무실","office",[]]];
/* 업종 검색어 (2026-11-25): 설계사가 쓰는 말로 업종을 찾음. 분류는 영업 형태 기준 — 확정 전 보험사 인수 기준 확인 */
const BIZ_KW={rest:"음식점 식당 한식 중식 일식 분식 치킨 고깃집 횟집 배달 프랜차이즈",cafe:"카페 커피 제과 빵집 베이커리 디저트 아이스크림 휴게음식",bar:"술집 주점 호프 노래주점 단란 유흥 포차 이자카야",
 lodge:"숙박 모텔 호텔 펜션 게스트하우스 민박 캠핑",academy:"학원 교습소 공부방 어학원 피아노",karaoke:"노래방 노래연습장 코인노래방",pcroom:"피시방 PC방 게임방",
 gym:"헬스 체육관 필라테스 요가 태권도 수영장 골프연습장 스크린골프 볼링 당구장 클라이밍",kids:"키즈카페 실내놀이터 키즈",beauty:"미용실 헤어 네일 피부관리 에스테틱 이발소 왁싱 속눈썹 마사지",
 laundry:"세탁소 수선 빨래방 코인세탁 구두수선",retail:"소매 마트 편의점 슈퍼 꽃집 문구 약국 안경 휴대폰 옷가게 의류 잡화 서점 철물점 반찬가게 과일가게",
 meat:"정육점 정육 식육판매 고기 축산물 한우 정육식당",meatpk:"식육포장 식육가공 육가공 축산물가공 고기포장 절단 소분",
 online:"온라인 쇼핑몰 스마트스토어 쿠팡 통신판매 인터넷판매",maker:"제조 공장 생산 가공 식품제조 공방",contract:"인테리어 공사 설비 전기 도배 타일 철거 건설 시공 간판 냉난방",
 landlord:"건물주 임대 상가임대 빌딩 원룸임대",ware:"물류 창고 택배 보관 냉동창고",office:"사무실 사무소 회계 세무 법무 부동산중개 IT 디자인"};
function bizFind(q){ q=String(q||"").replace(/\s+/g,""); if(q.length<2) return []; return BIZ.filter(b=>(b[1]+" "+(BIZ_KW[b[0]]||"")).replace(/\?/g,"").split(/[\s·()]+/).some(w=>w&&(w.includes(q)||q.includes(w)&&w.length>=2))); }
const FLAGS=[["visit","손님이 매장에 옴"],["food","음식을 만들거나 팖"],["make","제품을 만들거나 팖"],["work","남의 장소에서 공사·설치"],["bail","고객 물건을 맡아 둠"],["park","고객 차량 주차·발렛"],
 ["staff","직원이 있음"],["elev","승강기를 관리함"],["play","어린이놀이시설 관리"],["gas","LPG·도시가스 사용"],["web","온라인 판매·IT 서비스"],["pi","매출 10억↑ + 개인정보 1만명↑"]];

/* 종목 정의 — chk: 청약 전 확인 / docs: 받을 서류 / gl: 길잡이 근거 id / lv: 근거 수준 */
const IT={
 fire:{n:"화재(재산)보험",why:"건물·시설·집기·재고에 불이 나면 내 재산 손해",rate:"82.2%",gl:"leak-own",
  docs:["건물 주소·구조·층수·면적 (건축물대장)","보험 목적별 금액 — 건물·시설·기계·집기·재고를 나눠서"],
  chk:["건물·시설·기계·집기·재고를 구분해 보험가액을 정하세요. 비례보상·잔존물처리 조건을 확인합니다.",
   "배관 누수로 내 재물이 젖는 손해는 급배수시설누출손해 특약이 따로 필요하고, 계약일부터 90일이 지난 다음 날부터 보장됩니다(현대·KB·메리츠·한화).",
   "KB·메리츠 급배수 특약은 손해액의 90%만 보상합니다(10% 자기부담).",
   "풍수재(침수·태풍)는 침수높이·지하층·자기부담금 조건을 확인하세요."]},
 fireliab:{n:"화재배상책임",why:"우리 가게 불이 옆 가게·윗집으로 번진 피해 배상",gl:"fire-spread",docs:[],
  chk:["가입 상품이 '화재배상 제외'형인지 확인하세요(현대·KB·메리츠·한화는 시설소유관리자 특약에 화재배상제외형이 따로 있음).",
   "같은 손해를 의무보험이 보상하면 의무보험이 먼저이고, 초과분만 보상합니다(DB·KB·메리츠·한화)."]},
 tenant:{n:"임차자배상책임(화재)",why:"빌린 건물이 우리 불로 탔을 때 건물주에게 배상",gl:"tenant-fire",docs:["빌린 건물(호실) 주소·면적"],
  chk:["보상한도가 건물 가액보다 적으면 비례보상될 수 있습니다(삼성은 가액의 80% 미만일 때, 메리츠는 가액보다 적을 때).",
   "급배수관·냉난방장치·스프링클러에서 샌 물로 생긴 손해는 보상하지 않습니다.","임차자의 고의 또는 중대한 과실로 생긴 손해는 보상하지 않습니다."]},
 cgl:{n:"시설소유(관리)자 배상책임",why:"매장·건물 때문에 손님·행인이 다치거나 물건이 부서진 배상",rate:"10.9% (영업배상)",gl:"slip",
  docs:["시설 면적·수용인원","연 매출","고객 차량·행사 여부"],
  chk:["사고가 날 수 있는 시설(주소)을 증권에 피보험시설로 적어야 합니다.",
   "건물의 수리·개조·신축·철거 공사 중 사고는 보상하지 않습니다(통상적인 유지·보수 작업 중 사고는 보상).",
   "직원(근로자)이 업무 중 다친 것은 보상하지 않습니다.",
   "DB·KB·메리츠·한화는 의무보험(가스사고배상, 특수건물 신체손해 등)이 보상하는 손해를 빼고 초과분만 보상합니다.",
   "배상책임 확정 전 치료비를 주는 구내치료비 추가특약은 확인한 6개사 중 삼성화재 영업배상에만 있습니다(학원용 제외)."]},
 rent:{n:"부동산임대업자 추가특약",why:"임대 건물 화재·폭발·붕괴로 세입자 물건이 망가졌을 때",gl:"landlord",docs:["임대 현황 (호실·세입자 업종)"],lv:"삼성화재만 확인",
  chk:["화재·폭발·붕괴 외의 사고는 이 추가특약으로 보상하지 않습니다.","삼성화재 영업배상(시설소유관리자 + 부동산임대업자 추가특약)만 확인했고, 다른 회사는 확인 중입니다."]},
 food:{n:"음식물배상책임",why:"판 음식으로 손님이 식중독·이물질 피해",gl:"food",docs:["메뉴·판매방식(매장·포장·배달)","연 매출","급식 위탁 여부"],
  chk:["시설소유관리자 특약만으로는 안 됩니다. 가게 밖으로 나간 음식으로 생긴 손해는 면책입니다.",
   "보상 범위가 회사마다 다릅니다: KB·메리츠·한화는 몸(대인) 피해만, 현대해상은 몸과 재물 모두.",
   "음식 자체 손해, 회수·검사·대체 비용은 보상하지 않습니다.","메리츠는 방어비용 등 비용을 사고당 50만원 한도로 보상합니다."]},
 pl:{n:"생산물배상책임(PL)",why:"만들거나 판 제품 결함으로 소비자가 다치거나 재산 피해",rate:"14.3%",gl:"product",
  docs:["질문서 (보험사 양식)","직전 회계연도 손익계산서","제품설명서","사업자등록증","생산물 종류·연간 예상매출·수출지역"],
  chk:["배상청구기준 상품은 보험기간 중 처음 제기된 청구를 보상하며, 소급보장일자 이전 사고는 보상하지 않습니다. 소급일을 꼭 확인하세요.",
   "제품 자체 손해, 결함 제품 회수(리콜)·검사·수리·대체 비용과 사용손실은 보상하지 않습니다.",
   "시설소유관리자 특약은 '점유를 벗어난 재물'로 생긴 손해를 면책하므로 제품 사고는 이 보험이 따로 필요합니다.",
   "수출이 있으면 수출국을 고지해야 합니다."]},
 contractor:{n:"도급업자배상책임",why:"공사·설치 중 고객·행인·이웃 재산 피해",gl:"contractor",
  docs:["도급·하도급 계약서","공정표","설계도면","지질보고서","작업인원·임금","하도급 여부","주변상황도","지하매설물 현황"],
  chk:["작업이 끝난 뒤(인도 후) 작업 결과로 생긴 손해와 작업물건 자체 손해는 보상하지 않습니다(완성작업 위험은 별도).",
   "하청(수급인)이 한 작업은 원칙적으로 보상하지 않습니다. 계약 때 미리 정하고 보험료를 내야 보상됩니다.",
   "토지 내려앉음·진동·붕괴, 지하매설물 손해는 보상하지 않습니다(추가특약으로 확장).",
   "작업 대상 고객 물건(맡아 관리하는 재물) 손해, 근로자 부상은 보상하지 않습니다."]},
 car:{n:"건설공사보험(CAR)",why:"공사 중 사고로 공사 목적물 자체가 손해",lv:"DB·KB 상품안내 기준(약관 원문 미확보)",
  docs:["도급계약서","공사개요·일정(공정표)","설계도면","지질보고서","공사비 내역","주변상황도"],
  chk:["공사기간·장소·공정과 보험 책임 시작·종료 시점을 증권으로 확인하세요.","공사물 손해와 제3자 배상 손해를 나눠서 담보를 정합니다.","확장유지·설계결함·주위재산은 특약으로 따로 확인합니다."]},
 bailee:{n:"보관자배상책임",why:"맡아 둔 고객 물건이 사고로 망가짐",gl:"bailee",docs:["맡는 물건 종류"],
  chk:["재물을 가공하는 중에 생긴 손해는 보상하지 않습니다(현대·삼성·메리츠). 세탁·수선 작업 자체 손상은 빠질 수 있습니다.",
   "인도·배달 착오, 분실, 좀도둑, 감량은 보상하지 않습니다.","보석·화폐·시계·모피 등은 원칙적으로 제외입니다."]},
 parking:{n:"주차장배상책임",why:"맡은 고객 차량 파손·도난",gl:"parking",docs:["차종·주차 대수·주차 형태(자주식·발렛·기계식)"],
  chk:["시설소유관리자 특약은 맡아 둔 고객 차량 손해를 면책하므로 이 특약이 필요합니다.",
   "타이어·부품만의 손해·도난, 차 안에 둔 물건은 보상하지 않습니다.","삼성화재는 공공도로에서 하는 주차대행 중 손해를 보상하지 않습니다."]},
 beauty:{n:"이·미용사 배상책임",why:"시술 중 손님 부상·피부 손상",gl:"beauty",docs:[],
  chk:["일반 시설소유관리자 특약은 전문직업인의 직업상 과실을 면책하므로 이 특약이 따로 필요합니다.","각 사 이·미용사 특약의 세부 면책은 확인 중입니다."]},
 el:{n:"근재·사용자배상(EL)",why:"직원이 일하다 다쳤을 때 산재보험을 넘는 사용자 배상",rate:"13.2%",gl:"employee",lv:"DB·KB 상품안내 기준",
  docs:["산재보험 가입 현황","사업장·근로자 현황(인원·임금)","원·하도급 계약서 (공사업체)","사업자등록증"],
  chk:["일반 배상 특약(시설·음식물·도급 등)은 직원 업무 중 부상을 보상하지 않습니다(6개사 확인).",
   "근로자를 1명 이상 쓰면 원칙적으로 산재보험 적용 대상입니다(산재보험법 제6조).",
   "산재보험과의 관계(초과분), 근로자·하도급 근로자 범위, 1인·1사고 한도를 확인합니다."]},
 pi:{n:"개인정보 배상책임",why:"고객 개인정보 유출 배상",gl:"privacy",lv:"DB 과거 상품안내 + 법령",docs:["처리하는 개인정보 규모","위탁업체","보안체계","사고 이력"],
  chk:["의무 대상: 전년도 매출 10억원 이상이면서 정보주체 일평균 1만명 이상(개인정보보호법 제39조의7).","배상책임과 회사 자체 사고대응 비용은 구분해서 확인합니다."]},
 ebiz:{n:"e-Biz(네트워크) 배상책임",why:"쇼핑몰·서비스 장애, 정보 유출로 남에게 준 피해",rate:"1.3% (사이버)",lv:"DB·KB 상품안내 기준",docs:["사업설문서","네트워크 활동 내용","매출·사고 이력","보안 조치"],
  chk:["제3자 배상 중심입니다. 회사 자체 데이터 복구·포렌식·휴업 손실까지 보장한다고 단정하지 마세요(별도 사이버 약관 확인)."]},
 mb:{n:"기계보험",why:"생산 기계·설비의 사고로 기계 자체 손해",lv:"DB·KB 상품안내 기준",docs:["기계 명세·신조달가액","설치·운전 상태","정비 기록"],
  chk:["기계보험과 화재보험의 담보 겹침을 확인하세요.","노후·마모·결함 면책이 있습니다. 정비 기록을 준비합니다.","시운전이 끝난 기계가 대상입니다(KB)."]},
 bi:{n:"기업휴지(영업중단)",why:"화재·기계사고로 문 닫는 동안 매출 손실·고정비",lv:"엑셀 점검 포인트 기준",docs:["직전 회계연도 손익계산서","월별 매출·고정비"],
  chk:["보상기간, 대기기간(면책기간), 손실 산정기준을 확인합니다.","공급망·전력중단 담보 여부를 확인합니다."]},
 gas:{n:"가스사고배상책임",why:"가스 사고로 남에게 준 피해 (기준 해당 시 의무)",duty:1,gl:"gas",docs:["가스 종류(LPG·도시가스)·저장능력","영업장 면적"],
  chk:["LPG는 지하실·제1종 보호시설의 100㎡ 이상 식품접객업소, 1회 50명 이상 집단급식소 등이 의무 대상입니다(액화석유가스법 시행규칙 제75조).",
   "일반 배상 특약은 가스사고 의무보험 보상분을 빼고 보상합니다."],lim:"LPG 사망 1.5억·대물 3억 (법정)"},
 academy:{n:"학원·교습소 배상책임",why:"수강생 부상 배상 (의무)",duty:1,gl:"academy",docs:["시설 면적·수용인원","강습 종목","주차장 여부"],
  chk:["수강생의 몸(생명·신체) 피해가 의무 대상이며, 보상 금액은 시·도 조례마다 다릅니다.","학원 바닥면적 합계 2,000㎡ 이상이면 특수건물 화재보험 의무가 따로 있습니다."],lim:"시·도 조례 금액"},
 gym:{n:"체육시설업자 배상책임",why:"이용자 부상 배상 (업종에 따라 의무)",duty:1,gl:"gym",docs:["시설 면적·수용인원","종목","주차장 여부"],
  chk:["체육도장·골프연습장·헬스장·당구장·스크린골프·체육교습업 등 소규모 체육시설업은 의무가 아닙니다(시행규칙 제25조).","의무가 아니어도 손님 부상 배상은 시설소유관리자 특약으로 준비합니다."]}
};
/* 의무보험 진단(judgeDuty) 결과 → 종목 */
const DUTY_IT={multi:{n:"다중이용업소 화재배상책임",gl:"multi-use",docs:["영업신고증·허가증 (업종·면적)"],chk:["불이 나면 과실이 없어도 배상합니다.","같은 내용이 들어간 다른 보험에 가입했으면 가입한 것으로 봅니다(법 제13조의2 제2항)."],lim:"사망 1.5억·재산 10억 (법정)"},
 disaster:{n:"재난배상책임",gl:"disaster",docs:["영업신고증·허가증 (업종·면적)"],chk:["다른 법률 보험으로 같은 손해를 보상받으면 가입한 것으로 봅니다(재난안전법 제76조의5 제2항)."],lim:"대인 자배법 기준·대물 10억 (법정)"},
 special:{n:"특수건물 화재보험(신체손해배상특약)",gl:"special-bldg",docs:["건축물대장 (층수·용도별 면적)"],chk:["가입 의무는 건물 소유자입니다. 30일 이내 가입, 매년 갱신. 미가입은 500만원 이하 벌금입니다."],lim:"사망 1.5억·재물 10억 (법정)"},
 elev:{n:"승강기 사고배상책임",gl:"elevator",docs:["승강기 대수·번호"],chk:["시설소유관리자 특약이 승강기 의무보험을 대신하지 않습니다."],lim:"사망 8천만·재산 1천만 (법정)"},
 play:{n:"어린이놀이시설 배상책임",gl:"playground",docs:["놀이시설 위치·기구 수"],chk:["시설을 인도받은 날부터 30일 이내 가입해야 합니다."],lim:"사망 1억 (법정)"},
 pi:{n:"개인정보 손해배상책임(의무)",gl:"privacy",docs:["매출·보유 개인정보 규모"],chk:["보험 대신 준비금을 쌓는 방법도 있습니다(시행령 제48조의7)."],lim:"정보주체·매출 규모별 최저액"}};
const COMMON_DOCS=["사업자등록증","현재 가입 증권 (있으면)","최근 사고·보험금 청구 이력"];

const G={cust:null,name:"",boss:"",biz:"rest",addr:"",floor:"1",area:"",bfl:"",own:"rent",sales:"",staff:"",acc:"",fl:new Set(BIZ[0][3]),off:new Set(),lim:{},got:new Set(),
  to:{ins:"",who:"",fax:""},from:"",till:"",memo:""};
const LS="boit_gi_fax";
const loadFax=()=>{ try{ return JSON.parse(localStorage.getItem(LS)||"{}"); }catch(_){ return {}; } };
const saveFax=(ins,fax)=>{ try{ const o=loadFax(); o[ins]=fax; localStorage.setItem(LS,JSON.stringify(o)); }catch(_){ } };

function duty(){
  if(typeof judgeDuty!=="function"||typeof DU==="undefined") return [];
  const b=BIZ.find(x=>x[0]===G.biz)||BIZ[0], old={...DU};
  Object.assign(DU,{biz:b[2],floor:G.floor,area:G.area,cap:"",bfl:G.bfl,buse:"",own:G.own,elev:G.fl.has("elev"),play:G.fl.has("play"),pi:G.fl.has("pi")});
  let R=[]; try{ R=judgeDuty(); }catch(_){ } Object.assign(DU,old);
  return R.filter(r=>r.st!=="n"&&DUTY_IT[r.k]);
}
/* 필요한 보험 목록 */
function items(){
  const f=k=>G.fl.has(k), L=[], add=(k,o)=>L.push({k,...IT[k],...(o||{})});
  duty().forEach(r=>L.push({k:"d_"+r.k,...DUTY_IT[r.k],duty:1,st:r.st,why:r.why,src:typeof SRC_DUTY!=="undefined"?SRC_DUTY[r.k]:""}));
  if(f("gas")) add("gas",{st:"q"});
  if(G.biz==="academy") add("academy",{st:"y"});
  if(G.biz==="gym") add("gym",{st:"q"});
  add("fire");
  if(f("visit")||G.own==="own") add("cgl");
  add("fireliab");
  if(G.own==="rent") add("tenant");
  if(G.biz==="landlord") add("rent");
  if(f("food")) add("food");
  if(f("make")) add("pl");
  if(f("work")){ add("contractor"); add("car",{opt:1}); }
  if(f("bail")) add("bailee");
  if(f("park")) add("parking");
  if(G.biz==="beauty") add("beauty");
  if(f("staff")) add("el");
  if(f("web")){ if(!f("pi")) add("pi",{opt:1}); add("ebiz",{opt:1}); }
  if(G.biz==="maker"){ add("mb",{opt:1}); add("bi",{opt:1}); }
  return L.map(x=>({...x,on:G.off.has(x.k)?false:(x.opt?G.off.has("+"+x.k):true)}));
}
const picked=()=>items().filter(x=>x.on);

const css=`#gi-root{display:flex;flex-direction:column;gap:14px}
#gi-root .gi-h{display:flex;align-items:center;gap:8px;margin:0;font-size:16px}#gi-root .gi-h i{font-style:normal;width:24px;height:24px;border-radius:50%;background:var(--accent,#0E7A5F);color:#fff;font-size:13px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.gi-fl{display:flex;flex-wrap:wrap;gap:6px}.gi-fl label{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:13px;cursor:pointer;background:var(--card,#fff)}.gi-fl label:has(input:checked){border-color:var(--accent,#0E7A5F);background:var(--accent-soft,#EAF6F1);font-weight:600}.gi-fl input{margin:0}
.gi-its{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.gi-it{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;background:var(--card,#fff)}.gi-it.off{opacity:.5}
.gi-it .t{display:flex;align-items:center;gap:6px}.gi-it .t b{flex:1;font-size:14px}.gi-it .w{font-size:12.5px;color:var(--muted)}.gi-it .m{display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);align-items:center}
.gi-it .m button{border:0;background:none;color:var(--accent,#0E7A5F);padding:0;font-size:11.5px;cursor:pointer;text-decoration:underline}
.gi-tag{font-size:11px;padding:1px 7px;border-radius:999px;font-weight:700}.gi-tag.d{background:#FFF1E8;color:#C2410C}.gi-tag.q{background:#FFF7DB;color:#8A6100}.gi-tag.o{background:#EEF2FA;color:#1F3A68}
.gi-bq{margin-left:8px;width:160px;padding:3px 8px;border:1.5px solid #B7E1CF;border-radius:6px;font:inherit;font-size:12.5px;font-weight:400}.gi-bf{display:flex;flex-wrap:wrap;gap:4px}.gi-bf:empty{display:none}.gi-bf button{border:1.5px solid #0E7A5F;background:#F0F8F5;color:#0B5C47;border-radius:99px;padding:3px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.gi-bf span{font-size:12px;color:#B42318}
.gi-doc{display:flex!important;flex-direction:column;gap:12px}.gi-dsum{margin:0;font-size:13px;color:var(--muted)}.gi-dsum b{color:#B42318}
.gi-dg>b{display:block;font-size:14px;margin-bottom:4px}.gi-dg>b small{color:var(--muted);font-weight:500}.gi-dg{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:4px 16px}.gi-dg>b{grid-column:1/-1}
.gi-dr{display:flex;gap:8px;align-items:center;font-size:13.5px;padding:3px 0}.gi-dr small{color:var(--muted)}.gi-dr em{font-style:normal;color:#0E7A5F;font-weight:700}.gi-dr.done>span{color:var(--muted)}
.gi-ds{flex:none;min-width:58px;text-align:center;border-radius:99px;padding:3px 9px;font:inherit;font-size:12px;font-weight:800;border:1.5px solid;cursor:pointer;background:#fff}.gi-ds.nd{color:#B42318;border-color:#F3B8B8;background:#FDF2F2}.gi-ds.op{color:#6B7773;border-color:#D5DBD8}.gi-ds.ok{color:#0E7A5F;border-color:#B7E1CF;background:#E6F4EF}span.gi-ds{cursor:default}
.gi-x{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0 16px}.gi-doc label{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;padding:3px 0}.gi-doc small{color:var(--muted)}
.gi-chk{display:flex;flex-direction:column;gap:6px}.gi-chk details{border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--card,#fff)}.gi-chk summary{cursor:pointer;font-weight:700;font-size:13.5px}.gi-chk summary small{font-weight:400;color:var(--muted);margin-left:6px}.gi-chk ul{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.6}.gi-chk .lv{font-size:11px;color:var(--muted);font-weight:400;margin-left:6px}
.gi-q{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:14px;align-items:start}.gi-q[hidden]{display:none}@media(max-width:1400px){.gi-q{grid-template-columns:1fr}}
.gi2{display:grid;grid-template-columns:minmax(330px,380px) minmax(0,1fr);gap:14px;align-items:start}@media(max-width:1100px){.gi2{grid-template-columns:1fr}.gi-in{position:static!important;max-height:none!important}}
.gi-in{display:flex;flex-direction:column;gap:9px;position:sticky;top:8px;max-height:calc(100vh - 16px);overflow:auto;padding:14px!important}.gi-in .field{margin:0}.gi-in .field label{font-size:12.5px}.gi-in input,.gi-in select{padding-top:7px!important;padding-bottom:7px!important}
.gi-r2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gi-r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.gi-in .gi-fl label{padding:3px 9px;font-size:12px}
.gi-out{display:flex;flex-direction:column;gap:10px;min-width:0}.gi-pane{display:flex;flex-direction:column;gap:10px}.gi-pane[hidden]{display:none}
.gi-tabs{display:flex;gap:6px;flex-wrap:wrap;position:sticky;top:0;z-index:3;background:var(--bg,#F3F6F5);padding:4px 0}.gi-tabs button{flex:1;min-width:120px;border:1.5px solid var(--line);background:var(--surface,#fff);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.gi-tabs button[aria-pressed="true"]{border-color:var(--accent,#0E7A5F);background:var(--accent,#0E7A5F);color:#fff}.gi-tabs em{font-style:normal;font-size:12px;font-weight:800;background:rgba(0,0,0,.08);border-radius:99px;padding:1px 7px;margin-left:4px}.gi-tabs button[aria-pressed="true"] em{background:rgba(255,255,255,.25)}
.gi-next{display:flex;justify-content:flex-end}.gi-in .gi-bq{display:block;margin:4px 0 6px;width:100%;box-sizing:border-box;padding:7px 10px;font-size:13px}.gi-in .gi-bf{margin-bottom:6px}.gi-its{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))!important}
.gi-pv{border:1px solid var(--line);border-radius:12px;background:#E9EDEB;padding:8px;overflow:auto;max-height:720px}body:not(.cap) .gi-pv .sheets{zoom:.5;margin:0}
.gi-lim{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:6px;align-items:center;font-size:13px}.gi-lim input{padding:6px 8px}
.gi-acts{display:flex;flex-wrap:wrap;gap:6px}
.a4.gq h3{margin:0;font-size:24px;letter-spacing:-.02em}.a4.gq .gq-to{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}.a4.gq .gq-to>div{border:1px solid var(--pline);border-radius:8px;padding:8px 10px}.a4.gq .gq-to span{color:var(--ink2);font-size:11.5px;display:block}
.a4.gq .gq-docs{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:12.5px}`;

function custOpts(){ return (typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]); }
function insOpts(){ return (typeof INSURERS!=="undefined"?INSURERS.filter(i=>i.k==="son"):[]).map(i=>`<option value="${esc(i.name)}">`).join(""); }

function render(){
  const root=$("#gi-root"); if(!root) return;
  if(!$("#gi-css")){ const s=document.createElement("style"); s.id="gi-css"; s.textContent=css; document.head.appendChild(s); }
  if(!G.tab) G.tab="its";
  const T=(k,t)=>`<button type="button" data-gitab="${k}" aria-pressed="${G.tab===k}">${t}</button>`;
  /* 2026-11-25 대표 지시: 한 화면 구성 — 왼쪽 사업장 입력(고정) · 오른쪽 결과 탭 4개 (스크롤·클릭 줄임) */
  root.innerHTML=`<div class="gi2">
  <aside class="panel gi-in">
    <div class="field"><label for="gi-biz">업종 <input id="gi-bq" class="gi-bq" placeholder="검색: 정육점·미용실…" autocomplete="off"></label><div class="gi-bf" id="gi-bf"></div><select id="gi-biz" data-gi="biz">${BIZ.map(b=>`<option value="${b[0]}" ${b[0]===G.biz?"selected":""}>${b[1]}</option>`).join("")}</select></div>
    <div class="gi-r2"><div class="field"><label for="gi-cust">고객(대표자)</label><input id="gi-cust" list="dl-cust" placeholder="이름·전화 뒷자리" autocomplete="off" value="${esc(G.boss)}"></div>
      <div class="field"><label for="gi-name">상호</label><input id="gi-name" data-gi="name" value="${esc(G.name)}" placeholder="예: 행복분식" autocomplete="off"></div></div>
    <div class="field"><label for="gi-addr">소재지</label><input id="gi-addr" data-gi="addr" value="${esc(G.addr)}" placeholder="시·구·동까지" autocomplete="off"></div>
    <div class="field"><label for="gi-floor">영업장 위치 · 면적(㎡)</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select id="gi-floor" data-gi="floor" style="flex:1"><option value="1" ${G.floor==="1"?"selected":""}>지상 1층</option><option value="2" ${G.floor==="2"?"selected":""}>2층 이상</option><option value="b" ${G.floor==="b"?"selected":""}>지하</option></select><input data-gi="area" inputmode="numeric" value="${esc(G.area)}" placeholder="면적" style="width:80px"></div></div>
    <div class="field"><label for="gi-own">건물 층수 · 소유</label><div class="row" style="gap:6px;flex-wrap:nowrap"><input data-gi="bfl" inputmode="numeric" value="${esc(G.bfl)}" placeholder="층수" style="width:70px"><select id="gi-own" data-gi="own" style="flex:1"><option value="rent" ${G.own==="rent"?"selected":""}>임차 (세입자)</option><option value="own" ${G.own==="own"?"selected":""}>소유 (건물주)</option></select></div></div>
    <div class="gi-r3"><div class="field"><label>연 매출(만원)</label><input data-gi="sales" inputmode="numeric" value="${esc(G.sales)}" placeholder="30000"></div>
      <div class="field"><label>직원 수</label><input data-gi="staff" inputmode="numeric" value="${esc(G.staff)}" placeholder="대표 제외"></div>
      <div class="field"><label>3년 사고</label><input data-gi="acc" value="${esc(G.acc)}" placeholder="없음"></div></div>
    <div><div class="note" style="margin-bottom:4px">해당하는 것 (업종을 고르면 자동)</div>
      <div class="gi-fl">${FLAGS.map(([k,l])=>`<label><input type="checkbox" data-gifl="${k}" ${G.fl.has(k)?"checked":""}>${l}</label>`).join("")}</div></div>
  </aside>
  <section class="gi-out">
    <div class="gi-tabs">${T("its",'① 필요한 보험 <em id="gi-tc-its"></em>')}${T("docs",'② 받을 서류 <em id="gi-tc-docs"></em>')}${T("chk","③ 청약 전 확인")}${T("q","④ 견적 요청서")}</div>
    <div class="panel gi-pane" data-gip="its" ${G.tab==="its"?"":"hidden"}>
      <div class="gi-its" id="gi-its"></div>
      <p class="note" style="margin:0">눌러서 빼거나 넣기 · 고른 보험이 서류·견적 요청서에 들어갑니다. 가입률은 ${RATE_SRC} 결과(조사대상 기준).</p>
      <div class="gi-next"><button class="btn primary" type="button" data-gitab="docs">다음: 받을 서류 →</button></div>
    </div>
    <div class="panel gi-pane" data-gip="docs" ${G.tab==="docs"?"":"hidden"}>
      <div class="gi-acts" style="justify-content:flex-end"><button class="btn sm" type="button" id="gi-dcopy">서류 요청 문자 복사</button><button class="btn sm primary" type="button" id="gi-dsms">문자 보내기</button></div>
      <div class="gi-doc" id="gi-docs"></div><span class="note" id="gi-dmsg"></span>
      <div class="gi-next"><button class="btn primary" type="button" data-gitab="q">다음: 견적 요청서 →</button></div>
    </div>
    <div class="panel gi-pane" data-gip="chk" ${G.tab==="chk"?"":"hidden"}>
      <div class="gi-acts" style="justify-content:flex-end"><button class="btn sm" type="button" id="gi-chkall">모두 펼치기</button></div>
      <div class="gi-chk" id="gi-chk"></div>
      <p class="note" style="margin:0">근거: 6개 손보사 사업장 배상·재산종합 약관 원문(길잡이) · 일부 종목은 보험사 공식 상품안내 기준. 청약 전 해당 약관을 확인하세요.</p>
    </div>
    <div class="gi-pane gi-q" data-gip="q" ${G.tab==="q"?"":"hidden"}>
      <div class="panel" style="display:flex;flex-direction:column;gap:10px">
      <div class="fgrid">
        <div class="field"><label for="gi-toins">받는 보험사</label><input id="gi-toins" list="gi-dlins" data-gito="ins" value="${esc(G.to.ins)}" placeholder="예: DB손해보험" autocomplete="off"><datalist id="gi-dlins">${insOpts()}</datalist></div>
        <div class="field"><label>담당자 (부서)</label><input data-gito="who" value="${esc(G.to.who)}" placeholder="예: 일반보험 인수팀"></div>
        <div class="field"><label>받는 팩스번호</label><input id="gi-tofax" data-gito="fax" inputmode="tel" value="${esc(G.to.fax)}" placeholder="담당 부서 팩스"></div>
      </div>
      <div class="fgrid">
        <div class="field"><label>보험 시작일</label><input data-gi="from" value="${esc(G.from)}" placeholder="2026-12-01"></div>
        <div class="field"><label>보험 종료일</label><input data-gi="till" value="${esc(G.till)}" placeholder="2027-12-01"></div>
        <div class="field"><label>요청 메모</label><input data-gi="memo" value="${esc(G.memo)}" placeholder="예: 현재 계약 만기 12/1"></div>
      </div>
      <div><div class="note" style="margin-bottom:4px">희망 가입금액·한도 (비우면 '견적 시 제안 요청')</div><div class="gi-lim" id="gi-lims"></div></div>
      <div class="gi-acts"><button class="btn primary" type="button" id="gi-fax">팩스 보내기</button><button class="btn" type="button" id="gi-print">출력</button><button class="btn" type="button" id="gi-pdf">PDF 다운로드</button></div>
      <div id="gi-faxok"></div><span class="note" id="pdfmsg-gq"></span>
      <p class="note" style="margin:0">일반보험 팩스번호는 보험금 청구 팩스와 다릅니다. 담당 부서 번호를 넣으세요(보험사별로 저장됩니다). 주민번호·계좌번호는 넣지 않습니다.</p>
    </div>
    <div class="gi-pv"><div class="sheets" id="sheets-gq"></div></div>
    </div>
  </section></div>`;
  paint();
}
function paint(){
  const L=items(), P=L.filter(x=>x.on);
  $("#gi-its").innerHTML=L.map(x=>`<div class="gi-it ${x.on?"":"off"}"><div class="t"><input type="checkbox" data-giit="${x.k}" data-opt="${x.opt?1:""}" ${x.on?"checked":""} aria-label="${esc(x.n)}"><b>${esc(x.n)}</b>${x.duty?`<span class="gi-tag ${x.st==="y"?"d":"q"}">${x.st==="y"?"의무":"의무 확인"}</span>`:x.opt?'<span class="gi-tag o">검토</span>':""}</div>
    <div class="w">${esc(x.why||"")}</div><div class="m">${x.rate?`<span>가입률 ${esc(x.rate)}</span>`:""}${x.lv?`<span>${esc(x.lv)}</span>`:""}${x.gl?`<button type="button" data-giglo="${x.gl}">근거 보기</button>`:""}</div></div>`).join("");
  const R=docRows(), need=R.filter(r=>!r.fill&&!r.opt&&!G.got.has(r.d)).length;
  const pill=r=>r.fill?`<span class="gi-ds ok">입력됨</span>`:`<button type="button" class="gi-ds ${G.got.has(r.d)?"ok":r.opt?"op":"nd"}" data-gidoc="${esc(r.d)}">${G.got.has(r.d)?"✓ 받음":r.opt?"있으면":"필요"}</button>`;
  const grp=(t,L)=>L.length?`<div class="gi-dg"><b>${t} <small>${L.length}</small></b>${L.map(r=>`<div class="gi-dr${G.got.has(r.d)||r.fill?" done":""}">${pill(r)}<span>${esc(r.d)}${r.fill?` <em>${esc(r.fill)}</em>`:""} <small>${esc(r.n)}</small></span></div>`).join("")}</div>`:"";
  $("#gi-docs").innerHTML=P.length?`<p class="gi-dsum">고른 보험에 필요한 서류가 자동으로 정리됩니다. <b>${need?`아직 ${need}개 필요`:"모두 준비됨"}</b> · 받은 것은 눌러서 <span class="gi-ds ok">✓ 받음</span>으로 바꾸세요 · 문자에는 '필요'만 들어갑니다</p>`+grp("받을 서류",R.filter(r=>r.kind==="doc"))+grp("물어볼 것 (고객에게 확인)",R.filter(r=>r.kind==="ask")):'<p class="note">2단계에서 보험을 고르면 필요한 서류가 자동으로 나옵니다.</p>';
  { const a=$("#gi-tc-its"), b=$("#gi-tc-docs"); if(a) a.textContent=P.length; if(b) b.textContent=need?"필요 "+need:"✓"; }
  $("#gi-chk").innerHTML=P.filter(x=>(x.chk||[]).length).map(x=>`<details><summary>${esc(x.n)}<small>${x.chk.length}개${x.lv?" · "+esc(x.lv):""}</small></summary><ul>${x.chk.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></details>`).join("")||'<p class="note">보험을 고르면 확인할 점이 여기 나옵니다.</p>';
  $("#gi-lims").innerHTML=P.map(x=>`<span>${esc(x.n)}</span><input data-gilim="${x.k}" value="${esc(G.lim[x.k]!=null?G.lim[x.k]:(x.lim||""))}" placeholder="예: 1억">`).join("");
  sheet();
}
/* 받을 서류 자동 정리 (2026-11-25 대표 지시): 고른 보험 → 필요한 서류·물어볼 것을 자동으로, 1단계에 이미 적은 건 '입력됨', 해당 없는 건 숨김 */
const DOC_RE=/증$|증 |증권|대장|계약서|이력|질문서|손익계산서|설명서|공정표|도면|보고서|명세|기록|현황도|설문서|허가증|신고증|\(.*양식\)/;
function docRows(){ const P=picked(), f=k=>G.fl.has(k), seen=new Set(), out=[];
  const src=[...COMMON_DOCS.map(d=>["공통",d]),...P.flatMap(x=>(x.docs||[]).map(d=>[x.n,d]))];
  for(const [n,d] of src){ if(seen.has(d)) continue; seen.add(d);
    if(/\(공사업체\)/.test(d)&&!f("work")&&G.biz!=="contract") continue; /* 공사업체만 */
    const fill=d==="연 매출"?(G.sales?(+G.sales).toLocaleString()+"만원":""):d==="최근 사고·보험금 청구 이력"?(G.acc||""):d==="빌린 건물(호실) 주소·면적"?(G.addr&&G.area?G.addr+" · "+G.area+"㎡":""):"";
    out.push({d,n,kind:DOC_RE.test(d)?"doc":"ask",opt:/있으면/.test(d),fill}); }
  return out; }
const docList=()=>docRows().map(r=>r.d);
const docNeed=()=>docRows().filter(r=>!r.fill&&!G.got.has(r.d));
function sheet(){
  const P=picked(), b=(BIZ.find(x=>x[0]===G.biz)||BIZ[0])[1], me=typeof ME!=="undefined"?ME:{};
  const fl={1:"지상 1층",2:"지상 2층 이상",b:"지하층"}[G.floor], man=v=>v?(+v).toLocaleString()+"만원":"–";
  const rows=[["상호",G.name||"–","대표자",G.boss||"–"],["업종",b,"소재지",G.addr||"–"],["영업장",`${fl}${G.area?" · "+G.area+"㎡":""}`,"건물",`${G.bfl?G.bfl+"층":"–"} · ${G.own==="own"?"소유":"임차"}`],["연 매출",man(G.sales),"직원 수",G.staff?G.staff+"명":"–"],["최근 사고",G.acc||"없음 (고객 진술)","보험기간",(G.from||G.till)?`${G.from||"?"} ~ ${G.till||"?"}`:"협의"]];
  const got=docRows().filter(r=>r.kind==="doc").map(r=>r.d);
  $("#sheets-gq").innerHTML=`<div class="a4 gq"><div class="row between" style="align-items:flex-end"><div><div class="pz-k" style="font-size:11px;letter-spacing:.12em;color:var(--ink2)">QUOTATION REQUEST</div><h3>일반보험 견적 요청서</h3></div><span style="font-size:12px;color:var(--ink2)">요청일 ${td()}</span></div>
   <div class="gq-to"><div><span>받는 곳</span><b>${esc(G.to.ins||"보험사")}</b> ${esc(G.to.who||"")}<br><span style="display:inline">팩스</span> ${esc(G.to.fax||"–")}</div>
    <div><span>보내는 사람</span><b>${esc(me.name||"담당 설계사")}</b> ${esc([me.company,me.branch].filter(Boolean).join(" "))}<br><span style="display:inline">연락처</span> ${esc(me.phone||"–")}</div></div>
   <div class="sec"><div class="st">사업장 정보</div><table class="pz-t"><tbody>${rows.map(r=>`<tr><td style="width:15%;color:var(--ink2)">${r[0]}</td><td style="width:35%">${esc(r[1])}</td><td style="width:15%;color:var(--ink2)">${r[2]}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody></table></div>
   <div class="sec"><div class="st">요청 담보 <span>${P.length}개</span></div><table class="pz-t"><thead><tr><th style="width:40%">종목·특약</th><th>희망 가입금액·한도</th><th style="width:18%">구분</th></tr></thead><tbody>${P.map(x=>{ const v=G.lim[x.k]!=null?G.lim[x.k]:(x.lim||""); return `<tr><td><b>${esc(x.n)}</b></td><td>${esc(v||"견적 시 제안 요청")}</td><td>${x.duty?(x.st==="y"?"의무보험":"의무 여부 확인"):"임의"}</td></tr>`; }).join("")||'<tr><td colspan="3">요청 담보를 고르세요</td></tr>'}</tbody></table></div>
   <div class="sec"><div class="st">첨부·준비 서류</div><div class="gq-docs">${got.map(d=>`<span>${G.got.has(d)?"☑":"☐"} ${esc(d)}</span>`).join("")}</div><p style="margin:2px 0 0;font-size:11.5px;color:var(--ink2)">☑ 첨부 · ☐ 요청 시 추가 제출 (질문서는 귀사 양식으로 보내 주시면 작성해 회신합니다)</p></div>
   ${G.memo?`<div class="sec"><div class="st">요청 메모</div><p style="margin:0;font-size:13px">${esc(G.memo)}</p></div>`:""}
   <div class="sec"><div class="st">회신 요청</div><p style="margin:0;font-size:13px;line-height:1.7">위 사업장의 담보별 보험료, 보상한도, 자기부담금, 특별조건(인수 조건·부담보)을 견적서로 회신 부탁드립니다. 추가로 필요한 자료가 있으면 연락 주십시오.</p></div>
   <p style="margin:auto 0 0;font-size:11px;color:var(--ink2)">본 요청서에는 주민등록번호·계좌번호 등 민감한 개인정보를 적지 않았습니다. 보낸 곳: ${esc(me.name||"")} ${esc(me.phone||"")}</p></div>`;
}
function docText(){ const c=custByName(), me=typeof ME!=="undefined"?ME:{}, N=docNeed(), ds=N.filter(r=>r.kind==="doc"), as=N.filter(r=>r.kind==="ask");
  return `${(c&&c.name)||G.boss||"사장님"}님, ${G.name?G.name+" ":""}보험 견적을 위해 ${ds.length?"아래 자료를 사진으로 보내 주세요.\n"+ds.map(r=>"- "+r.d).join("\n"):""}${as.length?(ds.length?"\n\n":"")+"아래 내용도 알려 주세요.\n"+as.map(r=>"- "+r.d.replace(/ \(있으면\)/,"")).join("\n"):""}\n주민번호·계좌번호는 보내지 마세요.\n${me.name||""} ${me.phone||""}`.trim(); }
function custByName(){ return G.cust&&typeof CUSTOMERS!=="undefined"?CUSTOMERS.find(c=>c.id===G.cust):null; }

async function pdfBlob(){
  if(!window.html2canvas||!window.jspdf) throw new Error("PDF 도구를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.");
  if(document.fonts&&document.fonts.ready) await document.fonts.ready;
  const pdf=new jspdf.jsPDF({unit:"mm",format:"a4",orientation:"portrait"}), pg=$$("#sheets-gq .a4");
  for(let i=0;i<pg.length;i++){ const cv=await (typeof capCanvas==="function"?capCanvas:html2canvas)(pg[i],{scale:2,backgroundColor:"#ffffff",useCORS:true}); if(i) pdf.addPage(); pdf.addImage(cv.toDataURL("image/jpeg",0.9),"JPEG",0,0,210,Math.min(297,210*cv.height/cv.width)); }
  return pdf.output("blob");
}
const fname=()=>`일반보험견적요청_${(G.name||G.boss||"사업장").replace(/[\\/:*?"<>|]/g,"")}_${td()}.pdf`;
const msg=t=>{ const m=$("#pdfmsg-gq"); if(m) m.textContent=t; };
function need(){ if(!picked().length){ msg("요청할 보험을 1개 이상 고르세요."); return false; } if(!G.name&&!G.boss){ msg("상호 또는 고객을 넣으세요."); return false; } return true; }

document.addEventListener("input",e=>{ const t=e.target; if(!t.closest||!t.closest("#gi-root")) return;
  if(t.id==="gi-bq"){ const L=bizFind(t.value); $("#gi-bf").innerHTML=t.value.trim().length<2?"":L.length?L.slice(0,6).map(b=>`<button type="button" data-gibq="${b[0]}">${esc(b[1])}</button>`).join(""):'<span>맞는 업종이 없습니다 — 가장 비슷한 업종을 고르고 아래 해당 항목을 직접 체크하세요</span>'; return; }
  if(t.dataset.gi){ G[t.dataset.gi]=t.value; if(t.dataset.gi==="biz"){ const b=BIZ.find(x=>x[0]===t.value); G.fl=new Set(b?b[3]:[]); G.off=new Set(); render(); return; } if(["floor","area","bfl","own","sales","acc","addr"].includes(t.dataset.gi)) paint(); else sheet(); return; }
  if(t.dataset.gito){ G.to[t.dataset.gito]=t.value; if(t.dataset.gito==="ins"){ const f=loadFax()[t.value]; if(f){ G.to.fax=f; const x=$("#gi-tofax"); if(x) x.value=f; } } sheet(); return; }
  if(t.dataset.gilim){ G.lim[t.dataset.gilim]=t.value; sheet(); return; }
});
document.addEventListener("change",e=>{ const t=e.target; if(!t.closest||!t.closest("#gi-root")) return;
  if(t.id==="gi-cust"){ const id=typeof resolveCust==="function"?resolveCust(t.value):null; G.boss=t.value; if(id){ G.cust=id; const c=CUSTOMERS.find(x=>x.id===id); G.boss=c.name;
      const k=(typeof CONTRACTS!=="undefined"?CONTRACTS:[]).find(x=>x.cust===id&&(x.bizName||x.bizType)); if(k&&k.bizName&&!G.name) G.name=k.bizName; if(c.addr1&&!G.addr) G.addr=c.addr1; render(); return; } sheet(); return; }
  if(t.dataset.gifl){ t.checked?G.fl.add(t.dataset.gifl):G.fl.delete(t.dataset.gifl); paint(); return; }
  if(t.dataset.giit){ const k=t.dataset.giit; if(t.dataset.opt){ t.checked?G.off.add("+"+k):G.off.delete("+"+k); } else { t.checked?G.off.delete(k):G.off.add(k); } paint(); return; }
  if(t.dataset.gidoc&&t.tagName!=="BUTTON"){ t.checked?G.got.add(t.dataset.gidoc):G.got.delete(t.dataset.gidoc); sheet(); return; }
});
document.addEventListener("click",async e=>{
  const t=e.target; if(t.closest('[data-lb="plan"]')){ if(!$("#gi-root").children.length) render(); return; }
  if(!t.closest||!t.closest("#gi-root")) return;
  const tb=t.closest("[data-gitab]"); if(tb){ G.tab=tb.dataset.gitab; document.querySelectorAll("#gi-root [data-gitab]").forEach(b=>b.parentElement.classList.contains("gi-tabs")&&b.setAttribute("aria-pressed",b.dataset.gitab===G.tab)); document.querySelectorAll("#gi-root .gi-pane").forEach(p=>p.hidden=p.dataset.gip!==G.tab); const o=$("#gi-root .gi-out"); if(o&&o.getBoundingClientRect().top<0) o.scrollIntoView({block:"start"}); return; }
  const bq=t.closest("[data-gibq]"); if(bq){ const b=BIZ.find(x=>x[0]===bq.dataset.gibq); if(b){ G.biz=b[0]; G.fl=new Set(b[3]); G.off=new Set(); render(); } return; }
  const db=t.closest("button[data-gidoc]"); if(db){ const d=db.dataset.gidoc; G.got.has(d)?G.got.delete(d):G.got.add(d); paint(); return; }
  const g=t.closest("[data-giglo]"); if(g){ if(typeof GLS!=="undefined"){ GLS.open=g.dataset.giglo; GLS.q=""; GLS.cat="전체"; } const b=document.querySelector('#lb-tabs [data-lb="guide"]'); if(b) b.click(); if(typeof renderGuide==="function") renderGuide(); setTimeout(()=>{ const el=document.querySelector(`[data-glo="${g.dataset.giglo}"]`); if(el) el.scrollIntoView({block:"center"}); },50); return; }
  if(t.closest("#gi-chkall")){ const ds=$$("#gi-chk details"), open=!ds.every(d=>d.open); ds.forEach(d=>d.open=open); t.closest("#gi-chkall").textContent=open?"모두 접기":"모두 펼치기"; return; }
  if(t.closest("#gi-dcopy")){ const ok=typeof copyText==="function"?await copyText(docText(),$("#gi-dmsg")):false; if(!ok&&navigator.clipboard) navigator.clipboard.writeText(docText()); $("#gi-dmsg").textContent="복사했습니다. 카카오톡·문자에 붙여넣으세요."; return; }
  if(t.closest("#gi-dsms")){ const c=custByName(), ph=String((c&&c.phone)||"").replace(/\D/g,""); if(ph.length<10){ $("#gi-dmsg").textContent="고객을 고르면(휴대폰 있음) 문자 보내기가 됩니다. 지금은 복사해서 쓰세요."; return; } location.href=`sms:${ph}?&body=${encodeURIComponent(docText())}`; return; }
  if(t.closest("#gi-pdf")){ if(!need()) return; const dl=typeof DL!=="undefined"?DL:null; if(!dl){ msg("이 화면에서는 파일 저장을 지원하지 않습니다."); return; } msg("PDF를 만드는 중입니다..."); try{ await dl.save({filename:fname(),data:await pdfBlob()}); msg("저장했습니다."); }catch(err){ msg(err&&err.code==="declined"?"저장을 취소했습니다.":(err&&err.message)||"PDF 저장에 실패했습니다."); } return; }
  if(t.closest("#gi-print")){ if(!need()) return; const w=window.open("","_blank"); if(!w){ msg("팝업이 막혀 있습니다. 팝업을 허용해 주세요."); return; } w.document.write("<p style='font-family:sans-serif;padding:20px'>출력 준비 중…</p>");
    try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; const imgs=[]; for(const pg of $$("#sheets-gq .a4")){ const cv=await (typeof capCanvas==="function"?capCanvas:html2canvas)(pg,{scale:2,backgroundColor:"#ffffff"}); imgs.push(cv.toDataURL("image/jpeg",0.92)); }
      w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>일반보험 견적 요청서</title><style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;display:block;page-break-after:always}</style></head><body>${imgs.map(s=>`<img src="${s}">`).join("")}<script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close(); msg(""); }
    catch(_){ try{ w.close(); }catch(__){} msg("출력 준비에 실패했습니다."); } return; }
  if(t.closest("#gi-fax")){ if(!need()) return; const fx=String(G.to.fax||"").replace(/\D/g,""); if(fx.length<8){ msg("받는 팩스번호를 넣으세요."); return; }
    $("#gi-faxok").innerHTML=`<div class="banner" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="flex:1"><b>${esc(G.to.ins||"보험사")}</b> ${esc(G.to.fax)}로 견적 요청서 1장을 보냅니다.</span><button class="btn primary sm" type="button" id="gi-faxgo">보내기</button><button class="btn sm" type="button" id="gi-faxno">취소</button></div>`; return; }
  if(t.closest("#gi-faxno")){ $("#gi-faxok").innerHTML=""; return; }
  if(t.closest("#gi-faxgo")){ const live=typeof faxLive==="function"&&faxLive();
    if(!live){ $("#gi-faxok").innerHTML=`<p class="note" style="margin:0">로그인한 정식 회원만 실제 팩스가 나갑니다. 체험 중에는 PDF로 저장해 확인하세요.</p>`; return; }
    const box=$("#gi-faxok"); box.innerHTML='<span class="pill warn">팩스 접수 중</span>';
    try{ const blob=await pdfBlob(), b64=await f2b64(blob);
      const j=await faxApi({action:"send",to:[{num:G.to.fax,name:(G.to.ins||"보험사").slice(0,30)}],title:`일반보험 견적요청 ${G.name||G.boss||""}`.trim(),insurer:(G.to.ins||"일반보험 견적").slice(0,40),files:[{name:fname(),b64}]});
      if(!j||!j.ok) throw new Error((j&&j.message)||"팩스 접수에 실패했습니다");
      if(G.to.ins) saveFax(G.to.ins,G.to.fax);
      box.innerHTML=`<span class="pill warn">전송 중</span> <span class="note">접수번호 ${esc(j.receiptNum||"")}${j.test?" · 테스트":""}</span>`;
      let n=0; const poll=async()=>{ n++; try{ const r=await faxApi({action:"result",receiptNum:j.receiptNum}); if(r&&r.ok&&r.overall&&r.overall!=="sending"){ box.innerHTML=r.overall==="ok"?'<span class="pill ok">전송완료</span>':'<span class="pill bad">전송실패</span> <span class="note">번호를 확인하고 다시 보내세요.</span>'; return; } }catch(_){ } if(n<8) setTimeout(poll,15000); else box.innerHTML+=' <span class="note">결과는 청구내역이 아니라 팝빌 접수번호로 확인됩니다.</span>'; };
      setTimeout(poll,15000);
    }catch(err){ box.innerHTML=`<span class="pill bad">전송실패</span> <span class="note">${esc((err&&err.message)||String(err))}</span>`; }
    return; }
});
window.GI={render,G,open(o){ Object.assign(G,o||{}); if(o&&o.fl) G.fl=new Set(o.fl); const b=document.querySelector('#lb-tabs [data-lb="plan"]'); if(b) b.click(); render(); window.scrollTo(0,0); }};
})();
