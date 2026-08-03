/**
 * Daspalecte — envoi des resultats vers l'app web.
 *
 * Charge par background.js (importScripts). Tout vit ici plutot que dans
 * content.js parce qu'un content script meurt a chaque navigation : la session
 * en cours et la file d'attente ne survivraient pas.
 *
 * L'extension n'embarque pas le SDK Firebase — MV3 interdit le code distant et
 * le projet n'a pas d'etape de build. On envoie un access token Google obtenu
 * par chrome.identity, et le serveur le verifie contre sa liste d'audiences.
 */

// URL de l'app web (Firebase App Hosting). Pour developper en local, poser
// `daspalecteApiBase` dans chrome.storage.local : cette clef prime sur la constante.
const DEFAULT_API_BASE = 'https://daspalecte--essai-27712.europe-west4.hosted.app';

const QUEUE_KEY = 'daspalecteQueue';
const SESSIONS_KEY = 'daspalecteSessions';
const API_BASE_KEY = 'daspalecteApiBase';
const DISABLED_KEY = 'daspalecteTrackingBlocked';

/** Au-dela, on considere que l'eleve a change d'activite. */
const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Le serveur refuse au-dela de 100 evenements par lot. */
const MAX_BATCH = 100;
/** Garde-fou memoire si le reseau reste coupe longtemps. */
const MAX_QUEUE = 2000;
const FLUSH_ALARM = 'daspalecte-flush';

let flushing = false;

// ---------------------------------------------------------------------------
// Session : une par onglet, redemarree si l'eleve change de page ou s'absente
// ---------------------------------------------------------------------------

/**
 * Le fragment (#) et les parametres de suivi ne changent pas le texte lu :
 * les ignorer evite d'eclater une lecture en trois sessions.
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url || '';
  }
}

function hostAppFor(url) {
  if (!url) return 'web';
  if (url.includes('docs.google.com/document')) return 'docs';
  if (url.includes('docs.google.com/presentation')) return 'slides';
  if (url.includes('docs.google.com/spreadsheets')) return 'sheets';
  return 'web';
}

async function readSessions() {
  const stored = await chrome.storage.session.get(SESSIONS_KEY);
  return stored[SESSIONS_KEY] || {};
}

async function resolveSession(tabId, url, title) {
  const sessions = await readSessions();
  const key = String(tabId ?? 'sans-onglet');
  const now = Date.now();
  const normalized = normalizeUrl(url);

  let session = sessions[key];
  const stale =
    !session ||
    session.context.url !== normalized ||
    now - session.lastActivityAt > SESSION_IDLE_MS;

  if (stale) {
    session = {
      id: crypto.randomUUID(),
      startedAt: now,
      lastActivityAt: now,
      context: {
        url: normalized,
        title: title || null,
        hostApp: hostAppFor(normalized)
      }
    };
  } else {
    session.lastActivityAt = now;
    // Le titre arrive parfois apres le premier evenement.
    if (!session.context.title && title) session.context.title = title;
  }

  sessions[key] = session;
  await chrome.storage.session.set({ [SESSIONS_KEY]: sessions });
  return session;
}

// ---------------------------------------------------------------------------
// File d'attente : les Chromebooks scolaires perdent le reseau regulierement
// ---------------------------------------------------------------------------

async function enqueue(entry) {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY] || [];
  queue.push(entry);
  // On sacrifie les plus anciens : un mot traduit il y a deux jours vaut moins
  // que celui de maintenant, et on ne peut pas grossir indefiniment.
  const trimmed = queue.length > MAX_QUEUE ? queue.slice(-MAX_QUEUE) : queue;
  await chrome.storage.local.set({ [QUEUE_KEY]: trimmed });
}

async function trackEvent({ tabId, url, title, type, payload }) {
  try {
    if (await isBlocked()) return;

    const session = await resolveSession(tabId, url, title);
    await enqueue({
      sessionId: session.id,
      startedAt: session.startedAt,
      context: session.context,
      event: {
        id: crypto.randomUUID(),
        type,
        at: Date.now(),
        payload: payload || {}
      }
    });
    void flush();
  } catch (error) {
    // Le suivi ne doit jamais casser une fonctionnalite pedagogique.
    console.warn('[ANALYTICS] enregistrement impossible :', error);
  }
}

// ---------------------------------------------------------------------------
// Jeton Google
// ---------------------------------------------------------------------------

/**
 * Jeton Google, obtenu par `chrome.identity.launchWebAuthFlow`.
 *
 * Pourquoi pas `getAuthToken`, qui serait plus court : il lit son client_id
 * dans le manifeste, or l'extension a DEUX identifiants (celui du Web Store et
 * celui de la copie non empaquetee, derive du chemin du dossier). Il faudrait
 * donc deux clients OAuth et un manifeste a echanger avant chaque publication —
 * un oubli casserait le suivi pour tous les eleves, en silence.
 *
 * Un client de type Application Web, lui, accepte plusieurs URI de redirection.
 * On en enregistre une par identifiant d'extension et le meme client sert
 * partout, sans rien echanger.
 */
