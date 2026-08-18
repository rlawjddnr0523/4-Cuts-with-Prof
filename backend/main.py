# FastAPI 본체와 요청/응답 처리에 필요한 도구들을 불러옵니다.
from fastapi import FastAPI, HTTPException, Request
# 프론트엔드(다른 주소에서 실행됨)가 이 서버를 호출할 수 있게 허용해주는 CORS 미들웨어입니다.
from fastapi.middleware.cors import CORSMiddleware
# 합성이 끝난 사진 파일을 URL로 바로 서빙하기 위한 정적 파일 도구입니다.
from fastapi.staticfiles import StaticFiles
# 요청 본문(JSON)의 형태를 검증해주는 pydantic 모델입니다.
from pydantic import BaseModel
# 이미지 합성을 담당하는 Pillow 라이브러리입니다. (사진 그리기, 글씨 쓰기 담당)
from PIL import Image, ImageDraw, ImageFont
# base64 문자열 <-> 이미지 변환, 파일 경로, 고유 ID 생성에 쓰는 표준 라이브러리들입니다.
import base64
import io
import uuid
from pathlib import Path

app = FastAPI()

# ─────────────────────────────────────────────
# CORS 설정: Vite 개발 서버(5173)에서 오는 요청을 허용합니다.
# 키오스크 환경에서는 프론트와 백엔드가 같은 기기에서 돌기 때문에 localhost 계열만 열어둡니다.
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite 개발 서버 기본 주소
        "http://127.0.0.1:5173",   # localhost 대신 IP로 접속하는 경우
    ],
    allow_credentials=True,
    allow_methods=["*"],   # GET, POST 등 모든 메서드 허용
    allow_headers=["*"],   # 모든 요청 헤더 허용
)

# ─────────────────────────────────────────────
# 합성된 사진을 저장할 폴더를 준비하고, /photos URL로 서빙합니다.
# 예: photos/abc.jpg 로 저장하면 → http://서버주소/photos/abc.jpg 로 접근 가능!
# ─────────────────────────────────────────────
PHOTOS_DIR = Path(__file__).parent / "photos"
PHOTOS_DIR.mkdir(exist_ok=True)  # 폴더가 없으면 자동으로 만들어줍니다.
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")

# ─────────────────────────────────────────────
# 직접 만든 프레임(템플릿) 이미지를 올려두는 폴더입니다.
#
# 사용 방법: 이 폴더에 아래 이름으로 PNG 파일을 넣으면 자동으로 적용됩니다.
#   1) "학과이름.png"  (예: 간호학과.png)     → 그 학과에만 적용
#   2) "계열이름.png"  (예: 보건생명계열.png) → 그 계열의 모든 학과에 적용
#   둘 다 있으면 학과 파일이 우선하고, 둘 다 없으면 기존처럼 단색 프레임을 씁니다.
#
# 템플릿 만드는 법: 크기는 자유! 사진이 보여야 할 자리 4곳을
#   '투명'(알파 0)한 사각형으로 뚫어두기만 하면, 서버가 구멍 위치·크기를
#   자동으로 찾아내서 사진을 딱 맞게 끼워 넣습니다. (2x2 격자, 세로 스트립 등 배치 자유)
#   구멍 순서는 읽는 순서(위 → 아래, 왼쪽 → 오른쪽)로 1~4번 컷이 배정됩니다.
# ─────────────────────────────────────────────
FRAMES_DIR = Path(__file__).parent / "frames"
FRAMES_DIR.mkdir(exist_ok=True)  # 폴더가 없으면 자동으로 만들어줍니다.
# 프론트엔드(촬영/리뷰 화면)가 프레임 이미지를 미리보기 위에 겹쳐 보여줄 수 있도록
# /frames URL로도 서빙합니다. 예: http://서버주소/frames/컴퓨터소프트웨어과.png
app.mount("/frames", StaticFiles(directory=FRAMES_DIR), name="frames")


