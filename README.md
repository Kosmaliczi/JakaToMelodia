# Jaka to Melodia — dokumentacja

**Wersja:** `0.2.0-alpha` (faza 1/4 rolloutu multi-device — patrz [REFACTOR_PLAN.md](REFACTOR_PLAN.md))
**Data wydania:** 2026-05-14
**Status:** Alpha — single-device gra w pełni działa; szkielet multi-device dodany (kod pokoju, routing, JoinView), pełna funkcjonalność w kolejnych fazach.

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

### Zmienne środowiskowe — wymagany plik `.env`

**Aplikacja NIE wystartuje bez sekretów Spotify.** Skopiuj szablon:

```powershell
Copy-Item .env.example .env
# albo Linux/macOS:
cp .env.example .env
```

Edytuj `.env` i wypełnij:
```env
SPOTIFY_CLIENT_ID=<z dashboard Spotify>
SPOTIFY_CLIENT_SECRET=<z dashboard Spotify>
# Opcjonalnie — stabilny JWT (bez tego restart kontenera unieważnia tokeny graczy):
MELODIA_JWT_SECRET=<32+ losowych bajtów, np. openssl rand -base64 48>
MELODIA_COOKIE_SECURE=false
```

W Spotify Developer Dashboard ustaw **Redirect URI** na `http://127.0.0.1:8080/login/oauth2/code/wolfship-auth` (dla LAN IP zwykle nie trzeba — patrz §10b).

### Uruchomienie
```bash
docker compose up -d --build
# → http://127.0.0.1:8080
```

Jeśli przy starcie widzisz `Client id of registration 'wolfship-auth' must not be empty` — `.env` nie istnieje lub jest pusty.

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

## 10b. Dostęp z innych urządzeń w tej samej sieci WiFi (tryb LAN-only)

**TL;DR — najprostszy setup bez żadnego hostingu i bez zmian w Spotify Dashboard:**

1. **Ustaw `MELODIA_HOST_LAN_IP` w `.env`** — bez tego QR pokaże IP Dockera (172.x.x.x), nie twoje WiFi (krok 1 niżej).
2. Host uruchamia serwer i wchodzi na `http://127.0.0.1:8080` (Spotify już to akceptuje, nic do rejestracji).
3. Host klika „Stwórz lobby" — na ekranie pojawia się **QR code z kodem pokoju w zaszyfrowanym linku** do twojego LAN IP.
4. Gracze skanują QR telefonem (czytnik QR w aparacie) → ląduje na `http://<LAN-IP>:8080/join?code=ABC123` z prefillowanym kodem → wpisują nick → grają.

**Dlaczego trzeba ustawić IP ręcznie:** kontener Docker widzi tylko swoje bridge interface (172.x.x.x), nie WiFi hosta. Backend nie ma jak sam zgadnąć — musisz mu powiedzieć przez `MELODIA_HOST_LAN_IP`. **Spotify Dashboard nie wymaga żadnej akcji** — host loguje się przez `127.0.0.1`, gracze nigdy nie ruszają OAuth (mają JWT z `/join`).

Aby gracze mogli dołączać telefonami z tej samej sieci, potrzeba tylko:

### 1. Znajdź swój LAN IP i wstaw do `.env`

**Windows (PowerShell):**
```powershell
ipconfig | Select-String -Pattern "IPv4"
# np. IPv4 Address. . . . . . . . . . . : 192.168.1.50
```

**macOS / Linux:**
```bash
ip addr | grep "inet " | grep -v 127.0.0.1
# albo na macOS: ipconfig getifaddr en0
```

Załóżmy że twój IP to `192.168.1.50`. Edytuj `.env`:
```env
MELODIA_HOST_LAN_IP=192.168.1.50
```

Możesz podać kilka rozdzielonych przecinkiem jeśli masz WiFi + Ethernet:
```env
MELODIA_HOST_LAN_IP=192.168.1.50,192.168.1.51
```

Po zmianie `.env` zrestartuj kontener:
```powershell
docker compose up -d
```
(rebuild niepotrzebny — to tylko env var).

### 2. Spotify Dashboard — nic do roboty (host loguje się przez localhost)

Host wchodzi na `http://127.0.0.1:8080` na laptopie, gdzie już jest zarejestrowany redirect URI `http://127.0.0.1:8080/login/oauth2/code/wolfship-auth`. Gracze nie ruszają OAuth — używają JWT wystawianego przez `/api/rooms/{code}/join`.

> **Wyjątek**: gdyby host też chciał wchodzić przez LAN IP (np. żeby przetestować widok hosta z innego urządzenia w sieci), wtedy musi dodać `http://192.168.1.50:8080/login/oauth2/code/wolfship-auth` w Spotify Dashboard. Dla typowej rozgrywki to niepotrzebne.

### 3. Otwórz port w firewallu

