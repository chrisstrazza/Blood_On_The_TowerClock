-- ================================================
-- SCHEMA SUPABASE - Blood On The TowerClock GAME
-- ================================================
-- Sistema di tracking completo per:
-- - Utenti registrati e guest
-- - Sessioni di gioco
-- - Lobby di gioco
-- - Storyteller e maestri di gioco
-- - Azioni di gioco
-- - Sistema di log completo

-- ================================================
-- 1. TABELLA UTENTI
-- ================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  display_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'player', -- 'player', 'storyteller', 'admin', 'guest'
  avatar_url TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE,
  total_games_played INTEGER DEFAULT 0,
  character_description TEXT,
  preferences JSONB -- Preferenze di gioco
);

-- ================================================
-- 2. TABELLA CAMPAGNE/PARTITE
-- ================================================
CREATE TABLE IF NOT EXISTS game_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  storyteller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'created', -- 'created', 'lobby_active', 'in_progress', 'completed', 'cancelled'
  max_players INTEGER DEFAULT 6,
  current_players INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  game_settings JSONB, -- Impostazioni di gioco
  rules TEXT,
  world_description TEXT,
  image_url TEXT
);

-- ================================================
-- 3. TABELLA LOBBY
-- ================================================
CREATE TABLE IF NOT EXISTS game_lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES game_campaigns(id) ON DELETE CASCADE,
  lobby_code VARCHAR(20) UNIQUE NOT NULL, -- Codice per unirsi alla lobby
  status VARCHAR(50) DEFAULT 'waiting', -- 'waiting', 'ready', 'starting', 'active', 'closed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  max_players INTEGER,
  current_player_count INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE
);

-- ================================================
-- 4. TABELLA ISCRITTI A PARTITA (Campaign Players)
-- ================================================
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES game_campaigns(id) ON DELETE CASCADE,
  lobby_id UUID REFERENCES game_lobbies(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_name VARCHAR(255),
  character_class VARCHAR(100),
  character_description TEXT,
  status VARCHAR(50) DEFAULT 'joined', -- 'joined', 'ready', 'playing', 'dead', 'left'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ready_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  is_online BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  player_stats JSONB, -- Statistiche del personaggio
  position_in_lobby INTEGER,
  UNIQUE(campaign_id, user_id) -- Un utente per campagna
);

-- ================================================
-- 5. TABELLA SESSIONI DI CONNESSIONE
-- ================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES game_campaigns(id) ON DELETE SET NULL,
  lobby_id UUID REFERENCES game_lobbies(id) ON DELETE SET NULL,
  session_token VARCHAR(500) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
  browser_name VARCHAR(100),
  browser_version VARCHAR(20),
  os_name VARCHAR(100),
  login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  logout_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  session_duration_seconds INTEGER
);

-- ================================================
-- 6. TABELLA LOG ACCESSI
-- ================================================
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES game_campaigns(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'join_lobby', 'leave_lobby', 'game_start', 'game_end'
  action_type VARCHAR(50),
  ip_address INET,
  details TEXT,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 7. TABELLA AZIONI DI GIOCO
-- ================================================
CREATE TABLE IF NOT EXISTS game_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES game_campaigns(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL, -- 'attack', 'spell', 'defend', 'interact', 'communicate', 'item_use'
  action_description TEXT,
  result VARCHAR(255),
  target_player_id UUID REFERENCES game_players(id) ON DELETE SET NULL,
  damage_dealt INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  turn_number INTEGER,
  action_data JSONB
);

-- ================================================
-- 8. TABELLA CHAT/MESSAGGI
-- ================================================
CREATE TABLE IF NOT EXISTS game_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES game_campaigns(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'chat', -- 'chat', 'action', 'system', 'storyteller'
  is_out_of_character BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE,
  channel VARCHAR(50) DEFAULT 'general' -- 'general', 'whisper', 'party', 'storyteller'
);

-- ================================================
-- 9. TABELLA STORYTELLER LOG (Azioni di controllo)
-- ================================================
CREATE TABLE IF NOT EXISTS storyteller_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES game_campaigns(id) ON DELETE CASCADE,
  storyteller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL, -- 'start_game', 'pause', 'resume', 'end_turn', 'roll_dice', 'apply_effect', 'kick_player'
  target_player_id UUID REFERENCES game_players(id) ON DELETE SET NULL,
  description TEXT,
  action_result TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action_data JSONB
);

-- ================================================
-- 10. TABELLA STATISTICHE GIORNALIERE
-- ================================================
CREATE TABLE IF NOT EXISTS daily_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_logins INTEGER DEFAULT 0,
  total_logouts INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  total_players_connected INTEGER DEFAULT 0,
  total_games_completed INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  average_session_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- 11. TABELLA EVENTI DI GIOCO
-- ================================================
CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES game_campaigns(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'player_joined', 'player_left', 'game_started', 'game_ended', 'turn_started', 'combat_initiated'
  triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_description TEXT,
  event_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  round_number INTEGER
);

