import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { members, regions, foodCategories, defaultRestaurants } from './restaurantData';
import './App.css';

// ──────────────────────────────────────────────────
// 주소 → 지역 자동 매핑 헬퍼
// ──────────────────────────────────────────────────
function mapAddressToRegion(address) {
  if (!address) return '서울';
  if (address.includes('서울')) return '서울';
  if (address.includes('경기') || address.includes('인천')) return '경기';
  if (address.includes('부산') || address.includes('경상') || address.includes('대구') || address.includes('울산')) return '부산';
  return '강원';
}

// 카카오 카테고리 코드 → 음식 종류 자동 매핑 헬퍼
function mapKakaoCategory(categoryGroupCode, categoryName) {
  if (categoryGroupCode === 'CE7') return 'cafe'; // 카페
  if (categoryGroupCode === 'FD6') {
    const name = categoryName || '';
    if (name.includes('일식') || name.includes('중식') || name.includes('동남아') || name.includes('아시안')) return 'asian';
    if (name.includes('양식') || name.includes('이탈리안') || name.includes('프렌치') || name.includes('멕시칸')) return 'western';
    if (name.includes('카페') || name.includes('디저트')) return 'cafe';
    return 'korean';
  }
  return 'korean';
}

// ──────────────────────────────────────────────────
// 메인 App 컴포넌트
// ──────────────────────────────────────────────────
function App() {
  // 카카오맵 SDK 로드 완료 상태 (autoload=false 방식)
  const [kakaoLoaded, setKakaoLoaded] = useState(false);

  useEffect(() => {
    // window.kakao 가 준비될 때까지 폴링 (최대 5초)
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (window.kakao && window.kakao.maps) {
        clearInterval(poll);
        window.kakao.maps.load(() => {
          console.log('[카카오맵] SDK 초기화 완료 ✅');
          setKakaoLoaded(true);
        });
      } else if (attempts > 100) {
        clearInterval(poll);
        console.error('[카카오맵] SDK 로드 실패 — 도메인 등록 또는 API 키 확인 필요');
      }
    }, 50);
    return () => clearInterval(poll);
  }, []);


  // 1. 맛집 추천 리스트 상태 제어 (Local Storage 연동)
  const [restaurants, setRestaurants] = useState(() => {
    const stored = localStorage.getItem('family_restaurants');
    if (stored) {
      try { return JSON.parse(stored); }
      catch (e) { console.error('parse error', e); }
    }
    return defaultRestaurants;
  });

  // 검색 및 다중 필터링 조건 상태
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // 뷰 모드 토글: 'list' vs 'map'
  const [viewMode, setViewMode] = useState('list');

  // 맛집 등록 모달 제어 상태
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRest, setNewRest] = useState({
    name: '', member: 'papa', region: '서울', category: 'korean',
    rating: 5, recomMenu: '', review: '', tagsInput: '', address: '', mapUrl: ''
  });

  // 자동완성 후보 리스트 상태
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // 새 등록 지도용 위도/경도
  const [formLat, setFormLat] = useState(37.5665);
  const [formLng, setFormLng] = useState(126.9780);

  // 카카오맵 인스턴스 ref
  const mainMapRef = useRef(null);
  const miniMapRef = useRef(null);
  const miniMarkerRef = useRef(null);
  const mainMarkersRef = useRef([]);

  // ──────────────────────────────────────────────────
  // 2. 대시보드 통계 계산
  // ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (restaurants.length === 0) return { total: 0, topMember: '-', topFood: '-', avgRating: '0.0' };
    const memberCounts = {};
    restaurants.forEach(r => { memberCounts[r.member] = (memberCounts[r.member] || 0) + 1; });
    let topMemKey = '-', maxMemCount = 0;
    Object.entries(memberCounts).forEach(([k, v]) => { if (v > maxMemCount) { maxMemCount = v; topMemKey = k; } });
    const catCounts = {};
    restaurants.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    let topCatKey = '-', maxCatCount = 0;
    Object.entries(catCounts).forEach(([k, v]) => { if (v > maxCatCount) { maxCatCount = v; topCatKey = k; } });
    const avgRating = (restaurants.reduce((s, r) => s + r.rating, 0) / restaurants.length).toFixed(1);
    const memberName = members[topMemKey] ? `${members[topMemKey].avatar} ${members[topMemKey].name}` : '-';
    const catName = foodCategories.find(c => c.id === topCatKey)?.name || '-';
    return { total: restaurants.length, topMember: memberName, topFood: catName, avgRating };
  }, [restaurants]);

  // ──────────────────────────────────────────────────
  // 3. 검색 & 다중 필터링
  // ──────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────
  // 4-A. 카카오 장소 검색 자동완성 (디바운스 300ms)
  // ──────────────────────────────────────────────────
  const handleNameInput = useCallback((value) => {
    setNewRest(prev => ({ ...prev, name: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.length < 2) {
      setNameSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        console.warn('[자동완성] SDK 미로드. kakaoLoaded 상태:', kakaoLoaded);
        return;
      }
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(value, (data, status) => {
        console.log('[자동완성] 검색 결과:', status, data?.length, data);
        if (status === window.kakao.maps.services.Status.OK) {
          setNameSuggestions(data.slice(0, 6));
          setShowSuggestions(true);
        } else {
          setNameSuggestions([]);
          setShowSuggestions(false);
        }
      });
    }, 300);
  }, [kakaoLoaded]);


  // 자동완성 항목 선택 → 필드 자동채움
  const handleSuggestionSelect = useCallback((place) => {
    const address = place.road_address_name || place.address_name || '';
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    const region = mapAddressToRegion(address);
    const category = mapKakaoCategory(place.category_group_code, place.category_name);
    const mapUrl = place.place_url || '';

    setNewRest(prev => ({
      ...prev,
      name: place.place_name,
      address,
      mapUrl,
      region,
      category,
    }));
    setFormLat(lat);
    setFormLng(lng);
    setNameSuggestions([]);
    setShowSuggestions(false);

    // 미니맵 마커도 이동
    if (miniMapRef.current && miniMarkerRef.current && window.kakao) {
      const moveLatLng = new window.kakao.maps.LatLng(lat, lng);
      miniMarkerRef.current.setPosition(moveLatLng);
      miniMapRef.current.setCenter(moveLatLng);
    }
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ──────────────────────────────────────────────────
  // 4-B. 외부 지도 팝업에서 상세보기 인터페이스
  // ──────────────────────────────────────────────────
  useEffect(() => {
    window.openDetailFromMap = (id) => {
      const target = restaurants.find(r => r.id === id);
      if (target) setSelectedRestaurant(target);
    };
    return () => { delete window.openDetailFromMap; };
  }, [restaurants]);

  // ──────────────────────────────────────────────────
  // 5. 메인 카카오맵 렌더링
  // ──────────────────────────────────────────────────
  useEffect(() => {
    // 기존 인스턴스 정리
    if (mainMapRef.current) {
      mainMapRef.current = null;
    }
    if (viewMode !== 'map') return;
    if (!window.kakao || !window.kakao.maps) return;

    const container = document.getElementById('family-map');
    if (!container) return;

    const options = { center: new window.kakao.maps.LatLng(36.3, 127.8), level: 9 };
    const map = new window.kakao.maps.Map(container, options);
    mainMapRef.current = map;
    mainMarkersRef.current = [];

    filteredRestaurants.forEach(rest => {
      if (!rest.coords || rest.coords.length !== 2) return;
      const [lat, lng] = rest.coords;
      const memInfo = members[rest.member] || { avatar: '👤', name: '가족' };

      const markerPosition = new window.kakao.maps.LatLng(lat, lng);
      const marker = new window.kakao.maps.Marker({ position: markerPosition });
      marker.setMap(map);
      mainMarkersRef.current.push(marker);

      const infoContent = `
        <div style="padding:14px 16px;min-width:200px;font-family:'Pretendard',sans-serif;border-radius:12px;">
          <strong style="font-size:15px;">${rest.name}</strong>
          <p style="margin:4px 0;font-size:12px;color:#888;">${memInfo.avatar} ${memInfo.name} 추천 &nbsp;⭐ ${rest.rating}/5</p>
          <p style="margin:4px 0;font-size:12px;color:#555;">${rest.address || '주소 미기입'}</p>
          <div style="margin-top:8px;display:flex;gap:6px;">
            ${rest.mapUrl ? `<a href="${rest.mapUrl}" target="_blank" style="font-size:11px;background:#FEE500;color:#3C1E1E;padding:4px 10px;border-radius:20px;text-decoration:none;font-weight:600;">카카오맵 열기 ↗</a>` : ''}
            <button onclick="window.openDetailFromMap(${rest.id})" style="font-size:11px;background:#FF6F3D;color:#fff;padding:4px 10px;border-radius:20px;border:none;cursor:pointer;font-weight:600;">상세보기</button>
          </div>
        </div>`;

      const infowindow = new window.kakao.maps.InfoWindow({ content: infoContent, removable: true });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(map, marker);
      });
    });

    // 필터 결과가 1개면 해당 위치로 포커스
    if (filteredRestaurants.length === 1 && filteredRestaurants[0].coords) {
      const [lat, lng] = filteredRestaurants[0].coords;
      map.setCenter(new window.kakao.maps.LatLng(lat, lng));
      map.setLevel(4);
    }
  }, [viewMode, filteredRestaurants]);

  // ──────────────────────────────────────────────────
  // 6. 등록 모달 미니 카카오맵 렌더링
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isAddingNew) {
      miniMapRef.current = null;
      miniMarkerRef.current = null;
      return;
    }
    if (!window.kakao || !window.kakao.maps) return;

    const container = document.getElementById('mini-map');
    if (!container) return;

    const latLng = new window.kakao.maps.LatLng(formLat, formLng);
    const options = { center: latLng, level: 5 };
    const miniMap = new window.kakao.maps.Map(container, options);
    miniMapRef.current = miniMap;

    const marker = new window.kakao.maps.Marker({ position: latLng, draggable: true });
    marker.setMap(miniMap);
    miniMarkerRef.current = marker;

    // 지도 클릭으로 마커 이동
    window.kakao.maps.event.addListener(miniMap, 'click', (mouseEvent) => {
      const latlng = mouseEvent.latLng;
      marker.setPosition(latlng);
      setFormLat(parseFloat(latlng.getLat().toFixed(6)));
      setFormLng(parseFloat(latlng.getLng().toFixed(6)));
    });

    // 마커 드래그 종료
    window.kakao.maps.event.addListener(marker, 'dragend', () => {
      const pos = marker.getPosition();
      setFormLat(parseFloat(pos.getLat().toFixed(6)));
      setFormLng(parseFloat(pos.getLng().toFixed(6)));
    });
  }, [isAddingNew]);

  // ──────────────────────────────────────────────────
  // 7. 새 맛집 등록 저장
  // ──────────────────────────────────────────────────
  const saveNewRecommendation = (e) => {
    e.preventDefault();
    if (!newRest.name.trim()) return alert('식당 이름을 적어주세요.');
    if (!newRest.review.trim()) return alert('식당 후기를 적어주세요.');

    const cleanTags = newRest.tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

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
    setIsAddingNew(false);
    setNewRest({ name: '', member: 'papa', region: '서울', category: 'korean', rating: 5, recomMenu: '', review: '', tagsInput: '', address: '', mapUrl: '' });
    setFormLat(37.5665);
    setFormLng(126.9780);
  };

  // ──────────────────────────────────────────────────
  // 8. 맛집 삭제
  // ──────────────────────────────────────────────────
  const deleteRecommendation = (id, e) => {
    e.stopPropagation();
    if (!window.confirm('정말 이 맛집 추천을 삭제하시겠습니까?')) return;
    const updatedList = restaurants.filter(r => r.id !== id);
    setRestaurants(updatedList);
    localStorage.setItem('family_restaurants', JSON.stringify(updatedList));
    if (selectedRestaurant && selectedRestaurant.id === id) setSelectedRestaurant(null);
  };

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────
  return (
    <div className="bistro-app">
      {/* 헤더 */}
      <header className="bistro-header">
        <div className="header-icon">🧭</div>
        <h1>우리 가족 비밀 맛집 지도</h1>
        <p className="subtitle">아빠, 엄마, 딸, 사위가 발로 직접 찾아낸 맛집 공유 보관소</p>
        <button className="add-bistro-btn" onClick={() => setIsAddingNew(true)}>
          ✍️ 내가 검증한 맛집 추천하기
        </button>
      </header>

      {/* 대시보드 */}
      <section className="stats-dashboard">
        <div className="stat-card"><span className="stat-num">{stats.total}개</span><span className="stat-label">보관 맛집 수</span></div>
        <div className="stat-card"><span className="stat-num">{stats.topMember}</span><span className="stat-label">최다 맛집 헌터</span></div>
        <div className="stat-card"><span className="stat-num">{stats.topFood}</span><span className="stat-label">가족 선호 음식 1위</span></div>
        <div className="stat-card"><span className="stat-num">⭐ {stats.avgRating}</span><span className="stat-label">가족 평균 리뷰 별점</span></div>
      </section>

      {/* 검색 필터 */}
      <section className="search-filter-section">
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

      {/* 가족 멤버 필터 */}
      <section className="member-filter-panel">
        <h3>🙋‍♂️ 누구의 맛집을 열어볼까요?</h3>
        <div className="avatar-row">
          {Object.entries(members).map(([key, mem]) => (
            <button key={key} className={`avatar-button ${selectedMember === key ? 'active' : ''}`} onClick={() => setSelectedMember(key)}>
              <span className="avatar-icon">{mem.avatar}</span>
              <span className="avatar-name">{mem.name}</span>
              <span className="avatar-role">{mem.role}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 뷰 모드 탭 */}
      <section className="view-mode-tabs">
        <button className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>📋 카드 보관함 목록 보기</button>
        <button className={`tab-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>🗺️ 맛집 전국 지도 보기 (카카오맵)</button>
      </section>

      {/* 메인 컨텐츠 */}
      <main className="bistro-main">
        {viewMode === 'list' ? (
          filteredRestaurants.length > 0 ? (
            <div className="bistro-grid">
              {filteredRestaurants.map(rest => {
                const memInfo = members[rest.member] || { avatar: '👤', name: '가족', role: '식구' };
                const categoryEmoji = foodCategories.find(c => c.id === rest.category)?.name.split(' ').pop() || '🍚';
                return (
                  <div key={rest.id} className="bistro-card" onClick={() => setSelectedRestaurant(rest)}>
                    <div className="card-header">
                      <span className="region-tag">{rest.region}</span>
                      <span className="category-emoji">{categoryEmoji}</span>
                    </div>
                    <h3 className="restaurant-title">{rest.name}</h3>
                    <div className="recommender-badge">
                      <span className="avatar-mini">{memInfo.avatar}</span>
                      <span>{memInfo.name} 추천</span>
                    </div>
                    <hr className="card-divider" />
                    <div className="rating-row">{'★'.repeat(rest.rating)}{'☆'.repeat(5 - rest.rating)}</div>
                    <p className="card-address-peek">📍 {rest.address || '주소 정보 없음'}</p>
                    <p className="card-peek-review">"{rest.review}"</p>
                    <div className="card-footer-links" onClick={(e) => e.stopPropagation()}>
                      {rest.mapUrl ? (
                        <a href={rest.mapUrl} target="_blank" rel="noopener noreferrer" className="external-map-link">카카오맵 길찾기 ↗</a>
                      ) : (
                        <span className="no-map-link">지도 링크 없음</span>
                      )}
                    </div>
                    <div className="card-tags">
                      {rest.tags.map((t, idx) => <span key={idx} className="tag-pill">#{t}</span>)}
                    </div>
                    <button className="card-delete-btn" onClick={(e) => deleteRecommendation(rest.id, e)} title="맛집 삭제">🗑️</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-restaurants">
              <div className="empty-graphic">🍲</div>
              <h3>부합하는 맛집 추천이 없습니다.</h3>
              <p>필터를 초기화하거나 다른 검색어로 입력해 보세요.</p>
              <button className="reset-filter-btn" onClick={() => { setSelectedMember('all'); setSelectedRegion('all'); setSelectedCategory('all'); setSearchTerm(''); }}>검색 조건 리셋</button>
            </div>
          )
        ) : (
          <div className="map-view-wrapper">
            {filteredRestaurants.length === 0 && (
              <div className="map-empty-alert">⚠️ 선택된 필터 조건에 지도상 표출 가능한 맛집이 없습니다.</div>
            )}
            <div id="family-map"></div>
          </div>
        )}
      </main>

      {/* 상세 정보 모달 */}
      {selectedRestaurant && (
        <div className="modal-overlay" onClick={() => setSelectedRestaurant(null)}>
          <div className="modal-content b-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedRestaurant(null)}>×</button>
            <div className="modal-head">
              <span className="modal-region">{selectedRestaurant.region}</span>
              <h2>{selectedRestaurant.name}</h2>
              <div className="modal-recommender">
                <span>추천 헌터:</span>
                <strong>{members[selectedRestaurant.member]?.avatar} {members[selectedRestaurant.member]?.name} ({members[selectedRestaurant.member]?.role})</strong>
              </div>
            </div>
            <hr className="divider" />
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">🌟 가족 추천 단독 평점</span>
                <div className="stars-holder">{'★'.repeat(selectedRestaurant.rating)}{'☆'.repeat(5 - selectedRestaurant.rating)}<span className="score-num">({selectedRestaurant.rating} / 5.0)</span></div>
              </div>
              <div className="detail-row">
                <span className="detail-label">📍 식당 도로명 주소</span>
                <p className="detailed-address">{selectedRestaurant.address || '주소 정보가 기입되지 않았습니다.'}</p>
              </div>
              {selectedRestaurant.mapUrl && (
                <div className="detail-row">
                  <span className="detail-label">🗺️ 카카오맵 바로가기</span>
                  <a href={selectedRestaurant.mapUrl} target="_blank" rel="noopener noreferrer" className="modal-external-map-btn">🗺️ 카카오맵에서 링크 열기 ↗</a>
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
                <div className="detail-tags">{selectedRestaurant.tags.map((t, idx) => <span key={idx} className="tag-item">#{t}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 새 맛집 등록 모달 */}
      {isAddingNew && (
        <div className="modal-overlay" onClick={() => setIsAddingNew(false)}>
          <div className="modal-content b-add-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsAddingNew(false)}>×</button>
            <h2>✍️ 신규 가족 맛집 추천서 작성</h2>
            <p className="form-helper">상호명을 입력하면 카카오맵에서 자동으로 주소와 지도 링크를 찾아드립니다 🗺️</p>

            <form onSubmit={saveNewRecommendation}>
              {/* 식당명 + 자동완성 */}
              <div className="row-fields">
                <div className="form-group" style={{ position: 'relative' }} ref={suggestionsRef}>
                  <label>식당 명칭 (자동완성 추천)</label>
                  <input
                    type="text"
                    placeholder="예: 스타벅스 홍대점, 영진돼지국밥"
                    value={newRest.name}
                    onChange={(e) => handleNameInput(e.target.value)}
                    autoComplete="off"
                    required
                  />
                  {/* 자동완성 드롭다운 */}
                  {showSuggestions && nameSuggestions.length > 0 && (
                    <ul className="autocomplete-list">
                      {nameSuggestions.map((place) => (
                        <li
                          key={place.id}
                          className="autocomplete-item"
                          onMouseDown={() => handleSuggestionSelect(place)}
                        >
                          <span className="autocomplete-name">{place.place_name}</span>
                          <span className="autocomplete-addr">{place.road_address_name || place.address_name}</span>
                          <span className="autocomplete-cat">{place.category_name?.split(' > ').pop()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="form-group">
                  <label>추천 작성자</label>
                  <select value={newRest.member} onChange={(e) => setNewRest({ ...newRest, member: e.target.value })}>
                    <option value="papa">아빠 👨‍💼</option>
                    <option value="mama">엄마 👩‍🍳</option>
                    <option value="daughter">큰딸 🙋‍♀️</option>
                    <option value="makdung">작은딸 👧</option>
                    <option value="husband">사위 🙋‍♂️</option>
                  </select>
                </div>
              </div>

              {/* 지역 / 카테고리 / 별점 - 자동완성 선택 시 자동입력됨 */}
              <div className="row-fields select-three">
                <div className="form-group">
                  <label>도시 구역 (자동)</label>
                  <select value={newRest.region} onChange={(e) => setNewRest({ ...newRest, region: e.target.value })}>
                    <option value="서울">서울 🗼</option>
                    <option value="경기">경기 🌳</option>
                    <option value="부산">부산 🌊</option>
                    <option value="강원">강원 🏔️</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>음식 종류 (자동)</label>
                  <select value={newRest.category} onChange={(e) => setNewRest({ ...newRest, category: e.target.value })}>
                    <option value="korean">든든 한식 🍚</option>
                    <option value="western">근사 양식 🍝</option>
                    <option value="asian">일/중식/아시안 🍣</option>
                    <option value="cafe">카페/디저트 ☕</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>내 추천 별점</label>
                  <select value={newRest.rating} onChange={(e) => setNewRest({ ...newRest, rating: e.target.value })}>
                    <option value={5}>⭐⭐⭐⭐⭐ (강력 추천)</option>
                    <option value={4}>⭐⭐⭐⭐ (추천)</option>
                    <option value={3}>⭐⭐⭐ (평범함)</option>
                    <option value={2}>⭐⭐ (아쉬움)</option>
                    <option value={1}>⭐ (비추)</option>
                  </select>
                </div>
              </div>

              {/* 주소 (자동완성 선택 시 자동입력) */}
              <div className="form-group">
                <label>업체 도로명 / 지번 주소 (자동입력)</label>
                <input
                  type="text"
                  placeholder="상호명 자동완성 선택 시 자동 입력됩니다"
                  value={newRest.address}
                  onChange={(e) => setNewRest({ ...newRest, address: e.target.value })}
                />
              </div>

              {/* 카카오맵 URL (자동완성 선택 시 자동입력) */}
              <div className="form-group">
                <label>카카오맵 링크 (자동입력)</label>
                <input
                  type="url"
                  placeholder="상호명 자동완성 선택 시 자동 입력됩니다"
                  value={newRest.mapUrl}
                  onChange={(e) => setNewRest({ ...newRest, mapUrl: e.target.value })}
                />
              </div>

              {/* 미니 카카오맵 핀드롭 */}
              <div className="form-group">
                <label>📍 카카오맵 위치 핀 (자동완성 선택 시 자동이동 · 직접 클릭/드래그 가능)</label>
                <div id="mini-map"></div>
                <div className="mini-map-coord-display">
                  선택 좌표: 위도 <strong>{formLat}</strong>, 경도 <strong>{formLng}</strong>
                </div>
              </div>

              <div className="form-group">
                <label>이 식당의 꼭 먹어야 마땅할 요리</label>
                <input type="text" placeholder="예: 수육백반, 순대국밥" value={newRest.recomMenu} onChange={(e) => setNewRest({ ...newRest, recomMenu: e.target.value })} />
              </div>

              <div className="form-group">
                <label>조언 섞인 한줄평 (필수)</label>
                <textarea placeholder="추천 이유, 팁, 주차 정보 등을 자유롭게 작성하세요." rows={3} value={newRest.review} onChange={(e) => setNewRest({ ...newRest, review: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>추천 성향 키워드 (쉼표로 구분)</label>
                <input type="text" placeholder="예: 주차편리, 웨이팅숨참, 노포맛집, 오션뷰" value={newRest.tagsInput} onChange={(e) => setNewRest({ ...newRest, tagsInput: e.target.value })} />
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
