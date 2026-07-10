// 모의 상품 데이터셋
// 이마트, 롯데마트, 트레이더스, 코스트코의 상품 데이터
// 창고형마트(트레이더스, 코스트코)는 대용량 벌크 구성으로 총액은 크지만 단위 단가가 낮다는 특징을 구현

export const categories = [
  { id: 'all', name: '전체 상품', icon: '🛒' },
  { id: 'processed', name: '가공식품', icon: '🍜' },
  { id: 'fresh', name: '신선식품', icon: '🥩' },
  { id: 'beverage', name: '음료/스낵', icon: '🥤' },
  { id: 'household', name: '생활용품', icon: '🧻' }
];

export const products = [
  {
    id: 1,
    name: "농심 신라면",
    category: "processed",
    emoji: "🍜",
    description: "얼큰하고 칼칼한 대한민국 대표 라면",
    unitName: "1개",
    prices: {
      emart: { price: 4100, package: "5봉지", unitCount: 5 },
      lottemart: { price: 3980, package: "5봉지", unitCount: 5 },
      traders: { price: 21980, package: "30봉지 (박스)", unitCount: 30 },
      costco: { price: 21490, package: "30봉지 (박스)", unitCount: 30 }
    },
    history: {
      emart: [4300, 4300, 4200, 4100],
      lottemart: [3980, 4080, 3980, 3980],
      traders: [22500, 22200, 22100, 21980],
      costco: [21800, 21490, 21490, 21490]
    }
  },
  {
    id: 2,
    name: "CJ 햇반",
    category: "processed",
    emoji: "🍚",
    description: "갓 지은 밥맛 그대로, 맛있는 햇반 210g",
    unitName: "1개",
    prices: {
      emart: { price: 13900, package: "12개입", unitCount: 12 },
      lottemart: { price: 14200, package: "12개입", unitCount: 12 },
      traders: { price: 21980, package: "24개입", unitCount: 24 },
      costco: { price: 20990, package: "24개입", unitCount: 24 }
    },
    history: {
      emart: [14500, 14200, 13900, 13900],
      lottemart: [14200, 14200, 14200, 14200],
      traders: [22500, 22300, 21980, 21980],
      costco: [21500, 20990, 20990, 20990]
    }
  },
  {
    id: 3,
    name: "서울우유 나100%",
    category: "fresh",
    emoji: "🥛",
    description: "신선한 1등급 A 국산 우유 1L 기준 (또는 대용량)",
    unitName: "100ml",
    prices: {
      emart: { price: 2980, package: "1L", unitCount: 10 }, // 1000ml = 10 units of 100ml
      lottemart: { price: 2950, package: "1L", unitCount: 10 },
      traders: { price: 5480, package: "2.3L", unitCount: 23 },
      costco: { price: 5390, package: "2.3L", unitCount: 23 }
    },
    history: {
      emart: [2890, 2980, 2980, 2980],
      lottemart: [2900, 2950, 2950, 2950],
      traders: [5300, 5480, 5480, 5480],
      costco: [5200, 5390, 5390, 5390]
    }
  },
  {
    id: 4,
    name: "국산 냉장 삼겹살 구이용",
    category: "fresh",
    emoji: "🥩",
    description: "풍부한 육즙의 맛있는 국산 돈육 삼겹살",
    unitName: "100g",
    prices: {
      emart: { price: 2880, package: "100g", unitCount: 1 },
      lottemart: { price: 2980, package: "100g", unitCount: 1 },
      traders: { price: 39800, package: "2kg 벌크 (100g당 1,990원)", unitCount: 20 },
      costco: { price: 37600, package: "2kg 벌크 (100g당 1,880원)", unitCount: 20 }
    },
    history: {
      emart: [2680, 2780, 2880, 2880],
      lottemart: [2880, 2980, 2980, 2980],
      traders: [41000, 39800, 39800, 39800],
      costco: [38900, 37600, 37600, 37600]
    }
  },
  {
    id: 5,
    name: "제주삼다수",
    category: "beverage",
    emoji: "💧",
    description: "화산암반수로 시원하고 깨끗한 물 2L",
    unitName: "1병",
    prices: {
      emart: { price: 6480, package: "2L x 6개입", unitCount: 6 },
      lottemart: { price: 6400, package: "2L x 6개입", unitCount: 6 },
      traders: { price: 11400, package: "2L x 12개입", unitCount: 12 },
      costco: { price: 10990, package: "2L x 12개입", unitCount: 12 }
    },
    history: {
      emart: [6200, 6480, 6480, 6480],
      lottemart: [6400, 6400, 6400, 6400],
      traders: [11400, 11400, 11400, 11400],
      costco: [10990, 10990, 10990, 10990]
    }
  },
  {
    id: 6,
    name: "크리넥스 데코앤소프트",
    category: "household",
    emoji: "🧻",
    description: "도톰하고 부드러운 3겹 천연펄프 화장지 30m",
    unitName: "1롤",
    prices: {
      emart: { price: 27900, package: "30롤", unitCount: 30 },
      lottemart: { price: 26900, package: "30롤", unitCount: 30 },
      traders: { price: 34980, package: "40롤", unitCount: 40 },
      costco: { price: 33490, package: "40롤", unitCount: 40 }
    },
    history: {
      emart: [28900, 27900, 27900, 27900],
      lottemart: [27900, 26900, 26900, 26900],
      traders: [35900, 34980, 34980, 34980],
      costco: [34900, 33490, 33490, 33490]
    }
  },
  {
    id: 7,
    name: "코카콜라 오리지널",
    category: "beverage",
    emoji: "🥤",
    description: "짜릿한 시원함, 코카콜라 1.5L",
    unitName: "100ml",
    prices: {
      emart: { price: 3400, package: "1.5L 1병", unitCount: 15 },
      lottemart: { price: 3380, package: "1.5L 1병", unitCount: 15 },
      traders: { price: 14980, package: "1.5L x 6병", unitCount: 90 },
      costco: { price: 13990, package: "1.5L x 6병", unitCount: 90 }
    },
    history: {
      emart: [3200, 3400, 3400, 3400],
      lottemart: [3380, 3380, 3380, 3380],
      traders: [14980, 14980, 14990, 14980],
      costco: [13990, 13990, 13990, 13990]
    }
  },
  {
    id: 8,
    name: "신선한 대란 30구",
    category: "fresh",
    emoji: "🥚",
    description: "영양 가득하고 신선한 국내산 달걀 한 판",
    unitName: "1알",
    prices: {
      emart: { price: 6980, package: "30구", unitCount: 30 },
      lottemart: { price: 6880, package: "30구", unitCount: 30 },
      traders: { price: 12980, package: "60구 (대포장)", unitCount: 60 },
      costco: { price: 12490, package: "60구 (대포장)", unitCount: 60 }
    },
    history: {
      emart: [7280, 6980, 6980, 6980],
      lottemart: [6980, 6880, 6880, 6880],
      traders: [13200, 12980, 12980, 12980],
      costco: [12990, 12490, 12490, 12490]
    }
  },
  {
    id: 9,
    name: "맥심 모카골드 마일드",
    category: "processed",
    emoji: "☕",
    description: "언제 어디서나 간편하게 즐기는 부드러운 커피믹스",
    unitName: "1개입",
    prices: {
      emart: { price: 21800, package: "180T", unitCount: 180 },
      lottemart: { price: 20900, package: "180T", unitCount: 180 },
      traders: { price: 38980, package: "400T", unitCount: 400 },
      costco: { price: 37990, package: "400T", unitCount: 400 }
    },
    history: {
      emart: [22500, 22000, 21800, 21800],
      lottemart: [21900, 20900, 20900, 20900],
      traders: [39500, 38980, 38980, 38980],
      costco: [38200, 37990, 37990, 37990]
    }
  },
  {
    id: 10,
    name: "스팸 클래식 200g",
    category: "processed",
    emoji: "🥫",
    description: "따끈한 밥 위에 스팸 한 조각",
    unitName: "1캔",
    prices: {
      emart: { price: 15400, package: "4캔 묶음", unitCount: 4 },
      lottemart: { price: 14900, package: "4캔 묶음", unitCount: 4 },
      traders: { price: 27980, package: "8캔 묶음", unitCount: 8 },
      costco: { price: 26490, package: "8캔 묶음", unitCount: 8 }
    },
    history: {
      emart: [15900, 15400, 15400, 15400],
      lottemart: [15200, 14900, 14900, 14900],
      traders: [28900, 27980, 27980, 27980],
      costco: [27100, 26490, 26490, 26490]
    }
  },
  {
    id: 11,
    name: "신선한 바나나 한 송이",
    category: "fresh",
    emoji: "🍌",
    description: "든든하고 부드러운 아침 식사 대용 스위트 바나나",
    unitName: "1송이",
    prices: {
      emart: { price: 3980, package: "대 1송이", unitCount: 1 },
      lottemart: { price: 3780, package: "대 1송이", unitCount: 1 },
      traders: { price: 2980, package: "중 1송이", unitCount: 1 },
      costco: { price: 2890, package: "중 1송이", unitCount: 1 }
    },
    history: {
      emart: [4200, 3980, 3980, 3980],
      lottemart: [3880, 3780, 3780, 3780],
      traders: [3100, 2980, 2980, 2980],
      costco: [2990, 2890, 2890, 2890]
    }
  },
  {
    id: 12,
    name: "다우니 초고농축 섬유유연제",
    category: "household",
    emoji: "🌸",
    description: "오래오래 기억되는 은은한 향기 초고농축형 1L 기준",
    unitName: "100ml",
    prices: {
      emart: { price: 16800, package: "2L 1개", unitCount: 20 },
      lottemart: { price: 15900, package: "2L 1개", unitCount: 20 },
      traders: { price: 24980, package: "4L 1개", unitCount: 40 },
      costco: { price: 23990, package: "4L 1개", unitCount: 40 }
    },
    history: {
      emart: [17800, 16800, 16800, 16800],
      lottemart: [16500, 15900, 15900, 15900],
      traders: [25900, 24980, 24980, 24980],
      costco: [24500, 23990, 23990, 23990]
    }
  }
];
