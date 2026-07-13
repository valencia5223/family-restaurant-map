import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { members, regions, foodCategories, defaultRestaurants } from './restaurantData';
import { supabase } from './supabase';
import './App.css';

// 넷플릭스 스타일 프로필을 위한 매핑 정보
const memberProfiles = {
  papa: { name: '아빠', avatar: '/avatars/avatar_papa.png' },
  mama: { name: '엄마', avatar: '/avatars/avatar_mama.png' },
  daughter: { name: '큰딸 랑구', avatar: '/avatars/avatar_daughter.png' },
  makdung: { name: '작은딸 막둥이', avatar: '/avatars/avatar_makdung.png' },
  husband: { name: '사위 차서방', avatar: '/avatars/avatar_husband.png' },
  yuna: { name: '차유나(손주)', avatar: '/avatars/avatar_yuna.png' }
};

// ──────────────────────────────────────────────────
// 주소 → 지역 자동 매핑 헬퍼
// ──────────────────────────────────────────────────
function mapAddressToRegion(address) {
  if (!address) return '서울';
  if (address.includes('서울')) return '서울';
  if (address.includes('경기') || address.includes('인천')) return '경기/인천';
  if (address.includes('부산') || address.includes('울산') || address.includes('경남') || address.includes('경상남')) return '부산/울산/경남';
  if (address.includes('대구') || address.includes('경북') || address.includes('경상북')) return '대구/경북';
  if (address.includes('전북') || address.includes('전라북')) return '전북';
  if (address.includes('전남') || address.includes('전라남') || address.includes('광주')) return '전남/광주';
  if (address.includes('강원')) return '강원';
  if (address.includes('충청') || address.includes('충북') || address.includes('충남') || address.includes('세종') || address.includes('대전')) return '충청/세종/대전';
  if (address.includes('제주')) return '제주';
  return '서울';
}

// 카카오 카테고리 코드 → 음식 종류 자동 매핑 헬퍼
function mapKakaoCategory(categoryGroupCode, categoryName) {
  if (categoryGroupCode === 'CE7') return 'cafe'; // 카페
  if (categoryGroupCode === 'FD6') {
    const name = categoryName || '';
    if (name.includes('일식') || name.includes('초밥') || name.includes('돈까스')) return 'japanese';
    if (name.includes('중식') || name.includes('짜장') || name.includes('중화요리')) return 'chinese';
    if (name.includes('동남아') || name.includes('아시안') || name.includes('태국') || name.includes('베트남') || name.includes('인도')) return 'asian';
    if (name.includes('양식') || name.includes('이탈리안') || name.includes('프렌치') || name.includes('피자') || name.includes('파스타') || name.includes('스테이크')) return 'western';
    if (name.includes('카페') || name.includes('디저트') || name.includes('제과') || name.includes('빵')) return 'cafe';
    return 'korean';
  }
  return 'korean';
}

// ──────────────────────────────────────────────────
// 별점 렌더링 헬퍼 (0.5 단위 지원)
// ──────────────────────────────────────────────────
function renderStars(ratingStr) {
  const rating = parseFloat(ratingStr) || 0;
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return '★'.repeat(fullStars) + (hasHalf ? '⯪' : '') + '☆'.repeat(emptyStars);
}

