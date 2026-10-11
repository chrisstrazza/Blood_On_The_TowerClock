# Blood On The TowerClock - Supabase Integration Guide

## Setup Supabase

### 1. Crea un progetto Supabase
- Vai su https://supabase.com
- Crea un nuovo progetto
- Salva l'URL e la chiave anonima (ANON_KEY)

### 2. Setup Database
- Vai a SQL Editor nel dashboard Supabase
- Copia il contenuto di `supabase-schema.sql`
- Esegui lo script SQL

### 3. Configurazione Variabili d'Ambiente
Crea un file `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Installa Supabase Client
```bash
npm install @supabase/supabase-js
```

## Struttura Database

### Tabelle Principali

#### `users`
- Profili utenti (giocatori e storyteller)
- Tracking connessioni
- Dati personaggio

#### `game_campaigns`
- Partite/campagne
- Informazioni storyteller
- Settings di gioco

#### `game_lobbies`
- Lobby di gioco
- Codice di accesso
- Max players

#### `game_players`
- Giocatori in una campagna
- Status (joined, ready, playing, left)
- Informazioni personaggio

#### `user_sessions`
- Sessioni di connessione
- IP, browser, device
- Timing login/logout

#### `access_logs`
- Log di tutti gli accessi
- Azioni: login, logout, join, leave
- Timestamp completi

#### `game_actions`
- Azioni di combattimento
- Spell, attacchi, interazioni
- Effetti e danni

#### `game_messages`
- Chat di gioco
- In-character e out-of-character
- Timestamp e sender

#### `storyteller_actions`
- Azioni del DM/Storyteller
- Controllo partita
- Roll dice, effetti

#### `game_events`
- Eventi di sistema
- Player joined, game started, ecc
- Cronologia partita

## Uso Client Functions

### Autenticazione
```javascript
import { registerUser, loginUser, logoutUser } from './supabase-client.js';

// Registrazione
await registerUser(email, password, username, displayName);

// Login
await loginUser(email, password);

// Logout
await logoutUser(userId);
```

### Lobby
```javascript
import { createLobby, joinLobby, leaveLobby } from './supabase-client.js';

// Crea lobby (storyteller)
const lobby = await createLobby(campaignId, maxPlayers);

// Unisciti alla lobby (player)
await joinLobby(userId, lobbyCode, characterName, characterClass);

// Abbandona lobby
await leaveLobby(userId, campaignId);
```

### Gioco
```javascript
import { startGame, endGame, logGameAction } from './supabase-client.js';

// Inizia partita (storyteller)
await startGame(campaignId, storytellerId);

// Log azione (qualsiasi giocatore)
await logGameAction(campaignId, playerId, userId, 'attack', 'Attacco con spada', 'hit', targetPlayerId);

// Termina partita
await endGame(campaignId, storytellerId);
```

### Chat e Messaggi
```javascript
import { logMessage } from './supabase-client.js';

// Invia messaggio
await logMessage(campaignId, senderId, messageText, 'chat', false);
```

## Dati Memorizzati Automaticamente

✅ **Login/Logout** - timestamp, IP, device, browser
✅ **Join/Leave Lobby** - quando, quale lobby, personaggio
✅ **Accessi** - ogni azione tracciata
✅ **Chat** - tutti i messaggi con timestamp
✅ **Azioni di Gioco** - attacchi, spell, interazioni
✅ **Comandi Storyteller** - tutto quello che fa il DM
✅ **Eventi** - cronologia completa della partita
✅ **Sessioni** - durata, attività, device

## Dashboard Analytics

Usa queste VIEWS per analizzare i dati:

### `active_lobbies_view`
Lobbies attive con storyteller e giocatori

### `active_players_view`
Giocatori online in real-time

### `campaign_statistics_view`
Statistiche complete della campagna

## Security

- RLS (Row Level Security) abilitato
- Gli utenti vedono solo i loro dati
- Ammins accedono a tutto
- Audit trail per tracciare modifiche

## Backup e Analytics

Supabase ti permette di:
- Esportare tutti i dati
- Creare report
- Analizzare statistiche
- Tracciare tendenze di gioco
