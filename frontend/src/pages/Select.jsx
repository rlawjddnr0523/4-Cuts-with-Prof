// 링크 이동(Link)과 프로그래밍 방식의 페이지 이동(useNavigate)을 위한 훅을 불러옵니다.
import { Link, useNavigate } from 'react-router-dom';
// 목록 데이터와 선택 상태를 관리하기 위한 리액트 훅들입니다.
import { useState, useEffect } from 'react';
// 새로 만든 공통 타이머 컴포넌트를 불러옵니다.
import TimeoutTimer from '../components/TimeoutTimer';
// 백엔드에서 교수님 목록을 받아오는 공용 API 함수를 불러옵니다.
import { fetchProfessors } from '../api';

// 교수님 및 프레임 선택 화면 컴포넌트입니다.
function Select() {
  // navigate 함수를 훅으로 가져와서 특정 조건(버튼 클릭 등)일 때 페이지를 강제 이동시킬 수 있게 합니다.
  const navigate = useNavigate();

  // 백엔드에서 받아온 교수님 목록을 담는 상태입니다.
  const [professors, setProfessors] = useState([]);
  // 현재 사용자가 선택한 교수님 객체를 담는 상태입니다. (아직 안 골랐으면 null)
  const [selected, setSelected] = useState(null);
  // 목록을 불러오는 중인지 / 불러오다 실패했는지를 나타내는 상태입니다.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 화면이 처음 나타날 때 딱 한 번, 백엔드에서 교수님 목록을 가져옵니다.
  useEffect(() => {
    fetchProfessors()
      .then((list) => setProfessors(list)) // 성공하면 목록 상태에 저장!
      .catch(() => setError('교수님 목록을 불러오지 못했습니다. 백엔드 서버가 켜져 있는지 확인해주세요. 🙏'))
      .finally(() => setLoading(false));   // 성공/실패와 관계없이 로딩 표시는 끕니다.
  }, []);

  // 선택 완료 버튼을 눌렀을 때: 고른 교수님 정보를 들고 촬영 화면으로 이동합니다.
  const handleConfirm = () => {
    if (!selected) return; // 아직 아무도 안 골랐으면 무시합니다.
    navigate('/capture', { state: { professor: selected } });
  };

  return (
    // 화면 전체를 꽉 채우는 컨테이너입니다. (position: 'relative'를 유지해야 타이머가 우측 상단에 붙습니다.)
    // 칸이 41개라 화면을 넘어가므로, 제목/버튼은 고정하고 가운데 목록 영역만 스크롤되도록 구성합니다.
    <div style={{ position: 'relative', padding: '30px 40px', textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>

      {/* 공통 타이머 컴포넌트: 60초 동안 아무 조작이 없으면 처음 화면으로 돌아갑니다. */}
      <TimeoutTimer />

      {/* 페이지 제목 (스크롤과 무관하게 항상 위에 고정) */}
      <h2 style={{ marginBottom: '10px' }}>학과 및 교수님 선택</h2>
      <p style={{ color: '#ccc', marginBottom: '15px' }}>원하는 학과 프레임을 선택해주세요. 같은 계열은 같은 색으로 표시됩니다. (스크롤해서 더 볼 수 있어요 👇)</p>

      {/* 로딩 중이거나 에러가 났을 때는 안내 문구를 보여줍니다. */}
      {loading && <p style={{ color: '#aaa', margin: 'auto' }}>학과 목록을 불러오는 중... ⏳</p>}
      {error && <p style={{ color: '#FF5252', margin: 'auto' }}>{error}</p>}

      {/*
        스크롤 영역: 41개 카드가 들어가는 3열 격자(Grid)입니다.
        flex: 1 + overflowY: 'auto' 조합으로 남는 세로 공간을 전부 차지하면서 내용이 넘치면 스크롤됩니다.
        (minHeight: 0이 없으면 플렉스 자식이 줄어들지 않아 스크롤이 생기지 않으니 주의!)
      */}
      {!loading && !error && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 20px', width: '100%', maxWidth: '860px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {professors.map((prof) => {
              // 이 카드가 현재 선택된 카드인지 여부입니다. (선택되면 테두리를 강조!)
              const isSelected = selected?.id === prof.id;
              return (
                <div
                  key={prof.id}
                  onClick={() => setSelected(prof)} // 카드를 터치하면 이 학과를 선택합니다.
                  style={{
                    padding: '18px 12px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    // 카드 배경은 계열별 프레임 색상으로 칠해서 실제 프레임 느낌을 미리 보여줍니다. (같은 계열 = 같은 색)
                    backgroundColor: prof.frame_color,
                    // 선택된 카드는 초록색 굵은 테두리 + 살짝 확대 효과로 눈에 띄게 합니다.
                    border: isSelected ? '4px solid #4CAF50' : '4px solid transparent',
                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 15px rgba(76, 175, 80, 0.6)' : 'none',
                  }}
                >
                  {/* 계열을 상징하는 이모지를 보여줍니다. */}
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{prof.emoji}</div>
                  {/* 학과 이름과 소속 계열 */}
                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: prof.text_color }}>{prof.department}</div>
                  <div style={{ fontSize: '0.85rem', color: prof.text_color, opacity: 0.8, marginTop: '4px' }}>{prof.category}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/*
        선택 완료 버튼 (스크롤 영역 바깥이라 항상 화면 아래에 고정됩니다)
        학과를 고르기 전에는 회색으로 비활성화되고, 고르면 초록색으로 활성화됩니다.
      */}
      {!loading && !error && (
        <button
          onClick={handleConfirm}
          disabled={!selected}
          style={{
            marginTop: '15px',
            padding: '15px 30px',
            cursor: selected ? 'pointer' : 'not-allowed',
            backgroundColor: selected ? '#4CAF50' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
          }}
        >
          {selected ? `${selected.department} 프레임으로 촬영하러 가기 📸` : '학과를 먼저 선택해주세요'}
        </button>
      )}

      {/* 뒤로 가기 링크: 메인 화면('/')으로 돌아갑니다. */}
      <Link to="/" style={{ color: '#888', textDecoration: 'none', marginTop: '12px' }}>← 처음으로 돌아가기</Link>
    </div>
  );
}

export default Select;
