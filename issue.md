# Issue Log

- 2026-02-05 19:27 | 제목: Invalid hook call (BrowserRouter) | 오류 원인: 프로젝트에 react-router-dom이 없어서 상위 경로(/Users/kimseungzzang/node_modules)의 react-router-dom을 로드했고, React가 중복 로딩되어 hooks dispatcher가 null로 떨어짐 | 해결 방안: 프로젝트에 react-router-dom을 의존성으로 추가하고(node_modules를 프로젝트 로컬로 고정), 필요 시 상위 node_modules 제거 또는 재설치로 중복 React 해소 | 해결 유무: 미해결
