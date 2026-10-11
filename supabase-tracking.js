/* ================================================
   CONFIGURAZIONE SUPABASE - Blood On The TowerClock
   ================================================ */

// Sostituisci questi valori con le tue chiavi Supabase
const SUPABASE_CONFIG = {
  URL: 'https://YOUR_PROJECT.supabase.co',
  ANON_KEY: 'YOUR_ANON_KEY_HERE'
};

// Carica Supabase JS Client
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
script.onload = initSupabase;
document.head.appendChild(script);

let supabase = null;

async function initSupabase() {
  const { createClient } = window.supabase;
  supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  console.log('✅ Supabase inizializzato');
  
  // Verifica se l'utente è già autenticato
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('📱 Utente autenticato:', session.user.email);
    trackUserActivity('login', session.user.id);
  }
}

/* ================================================
   TRACKING FUNZIONI
   ================================================ */

async function trackUserActivity(action, userId = null, campaignId = null, metadata = {}) {
  if (!supabase) {
    console.warn('⚠️ Supabase non inizializzato');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('access_logs')
      .insert({
        user_id: userId || null,
        action: action,
        campaign_id: campaignId || null,
        ip_address: await getClientIP(),
        metadata: metadata,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Errore tracking:', error);
    } else {
      console.log('✅ Azione registrata:', action);
    }
  } catch (e) {
    console.error('❌ Errore nel tracking:', e);
  }
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

async function registerGamePlayer(userId, campaignId, characterName, characterClass) {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('game_players')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        character_name: characterName,
        character_class: characterClass,
        status: 'joined',
        is_online: true,
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Giocatore registrato:', characterName);
    trackUserActivity('player_joined', userId, campaignId, { 
      character: characterName, 
      class: characterClass 
    });

    return data;
  } catch (e) {
    console.error('❌ Errore registrazione giocatore:', e);
    return null;
  }
}

async function logGameAction(userId, campaignId, actionType, description, result = null) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('game_actions')
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        action_type: actionType,
        action_description: description,
        result: result,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    console.log('✅ Azione di gioco registrata:', actionType);
    return true;
  } catch (e) {
    console.error('❌ Errore log azione:', e);
    return false;
  }
}

async function logMessage(userId, campaignId, messageText, messageType = 'chat') {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('game_messages')
      .insert({
        campaign_id: campaignId,
        sender_id: userId,
        message_text: messageText,
        message_type: messageType,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    console.log('✅ Messaggio registrato');
    return true;
  } catch (e) {
    console.error('❌ Errore log messaggio:', e);
    return false;
  }
}

async function getActiveCampaigns() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('game_campaigns')
      .select('*')
      .in('status', ['lobby_active', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (e) {
    console.error('❌ Errore caricamento campagne:', e);
    return [];
  }
}

async function getLobbyPlayers(campaignId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('game_players')
      .select('*, users:user_id(username, display_name)')
      .eq('campaign_id', campaignId)
      .neq('status', 'left');

    if (error) throw error;

    return data || [];
  } catch (e) {
    console.error('❌ Errore caricamento giocatori:', e);
    return [];
  }
}

async function updatePlayerStatus(campaignId, userId, status, isOnline = true) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('game_players')
      .update({
        status: status,
        is_online: isOnline,
        last_activity: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log('✅ Status giocatore aggiornato:', status);
    return true;
  } catch (e) {
    console.error('❌ Errore update status:', e);
    return false;
  }
}

async function startGameSession(campaignId, storytellerId) {
  if (!supabase) return;

  try {
    const { error: campaignError } = await supabase
      .from('game_campaigns')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (campaignError) throw campaignError;

    // Log evento
    await supabase
      .from('game_events')
      .insert({
        campaign_id: campaignId,
        event_type: 'game_started',
        event_description: 'La partita è iniziata',
        timestamp: new Date().toISOString()
      });

    trackUserActivity('game_start', storytellerId, campaignId);
    console.log('✅ Partita iniziata');
    return true;
  } catch (e) {
    console.error('❌ Errore start game:', e);
    return false;
  }
}

async function endGameSession(campaignId, storytellerId) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('game_campaigns')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) throw error;

    await supabase
      .from('game_events')
      .insert({
        campaign_id: campaignId,
        event_type: 'game_ended',
        event_description: 'La partita è terminata',
        timestamp: new Date().toISOString()
      });

    trackUserActivity('game_end', storytellerId, campaignId);
    console.log('✅ Partita terminata');
    return true;
  } catch (e) {
    console.error('❌ Errore end game:', e);
    return false;
  }
}

/* ================================================
   REALTIME TRACKING - Chi è online
   ================================================ */

function subscribeToOnlinePlayers(campaignId, callback) {
  if (!supabase) return;

  supabase
    .from('game_players')
    .on('*', payload => {
      callback(payload);
    })
    .subscribe();
}

/* ================================================
   UTILITY FUNCTIONS
   ================================================ */

async function checkConnection() {
  if (!supabase) {
    console.warn('⚠️ Supabase non inizializzato');
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Errore connessione database:', error);
      return false;
    }

    console.log('✅ Database connesso correttamente');
    return true;
  } catch (e) {
    console.error('❌ Errore:', e);
    return false;
  }
}

// Verifica connessione al caricamento
window.addEventListener('load', () => {
  setTimeout(() => {
    checkConnection();
  }, 2000);
});

// Traccia quando l'utente lascia la pagina
window.addEventListener('beforeunload', () => {
  trackUserActivity('page_leave');
});
