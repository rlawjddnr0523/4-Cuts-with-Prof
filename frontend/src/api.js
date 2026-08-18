// 백엔드(FastAPI)와 통신할 때 쓰는 공용 axios 인스턴스입니다.
// 어느 화면에서든 이 파일 하나만 import하면 백엔드 주소를 일일이 적을 필요가 없습니다.
import axios from 'axios';

// 백엔드 서버의 기본 주소입니다.
// .env 파일에 VITE_API_BASE_URL을 정의하면 그 값을 쓰고, 없으면 로컬 개발 주소를 사용합니다.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
});

// 교수님 프레임 목록을 백엔드에서 받아오는 함수입니다. (Select 화면에서 사용)
export async function fetchProfessors() {
  const response = await api.get('/professors');
  // 백엔드 응답 형태: { professors: [...] } → 배열만 꺼내서 돌려줍니다.
  return response.data.professors;
}

// 촬영한 4컷 사진과 선택한 교수님 id를 백엔드로 보내 합성을 요청하는 함수입니다. (Result 화면에서 사용)
// 성공하면 { photo_id, url }을 돌려받으며, url을 QR 코드로 만들면 휴대폰에서 사진을 받을 수 있습니다.
export async function createPhoto(professorId, cuts) {
  const response = await api.post('/photos', {
    professor_id: professorId,
    cuts: cuts,
  });
  return response.data;
}

export default api;
