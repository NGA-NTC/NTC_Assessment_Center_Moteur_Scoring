---
id: REF-API-001
title: Référence API / Edge Functions
category: reference
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - api
  - edge-functions
  - supabase
---

# Référence API / Edge Functions

---

## Edge Functions déployées

### `admin-reset-password`

**Endpoint :** `POST https://<project-ref>.supabase.co/functions/v1/admin-reset-password`

**Authentification :** `Authorization: Bearer <access_token>` (token utilisateur)

**Headers :**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body :**
```json
{
  "target_user_id": "uuid"
}
```

**Réponses :**

| Code | Description | Body |
|------|-------------|------|
| 200 | Succès | `{ "ok": true, "message": "Email de réinitialisation envoyé à user@example.com" }` |
| 400 | Paramètre manquant | `{ "error": "target_user_id requis" }` |
| 401 | Non authentifié | `{ "error": "Non autorisé : token manquant" }` |
| 403 | Permission insuffisante | `{ "error": "Permission insuffisante : users.change_role requise" }` |
| 404 | User cible introuvable | `{ "error": "Utilisateur cible introuvable" }` |
| 500 | Erreur serveur | `{ "error": "Erreur interne du serveur" }` |

**Flux interne :**
1. Vérif `Authorization: Bearer <token>`
2. Client Supabase avec token user → `auth.getUser()`
3. RPC `has_permission(user_id, 'users.change_role')` → autorisation
4. Client **service_role** → `auth.admin.generateLink({ type: 'recovery', email, redirectTo })`
4. Retourne lien reset

**Appel frontend :**
```js
const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ target_user_id: userId })
});
const result = await res.json();
```

---

## API Supabase Client (Frontend)

### Authentification

```js
import { supabase } from '../lib/supabaseClient.js';

// Inscription candidat
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
});

// Connexion candidat
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Connexion admin
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: 'password123'
});

// Déconnexion
await supabase.auth.signOut();

// Reset MDP candidat
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`
});

// Mise à jour MDP (user connecté)
await supabase.auth.updateUser({ password: 'newpassword' });

// Session actuelle
const { data: { session } } = await supabase.auth.getSession();

// User connecté
const { data: { user } } = await supabase.auth.getUser();

// Écoute changements auth
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  // event: 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'
});
```

### Database (Tables)

```js
// Select
const { data, error } = await supabase
  .from('table_name')
  .select('col1, col2, related_table(col1, col2)')
  .eq('column', 'value')
  .order('created_at', { ascending: false })
  .limit(10);

// Insert
const { data, error } = await supabase
  .from('table_name')
  .insert({ col1: 'value', col2: 'value' })
  .select();

// Update
const { data, error } = await supabase
  .from('table_name')
  .update({ col1: 'new_value' })
  .eq('id', 'uuid')
  .select();

// Delete
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', 'uuid');

// Upsert
const { data, error } = await supabase
  .from('table_name')
  .upsert({ id: 'uuid', col1: 'value' }, { onConflict: 'id' })
  .select();

// RPC
const { data, error } = await supabase.rpc('function_name', { param: 'value' });
```

### Storage (non utilisé actuellement)

```js
// Upload
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload('path/file.pdf', file);

// Download
const { data, error } = await supabase.storage
  .from('bucket-name')
  .download('path/file.pdf');

// Public URL
const { data } = supabase.storage
  .from('bucket-name')
  .getPublicUrl('path/file.pdf');
```

### Realtime (non utilisé)

```js
const channel = supabase
  .channel('channel-name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' }, payload => {
    console.log('Change:', payload);
  })
  .subscribe();
```

---

## Variables d'environnement requises

### Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_AUTH_USERNAME=admin          # Optionnel (dev only)
VITE_AUTH_PASSWORD=change-me      # Optionnel (dev only)
```

### Supabase Dashboard (Edge Functions)

| Variable | Description | Source |
|----------|-------------|--------|
| `SUPABASE_URL` | URL projet | Auto-injecté |
| `SUPABASE_ANON_KEY` | Clé anon | Auto-injecté |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role | Auto-injecté (Edge Functions only) |

---

## CORS

### Frontend → Supabase

Configuré automatiquement par Supabase pour le domaine du projet.

### Edge Functions

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

---

## Rate Limiting (Supabase)

| Ressource | Limite défaut | Configurable |
|-----------|---------------|--------------|
| Auth requests | 100 req/min/IP | Dashboard → Auth → Rate Limits |
| Database queries | 1000 req/10s | Non configurable |
| Edge Functions | 500 req/min | Dashboard → Functions → Settings |
| RPC calls | Inclus dans DB queries | — |

---

## Webhooks (non utilisés)

Supabase supporte les webhooks sur :
- `auth` (user created, deleted, etc.)
- `database` (INSERT/UPDATE/DELETE sur tables)
- `storage` (upload/delete)

> Non configuré actuellement.

---

*Dernière mise à jour : 2026-09-15*