-- ================================================
-- 12. TABELLA NOTIFICHE
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES game_campaigns(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50), -- 'lobby_update', 'game_invite', 'player_joined', 'turn_ready'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  link_url VARCHAR(500)
);

-- ================================================
-- 13. TABELLA AUDIT TRAIL
-- ================================================
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES game_campaigns(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- INDICI PER PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_game_campaigns_storyteller ON game_campaigns(storyteller_id);
CREATE INDEX IF NOT EXISTS idx_game_campaigns_status ON game_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_game_campaigns_created_at ON game_campaigns(created_at);

CREATE INDEX IF NOT EXISTS idx_game_lobbies_campaign ON game_lobbies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_lobbies_code ON game_lobbies(lobby_code);
CREATE INDEX IF NOT EXISTS idx_game_lobbies_status ON game_lobbies(status);

CREATE INDEX IF NOT EXISTS idx_game_players_campaign ON game_players(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_players_lobby ON game_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_game_players_status ON game_players(status);
CREATE INDEX IF NOT EXISTS idx_game_players_is_online ON game_players(is_online);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_campaign ON user_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_lobby ON user_sessions(lobby_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON user_sessions(login_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_campaign ON access_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);

CREATE INDEX IF NOT EXISTS idx_game_actions_campaign ON game_actions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_actions_player ON game_actions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_actions_timestamp ON game_actions(timestamp);

CREATE INDEX IF NOT EXISTS idx_game_messages_campaign ON game_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_messages_sender ON game_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_game_messages_created_at ON game_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_storyteller_actions_campaign ON storyteller_actions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_storyteller_actions_timestamp ON storyteller_actions(timestamp);

CREATE INDEX IF NOT EXISTS idx_game_events_campaign ON game_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_events_timestamp ON game_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ================================================
-- TRIGGER PER AGGIORNAMENTI AUTOMATICI
-- ================================================

CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- Trigger per aggiornare current_players in game_campaigns
CREATE OR REPLACE FUNCTION update_campaign_player_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE game_campaigns
  SET current_players = (
    SELECT COUNT(*) FROM game_players
    WHERE campaign_id = NEW.campaign_id AND status != 'left'
  )
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_players
AFTER INSERT OR UPDATE ON game_players
FOR EACH ROW
EXECUTE FUNCTION update_campaign_player_count();

-- Trigger per aggiornare last_activity
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET last_seen = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_last_seen
AFTER INSERT ON access_logs
FOR EACH ROW
EXECUTE FUNCTION update_user_last_seen();

-- ================================================
-- RLS (Row Level Security)
-- ================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyteller_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ================================================
-- VIEWS UTILI
-- ================================================

-- View: Lobbies Attive con Informazioni Storyteller
CREATE OR REPLACE VIEW active_lobbies_view AS
SELECT
  gl.id,
  gl.lobby_code,
  gc.title as campaign_title,
  gc.storyteller_id,
  u.display_name as storyteller_name,
  gl.current_player_count,
  gl.max_players,
  gl.status,
  gl.created_at
FROM game_lobbies gl
JOIN game_campaigns gc ON gl.campaign_id = gc.id
JOIN users u ON gc.storyteller_id = u.id
WHERE gl.status IN ('waiting', 'ready', 'starting');

-- View: Giocatori Collegati in Tempo Reale
CREATE OR REPLACE VIEW active_players_view AS
SELECT
  gp.user_id,
  u.display_name,
  u.username,
  gp.character_name,
  gp.character_class,
  gc.title as campaign_title,
  gp.status,
  gp.is_online,
  gp.last_activity
FROM game_players gp
JOIN users u ON gp.user_id = u.id
JOIN game_campaigns gc ON gp.campaign_id = gc.id
WHERE gp.is_online = TRUE AND gc.status IN ('lobby_active', 'in_progress');

-- View: Statistiche Campagna
CREATE OR REPLACE VIEW campaign_statistics_view AS
SELECT
  gc.id,
  gc.title,
  gc.storyteller_id,
  u.display_name as storyteller_name,
  COUNT(DISTINCT gp.user_id) as total_players_joined,
  SUM(CASE WHEN gp.status = 'playing' THEN 1 ELSE 0 END) as active_players,
  COUNT(DISTINCT ga.id) as total_actions,
  COUNT(DISTINCT gm.id) as total_messages,
  gc.created_at,
  gc.started_at,
  gc.ended_at
FROM game_campaigns gc
LEFT JOIN users u ON gc.storyteller_id = u.id
LEFT JOIN game_players gp ON gc.id = gp.campaign_id
LEFT JOIN game_actions ga ON gc.id = ga.campaign_id
LEFT JOIN game_messages gm ON gc.id = gm.campaign_id
GROUP BY gc.id, gc.title, gc.storyteller_id, u.display_name;
