// 다른 페이지로 이동하기 위한 Link, useLocation 훅과 공통 타이머 컴포넌트를 불러옵니다.
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
// 실제 QR 코드를 SVG로 그려주는 컴포넌트입니다. (qrcode.react v4)
import { QRCodeSVG } from 'qrcode.react';
import TimeoutTimer from '../components/TimeoutTimer';
// 4컷 사진 합성을 백엔드에 요청하는 공용 API 함수를 불러옵니다.
import { createPhoto } from '../api';

// 촬영이 끝난 후 QR 코드와 결과물을 보여주는 화면 컴포넌트입니다.
function Result() {
  const location = useLocation();

  // 백엔드가 합성 후 돌려준 사진 다운로드 URL입니다. (QR 코드의 내용물이 됩니다)
  const [photoUrl, setPhotoUrl] = useState(null);
  // 합성 요청이 진행 중인지 / 실패했는지를 나타내는 상태입니다.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // React 18+의 StrictMode에서는 useEffect가 두 번 실행될 수 있으므로,
  // 합성 요청이 중복으로 날아가 사진이 두 장 저장되는 것을 막는 잠금 장치입니다.
  const requested = useRef(false);

  // 화면이 나타나자마자 백엔드에 사진 합성을 요청합니다.
  useEffect(() => {
    if (requested.current) return; // 이미 요청을 보냈다면 다시 보내지 않습니다.
    requested.current = true;

    // Review 화면에서 넘겨받은 4컷 사진과 교수님 정보를 라우터 상태에서 꺼냅니다.
    const cuts = location.state?.cuts || [null, null, null, null];
    const professor = location.state?.professor ?? null;

    // 교수님 정보 없이 이 화면에 직접 들어온 경우(URL 직접 입력 등)는 합성할 수 없습니다.
    if (!professor) {
      setError('선택된 교수님 정보가 없습니다. 처음부터 다시 진행해주세요. 🙏');
      setLoading(false);
      return;
    }

    createPhoto(professor.id, cuts)
      .then((data) => setPhotoUrl(data.url)) // 성공하면 QR에 넣을 URL을 저장!
      .catch(() => setError('사진 합성에 실패했습니다. 백엔드 서버 상태를 확인해주세요. 😢'))
      .finally(() => setLoading(false));
  }, [location.state]);

  return (
    // 화면 중앙에 요소들을 배치하기 위한 플렉스박스(Flexbox) 컨테이너입니다.
    <div style={{ position: 'relative', padding: '40px', textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

      {/* 공통 타이머 컴포넌트: 60초 뒤 자동으로 처음 화면으로 돌아가 다음 손님을 받습니다. */}
      <TimeoutTimer />

      {/* 완료 안내 텍스트 */}
      <h2 style={{ marginBottom: '10px' }}>촬영 완료! 🎉</h2>
      <p style={{ color: '#ccc', marginBottom: '30px' }}>
        {loading
          ? '사진을 예쁘게 합성하는 중입니다... ⏳'
          : error
            ? '문제가 발생했어요.'
            : '아래 QR 코드를 스캔하여 사진을 다운로드 하세요.'}
      </p>

      {/* 합성 결과에 따라 QR 코드 / 로딩 / 에러 화면을 갈아 끼웁니다. */}
      <div style={{ width: '250px', height: '250px', backgroundColor: 'white', borderRadius: '15px', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px', padding: '15px', boxSizing: 'border-box' }}>
        {loading && <strong>합성 중... 📸</strong>}
        {error && <strong style={{ color: '#D32F2F', padding: '10px' }}>{error}</strong>}
        {photoUrl && (
          // 백엔드가 준 다운로드 URL을 QR 코드로 그립니다. 휴대폰 카메라로 스캔하면 사진이 열립니다!
          <QRCodeSVG value={photoUrl} size={220} level="M" />
        )}
      </div>

      {/* 합성이 성공했으면 완성본 미리보기도 작게 보여줍니다. */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt="합성된 4컷 사진 미리보기"
          style={{ height: '200px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 0 15px rgba(255,255,255,0.2)' }}
        />
      )}

      {/*
        처음으로 돌아가기 버튼
        클릭 시 루트 경로('/')인 Home 화면으로 이동합니다.
      */}
      <Link to="/" style={{ padding: '15px 30px', backgroundColor: '#333', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
        다시 찍기 (처음으로)
      </Link>
    </div>
  );
}

export default Result;