# 이 학과에 쓸 프레임 템플릿 파일을 찾아주는 함수입니다. (없으면 None)
def find_frame_template(professor: dict) -> Path | None:
    # 학과 이름 → 계열 이름 순서로 파일을 찾습니다. (더 구체적인 쪽이 우선!)
    for stem in (professor["department"], professor["category"]):
        path = FRAMES_DIR / f"{stem}.png"
        if path.exists():
            return path
    return None  # 템플릿이 없으면 단색 프레임으로 합성합니다.


# 템플릿마다 구멍 감지를 매번 다시 하면 느리므로, 한 번 찾은 결과를 기억해두는 캐시입니다.
# key: (파일 경로, 파일 수정 시각) → value: 구멍 사각형 목록
_slot_cache: dict[tuple, list[tuple[int, int, int, int]]] = {}


# ─────────────────────────────────────────────
# 템플릿 PNG에서 '투명하게 뚫린 구멍' 4개의 위치를 자동으로 찾아내는 함수입니다.
# 반환값: [(왼쪽, 위, 오른쪽, 아래), ...] — 읽는 순서(위→아래, 왼→오른쪽)로 정렬됨
# ─────────────────────────────────────────────
def detect_slots(template_path: Path) -> list[tuple[int, int, int, int]]:
    # 같은 파일을 또 분석하지 않도록 캐시를 먼저 확인합니다.
    cache_key = (str(template_path), template_path.stat().st_mtime)
    if cache_key in _slot_cache:
        return _slot_cache[cache_key]

    img = Image.open(template_path).convert("RGBA")
    W, H = img.size
    # 투명(알파 < 16)한 곳은 255, 나머지는 0인 흑백 마스크를 만듭니다.
    mask = img.getchannel("A").point(lambda v: 255 if v < 16 else 0)

    # 픽셀을 하나하나 다 훑으면 느리니 1/8 크기로 줄여서 대략적인 구멍 덩어리를 먼저 찾습니다.
    scale = 8
    small = mask.resize((max(1, W // scale), max(1, H // scale)))
    sw, sh = small.size
    px = small.load()

    # 축소본에서 서로 붙어있는 투명 픽셀 덩어리(연결 요소)를 찾습니다. (그래프 탐색 BFS)
    visited = [[False] * sw for _ in range(sh)]
    rough_boxes = []
    for sy in range(sh):
        for sx in range(sw):
            if px[sx, sy] > 128 and not visited[sy][sx]:
                stack = [(sx, sy)]
                visited[sy][sx] = True
                minx = maxx = sx
                miny = maxy = sy
                count = 0
                while stack:
                    x, y = stack.pop()
                    count += 1
                    minx, maxx = min(minx, x), max(maxx, x)
                    miny, maxy = min(miny, y), max(maxy, y)
                    # 상하좌우로 이웃한 투명 픽셀을 같은 덩어리로 묶습니다.
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < sw and 0 <= ny < sh and not visited[ny][nx] and px[nx, ny] > 128:
                            visited[ny][nx] = True
                            stack.append((nx, ny))
                # 너무 작은 덩어리(장식용 투명 틈 등)는 구멍으로 치지 않습니다. (전체의 1% 이상만)
                if count > (sw * sh) * 0.01:
                    rough_boxes.append((minx * scale, miny * scale, (maxx + 1) * scale, (maxy + 1) * scale))

    # 축소 때문에 뭉개진 경계를 원본 해상도에서 정확하게 다듬습니다.
    slots = []
    for (l, t, r, b) in rough_boxes:
        pad = scale * 2  # 축소 오차를 감안해 살짝 넓게 잘라서 다시 잽니다.
        cl, ct = max(0, l - pad), max(0, t - pad)
        region = mask.crop((cl, ct, min(W, r + pad), min(H, b + pad)))
        bb = region.getbbox()  # 잘라낸 조각 안에서 투명 픽셀이 실제로 차지하는 영역
        if bb:
            slots.append((cl + bb[0], ct + bb[1], cl + bb[2], ct + bb[3]))

    # 읽는 순서로 정렬: 세로 위치(100px 단위로 뭉뚱그림) → 가로 위치 순
    slots.sort(key=lambda s: (round((s[1] + s[3]) / 2 / 100), (s[0] + s[2]) / 2))

    _slot_cache[cache_key] = slots
    return slots

# ─────────────────────────────────────────────
# 계열별 스타일 정의 (같은 계열의 학과들은 전부 같은 프레임 색을 씁니다)
# frame_color: 4컷 사진 테두리(프레임)와 선택 카드의 배경 색상
# emoji: 카드 위에 표시할 계열 상징 이모지
# ─────────────────────────────────────────────
CATEGORY_STYLES = {
    "스마트 ICT계열":  {"frame_color": "#2C3E50", "emoji": "💻"},  # 짙은 남색
    "라이프디자인계열": {"frame_color": "#8E44AD", "emoji": "✨"},  # 보라색
    "문화콘텐츠계열":  {"frame_color": "#E67E22", "emoji": "🎬"},  # 주황색
    "사회 교육계열":   {"frame_color": "#2980B9", "emoji": "📚"},  # 파란색
    "보건생명계열":    {"frame_color": "#C0392B", "emoji": "⚕️"},  # 빨간색
    "관광조리계열":    {"frame_color": "#16A085", "emoji": "✈️"},  # 청록색
}

# ─────────────────────────────────────────────
# 계열별 학과 목록 (총 41개, 실제 학과 데이터)
# 계열을 추가/변경할 때는 위 CATEGORY_STYLES의 키도 똑같이 맞춰주세요.
# ─────────────────────────────────────────────
DEPARTMENTS_BY_CATEGORY = {
    "스마트 ICT계열": [  # 4개
        "전기과",
        "정보통신과",
        "컴퓨터소프트웨어과",
        "전자공학과",
    ],
    "라이프디자인계열": [  # 6개
        "건축과",
        "실내건축과",
        "패션디자인비즈니스과",
        "헤어디자인전공",
        "메이크업전공",
        "스킨케어전공",
    ],
    "문화콘텐츠계열": [  # 5개
        "게임콘텐츠과",
        "웹툰만화콘텐츠과",
        "영상콘텐츠과",
        "시각디자인과",
        "K-POP과",
    ],
    "사회 교육계열": [  # 10개
        "유통물류과",
        "경영학과",
        "세무회계과",
        "국방군사학과",
        "경찰경호보안과",
        "사회복지과",
        "사회복지경영과",
        "유아교육과",
        "유아특수재활과",
        "사회복지과 아동심리보육전공",
    ],
    "보건생명계열": [  # 10개
        "간호학과",
        "치위생과",
        "치기공과",
        "작업치료과",
        "스포츠재활과",
        "응급구조과",
        "보건의료행정과",
        "식품영양학과",
        "반려동물보건과",
        "반려동물산업과",
    ],
    "관광조리계열": [  # 6개
        "항공서비스과",
        "관광영어과",
        "호텔관광과",
        "호텔외식조리과",
        "카페.베이커리과",
        "호텔외식경영전공",
    ],
}

# 위의 두 정의를 조합해서 프론트엔드에 내려줄 최종 목록(41개)을 만듭니다.
# 각 항목의 형태는 기존과 동일하게 유지하되, 어느 계열인지 알 수 있는 category 필드를 추가했습니다.
PROFESSORS = []
_next_id = 1  # 1번부터 순서대로 붙이는 고유 번호입니다.
for _category, _departments in DEPARTMENTS_BY_CATEGORY.items():
    _style = CATEGORY_STYLES[_category]
    for _dept in _departments:
        PROFESSORS.append({
            "id": _next_id,
            "name": f"{_dept} 교수님",           # 임시 이름 (교수님 명단을 받으면 교체)
            "department": _dept,                  # 학과 이름
            "category": _category,                # 소속 계열 (색상 통일 기준)
            "emoji": _style["emoji"],
            "frame_color": _style["frame_color"],  # 계열 공통 프레임 색상
            "text_color": "#FFFFFF",
        })
        _next_id += 1


# 서버가 살아있는지 확인하는 용도의 기본(헬스체크) 엔드포인트입니다.
@app.get("/")
async def root():
    return {"message": "교수네컷 백엔드가 정상 작동 중입니다! 📸"}


# 프론트엔드 Select 화면이 호출하는 교수님 프레임 목록 API입니다.
# 각 학과에 아래 정보를 붙여서 내려줍니다:
#   slot_ratio    — 사진 구멍의 가로/세로 비율 (촬영/리뷰 미리보기 비율 맞추기용)
#   frame_image   — 프레임 PNG의 URL (미리보기 위에 프레임을 실시간으로 겹쳐 보여주기용)
#   template_size — 프레임 원본의 [가로, 세로] 픽셀 크기
#   slots         — 구멍 4개의 좌표 [[왼쪽, 위, 오른쪽, 아래], ...] (1~4번 컷 순서)
# → 프론트는 이 좌표로 "지금 찍는 컷이 프레임의 어느 구멍에 들어가는지"를 그대로 재현합니다.
@app.get("/professors")
async def get_professors(request: Request):
    result = []
    for p in PROFESSORS:
        item = dict(p)  # 원본을 건드리지 않도록 복사합니다.
        ratio = 4 / 3  # 기본값: 템플릿이 없으면 기존 4:3 가로 사진 그대로입니다.
        template_path = find_frame_template(p)
        if template_path is not None:
            slots = detect_slots(template_path)
            if len(slots) == 4:
                # 첫 번째 구멍의 비율을 대표값으로 씁니다. (보통 4개가 모두 같은 크기)
                left, top, right, bottom = slots[0]
                ratio = (right - left) / (bottom - top)
                # 프론트가 미리보기 위에 프레임을 겹칠 때 필요한 정보들입니다.
                item["frame_image"] = f"{request.base_url}frames/{template_path.name}"
                item["template_size"] = list(Image.open(template_path).size)
                item["slots"] = slots
        item["slot_ratio"] = round(ratio, 4)
        result.append(item)
    return {"professors": result}


# ─────────────────────────────────────────────
# 사진 합성 요청의 본문(JSON) 형태 정의
# cuts: react-webcam이 만들어준 base64 JPEG data URL 4장 (미촬영 컷은 null일 수 있음)
# professor_id: Select 화면에서 고른 교수님의 id
# ─────────────────────────────────────────────
class PhotoRequest(BaseModel):
    professor_id: int
    cuts: list[str | None]


# base64 data URL("data:image/jpeg;base64,....")을 Pillow 이미지 객체로 바꿔주는 함수입니다.
def decode_data_url(data_url: str) -> Image.Image:
    # 앞쪽의 "data:image/jpeg;base64," 라벨 부분을 잘라내고 순수 base64 본문만 남깁니다.
    _, _, encoded = data_url.partition(",")
    raw = base64.b64decode(encoded)
    # 바이트 데이터를 메모리 버퍼에 담아 Pillow 이미지로 엽니다. (RGB로 통일)
    return Image.open(io.BytesIO(raw)).convert("RGB")


# 한글이 깨지지 않는 글꼴을 찾아서 로드하는 함수입니다.
def load_korean_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # 운영체제별로 흔히 존재하는 한글 글꼴 후보들을 순서대로 시도합니다.
    candidates = [
        "C:/Windows/Fonts/malgun.ttf",                              # 윈도우: 맑은 고딕
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",          # 리눅스(도커): 나눔고딕
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",               # 맥OS
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue  # 이 경로에 글꼴이 없으면 다음 후보로 넘어갑니다.
    # 후보가 전부 실패하면 Pillow 기본 글꼴로라도 표시합니다. (한글은 깨질 수 있음)
    return ImageFont.load_default()


# ─────────────────────────────────────────────
# 사진을 원하는 가로/세로 비율에 맞게 '가운데 기준으로 잘라내는' 함수입니다.
# 비율이 다른 구멍에 사진을 그냥 욱여넣으면 얼굴이 늘어나거나 찌그러지므로,
# 비율을 유지한 채 넘치는 부분만 잘라냅니다. (화면의 objectFit: 'cover'와 같은 방식)
# ─────────────────────────────────────────────
def crop_to_ratio(img: Image.Image, target_ratio: float) -> Image.Image:
    w, h = img.size
    current_ratio = w / h
    if current_ratio > target_ratio:
        # 사진이 목표보다 가로로 넓으면 → 좌우를 잘라냅니다.
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    else:
        # 사진이 목표보다 세로로 길면 → 위아래를 잘라냅니다.
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        return img.crop((0, top, w, top + new_h))


# ─────────────────────────────────────────────
# 프레임 템플릿의 '구멍 위치'에 맞춰 사진을 끼워 넣는 합성 함수입니다.
# 1) 템플릿과 같은 크기의 캔버스를 만들고
# 2) 감지된 구멍 자리마다 사진을 (구멍 비율로 잘라서) 붙인 뒤
# 3) 그 위에 템플릿을 얹으면 → 투명한 구멍으로만 사진이 보입니다!
# ─────────────────────────────────────────────
def compose_with_template(cuts: list[Image.Image | None], professor: dict, template_path: Path) -> Image.Image:
    template = Image.open(template_path).convert("RGBA")
    slots = detect_slots(template_path)

    # 배경 캔버스: 템플릿의 반투명한 부분이 있어도 어색하지 않도록 계열 색으로 깔아줍니다.
    canvas = Image.new("RGB", template.size, professor["frame_color"])
    draw = ImageDraw.Draw(canvas)

    # 구멍 순서(위→아래, 왼→오른쪽)대로 1~4번 컷을 배정합니다.
    for cut, (left, top, right, bottom) in zip(cuts, slots):
        slot_w, slot_h = right - left, bottom - top
        if cut is not None:
            # 사진을 구멍 비율로 가운데 크롭한 뒤 구멍 크기에 딱 맞게 줄여 붙입니다.
            fitted = crop_to_ratio(cut, slot_w / slot_h).resize((slot_w, slot_h))
            canvas.paste(fitted, (left, top))
        else:
            # 미촬영 컷은 회색 박스로 자리를 지킵니다.
            draw.rectangle([left, top, right, bottom], fill="#555555")

    # 사진이 깔린 캔버스 위에 템플릿을 얹어서 완성합니다.
    return Image.alpha_composite(canvas.convert("RGBA"), template).convert("RGB")


# ─────────────────────────────────────────────
# (템플릿이 없을 때 쓰는 기본 합성) 4컷을 세로 스트립(인생네컷 스타일)으로 합성합니다.
#
# 완성본 구조 (위에서 아래로):
#   [여백] [1번 컷] [여백] [2번 컷] [여백] [3번 컷] [여백] [4번 컷] [하단 문구 영역]
# ─────────────────────────────────────────────
def compose_strip(cuts: list[Image.Image | None], professor: dict) -> Image.Image:
    # 완성본 크기 관련 상수들입니다. (단위: 픽셀)
    photo_w, photo_h = 560, 420   # 각 컷의 크기 (4:3 비율 유지)
    margin = 20                   # 프레임 테두리 및 컷 사이 간격
    footer_h = 120                # 하단 문구(교수님 이름)가 들어갈 영역 높이

    strip_w = photo_w + margin * 2
    strip_h = margin + (photo_h + margin) * 4 + footer_h

    # 프레임 색상으로 가득 채운 배경 캔버스를 만듭니다.
    canvas = Image.new("RGB", (strip_w, strip_h), professor["frame_color"])
    draw = ImageDraw.Draw(canvas)

    # 4장의 컷을 위에서부터 차례대로 붙입니다.
    for i, cut in enumerate(cuts):
        y = margin + i * (photo_h + margin)  # i번째 컷이 붙을 세로 위치
        if cut is not None:
            # 웹캠 원본(1280x960)을 컷 크기에 맞게 줄여서 붙입니다.
            resized = cut.resize((photo_w, photo_h))
            canvas.paste(resized, (margin, y))
        else:
            # 혹시 미촬영 컷(null)이 넘어오면 회색 박스로 채워서 자리는 지킵니다.
            draw.rectangle(
                [margin, y, margin + photo_w, y + photo_h],
                fill="#555555",
            )

    # 하단 문구: "교수님 이름 | 학과" 형태로 프레임 아래쪽 중앙에 적습니다.
    label = f"{professor['name']} · {professor['department']}"
    font = load_korean_font(36)
    # 글자가 실제로 차지하는 영역을 계산해서 가로 중앙 정렬 좌표를 구합니다.
    bbox = draw.textbbox((0, 0), label, font=font)
    text_w = bbox[2] - bbox[0]
    text_x = (strip_w - text_w) // 2
    text_y = strip_h - footer_h + (footer_h - (bbox[3] - bbox[1])) // 2
    draw.text((text_x, text_y), label, font=font, fill=professor["text_color"])

    return canvas


# ─────────────────────────────────────────────
# 사진 합성 API: 프론트엔드 Result 화면이 촬영 완료 후 호출합니다.
# 1) 4장의 base64 사진을 받아서 → 2) 프레임과 합성 → 3) 파일로 저장 → 4) 다운로드 URL 반환
# 반환된 URL을 QR 코드로 만들어 휴대폰으로 스캔하면 사진을 받을 수 있습니다.
# ─────────────────────────────────────────────
@app.post("/photos")
async def create_photo(body: PhotoRequest, request: Request):
    # 1. 요청으로 온 professor_id에 해당하는 교수님 정보를 찾습니다.
    professor = next((p for p in PROFESSORS if p["id"] == body.professor_id), None)
    if professor is None:
        raise HTTPException(status_code=404, detail="해당 교수님을 찾을 수 없습니다.")

    # 2. 컷 개수가 4장인지 검증합니다. (포토부스 규격!)
    if len(body.cuts) != 4:
        raise HTTPException(status_code=400, detail="사진은 정확히 4장이어야 합니다.")

    # 3. base64 문자열들을 Pillow 이미지로 변환합니다. (null 컷은 그대로 None 유지)
    try:
        images = [decode_data_url(c) if c else None for c in body.cuts]
    except Exception:
        raise HTTPException(status_code=400, detail="사진 데이터를 해석할 수 없습니다.")

    # 4. 프레임 템플릿(구멍 4개가 감지된 것)이 있으면 템플릿 방식으로,
    #    없으면 기본 세로 스트립 방식으로 합성합니다.
    template_path = find_frame_template(professor)
    if template_path is not None and len(detect_slots(template_path)) == 4:
        strip = compose_with_template(images, professor, template_path)
    else:
        strip = compose_strip(images, professor)

    # 5. 겹치지 않는 고유한 파일 이름을 만들어 photos 폴더에 저장합니다.
    photo_id = uuid.uuid4().hex
    filename = f"{photo_id}.jpg"
    strip.save(PHOTOS_DIR / filename, format="JPEG", quality=90)

    # 6. 휴대폰에서 QR로 접근할 다운로드 URL을 만들어 반환합니다.
    #    request.base_url은 지금 이 서버에 접속한 주소(예: http://192.168.0.10:8000/)를 알려줍니다.
    download_url = f"{request.base_url}photos/{filename}"
    return {"photo_id": photo_id, "url": download_url}


# 예전부터 있던 인사 엔드포인트입니다. (동작 확인용으로 남겨둡니다)
@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}
