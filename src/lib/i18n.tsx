import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "fr";

const STORAGE_KEY = "reezap-lang";

/**
 * English → French dictionary for the whole interface.
 * Keys are the exact English strings rendered by the app, which lets us
 * translate the live DOM instead of threading a t() call through every file.
 * Strings that are not in the dictionary (user content: listing titles,
 * names, prices) are left untouched.
 */
export const FR: Record<string, string> = {
  // Navigation & shell
  Home: "Accueil",
  Search: "Recherche",
  Post: "Publier",
  Alerts: "Alertes",
  Profile: "Profil",
  Saved: "Enregistrés",
  Settings: "Paramètres",
  Admin: "Admin",
  Premium: "Premium",
  "Post something": "Publier quelque chose",
  "Post a listing": "Publier une annonce",
  "Post a listing — Reezap": "Publier une annonce — Reezap",
  Notifications: "Notifications",
  "Notifications — Reezap": "Notifications — Reezap",

  // Feed
  "What's fresh": "Quoi de neuf",
  "near you": "près de vous",
  "Near me": "Près de moi",
  "Whole region": "Toute la région",
  "Showing your town first": "Votre ville d'abord",
  "South West Region, Cameroon": "Région du Sud-Ouest, Cameroun",
  Filter: "Filtrer",
  "Filter categories": "Filtrer les catégories",
  "Filter by category": "Filtrer par catégorie",
  "All categories": "Toutes les catégories",
  "All towns": "Toutes les villes",
  "Nothing here yet": "Rien pour l'instant",
  "Be the first to post something in this area.":
    "Soyez le premier à publier quelque chose dans cette zone.",
  "Browse the feed": "Parcourir le fil",
  Pinned: "Épinglé",
  "In stock": "Disponible",
  "Sold out today": "Épuisé aujourd'hui",
  Views: "Vues",
  Like: "J'aime",
  Save: "Enregistrer",
  Share: "Partager",
  Expired: "Expirée",

  // Listing
  "Listing — Reezap": "Annonce — Reezap",
  "Loading listing…": "Chargement de l'annonce…",
  "Order on WhatsApp": "Commander sur WhatsApp",
  "WhatsApp clicks": "Clics WhatsApp",
  "This vendor hasn't added a WhatsApp number yet":
    "Ce vendeur n'a pas encore ajouté de numéro WhatsApp",
  "Report listing": "Signaler l'annonce",
  "Report this listing": "Signaler cette annonce",
  "Why are you reporting this?": "Pourquoi signalez-vous cette annonce ?",
  "Send report": "Envoyer le signalement",
  "Could not send report": "Impossible d'envoyer le signalement",
  "Thanks — our team will review this listing.":
    "Merci — notre équipe va examiner cette annonce.",
  Spam: "Spam",
  "Inappropriate content": "Contenu inapproprié",
  "Fake or counterfeit goods": "Produits faux ou contrefaits",
  "Scam or fraud": "Arnaque ou fraude",
  Other: "Autre",
  Details: "Détails",
  "Delete listing": "Supprimer l'annonce",
  "Listing deleted": "Annonce supprimée",
  "Could not delete this listing": "Impossible de supprimer cette annonce",
  "Repost listing": "Republier l'annonce",
  "Reposted — it's live again.": "Republiée — elle est de nouveau en ligne.",
  "Could not repost this listing": "Impossible de republier cette annonce",

  // Post form
  "What are you selling?": "Que vendez-vous ?",
  "Add photo": "Ajouter une photo",
  "Remove photo": "Retirer la photo",
  "Add at least one photo of what you're selling":
    "Ajoutez au moins une photo de ce que vous vendez",
  "Could not upload photo": "Impossible de téléverser la photo",
  "Price (FCFA)": "Prix (FCFA)",
  Category: "Catégorie",
  Town: "Ville",
  Neighborhood: "Quartier",
  Choose: "Choisir",
  "Quantity, quality, pickup or delivery…": "Quantité, qualité, retrait ou livraison…",
  "Posted! It stays live for 48 hours.": "Publié ! Visible pendant 48 heures.",
  "That post looks like spam. Please describe a real product or service.":
    "Cette publication ressemble à du spam. Décrivez un vrai produit ou service.",

  // Profile
  "Your Reezap profile": "Votre profil Reezap",
  "Your dashboard": "Votre tableau de bord",
  "View public profile": "Voir le profil public",
  "Loading profile…": "Chargement du profil…",
  "Loading your profile…": "Chargement de votre profil…",
  "You haven't posted yet": "Vous n'avez encore rien publié",
  Listings: "Annonces",
  Followers: "Abonnés",
  Ratings: "Avis",
  "Saved listings": "Annonces enregistrées",
  "Saved listings — Reezap": "Annonces enregistrées — Reezap",
  "No saved listings yet": "Aucune annonce enregistrée",
  "Tap the bookmark icon on any listing to keep it here.":
    "Touchez l'icône signet d'une annonce pour la garder ici.",
  "How was the experience?": "Comment s'est passée l'expérience ?",
  "Submit rating": "Envoyer l'avis",
  "Thanks for rating this vendor": "Merci d'avoir noté ce vendeur",
  "Could not save your rating": "Impossible d'enregistrer votre avis",
  "No ratings yet for this vendor": "Aucun avis pour ce vendeur",
  "No ratings yet for this vendor.": "Aucun avis pour ce vendeur.",
  Follow: "Suivre",
  Following: "Abonné",
  Vendors: "Vendeurs",
  "No vendors match that search.": "Aucun vendeur ne correspond à cette recherche.",
  "No listings match that search.": "Aucune annonce ne correspond à cette recherche.",
  "Search fish, braids, phone repair…": "Cherchez poisson, tresses, réparation…",
  "Search vendors and listings — Reezap": "Rechercher vendeurs et annonces — Reezap",

  // Edit profile
  "Edit profile": "Modifier le profil",
  "Edit your Reezap profile": "Modifier votre profil Reezap",
  "Display name": "Nom affiché",
  Username: "Nom d'utilisateur",
  Bio: "Bio",
  "Profile photo": "Photo de profil",
  "Photo updated": "Photo mise à jour",
  "Profile updated": "Profil mis à jour",
  "Back to your profile": "Retour à votre profil",
  "Could not save your changes": "Impossible d'enregistrer vos modifications",
  "That username is already taken": "Ce nom d'utilisateur est déjà pris",
  "That username is taken": "Ce nom d'utilisateur est pris",
  "Username must be 3–20 letters, numbers or underscores":
    "Le nom d'utilisateur doit contenir 3 à 20 lettres, chiffres ou tirets bas",
  "Usernames use 3–20 lowercase letters, numbers or underscores":
    "Les noms d'utilisateur utilisent 3 à 20 lettres minuscules, chiffres ou tirets bas",
  "WhatsApp number": "Numéro WhatsApp",
  "Add a valid WhatsApp number so buyers can reach you":
    "Ajoutez un numéro WhatsApp valide pour que les acheteurs vous joignent",
  "Buyers reach you here — we save it as +237 and never show it publicly.":
    "Les acheteurs vous joignent ici — enregistré en +237 et jamais affiché publiquement.",
  "Enter a valid Cameroon WhatsApp number, e.g. 6 70 00 00 00":
    "Entrez un numéro WhatsApp camerounais valide, ex. 6 70 00 00 00",

  // Verification
  Verification: "Vérification",
  Verifications: "Vérifications",
  "Get verified": "Se faire vérifier",
  "Full name on ID": "Nom complet sur la pièce d'identité",
  "Add your full name and a photo of your ID":
    "Ajoutez votre nom complet et une photo de votre pièce d'identité",
  "Submit for verification": "Envoyer pour vérification",
  "Submitted — our team reviews IDs within a few days.":
    "Envoyé — notre équipe examine les pièces sous quelques jours.",
  "Could not submit your verification request":
    "Impossible d'envoyer votre demande de vérification",
  "Your request is under review. We'll notify you once it's decided.":
    "Votre demande est en cours d'examen. Nous vous préviendrons dès la décision.",
  "Your account is verified.": "Votre compte est vérifié.",
  "Loading ID document…": "Chargement du document…",
  "No pending verification requests.": "Aucune demande de vérification en attente.",
  Approve: "Approuver",
  Reject: "Rejeter",
  Reports: "Signalements",
  "No open reports.": "Aucun signalement ouvert.",
  "Mark resolved": "Marquer comme résolu",
  "Report resolved": "Signalement résolu",
  "Admin review — Reezap": "Modération — Reezap",

  // Notifications
  "Mark all read": "Tout marquer comme lu",
  "Delete notification": "Supprimer la notification",
  "Could not delete this notification": "Impossible de supprimer cette notification",
  "Nothing yet": "Rien pour l'instant",
  "Follow vendors and you'll hear when they post something new.":
    "Suivez des vendeurs et soyez averti dès qu'ils publient.",

  // Auth
  "Sign in to Reezap": "Se connecter à Reezap",
  "Sign in": "Se connecter",
  "Sign up": "S'inscrire",
  "Sign out": "Se déconnecter",
  Email: "E-mail",
  Password: "Mot de passe",
  "Continue with Google": "Continuer avec Google",
  "Continue browsing without an account": "Continuer sans compte",
  "Could not sign in with Google": "Connexion Google impossible",
  "Account created — welcome to Reezap!": "Compte créé — bienvenue sur Reezap !",
  "Please accept the terms to continue": "Veuillez accepter les conditions pour continuer",
  "Discover vendors near you and order on WhatsApp.":
    "Découvrez les vendeurs près de chez vous et commandez sur WhatsApp.",

  // Settings
  "Settings — Reezap": "Paramètres — Reezap",
  Preferences: "Préférences",
  Language: "Langue",
  English: "Anglais",
  "Français": "Français",
  "New follower alerts": "Alertes de nouveaux abonnés",
  "Get notified when someone follows you.":
    "Soyez averti quand quelqu'un s'abonne à vous.",
  "Like alerts": "Alertes de j'aime",
  "Know when someone likes one of your listings.":
    "Sachez quand quelqu'un aime une de vos annonces.",
  "Moderation updates": "Mises à jour de modération",
  "Verification decisions and report outcomes.":
    "Décisions de vérification et suites des signalements.",
  "Could not save your preference": "Impossible d'enregistrer votre préférence",
  "Privacy & safety": "Confidentialité et sécurité",
  "Privacy policy": "Politique de confidentialité",
  "Community rules": "Règles de la communauté",
  Support: "Assistance",
  "Chat with support on WhatsApp": "Discuter avec l'assistance sur WhatsApp",
  Account: "Compte",
  "Change password": "Changer le mot de passe",
  "We'll email you a secure reset link.":
    "Nous vous enverrons un lien de réinitialisation sécurisé.",
  "Password reset link sent": "Lien de réinitialisation envoyé",
  "Could not send the reset link": "Impossible d'envoyer le lien",
  "Blocked accounts": "Comptes bloqués",
  "You haven't blocked anyone.": "Vous n'avez bloqué personne.",
  Unblock: "Débloquer",
  "Sign out everywhere": "Se déconnecter partout",
  "Ends your session on every device.": "Termine votre session sur tous les appareils.",
  "Share Reezap": "Partager Reezap",
  "Invite a vendor or a friend to the app.": "Invitez un vendeur ou un ami sur l'app.",
  "Link copied": "Lien copié",
  "About": "À propos",
  "App version": "Version de l'app",
  "Delete my account": "Supprimer mon compte",
  "Our team removes your account and listings within 48 hours.":
    "Notre équipe supprime votre compte et vos annonces sous 48 heures.",
  "Request account deletion": "Demander la suppression du compte",
  "Go premium": "Passer en premium",
  "Manage premium": "Gérer le premium",
  "Premium is active": "Premium actif",
  "Activate on WhatsApp": "Activer sur WhatsApp",
  "Reezap Premium": "Reezap Premium",
  "For vendors who sell every day and want their goods seen first.":
    "Pour les vendeurs qui vendent chaque jour et veulent être vus en premier.",

  // Errors
  "Page not found": "Page introuvable",
  "The page you're looking for doesn't exist or has been moved.":
    "La page que vous cherchez n'existe pas ou a été déplacée.",
  "This page didn't load": "Cette page n'a pas pu se charger",
  "Try again": "Réessayer",
  "Go home": "Retour à l'accueil",
  Back: "Retour",

  // Time helpers
  "just now": "à l'instant",
  "Ask price": "Prix sur demande",
};

