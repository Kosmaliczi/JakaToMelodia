# Jaka to Melodia — dokumentacja

**Wersja:** `0.1.0-alpha`
**Data wydania:** 2026-05-14
**Status:** Alpha — single-device, gotowa do testów towarzyskich; nie nadaje się jeszcze do publicznego deploymentu.

---

## 1. Cel projektu

Wieloosobowa gra muzyczna w stylu „Jaka to melodia" — host odtwarza utwory ze Spotify, gracze rywalizują w odgadywaniu tytułu i wykonawcy. Inspirowana programami TV i takimi grami jak Hitster / SongPop.

W obecnej fazie (alpha) wszyscy gracze siedzą przed jednym laptopem i używają hotkeyów `Q`, `P`, `Z`, `M` do buzzowania. Multi-device i mobilne UI są zaplanowane na wersję 0.2 (patrz §11 — Roadmap).

---

## 2. Stack technologiczny

### Backend
- **Java 21**, **Spring Boot 3.4.0**
- `spring-boot-starter-web` — REST API
- `spring-boot-starter-security` + `spring-boot-starter-oauth2-client` — OAuth2 Spotify
- `spring-boot-starter-websocket` — komunikacja real-time (STOMP)
- `spring-boot-starter-validation` — walidacja DTO
- `commons-text` — algorytmy podobieństwa stringów (Levenshtein)
- **Lombok** — boilerplate
- **Maven** — build

### Frontend
- **React 18.3** + **Vite 5**
- **TailwindCSS 3.4** — styling
- `@stomp/stompjs` + `sockjs-client` — WebSocket STOMP
- **Spotify Web Playback SDK** (ładowany przez `<script>`)
- Font **Inter** (z rsms.me)

### Integracje zewnętrzne
- **Spotify Web API** — playlisty użytkownika, metadane utworów (OAuth2 Authorization Code)
- **Spotify Web Playback SDK** — odtwarzanie pełnych utworów (wymaga **Premium**)
- **iTunes Search API** — 30-sekundowe podglądy MP3 jako fallback dla użytkowników bez Premium (bez auth)
- **MusicBrainz API** — aliasy wykonawców do walidacji odpowiedzi (np. „P!nk" = „Pink")

### Infrastruktura
- **Docker** (multi-stage build: Node 20 dla frontu → Maven dla backendu → JRE alpine na runtime)
- `docker-compose.yml` do uruchomienia całości

---

## 3. Architektura

```
┌──────────────────────────────────────────────────────────────┐
│ Browser (host + wszyscy gracze)                              │
│   React SPA  →  Spotify Web Playback SDK (iframe)            │
│              ↕                                                │
│         REST + STOMP/SockJS                                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
          ┌──────────────▼───────────────┐
          │ Spring Boot (jeden JAR)      │
          │                              │
          │  ┌────────────────────────┐  │     ┌──────────────┐
          │  │ AuthController         │  │────►│  Spotify     │
          │  │ PlaylistController     │  │     │   OAuth/API  │
          │  │ GameController         │  │     └──────────────┘
          │  └────────────────────────┘  │
          │  ┌────────────────────────┐  │     ┌──────────────┐
          │  │ GameService            │  │────►│  iTunes      │
          │  │ AnswerValidator        │  │     │  (preview)   │
          │  │ ScoreEngine            │  │     └──────────────┘
          │  │ GameEventPublisher     │  │     ┌──────────────┐
          │  │ SessionCleanupService  │  │────►│  MusicBrainz │
          │  └────────────────────────┘  │     │  (aliasy)    │
          │  ┌────────────────────────┐  │     └──────────────┘
          │  │ ConcurrentHashMap      │  │
          │  │   <gameId, Session>    │  │   (in-memory)
          │  └────────────────────────┘  │
          └──────────────────────────────┘
```

