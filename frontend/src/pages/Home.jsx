// 페이지 이동을 위해 react-router-dom의 Link 컴포넌트를 불러옵니다.
import { Link } from 'react-router-dom';

// 첫 화면(시작하기) 컴포넌트입니다.
function Home() {
  return (
    // 전체 화면을 채우고 가운데 정렬하기 위한 컨테이너 div입니다.
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      
      {/* 메인 타이틀 */}
      <h1 style={{ marginBottom: '10px' }}>교수네컷에 오신 것을 환영합니다! 📸</h1>
      
      {/* 서브 설명 텍스트 */}
      <p style={{ marginBottom: '30px', color: '#ccc' }}>교수님과 함께하는 특별한 4컷 사진</p>
      
      {/* 
        시작하기 버튼 (Link 컴포넌트 사용)
        클릭 시 '/select' 주소로 부드럽게 이동합니다.
      */}
      <Link to="/select" style={{ padding: '15px 40px', backgroundColor: '#ffffff', color: '#000000', textDecoration: 'none', borderRadius: '30px', fontSize: '1.2rem', fontWeight: 'bold', transition: 'transform 0.2s' }}>
        시작하기
      </Link>
    </div>
  );
}

// Home 컴포넌트를 밖에서 쓸 수 있게 내보냅니다.
export default Home;
