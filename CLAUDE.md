# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

"교수네컷" — 교수님 프레임과 함께 4컷 사진을 찍는 키오스크형 포토부스. React(Vite) 프론트엔드와 FastAPI 백엔드가 `frontend/`, `backend/`로 완전히 분리되어 있으며, 둘을 묶는 모노레포 도구는 없습니다. 각 디렉터리에서 따로 명령을 실행하세요.

## 필수 규칙 (`.agents/AGENTS.md`에서 승계)

**모든 코드에 한글 주석을 상세히 달아야 합니다.** 프론트엔드/백엔드 구분 없이 코드를 작성하거나 수정할 때, 해당 블록·함수·변수가 무슨 역할을 하는지 초보자도 이해할 수 있도록 코드 윗줄이나 옆에 친절한 한글 설명을 붙입니다. 기존 코드가 이미 이 스타일(문장형 한글 주석, 이모지 포함)을 따르고 있으니 맞춰서 작성하세요.

## 명령어

### frontend/
```bash
npm run dev       # Vite 개발 서버
npm run build     # 프로덕션 빌드
npm run lint      # oxlint (ESLint 아님)
npm run preview   # 빌드 결과 미리보기
```

### backend/
```bash
pip install -r requirements.txt
uvicorn main:app --reload            # 로컬 실행 (127.0.0.1:8000)
docker compose up --build            # 컨테이너 실행 (0.0.0.0:8000, --reload 포함)
```

테스트 러너는 양쪽 모두 설정되어 있지 않습니다. 백엔드 엔드포인트 수동 확인은 `backend/test_main.http`(JetBrains HTTP Client 형식)를 사용합니다.

## 아키텍처

### 화면 흐름과 상태 전달

`frontend/src/App.jsx`가 `BrowserRouter`로 5개 화면을 라우팅하며, 촬영 세션은 다음 순서로 진행됩니다:

```
Home(/) → Select(/select) → Capture(/capture) ⇄ Review(/review) → Result(/result)
```

**전역 상태 관리 라이브러리가 없습니다.** 사진 데이터는 오직 react-router의 `navigate(path, { state })` / `useLocation().state`로만 화면 사이를 이동합니다. 새로고침하면 전부 날아갑니다.

핵심 상태 객체는 `cuts` — 길이 4의 배열이며 각 원소는 `react-webcam`의 `getScreenshot()`이 반환한 base64 JPEG data URL(또는 미촬영 시 `null`)입니다.

**재촬영 루프**가 이 구조의 핵심입니다. `Review`에서 특정 컷을 누르면 `{ cuts, retakeIndex: index }`를 들고 `/capture`로 되돌아갑니다. `Capture`는 `location.state.retakeIndex`의 존재 여부로 동작 모드를 갈라냅니다:
- `retakeIndex === null` → 일반 모드: 0~3번 컷을 연속 촬영
- `retakeIndex !== null` → 재촬영 모드: 해당 인덱스 1장만 찍고 즉시 `/review`로 복귀

`Capture`를 수정할 때는 항상 두 모드 모두에서 동작하는지 확인하세요.

### 타이머가 두 종류입니다 (혼동 주의)

1. **`components/TimeoutTimer.jsx`** — 키오스크 방치 방지용. 기본 60초 뒤 `/`로 강제 이동시키며 우측 상단에 남은 시간을 표시합니다. 현재 `Select`, `Result`에서 사용 중이고, 새 화면을 추가하면 한 줄로 끼워 넣으면 됩니다. 부모 컨테이너에 `position: relative`가 있어야 위치가 맞습니다.
2. **`Capture.jsx` 내부 카운트다운** — 자동 셔터. 0초가 되는 순간 `captureImage()`를 호출해 촬영합니다. 첫 컷만 15초(포즈 잡을 시간), 나머지와 재촬영은 10초입니다(`getInitialTime`). `Capture`는 `TimeoutTimer`를 쓰지 않습니다.

### 스타일링

CSS 파일은 전역 리셋과 다크 테마 베이스만 정의한 `src/index.css` 하나뿐이고, 나머지는 전부 JSX 인라인 `style` 객체입니다. CSS 모듈이나 Tailwind는 없습니다.

### 미구현 영역

다음은 자리표시자(placeholder)이며 실제 로직이 아직 없습니다. 관련 작업 시 새로 만드는 것이 맞습니다:
- `Select.jsx` — 교수님/프레임 리스트가 점선 박스로만 있음
- `Result.jsx` — QR 코드가 흰 사각형 텍스트로만 있음. `qrcode.react`는 설치되어 있으나 미사용
- **프론트–백엔드 연동 자체가 없음** — `axios`는 설치되어 있으나 어디서도 import하지 않습니다. `backend/main.py`는 `/`, `/hello/{name}` 두 개의 Hello World 엔드포인트뿐인 골격 상태이고, 사진 업로드·합성·저장·QR용 URL 발급 로직이 전부 미구현입니다.

## 저장소 상태 관련 주의사항

- **`frontend/node_modules`가 git에 커밋되어 있습니다.** `frontend/.gitignore`에 `node_modules`가 있지만 이미 추적 중이라 무시되지 않습니다. 프론트엔드 작업 후 `git add`할 때 의도치 않게 수천 개 파일이 딸려 들어가지 않도록 경로를 지정해서 스테이징하세요.
- **`backend/.env`가 커밋되어 있습니다** (현재는 `SOMETHING_VERY_SPECIAL` 플레이스홀더뿐). `docker-compose.yml`이 `env_file`로 읽습니다. 실제 키를 추가하기 전에 추적 해제가 필요합니다.
- **브랜치별로 프론트엔드 소스 유무가 다릅니다.** 위에 설명한 `frontend/src` 전체는 로컬 `main` 브랜치에만 존재하고, 현재 체크아웃된 `yjm` 브랜치와 `origin/main`에는 `backend/`와 `frontend/node_modules`만 있습니다. 프론트엔드 파일을 찾을 수 없다면 `git show main:frontend/src/App.jsx` 식으로 확인하거나 브랜치를 먼저 확인하세요.