**Cechy charakterystyczne:**
- **Stateless backend per request**, ale stan gry trzymany w pamięci procesu (`ConcurrentHashMap`). Restart serwera = utrata wszystkich aktywnych gier.
- **Synchroniczne mutacje stanu gry** — `synchronized (session)` chroni krytyczne sekcje (buzz, guess, advance).
- **WebSocket broadcast** — po każdej zmianie stanu `GameEventPublisher` rozsyła pełen `GameStatusResponse` na `/topic/games/{gameId}`. Klienci nadpisują lokalny state.

---

## 4. Struktura projektu

```
JakaToMelodia/
├── Dockerfile                           # 3-stage: frontend → backend → runtime
├── docker-compose.yml
├── pom.xml                              # Maven config
├── mvnw, mvnw.cmd                       # Maven wrapper
├── DOCUMENTATION.md                     # ten plik
│
├── src/main/java/com/wolfship/melodia/
│   ├── MelodiaApplication.java          # entry point
│   ├── config/
│   │   ├── SecurityConfig.java          # OAuth2 + permitAll dla API
│   │   └── WebSocketConfig.java         # /ws endpoint, /topic broker
│   ├── core/
│   │   ├── controller/
│   │   │   ├── AuthController.java      # /api/auth/{me,token,logout,diagnostics}
│   │   │   ├── GameController.java      # /api/game/{start,buzz,guess,next,skip}
│   │   │   ├── PlaylistController.java  # /api/playlists
│   │   │   └── GlobalExceptionHandler.java
│   │   ├── model/
│   │   │   ├── GameSession.java         # stan gry (mutable)
│   │   │   ├── Player.java              # id, name, hotkey, score, lockedOut
│   │   │   ├── GuessResult.java         # BOTH | TITLE_ONLY | ARTIST_ONLY | WRONG
│   │   │   └── dto/
│   │   │       ├── GameStatusResponse.java
│   │   │       ├── GuessRequest/Response.java
│   │   │       ├── BuzzRequest.java
│   │   │       └── StartGameRequest.java
│   │   └── service/
│   │       ├── GameService.java         # mózg rozgrywki
│   │       ├── AnswerValidator.java     # similarity + aliasy
│   │       ├── ScoreEngine.java         # punktacja z czasem
│   │       ├── GameEventPublisher.java  # broadcast WS
│   │       └── SessionCleanupService.java
│   ├── external/
│   │   ├── spotify/
│   │   │   ├── SpotifyService.java      # playlisty, utwory
│   │   │   └── model/{SpotifyTrackDto, PlaylistDto}.java
│   │   ├── itunes/ItunesService.java    # fallback preview + cache
│   │   └── musicbrainz/MusicBrainzService.java  # aliasy + cache
│   └── shared/utils/
│       ├── StringNormalizer.java        # diakrytyki, lowercase, brackets, feat
│       └── SimilarityMatcher.java       # Levenshtein wrapper
│
├── src/main/resources/
│   ├── application.properties           # OAuth, session TTL, logging
│   └── static/                          # zbudowany frontend (kopiowany przez Vite)
│
├── src/test/java/.../                   # JUnit + AssertJ
│   ├── AnswerValidatorTest.java         # 8 testów
│   └── ScoreEngineTest.java
│
└── frontend/
    ├── package.json
    ├── vite.config.js                   # outDir = ../src/main/resources/static/
    ├── tailwind.config.js               # paleta Spotify + animacje
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx
        ├── api.js, spotify.js
        ├── index.css                    # globalne style + .card .btn .kbd .eq-bar
        ├── views/
        │   ├── LoginView.jsx
        │   ├── LobbyView.jsx
        │   └── GameView.jsx             # serce frontu
        └── components/
            ├── NowPlayingCard.jsx       # winyl + timer + equalizer
            ├── Scoreboard.jsx           # avatary + ranking
            ├── HotkeyHelp.jsx
            ├── GuessCard.jsx
            ├── RevealCard.jsx
            └── StatusPill.jsx
```

