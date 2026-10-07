# @storage/mobile — Setup

## ⚠️ App KHÔNG còn chạy được trên Expo Go

Từ khi thêm bản đồ (`@maplibre/maplibre-react-native`), app có native module ⇒ phải dùng
**development build** (dev client). Mỗi máy làm **một lần**, sau đó ngày thường vẫn hot reload như cũ.

---

## 1. Yêu cầu máy

- **JDK 17** (Expo SDK 54 không chạy với JDK 8). Kiểm: `java -version`.
- **Android SDK** + biến môi trường `ANDROID_HOME` — cài qua Android Studio, kèm SDK Platform 35 + Build-Tools.
- Một emulator (AVD) hoặc device Android thật bật USB debugging.

> **Windows:** đường dẫn repo phải **ngắn**. CMake của `react-native-worklets` (dep gián tiếp của
> `react-native-reanimated`, có sẵn trong repo từ trước) giới hạn đường dẫn object file ở 250 ký tự.
> Repo đặt ở `D:\sm` thì build qua; đặt ở `D:\storage-management-monorepo` thì **fail** với
> `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. Lỗi này không liên quan MapLibre
> — nó xảy ra với mọi native build của repo này trên Windows.

## 2. Env

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Điền hai biến:

- `EXPO_PUBLIC_API_URL` — emulator Android dùng `http://10.0.2.2:3001/api/v1`; **device thật** phải đổi
  sang LAN IP của máy chạy API (ví dụ `http://192.168.1.50:3001/api/v1`).
- `EXPO_PUBLIC_GOONG_MAPTILES_KEY` — **Map Key** ở https://account.goong.io.
  Đây là key **khác** với REST API key (`GOONG_API_KEY` của `apps/api`): nó chỉ dùng cho vector style
  trên `tiles.goong.io`, không gọi được Geocode/Autocomplete/Direction.
  Để trống thì app vẫn chạy bình thường, chỉ chế độ Bản đồ hiện thông báo "Chưa cấu hình bản đồ".

> Metro **inline** mọi biến `EXPO_PUBLIC_*` lúc bundle ⇒ sửa `.env` xong phải chạy lại với `--clear`,
> không hot-reload được.

## 3. Build dev client

Làm một lần mỗi máy, và làm lại mỗi khi đổi native dependency hoặc sửa `app.json`:

```bash
cd apps/mobile
npx expo prebuild --platform android --clean
npx expo run:android
```

`android/` và `ios/` là **generated + gitignored** (Continuous Native Generation) — không commit, xoá
được bất cứ lúc nào, `prebuild` lại là có. Khi build lỗi lạ, xoá rồi prebuild lại thường nhanh hơn là đi vá.

> `npx expo run:android --device` là để nhắm **device USB**. Nếu bạn dùng emulator thì bỏ cờ đó đi.

## 4. Ngày thường

```bash
pnpm dev:mobile        # = expo start --dev-client
```

JS hot reload như cũ. Chỉ phải build lại native khi thêm/đổi native dependency hoặc sửa `app.json`.

## Gate trước khi commit

```bash
pnpm --filter @storage/mobile check   # tsc --noEmit
pnpm --filter @storage/mobile lint    # biome check .
pnpm --filter @storage/mobile test    # node --test lib/*.test.cjs
```

---

## Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp |
| :--- | :--- |
| Bản đồ xám, không có tile | Thiếu/sai `EXPO_PUBLIC_GOONG_MAPTILES_KEY`, hoặc quên `--clear` sau khi sửa `.env` |
| Bản đồ có hình nhưng không có chữ | Endpoint `glyphs` của style Goong không tải được |
| Marker nằm giữa biển | Ai đó đảo lat/lng. Mọi chuyển đổi phải đi qua `toLngLat()` trong `lib/goong-map-config.ts` — MapLibre nhận `[lng, lat]`, API trả lat trước |
| Marker lệch lên trên vị trí thật | `<Marker>` thiếu `anchor="bottom"`; mặc định `"center"` làm pin giọt nước lơ lửng nửa chiều cao |
| `Cannot read property 'useRef' of null` ngay khi mở app | Hai bản React cùng lúc. `apps/web` dùng react `^19.2.5`, mobile pin `19.1.0` theo SDK 54 ⇒ `use-sync-external-store` có thể ôm bản lồng. `metro.config.js` đã chặn bằng `resolveRequest`; nếu lỗi quay lại, kiểm block đó còn nguyên không |
| `Unable to resolve "@storage/types"` | Symlink workspace đứt (hay gặp sau khi di chuyển/đổi tên thư mục repo). Chạy lại `pnpm install`; nếu pnpm báo `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` thì dùng `CI=true pnpm install` |
| `EPERM ... tailwindcss-oxide...node` khi `pnpm install` | Metro hoặc jest-worker đang giữ file. Tắt Metro (kể cả các process `node` con) rồi chạy lại |
| Build Android fail, không thấy maplibre trong gradle | Autolinking + pnpm symlink; xem `plans/261006-2227-mobile-warehouse-map-goong/phase-01-native-foundation.md` |
| `No variants exist` cho mọi native module | Cache Gradle còn giữ đường dẫn tuyệt đối cũ. `npx expo prebuild --platform android --clean` |
| App ANR `failed to complete startup` trên emulator | AVD thiếu RAM. Khởi động với `emulator -avd <tên> -memory 4096 -cores 4 -gpu host` |
| Dev client báo `SocketTimeoutException` khi mở app | Bundle đầu tiên mất >100s nên client bỏ cuộc. Làm nóng cache trước: `curl -m 900 -o /dev/null "http://localhost:8081/apps/mobile/.expo/.virtual-metro-entry.bundle?platform=android&dev=true&minify=false"` |
| `pnpm: command not found` ở git hook | `corepack enable pnpm` |

---

## Ghi chú bảo mật về maptiles key

`EXPO_PUBLIC_*` được nhúng thẳng vào bundle JS ⇒ **ai có file APK đều đọc được key**. Đây là giới hạn
của client-side map SDK, không tránh được bằng cách giấu key.

Goong **không có** cơ chế khoá key theo package name / bundle id như Google Maps, nên không thể
hạn chế key chỉ dùng cho app này. Biện pháp thực tế duy nhất: theo dõi quota trên dashboard Goong và
xoay key nếu thấy lưu lượng bất thường. Đừng giả định key đang được bảo vệ.

**Không** đưa REST key (`GOONG_API_KEY` của `apps/api`) vào mobile. Nếu sau này cần autocomplete,
`apps/api` đã có sẵn `GET /places/*` dạng public proxy.
