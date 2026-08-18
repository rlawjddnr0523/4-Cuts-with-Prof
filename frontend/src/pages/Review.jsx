// 라우터에서 상태(State)를 읽어오기 위한 useLocation과 페이지 이동을 위한 useNavigate를 불러옵니다.
import { useLocation, useNavigate } from 'react-router-dom';
// 키오스크 방치 방지용 공통 타이머 컴포넌트입니다. (일정 시간 조작이 없으면 처음 화면으로)
import TimeoutTimer from '../components/TimeoutTimer';

// 촬영된 4컷 사진을 검토하고 개별 재촬영을 선택하는 리뷰 컴포넌트입니다.
function Review() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Capture.jsx에서 넘겨준 4장의 사진 데이터(cuts)를 가져옵니다.
  // (임시 시뮬레이션을 위해 넘어온 데이터가 없으면 빈 배열 4개로 초기화합니다.)
  const cuts = location.state?.cuts || [null, null, null, null];
  // Select 화면부터 계속 들고 온 교수님 정보입니다. 재촬영/결과 화면으로도 그대로 넘겨줘야 합니다.
  const professor = location.state?.professor ?? null;

  // 특정 컷(인덱스)을 재촬영하러 가는 함수입니다.
  const handleRetake = (index) => {
    // 캡처 화면으로 돌아갈 때, 기존의 4컷 데이터와 '내가 몇 번째 컷을 다시 찍으러 가는지(retakeIndex)', 교수님 정보를 같이 넘겨줍니다.
    navigate('/capture', { state: { cuts, retakeIndex: index, professor } });
  };

  // 모든 사진이 마음에 들어 최종 결과물(결과/QR 화면)로 넘어가는 함수입니다.
  const handleFinish = () => {
    navigate('/result', { state: { cuts, professor } });
  };

  // 아직 안 찍힌 컷(null)이 하나라도 있는지 확인합니다. 있으면 합성 버튼을 잠급니다.
  const hasEmptyCut = cuts.some((cut) => cut === null);

  // 선택한 프레임의 '사진 구멍' 비율에 맞춰 썸네일 크기를 정합니다. (촬영/합성 화면과 동일한 비율)
  const slotRatio = professor?.slot_ratio ?? 4 / 3;
  const thumbH = 200;
  const thumbW = Math.round(thumbH * slotRatio);

  // 썸네일 위에 프레임을 겹쳐 보여주기 위한 정보입니다. (프레임 이미지가 있는 학과만 값이 존재)
  const frameImage = professor?.frame_image ?? null;
  const frameSlots = professor?.slots ?? null;
  const templateSize = professor?.template_size ?? null;

  return (
    // position: 'relative'가 있어야 우측 상단 타이머가 제자리에 붙습니다.
    <div style={{ position: 'relative', padding: '40px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* 방치 방지 타이머: 리뷰 화면에서 90초 동안 아무 조작이 없으면 처음으로 돌아갑니다. (고민할 시간을 넉넉히!) */}
      <TimeoutTimer initialTime={90} />

      <h2 style={{ marginBottom: '10px' }}>사진 확인 및 재촬영 🔍</h2>
      <p style={{ color: '#ccc', marginBottom: '10px' }}>마음에 들지 않는 사진을 터치하면 해당 컷만 다시 찍을 수 있습니다.</p>

      {/* 어떤 프레임으로 합성될지 알 수 있도록 선택한 교수님 이름을 보여줍니다. */}
      {professor && (
        <p style={{ color: '#888', marginBottom: '20px', fontSize: '0.95rem' }}>
          선택한 프레임: {professor.emoji} <strong>{professor.name}</strong> ({professor.department})
        </p>
      )}
      
      {/* 4장의 사진을 2x2 격자(Grid) 형태로 보여주는 컨테이너입니다. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
        {cuts.map((cut, index) => (
          <div 
            key={index} 
            onClick={() => handleRetake(index)}
            style={{
              // 프레임 구멍과 같은 비율의 썸네일 (backgroundSize: 'cover'가 합성과 같은 가운데 크롭을 해줍니다)
              width: `${thumbW}px`,
              height: `${thumbH}px`,
              backgroundColor: cut ? 'transparent' : '#444', // 사진이 있으면 배경색 투명화
              backgroundImage: cut ? `url(${cut})` : 'none', // 찍은 사진을 배경 이미지로 렌더링!
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '3px solid #666', 
              borderRadius: '10px', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/*
              사진 위에 프레임을 겹쳐 보여줍니다. (촬영 화면과 같은 원리)
              프레임 전체를 "이 컷의 구멍"이 썸네일에 딱 맞도록 확대·이동시키고,
              썸네일 밖(overflow: hidden)은 잘라내서 구멍 주변 장식만 보이게 합니다.
            */}
            {frameImage && frameSlots && templateSize && frameSlots[index] && (() => {
              const [slotL, slotT, slotR, slotB] = frameSlots[index];
              const scaleX = thumbW / (slotR - slotL);
              const scaleY = thumbH / (slotB - slotT);
              return (
                <img
                  src={frameImage}
                  alt=""
                  style={{
                    position: 'absolute',
                    left: `${-slotL * scaleX}px`,
                    top: `${-slotT * scaleY}px`,
                    width: `${templateSize[0] * scaleX}px`,
                    height: `${templateSize[1] * scaleY}px`,
                    maxWidth: 'none',      // 부모 크기에 맞춰 줄어들지 않게 고정합니다.
                    pointerEvents: 'none', // 터치(재촬영 선택)를 가로채지 않게 합니다.
                  }}
                />
              );
            })()}

            {/* 사진이 없을 때만 몇 번째 컷인지 텍스트를 보여주고, 사진이 있으면 재촬영 안내 텍스트만 보여줍니다. */}
            {!cut && (
              <span style={{ color: 'white', fontWeight: 'bold', marginBottom: '10px' }}>
                여기에 {index + 1}번째 사진 표시
              </span>
            )}
            <span style={{ 
              fontSize: '0.9rem', 
              color: '#ddd', 
              backgroundColor: 'rgba(0,0,0,0.6)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              position: cut ? 'absolute' : 'relative', // 사진이 있을 땐 하단에 둥둥 띄우기
              bottom: cut ? '10px' : 'auto'
            }}>
              터치하여 다시 찍기 🔄
            </span>
          </div>
        ))}
      </div>

      {/* 최종 확인 및 다음 단계로 이동하는 버튼 (미촬영 컷이 있으면 잠깁니다) */}
      <button
        onClick={handleFinish}
        disabled={hasEmptyCut}
        style={{
          padding: '15px 40px',
          backgroundColor: hasEmptyCut ? '#555' : '#FF9800',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          cursor: hasEmptyCut ? 'not-allowed' : 'pointer',
        }}
      >
        {hasEmptyCut ? '아직 안 찍힌 컷이 있어요! 빈 컷을 터치해 촬영해주세요' : '이대로 사진 합성하고 출력하기 ✨'}
      </button>
    </div>
  );
}

export default Review;