---

## 5. Maszyna stanów gry

```
        ┌──────────┐    start
        │          │───────────────┐
        │  (init)  │               │
        └──────────┘               ▼
                            ┌─────────────┐
              ┌────────────►│   PLAYING   │
              │             │  (gra utwór)│
              │             └─────┬───────┘
              │                   │
   correct │  │  wrong            │ buzz / spacja
   answer  │  │  + lockout        │
              │                   ▼
        ┌─────┴──────┐      ┌──────────────┐
        │            │      │   GUESSING   │
        │   REVEAL   │      │ (input text) │
        │ (odpowiedź)│      └──────┬───────┘
        └─────┬──────┘             │
              │ next               │ all locked out
              │ (lub spacja)       │     OR
              ▼                    │ correct answer
        ┌──────────┐               │
        │  next    │◄──────────────┘
        │  round   │
        │  OR      │
        │ FINISHED │
        └──────────┘
```

**Przejścia:**
| Z | Do | Zdarzenie | Endpoint |
|---|---|---|---|
| PLAYING | GUESSING | gracz wciska swój hotkey | `POST /api/game/{id}/buzz` |
| PLAYING | REVEAL | spacja (skip) | `POST /api/game/{id}/skip` |
| GUESSING | PLAYING | błędna odpowiedź (nie wszyscy locked out) | `POST /api/game/{id}/guess` |
| GUESSING | REVEAL | trafna odpowiedź | `POST /api/game/{id}/guess` |
| GUESSING | REVEAL | wszyscy gracze locked out | `POST /api/game/{id}/guess` |
| REVEAL | PLAYING | następna runda | `POST /api/game/{id}/next` |
| REVEAL | FINISHED | ostatnia runda zakończona | `POST /api/game/{id}/next` |

---

## 6. Endpointy REST

### Auth
| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/auth/me` | status sesji, scope'y |
| GET | `/api/auth/token` | aktywny token Spotify (dla SDK) |
| POST | `/api/auth/logout` | unieważnia sesję + kasuje JSESSIONID |
| GET | `/api/auth/diagnostics?playlistId=` | szczegółowa diagnostyka tokenu i playlist |

### Playlisty
| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/playlists` | playlisty bieżącego użytkownika |

