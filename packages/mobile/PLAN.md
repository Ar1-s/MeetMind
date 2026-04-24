# Mobile 寮€鍙戣鍒?
## 褰撳墠鐘舵€侊紙宸插畬鎴愶級

### packages/shared 鉁?- `src/types/` 鈥?鎵€鏈?TS 绫诲瀷锛圡eeting, Task, Project, User, Recording 绛夛級
- `src/api/` 鈥?骞冲彴鏃犲叧 API 宸ュ巶鍑芥暟锛?1 涓ā鍧楋級
  - `createApiClient(baseUrl, getToken)` 鈥?鏍稿績 HTTP client
  - `createMeetingsApi / createTasksApi / createProjectsApi / createAnalysisApi ...`

### packages/web 鉁?- `interfaces/index.ts` 鏀逛负 re-export `@meetmind/shared`锛寃eb 浠ｇ爜闆舵敼鍔?- `tsconfig.json` 娣诲姞 shared 璺緞瑙ｆ瀽

### packages/mobile 鉁咃紙楠ㄦ灦锛?- Expo SDK 52 + Expo Router 4
- Metro 閰嶇疆鏀寔 pnpm workspace symlink
- Auth 娴佺▼锛氱櫥褰?娉ㄥ唽 + SecureStore token 瀛樺偍 + 鍚姩鏃?session 鎭㈠
- Tab 瀵艰埅锛氫細璁垪琛ㄣ€佷换鍔°€佹棩鍘嗐€佽缃?- 浼氳璇︽儏椤?
---

## 寰呭紑鍙戝姛鑳斤紙浼樺厛绾ф帓搴忥級

### P0 鈥?鏍稿績鍔熻兘
- [ ] 鏂板缓浼氳锛團AB 鈫?琛ㄥ崟锛?- [ ] 褰曢煶鍔熻兘锛坋xpo-av锛夆啋 涓婁紶鍒?`/v1/recordings`
- [ ] AI 鍒嗘瀽瑙﹀彂 + 杩涘害杞

### P1 鈥?閲嶈鍔熻兘
- [ ] AI 鍔╂墜 Tab锛堟祦寮忚亰澶╂帴鍙ｏ級
- [ ] 鏂板缓浠诲姟 + 鐘舵€佹嫋鎷斤紙or 婊戝姩鍒囨崲锛?- [ ] 浼氳璇︽儏 鈫?PPT 棰勮锛圵ebView锛?- [ ] 鎬濈淮瀵煎浘鏌ョ湅锛圵ebView 宓屽叆 or SVG锛?
### P2 鈥?澧炲己鍔熻兘
- [ ] Push 閫氱煡锛坋xpo-notifications锛?- [ ] 缈昏瘧椤甸潰
- [ ] OKR / 椤圭洰绠＄悊
- [ ] 娣辫壊妯″紡
- [ ] 绂荤嚎缂撳瓨锛圡MKV锛?
### P3 鈥?鍙戝竷鍑嗗
- [ ] EAS Build 閰嶇疆
- [ ] App icon / splash screen 绱犳潗
- [ ] iOS / Android 鏉冮檺澹版槑瀹屽杽
- [ ] OTA 鐑洿鏂伴厤缃紙expo-updates锛?
---

## 鍏抽敭鏂囦欢閫熸煡

| 鏂囦欢 | 浣滅敤 |
|---|---|
| `packages/mobile/metro.config.js` | pnpm monorepo 鏀寔锛堟敼鍔ㄩ渶閲嶅惎 Metro锛?|
| `packages/mobile/libs/api.ts` | 鎵€鏈?API 瀹炰緥鍖栧叆鍙?|
| `packages/mobile/libs/storage.ts` | SecureStore token 璇诲啓 |
| `packages/mobile/stores/auth.ts` | 鍏ㄥ眬 auth 鐘舵€?|
| `packages/mobile/app/_layout.tsx` | session 鎭㈠ + auth guard |
| `packages/shared/src/api/client.ts` | HTTP client 鏍稿績閫昏緫 |
| `packages/shared/src/types/` | 淇敼绫诲瀷鍙敼杩欓噷 |

---

## 鏋舵瀯绾﹀畾

- **绫诲瀷鍙樻洿**锛氬彧鏀?`packages/shared/src/types/`锛寃eb 鍜?mobile 鑷姩鍚屾
- **鏂板 API 绔偣**锛氬湪 `packages/shared/src/api/` 瀵瑰簲妯″潡鍔犳柟娉曪紝mobile 鍦?`libs/api.ts` 鐩存帴鍙敤
- **缁勪欢**锛氱函 RN 鍘熺敓缁勪欢锛屼笉鐢ㄤ换浣?web UI 搴?- **鐘舵€佺鐞?*锛歓ustand锛堝悓 web锛屼絾 mobile 鏃?localStorage锛岀敤 SecureStore锛?- **瀵艰埅**锛欵xpo Router锛堟枃浠跺嵆璺敱锛屽悓 Next.js App Router 椋庢牸锛?