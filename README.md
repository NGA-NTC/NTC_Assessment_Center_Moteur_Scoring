# NTC Assessment Center — Moteur de scoring

Application web (SPA) d'**évaluation de type assessment center** dédiée au secteur de la formation professionnelle. Les candidats passent un dispositif de **8 batteries** (questions, cas et simulations), et les responsables RH/fonctionnels disposent d'un **espace administrateur** pour consulter les résultats, importer des réponses externes et gérer l'autonomie des candidats.

Interface 100 % en français. Stack : **Vite + React 19 + JavaScript (JSX)** avec `pnpm`.

---

## Fonctionnalités

### Côté candidat
- **Inscription / connexion** par email + mot de passe (`/inscription`, `/connexion`).
- Passage du test en **8 batteries**, une à la fois, avec suivi de progression dans la barre latérale.
- **Sauvegarde automatique** des réponses sur le compte (debounce 400 ms) : le candidat peut quitter puis reprendre plus tard.
- Retour au test possible à tout moment tant que la session est active.
- Les candidats **n'ont aucun accès aux résultats** (réservés à l'administrateur).

### Côté administrateur (`/login` → `/admin`)
- Identifiants définis localement via `.env` (voir ci-dessous).
- **Liste des candidats** dans la barre latérale et dans la page, avec deux vues : **liste** ou **cartes**.
- **Recherche et filtres indépendants** :
  - par **type de réponse** : comptes créés sur la plateforme vs réponses **importées** ;
  - par **progression** : réponses **complètes** vs **incomplètes** ;
  - la recherche/filtres de la sidebar n'affectent pas ceux de la page (et inversement).