### Gra
| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/game/start` | utwórz nową grę z playlisty |
| GET | `/api/game/{gameId}` | bieżący stan |
| POST | `/api/game/{gameId}/buzz` | rejestruj naciśnięcie hotkeya |
| POST | `/api/game/{gameId}/guess` | wyślij odpowiedź |
| POST | `/api/game/{gameId}/next` | przejdź do następnej rundy (z REVEAL) |
| POST | `/api/game/{gameId}/skip` | odkryj odpowiedź (z PLAYING) |

### WebSocket
- Endpoint: `/ws` (SockJS)
- Broker: in-memory, prefix `/topic`
- Topic: `/topic/games/{gameId}` — broadcast pełnego `GameStatusResponse` po każdej zmianie stanu

---

## 7. Punktacja ([ScoreEngine](src/main/java/com/wolfship/melodia/core/service/ScoreEngine.java))

| Rezultat | Punkty bazowe |
|---|---|
| `BOTH` (tytuł + wykonawca) | 1000 |
| `TITLE_ONLY` | 600 |
| `ARTIST_ONLY` | 400 |
| `WRONG` | 0 |

**Bonus za czas:** od bazy odejmowane jest `30 pkt × każda sekunda` od startu rundy do buzza. Minimalna wartość (jeśli odpowiedź jest trafna) to **100 pkt**, więc każde trafienie daje minimum 100, nawet po długim namyśle.

---

## 8. Walidacja odpowiedzi

Pipeline w [AnswerValidator](src/main/java/com/wolfship/melodia/core/service/AnswerValidator.java):

1. **Normalizacja** ([StringNormalizer](src/main/java/com/wolfship/melodia/shared/utils/StringNormalizer.java)):
   - lowercase
   - usuwanie nawiasów `()` i `[]` (wersje remix/remaster)
   - usuwanie `feat.`, `ft.`, `with`, `prod.` i wszystkiego po nich
   - usuwanie diakrytyków (`ł` → `l`, `ą` → `a`)
   - tylko `[a-z0-9 ]`
2. **Aliasy z MusicBrainz** — pierwsza próba odpowiedzi triggeruje cache fetch aliasów wykonawcy. Po wpisaniu „P!nk" matchuje „Pink".
3. **Similarity** — Levenshtein z progiem `0.85`:
   - kombinacja `artist + " " + title` (i odwrotnie) → `BOTH`
   - sam tytuł → `TITLE_ONLY`
   - sam wykonawca → `ARTIST_ONLY`
4. **Phrase match** — gdy odpowiedź zawiera tytuł/wykonawcę jako pełne słowo

---

## 9. Cykl życia sesji

- Sesja gry tworzona w `GameService.initializeGame()` → UUID.
- `lastActivity` aktualizowane przy każdym `requireSession()`.
- [SessionCleanupService](src/main/java/com/wolfship/melodia/core/service/SessionCleanupService.java) cyklicznie usuwa nieaktywne sesje.
- TTL i interwał konfigurowalne w [application.properties](src/main/resources/application.properties):
  ```
  melodia.session.ttl-minutes=120
  melodia.session.cleanup-interval-minutes=10
  ```
- **Restart serwera = utrata wszystkich gier** (brak persystencji).

---

## 10. Konfiguracja i uruchomienie

### Wymagania
- Docker + Docker Compose (do uruchomienia)
- Konto Spotify Developer + zarejestrowana aplikacja → Client ID + Secret
- Konto Spotify Premium (do pełnych utworów; bez Premium gramy 30s podglądy)

### Zmienne środowiskowe (`.env` lub inline)
```bash
SPOTIFY_CLIENT_ID=<z dashboard Spotify>
SPOTIFY_CLIENT_SECRET=<z dashboard Spotify>
OAUTH2_SUCCESS_REDIRECT=http://127.0.0.1:8080/
```
W Spotify Developer Dashboard ustaw **Redirect URI** na `http://127.0.0.1:8080/login/oauth2/code/wolfship-auth`.

### Uruchomienie
```bash
docker compose up -d --build
# → http://127.0.0.1:8080
```

Pełny rebuild (gdy zmieniony front):
```bash
docker compose build --no-cache
docker compose up -d
```

### Tryb deweloperski (bez Dockera)
```bash
# terminal 1 — backend
./mvnw spring-boot:run

# terminal 2 — frontend (HMR)
cd frontend
npm install
npm run dev
# → http://127.0.0.1:5173 (proxy do :8080)
```

---

## 11. Roadmap (po-alpha)

### 0.2 — Multi-device
- Rozdzielenie widoków `HostGameView` / `PlayerGameView`
- Kod pokoju (6 znaków) + QR
- JWT (HS256, jjwt 0.12.6) dla graczy
- Endpoint `POST /api/rooms/{code}/join` + JWT filter
- Autoryzacja WebSocket przez `ChannelInterceptor` (CONNECT z `Authorization` headerem)
- Buzz button na telefonie + Vibration API

### 0.3 — Persystencja
- PostgreSQL + Flyway
- Tabele: `games`, `players`, `rounds`, `users`
- Statystyki gracza, historia, leaderboard
- Redis (opcjonalnie) na sesje + cache Spotify / MusicBrainz

### 0.4 — Niezawodność i ops
- Resilience4j (circuit breaker + retry) dla Spotify
- Bucket4j rate limiting endpointów join/buzz/guess
- Micrometer + Prometheus + Grafana dashboard
- GitHub Actions CI: test → build image → push do GHCR

