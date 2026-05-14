# Plan refactoru: Multi-Device + JWT

**Cel:** Wersja `0.2.0` — gracze grają z własnych urządzeń (telefon), host odtwarza muzykę, autoryzacja przez JWT.
**Punkt wyjścia:** [`0.1.0-alpha`](DOCUMENTATION.md) — single-device, hotkeye Q/P/Z/M.
**Strategia:** Cztery fazy, każda samodzielnie deployowalna. Po każdej fazie aplikacja działa.

---

## Faza 1 — Skeleton multi-device (bez JWT, single-device nadal działa) ✅ ZAIMPLEMENTOWANA (2026-05-14)

**Czas:** ~3-4h. **Ryzyko:** niskie (czysty refactor).

### Backend
- [ ] `Player.deviceToken: String` — nowe pole (na razie nieużywane, pojawi się w Fazie 2)
- [ ] `GameSession.roomCode: String` — 6-znakowy kod (alfabet bez konfliktowych znaków: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, ~28 bilionów kombinacji)
- [ ] `GameService.findByCode(code)` + odwrócony indeks `roomCodeIndex: ConcurrentHashMap<String, String>`
- [ ] Nowy `RoomController` z `GET /api/rooms/code/{code}` → `{ gameId }`
- [ ] `GameStatusResponse.roomCode` — eksponuj kod, żeby host mógł pokazać go graczom

### Frontend
- [ ] Dodać `react-router-dom`
- [ ] Routing w `App.jsx`:
  - `/` — login / lobby (host)
  - `/game` — bieżąca gra (host)
  - `/join` — wpis kodu + nick (gracz)
  - `/player/:gameId` — placeholder widoku gracza (do Fazy 2)
- [ ] `JoinView.jsx` — formularz kodu + nicka (UI gotowe, action stubbed do Fazy 2)
- [ ] Wyświetlenie `roomCode` na `HostGameView` w `NowPlayingCard` (duża czcionka, łatwe do podyktowania)
- [ ] Lekki redirect: `GET /api/rooms/code/{code}` resolve gameId, nawigacja do `/player/{gameId}`

### Definicja gotowości
- Single-device flow działa jak dotąd (hotkeye, scoreboard).
- Host widzi 6-znakowy kod pokoju.
- `/join` wpisuje kod → próbuje znaleźć grę → pokazuje placeholder z gameId.
- `npm run build` przechodzi czysto.

---

## Faza 2 — JWT + dołączanie po kodzie ✅ ZAIMPLEMENTOWANA (2026-05-14)

**Czas:** ~1 dzień. **Ryzyko:** średnie (Spring Security configuration).

### Backend
- [ ] Dependency `io.jsonwebtoken:jjwt-api:0.12.6` (+ `jjwt-impl`, `jjwt-jackson`)
- [ ] `shared/security/JwtService.java` — `issue(playerId, gameId, role)` + `verify(token)`, HS256, secret z env `JWT_SECRET` (fallback dev), TTL 4h
- [ ] Sekwencja join:
  - [ ] `POST /api/rooms/{code}/join` body `{ name }` → walidacja, dodanie playera do sesji, response `{ token, playerId, gameId, hotkey }`
  - [ ] `GameService.addPlayer(gameId, name)` — przypisuje wolny hotkey, generuje playerId, zwraca Player
- [ ] `shared/security/JwtAuthenticationFilter.java` — filtr dla `/api/rooms/**/buzz`, `/guess`. Wkłada custom `Authentication` z `playerId + gameId + role` jako principal
- [ ] Update `SecurityConfig`: dodać filtr przed `UsernamePasswordAuthenticationFilter`
- [ ] Update `GameController.buzz` / `guess`:
  - Wyciągnij `playerId` i `gameId` z security context zamiast z body/path
  - Zachowaj kompatybilność z host-flow (gdy auth = OAuth2, używaj path/body jak dotąd)
- [ ] `/skip` i `/next` — wymagają `role=HOST` lub host-OAuth2 sesji

### Frontend
- [ ] `api.js` — dodać `Authorization: Bearer <token>` gdy obecny `mel:token:{gameId}` w localStorage
- [ ] `JoinView` — submit do `POST /api/rooms/{code}/join`, zapis tokenu do localStorage, redirect do `/player/{gameId}`
- [ ] `PlayerGameView.jsx`:
  - Duży buzz button (zamiast hotkeya, ale hotkey też wciąż działa jako fallback)
  - Mini-scoreboard
  - GuessCard gdy `state.activeGuesserId === mojPlayerId`
- [ ] Reconnect logic: `useEffect` startup → odczyt tokenu z localStorage → jeśli ważny, render `PlayerGameView`

