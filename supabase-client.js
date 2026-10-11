// ================================================
// SUPABASE CLIENT INITIALIZATION
// ================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================
// AUTHENTICATION FUNCTIONS
// ================================================

export async function registerUser(email, password, username, displayName) {
  try {
    // Registra l'utente con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) throw authError;

    // Crea il profilo utente
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        username,
        display_name: displayName,
        role: 'player'
      });

    if (insertError) throw insertError;

    return { success: true, user: authData.user };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

export async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Log di accesso
    await logAccess(data.user.id, 'login', null);

    return { success: true, session: data.session };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

export async function logoutUser(userId) {
  try {
    // Log di logout
    await logAccess(userId, 'logout', null);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// USER SESSION TRACKING
// ================================================

export async function createSession(userId, campaignId = null, lobbyId = null) {
  try {
    const sessionToken = generateSessionToken();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        lobby_id: lobbyId,
        session_token: sessionToken,
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent,
        device_type: getDeviceType(),
        browser_name: getBrowserName(),
        browser_version: getBrowserVersion(),
        os_name: getOSName()
      })
      .select()
      .single();

    if (error) throw error;

    // Salva il token nel localStorage
    localStorage.setItem('session_token', sessionToken);

    return { success: true, session: data };
  } catch (error) {
    console.error('Session creation error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSessionActivity(userId) {
  try {
    const sessionToken = localStorage.getItem('session_token');
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_token', sessionToken)
      .eq('is_active', true);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Session update error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// LOBBY MANAGEMENT
// ================================================

export async function createLobby(campaignId, maxPlayers = 6) {
  try {
    const lobbyCode = generateLobbyCode();

    const { data, error } = await supabase
      .from('game_lobbies')
      .insert({
        campaign_id: campaignId,
        lobby_code: lobbyCode,
        max_players: maxPlayers,
        status: 'waiting'
      })
      .select()
      .single();

    if (error) throw error;

    // Log evento
    await logGameEvent(campaignId, null, 'lobby_created', `Lobby creata: ${lobbyCode}`);

    return { success: true, lobby: data };
  } catch (error) {
    console.error('Lobby creation error:', error);
    return { success: false, error: error.message };
  }
}

export async function joinLobby(userId, lobbyCode, characterName, characterClass) {
  try {
    // Trova la lobby
    const { data: lobbyData, error: lobbyError } = await supabase
      .from('game_lobbies')
      .select('id, campaign_id, current_player_count, max_players')
      .eq('lobby_code', lobbyCode)
      .single();

    if (lobbyError || !lobbyData) throw new Error('Lobby non trovata');

    if (lobbyData.current_player_count >= lobbyData.max_players) {
      throw new Error('Lobby piena');
    }

    // Aggiungi il giocatore
    const { data: playerData, error: playerError } = await supabase
      .from('game_players')
      .insert({
        campaign_id: lobbyData.campaign_id,
        lobby_id: lobbyData.id,
        user_id: userId,
        character_name: characterName,
        character_class: characterClass,
        status: 'joined',
        is_online: true
      })
      .select()
      .single();

    if (playerError) throw playerError;

    // Update sessione
    await supabase
      .from('user_sessions')
      .update({
        campaign_id: lobbyData.campaign_id,
        lobby_id: lobbyData.id
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Log accesso
    await logAccess(userId, 'join_lobby', lobbyData.campaign_id, {
      lobby_code: lobbyCode,
      character_name: characterName
    });

    // Log evento gioco
    await logGameEvent(lobbyData.campaign_id, playerData.id, 'player_joined', 
      `${characterName} si è unito alla lobby`);

    return { success: true, player: playerData };
  } catch (error) {
    console.error('Join lobby error:', error);
    return { success: false, error: error.message };
  }
}

export async function leaveLobby(userId, campaignId) {
  try {
    // Trova il giocatore
    const { data: playerData, error: playerError } = await supabase
      .from('game_players')
      .select('id, character_name')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .single();

    if (playerError) throw playerError;

    // Aggiorna lo stato
    await supabase
      .from('game_players')
      .update({
        status: 'left',
        is_online: false,
        left_at: new Date().toISOString()
      })
      .eq('id', playerData.id);

    // Log accesso
    await logAccess(userId, 'leave_lobby', campaignId);

    // Log evento
    await logGameEvent(campaignId, playerData.id, 'player_left',
      `${playerData.character_name} ha abbandonato la lobby`);

    return { success: true };
  } catch (error) {
    console.error('Leave lobby error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// GAME MANAGEMENT (STORYTELLER)
// ================================================

export async function startGame(campaignId, storytellerId) {
  try {
    // Aggiorna campagna
    const { error: campaignError } = await supabase
      .from('game_campaigns')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (campaignError) throw campaignError;

    // Aggiorna lobby
    await supabase
      .from('game_lobbies')
      .update({ status: 'active' })
      .eq('campaign_id', campaignId);

    // Aggiorna giocatori
    await supabase
      .from('game_players')
      .update({ status: 'playing', ready_at: new Date().toISOString() })
      .eq('campaign_id', campaignId)
      .neq('status', 'left');

    // Log azione storyteller
    await logStorytellerAction(campaignId, storytellerId, 'start_game', 
      'La partita è iniziata');

    // Log evento
    await logGameEvent(campaignId, null, 'game_started', 'La partita è iniziata');

    // Log accesso
    await logAccess(storytellerId, 'game_start', campaignId);

    return { success: true };
  } catch (error) {
    console.error('Start game error:', error);
    return { success: false, error: error.message };
  }
}

export async function endGame(campaignId, storytellerId) {
  try {
    const { error } = await supabase
      .from('game_campaigns')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) throw error;

    // Log evento
    await logGameEvent(campaignId, null, 'game_ended', 'La partita è terminata');

    // Log azione storyteller
    await logStorytellerAction(campaignId, storytellerId, 'end_game', 
      'La partita è terminata');

    return { success: true };
  } catch (error) {
    console.error('End game error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// GAME ACTIONS LOGGING
// ================================================

export async function logGameAction(campaignId, playerId, userId, actionType, 
  description, result = null, targetPlayerId = null) {
  try {
    const { error } = await supabase
      .from('game_actions')
      .insert({
        campaign_id: campaignId,
        player_id: playerId,
        user_id: userId,
        action_type: actionType,
        action_description: description,
        result: result,
        target_player_id: targetPlayerId,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Game action logging error:', error);
    return { success: false, error: error.message };
  }
}

export async function logMessage(campaignId, senderId, messageText, 
  messageType = 'chat', isOutOfCharacter = false) {
  try {
    const { error } = await supabase
      .from('game_messages')
      .insert({
        campaign_id: campaignId,
        sender_id: senderId,
        message_text: messageText,
        message_type: messageType,
        is_out_of_character: isOutOfCharacter,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Message logging error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// ACCESS LOGGING
// ================================================

export async function logAccess(userId, action, campaignId = null, metadata = {}) {
  try {
    const { error } = await supabase
      .from('access_logs')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        action: action,
        ip_address: await getClientIP(),
        metadata: metadata,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Access logging error:', error);
    return { success: false, error: error.message };
  }
}

export async function logStorytellerAction(campaignId, storytellerId, actionType, description, targetPlayerId = null) {
  try {
    const { error } = await supabase
      .from('storyteller_actions')
      .insert({
        campaign_id: campaignId,
        storyteller_id: storytellerId,
        action_type: actionType,
        description: description,
        target_player_id: targetPlayerId,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Storyteller action logging error:', error);
    return { success: false, error: error.message };
  }
}

export async function logGameEvent(campaignId, playerId, eventType, description) {
  try {
    const { error } = await supabase
      .from('game_events')
      .insert({
        campaign_id: campaignId,
        triggered_by_user_id: playerId,
        event_type: eventType,
        event_description: description,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Game event logging error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// DATA RETRIEVAL
// ================================================

export async function getActiveCampaigns() {
  try {
    const { data, error } = await supabase
      .from('game_campaigns')
      .select('*, users:storyteller_id(display_name, username)')
      .in('status', ['lobby_active', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, campaigns: data };
  } catch (error) {
    console.error('Get campaigns error:', error);
    return { success: false, error: error.message };
  }
}

export async function getLobbyInfo(lobbyCode) {
  try {
    const { data, error } = await supabase
      .from('game_lobbies')
      .select(`
        *,
        campaigns:campaign_id(title, description, storyteller_id),
        players:game_players(
          id,
          user_id,
          character_name,
          character_class,
          status,
          users:user_id(display_name, username)
        )
      `)
      .eq('lobby_code', lobbyCode)
      .single();

    if (error) throw error;

    return { success: true, lobby: data };
  } catch (error) {
    console.error('Get lobby info error:', error);
    return { success: false, error: error.message };
  }
}

export async function getCampaignStatistics(campaignId) {
  try {
    const { data, error } = await supabase
      .from('campaign_statistics_view')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) throw error;

    return { success: true, stats: data };
  } catch (error) {
    console.error('Get statistics error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

function generateSessionToken() {
  return 'session_' + Math.random().toString(36).substr(2, 9) + 
         Date.now().toString(36);
}

function generateLobbyCode() {
  return 'LOBBY_' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return '0.0.0.0';
  }
}

function getDeviceType() {
  const ua = navigator.userAgent;
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.indexOf('Chrome') > -1) return 'Chrome';
  if (ua.indexOf('Safari') > -1) return 'Safari';
  if (ua.indexOf('Firefox') > -1) return 'Firefox';
  if (ua.indexOf('Edge') > -1) return 'Edge';
  return 'Unknown';
}

function getBrowserVersion() {
  return navigator.userAgent.match(/\b\d+\.\d+/)?.[0] || 'Unknown';
}

function getOSName() {
  const ua = navigator.userAgent;
  if (ua.indexOf('Windows') > -1) return 'Windows';
  if (ua.indexOf('Mac') > -1) return 'macOS';
  if (ua.indexOf('Linux') > -1) return 'Linux';
  if (ua.indexOf('Android') > -1) return 'Android';
  if (ua.indexOf('iPhone') > -1) return 'iOS';
  return 'Unknown';
}

export default supabase;