const OAUTH_CLIENT_ID = '474562157268-oboltab8hgo100pnd2l5r0mn5vs3rqq7.apps.googleusercontent.com';
const OAUTH_SCOPES = 'openid email profile';
const TOKEN_KEY = 'daspalecteToken';

/**
 * `getAuthToken` gerait son cache tout seul ; ici c'est a nous. La marge de
 * 60 s evite d'envoyer un jeton qui expire pendant le vol et revient en 401.
 */
async function cachedToken() {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const entry = stored[TOKEN_KEY];
  if (entry && entry.accessToken && entry.expiresAt > Date.now() + 60000) {
    return entry.accessToken;
  }
  return null;
}

async function storeToken(accessToken, expiresIn) {
  await chrome.storage.local.set({
    [TOKEN_KEY]: {
      accessToken,
      expiresAt: Date.now() + Math.max(60, Number(expiresIn) || 3600) * 1000
    }
  });
}

async function clearToken() {
  await chrome.storage.local.remove(TOKEN_KEY);
}

function authorizationUrl(state, interactive) {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    response_type: 'token',
    // getRedirectURL() suit l'identifiant reel de l'extension : la meme
    // configuration marche en local et en production.
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: OAUTH_SCOPES,
    state
  });
  // En silencieux, on demande a Google d'echouer plutot que d'afficher quoi que
  // ce soit : launchWebAuthFlow non interactif ne peut rien montrer.
  if (!interactive) params.set('prompt', 'none');
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseRedirect(redirect, expectedState) {
  try {
    const url = new URL(redirect);
    const refus = url.searchParams.get('error');
    if (refus) return { token: null, error: refus };

    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
    const erreur = fragment.get('error');
    if (erreur) return { token: null, error: erreur };
    // L'etat protege d'une reponse qui ne repondrait pas a notre demande.
    if (fragment.get('state') !== expectedState) {
      return { token: null, error: 'etat_invalide' };
    }
    const token = fragment.get('access_token');
    if (!token) return { token: null, error: 'jeton_absent' };
    return { token, expiresIn: fragment.get('expires_in'), error: null };
  } catch {
    return { token: null, error: 'redirection_illisible' };
  }
}

/**
 * Renvoie toujours { token, error } — jamais un simple null.
 *
 * Le message d'erreur compte autant que le jeton : un compte hors de
 * l'organisation du client OAuth est refuse par Google, et sans ce message le
 * refus est indiscernable d'un « pas encore connecte ».
 */
async function getToken(interactive) {
  const cached = await cachedToken();
  if (cached) return { token: cached, error: null };

  const state = crypto.randomUUID();
  const url = authorizationUrl(state, interactive);

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (redirect) => {
      const failure = chrome.runtime.lastError;
      if (failure || !redirect) {
        resolve({
          token: null,
          error: failure ? failure.message : 'aucune_reponse'
        });
        return;
      }

      const parsed = parseRedirect(redirect, state);
      if (!parsed.token) {
        resolve({ token: null, error: parsed.error });
        return;
      }
      storeToken(parsed.token, parsed.expiresIn).then(() =>
        resolve({ token: parsed.token, error: null })
      );
    });
  });
}

async function apiBase() {
  const stored = await chrome.storage.local.get(API_BASE_KEY);
  return (stored[API_BASE_KEY] || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/**
 * Un compte non inscrit par un prof est refuse par le serveur. Inutile de
 * rejouer indefiniment : on coupe le suivi jusqu'a la prochaine connexion
 * explicite depuis le sidepanel.
 */
async function isBlocked() {
  const stored = await chrome.storage.local.get(DISABLED_KEY);
  return Boolean(stored[DISABLED_KEY]);
}

async function setBlocked(value) {
  await chrome.storage.local.set({ [DISABLED_KEY]: value });
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    await flushOnce();
  } catch (error) {
    console.warn('[ANALYTICS] envoi impossible :', error);
  } finally {
    flushing = false;
  }
}

async function flushOnce() {
  if (await isBlocked()) return;

  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY] || [];
  if (queue.length === 0) return;

  let { token } = await getToken(false);
  if (!token) return; // l'eleve ne s'est pas encore connecte : on garde tout

  const base = await apiBase();
  const batch = takeBatch(queue);

  let response = await send(base, token, batch.body);

  if (response.status === 401) {
    // Jeton expire cote Google : on le jette et on en redemande un.
    await clearToken();
    ({ token } = await getToken(false));
    if (!token) return;
    response = await send(base, token, batch.body);
  }

  if (response.status === 403) {
    const reason = response.data && response.data.error;
    if (reason === 'unknown_account') {
      await setBlocked(true);
      console.warn(
        '[ANALYTICS] compte non inscrit par un professeur, suivi desactive.'
      );
    }
    // Dans tous les cas de refus definitif, on abandonne ce lot.
    await dropFromQueue(batch.count);
    return;
  }

  if (!response.ok) return; // reseau ou serveur : on reessaiera au prochain tour

  await dropFromQueue(batch.count);

  // Il reste peut-etre de quoi remplir un autre lot.
  const rest = await chrome.storage.local.get(QUEUE_KEY);
  if ((rest[QUEUE_KEY] || []).length > 0) void flush();
}