### 0.5+ — Funkcjonalności
- Tryb „daily challenge"
- Filtry playlisty (dekada, gatunek przez Last.fm)
- Tryb „odgadnij z tekstu" (Genius API)
- Voice chat (WebRTC)
- Aliasy tytułów piosenek z MusicBrainz `recording` entity

---

## 12. Znane ograniczenia (alpha)

| Ograniczenie | Wpływ | Mitigacja w 0.x |
|---|---|---|
| Tylko jedno urządzenie z hotkeyami | Trudno grać zdalnie | 0.2 (multi-device) |
| Stan w pamięci (`ConcurrentHashMap`) | Restart = utrata gier | 0.3 (Postgres) |
| Spotify Premium wymagane dla pełnych utworów | Premium-gated | iTunes fallback (jest), pełny YouTube fallback (0.5+) |
| Brak rate limitów | Możliwy spam endpointów | 0.4 (Bucket4j) |
| Brak persystowanego leaderboardu | Statystyki kasują się po grze | 0.3 |
| Spotify Development Mode 403 na playlistach Spotify-owned | „Discover Weekly" nie działa | Extended Quota Mode w dashboardzie |
| MusicBrainz limit 1 req/s | Pierwszy guess po nowym wykonawcy ma ~300-500 ms latencji | Cache (jest), prefetch przy starcie gry (0.3) |
| Tytuł utworu nie ma aliasów | „Pt. 1" vs „Part 1" wymaga literalnego matchu | 0.5+ (MB recording aliases) |
| Brak testów integracyjnych e2e | Niska pewność przy refactorach | 0.4 (Testcontainers + Playwright) |

---

## 13. Testowanie

### Unit tests (`./mvnw test`)
- [AnswerValidatorTest](src/test/java/com/wolfship/melodia/core/service/AnswerValidatorTest.java) — 8 testów (matching, aliasy MB, ignorowanie feat/bracketów, diakrytyki)
- [ScoreEngineTest](src/test/java/com/wolfship/melodia/core/service/ScoreEngineTest.java) — punktacja z czasem
- [MelodiaApplicationTests](src/test/java/com/wolfship/melodia/MelodiaApplicationTests.java) — context load

### Manualne ścieżki testowe
1. **Happy path:** login → wybór playlisty → 2-4 graczy → start → buzz Q → poprawna odpowiedź → +punkty → next round
2. **Wrong answer + lock-out:** buzz → zła odpowiedź → muzyka leci dalej → inny gracz może buzznąć
3. **Skip:** podczas PLAYING wciśnij spację → reveal
4. **Bez Premium:** zaloguj się na koncie free → SDK fail → fallback audio gra 30s preview
5. **Alias MB:** wpisz „P!nk" gdy odpowiedź to „Pink" → ARTIST_ONLY hit

---

## 14. Sekrety i bezpieczeństwo (alpha)

**Świadome długi techniczne:**
- `client-id` i `client-secret` Spotify hardcoded w [application.properties](src/main/resources/application.properties) jako fallback (jeśli env vars puste). **Do produkcji wymagana zmiana na env-only.**
- CSRF wyłączone (`csrf().disable()`) — akceptowalne tylko dlatego że całość jest cookie-based same-origin.
- `permitAll()` na wszystkich endpointach API — kontrola dostępu opiera się na obecności sesji OAuth2. W 0.2 zostanie zaostrzone przez JWT.
- Brak HTTPS w docker-compose — założenie: tylko localhost / sieć domowa. Do hostingu publicznego wymagany reverse proxy z TLS (Caddy/Traefik).

---

## 15. Kontakt i licencja

Projekt edukacyjny, brak licencji (all rights reserved). W razie pytań — zgłoszenia issue w repo wolfship/melodia.

---

*Dokument wygenerowany 2026-05-14 dla wersji `0.1.0-alpha`. Aktualizować przy każdym minor bump.*
