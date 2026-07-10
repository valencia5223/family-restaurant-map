export const members = {
  all: { avatar: '👪', name: '가족 전체', role: '우리 가족' },
  papa: { avatar: '👨‍💼', name: '아빠', role: '부모님' },
  mama: { avatar: '👩‍🍳', name: '엄마', role: '부모님' },
  husband: { avatar: '🙋‍♂️', name: '사위', role: '유서방' },
  daughter: { avatar: '🙋‍♀️', name: '딸', role: '우리딸' }
};

export const regions = [
  { id: 'all', name: '전국 맛지도🗺️' },
  { id: '서울', name: '서울 🗼' },
  { id: '경기', name: '경기/인천 🌳' },
  { id: '부산', name: '부산/경상 🌊' },
  { id: '강원', name: '강원/기타 🏔️' }
];

export const foodCategories = [
  { id: 'all', name: '모든 요리' },
  { id: 'korean', name: '든든 한식 🍚' },
  { id: 'western', name: '근사 양식 🍝' },
  { id: 'asian', name: '일식/중식/아시안 🍣' },
  { id: 'cafe', name: '카페/디저트 ☕' }
];

export const defaultRestaurants = [
  {
    id: 1,
    name: "30년 전통 마포설렁탕",
    member: "papa",
    region: "서울",
    category: "korean",
    rating: 5,
    recomMenu: "특설렁탕, 접시수육",
    review: "지방 출장 갔다가 서울 내리는 길에 꼭 들리는 국밥집. 맑고 깊은 국물이 일품이고 잘 익은 깍두기가 끝내준다. 해장하러 들어갔다가 술 생각나게 만드니 다들 조심하게.",
    tags: ["30년전통", "든든한국밥", "주차가능", "아빠원픽"],
    address: "서울특별시 마포구 토정로 312",
    mapUrl: "https://map.naver.com/v5/search/%EB%A7%88%ED%8F%AC%EC%84%A4%EB%A0%81%ED%83%95",
    coords: [37.5407, 126.9458]
  },
  {
    id: 2,
    name: "초록뜰 우렁 쌈밥정식",
    member: "mama",
    region: "경기",
    category: "korean",
    rating: 5,
    recomMenu: "제육 쌈밥 정식, 우렁 더덕구이",
    review: "동네 부모님들 모임 부동의 1위 고정 장소란다. 신선한 유기농 쌈 야채가 무제한이고, 구수한 강된장에 돌솥밥을 올려 싸먹으면 건강해지는 기분이야.",
    tags: ["신선한쌈채소", "부모님모시기좋음", "예약필수", "엄마추천"],
    address: "경기도 고양시 일산동구 일산로 442",
    mapUrl: "https://map.kakao.com/?q=%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EA%B3%A0%EC%96%91%EC%8B%9C%20%EC%9D%BC%EC%82%B0%EB%8F%99%EA%B5%AC%20%EC%9D%BC%EC%82%B0%EB%A1%9C%20442",
    coords: [37.6625, 126.7904]
  },
  {
    id: 3,
    name: "생면 파스타 바 '라비올라'",
    member: "husband",
    region: "서울",
    category: "western",
    rating: 5,
    recomMenu: "트러플 감자 뇨끼, 화이트 라구",
    review: "아내와 결혼기념일에 갔던 골목 속 보석 같은 다이닝 바입니다. 매일 아침 생면을 제면해서 파스타 면이 부드럽고 속이 아주 편안합니다. 다음에 장모님 모시고 꼭 갈 예정입니다.",
    tags: ["생면파스타", "부드러운소화", "주차협소", "사위강추"],
    address: "서울특별시 마포구 연희로1길 59",
    mapUrl: "https://map.naver.com/v5/search/%EC%97%B0%EB%82%A8%EB%8F%99%20%EB%9D%BC%EB%B9%85%EC%98%AC%EB%9D%BC",
    coords: [37.5612, 126.9248]
  },
  {
    id: 4,
    name: "달콤 푸딩 '오아시스 카페'",
    member: "daughter",
    region: "부산",
    category: "cafe",
    rating: 4,
    recomMenu: "일본식 수제 커스터드 푸딩, 아인슈페너",
    review: "주말에는 1시간 대기가 필수지만, 부드러운 수제 푸딩 한 입 먹으면 피로가 싹 가셔요! 컵도 너무 귀엽고 감성 사진 찍기 딱 좋은 우리 가족 부산 여행 필수 브런치 스폿.",
    tags: ["에그푸딩", "인스타감성", "웨이팅필수", "딸의추천"],
    address: "부산광역시 해운대구 우동1로 38",
    mapUrl: "https://map.kakao.com/?q=%EB%B6%80%EC%82%B0%EA%B2%BD%EC%83%81%20%ED%95%B4%EC%9A%B4%EB%8C%80%20%EC%98%A4%EC%95%84%EC%8B%9C%EC%8A%A4%20%EC%B9%B4%ED%8E%98",
    coords: [35.1645, 129.1587]
  }
];