### Definicja gotowości
- Gracz wchodzi na `/join`, wpisuje kod 7K2QFP + "Kasia" → ląduje na `/player/<id>` z działającym buzz buttonem.
- Buzznięcie wysyła request z JWT, serwer identyfikuje gracza z tokenu (nie z body).
- Host nadal kontroluje muzykę i widzi pełny scoreboard.
- `/skip` i `/next` zwracają 403 dla graczy.

---

## Faza 3 — Autoryzacja WebSocket

**Czas:** ~0.5 dnia. **Ryzyko:** średnie (subtle race conditions przy CONNECT).

### Backend
- [ ] `WebSocketConfig` — `configureClientInboundChannel` z `ChannelInterceptor`
- [ ] `preSend` interceptor:
  - Przy `STOMP CONNECT`: czyta `Authorization` z `getFirstNativeHeader`
  - Jeśli Bearer obecny: `jwtService.verify` → `PlayerPrincipal(playerId, gameId, role)`
  - Jeśli brak (host): używa HTTP session ID → `HostPrincipal(sessionId)`
  - Set `header.setUser(principal)`
- [ ] Walidacja `SUBSCRIBE`: gdy gracz subskrybuje `/topic/games/X`, musi `X == principal.gameId`
- [ ] (Opcjonalnie 0.3) `/user/{playerId}/queue/private` dla wiadomości skierowanych do konkretnego gracza

### Frontend
- [ ] `GameView` (zarówno Host jak Player) — przy `new Client({ connectHeaders: ... })` dorzucić `Authorization: Bearer <token>` dla gracza
- [ ] Reconnect: token w localStorage → CONNECT się powtarza z auto-reconnect (stompjs robi z automatu)

### Definicja gotowości
- DevTools nie pozwala podszyć się pod innego gracza przez modyfikację request body.
- Wyłączenie WiFi i powrót → STOMP sam się przepina, gra leci dalej.
- Brak tokenu w localStorage → host-flow (OAuth2 session).

---

## Faza 4 — UX, niezawodność, polish

**Czas:** ~1 dzień (rozłożone na drobne PR-y). **Ryzyko:** niskie.

### QR + share
- [ ] `qrcode.react` (~5kB) — QR code w `NowPlayingCard` z linkiem `https://host.../join?code=7K2QFP`
- [ ] `?code=` w URL `/join` autouzupełnia pole

### Mobile UX
- [ ] `navigator.vibrate(50)` po buzzie na telefonie
- [ ] CSS: `touch-action: manipulation` na buzz button (eliminacja 300ms delay)
- [ ] Viewport meta dla iOS safe-area: `viewport-fit=cover`
- [ ] PWA manifest + ikona (opcjonalnie)

### Bezpieczeństwo
- [ ] `Bucket4j` — rate limit `POST /api/rooms/{code}/join`: 10 req/min/IP (brute force ochrona)
- [ ] Rate limit `/buzz` i `/guess`: 30 req/min/JWT
- [ ] Walidacja name w join (3-20 znaków, regex)

### Reconnect i resilience
- [ ] Po reconnect WS: GET `/api/game/{id}` żeby pobrać aktualny state (na wypadek miss broadcastu)
- [ ] localStorage cleanup: usuń `mel:token:*` starsze niż 24h

### Definicja gotowości
- Telefon: skanuję QR → /join autouzupełnia kod → wpisuję nick → gram.
- Buzz vibruje. Brak dziwnych race conditions w UI.
- Brute force kodu w pętli → 429 po 10 próbach/min.

---

## Punkty decyzyjne przed startem Fazy 2

| Decyzja | Stanowisko |
|---|---|
| Storage tokenu: localStorage vs sessionStorage vs cookie | **localStorage** — pozwala na refresh karty bez wylogowania |
| HS256 vs RS256 | **HS256** — jeden backend, prościej |
| TTL tokenu | **4h** — pokrywa najdłuższą grę, krótsze niż wieczność |
| Refresh token | **NIE** — TTL wystarcza, gracz może rejoin |
| Wymuszenie unikalności nicka per pokój | **TAK** — odrzuć duplikaty z 409 |
| Co z hostem: też dostaje JWT czy zostaje na OAuth2 session? | **Zostaje OAuth2** — minimalna zmiana, host już ma session |

---

## Co zostaje na 0.3+

- PostgreSQL persistence (Player history, leaderboard)
- Redis dla cache MB / iTunes / sesji
- Resilience4j circuit breaker dla Spotify
- Observability (Micrometer + Prometheus)
- Voice chat (WebRTC)
- Tryby alternatywne (lyrics, hum-to-search)

---

*Plan utworzony 2026-05-14 dla cel-wersji `0.2.0`. Aktualizacje notować w sekcji każdej fazy.*