**Windows (PowerShell jako administrator):**
```powershell
New-NetFirewallRule -DisplayName "Jaka to Melodia" -Direction Inbound `
                    -LocalPort 8080 -Protocol TCP -Action Allow
```

**macOS:** System Settings → Network → Firewall → Options → Add app (Docker / java) → Allow incoming.

**Linux (ufw):**
```bash
sudo ufw allow 8080/tcp
```

### 4. Sprawdź dostęp

Na telefonie wpisz w przeglądarce:
```
http://192.168.1.50:8080
```

Powinieneś zobaczyć ekran logowania (Spotify) — to dla osoby która chce być **hostem**. Gracz przechodzi od razu na `/join`:
```
http://192.168.1.50:8080/join
```

### 5. Flow rozgrywki LAN-party

1. **Host** otwiera `http://127.0.0.1:8080` na laptopie (lub `http://192.168.1.50:8080` — oba działają, byle redirect URI był zarejestrowany w Spotify), loguje się przez Spotify.
2. Host klika **Stwórz lobby**, dyktuje 6-znakowy kod.
3. **Gracze** na telefonach wchodzą na `http://192.168.1.50:8080/join`, wpisują kod + nick.
4. Wszyscy klikają „Gotowy", host „Rozpocznij grę".
5. Muzyka leci z głośników laptopa hosta (Spotify SDK działa tylko na localhost / HTTPS — to ograniczenie Spotify dla kontekstu bezpiecznego). Gracze nie potrzebują audio — buzzują widząc UI.

### Częste pułapki

| Problem | Rozwiązanie |
|---|---|
| Telefon nie łączy się z LAN IP | Firewall blokuje port 8080. Otwórz go (patrz krok 3). Albo telefon jest w innej sieci (mobile data zamiast WiFi). |
| Logowanie przez Spotify rzuca `INVALID_CLIENT: Invalid redirect URI` | Redirect URI z aktualnego adresu nie jest zarejestrowany w Dashboard. Dodaj go (krok 2). |
| Po zalogowaniu wracam na 127.0.0.1 zamiast LAN IP | Sprawdź czy `OAUTH2_SUCCESS_REDIRECT="/"` w `docker-compose.yml` i przebuduj kontener. |
| Spotify SDK nie odtwarza muzyki przez LAN IP | EME / Web Playback SDK wymaga secure context. Otwórz host na `localhost` lokalnie — gracze i tak nie potrzebują audio. |
| Tokeny graczy znikają po restarcie kontenera | Ustaw `MELODIA_JWT_SECRET` w `docker-compose.yml` — stabilny sekret = stabilne tokeny. |

---

## 10c. Deploy produkcyjny na AWS EC2 (free tier 12 mies.)

Z plikami w `deploy/` i `docker-compose.prod.yml` cały stack to: **Caddy (auto-HTTPS) + Spring Boot + React** w dwóch kontenerach. Free tier EC2 wystarcza w zupełności.

### A. Przed deployem — w lokalnym repo

1. **OBRÓĆ Spotify Client Secret** — stary jest w historii git'a, jest publiczny.
   https://developer.spotify.com/dashboard → twoja apka → Edit Settings → **Rotate Client Secret** → skopiuj nowy.
2. **Wygeneruj JWT secret** (raz, zapisz w bezpiecznym miejscu):
   ```powershell
   # Windows PowerShell:
   [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
   # macOS / Linux:
   openssl rand -base64 48
   ```
3. **Zarejestruj darmową subdomenę** w https://www.duckdns.org (login przez GitHub/Google → utwórz subdomenę np. `jakatomelodia.duckdns.org` → zapisz token).

### B. Stwórz instancję EC2