/**
 * Un lot ne couvre qu'UNE session : le serveur met a jour la session en meme
 * temps que ses evenements. On s'arrete donc au premier changement de session.
 */
function takeBatch(queue) {
  const sessionId = queue[0].sessionId;
  const events = [];
  let count = 0;

  for (const entry of queue) {
    if (entry.sessionId !== sessionId) break;
    if (events.length >= MAX_BATCH) break;
    events.push(entry.event);
    count += 1;
  }

  return {
    count,
    body: {
      source: 'extension',
      session: {
        id: sessionId,
        startedAt: queue[0].startedAt,
        context: queue[0].context
      },
      events
    }
  };
}

async function send(base, token, body) {
  try {
    const response = await fetch(`${base}/api/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

async function dropFromQueue(count) {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY] || [];
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(count) });
}

// ---------------------------------------------------------------------------
// Connexion depuis le sidepanel
// ---------------------------------------------------------------------------

/** Connexion explicite : c'est le seul moment ou un ecran Google peut s'ouvrir. */
async function signIn() {
  const { token, error } = await getToken(true);
  if (!token) {
    console.warn('[ANALYTICS] connexion refusee par Google :', error);
    return { ok: false, error };
  }

  await setBlocked(false);
  const identity = await fetchIdentity(token);
  if (!identity) {
    await clearToken();
    return { ok: false, error: 'identite_illisible' };
  }

  await chrome.storage.local.set({ daspalecteAccount: identity });
  void flush();
  return { ok: true, account: identity };
}

async function fetchIdentity(token) {
  try {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return { email: data.email || null, name: data.name || null };
  } catch {
    return null;
  }
}

async function signOut() {
  await clearToken();
  await chrome.storage.local.remove('daspalecteAccount');
}

/** Compte connu sans ouvrir de fenetre : sert a afficher l'etat du sidepanel. */
async function currentAccount() {
  const stored = await chrome.storage.local.get([
    'daspalecteAccount',
    DISABLED_KEY
  ]);
  return {
    account: stored.daspalecteAccount || null,
    blocked: Boolean(stored[DISABLED_KEY])
  };
}

// ---------------------------------------------------------------------------
// Branchements
// ---------------------------------------------------------------------------

// L'alarme n'est qu'un filet : chaque evenement declenche deja un envoi. Si
// la permission "alarms" manque (extension pas encore rechargee apres une mise
// a jour du manifeste), on continue sans elle plutot que de tout faire echouer.
if (chrome.alarms) {
  // Le service worker MV3 est arrete et relance sans arret. Recreer l'alarme a
  // chaque demarrage remettrait son minuteur a zero et elle ne sonnerait
  // jamais : on ne la cree que si elle n'existe pas deja.
  chrome.alarms.get(FLUSH_ALARM, (existing) => {
    if (!existing) chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FLUSH_ALARM) void flush();
  });
} else {
  console.warn(
    '[ANALYTICS] permission "alarms" absente : les renvois automatiques sont desactives.'
  );
}

// Onglet ferme : on oublie sa session, sinon la table grossit indefiniment.
// Les evenements deja en file gardent leur identifiant de session, ils partiront
// quand meme.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const sessions = await readSessions();
    if (sessions[String(tabId)]) {
      delete sessions[String(tabId)];
      await chrome.storage.session.set({ [SESSIONS_KEY]: sessions });
    }
  } catch (error) {
    console.debug('[ANALYTICS] nettoyage de session impossible :', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRACK') {
    void trackEvent({
      tabId: sender.tab && sender.tab.id,
      url: (sender.tab && sender.tab.url) || message.url,
      title: (sender.tab && sender.tab.title) || message.title,
      type: message.eventType,
      payload: message.payload
    });
    return false;
  }

  if (message.type === 'ANALYTICS_SIGN_IN') {
    signIn().then(sendResponse);
    return true;
  }

  if (message.type === 'ANALYTICS_SIGN_OUT') {
    signOut().then(() => sendResponse({ ok: true }));
    return true;
  }

  // La popup a besoin de l'URL du site pour son bouton « Mes résultats » :
  // elle vient d'ici pour qu'il n'y ait qu'une seule source de verite.
  if (message.type === 'ANALYTICS_APP_URL') {
    apiBase().then((url) => sendResponse({ url }));
    return true;
  }

  if (message.type === 'ANALYTICS_ACCOUNT') {
    currentAccount().then(sendResponse);
    return true;
  }

  return false;
});
