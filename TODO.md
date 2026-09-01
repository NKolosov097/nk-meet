# TODO

- [x] Посмотреть, есть ли индикация на `ParticipantTile` говорящего человека
      → Нет. `ParticipantTile.tsx` отслеживает только `isVideoMuted`, `isMicrophoneMuted` и `isSpotlighted`; поля/стиля для speaking-состояния нет.
      Есть на чём собрать: `livekit-client` даёт `Participant.isSpeaking` + события `isSpeakingChanged`/`ActiveSpeakersChanged`;
      `@livekit/react-native` — `useParticipant()` (deprecated, возвращает `isSpeaking`), а также `useTrackVolume`/`useMultibandTrackVolume` + `BarVisualizer`.
- [x] Проверить, есть ли фильтрация в Grid/Carousel по тому, кто последний говорил, и подключить
      → Было: нет, оба (`useParticipantGrid.ts`, `useParticipantSpotlight.ts`) сохраняли join order из `useTracks()`.
      Сделано: `VideoConference.tsx` сортирует `participantTracks` через `sortTrackReferences()` из
      `@livekit/components-core` (добавлен явной зависимостью в `package.json`, раньше был только транзитивным)
      перед тем как отдать их в грид и карусель — родной для LiveKit порядок: локальный участник → активный
      screen-share → доминирующий спикер → недавно говорившие → остальные по `joinedAt`. Пересчитывается на
      каждый `RoomEvent.ActiveSpeakersChanged`, который `useTracks()` слушает по умолчанию. Тесты/типы/линт зелёные.
      Смёржено в `origin/main` через PR #11 (`849d2ee`); локальный `main` подтянут fast-forward'ом,
      ветка `feat/sort-tracks-by-active-speaker` удалена и локально, и на origin.
- [ ] Добавить чат
      → Не реализовано вообще: ни кода, ни кнопки в `ControlBar.tsx`, ни использования data-channel API.
      Есть на чём собрать: `livekit-client` даёт `LocalParticipant.sendChatMessage()` + `RoomEvent.ChatMessage`/`DataReceived`;
      `@livekit/react-native` реэкспортирует `useChat` из `@livekit/components-react`, но этот пакет сейчас только транзитивная зависимость — его нужно будет добавить в `package.json` явно.

## Синхронизация веток

- [x] Проверить, есть ли accessibility-коммиты локальной `main` в истории `origin/main`
      → По SHA — нет (17 из 18 коммитов `origin/main..HEAD` не найдены), но по содержимому (`git patch-id` + полный
      `git diff`/`git ls-tree` сравнение деревьев) — да: `origin/main` (`cf7d40c`) является **строгим суперсетом**
      локальной `main` (`233f8af`). Diff `HEAD → origin/main` — 2762 добавления / 590 удалений и ни одного файла,
      уникального для `HEAD`, кроме `app.json` (в `origin/main` он заменён функционально эквивалентным
      `app.config.ts`/`app.config.test.ts`). Причина расхождения SHA — PR #3 (`fix/accessibility-hardening`) довёл
      те же правки до более полного состояния уже после того, как их версия попала прямо в `main` в обход PR.
      Проверены и все 7 локальных feature-веток (`fix/accessibility-hardening`, `docs/update-company-examples`,
      `fix/prejoin-dropdown-dismiss`, `feat/room-meeting-info`, `worktree-company-icon-control-bar`,
      `feat/participant-speaking-indicator`, `ci/require-pr-checks-on-main`) — все являются предками `origin/main`
      (`git merge-base --is-ancestor <branch> origin/main` → true), то есть полностью слиты.
- [x] Перевести `main` на `origin/main` и убрать хвосты
      → Сделано: `git reset --hard origin/main` (без конфликтов, как и ожидалось), удалены 8 полностью слитых
      локальных веток (7 feature-веток + `disable-toggle-during-pending`), убраны оба `.worktrees/*`
      (`fix/prejoin-dropdown-dismiss` через `git worktree remove`, `join-screen-layout` был осиротевшим каталогом),
      upstream `main` переключён на `origin/main` (`git branch --set-upstream-to=origin/main main`).

## Пробелы в продукте

- [ ] Демонстрация экрана (screen sharing) со стороны участника
      → `VideoConference.tsx` уже подписан на `Track.Source.ScreenShare` и отрисует чужой шаринг, но включить свой —
      негде: в `ControlBar.tsx` нет кнопки/тоггла, `LocalParticipant.setScreenShareEnabled()` нигде не вызывается.
- [ ] Модерация звонка (host-права)
      → Все участники равноправны: нет ролей, нет "замьютить всех", нет права выгнать/забанить участника.
      LiveKit это поддерживает через `RoomServiceClient` на бэкенде токенов + `Participant.permissions`, но
      `services/livekitToken.ts` сейчас выдаёт токен без какой-либо ролевой дифференциации.
- [ ] Комнаты ожидания / подтверждение входа
      → Любой, у кого есть токен, входит в комнату сразу; нет lobby-экрана и approve/deny со стороны организатора.
- [ ] Виртуальный фон / блюр камеры
      → В pre-join и в самом звонке нет ни одной опции обработки видео, кроме включить/выключить камеру.
- [ ] Пуш-уведомления о входящем звонке/ссылке
      → Диплинк (`nk-meet://slug`) открывает экран входа, только если приложение уже запущено/установлено; нет
      серверной части и push-канала, чтобы позвать участника, когда приложение закрыто.
- [ ] Веб-версия без медиа
      → В README прямо написано "Web version (limited functionality)" — камера/микрофон не работают в браузере;
      нет фолбэка на `getUserMedia`/WebRTC веб-адаптер для `livekit-client` в `app.config.ts`/`metro.config.js`.

## Технический долг

- [x] End-to-end тест полного сценария звонка
      → Добавлен `app/callLifecycle.integration.test.tsx`: рендерит настоящий `RoomScreen` целиком
      (`JoinScreen` → `LiveKitRoom` → `ActiveRoom`/`VideoConference`/`ControlBar`, без стаба `ActiveRoom`,
      в отличие от `[slug].test.tsx`), с фейком LiveKit только на границе `@livekit/react-native`/`livekit-client`.
      Три сценария: join → включить камеру → disconnect; возврат на JoinScreen с сообщением об ошибке подключения;
      повторный join после disconnect. Дизайн: `docs/superpowers/specs/2026-09-01-call-lifecycle-e2e-test-design.md`.