// 🖼️ 모바일 브라우저 친화형 이미지 리사이저 및 압축기 (동일 스펙 맞춤형 용량 감소화)
const resizeImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 600; // 최대 가로세로 600px 종횡비 맞춤
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // JPEG 60% 압축으로 base64 변환
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

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


  // 1. 맛집 추천 리스트 상태 제어 (Supabase database 연동)
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🎭 넷플릭스 프로필 세션 상태 제어
  const [activeProfile, setActiveProfile] = useState(() => {
    return localStorage.getItem('active_profile') || null;
  });

  const handleProfileChange = (key) => {
    setActiveProfile(key);
    if (key) {
      localStorage.setItem('active_profile', key);
      // 프로필 변경 시 해당 구성원의 맛집 맛 hunter 중심 필터링 자동 활성화
      setSelectedMember(key);
    } else {
      localStorage.removeItem('active_profile');
    }
  };

  useEffect(() => {
    async function fetchRestaurants() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .order('id', { ascending: false }); // 최신 ID가 먼저 나오게 정렬(최근 등록순 우선)
        
        if (error) throw error;
        
        if (data) {
          // camelCase 맵핑
          const clientData = data.map(r => {
            const rawTags = r.tags || [];
            const photoUrl = rawTags.find(t => t.startsWith('img:'))?.substring(4) || null;
            const cleanTags = rawTags.filter(t => !t.startsWith('img:'));
            return {
              id: r.id,
              name: r.name,
              member: r.member,
              region: r.region,
              category: r.category,
              rating: r.rating,
              recomMenu: r.recom_menu || r.recomMenu || '전체 대표 메뉴',
              review: r.review,
              tags: cleanTags,
              photo: photoUrl,
              address: r.address || '주소 정보 없음',
              mapUrl: r.map_url || r.mapUrl || null,
              coords: r.coords || []
            };
          });
          setRestaurants(clientData);
        }
      } catch (err) {
        console.error('[Supabase 로드 오류] 로컬 샘플 가동:', err);
        setRestaurants(defaultRestaurants);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRestaurants();
  }, []);

  // 검색 및 다중 필터링 조건 상태
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'rating'
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // 뷰 모드 토글: 'list' vs 'map'
  const [viewMode, setViewMode] = useState('list');

  // 맛집 등록 모달 제어 상태
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRest, setNewRest] = useState({
    name: '', member: 'papa', region: '서울', category: 'korean',
    rating: 5, recomMenu: '', review: '', tagsInput: '', address: '', mapUrl: '', photo: null
  });

  // 맛집 수정 모달 제어 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editingRest, setEditingRest] = useState(null);

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
  const mouseDownOverlayStarted = useRef(false);

  // ──────────────────────────────────────────────────
  // 2. 대시보드 통계 계산
  // ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (restaurants.length === 0) return { total: 0, topMemberInfo: null, topFood: '-', avgRating: '0.0' };
    const memberCounts = {};
    restaurants.forEach(r => { memberCounts[r.member] = (memberCounts[r.member] || 0) + 1; });
    let topMemKey = '-', maxMemCount = 0;
    Object.entries(memberCounts).forEach(([k, v]) => { if (v > maxMemCount) { maxMemCount = v; topMemKey = k; } });
    const catCounts = {};
    restaurants.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    let topCatKey = '-', maxCatCount = 0;
    Object.entries(catCounts).forEach(([k, v]) => { if (v > maxCatCount) { maxCatCount = v; topCatKey = k; } });
    const avgRating = (restaurants.reduce((s, r) => s + r.rating, 0) / restaurants.length).toFixed(1);
    const topMemberInfo = members[topMemKey] || null;
    const catName = foodCategories.find(c => c.id === topCatKey)?.name || '-';
    return { total: restaurants.length, topMemberInfo, topFood: catName, avgRating };
  }, [restaurants]);

  // ──────────────────────────────────────────────────
  // 3. 검색 & 다중 필터링
  // ──────────────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    const filtered = restaurants.filter(r => {
      const matchMember = selectedMember === 'all' || r.member === selectedMember;
      const matchRegion = selectedRegion === 'all' || r.region === selectedRegion;
      const matchCategory = selectedCategory === 'all' || r.category === selectedCategory;
      
      let matchRating = true;
      if (selectedRating !== 'all') {
        const ratingVal = parseFloat(selectedRating);
        if (ratingVal >= 5.0) {
          matchRating = parseFloat(r.rating) >= 5.0;
        } else {
          matchRating = parseFloat(r.rating) >= ratingVal;
        }
      }

      const text = searchTerm.toLowerCase();
      const matchSearch = r.name.toLowerCase().includes(text) ||
        r.recomMenu.toLowerCase().includes(text) ||
        (r.address && r.address.toLowerCase().includes(text)) ||
        r.review.toLowerCase().includes(text) ||
        r.tags.some(t => t.toLowerCase().includes(text));
      return matchMember && matchRegion && matchCategory && matchRating && matchSearch;
    });

    // 최근등록순(최근 등록일/시간)과 별점높은순 정렬 옵션 지원
    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') {
        const ratingDiff = parseFloat(b.rating) - parseFloat(a.rating);
        if (ratingDiff !== 0) return ratingDiff;
      }
      return b.id - a.id;
    });
  }, [restaurants, selectedMember, selectedRegion, selectedCategory, selectedRating, searchTerm, sortBy]);

  // ──────────────────────────────────────────────────
  // 4-A. 카카오 장소 검색 자동완성 (디바운스 300ms)
  // ──────────────────────────────────────────────────
  const handleNameInput = useCallback((value) => {
    if (isEditing) {
      setEditingRest(prev => ({ ...prev, name: value }));
    } else {
      setNewRest(prev => ({ ...prev, name: value }));
    }
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
  }, [kakaoLoaded, isEditing]);


  // 자동완성 항목 선택 → 필드 자동채움
  const handleSuggestionSelect = useCallback((place) => {
    const address = place.road_address_name || place.address_name || '';
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    const region = mapAddressToRegion(address);
    const category = mapKakaoCategory(place.category_group_code, place.category_name);
    const mapUrl = place.place_url || '';

    const updater = (prev) => ({
      ...prev,
      name: place.place_name,
      address,
      mapUrl,
      region,
      category,
    });

    if (isEditing) {
      setEditingRest(updater);
    } else {
      setNewRest(updater);
    }
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
  }, [isEditing]);

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

  // 모달 오픈 시 뒷배경 스크롤 방지 효과
  useEffect(() => {
    if (isAddingNew || isEditing || selectedRestaurant) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAddingNew, isEditing, selectedRestaurant]);

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

    const options = { center: new window.kakao.maps.LatLng(36.3, 127.8), level: 13 };
    const map = new window.kakao.maps.Map(container, options);
    mainMapRef.current = map;
    mainMarkersRef.current = [];

    filteredRestaurants.forEach(rest => {
      if (!rest.coords || rest.coords.length !== 2) return;
      const [lat, lng] = rest.coords;
      const memInfo = members[rest.member] || { avatar: '/avatars/avatar_papa.png', name: '가족' };

      const markerPosition = new window.kakao.maps.LatLng(lat, lng);
      
      // 🎨 추천인의 개별 이미지 아바타 기반 커스텀 마커(CustomOverlay) 생성
      const overlayContent = document.createElement('div');
      overlayContent.className = 'custom-avatar-marker';
      overlayContent.innerHTML = `<img src="${memInfo.avatar}" alt="${memInfo.name}" />`;
      
      const customOverlay = new window.kakao.maps.CustomOverlay({
        position: markerPosition,
        content: overlayContent,
        yAnchor: 1.15
      });
      customOverlay.setMap(map);
      mainMarkersRef.current.push(customOverlay);

      const infoContent = `
        <div style="padding:14px 16px;min-width:200px;font-family:'Pretendard',sans-serif;border-radius:12px;">
          <strong style="font-size:15px;">${rest.name}</strong>
          <p style="margin:4px 0;font-size:12px;color:#888;display:flex;align-items:center;gap:4px;">
            <img src="${memInfo.avatar}" style="width:16px;height:16px;border-radius:50%;object-fit:cover;" />
            ${memInfo.name} 추천 &nbsp;⭐ ${rest.rating}/5
          </p>
          <p style="margin:4px 0;font-size:12px;color:#555;">${rest.address || '주소 미기입'}</p>
          <div style="margin-top:8px;display:flex;gap:6px;">
            ${rest.mapUrl ? `<a href="${rest.mapUrl}" target="_blank" style="font-size:11px;background:#FEE500;color:#3C1E1E;padding:4px 10px;border-radius:20px;text-decoration:none;font-weight:600;">카카오맵 열기 ↗</a>` : ''}
            <button onclick="window.openDetailFromMap(${rest.id})" style="font-size:11px;background:#FF6F3D;color:#fff;padding:4px 10px;border-radius:20px;border:none;cursor:pointer;font-weight:600;">상세보기</button>
          </div>
        </div>`;

      const infowindow = new window.kakao.maps.InfoWindow({ 
        position: markerPosition,
        content: infoContent, 
        removable: true 
      });

      overlayContent.addEventListener('click', () => {
        infowindow.open(map);
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
  // 6. 새 맛집 등록창 열기
  const handleAddNewClick = () => {
    setIsAddingNew(true);
    if (activeProfile && memberProfiles[activeProfile]) {
      setNewRest(prev => ({ ...prev, member: activeProfile }));
    }
  };

  useEffect(() => {
    if (!isAddingNew && !isEditing) {
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
  }, [isAddingNew, isEditing]);

  // ──────────────────────────────────────────────────
  // 7. 새 맛집 등록 저장
  // ──────────────────────────────────────────────────
  const saveNewRecommendation = async (e) => {
    e.preventDefault();
    if (!newRest.name.trim()) return alert('식당 이름을 적어주세요.');

    const cleanTags = newRest.tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const dbTags = [...cleanTags];
    if (newRest.photo) {
      dbTags.push(`img:${newRest.photo}`);
    }

    const dbObj = {
      id: Date.now(),
      name: newRest.name.trim(),
      member: newRest.member,
      region: newRest.region,
      category: newRest.category,
      rating: parseFloat(newRest.rating),
      recom_menu: newRest.recomMenu.trim() || '전체 대표 메뉴',
      review: newRest.review.trim(),
      tags: dbTags.length > 0 ? dbTags : ['추천맛집'],
      address: newRest.address.trim() || '주소 정보 없음',
      map_url: newRest.mapUrl.trim() || null,
      coords: [formLat, formLng]
    };

    try {
      const { error } = await supabase.from('restaurants').insert([dbObj]);
      if (error) throw error;

      const clientObj = {
        id: dbObj.id,
        name: dbObj.name,
        member: dbObj.member,
        region: dbObj.region,
        category: dbObj.category,
        rating: dbObj.rating,
        recomMenu: dbObj.recom_menu,
        review: dbObj.review,
        tags: cleanTags,
        photo: newRest.photo || null,
        address: dbObj.address,
        mapUrl: dbObj.map_url,
        coords: dbObj.coords
      };

      setRestaurants(prev => [clientObj, ...prev]);
      setIsAddingNew(false);
      setNewRest({ name: '', member: 'papa', region: '서울', category: 'korean', rating: 5.0, recomMenu: '', review: '', tagsInput: '', address: '', mapUrl: '', photo: null });
      setFormLat(37.5665);
      setFormLng(126.9780);
    } catch (err) {
      console.error('[등록 오류]', err);
      alert('데이터베이스 저장 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleEditClick = (rest) => {
    setSelectedRestaurant(null);
    setEditingRest({
      id: rest.id,
      name: rest.name,
      member: rest.member,
      region: rest.region,
      category: rest.category,
      rating: rest.rating,
      recomMenu: rest.recomMenu,
      review: rest.review,
      tagsInput: rest.tags.join(', '),
      address: rest.address,
      mapUrl: rest.mapUrl || '',
      photo: rest.photo || null,
      coords: rest.coords || [37.5665, 126.9780]
    });
    setFormLat(rest.coords?.[0] || 37.5665);
    setFormLng(rest.coords?.[1] || 126.9780);
    setIsEditing(true);
  };

  const updateRecommendation = async (e) => {
    e.preventDefault();
    if (!editingRest.name.trim()) return alert('식당 이름을 적어주세요.');

    const cleanTags = editingRest.tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const dbTags = [...cleanTags];
    if (editingRest.photo) {
      dbTags.push(`img:${editingRest.photo}`);
    }

    const dbObj = {
      name: editingRest.name.trim(),
      member: editingRest.member,
      region: editingRest.region,
      category: editingRest.category,
      rating: parseFloat(editingRest.rating),
      recom_menu: editingRest.recomMenu.trim() || '전체 대표 메뉴',
      review: editingRest.review.trim(),
      tags: dbTags.length > 0 ? dbTags : ['추천맛집'],
      address: editingRest.address.trim() || '주소 정보 없음',
      map_url: editingRest.mapUrl.trim() || null,
      coords: [formLat, formLng]
    };

    try {
      const { error } = await supabase
        .from('restaurants')
        .update(dbObj)
        .eq('id', editingRest.id);
      
      if (error) throw error;

      const clientObj = {
        id: editingRest.id,
        name: dbObj.name,
        member: dbObj.member,
        region: dbObj.region,
        category: dbObj.category,
        rating: dbObj.rating,
        recomMenu: dbObj.recom_menu,
        review: dbObj.review,
        tags: cleanTags,
        photo: editingRest.photo || null,
        address: dbObj.address,
        mapUrl: dbObj.map_url,
        coords: dbObj.coords
      };

      setRestaurants(prev => prev.map(r => r.id === editingRest.id ? clientObj : r));
      setIsEditing(false);
      setEditingRest(null);
      setFormLat(37.5665);
      setFormLng(126.9780);
    } catch (err) {
      console.error('[수정 오류]', err);
      alert('데이터베이스 수정 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // ──────────────────────────────────────────────────
  // 8. 맛집 삭제
  // ──────────────────────────────────────────────────
  const deleteRecommendation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('정말 이 맛집 추천을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('restaurants').delete().eq('id', id);
      if (error) throw error;

      const updatedList = restaurants.filter(r => r.id !== id);
      setRestaurants(updatedList);
      if (selectedRestaurant && selectedRestaurant.id === id) setSelectedRestaurant(null);
    } catch (err) {
      console.error('[삭제 오류]', err);
      alert('데이터베이스 삭제 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────
  // 🎭 프로필이 선택되지 않았다면 넷플릭스 오버레이 노출
  if (!activeProfile) {
    return (
      <div className="profile-select-overlay">
        <div className="profile-select-container">
          <h1 className="profile-select-title">누구의 계정으로 로그인 하시겠습니까?</h1>
          <div className="profile-cards-container">
            {Object.entries(memberProfiles).map(([key, prof]) => (
              <div
                key={key}
                className="profile-card"
                onClick={() => handleProfileChange(key)}
              >
                <div className="profile-avatar-wrapper">
                  <img src={prof.avatar} className="profile-avatar-img" alt={prof.name} />
                </div>
                <div className="profile-name">{prof.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bistro-app">
      {/* 🎭 상단 헤더 프로필 퀵 스위처 */}
      <div className="header-profile-section">
        <div className="header-profile-badge">
          <span className="header-profile-emoji">
            <img src={memberProfiles[activeProfile]?.avatar} alt="" />
          </span>
          <span>{memberProfiles[activeProfile]?.name}</span>
          <button className="header-profile-btn" onClick={() => handleProfileChange(null)}>
            전환
          </button>
        </div>
      </div>

      {/* 헤더 */}
      <header className="bistro-header">
        <div className="header-icon">🧭</div>
        <h1>우리 가족 비밀 맛집 지도</h1>
        <p className="subtitle">아빠, 엄마, 딸, 사위가 발로 직접 찾아낸 맛집 공유 보관소</p>
        <button className="add-bistro-btn" onClick={handleAddNewClick}>
          ✍️ 내가 검증한 맛집 추천하기
        </button>
      </header>

      {/* 대시보드 */}
      <section className="stats-dashboard">
        <div className="stat-card"><span className="stat-num">{stats.total}개</span><span className="stat-label">보관 맛집 수</span></div>
        <div className="stat-card">
          <span className="stat-num" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}>
            {stats.topMemberInfo ? (
              <>
                <img src={stats.topMemberInfo.avatar} className="avatar-mini-inline" alt="" />
                <span>{stats.topMemberInfo.name}</span>
              </>
            ) : '-'}
          </span>
          <span className="stat-label">최다 맛집 추천인</span>
        </div>
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
          <div className="filter-group">
            <label>별점 선택</label>
            <select value={selectedRating} onChange={(e) => setSelectedRating(e.target.value)}>
              <option value="all">모든 별점 ⭐</option>
              <option value="5.0">⭐⭐⭐⭐⭐ (5.0점 전용)</option>
              <option value="4.5">⭐⭐⭐⭐⯪ (4.5점 이상)</option>
              <option value="4.0">⭐⭐⭐⭐ (4.0점 이상)</option>
              <option value="3.5">⭐⭐⭐⯪ (3.5점 이상)</option>
              <option value="3.0">⭐⭐⭐ (3.0점 이상)</option>
              <option value="2.5">⭐⭐⯪ (2.5점 이상)</option>
              <option value="2.0">⭐⭐ (2.0점 이상)</option>
              <option value="1.5">⭐⯪ (1.5점 이상)</option>
              <option value="1.0">⭐ (1.0점 이상)</option>
              <option value="0.5">⯪ (0.5점 이상)</option>
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
              <span className="avatar-icon"><img src={mem.avatar} alt="" /></span>
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
        {viewMode === 'list' && (
          <div className="list-header-section">
            <h3 className="list-title">🍽️ 가족 추천 맛집 목록 <span className="total-count">({filteredRestaurants.length}곳)</span></h3>
            <div className="list-sort-select">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-dropdown-inline">
                <option value="recent">최근 등록순 📅</option>
                <option value="rating">별점 높은순 ⭐</option>
              </select>
            </div>
          </div>
        )}
        {viewMode === 'list' ? (
          filteredRestaurants.length > 0 ? (
            <div className="bistro-grid">
              {filteredRestaurants.map(rest => {
                const memInfo = members[rest.member] || { avatar: '👤', name: '가족', role: '식구' };
                const categoryEmoji = foodCategories.find(c => c.id === rest.category)?.name.split(' ').pop() || '🍚';
                return (
                  <div key={rest.id} className="bistro-card" onClick={() => setSelectedRestaurant(rest)}>
                    {rest.photo && (
                      <div className="card-cover-image">
                        <img src={rest.photo} alt={rest.name} />
                      </div>
                    )}
                    <div className="card-header" style={{ borderTopLeftRadius: rest.photo ? '0' : '12px', borderTopRightRadius: rest.photo ? '0' : '12px' }}>
                      <span className="region-tag">{rest.region}</span>
                      <span className="category-emoji">{categoryEmoji}</span>
                    </div>
                    <h3 className="restaurant-title">{rest.name}</h3>
                    <div className="recommender-badge">
                      <span className="avatar-mini"><img src={memInfo.avatar} alt="" /></span>
                      <span>{memInfo.name} 추천</span>
                    </div>
                    <hr className="card-divider" />
                    <div className="rating-row">{renderStars(rest.rating)}</div>
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
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => { if(e.target === e.currentTarget) mouseDownOverlayStarted.current = true; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && mouseDownOverlayStarted.current) {
              setSelectedRestaurant(null);
            }
            mouseDownOverlayStarted.current = false;
          }}
        >
          <div 
            className="modal-content b-detail-modal" 
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={() => setSelectedRestaurant(null)}>×</button>
            <div className="modal-top-actions" style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.2rem', paddingRight: '2rem' }}>
              <button 
                className="edit-recommendation-btn" 
                onClick={() => handleEditClick(selectedRestaurant)}
                style={{
                  backgroundColor: 'var(--color-olive)',
                  color: 'white',
                  border: 'none',
                  fontFamily: 'var(--font-base)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 6px rgba(91, 107, 93, 0.15)'
                }}
                onMouseOver={(e) => e.target.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.target.style.filter = 'none'}
              >
                ✍️ 수정하기
              </button>
              <button 
                className="delete-recommendation-btn" 
                onClick={(e) => deleteRecommendation(selectedRestaurant.id, e)}
                style={{
                  backgroundColor: '#e05c36',
                  color: 'white',
                  border: 'none',
                  fontFamily: 'var(--font-base)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 6px rgba(224, 92, 54, 0.15)'
                }}
                onMouseOver={(e) => e.target.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.target.style.filter = 'none'}
              >
                🗑️ 삭제하기
              </button>
            </div>
            <div className="modal-head">
              <span className="modal-region">{selectedRestaurant.region}</span>
              <h2>{selectedRestaurant.name}</h2>
              <div className="modal-recommender">
                <span>추천인:</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <img src={members[selectedRestaurant.member]?.avatar} className="avatar-mini-inline" alt="" />
                  <strong>{members[selectedRestaurant.member]?.name} ({members[selectedRestaurant.member]?.role})</strong>
                </span>
              </div>
            </div>
            <hr className="divider" />
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">🌟 가족 추천 단독 평점</span>
                <div className="stars-holder">{renderStars(selectedRestaurant.rating)}<span className="score-num">({parseFloat(selectedRestaurant.rating).toFixed(1)} / 5.0)</span></div>
              </div>
              <div className="detail-row">
                <span className="detail-label">📍 식당 도로명 주소 (클릭 시 카카오맵 이동)</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <p className="detailed-address" style={{ margin: 0, flex: 1 }}>
                    {selectedRestaurant.mapUrl && selectedRestaurant.mapUrl.includes('kakao.com') ? (
                      <a href={selectedRestaurant.mapUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand)', textDecoration: 'underline', fontWeight: 600 }}>
                        {selectedRestaurant.address || '주소 정보가 기입되지 않았습니다.'} ↗
                      </a>
                    ) : (
                      <a href={`https://map.kakao.com/?q=${encodeURIComponent(selectedRestaurant.address || selectedRestaurant.name)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand)', textDecoration: 'underline', fontWeight: 600 }}>
                        {selectedRestaurant.address || '주소 정보가 기입되지 않았습니다.'} ↗
                      </a>
                    )}
                  </p>
                  {selectedRestaurant.address && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedRestaurant.address);
                        alert('도로명 주소가 클립보드에 복사되었습니다!');
                      }}
                      className="copy-addr-btn"
                    >
                      📋 복사
                    </button>
                  )}
                </div>
              </div>
              {selectedRestaurant.photo && (
                <div className="detail-row">
                  <span className="detail-label">📷 현장 검증 사진</span>
                  <div className="detail-photo-container">
                    <img src={selectedRestaurant.photo} alt="현장 사진" className="detail-photo-img" />
                  </div>
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
              <div className="detail-row">
                <span className="detail-label">🏷️ 추천 포인트 태그</span>
                <div className="detail-tags">{selectedRestaurant.tags.map((t, idx) => <span key={idx} className="tag-item">#{t}</span>)}</div>
              </div>
              {selectedRestaurant.mapUrl && !selectedRestaurant.mapUrl.includes('kakao.com') && (
                <div className="detail-row">
                  <span className="detail-label">🔗 업체 홈페이지</span>
                  <a href={selectedRestaurant.mapUrl} target="_blank" rel="noopener noreferrer" className="modal-external-map-btn" style={{ wordBreak: 'break-all' }}>
                    🖥️ 업체 홈페이지 바로가기 ↗
                  </a>
                </div>
              )}
              <div className="detail-row border-none">
                <span className="detail-label">🚗 내비게이션 길안내 바로가기</span>
                <div className="navigation-buttons-container">
                  <a 
                    href={(() => {
                      const lat = selectedRestaurant.coords?.[0];
                      const lng = selectedRestaurant.coords?.[1];
                      return lat && lng
                        ? `https://map.kakao.com/link/to/${encodeURIComponent(selectedRestaurant.name)},${lat},${lng}`
                        : (selectedRestaurant.mapUrl || `https://map.kakao.com/?q=${encodeURIComponent(selectedRestaurant.name)}`);
                    })()} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="nav-btn kakao-nav-btn"
                  >
                    💛 카카오맵 길안내
                  </a>
                  <a 
                    href={(() => {
                      const lat = selectedRestaurant.coords?.[0];
                      const lng = selectedRestaurant.coords?.[1];
                      return lat && lng
                        ? `https://map.naver.com/v5/directions/-,-,${encodeURIComponent(selectedRestaurant.name)},${lng},${lat},-/mode/route`
                        : `https://map.naver.com/v5/search/${encodeURIComponent(selectedRestaurant.address || selectedRestaurant.name)}`;
                    })()} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="nav-btn naver-nav-btn"
                  >
                    💚 네이버 지도 길안내
                  </a>
                  <a 
                    href={(() => {
                      const lat = selectedRestaurant.coords?.[0];
                      const lng = selectedRestaurant.coords?.[1];
                      return lat && lng
                        ? `tmap://route?rGoName=${encodeURIComponent(selectedRestaurant.name)}&rGoX=${lng}&rGoY=${lat}`
                        : `tmap://search?name=${encodeURIComponent(selectedRestaurant.name)}`;
                    })()} 
                    className="nav-btn tmap-nav-btn"
                  >
                    ❤️ 티맵(Tmap) 길안내
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 새 맛집 등록 모달 */}
      {isAddingNew && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => { if(e.target === e.currentTarget) mouseDownOverlayStarted.current = true; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && mouseDownOverlayStarted.current) {
              setIsAddingNew(false);
            }
            mouseDownOverlayStarted.current = false;
          }}
        >
          <div 
            className="modal-content b-add-modal" 
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
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
                    <option value="papa">아빠</option>
                    <option value="mama">엄마</option>
                    <option value="daughter">큰딸</option>
                    <option value="makdung">작은딸</option>
                    <option value="husband">사위</option>
                    <option value="yuna">차유나(손주)</option>
                  </select>
                </div>
              </div>

              {/* 지역 / 카테고리 / 별점 - 자동완성 선택 시 자동입력됨 */}
              <div className="row-fields select-three">
                <div className="form-group">
                  <label>도시 구역 (자동)</label>
                  <select value={newRest.region} onChange={(e) => setNewRest({ ...newRest, region: e.target.value })}>
                    {regions.filter(r => r.id !== 'all').map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>음식 종류 (자동)</label>
                  <select value={newRest.category} onChange={(e) => setNewRest({ ...newRest, category: e.target.value })}>
                    {foodCategories.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>내 추천 별점</label>
                  <select value={newRest.rating} onChange={(e) => setNewRest({ ...newRest, rating: parseFloat(e.target.value) })}>
                    <option value={5.0}>⭐⭐⭐⭐⭐ (5.0 / 강력 추천)</option>
                    <option value={4.5}>⭐⭐⭐⭐⯪ (4.5 / 추천)</option>
                    <option value={4.0}>⭐⭐⭐⭐ (4.0 / 추천)</option>
                    <option value={3.5}>⭐⭐⭐⯪ (3.5 / 무난함)</option>
                    <option value={3.0}>⭐⭐⭐ (3.0 / 평범함)</option>
                    <option value={2.5}>⭐⭐⯪ (2.5 / 아쉬움)</option>
                    <option value={2.0}>⭐⭐ (2.0 / 아쉬움)</option>
                    <option value={1.5}>⭐⯪ (1.5 / 비추)</option>
                    <option value={1.0}>⭐ (1.0 / 비추)</option>
                    <option value={0.5}>⯪ (0.5 / 강력 비추)</option>
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
                <label>추천메뉴</label>
                <input type="text" placeholder="예: 수육백반, 순대국밥" value={newRest.recomMenu} onChange={(e) => setNewRest({ ...newRest, recomMenu: e.target.value })} />
              </div>

              <div className="form-group">
                <label>한줄평</label>
                <textarea placeholder="추천 이유, 팁, 주차 정보 등을 자유롭게 작성하세요." rows={3} value={newRest.review} onChange={(e) => setNewRest({ ...newRest, review: e.target.value })} />
              </div>

              <div className="form-group">
                <label>비고</label>
                <input type="text" placeholder="예: 주차편리, 웨이팅숨참, 오션뷰" value={newRest.tagsInput} onChange={(e) => setNewRest({ ...newRest, tagsInput: e.target.value })} />
              </div>

              <div className="form-group">
                <label>📷 현장 사진 첨부</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const resizedBase64 = await resizeImage(file);
                        setNewRest(prev => ({ ...prev, photo: resizedBase64 }));
                      } catch (err) {
                        console.error('이미지 리사이징 오류:', err);
                        alert('이미지 처리 중 오류가 발생했습니다.');
                      }
                    }} 
                  />
                  {newRest.photo && (
                    <div className="photo-upload-preview">
                      <img src={newRest.photo} alt="미리보기" />
                      <button 
                        type="button" 
                        className="photo-preview-delete" 
                        onClick={() => setNewRest(prev => ({ ...prev, photo: null }))}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-act-btn" onClick={() => setIsAddingNew(false)}>취소</button>
                <button type="submit" className="submit-act-btn">가족 지도형 보관소에 제출</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 맛집 수정 모달 */}
      {isEditing && editingRest && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => { if(e.target === e.currentTarget) mouseDownOverlayStarted.current = true; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && mouseDownOverlayStarted.current) {
              setIsEditing(false);
              setEditingRest(null);
            }
            mouseDownOverlayStarted.current = false;
          }}
        >
          <div 
            className="modal-content b-add-modal" 
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={() => { setIsEditing(false); setEditingRest(null); }}>×</button>
            <h2>✍️ 맛집 추천서 수정</h2>
            <p className="form-helper">상호명이나 정보를 수정한 후 저장해 주세요 🗺️</p>

            <form onSubmit={updateRecommendation}>
              {/* 식당명 + 자동완성 */}
              <div className="row-fields">
                <div className="form-group" style={{ position: 'relative' }} ref={suggestionsRef}>
                  <label>식당 명칭 (자동완성 추천)</label>
                  <input
                    type="text"
                    placeholder="예: 스타벅스 홍대점, 영진돼지국밥"
                    value={editingRest.name}
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
                  <select value={editingRest.member} onChange={(e) => setEditingRest({ ...editingRest, member: e.target.value })}>
                    <option value="papa">아빠</option>
                    <option value="mama">엄마</option>
                    <option value="daughter">큰딸</option>
                    <option value="makdung">작은딸</option>
                    <option value="husband">사위</option>
                    <option value="yuna">차유나(손주)</option>
                  </select>
                </div>
              </div>

              {/* 지역 / 카테고리 / 별점 - 자동완성 선택 시 자동입력됨 */}
              <div className="row-fields select-three">
                <div className="form-group">
                  <label>도시 구역 (자동)</label>
                  <select value={editingRest.region} onChange={(e) => setEditingRest({ ...editingRest, region: e.target.value })}>
                    {regions.filter(r => r.id !== 'all').map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>음식 종류 (자동)</label>
                  <select value={editingRest.category} onChange={(e) => setEditingRest({ ...editingRest, category: e.target.value })}>
                    {foodCategories.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>내 추천 별점</label>
                  <select value={editingRest.rating} onChange={(e) => setEditingRest({ ...editingRest, rating: parseFloat(e.target.value) })}>
                    <option value={5.0}>⭐⭐⭐⭐⭐ (5.0 / 강력 추천)</option>
                    <option value={4.5}>⭐⭐⭐⭐⯪ (4.5 / 추천)</option>
                    <option value={4.0}>⭐⭐⭐⭐ (4.0 / 추천)</option>
                    <option value={3.5}>⭐⭐⭐⯪ (3.5 / 무난함)</option>
                    <option value={3.0}>⭐⭐⭐ (3.0 / 평범함)</option>
                    <option value={2.5}>⭐⭐⯪ (2.5 / 아쉬움)</option>
                    <option value={2.0}>⭐⭐ (2.0 / 아쉬움)</option>
                    <option value={1.5}>⭐⯪ (1.5 / 비추)</option>
                    <option value={1.0}>⭐ (1.0 / 비추)</option>
                    <option value={0.5}>⯪ (0.5 / 강력 비추)</option>
                  </select>
                </div>
              </div>

              {/* 주소 (자동완성 선택 시 자동입력) */}
              <div className="form-group">
                <label>업체 도로명 / 지번 주소 (자동입력)</label>
                <input
                  type="text"
                  placeholder="상호명 자동완성 선택 시 자동 입력됩니다"
                  value={editingRest.address}
                  onChange={(e) => setEditingRest({ ...editingRest, address: e.target.value })}
                />
              </div>

              {/* 카카오맵 URL (자동완성 선택 시 자동입력) */}
              <div className="form-group">
                <label>카카오맵 링크 (자동입력)</label>
                <input
                  type="url"
                  placeholder="상호명 자동완성 선택 시 자동 입력됩니다"
                  value={editingRest.mapUrl}
                  onChange={(e) => setEditingRest({ ...editingRest, mapUrl: e.target.value })}
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
                <label>추천메뉴</label>
                <input type="text" placeholder="예: 수육백반, 순대국밥" value={editingRest.recomMenu} onChange={(e) => setEditingRest({ ...editingRest, recomMenu: e.target.value })} />
              </div>

              <div className="form-group">
                <label>한줄평</label>
                <textarea placeholder="추천 이유, 팁, 주차 정보 등을 자유롭게 작성하세요." rows={3} value={editingRest.review} onChange={(e) => setEditingRest({ ...editingRest, review: e.target.value })} />
              </div>

              <div className="form-group">
                <label>비고</label>
                <input type="text" placeholder="예: 주차편리, 웨이팅숨참, 오션뷰" value={editingRest.tagsInput} onChange={(e) => setEditingRest({ ...editingRest, tagsInput: e.target.value })} />
              </div>

              <div className="form-group">
                <label>📷 현장 사진 첨부</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const resizedBase64 = await resizeImage(file);
                        setEditingRest(prev => ({ ...prev, photo: resizedBase64 }));
                      } catch (err) {
                        console.error('이미지 리사이징 오류:', err);
                        alert('이미지 처리 중 오류가 발생했습니다.');
                      }
                    }} 
                  />
                  {editingRest.photo && (
                    <div className="photo-upload-preview">
                      <img src={editingRest.photo} alt="미리보기" />
                      <button 
                        type="button" 
                        className="photo-preview-delete" 
                        onClick={() => setEditingRest(prev => ({ ...prev, photo: null }))}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-act-btn" onClick={() => { setIsEditing(false); setEditingRest(null); }}>취소</button>
                <button type="submit" className="submit-act-btn">수정 완료</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