1. https://console.aws.amazon.com → **EC2** → **Launch instance**.
2. **Name**: `jaka-to-melodia`.
3. **AMI**: Ubuntu Server 24.04 LTS (free tier eligible).
4. **Instance type**: `t3.micro` (lub `t2.micro` jeśli `t3.micro` nie jest dostępny w free tier w twoim regionie).
5. **Key pair** → Create new → `melodia-key` → pobierz `.pem` (zapisz w `~/.ssh/`).
6. **Network settings** → Edit → **Allow** SSH, HTTP, HTTPS.
   Security group rules:
   - SSH (22) — tylko `My IP`.
   - HTTP (80) — Anywhere (Let's Encrypt wymaga port 80 dla challenge).
   - HTTPS (443) — Anywhere.
   - Custom UDP (443) — Anywhere (HTTP/3, opcjonalne).
7. **Storage**: 20 GB gp3 (free tier daje 30 GB EBS).
8. **Launch**. Po chwili zobaczysz **Public IPv4** — zapisz, np. `3.121.45.67`.

### C. Podlinkuj subdomenę DuckDNS pod EC2 IP

W panelu DuckDNS wpisz `3.121.45.67` w polu **current ip** dla twojej subdomeny → **update ip**.

Sprawdź:
```powershell
nslookup jakatomelodia.duckdns.org
# Powinno pokazać 3.121.45.67
```

### D. Zarejestruj redirect URI w Spotify Dashboard

https://developer.spotify.com/dashboard → twoja apka → Edit Settings → Redirect URIs → **Add**:
```
https://jakatomelodia.duckdns.org/login/oauth2/code/wolfship-auth
```
Save. (Zostaw też lokalne `http://127.0.0.1:8080/...` dla dev.)

### E. Połącz się z EC2 i postaw Dockera

```powershell
# Windows PowerShell — chmod-equivalent:
icacls "$env:USERPROFILE\.ssh\melodia-key.pem" /inheritance:r /grant:r "${env:USERNAME}:R"
ssh -i $env:USERPROFILE\.ssh\melodia-key.pem ubuntu@3.121.45.67
```

Na maszynie zdalnej:
```bash
# Update + Docker
sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit  # i zaloguj się ponownie, żeby zaktualizować grupy
```

Po ponownym SSH:
```bash
# Sprawdź że Docker działa
docker --version
docker compose version
```

### F. Wgraj kod na serwer

Najprościej — git clone (publiczne repo):
```bash
sudo apt install -y git
git clone https://github.com/<twoj-user>/<repo> melodia
cd melodia
```

Albo `scp` z lokalnej maszyny (gdy repo prywatne):
```powershell
# Z lokalnej maszyny Windows:
scp -i $env:USERPROFILE\.ssh\melodia-key.pem -r . ubuntu@3.121.45.67:/home/ubuntu/melodia
ssh -i $env:USERPROFILE\.ssh\melodia-key.pem ubuntu@3.121.45.67
cd melodia
```

### G. Skonfiguruj `.env`

Na serwerze:
```bash
cp deploy/.env.example .env
nano .env
```
Wypełnij:
```
SPOTIFY_CLIENT_ID=...nowy z dashboardu...
SPOTIFY_CLIENT_SECRET=...nowy sekret po rotacji...
PUBLIC_DOMAIN=jakatomelodia.duckdns.org
MELODIA_JWT_SECRET=...wygenerowany base64...
```
Zapisz (Ctrl+O, Enter, Ctrl+X).

### H. Build + uruchomienie

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Pierwszy build: ~5-10 min (Maven + npm). Kolejne deploye: ~2 min dzięki cache.

Sprawdź:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```
Powinieneś zobaczyć:
- `melodia-app | ... Started MelodiaApplication in X seconds`
- `melodia-caddy | ... certificate obtained successfully` (Let's Encrypt)

### I. Test

W przeglądarce wejdź na `https://jakatomelodia.duckdns.org`:
- 🟢 zielona kłódka HTTPS
- Login Spotify (jako host)
- Stwórz lobby
- Z telefonu (gdziekolwiek na świecie) wejdź `https://jakatomelodia.duckdns.org/join` → wpisz kod → graj.

### J. Aktualizacje aplikacji

```bash
cd melodia
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### K. Co warto wiedzieć

- **Free tier EC2** to 750h t3.micro/mies. przez **12 miesięcy** od założenia konta. Później ~$8/mo lub przenieś się na inne darmowe (Oracle Cloud Always Free, Fly.io).
- **Limit ruchu**: 1GB outbound/mies. free tier. Dla party z 10 osobami × kilka godzin → spokojnie się mieścisz (streaming idzie ze Spotify bezpośrednio do przeglądarki, nie przez twój serwer).
- **DuckDNS IP** musi być odświeżany jeśli EC2 dostanie nowy IP. EC2 Elastic IP można przypiąć za darmo (gdy podpięty do działającej instancji) — zalecane.
- **Backup**: stan gier jest w pamięci, więc nie ma co backupować. Sekrety trzymaj w bezpiecznym miejscu (`.env` nie jest w git).
- **Monitoring**: `docker stats` pokaże RAM/CPU. AWS CloudWatch agent (opcjonalnie) → metryki w konsoli.

### L. Częste problemy

| Problem | Rozwiązanie |
|---|---|
| Caddy nie dostaje certyfikatu (`unable to authorize`) | Port 80 zablokowany w Security Group. Otwórz HTTP (80) w SG. |
| Spotify rzuca `INVALID_REDIRECT_URI` | `https://...` URI nie jest dodany w Spotify Dashboard. Dodaj go (krok D). |
| Po loginie wracam na `http://...` (mixed content) | `server.forward-headers-strategy=framework` w `application.properties` — sprawdź czy build ma najnowszą wersję. |
| `502 Bad Gateway` | Backend jeszcze startuje (ma `start_period: 60s`). Poczekaj minutę. |
| Pamięć przepełniona | Zmniejsz `-Xmx` w JAVA_OPTS lub przeskocz na `t3.small` (płatne). |

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
