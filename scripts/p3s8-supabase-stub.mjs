/* Stub Supabase pour tests comportementaux P3-S8 (remplace supabaseClient.js
   via alias Vite). Implémente le sous-ensemble utilisé par les services :
   from/select/eq/in/order/maybeSingle/single/insert/update/delete/upsert,
   plus une sémantique RLS simplifiée (propriétaire ou admin en lecture). */

const db = {
  profiles: [],
  assessment_attempts: [],
  assessment_responses: [],
  assessment_questions: [],
  user_roles: [{ user_id: "admin-1", role_id: "role-admin" }],
  roles: [{ id: "role-admin", name: "Administrateur" }],
};

let questionsError = null;

// État partagé entre les instances du module (harnais natif + runner Vite SSR).
const g = globalThis;
if (!g.__P3S8_STUB__) {
  g.__P3S8_STUB__ = { ctx: { userId: null, isAdmin: false }, db };
}
const shared = g.__P3S8_STUB__;

let ctx = shared.ctx;

export function __setAuthContext(userId, isAdmin = false) {
  shared.ctx = { userId, isAdmin };
}
export function __resetDb() {
  shared.db.profiles = [
    { user_id: "user-1", email: "user1@test.dev", first_name: "Alice", last_name: "Martin", created_at: "2026-09-01T10:00:00Z" },
    { user_id: "user-2", email: "user2@test.dev", first_name: "Bob", last_name: "Durand", created_at: "2026-09-02T10:00:00Z" },
  ];
  shared.db.assessment_attempts = [];
  shared.db.assessment_responses = [];
  shared.db.assessment_questions = [];
  questionsError = null;
}
export function __db() {
  return shared.db;
}
/** S9-2 : injecte les lignes assessment_questions (ou null pour vider). */
export function __setQuestions(rows) {
  shared.db.assessment_questions = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  questionsError = null;
}
/** S9-2 : simule une erreur PostgREST sur la lecture des questions. */
export function __setQuestionsError(message) {
  questionsError = message || "simulated error";
}

function isAdminNow() {
  const c = shared.ctx;
  if (c.isAdmin) return true;
  return shared.db.user_roles.some(
    (ur) => ur.user_id === c.userId && shared.db.roles.some((r) => r.id === ur.role_id && (r.name === "Administrateur" || r.name === "Super Administrateur"))
  );
}

function rlsVisible(table, row) {
  const c = shared.ctx;
  if (table === "profiles") return true; // policy de lecture permissive (comme le projet)
  if (table === "assessment_questions") return c.userId != null && row.is_active === true;
  if (table === "assessment_attempts") return row.user_id === c.userId || isAdminNow();
  if (table === "assessment_responses") {
    const attempt = shared.db.assessment_attempts.find((a) => a.id === row.attempt_id);
    return (attempt && attempt.user_id === c.userId) || isAdminNow();
  }
  return false;
}

function rlsWritable(table, row) {
  const c = shared.ctx;
  if (table === "assessment_attempts") return row.user_id === c.userId;
  if (table === "assessment_responses") {
    const attempt = shared.db.assessment_attempts.find((a) => a.id === row.attempt_id);
    return !!attempt && attempt.user_id === c.userId;
  }
  return true;
}

function clone(r) { return JSON.parse(JSON.stringify(r)); }

