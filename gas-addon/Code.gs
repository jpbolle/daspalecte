/**
 * Daspalecte — Add-on Google Apps Script (Docs / Sheets / Slides)
 *
 * Point d'entree serveur : menu + sidebar, relais vers le Cloud Function existant
 * (meme backend que l'extension Chrome, aucune modification cote serveur), lecture
 * de la selection par application, traduction, vocabulaire persistant.
 * L'extraction du texte ENTIER du document (pas juste la selection) sera ajoutee
 * a l'etape 7/8 du plan (test de lecture), possiblement dans un fichier separe.
 */

const CLOUD_FUNCTION_URL = 'https://daspalecte-1086562672385.europe-west1.run.app';

// URL du deploiement "Application Web" actif (Deployer > Gerer les deploiements > Application
// Web dans l'editeur Apps Script). En dur plutot que resolue via ScriptApp.getService().getUrl()
// : ce dernier s'est avere renvoyer l'URL d'un deploiement Web App OBSOLETE/different (confirme
// en test reel — ID de deploiement different de celui affiche dans "Gerer les deploiements")
// quand il est appele depuis un contexte d'add-on (sidebar/dialogue) plutot que depuis
// l'execution du web app lui-meme — resolution ambigue documentee de cette API dans ce contexte.
// A mettre a jour manuellement si le projet est un jour redeploye avec une nouvelle URL.
const RECORDING_WEBAPP_URL = 'https://script.google.com/a/macros/cnddinant.be/s/AKfycbxoBDSkYRQSIFoLsBIIFiZXH7i2D5zGryEYxtjqilP6izNPYu1pSSfRAfT876QsgH29Hg/exec';

// Contenu de la page d'enregistrement, en dur ICI plutot que lu depuis Recording.html via
// HtmlService.createHtmlOutputFromFile(...).getContent() : ce pipeline s'est avere corrompre
// le contenu du fichier (constate en test reel — un fragment de code JS avait disparu au
// milieu d'une ligne, "let recognition = null;\n let recording" devenu "let recognition =
// nulcording", en plus de la suppression deja connue des commentaires "//"). Un fichier .gs
// (comme celui-ci) n'est PAS soumis a ce pipeline HTML d'Apps Script — les templates strings
// contenant des "https://..." dans ce meme fichier (CLOUD_FUNCTION_URL, RECORDING_WEBAPP_URL
// ci-dessus) le prouvent, ils survivent intacts en production.
// IMPORTANT : Recording.html (le fichier) reste la source de reference lisible pour editer ce
// gabarit — apres toute modification, recopier son contenu ici a la main, puis clasp push.
// Il n'est plus servi directement (doGet() ci-dessous n'y fait plus reference).
const RECORDING_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Enregistrer ma lecture — Daspalecte</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      background: #faf6f0;
      color: #3d3832;
      padding: 28px 24px;
      text-align: center;
      box-sizing: border-box;
    }

    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.1rem;
      color: #2d6a5a;
      margin: 0 0 10px;
    }

    p {
      font-size: 0.85rem;
      color: #6b6259;
      line-height: 1.5;
    }

    button {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: bold;
      font-size: 0.9rem;
      padding: 12px 20px;
      border-radius: 4px;
      border: none;
      background: linear-gradient(90deg, #2d6a5a, #357a68);
      color: #ffffff;
      cursor: pointer;
      margin-top: 8px;
    }

    button:hover {
      filter: brightness(1.06);
    }

    button.recording {
      background: #b44040;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #rec-status {
      margin-top: 14px;
      font-size: 0.8rem;
      color: #5a534b;
      min-height: 1.4em;
    }
  </style>
</head>
<body>
  <h1>Enregistre ta lecture à voix haute</h1>
  <p>Clique, lis le texte entier à voix haute, puis clique à nouveau pour arrêter.<br>
     Le résultat est renvoyé automatiquement à la fenêtre d'exercices.</p>
  <button id="rec-btn" type="button">🎤 Démarrer l'enregistrement</button>
  <p id="rec-status"></p>

  <script>
    const btn = document.getElementById('rec-btn');
    const status = document.getElementById('rec-status');
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let recording = false;
    let finalTranscript = '';

    if (!Ctor) {
      status.textContent = "La reconnaissance vocale n'est pas disponible sur ce navigateur.";
      btn.disabled = true;
    }

    function storeUrlBase() {
      return window.location.origin + window.location.pathname;
    }

    function reportResult(transcript) {
      fetch(storeUrlBase() + '?action=store&transcript=' + encodeURIComponent(transcript)).catch(() => {});
    }

    function reportError(message) {
      fetch(storeUrlBase() + '?action=store&error=' + encodeURIComponent(message)).catch(() => {});
    }

    btn.onclick = () => {
      if (recording) { if (recognition) recognition.stop(); return; }
      finalTranscript = '';
      recognition = new Ctor();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => { status.textContent = '🎙️ Micro activé — parle maintenant...'; };
      recognition.onaudiostart = () => { status.textContent = '🎙️ Audio capté — parle maintenant...'; };
      recognition.onsoundstart = () => { status.textContent = '🔊 Son détecté...'; };
      recognition.onspeechstart = () => { status.textContent = '🗣️ Parole détectée...'; };
      recognition.onspeechend = () => { status.textContent = '⏳ Traitement de la parole...'; };
      recognition.onnomatch = () => { status.textContent = "⚠️ Son capté mais aucun mot reconnu."; };

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
          else interim += event.results[i][0].transcript;
        }
        if (interim) status.textContent = '✍️ ' + interim;
      };

      recognition.onerror = (event) => {
        const message = event.error === 'not-allowed'
          ? "Micro refusé — autorise l'accès au micro pour utiliser cette fonction."
          : 'Erreur de reconnaissance vocale (' + event.error + '), réessaie.';
        status.textContent = message;
        reportError(message);
      };

      recognition.onend = () => {
        recording = false;
        btn.classList.remove('recording');
        btn.textContent = "🎤 Démarrer l'enregistrement";
        if (finalTranscript.trim()) {
          status.textContent = 'Terminé — tu peux fermer cette fenêtre.';
          reportResult(finalTranscript.trim());
        } else {
          status.textContent = "Rien n'a été reconnu, réessaie.";
        }
      };

      recording = true;
      btn.classList.add('recording');
      btn.textContent = "⏹ Arrêter l'enregistrement";
      status.textContent = 'Démarrage du micro...';
      recognition.start();
    };
  </script>