const LOWER = new Map<string, string>(
  Object.entries(FR).map(([k, v]) => [k.toLowerCase(), v]),
);

function lookup(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  const direct = FR[trimmed];
  if (direct) return direct;
  const lower = LOWER.get(trimmed.toLowerCase());
  return lower ?? null;
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "TEXTAREA"]);

function translateTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) return;
  if (parent.closest("[data-no-translate]")) return;
  const original = node.nodeValue ?? "";
  const translated = lookup(original);
  if (!translated) return;
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  const next = `${leading}${translated}${trailing}`;
  if (node.nodeValue !== next) node.nodeValue = next;
}

const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

function translateElementAttrs(el: Element) {
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const translated = lookup(value);
    if (translated && translated !== value) el.setAttribute(attr, translated);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element) && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root instanceof Element) translateElementAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text);
    else translateElementAttrs(current as Element);
    current = walker.nextNode();
  }
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (en: string) => string };

const LanguageContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (en) => en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read the stored choice after hydration so SSR markup stays stable.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang !== "fr") return;

    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") translateTextNode(m.target as Text);
        else m.addedNodes.forEach((n) => translateTree(n));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [lang]);

  function setLang(next: Lang) {
    window.localStorage.setItem(STORAGE_KEY, next);
    if (next === lang) return;
    setLangState(next);
    // Switching back to English needs a clean re-render of the original copy.
    if (next === "en") window.location.reload();
  }

  return (
    <LanguageContext.Provider
      value={{ lang, setLang, t: (en) => (lang === "fr" ? (lookup(en) ?? en) : en) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
