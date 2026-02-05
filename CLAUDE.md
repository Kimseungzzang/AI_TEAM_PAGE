# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 빌드 및 개발 명령어

```bash
npm start      # 개발 서버 실행 (http://localhost:3000)
npm build      # 프로덕션 빌드
npm test       # 테스트 실행
```

백엔드 API는 `http://localhost:8080`으로 프록시됨.

## 아키텍처 개요

다중 에이전트 터미널 오케스트레이션 시스템을 위한 React 프론트엔드. 여러 팀 역할에 걸쳐 다수의 Claude Code 인스턴스를 조율하는 웹 UI 제공.

### 핵심 컴포넌트

- **App.js** - 세션 상태, WebSocket 연결, 메시지 라우팅을 관리하는 메인 오케스트레이터
- **ChatPanel.jsx** - 팀원에게 명령을 보내는 입력 인터페이스와 메시지 표시
- **Sidebar.jsx** - 상태 표시기가 있는 팀원 목록 및 대상 역할 선택기
- **TerminalGrid.jsx** - 터미널 카드 컨테이너
- **TerminalCard.jsx** - 역할별 개별 xterm.js 터미널 표시

### 통신 레이어

- **websocketHelpers.js** - `ws://localhost:8080/ws/terminal`에 대한 WebSocket 연결 관리
- 각 팀 역할은 `runtime` Map에 저장된 자체 WebSocket 연결 유지
- 메시지는 JSON 형식: 명령은 `{ type: 'input', data: '...' }`, 터미널 크기 조정은 `{ type: 'resize', cols, rows }`

### 메시지 처리

- **messageParser.js** - 역할 접두사가 붙은 출력 파싱 (예: "Frontend Engineer: 메시지")
- **utils.js** - ANSI 코드 제거, 노이즈 필터링, 깨진 문자 감지, 중복 제거

### 팀 역할 (constants.js)

Team Leader, Planner, Frontend Engineer, Backend Engineer, Designer

## 주요 패턴

**메시지 형식**: 팀원들은 파싱을 위해 역할 이름이 접두사로 붙은 라인을 출력함.

**초기화 흐름**: WebSocket 연결 → Claude 프롬프트 감지 대기 → 대기 중인 메시지 전송.

**대상 선택**: 메시지를 개별 역할에게 보내거나 "ALL" 멤버에게 브로드캐스트 가능.

## 기술 스택

- React 18.2.0 (Create React App 사용)
- xterm.js 5.3.0 터미널 에뮬레이션
- CSS 변수를 활용한 순수 CSS 테마
