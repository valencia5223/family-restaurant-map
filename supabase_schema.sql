-- ==========================================
-- 🛠️ 1. 맛집 추천 테이블 생성 스크립트
-- ==========================================

create table if not exists restaurants (
  id bigint primary key,                     -- Date.now() 로컬 타임스탬프 고유 ID (기본키)
  name text not null,                        -- 식당 상호명
  member text not null,                      -- 추천 작성자 키 (papa, mama, daughter, makdung, husband)
  region text not null,                      -- 매핑된 행정 구역 (서울, 경기, 부산, 강원)
  category text not null,                    -- 음식 카테고리 (korean, western, asian, cafe)
  rating integer not null,                   -- 추천 별점 (1~5)
  recom_menu text default '대표 메뉴',        -- 대표 먹거리 (recomMenu)
  review text not null,                      -- 한줄평 후기
  tags text[] default '{}',                  -- 태그 명세 배열
  address text,                              -- 도로명/지번 주소
  map_url text,                              -- 카카오맵 연결 링크
  coords double precision[] default '{}',    -- [위도, 경도] 좌표값 배열
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 🔒 2. 로우 레벨 보안 정책 (Row Level Security) 설정
-- 온 가족이 공동으로 자유롭게 공유·추가·삭제해야 하므로
-- 로그인 제한 없이 일반 익명(anon) 접근에 모든 권한을 오픈합니다.
-- ==========================================

alter table restaurants enable row level security;

-- (1) 조회 권한: 누구나 볼 수 있도록 설정
drop policy if exists "공개 조회 허용" on restaurants;
create policy "공개 조회 허용" on restaurants 
  for select using (true);

-- (2) 저장 권한: 누구나 저장할 수 있도록 설정
drop policy if exists "공개 저장 허용" on restaurants;
create policy "공개 저장 허용" on restaurants 
  for insert with check (true);

-- (3) 삭제 권한: 누구나 삭제할 수 있도록 설정
drop policy if exists "공개 삭제 허용" on restaurants;
create policy "공개 삭제 허용" on restaurants 
  for delete using (true);

-- ==========================================
-- 📊 3. 초기 기본 소스 데이터 (기본값) 이식
-- 로컬스토리지가 비어 있는 최초 기동 시에도 마더 맛집 4개가 노출되도록
-- Supabase DB 테이블에 다이렉트 이입합니다.
-- ==========================================

insert into restaurants (id, name, member, region, category, rating, recom_menu, review, tags, address, map_url, coords)
values 
  (
    1, 
    '30년 전통 마포설렁탕', 
    'papa', 
    '서울', 
    'korean', 
    5, 
    '특설렁탕, 접시수육', 
    '지방 출장 갔다가 서울 내리는 길에 꼭 들리는 국밥집. 맑고 깊은 국물이 일품이고 잘 익은 깍두기가 끝내준다. 해장하러 들어갔다가 술 생각나게 만드니 다들 조심하게.', 
    array['30년전통', '든든한국밥', '주차가능', '아빠원픽'], 
    '서울특별시 마포구 토정로 312', 
    'https://map.naver.com/v5/search/%EB%A7%88%ED%8F%AC%EC%84%A4%EB%A0%81%ED%83%95', 
    array[37.5407, 126.9458]
  ),
  (
    2, 
    '초록뜰 우렁 쌈밥정식', 
    'mama', 
    '경기', 
    'korean', 
    5, 
    '제육 쌈밥 정식, 우렁 더덕구이', 
    '동네 부모님들 모임 부동의 1위 고정 장소란다. 신선한 유기농 쌈 야채가 무제한이고, 구수한 강된장에 돌솥밥을 올려 싸먹으면 건강해지는 기분이야.', 
    array['신선한쌈채소', '부모님모시기좋음', '예약필수', '엄마추천'], 
    '경기도 고양시 일산동구 일산로 442', 
    'https://map.kakao.com/?q=%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EA%B3%A0%EC%96%91%EC%8B%9C%20%EC%9D%BC%EC%82%B0%EB%8F%99%EA%B5%AC%20%EC%9D%BC%EC%82%B0%EB%A1%9C%20442', 
    array[37.6625, 126.7904]
  ),
  (
    3, 
    '생면 파스타 바 ''라비올라''', 
    'husband', 
    '서울', 
    'western', 
    5, 
    '트러플 감자 뇨끼, 화이트 라구', 
    '아내와 결혼기념일에 갔던 골목 속 보석 같은 다이닝 바입니다. 매일 아침 생면을 제면해서 파스타 면이 부드럽고 속이 아주 편안합니다. 다음에 장모님 모시고 꼭 갈 예정입니다.', 
    array['생면파스타', '부드러운소화', '주차협소', '사위강추'], 
    '서울특별시 마포구 연희로1길 59', 
    'https://map.naver.com/v5/search/%EC%97%B0%EB%82%A8%EB%8F%99%20%EB%9D%BC%EB%B9%85%EC%98%AC%EB%9D%BC', 
    array[37.5612, 126.9248]
  ),
  (
    4, 
    '달콤 푸딩 ''오아시스 카페''', 
    'daughter', 
    '부산', 
    'cafe', 
    4, 
    '일본식 수제 커스터드 푸딩, 아인슈페너', 
    '주말에는 1시간 대기가 필수지만, 부드러운 수제 푸딩 한 입 먹으면 피로가 싹 가셔요! 컵도 너무 귀엽고 감성 사진 찍기 딱 좋은 우리 가족 부산 여행 필수 브런치 스폿.', 
    array['에그푸딩', '인스타감성', '웨이팅필수', '딸의추천'], 
    '부산광역시 해운대구 우동1로 38', 
    'https://map.kakao.com/?q=%EB%B6%80%EC%82%B0%EA%B2%BD%EC%83%81%20%ED%95%B4%EC%9A%B4%EB%8C%80%20%EC%98%A4%EC%95%84%EC%8B%9C%EC%8A%A4%20%EC%B9%B4%ED%8E%98', 
    array[35.1645, 129.1587]
  )
on conflict (id) do nothing;
