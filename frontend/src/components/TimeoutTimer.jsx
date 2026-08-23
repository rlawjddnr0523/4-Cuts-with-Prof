// 페이지 강제 이동을 위한 useNavigate와 상태/생명주기 관리를 위한 훅을 불러옵니다.
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

// 지정된 시간(초)이 지나면 자동으로 메인 화면('/')으로 이동시키는 공통 타이머 컴포넌트입니다.
// initialTime 프로퍼티로 시작 시간을 받을 수 있으며, 기본값은 60초입니다.
function TimeoutTimer({ initialTime = 60 }) {
  const navigate = useNavigate();
  
  // 남은 시간을 저장하고 화면에 렌더링하기 위한 상태입니다.
  const [timeLeft, setTimeLeft] = useState(initialTime);

  // 컴포넌트가 렌더링될 때 딱 한 번 실행되어 1초마다 줄어드는 시계를 작동시킵니다.
  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // 시간이 0초가 되면 인터벌을 멈추고 처음 화면으로 강제 이동합니다.
          clearInterval(intervalId);
          navigate('/');
          return 0;
        }
        return prev - 1; // 1초 감소
      });
    }, 1000);

    // 사용자가 페이지를 벗어나서 이 컴포넌트가 화면에서 사라질 때, 시계를 깔끔하게 청소해 줍니다.
    return () => {
      clearInterval(intervalId);
    };
  }, [navigate]);

  return (
    // 우측 상단에 고정되어 남은 시간을 보여주는 UI 디자인입니다.
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      right: '30px', 
      backgroundColor: 'rgba(255,255,255,0.1)', 
      padding: '10px 20px', 
      borderRadius: '30px', 
      fontWeight: 'bold', 
      border: '1px solid #555' 
    }}>
      ⏳ {timeLeft}초 뒤 처음으로
    </div>
  );
}

export default TimeoutTimer;
