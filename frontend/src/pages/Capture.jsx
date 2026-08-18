// 페이지 이동을 위한 훅, 상태 관리 훅, 그리고 웹캠 기능을 위한 라이브러리를 불러옵니다.
import { useNavigate, useLocation } from 'react-router-dom';
import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

// 실제 웹캠으로 사진을 촬영하는 컴포넌트입니다.
function Capture() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 웹캠 화면에 접근하기 위한 참조(Ref) 객체입니다. 이를 통해 찰칵! 사진을 캡처할 수 있습니다.
  const webcamRef = useRef(null);

  // Review 페이지 등에서 넘겨받은 기존 사진 배열(cuts)과 재촬영 인덱스를 확인합니다.
  const initialCuts = location.state?.cuts || [null, null, null, null];
  const retakeIndex = location.state?.retakeIndex ?? null;
  // Select 화면에서 고른 교수님 정보입니다. 최종 합성 때 필요하므로 다음 화면까지 계속 들고 다닙니다.
  const professor = location.state?.professor ?? null;

  // 전체 4컷의 사진 데이터를 관리하는 상태입니다.
  const [cuts, setCuts] = useState(initialCuts);
  
  // 모드 판별: 재촬영 인덱스가 있다면 '재촬영 모드', 없으면 '일반 4컷 연속 촬영 모드'입니다.
  const isRetake = retakeIndex !== null;

  // 선택한 프레임의 '사진 구멍' 가로/세로 비율입니다. (백엔드가 계산해서 내려줌, 없으면 기본 4:3)
  // 미리보기 상자를 이 비율로 만들면, 웹캠 영상이 최종 합성 결과와 똑같은 영역만 보여줍니다.
  const slotRatio = professor?.slot_ratio ?? 4 / 3;
  // 미리보기 상자 크기: 높이 600px을 기준으로 비율에 맞는 너비를 계산합니다. (가로형 프레임도 800px은 안 넘게)
  const previewH = 600;
  const previewW = Math.min(800, Math.round(previewH * slotRatio));

  // 프레임 실시간 겹쳐 보기용 정보입니다. (프레임 이미지가 있는 학과만 값이 존재)
  // slots[i] = i번째 컷이 들어갈 구멍의 [왼쪽, 위, 오른쪽, 아래] 좌표 (프레임 원본 기준)
  const frameImage = professor?.frame_image ?? null;
  const frameSlots = professor?.slots ?? null;
  const templateSize = professor?.template_size ?? null;
  
  // 현재 몇 번째 컷을 촬영 중인지 나타내는 상태입니다. (일반 모드는 0,1,2,3 순서로 증가)
  const [currentIndex, setCurrentIndex] = useState(isRetake ? retakeIndex : 0);
  
  // 첫 컷은 포즈 잡을 시간을 주기 위해 15초, 나머지는 10초를 줍니다. (재촬영은 무조건 10초)
  const getInitialTime = (index) => (index === 0 && !isRetake ? 15 : 10);
  
  // 화면에 표시될 남은 카운트다운 초입니다.
  const [timeLeft, setTimeLeft] = useState(() => getInitialTime(currentIndex));
  
  // 촬영이 모두 끝났는지 여부를 관리합니다.
  const [isFinished, setIsFinished] = useState(false);

  // 실제로 카메라 화면을 캡처(찰칵)해서 사진 데이터로 저장하는 함수입니다.
  const captureImage = useCallback(() => {
    // 웹캠에서 현재 화면을 Base64 이미지 문자열로 뽑아옵니다. (카메라가 아직 준비 전이면 null이 나옵니다)
    const imageSrc = webcamRef.current?.getScreenshot();

    // 카메라가 준비되지 않아 캡처에 실패했다면, 빈 사진(null)을 저장하는 대신
    // 카운트다운을 3초로 되돌려서 잠시 뒤에 다시 찰칵을 시도합니다. 🔄
    if (!imageSrc) {
      setTimeLeft(3);
      return;
    }

    setCuts((prevCuts) => {
      const newCuts = [...prevCuts];
      newCuts[currentIndex] = imageSrc; // 현재 인덱스 자리에 캡처한 사진을 쏙 넣습니다.
      return newCuts;
    });

    if (isRetake) {
      // 재촬영 모드면 딱 1장만 찍고 바로 촬영 종료 처리합니다.
      setIsFinished(true);
    } else {
      if (currentIndex < 3) {
        // 아직 4장을 다 못 찍었으면 다음 컷으로 넘어갑니다.
        setCurrentIndex((prev) => prev + 1);
      } else {
        // 4장(0,1,2,3)을 모두 찍었으면 촬영 종료 처리합니다.
        setIsFinished(true);
      }
    }
  }, [webcamRef, currentIndex, isRetake]);

  // 항상 최신 버전의 captureImage를 가리키는 참조입니다.
  // (아래 '0초 감지' useEffect가 captureImage를 의존성으로 직접 갖게 되면,
  //  컷이 넘어가는 순간 timeLeft가 아직 0인 상태에서 effect가 다시 실행되어
  //  다음 컷이 곧바로 찍혀버리는 문제가 생기므로 ref로 우회합니다.)
  const captureImageRef = useRef(captureImage);
  useEffect(() => {
    captureImageRef.current = captureImage;
  }, [captureImage]);

  // 새로운 컷으로 넘어갈 때마다 타이머를 새 시간에 맞게(15초 또는 10초) 다시 채워줍니다.
  useEffect(() => {
    if (!isFinished) {
      setTimeLeft(getInitialTime(currentIndex));
    }
  }, [currentIndex, isFinished, isRetake]);

  // 실질적인 카운트다운 시계 로직입니다. 1초마다 남은 시간을 줄이기만 합니다.
  // ⚠️ 예전에는 이 안에서 captureImage()까지 호출했는데, setState 업데이터 함수는
  //    React가 두 번 호출할 수도 있어서(특히 StrictMode) 컷이 건너뛰어지는 버그가 있었습니다.
  //    그래서 시계는 '숫자 줄이기'만 하고, 찰칵은 아래의 '0초 감지' effect가 담당합니다.
  useEffect(() => {
    if (isFinished) return; // 촬영이 끝났으면 시계를 멈춥니다.

    const timerId = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0)); // 1초씩 줄어들되 0 밑으로는 안 내려갑니다.
    }, 1000);

    return () => clearInterval(timerId); // 컴포넌트 정리 시 시계를 부숩니다.
  }, [currentIndex, isFinished]);

  // '0초 감지' effect: 카운트다운이 0이 되는 순간 찰칵! 하고 사진을 찍습니다.
  // timeLeft가 실제로 변할 때만 실행되므로, 컷이 넘어가는 전환 순간에 중복 촬영될 걱정이 없습니다.
  useEffect(() => {
    if (timeLeft === 0 && !isFinished) {
      captureImageRef.current();
    }
  }, [timeLeft, isFinished]);

  // 촬영이 완벽하게 모두 끝났을 때(isFinished === true), 찍은 사진들과 교수님 정보를 들고 Review 페이지로 넘어갑니다.
  useEffect(() => {
    if (isFinished) {
      navigate('/review', { state: { cuts, professor } });
    }
  }, [isFinished, navigate, cuts, professor]);

  return (
    // 전체 화면 컨테이너입니다.
    <div style={{ backgroundColor: '#111', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* 몇 번째 컷인지 알려주는 안내 텍스트 */}
      <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '2rem' }}>
        {currentIndex + 1}번째 컷 촬영 중... 📸
      </h2>
      
      {/* 웹캠 화면과 큼지막한 카운트다운 텍스트를 겹쳐 놓기 위한 박스입니다. (프레임 구멍과 같은 비율) */}
      <div style={{ position: 'relative', width: `${previewW}px`, height: `${previewH}px`, borderRadius: '20px', overflow: 'hidden', border: '4px solid #4CAF50', boxShadow: '0 0 20px rgba(76, 175, 80, 0.5)' }}>

        {/* 실제 웹캠 영상이 출력되는 컴포넌트입니다.
            objectFit: 'cover'가 상자를 꽉 채우면서 넘치는 부분을 잘라 보여주는데,
            백엔드 합성도 같은 방식(가운데 크롭)이라 화면에 보이는 그대로 사진이 나옵니다. */}
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ width: 1280, height: 960, facingMode: "user" }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/*
          웹캠 영상 위에 프레임을 실시간으로 겹쳐 보여줍니다. (프레임 이미지가 있는 학과만)
          원리: 프레임 전체 이미지를 "지금 찍는 컷의 구멍"이 미리보기 상자에 딱 맞도록
          확대·이동시켜 놓으면, 상자(overflow: hidden) 밖으로 나간 부분은 잘리고
          구멍 주변의 프레임 장식만 웹캠 위에 보이게 됩니다. 합성 결과와 똑같은 모습!
        */}
        {frameImage && frameSlots && templateSize && frameSlots[currentIndex] && (() => {
          const [slotL, slotT, slotR, slotB] = frameSlots[currentIndex];
          // 구멍 크기 → 미리보기 상자 크기로 가는 확대 배율입니다.
          const scaleX = previewW / (slotR - slotL);
          const scaleY = previewH / (slotB - slotT);
          return (
            <img
              src={frameImage}
              alt=""
              style={{
                position: 'absolute',
                // 구멍의 왼쪽 위 모서리가 상자의 (0, 0)에 오도록 프레임을 밀어 놓습니다.
                left: `${-slotL * scaleX}px`,
                top: `${-slotT * scaleY}px`,
                width: `${templateSize[0] * scaleX}px`,
                height: `${templateSize[1] * scaleY}px`,
                maxWidth: 'none',      // 부모 크기에 맞춰 줄어들지 않게 고정합니다.
                pointerEvents: 'none', // 프레임이 터치/클릭을 가로채지 않게 합니다.
              }}
            />
          );
        })()}
        
        {/* 웹캠 영상 한가운데 띄워주는 커다란 카운트다운 숫자입니다. */}
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          fontSize: '150px', 
          fontWeight: 'bold', 
          color: timeLeft <= 3 ? '#FF5252' : 'white', // 3초 남았을 때부터 빨간색으로 경고!
          textShadow: '0px 0px 30px rgba(0,0,0,0.8)' 
        }}>
          {timeLeft}
        </div>
        
      </div>
      
      <p style={{ color: '#aaa', marginTop: '20px', fontSize: '1.2rem' }}>
        {isRetake ? '재촬영 모드입니다. 예쁜 포즈를 취해주세요!' : '포즈를 취해주세요! 시간이 다 되면 자동으로 찰칵 찍힙니다.'}
      </p>

    </div>
  );
}

export default Capture;