</body>
</html>`;

/**
 * Declencheur simple : appele automatiquement a l'ouverture du document, quel que
 * soit l'hote actif (Docs, Sheets, Slides). Ajoute l'entree de menu qui ouvre la sidebar.
 */
function onOpen(e) {
  const ui = getActiveUi_();
  if (!ui) return;
  ui.createAddonMenu()
    .addItem('Ouvrir Daspalecte', 'showSidebar')
    .addToUi();
}

/**
 * Affiche la sidebar HTML dans l'application active.
 * Peut être appelée depuis le menu classique (onOpen) ou depuis le bouton de la
 * carte d'accueil (onHomepage) — les deux mènent à la même sidebar.
 */
function showSidebar() {
  const ui = getActiveUi_();
  if (!ui) return;
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Daspalecte');
  ui.showSidebar(html);
}

/**
 * Carte d'accueil du panneau add-on (nouveau modèle unifié "Google Workspace
 * Add-on") : requise par Google dès que le manifeste déclare un hôte (docs/sheets/
 * slides), sinon le panneau affiche "Aucune fiche de page d'accueil n'est fournie".
 * Un simple bouton qui ouvre notre vraie sidebar HTML (Sidebar.html).
 */
function onHomepage(e) {
  const button = CardService.newTextButton()
    .setText('Ouvrir Daspalecte')
    .setOnClickAction(CardService.newAction().setFunctionName('showSidebar'));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Daspalecte'))
    .addSection(CardService.newCardSection().addWidget(button))
    .build();
}

const EXERCISE_WORDS_CACHE_KEY = 'daspalecte_exercise_words';

/**
 * Taille des dialogues modaux (exercices et test de lecture).
 *
 * Volontairement plus grande que l'ecran d'un Chromebook : Google borne la taille reelle a
 * celle de la fenetre, on obtient donc un dialogue quasi plein ecran quel que soit l'appareil.
 * C'est le seul levier disponible pour masquer l'arriere-plan — le fond semi-transparent que
 * Google place derriere ses dialogues n'est pas stylable depuis notre iframe (origine
 * differente), et le document comme la liste de vocabulaire de la barre laterale contiennent
 * les REPONSES aux exercices en cours. Le corps du dialogue est opaque et centre (voir le
 * `body` de ExercisesDialog.html / ReadingTest.html), il couvre donc tout ce qui est derriere.
 */
const DIALOG_WIDTH = 1600;
const DIALOG_HEIGHT = 1100;

/**
 * Ouvre les exercices dans un dialogue Apps Script separe (ui.showModalDialog), plus
 * grand et fermable independamment de la sidebar — celle-ci est trop etroite pour
 * l'appariement/les etiquettes/etc. (retour utilisateur direct).
 *
 * Les exercices portent sur les mots COCHES dans la sidebar, pas sur tout le vocabulaire
 * (meme regle que l'extension, sidepanel.js:gen-exercises). Un dialogue modal ne peut pas
 * lire le DOM de la sidebar : la selection transite donc par CacheService, comme le texte
 * du test de lecture (voir startReadingTest plus bas).
 */
function startExercises(words) {
  const list = (words || []).filter(function (word) { return !!word; });
  if (!list.length) return { ok: false, reason: 'no_words' };

  CacheService.getUserCache().put(EXERCISE_WORDS_CACHE_KEY, JSON.stringify(list), 300);

  const ui = getActiveUi_();
  if (!ui) return { ok: false, reason: 'unsupported_host' };

  const html = HtmlService.createHtmlOutputFromFile('ExercisesDialog')
    .setWidth(DIALOG_WIDTH)
    .setHeight(DIALOG_HEIGHT);
  ui.showModalDialog(html, 'Exercices — Daspalecte');
  return { ok: true, reason: '' };
}

/**
 * Lu une seule fois par le dialogue au chargement (consomme au passage : une nouvelle
 * serie d'exercices doit repartir d'une nouvelle selection, jamais d'un reste de cache).
 * Renvoie [] si le cache a expire — le dialogue retombe alors sur tout le vocabulaire.
 */
function consumeExerciseWords() {
  const cache = CacheService.getUserCache();
  const raw = cache.get(EXERCISE_WORDS_CACHE_KEY);
  cache.remove(EXERCISE_WORDS_CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Point d'entree du deploiement "Application Web" de ce projet (Deploy > Gerer les
 * deploiements > Application Web dans l'editeur Apps Script). Sert Recording.html :
 * SpeechRecognition/getUserMedia refusent de fonctionner sans contexte securise, or une URL
 * blob: generee depuis la sidebar/le dialogue s'est averee ne pas en etre un aux yeux de
 * Chrome (confirme en test reel : icone "connexion non securisee", micro bloque
 * silencieusement). Une vraie URL https://script.google.com/... de premier niveau resout ce
 * probleme — voir getRecordingPageUrl() ci-dessous et ExercisesDialog.html:openReadingRecordingWindow().
 *
 * Sert le HTML via ContentService a partir de la constante RECORDING_PAGE_HTML (definie plus
 * haut dans ce fichier), PAS via HtmlService.createHtmlOutputFromFile('Recording') : ce dernier
 * s'est avere a la fois (a) couper l'acces microphone silencieusement — teste en isolation
 * totale (page Google normale, meme extrait de code, meme micro), la reconnaissance vocale
 * fonctionnait parfaitement, seule notre page servie via HtmlService echouait — et (b)
 * carrement corrompre le contenu du fichier au passage (voir le commentaire sur
 * RECORDING_PAGE_HTML). ContentService n'a aucun de ces deux problemes : pas de bac a
 * sable/Permissions-Policy, pas de pipeline de traitement du HTML, pas de bibliotheque cliente
 * google.script.run auto-injectee (source du bruit "dropping postMessage" observe precedemment).
 *
 * Gere aussi ?action=store&transcript=...|error=... : la page rapporte son resultat via un
 * simple fetch() sur cette meme URL (voir storeRecordingResult()/storeRecordingError()).
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === 'store') {
    if (params.transcript !== undefined) {
      storeRecordingResult(params.transcript);
    } else if (params.error !== undefined) {
      storeRecordingError(params.error);
    }
    return ContentService.createTextOutput('OK');
  }
  // ContentService.createTextOutput(...).setMimeType(HTML) ne s'est PAS avere rendu comme une
  // page web dans ce deploiement restreint au domaine (DOMAIN access) : la page s'affichait en
  // texte brut, balises visibles, meme apres redeploiement — constate en test reel. Retour a
  // HtmlService (qui, lui, rend correctement le HTML) mais en lui passant directement la chaine
  // RECORDING_PAGE_HTML deja verifiee intacte, plutot que de lire le fichier Recording.html via
  // createHtmlOutputFromFile() (source de la corruption de contenu decouverte precedemment).
  return HtmlService.createHtmlOutput(RECORDING_PAGE_HTML)
    .setTitle('Enregistrer ma lecture — Daspalecte');
}

/**
 * URL de la fenetre d'enregistrement — appelee par ExercisesDialog.html au chargement.
 * Pointe vers la page hebergee sur le Cloud Function (Cloud Run), PAS vers le deploiement
 * Apps Script Web App : toute page servie par HtmlService est enveloppee par Google dans un
 * iframe sandboxe sans permission micro (SpeechRecognition echoue silencieusement — confirme
 * en test reel, alors que le meme code fonctionne sur une page normale), et ContentService ne
 * rend pas de page HTML sur un deploiement restreint au domaine (texte brut — confirme aussi).
 * Le parametre "store" transmet a la page l'URL du deploiement Web App (RECORDING_WEBAPP_URL),
 * qu'elle appelle en fetch pour deposer le resultat dans CacheService (doGet ?action=store),
 * relu ensuite par le polling du dialogue (pollRecordingResult()).
 */
function getRecordingPageUrl() {
  return CLOUD_FUNCTION_URL + '?page=recording&store=' + encodeURIComponent(RECORDING_WEBAPP_URL);
}

// Cle CacheService utilisee pour relayer le resultat de l'enregistrement entre
// Recording.html et ExercisesDialog.html — voir storeRecordingResult_()/pollRecordingResult()
// ci-dessous pour le pourquoi (postMessage entre les deux ne fonctionne pas).
const RECORDING_RESULT_CACHE_KEY = 'daspalecte_recording_result';

/**
 * Enregistre le resultat (texte reconnu) cote serveur, pour que ExercisesDialog.html puisse
 * le recuperer par polling. Necessaire car Recording.html (page du deploiement Web App,
 * origine script.google.com) et ExercisesDialog.html (iframe sandboxee Google, origine
 * *.googleusercontent.com) ne peuvent PAS communiquer par window.opener.postMessage() : Google
 * bloque ces messages en interne au niveau de son infrastructure de dialogue Apps Script
 * ("dropping postMessage.. was from host X but expected host Y", confirme en test reel).
 * google.script.run passe par le canal RPC officiel d'Apps Script, qui lui n'a pas cette
 * restriction. CacheService.getUserCache() scope automatiquement par utilisateur courant.
 */
function storeRecordingResult(transcript) {
  CacheService.getUserCache().put(RECORDING_RESULT_CACHE_KEY, JSON.stringify({ type: 'result', transcript: transcript }), 300);
}

function storeRecordingError(message) {
  CacheService.getUserCache().put(RECORDING_RESULT_CACHE_KEY, JSON.stringify({ type: 'error', message: message }), 300);
}

/**
 * Appelee par ExercisesDialog.html toutes les ~1.5s tant que la fenetre d'enregistrement est
 * ouverte. Renvoie null tant qu'aucun resultat n'est disponible, puis le resultat une seule
 * fois (consomme immediatement — evite de le relire en boucle si le polling continue un peu
 * apres reception).
 */
function pollRecordingResult() {
  const cache = CacheService.getUserCache();
  const raw = cache.get(RECORDING_RESULT_CACHE_KEY);
  if (!raw) return null;
  cache.remove(RECORDING_RESULT_CACHE_KEY);
  return JSON.parse(raw);
}

/**
 * Detecte l'application hote active et renvoie son objet Ui — evite de dupliquer
 * ce test dans chaque fonction qui a besoin d'afficher un menu ou une sidebar.
 */
function getActiveUi_() {
  try { return DocumentApp.getUi(); } catch (e) { /* pas dans Docs */ }
  try { return SpreadsheetApp.getUi(); } catch (e) { /* pas dans Sheets */ }
  try { return SlidesApp.getUi(); } catch (e) { /* pas dans Slides */ }
  return null;
}

/**
 * Relais generique vers le Cloud Function existant (memes actions que l'extension
 * Chrome : summarize, generate_exercises, generate_comprehension_test,
 * verify_tags_answers, verify_sentence, send_score). Appele depuis la sidebar via
 * google.script.run.callCloudFunction(payload).
 */
function callCloudFunction(payload) {
  const response = UrlFetchApp.fetch(CLOUD_FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return JSON.parse(response.getContentText());
}

// ============================================================
// SELECTION — lecture par application (remplace le "clic sur un
// mot de la page" de l'extension, impossible sur ces 3 apps)
// ============================================================

/**
 * Detecte l'application hote active (distinct de getActiveUi_ : ne necessite pas
 * un contexte pouvant afficher un Ui, donc reutilisable partout).
 */
function getActiveHost_() {
  try { DocumentApp.getActiveDocument(); return 'docs'; } catch (e) { /* pas dans Docs */ }
  try { SlidesApp.getActivePresentation(); return 'slides'; } catch (e) { /* pas dans Slides */ }
  try { SpreadsheetApp.getActiveSpreadsheet(); return 'sheets'; } catch (e) { /* pas dans Sheets */ }
  return null;
}

/**
 * Renvoie le texte actuellement selectionne dans l'application active, quelle
 * qu'elle soit — chaine vide si rien n'est selectionne ou si l'extraction echoue.
 */
function getSelectionText() {
  const host = getActiveHost_();
  if (host === 'docs') return getDocSelectionText_();
  if (host === 'slides') return getSlidesSelectionText_();
  if (host === 'sheets') return getSheetsSelectionText_();
  return '';
}

function getDocSelectionText_() {
  const selection = DocumentApp.getActiveDocument().getSelection();
  if (!selection) return '';
  const parts = [];
  selection.getRangeElements().forEach(function (rangeElement) {
    const el = rangeElement.getElement();
    if (el.editAsText) {
      const text = el.asText().getText();
      parts.push(rangeElement.isPartial()
        ? text.substring(rangeElement.getStartOffset(), rangeElement.getEndOffsetInclusive() + 1)
        : text);
    }
  });
  return parts.join(' ').trim();
}

function getSlidesSelectionText_() {
  const selection = SlidesApp.getActivePresentation().getSelection();
  if (!selection) return '';

  // Texte finement selectionne a l'interieur d'une forme
  const textRange = selection.getTextRange();
  if (textRange) return textRange.asString().trim();

  // Sinon, forme(s) entiere(s) selectionnee(s) : on prend tout leur texte
  const pageElementRange = selection.getPageElementRange();
  if (pageElementRange) {
    return pageElementRange.getPageElements()
      .filter(function (pe) { return pe.getPageElementType() === SlidesApp.PageElementType.SHAPE; })
      .map(function (pe) { return pe.asShape().getText().asString(); })
      .join(' ')
      .trim();
  }
  return '';
}

function getSheetsSelectionText_() {
  const range = SpreadsheetApp.getActiveSpreadsheet().getActiveRange();
  if (!range) return '';
  return range.getValues()
    .map(function (row) { return row.join(' '); })
    .join(' ')
    .trim();
}

// ============================================================
// TEXTE SOUMIS AU TEST DE LECTURE — equivalent de content.js:extractPageText(),
// mais le perimetre depend de l'hote (choix pedagogique, pas technique) :
//
//   Docs   : l'eleve SELECTIONNE le passage sur lequel il veut etre interroge.
//            Un document scolaire contient souvent plusieurs textes/consignes ;
//            interroger sur le document entier melangerait tout.
//   Slides : toute la presentation, sans selection — un diaporama forme un tout,
//            et selectionner proprement des formes y est malcommode.
//   Sheets : pas de test de lecture (un tableau n'est pas un texte suivi).
//
// Meme nettoyage et meme troncature a 5000 caracteres que l'extension, pour que le
// prompt generate_comprehension_test recoive le meme genre d'entree.
// ============================================================

const FULL_TEXT_MAX_CHARS = 5000;

/**
 * Expose l'hote actif a la sidebar (getActiveHost_ est prive : le suffixe _ empeche
 * Apps Script de l'exposer a google.script.run). Sert a masquer la section "Test de
 * lecture" dans Sheets, ou la fonctionnalite n'a pas de sens.
 */
function getActiveHost() {
  return getActiveHost_();
}

/**
 * Texte a soumettre au test de lecture. Renvoie un objet plutot qu'une chaine : le
 * dialogue doit pouvoir distinguer "rien selectionne" de "trop court" de "pas dispo
 * ici" pour afficher le bon message a l'eleve.
 * reason : 'unsupported_host' | 'no_selection' | 'too_short' | '' (si ok)
 */
function getReadingTestText() {
  const host = getActiveHost_();

  if (host === 'sheets' || !host) {
    return { ok: false, reason: 'unsupported_host', host: host || '', text: '' };
  }

  const raw = host === 'docs' ? getDocSelectionText_() : getSlidesFullText_();

  if (host === 'docs' && !raw) {
    return { ok: false, reason: 'no_selection', host: host, text: '' };
  }

  let text = raw.replace(/\s+/g, ' ').trim();
  if (text.length > FULL_TEXT_MAX_CHARS) text = text.substring(0, FULL_TEXT_MAX_CHARS);

  // Meme seuil que content.js:handleComprehensionTest() — en dessous, Claude n'a pas
  // de quoi construire 10 questions pertinentes.
  if (text.length < 100) {
    return { ok: false, reason: 'too_short', host: host, text: text };
  }
  return { ok: true, reason: '', host: host, text: text };
}

/**
 * Slides n'a pas de "texte qui coule" : on parcourt chaque diapositive et on
 * concatene le texte de toutes les formes et de tous les tableaux. Les notes de
 * l'orateur sont volontairement ignorees (elles s'adressent au professeur, pas
 * a l'eleve qui lit la presentation).
 */
function getSlidesFullText_() {
  const parts = [];
  SlidesApp.getActivePresentation().getSlides().forEach(function (slide) {
    slide.getShapes().forEach(function (shape) {
      const shapeText = shape.getText().asString().trim();
      if (shapeText) parts.push(shapeText);
    });
    slide.getTables().forEach(function (table) {
      for (let r = 0; r < table.getNumRows(); r++) {
        for (let c = 0; c < table.getNumColumns(); c++) {
          const cellText = table.getCell(r, c).getText().asString().trim();
          if (cellText) parts.push(cellText);
        }
      }
    });
  });
  return parts.join(' ');
}

// ============================================================
// TEST DE LECTURE — etape 8 du plan
//
// Pas d'envoi de score : le flux "Google Apps Script -> Google Sheet" de l'extension
// (content.js:sendScoreToTeacher) est abandonne, une vraie base de donnees le remplacera.
// Le dialogue affiche donc le score a l'eleve sans le persister nulle part. Le jour ou la
// base existera, c'est ici qu'il faudra ajouter la fonction d'envoi (et son entree
// urlFetchWhitelist dans appsscript.json).
// ============================================================

const READING_TEST_TEXT_CACHE_KEY = 'daspalecte_reading_test_text';

/**
 * Point d'entree du test de lecture, appele par le bouton de la sidebar.
 *
 * Le texte est lu ICI, et pas depuis le dialogue : dans Docs il vient de la SELECTION de
 * l'eleve, et rien ne garantit qu'une selection reste lisible depuis un dialogue modal
 * (l'add-on a deja paye assez cher les comportements non documentes d'Apps Script, voir la
 * section "Pieges" d'INIT.md). Au moment de ce clic, en revanche, on est dans le meme
 * contexte que "Traduire la selection", qui fonctionne. Le texte transite ensuite par
 * CacheService — meme mecanisme que le resultat d'enregistrement (storeRecordingResult).
 *
 * En cas de refus (rien de selectionne, texte trop court, hote non supporte), aucun
 * dialogue ne s'ouvre : la raison est renvoyee a la sidebar, qui l'affiche sur place.
 */
function startReadingTest() {
  const result = getReadingTestText();
  if (!result.ok) return result;

  CacheService.getUserCache().put(READING_TEST_TEXT_CACHE_KEY, result.text, 300);

  const ui = getActiveUi_();
  if (!ui) return { ok: false, reason: 'unsupported_host', host: result.host, text: '' };

  // Dialogue modal comme les exercices : la sidebar est trop etroite pour 10 QCM et un
  // appariement en deux colonnes.
  const html = HtmlService.createHtmlOutputFromFile('ReadingTest')
    .setWidth(DIALOG_WIDTH)
    .setHeight(DIALOG_HEIGHT);
  ui.showModalDialog(html, 'Test de lecture — Daspalecte');
  return { ok: true, reason: '', host: result.host, text: '' };
}

/**
 * Lu une seule fois par le dialogue au chargement (consomme au passage : un test relance
 * doit repartir d'une nouvelle lecture de la selection, jamais d'un reste de cache).
 */
function consumeReadingTestText() {
  const cache = CacheService.getUserCache();
  const text = cache.get(READING_TEST_TEXT_CACHE_KEY);
  cache.remove(READING_TEST_TEXT_CACHE_KEY);
  return text || '';
}

// ============================================================
// TRADUCTION
// ============================================================

/**
 * Traduit un texte via l'API Google Translate non officielle — meme endpoint que
 * l'extension Chrome (content.js: translateText()). Appel cote serveur (UrlFetchApp)
 * plutot que fetch() cote sidebar, pour eviter tout risque de blocage CORS depuis
 * l'iframe HtmlService.
 */
function translateText(text, sourceLang, targetLang) {
  if (!text) return '';
  const url = 'https://translate.googleapis.com/translate_a/single'
    + '?client=gtx&sl=' + encodeURIComponent(sourceLang || 'auto')
    + '&tl=' + encodeURIComponent(targetLang || 'en')
    + '&dt=t&q=' + encodeURIComponent(text);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(response.getContentText());
  // La reponse est un tableau imbrique ; le texte traduit est reparti en plusieurs
  // segments qu'il faut recoller : data[0] = [[traduit, original, ...], ...]
  return data[0].map(function (chunk) { return chunk[0]; }).join('');
}

// ============================================================
// PREFERENCES — langue maternelle (equivalent chrome.storage.local.nativeLanguage)
// ============================================================

function getNativeLanguage() {
  return PropertiesService.getUserProperties().getProperty('nativeLanguage') || 'en';
}

function setNativeLanguage(lang) {
  PropertiesService.getUserProperties().setProperty('nativeLanguage', lang);
  return lang;
}

// ============================================================
// VOCABULAIRE — equivalent chrome.storage.local.wordList
// ============================================================

function getVocabulary() {
  const raw = PropertiesService.getUserProperties().getProperty('wordList');
  return raw ? JSON.parse(raw) : [];
}

function addVocabularyWord(word, translation) {
  const list = getVocabulary();
  if (!list.some(function (item) { return item.word === word; })) {
    list.push({ word: word, translation: translation });
    PropertiesService.getUserProperties().setProperty('wordList', JSON.stringify(list));
  }
  return getVocabulary();
}

function removeVocabularyWord(word) {
  const list = getVocabulary().filter(function (item) { return item.word !== word; });
  PropertiesService.getUserProperties().setProperty('wordList', JSON.stringify(list));
  return list;
}

/**
 * Suppression groupee des mots coches dans la sidebar (equivalent du bouton corbeille de
 * sidepanel.js). Un seul aller-retour serveur plutot qu'un par mot.
 */
function removeVocabularyWords(words) {
  const doomed = {};
  (words || []).forEach(function (word) { doomed[word] = true; });
  const list = getVocabulary().filter(function (item) { return !doomed[item.word]; });
  PropertiesService.getUserProperties().setProperty('wordList', JSON.stringify(list));
  return list;
}

// ============================================================
// ETAT DES OUTILS — equivalent chrome.storage.local.translatorEnabled/comprehensionEnabled
// ============================================================

/**
 * Dans l'extension, ces interrupteurs branchent/debranchent l'ecoute des clics dans la page.
 * Ici le modele est "selectionner puis cliquer", donc ils activent/desactivent le bouton
 * d'action de leur section — mais l'etat est persiste de la meme facon, et par defaut a
 * false comme dans l'extension (sidepanel.js:273).
 */
function getToolStates() {
  const props = PropertiesService.getUserProperties();
  return {
    translator: props.getProperty('translatorEnabled') === 'true',
    comprehension: props.getProperty('comprehensionEnabled') === 'true'
  };
}

function setToolEnabled(tool, enabled) {
  const key = tool === 'comprehension' ? 'comprehensionEnabled' : 'translatorEnabled';
  PropertiesService.getUserProperties().setProperty(key, enabled ? 'true' : 'false');
  return getToolStates();
}