- **Import JSON** par un bouton (sélecteur de fichier) de résultats externes, stockés localement.
- **Détail d'un candidat** :
  - résultats complets : **radar 8 axes**, correspondance aux **5 métiers**, forces, points de vigilance, **cohérence comportementale** ;
  - relecture des réponses **en mode test** (lecture seule, format identique à l'épreuve) ;
  - **création d'un compte** pour un candidat importé (email + mot de passe) afin qu'il puisse se connecter ultérieurement — ses réponses sont alors rattachées au compte.

---

## Contenu du dispositif

| Batterie | Nom | Axe | Type | Nb items |
|---|---|---|---|---|
| B1 | Profil cognitif | Cognitif | QCM à réponse correcte (3 réponses libres) | 32 |
| B2 | Valeurs profondes | Valeurs | QCM pondéré | 28 |
| B3 | Style de décision | Décision | QCM pondéré | 30 |
| B4 | Leadership naturel | Leadership | QCM pondéré | 28 |
| B5 | Intelligence sociale | Social | QCM pondéré | 32 |
| B6 | Stress et pression | Résilience | QCM pondéré | 28 |
| B7 | Vision stratégique | Stratégie | Cas + grille d'évaluation 5 dimensions (1–4) | 9 |
| B8 | Simulations intégrées | Cohérence | Simulations + intensité observée (léger / modéré / fort) | 10 |

**Total : 197 items.**

### Modèle de score
- **44 dimensions** réparties sur **8 axes** (Cognitif, Valeurs, Décision, Leadership, Social, Résilience, Stratégie + **Cohérence**).
- B1 : score sur le nombre de bonnes réponses par dimension.
- B2–B6 : items pondérés, normalisés sur les bornes min/max possibles (0–100).
- B7 : moyenne des notes par dimension (1→0, 4→100) ; la dimension Vision systémique (VS) est **croisée** entre B1 et B7 (moyenne des deux).
- B8 : l'écart entre le profil déclaré et l'intensité observée en simulation est converti en **score de cohérence comportementale** (100 − écart moyen).
- **5 métiers benchmark** avec pondération raisonnée : Leader communautaire, Mentor, Formateur, Lobbyiste, Dirigeant politique.
- Lecture de profil : **forces** (top 5) et **points de vigilance** (dernières dimensions, hors neutres).

> Le modèle de pondération des métiers est **indicatif et raisonné**, non validé statistiquement (mentionné dans l'interface).

---

## Routes

| URL | Accès | Description |
|---|---|---|
| `/` | public | Redirige vers `/connexion` |
| `/connexion` | public | Connexion candidat |
| `/inscription` | public | Création de compte candidat |
| `/login` | admin | Connexion administrateur |
| `/test` | candidat connecté | Passage de l'évaluation (guard `UserRoute`) |
| `/admin` | admin connecté | Résultats et gestion (guard `ProtectedRoute`) |
| `*` | — | Redirige vers `/connexion` |

---

## Configuration

### Authentification administrateur
Les identifiants admin sont lus depuis un fichier `.env` (préfixe `VITE_` requis par Vite) :

```env
# .env  (ne pas commit : déjà ignoré via .gitignore)
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=change-me
```

Copiez `.env.example` en `.env` et adaptez les valeurs.

### Candidats
Comptes **email + mot de passe** créés localement (email valide, mot de passe ≥ 4 caractères). Un email ne peut être enregistré qu'une seule fois.

---

## Stockage des données

La persistance est gérée par `src/lib/storage.js`, qui utilise `window.storage` (si disponible, ex. contexte Electron) et retombe sur **`localStorage`**.

| Clé | Contenu |
|---|---|
| `ntc_users` | Comptes candidats (email, mot de passe, `responses: {mcq, b7, b8}`, horodatages) |
| `ntc_imported` | Réponses importées via le bouton « Importer un JSON » (avec lien éventuel compte ↔ import) |
| `ntc_auth` (session) | Session administrateur |
| `ntc_user_session` (session) | Session candidat |

> **Aucune donnée n'est envoyée à un serveur.** L'application fonctionne entièrement dans le navigateur.

## Import de résultats

Deux voies d'import côté admin :

1. **Import statique** : poser un fichier `.json` dans `src/reponses/` — chargé au build par `import.meta.glob` (fichiers exemples fournis : `example-candidat.json`, `andrianina.json`).
2. **Import dynamique** : bouton « Importer un JSON » dans la page admin — le fichier est parsé et stocké dans `ntc_imported`.

Formats acceptés (objet unique ou tableau) :
- `{ responses: { mcq, b7, b8 } }`
- réponse brute `{ mcq, b7, b8 }`
- métadonnées optionnelles : `{ label }`, `{ name }`, `{ email }` (pour l'affichage et la création de compte).

Structure attendue des réponses :

```json
{
  "mcq": { "Q1": "B", "Q16": "Réponse libre…" },
  "b7": { "C1": { "text": "…", "NST": 4, "PRO": 3, "PRI": 4, "GCH": 3, "VS": 3 } },
  "b8": { "M1": { "text": "…", "LDD": "fort", "GCH": "modere" } }
}
```

---

## Stack technique

- **Vite** ^8.2.2 + **@vitejs/plugin-react** ^6.1.0
- **React** ^19.2.8, **react-dom** ^19.2.8
- **react-router-dom** ^7.18.3 (routing + guards)
- **recharts** ^3.10.1 (radar)
- **lucide-react** ^1.41.0 (icônes)
- ESLint ^10.9.0 (eslint-plugin-react-hooks, eslint-plugin-react-refresh)
- Polices : Fraunces (titres) + IBM Plex Sans (texte) via Google Fonts
- Design system maison : `src/lib/theme.js` (palette NAVY / GOLD / CREAM…), composants `ui/`, `layout/`, `question/`

---

## Structure du projet

```
.
├─ index.html
├─ package.json / pnpm-lock.yaml / vite.config.js / eslint.config.js
├─ .env.example
├─ public/                    # favicon.svg, icons.svg
├─ src/
│  ├─ main.jsx · index.css
│  ├─ routes/                 # routes + guards (ProtectedRoute, UserRoute)
│  ├─ context/                # AuthContext (admin), UserAuthContext (candidat)
│  ├─ data/                   # batteries B1–B8, dimensions, axes, métiers
│  ├─ lib/
│  │  ├─ storage.js           # comptes, imports, persistance window.storage/localStorage
│  │  ├─ imported.js          # import statique src/reponses/*.json
│  │  ├─ scoring.js           # moteur de scoring (dims, cohérence, axes, rôles, rapport)
│  │  └─ theme.js             # palette et typographies
│  ├─ pages/                  # Login, Register, UserLogin, TestApp, AdminResultats, ResultsView
│  ├─ components/
│  │  ├─ layout/              # AppShell, Sidebar, AdminSidebar, AuthShell, …
│  │  ├─ ui/                  # Button, Field, Badge, SearchField, FilterDropdown, …
│  │  └─ question/            # McqBattery, RubricBattery, CoherenceBattery, ResponsesReview, …
│  └─ reponses/               # exemples de réponses importables (.json)
```

---

## Démarrage

Prérequis : **Node.js** et **pnpm**.

```bash
pnpm install        # installer les dépendances
cp .env.example .env # (ou copie manuelle) + adapter les identifiants admin
pnpm run dev        # serveur de développement
```

Commandes utiles :

| Script | Description |
|---|---|
| `pnpm run dev` | Serveur de développement (HMR) |
| `pnpm run build` | Build de production dans `dist/` |
| `pnpm run preview` | Prévisualiser le build de production |
| `pnpm run lint` | ESLint sur tout le projet |

---

## Limites et remarques

- Application **100 % côté client** : l'authentification admin est réalisée dans le bundle, les comptes candidats et leurs mots de passe sont stockés en clair au niveau du navigateur. Ce choix convient **à un prototype / usage local**, pas à un déploiement public sans backend.
- Le modèle de pondération des 5 métiers est raisonné et **non validé statistiquement**.
- Au build, un avertissement « chunk > 500 kB » (dû à `recharts`) est attendu et sans impact fonctionnel.