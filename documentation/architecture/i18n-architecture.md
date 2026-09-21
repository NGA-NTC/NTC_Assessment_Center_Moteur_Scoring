---
id: ARCH-I18N-TARGET-001
title: Architecture i18n — Cible
category: architecture
status: designed
version: 1.0.0
created_at: 2026-09-18
updated_at: 2026-09-18
source_of_truth: true
tags:
  - i18n
  - internationalization
  - fr
  - en
  - architecture-cible
---

# Architecture i18n — Cible

## 1. Décision de langues

| Langue | Code | Statut |
|--------|------|--------|
| Français | `fr` | Langue principale (défaut) |
| Anglais | `en` | Toutes les chaînes UI externalisées |
| Malgache | `mg` | **Non maintenant** — pourra être ajouté ultérieurement |

> **`en` n'est pas un substitut de `mg`.** Le malgache est un ajout futur indépendant.
> Aujourd'hui, aucun système d'internationalisation n'existe dans le code : 100 % des textes sont en français littéral (préfixe réel de cette refactorisation).

## 2. Structure cible

```
src/i18n/
├── locales/
│   ├── fr/
│   │   ├── common.json
│   │   ├── navigation.json
│   │   ├── pages.json
│   │   ├── accessControl.json
│   │   ├── accounts.json
│   │   ├── roles.json
│   │   ├── errors.json
│   │   └── ...
│   └── en/
│       ├── common.json
│       ├── navigation.json
│       ├── pages.json
│       └── ...
├── config.js     # langues supportées, langue par défaut, suffixe document.title
└── index.js      # instance i18n, export du helper t(), hook useI18n / useTranslation
```

## 3. Namespaces / domaines

Regrouper les clés par domaine métier (éviter un fichier géant `total.json`) :

```
common          navigation        pages            errors
accessControl   accounts          roles            results
assessment      test              profile          administration
```

Convention de clés (exemples) :
- `navigation.sections.administration`
- `pages.accessControl.title`, `pages.accessControl.subtitle`
- `common.actions.save`, `common.actions.cancel`
- `errors.auth.invalidCredentials`

## 4. Système de titre de page (lié à PageTitle et routing)

```
route.titleKey = "pages.accessControl.title"
      │
      ▼
i18n.t("pages.accessControl.title")     → "Gestion des accès"
      ▼
PageTitle (titleKey résolue)
      ▼
document.title = "Gestion des accès | NTC Assessment Center"
```

- Chaque route fournit un `titleKey` (voir `routing-architecture.md`).
- `document.title` reçoit le **suffixe global** `" | NTC Assessment Center"` (configurable dans `i18n/config.js`).
- Le titre change dynamiquement par page **et par langue** (le hook de route du composant `PageTitle`/layout écoute la langue).
- Les pages **ne contiennent plus de chaînes affichées en dur**.

## 5. Règles

- **Externaliser** tous les textes UI (labels, boutons, titres, messages d'erreur, placeholders, tooltips, aria-labels).
- **NE PAS externaliser** les données backend dynamiques (noms de batteries, contenu d'évaluation, textes des 197 items, métiers) : ces données seront migrées vers Supabase et de l'ordre du contenu, pas de l'interface.
  À terme, les batteries pourront porter leur propre i18n côté backend (à documenter lors de la migration des batteries).
- **Ne pas dupliquer** les clés : un même libellé partagé vit dans `common`, pas dans chaque namespace.
- Éviter l'interpolation abusive ; préférer des clés avec paramètres (ex. `accounts.count = "{count} comptes"` → `t("accounts.count", { count })`).

## 6. Mise en œuvre (phase de refactorisation)

- Objectif : le **faire tôt dans la refactorisation** de façon incrémentale (par page) pour ne pas re-traduire deux fois.
- Point d'entrée : donner à `AppProviders`/`main` un `I18nProvider`.
- La valeur affichée des rôles (`ROLE_LABELS`…) devient des clés i18n (les slugs techniques restent des constantes, voir `frontend-architecture.md` §3).

---

*Dernière mise à jour : 2026-09-18*