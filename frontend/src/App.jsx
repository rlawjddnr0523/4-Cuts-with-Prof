// react-router-dom에서 라우팅에 필요한 필수 컴포넌트들을 불러옵니다.
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 각 화면(페이지) 컴포넌트들을 불러옵니다.
import Home from './pages/Home';
import Select from './pages/Select';
import Capture from './pages/Capture';
import Review from './pages/Review'; // 새로 추가된 리뷰 화면 컴포넌트
import Result from './pages/Result';

// App 컴포넌트: 전체 프론트엔드 애플리케이션의 최상위 라우터 역할을 합니다.
function App() {
  return (
    // BrowserRouter: HTML5의 History API를 사용하여 UI와 URL을 동기화합니다.
    <BrowserRouter>
      {/* Routes: 여러 Route 컴포넌트 중 현재 URL과 일치하는 첫 번째 Route를 렌더링합니다. */}
      <Routes>
        {/* 기본 주소('/')로 접속하면 Home(시작하기) 컴포넌트를 보여줍니다. */}
        <Route path="/" element={<Home />} />
        
        {/* '/select' 주소로 접속하면 Select(교수님 선택) 컴포넌트를 보여줍니다. */}
        <Route path="/select" element={<Select />} />
        
        {/* '/capture' 주소로 접속하면 Capture(웹캠 촬영) 컴포넌트를 보여줍니다. */}
        <Route path="/capture" element={<Capture />} />

        {/* '/review' 주소로 접속하면 촬영한 4컷 사진을 검토하고 재촬영을 선택할 수 있는 컴포넌트를 보여줍니다. */}
        <Route path="/review" element={<Review />} />
        
        {/* '/result' 주소로 접속하면 Result(결과 및 QR 출력) 컴포넌트를 보여줍니다. */}
        <Route path="/result" element={<Result />} />
      </Routes>
    </BrowserRouter>
  );
}

// App 컴포넌트를 내보내어 main.jsx에서 사용할 수 있도록 합니다.
export default App;
