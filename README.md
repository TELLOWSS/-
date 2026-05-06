<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

AI Studio 공유 링크는 만료되거나 권한에 따라 404가 발생할 수 있습니다. 로컬 실행(`npm run dev`)을 기본 경로로 사용하세요.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and set `GEMINI_API_KEY`
3. Run the app:
   `npm run dev`

## 배포 반영 점검 (커밋했는데 화면이 안 바뀔 때)

1. 저장소/브랜치 확인
   - `git status`
   - `git branch --show-current`
   - `git log --oneline -n 5`
2. 원격 푸시 확인
   - `git remote -v`
   - `git push origin <배포대상브랜치>`
3. 호스팅 빌드 확인 (예: Vercel)
   - 최신 커밋 SHA로 재배포되었는지 확인
   - 빌드 로그 에러 여부 확인
4. 캐시 제거 확인
   - 브라우저 강력 새로고침: `Ctrl+F5`
   - 서비스워커 사용 시 기존 캐시 삭제 후 재접속
5. 화면에서 빌드 표식 확인
   - 상단 정보바의 `Build` 값이 `build-2026-05-06-verify-01`인지 확인
