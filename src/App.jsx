import React, { useState, useMemo, useEffect, useRef } from 'react';
import { members, regions, foodCategories, defaultRestaurants } from './restaurantData';
import './App.css';

// Leaflet 기본 마커 이미지 깨짐 방지 핫픽스
if (typeof window !== 'undefined' && window.L) {
  delete window.L.Icon.Default.prototype._getIconUrl;
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function App() {
  // 1. 맛집 추천 리스트 상태 제어 (Local Storage 연동)
  const [restaurants, setRestaurants] = useState(() => {
    const stored = localStorage.getItem('family_restaurants');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("fail to parse family restaurants", e);
      }
    }
    return defaultRestaurants;
  });

  // 검색 및 다중 필터링 조건 상태
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // 뷰 모드 토글: 'list' (카드 모음) vs 'map' (위치 지도)
  const [viewMode, setViewMode] = useState('list');

  // 맛집 등록 모달 제어 상태
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRest, setNewRest] = useState({
    name: '',
    member: 'papa',
    region: '서울',
    category: 'korean',
    rating: 5,
    recomMenu: '',
    review: '',
    tagsInput: '',
    address: '',
    mapUrl: ''
  });
  // 자동완성 후보 리스트 상태
  const [nameSuggestions, setNameSuggestions] = useState([]);

  // 새 등록 지도용 실위도/경도 선택 상태
  const [formLat, setFormLat] = useState(37.5665);
  const [formLng, setFormLng] = useState(126.9780);

  // 2. 가족 맛집 통계 대시보드 계산 유틸리티
  const stats = useMemo(() => {
    if (restaurants.length === 0) {
      return { total: 0, topMember: '-', topFood: '-', avgRating: '0.0' };
    }

    const memberCounts = {};
    restaurants.forEach(r => {
      memberCounts[r.member] = (memberCounts[r.member] || 0) + 1;
    });
    let topMemKey = '-';
    let maxMemCount = 0;
    Object.entries(memberCounts).forEach(([k, v]) => {
      if (v > maxMemCount) {
        maxMemCount = v;
        topMemKey = k;
      }
    });

    const catCounts = {};
    restaurants.forEach(r => {
      catCounts[r.category] = (catCounts[r.category] || 0) + 1;
    });
    let topCatKey = '-';
    let maxCatCount = 0;
    Object.entries(catCounts).forEach(([k, v]) => {
      if (v > maxCatCount) {
        maxCatCount = v;
        topCatKey = k;
      }
    });

    const totalRating = restaurants.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = (totalRating / restaurants.length).toFixed(1);

    const memberName = members[topMemKey] ? `${members[topMemKey].avatar} ${members[topMemKey].name}` : '-';
    const catName = foodCategories.find(c => c.id === topCatKey)?.name || '-';

    return {
      total: restaurants.length,
      topMember: memberName,
      topFood: catName,
      avgRating
    };
  }, [restaurants]);

  // 3. 맛집 검색 & 다중 필터링 로직 구현
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      const matchMember = selectedMember === 'all' || r.member === selectedMember;
      const matchRegion = selectedRegion === 'all' || r.region === selectedRegion;
      const matchCategory = selectedCategory === 'all' || r.category === selectedCategory;
      
      const text = searchTerm.toLowerCase();
      const matchSearch = r.name.toLowerCase().includes(text) ||
                          r.recomMenu.toLowerCase().includes(text) ||
                          (r.address && r.address.toLowerCase().includes(text)) ||
                          r.review.toLowerCase().includes(text) ||
                          r.tags.some(t => t.toLowerCase().includes(text));

      return matchMember && matchRegion && matchCategory && matchSearch;
    });
  }, [restaurants, selectedMember, selectedRegion, selectedCategory, searchTerm]);

  // 4. 메인 Leaflet 맛지도 렌더링용 Effect 훅
  const mapInstanceRef = useRef(null);

  // 외부 지도 팝업에서 특정 맛집 강제 상세조회하기 인터페이스를 window에 임시 바인딩
  useEffect(() => {
    window.openDetailFromMap = (id) => {
      const target = restaurants.find(r => r.id === id);
      if (target) {
        setSelectedRestaurant(target);
      }
    };
    return () => {
      delete window.openDetailFromMap;
    };
  }, [restaurants]);

  useEffect(() => {
    // 수동 cleanup 처리
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    if (viewMode === 'map' && window.L) {
      // 1. 전국 지도 초기 세팅 (대전 기준 중앙 정렬)
      const map = window.L.map('family-map').setView([36.3, 127.8], 7.5);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      mapInstanceRef.current = map;

      // 2. 필터링된 맛집들을 마커로 매핑
      filteredRestaurants.forEach(rest => {
        if (rest.coords && rest.coords.length === 2) {
          const [lat, lng] = rest.coords;
          const memInfo = members[rest.member] || { avatar: '👤', name: '가족' };
          
          const popupContent = `
            <div class="leaflet-bistro-popup">
              <h4>${rest.name}</h4>
              <p class="pop-recommender">${memInfo.avatar} ${memInfo.name} 추천</p>
              <p class="pop-rating">⭐ ${rest.rating} / 5.0</p>
              <p class="pop-review">"${rest.review.slice(0, 40)}..."</p>
              <p class="pop-address">${rest.address || '주소 미기입'}</p>
              <div class="pop-links">
                ${rest.mapUrl ? `<a href="${rest.mapUrl}" target="_blank" class="pop-map-btn">지도 바로가기 ↗</a>` : ''}
                <button onclick="window.openDetailFromMap(${rest.id})" class="pop-detail-btn">상세보기</button>
              </div>
            </div>
          `;

          window.L.marker([lat, lng]).addTo(map).bindPopup(popupContent);
        }
      });

      // 만일 필터링된 식당이 있고 1개라면 그 식당 기준 줌포커스 적용
      if (filteredRestaurants.length === 1 && filteredRestaurants[0].coords) {
        map.setView(filteredRestaurants[0].coords, 14);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, filteredRestaurants]);

  // 5. 모달 내 핀드롭 미니 맛지도 Effect
  useEffect(() => {
    let miniMapInstance = null;
    if (isAddingNew && window.L) {
      // 폼 구역 미니 맵 (초기값 서울시청)
      const miniMap = window.L.map('mini-map').setView([37.5665, 126.9780], 11);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(miniMap);

      const marker = window.L.marker([37.5665, 126.9780], { draggable: true }).addTo(miniMap);
      marker.bindPopup("이 마커를 움직여 맛집 위치를 지정하세요.<br/>(드래그 혹은 맵 클릭 가능)").openPopup();

      miniMapInstance = miniMap;

      // 클릭 시 핀 이동 및 좌표 반환
      miniMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setFormLat(parseFloat(lat.toFixed(6)));
        setFormLng(parseFloat(lng.toFixed(6)));
      });

      // 드래그 종료 시 좌표 반환
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setFormLat(parseFloat(pos.lat.toFixed(6)));
        setFormLng(parseFloat(pos.lng.toFixed(6)));
      });
    }

    return () => {
      if (miniMapInstance) {
        miniMapInstance.remove();
      }
    };
  }, [isAddingNew]);

  // 6. 새로운 맛집 정보 최종 등록 함수
  const saveNewRecommendation = (e) => {
    e.preventDefault();
    if (!newRest.name.trim()) return alert("식당 이름을 적어주세요.");
    if (!newRest.review.trim()) return alert("식당 후기를 적어주세요.");

    // 입력된 콤마 구분 태그 파싱
    const cleanTags = newRest.tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const addedObj = {
      id: Date.now(),
      name: newRest.name.trim(),
      member: newRest.member,
      region: newRest.region,
      category: newRest.category,
      rating: parseInt(newRest.rating, 10),
      recomMenu: newRest.recomMenu.trim() || '전체 대표 메뉴',
      review: newRest.review.trim(),
      tags: cleanTags.length > 0 ? cleanTags : ['추천맛집'],
      address: newRest.address.trim() || '주소 정보 없음',
      mapUrl: newRest.mapUrl.trim() || null,
      coords: [formLat, formLng]
    };

    const updatedList = [...restaurants, addedObj];
    setRestaurants(updatedList);
    localStorage.setItem('family_restaurants', JSON.stringify(updatedList));

    // 상태 초기화
    setIsAddingNew(false);
    setNewRest({
      name: '',
      member: 'papa',
      region: '서울',
      category: 'korean',
      rating: 5,
      recomMenu: '',
      review: '',
      tagsInput: '',
      address: '',
      mapUrl: ''
    });
    setFormLat(37.5665);
    setFormLng(126.9780);
  };

  // 7. 맛집 추천 삭제 기능
  const deleteRecommendation = (id, e) => {
    e.stopPropagation();
    if (!window.confirm("정말 이 맛집 추천을 삭제하시겠습니까?")) return;
    
    const updatedList = restaurants.filter(r => r.id !== id);
    setRestaurants(updatedList);
    localStorage.setItem('family_restaurants', JSON.stringify(updatedList));
    if (selectedRestaurant && selectedRestaurant.id === id) {
      setSelectedRestaurant(null);
    }
  };

  return (
    <div className="bistro-app">
      {/* 1. 맛집 헤더 영역 */}
      <header className="bistro-header">
        <div className="header-icon">🧭</div>
        <h1>우리 가족 비밀 맛집 지도</h1>
        <p className="subtitle">아빠, 엄마, 딸, 사위가 발로 직접 찾아낸 맛집 공유 보관소</p>
        
        {/* 실시간 등록 단추 */}
        <button className="add-bistro-btn" onClick={() => setIsAddingNew(true)}>
          ✍️ 내가 검증한 맛집 추천하기
        </button>
      </header>

      {/* 2. 대시보드 스탯 요약 영역 */}
      <section className="stats-dashboard">
        <div className="stat-card">
          <span className="stat-num">{stats.total}개</span>
          <span className="stat-label">보관 맛집 수</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.topMember}</span>
          <span className="stat-label">최다 맛집 헌터</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.topFood}</span>
          <span className="stat-label">가족 선호 음식 1위</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">⭐ {stats.avgRating}</span>
          <span className="stat-label">가족 평균 리뷰 별점</span>
        </div>
      </section>

      {/* 3. 검색 및 상세 다중 필터 */}
      <section className="search-filter-section">
        {/* 키워드 검색창 */}
        <div className="search-box">
          <span className="search-i">🔍</span>
          <input 
            type="text" 
            placeholder="식당명, 대표 메뉴, 주소, 태그 키워드 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}
        </div>

        {/* 미세 필터 셀렉트 */}
        <div className="select-filters">
          <div className="filter-group">
            <label>지역 선택</label>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>요리 종류</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              {foodCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* 4. 가족 멤버별 필터링 아바타 바 */}
      <section className="member-filter-panel">
        <h3>🙋‍♂️ 누구의 맛집을 열어볼까요?</h3>
        <div className="avatar-row">
          {Object.entries(members).map(([key, mem]) => (
            <button
              key={key}
              className={`avatar-button ${selectedMember === key ? 'active' : ''}`}
              onClick={() => setSelectedMember(key)}
            >
              <span className="avatar-icon">{mem.avatar}</span>
              <span className="avatar-name">{mem.name}</span>
              <span className="avatar-role">{mem.role}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 5. 보기 모드 토글 탭 (카드 뷰 vs 지리 지도 뷰) */}
      <section className="view-mode-tabs">
        <button 
          className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`} 
          onClick={() => setViewMode('list')}
        >
          📋 카드 보관함 목록 보기
        </button>
        <button 
          className={`tab-btn ${viewMode === 'map' ? 'active' : ''}`} 
          onClick={() => setViewMode('map')}
        >
          🗺️ 맛집 전국 지도 보기
        </button>
      </section>

      {/* 6. 맛집 출력 메인 화면 */}
      <main className="bistro-main">
        {viewMode === 'list' ? (
          filteredRestaurants.length > 0 ? (
            <div className="bistro-grid">
              {filteredRestaurants.map(rest => {
                const memInfo = members[rest.member] || { avatar: '👤', name: '가족', role: '식구' };
                const categoryEmoji = foodCategories.find(c => c.id === rest.category)?.name.split(' ').pop() || '🍚';
                
                return (
                  <div 
                    key={rest.id} 
                    className="bistro-card"
                    onClick={() => setSelectedRestaurant(rest)}
                  >
                    <div className="card-header">
                      <span className="region-tag">{rest.region}</span>
                      <span className="category-emoji">{categoryEmoji}</span>
                    </div>

                    <h3 className="restaurant-title">{rest.name}</h3>
                    
                    {/* 추천 헌터 배지 */}
                    <div className="recommender-badge">
                      <span className="avatar-mini">{memInfo.avatar}</span>
                      <span>{memInfo.name} 추천</span>
                    </div>

                    <hr className="card-divider" />

                    <div className="rating-row">
                      {"★".repeat(rest.rating)}{"☆".repeat(5 - rest.rating)}
                    </div>

                    <p className="card-address-peek">📍 {rest.address || '주소 정보 없음'}</p>

                    <p className="card-peek-review">"{rest.review}"</p>

                    <div className="card-footer-links" onClick={(e) => e.stopPropagation()}>
                      {rest.mapUrl ? (
                        <a href={rest.mapUrl} target="_blank" rel="noopener noreferrer" className="external-map-link">
                          지도에서 길찾기 ↗
                        </a>
                      ) : (
                        <span className="no-map-link">주도로 경로 없음</span>
                      )}
                    </div>

                    <div className="card-tags">
                      {rest.tags.map((t, idx) => <span key={idx} className="tag-pill">#{t}</span>)}
                    </div>

                    {/* 삭제 버튼 */}
                    <button 
                      className="card-delete-btn" 
                      onClick={(e) => deleteRecommendation(rest.id, e)}
                      title="맛집 삭제"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-restaurants">
              <div className="empty-graphic">🍲</div>
              <h3>부합하는 맛집 추천이 없습니다.</h3>
              <p>필터를 초기화하거나 다른 검색어로 입력해 보세요.</p>
              <button className="reset-filter-btn" onClick={() => {
                setSelectedMember('all');
                setSelectedRegion('all');
                setSelectedCategory('all');
                setSearchTerm('');
              }}>
                검색 조건 리셋
              </button>
            </div>
          )
        ) : (
          /* 지도 보기 모드 */
          <div className="map-view-wrapper">
            {filteredRestaurants.length === 0 && (
              <div className="map-empty-alert">
                ⚠️ 선택된 필터 조건에 지도상 표출 가능한 맛집이 없습니다.
              </div>
            )}
            <div id="family-map"></div>
          </div>
        )}
      </main>

      {/* 7. 맛집 상세 정보 팝업 모달 */}
      {selectedRestaurant && (
        <div className="modal-overlay" onClick={() => setSelectedRestaurant(null)}>
          <div className="modal-content b-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedRestaurant(null)}>×</button>
            
            <div className="modal-head">
              <span className="modal-region">{selectedRestaurant.region}</span>
              <h2>{selectedRestaurant.name}</h2>
              <div className="modal-recommender">
                <span>추천 헌터:</span>
                <strong>
                  {members[selectedRestaurant.member]?.avatar} {members[selectedRestaurant.member]?.name} ({members[selectedRestaurant.member]?.role})
                </strong>
              </div>
            </div>

            <hr className="divider" />

            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">🌟 가족 추천 단독 평점</span>
                <div className="stars-holder">
                  {"★".repeat(selectedRestaurant.rating)}{"☆".repeat(5 - selectedRestaurant.rating)}
                  <span className="score-num">({selectedRestaurant.rating} / 5.0)</span>
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">📍 식당 도로명 주소</span>
                <p className="detailed-address">{selectedRestaurant.address || '주소 정보가 기입되지 않았습니다.'}</p>
              </div>

              {selectedRestaurant.mapUrl && (
                <div className="detail-row">
                  <span className="detail-label">🗺️ 외부 네이버 / 카카오 지도 바로가기</span>
                  <a href={selectedRestaurant.mapUrl} target="_blank" rel="noopener noreferrer" className="modal-external-map-btn">
                    🗺️ 실제 지도에서 링크 열기 ↗
                  </a>
                </div>
              )}

              <div className="detail-row">
                <span className="detail-label">🍲 추천 대표 메뉴</span>
                <p className="highlight-menu">{selectedRestaurant.recomMenu}</p>
              </div>

              <div className="detail-row">
                <span className="detail-label">💬 생생 검증 한줄평</span>
                <p className="detailed-review">"{selectedRestaurant.review}"</p>
              </div>

              <div className="detail-row border-none">
                <span className="detail-label">🏷️ 추천 포인트 태그</span>
                <div className="detail-tags">
                  {selectedRestaurant.tags.map((t, idx) => <span key={idx} className="tag-item">#{t}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. 새 맛집 추천 등록 모달 작성지 */}
      {isAddingNew && (
        <div className="modal-overlay" onClick={() => setIsAddingNew(false)}>
          <div className="modal-content b-add-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsAddingNew(false)}>×</button>
            
            <h2>✍️ 신규 가족 맛집 추천서 작성</h2>
            <p className="form-helper">가족들에게 자신 있게 추천할 맛집의 지점명, 지점주소, 네이버/카카오 지도 주소록 외부 링크를 입력해 주세요.</p>
            
            <form onSubmit={saveNewRecommendation}>
              <div className="form-group row-fields">
                <div>
                  <label>식당 명칭 (필수)</label>
                  <input 
                    type="text" 
                    placeholder="예: 영진돼지국밥 대연점" 
                    value={newRest.name}
                    onChange={(e) => setNewRest({...newRest, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label>추천 작성자</label>
                  <select 
                    value={newRest.member}
                    onChange={(e) => setNewRest({...newRest, member: e.target.value})}
                  >
                    <option value="papa">아빠 👨‍💼</option>
                    <option value="mama">엄마 👩‍🍳</option>
                    <option value="husband">사위 🙋‍♂️</option>
                    <option value="daughter">딸 🙋‍♀️</option>
                  </select>
                </div>
              </div>

              <div className="form-group row-fields select-three">
                <div>
                  <label>도시 구역</label>
                  <select 
                    value={newRest.region}
                    onChange={(e) => setNewRest({...newRest, region: e.target.value})}
                  >
                    <option value="서울">서울 🗼</option>
                    <option value="경기">경기 🌳</option>
                    <option value="부산">부산 🌊</option>
                    <option value="강원">강원 🏔️</option>
                  </select>
                </div>
                <div>
                  <label>메뉴 종류</label>
                  <select 
                    value={newRest.category}
                    onChange={(e) => setNewRest({...newRest, category: e.target.value})}
                  >
                    <option value="korean">든든 한식 🍚</option>
                    <option value="western">근사 양식 🍝</option>
                    <option value="asian">일/중식/아시안 🍣</option>
                    <option value="cafe">카페/디저트 ☕</option>
                  </select>
                </div>
                <div>
                  <label>내 추천 별점</label>
                  <select 
                    value={newRest.rating}
                    onChange={(e) => setNewRest({...newRest, rating: e.target.value})}
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (강력 추천)</option>
                    <option value={4}>⭐⭐⭐⭐ (추천)</option>
                    <option value={3}>⭐⭐⭐ (평범함)</option>
                    <option value={2}>⭐⭐ (아쉬움)</option>
                    <option value={1}>⭐ (비추)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>업체 도로명 / 지번 주소</label>
                <input 
                  type="text" 
                  placeholder="예: 부산광역시 해운대구 우동1로 38" 
                  value={newRest.address}
                  onChange={(e) => setNewRest({...newRest, address: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>네이버 / 카카오 지도 외부 웹 링크</label>
                <input 
                  type="url" 
                  placeholder="예: https://map.naver.com/v5/entry/place/... 혹은 복사한 링크" 
                  value={newRest.mapUrl}
                  onChange={(e) => setNewRest({...newRest, mapUrl: e.target.value})}
                />
              </div>

              {/* 지리 핀 설정용 대화형 미니 지도 위젯 */}
              <div className="form-group">
                <label>📍 지도 위치 핀 드롭 선택 (미니맵을 직접 클릭해 마커의 위경도를 저장하세요)</label>
                <div id="mini-map"></div>
                <div className="mini-map-coord-display">
                  선택 좌표: 위도 <strong>{formLat}</strong>, 경도 <strong>{formLng}</strong>
                </div>
              </div>

              <div className="form-group">
                <label>이 식당의 꼭 먹어야 마땅할 요리</label>
                <input 
                  type="text" 
                  placeholder="예: 수육백반, 순대국밥" 
                  value={newRest.recomMenu}
                  onChange={(e) => setNewRest({...newRest, recomMenu: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>조언 섞인 한줄평 (필수)</label>
                <textarea 
                  placeholder="추천 이유, 팁, 주차 정보 등을 자유롭게 작성하세요." 
                  rows={3}
                  value={newRest.review}
                  onChange={(e) => setNewRest({...newRest, review: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>추천 성향 키워드 (쉼표로 구분)</label>
                <input 
                  type="text" 
                  placeholder="예: 주차편리, 웨이팅숨참, 노포맛집, 오션뷰" 
                  value={newRest.tagsInput}
                  onChange={(e) => setNewRest({...newRest, tagsInput: e.target.value})}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-act-btn" onClick={() => setIsAddingNew(false)}>취소</button>
                <button type="submit" className="submit-act-btn">가족 지도형 보관소에 제출</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