function makeQuery(table) {
  let filters = [];
  const q = {
    select() { return q; },
    eq(k, v) { filters.push((r) => r[k] === v); return q; },
    in(k, list) { filters.push((r) => list.includes(r[k])); return q; },
    order() { return q; },
    async maybeSingle() {
      const rows = applyFilters();
      return { data: rows[0] ? clone(rows[0]) : null, error: null };
    },
    async single() {
      const rows = applyFilters();
      return rows.length ? { data: clone(rows[0]), error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
    },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        const rows = applyFilters();
        return { data: rows.map(clone), error: null };
      }).then(resolve, reject);
    },
  };

  function applyFilters() {
    if (table === "assessment_questions" && questionsError) {
      throw { code: "PGRST", message: questionsError };
    }
    let rows = shared.db[table].filter((r) => rlsVisible(table, r));
    filters.forEach((f) => { rows = rows.filter(f); });
    return rows;
  }

  q._write = {
    insert(rows) {
      return {
        select() { return this; },
        async single() {
          const row = Array.isArray(rows) ? rows[0] : rows;
          if (!rlsWritable(table, row)) return { data: null, error: { code: "42501", message: "RLS violation" } };
          const dup = shared.db[table].find((r) => r.user_id === row.user_id && r.assessment_id === row.assessment_id);
          if (dup) return { data: null, error: { code: "23505", message: "unique violation" } };
          const created = { id: "att-" + Math.random().toString(36).slice(2, 8), ...clone(row) };
          shared.db[table].push(created);
          return { data: clone(created), error: null };
        },
      };
    },
    async upsert(rows) {
      for (const row of rows) {
        if (!rlsWritable(table, row)) return { error: { code: "42501", message: "RLS violation" } };
      }
      for (const row of rows) {
        const match = shared.db[table].find(
          (r) => r.attempt_id === row.attempt_id && r.question_id === row.question_id
        );
        if (match) Object.assign(match, clone(row), { updated_at: new Date().toISOString() });
        else shared.db[table].push(clone({ id: "resp-" + Math.random().toString(36).slice(2, 8), answered_at: new Date().toISOString(), ...row }));
      }
      return { error: null };
    },
    update(patch) {
      return {
        eq(k, v) {
          const targets = shared.db[table].filter((r) => r[k] === v && rlsWritable(table, r));
          targets.forEach((r) => Object.assign(r, clone(patch)));
          return Promise.resolve({ error: null });
        },
      };
    },
    delete() {
      const builder = {
        eq(k, v) { filters.push((r) => r[k] === v); return builder; },
        in(k, list) { filters.push((r) => list.includes(r[k])); return builder; },
        then(resolve) {
          const doomed = shared.db[table].filter((r) => rlsVisible(table, r) && rlsWritable(table, r)).filter((r) => filters.every((f) => f(r)));
          shared.db[table] = shared.db[table].filter((r) => !doomed.includes(r));
          // Cascade FK (équivalent de `on delete cascade` en vrai Postgres) :
          if (table === "assessment_attempts" && doomed.length > 0) {
            const ids = new Set(doomed.map((r) => r.id));
            shared.db.assessment_responses = shared.db.assessment_responses.filter((r) => !ids.has(r.attempt_id));
          }
          return resolve({ error: null });
        },
      };
      return builder;
    },
  };
  // API Postgrest : les méthodes d'écriture sont exposées directement sur le
  // builder racine (from(...).insert(...).select(...).single(), etc.).
  q.insert = q._write.insert;
  q.upsert = q._write.upsert;
  q.update = q._write.update;
  q.delete = q._write.delete;
  return q;
}

export const supabase = {
  from(table) { return makeQuery(table); },
  // S9-2 (mode test) : RPC admin_get_users — lecture des profils via la
  // fonction SECURITY DEFINER, réservée aux administrateurs (comme en prod).
  rpc(fn) {
    if (fn !== "admin_get_users") {
      return Promise.resolve({ data: null, error: { code: "404", message: `RPC inconnu : ${fn}` } });
    }
    if (!isAdminNow()) {
      return Promise.resolve({ data: null, error: { code: "42501", message: "RPC reserve aux administrateurs" } });
    }
    const rows = shared.db.profiles.map((p) => ({
      user_id: p.user_id,
      email: p.email,
      first_name: p.first_name,
      last_name: p.last_name,
      created_at: p.created_at,
      role_ids: [],
    }));
    return Promise.resolve({ data: rows, error: null });
  },
};
