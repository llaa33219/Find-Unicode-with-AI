# Find Unicode with AI

AI를 사용해서 유니코드 문자를 찾는 웹사이트입니다. 사용자가 원하는 문자를 자연어로 설명하면, AI가 분석하여 가장 적합한 유니코드 문자들을 추천해줍니다.

## 🌟 주요 기능

- **자연어 검색**: "빨간 하트", "위쪽 화살표", "웃는 얼굴" 등 자연어로 검색
- **AI 기반 분석**: 공식 Qwen AI 모델을 사용한 4단계 분석 시스템
- **다중 검색 기준**: 범위, 모양, 기능, 이름 기반 검색
- **멀티모달 분석**: 모양 관련 쿼리에 대한 향상된 시각적 분석
- **즉시 복사**: 원클릭으로 문자 복사
- **반응형 디자인**: 모바일 및 데스크톱 지원

## 🔧 기술 스택

- **Frontend**: HTML, CSS, JavaScript (ES6+)
- **Backend**: Cloudflare Pages Functions (Workers)
- **AI**: 공식 Qwen DashScope API
  - 기본 분석: qwen-plus
  - 고급 시각 분석: qwen-vl-plus
- **배포**: Cloudflare Pages

## 📋 설치 및 배포

### 1. 공식 Qwen API 키 설정

1. [DashScope 콘솔](https://dashscope.console.aliyun.com/apiKey)에서 API 키 발급
2. `env.example`을 `.env`로 복사
3. `.env` 파일에 API 키 설정:
```bash
DASHSCOPE_API_KEY=sk-your-api-key-here
```

### 2. 로컬 개발

```bash
# 저장소 클론
git clone <repository-url>
cd find-unicode-ai

# Wrangler 설치 (Cloudflare CLI)
npm install -g wrangler

# 로컬 개발 서버 실행
wrangler pages dev

# 또는 정적 서버 실행
python -m http.server 8000
# 또는
npx serve .
```

### 3. Cloudflare Pages 배포

1. Cloudflare Pages에 저장소 연결
2. Build settings:
   - Build command: (비워둠)
   - Build output directory: `/`
3. 환경 변수 설정:
   - `DASHSCOPE_API_KEY`: 공식 Qwen API 키

## 🚀 사용법

1. 검색창에 원하는 문자를 자연어로 입력
   - 예: "빨간 하트", "체크마크", "수학 무한대 기호"
2. AI가 쿼리를 분석하고 관련 문자들을 검색
3. 결과에서 원하는 문자를 클릭하여 복사

## 🏗️ 아키텍처

### AI 분석 프로세스

1. **쿼리 분석** (`/api/analyze`): 사용자 입력을 4가지 기준으로 분석
   - 범위 검색 (이모지, 수학 기호, 화살표 등)
   - 모양 검색 (원, 사각형, 삼각형 등)
   - 기능 검색 (구분자, 강조, 통화 등)
   - 이름 검색 (패턴 매칭)

2. **문자 검색** (`/api/search`): 분석된 기준에 따라 유니코드 데이터베이스 검색
   - 최대 50개의 후보 문자 반환
   - 중복 제거 및 관련성 정렬

3. **AI 필터링** (`/api/filter`): AI를 통한 최종 문자 선별
   - 상위 10개 문자 선택
   - 상세한 관련성 분석 제공
   - 모양 관련 쿼리의 경우 향상된 시각적 분석

### API 엔드포인트

#### POST `/api/analyze`
사용자 쿼리를 분석하여 검색 기준을 생성합니다.

**요청:**
```json
{
  "query": "빨간 하트"
}
```

**응답:**
```json
{
  "range": {
    "type": "emoji",
    "title": "이모지 문자",
    "description": "이모지 범위에서 검색",
    "keywords": ["emoji", "emoticon", "heart"]
  },
  "shape": {
    "type": "heart",
    "title": "하트 모양",
    "description": "하트 모양의 문자",
    "keywords": ["heart", "love", "red"]
  },
  "function": {
    "type": null,
    "title": "기능 검색",
    "description": "기능적 용도",
    "keywords": []
  },
  "name": {
    "type": "pattern",
    "title": "이름 검색",
    "description": "이름 기반 검색",
    "keywords": ["heart", "red"]
  }
}
```

#### POST `/api/search`
분석된 기준에 따라 유니코드 문자를 검색합니다.

**요청:**
```json
{
  "criteria": { /* analyze API 응답 */ }
}
```

**응답:**
```json
{
  "results": [
    {
      "char": "❤️",
      "code": "U+2764",
      "name": "RED HEART"
    }
    // ... 최대 50개
  ],
  "total": 25
}
```

#### POST `/api/filter`
AI를 통해 최종 10개 문자를 선별하고 분석합니다.

**요청:**
```json
{
  "query": "빨간 하트",
  "criteria": { /* analyze API 응답 */ },
  "candidates": [ /* search API 응답의 results */ ]
}
```

**응답:**
```json
{
  "results": [
    {
      "char": "❤️",
      "code": "U+2764",
      "name": "RED HEART",
      "relevance_score": 10,
      "visual_match_score": 9,
      "analysis": "빨간색 하트 이모지로 사용자가 찾는 문자와 완벽히 일치합니다."
    }
    // ... 최대 10개
  ]
}
```

## 🔍 지원되는 유니코드 범위

- **이모지**: 모든 이모지 블록 (표정, 동물, 음식, 활동 등)
- **수학 기호**: 수학 연산자, 기하학적 도형, 집합 기호
- **화살표**: 모든 방향의 화살표 및 포인터
- **기하학적 도형**: 원, 사각형, 삼각형, 다각형
- **구두점**: 문장 부호 및 특수 구분자
- **통화 기호**: 전 세계 통화 심볼

## 🚨 문제 해결

### API 호출 오류
- DashScope API 키가 올바르게 설정되었는지 확인
- API 키에 충분한 크레딧이 있는지 확인
- 네트워크 연결 상태 확인

### 검색 결과 없음
- 더 일반적인 용어로 검색 시도
- 영어나 한국어로 번갈아 검색
- 유사한 의미의 다른 단어 사용

### 성능 이슈
- AI 분석은 3-5초 정도 소요될 수 있음
- 복잡한 쿼리는 더 오래 걸릴 수 있음
- 네트워크 상태에 따라 응답 시간 변동

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 