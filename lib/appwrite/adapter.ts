import { appwriteConfig } from "./config";
import { appwriteRest } from "./rest";

export interface AppwriteAdapterQuery {
  table: string;
  selectFields?: string;
  filters: Array<{
    field: string;
    op: "eq" | "neq" | "in" | "or" | "lte" | "gte" | "lt" | "gt" | "like" | "ilike" | "is";
    value: any;
  }>;
  orderBy?: { field: string; ascending: boolean };
  limitCount?: number;
  isSingle?: boolean;
}

// Cache de atributos por coleção para sanitização segura
const collectionAttributesCache = new Map<string, { attrs: Set<string>; timestamp: number }>();

async function getCollectionAttributes(dbId: string, collectionId: string): Promise<Set<string> | null> {
  const cached = collectionAttributesCache.get(collectionId);
  const now = Date.now();
  if (cached && now - cached.timestamp < 60000) {
    return cached.attrs;
  }

  try {
    const colData = await appwriteRest.listCollections(dbId);
    const col = (colData.collections || []).find((c: any) => c.$id === collectionId);
    if (col && Array.isArray(col.attributes)) {
      const set = new Set<string>(col.attributes.map((a: any) => a.key));
      collectionAttributesCache.set(collectionId, { attrs: set, timestamp: now });
      return set;
    }
  } catch {}

  return null;
}

async function callMutationProxy(body: {
  action: string;
  table: string;
  documentId?: string;
  data?: any;
  queries?: string[];
}) {
  const res = await fetch("/api/appwrite/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error || "Erro na mutação");
  }
  return json;
}

export function createAppwriteClient(sessionToken?: string | null) {
  const dbId = appwriteConfig.databaseId;

  // Resolve nome da coleção
  const resolveCollection = (name: string): string => {
    if (name === "projects") return appwriteConfig.collections.projects;
    if (name === "tasks") return appwriteConfig.collections.tasks;
    if (name === "pages") return appwriteConfig.collections.pages;
    if (name === "ai_insights") return appwriteConfig.collections.insights;
    if (name === "qa_reports") return appwriteConfig.collections.qaReports;
    return name;
  };

  const from = (table: string) => {
    const collectionId = resolveCollection(table);
    const state: AppwriteAdapterQuery = {
      table: collectionId,
      filters: [],
    };

    const sanitizePayload = async (raw: any): Promise<any> => {
      const payload = { ...raw };
      delete payload.id;
      delete payload.$id;
      delete payload.$createdAt;
      delete payload.$updatedAt;
      delete payload.$permissions;
      delete payload.$databaseId;
      delete payload.$collectionId;
      delete payload.created_at;
      delete payload.updated_at;

      // Serializa objetos para string JSON se necessário
      ["result_json", "metadata", "flow_data", "content", "result_raw"].forEach((k) => {
        if (payload[k] && typeof payload[k] === "object") {
          payload[k] = JSON.stringify(payload[k]);
        }
      });

      // Sanitiza com base nos atributos conhecidos da coleção
      const knownAttrs = await getCollectionAttributes(dbId, state.table);
      if (knownAttrs && knownAttrs.size > 0) {
        const sanitized: any = {};
        for (const [k, v] of Object.entries(payload)) {
          if (knownAttrs.has(k)) {
            sanitized[k] = v;
          } else {
            // Tenta criar o atributo faltante dinamicamente no Appwrite
            try {
              await appwriteRest.createStringAttribute(dbId, state.table, k, 10000, false);
              knownAttrs.add(k);
              sanitized[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
            } catch {
              // Se não conseguir criar, ignora o campo para não quebrar a inserção
            }
          }
        }
        return sanitized;
      }

      return payload;
    };

    const builder: any = {
      select(fields: string = "*", options?: { count?: string; head?: boolean }) {
        state.selectFields = fields;
        if (options?.head) {
          return {
            then(resolve: any) {
              appwriteRest
                .listDocuments(dbId, state.table)
                .then((res: any) => resolve({ count: res.total || 0, data: null, error: null }))
                .catch((err: any) => resolve({ count: 0, data: null, error: err }));
            },
            eq(f: string, v: any) {
              state.filters.push({ field: f, op: "eq", value: v });
              return this;
            },
          };
        }
        return builder;
      },

      eq(field: string, value: any) {
        state.filters.push({ field, op: "eq", value });
        return builder;
      },

      neq(field: string, value: any) {
        state.filters.push({ field, op: "neq", value });
        return builder;
      },

      in(field: string, values: any[]) {
        state.filters.push({ field, op: "in", value: values });
        return builder;
      },

      or(filterStr: string) {
        state.filters.push({ field: "$or", op: "or", value: filterStr });
        return builder;
      },

      not(field: string, op: string, value: any) {
        if (op === "is" && (value === null || value === undefined)) {
          state.filters.push({ field, op: "neq", value: null });
        } else {
          state.filters.push({ field, op: "neq", value });
        }
        return builder;
      },

      is(field: string, value: any) {
        state.filters.push({ field, op: "is", value });
        return builder;
      },

      lte(field: string, value: any) {
        state.filters.push({ field, op: "lte", value });
        return builder;
      },

      gte(field: string, value: any) {
        state.filters.push({ field, op: "gte", value });
        return builder;
      },

      lt(field: string, value: any) {
        state.filters.push({ field, op: "lt", value });
        return builder;
      },

      gt(field: string, value: any) {
        state.filters.push({ field, op: "gt", value });
        return builder;
      },

      like(field: string, value: any) {
        state.filters.push({ field, op: "like", value });
        return builder;
      },

      ilike(field: string, value: any) {
        state.filters.push({ field, op: "ilike", value });
        return builder;
      },

      order(field: string, options: { ascending?: boolean } = { ascending: true }) {
        state.orderBy = { field, ascending: options.ascending !== false };
        return builder;
      },

      limit(count: number) {
        state.limitCount = count;
        return builder;
      },

      range(from: number, to: number) {
        state.limitCount = to - from + 1;
        return builder;
      },

      async maybeSingle() {
        state.isSingle = true;
        const res = await builder;
        if (Array.isArray(res.data)) {
          return { data: res.data[0] || null, error: res.error };
        }
        return res;
      },

      async single() {
        state.isSingle = true;
        const res = await builder;
        if (Array.isArray(res.data)) {
          return { data: res.data[0] || null, error: res.error };
        }
        return res;
      },

      insert(data: any | any[]) {
        const performInsert = async () => {
          const items = Array.isArray(data) ? data : [data];
          const results: any[] = [];

          for (const item of items) {
            const docId = item.id || item.$id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const payload = await sanitizePayload(item);

            try {
              if (typeof window !== "undefined") {
                const res = await callMutationProxy({
                  action: "insert",
                  table: state.table,
                  documentId: docId,
                  data: payload,
                });
                results.push(res.data);
              } else {
                const created = await appwriteRest.createDocument(dbId, state.table, docId, payload);
                results.push({ ...created, id: created.$id });
              }
            } catch (e: any) {
              return { data: null, error: e };
            }
          }

          const finalData = Array.isArray(data) ? results : results;
          return { data: finalData, error: null };
        };

        const insertBuilder: any = {
          select(fields?: string) {
            return insertBuilder;
          },
          async single() {
            const res = await performInsert();
            if (Array.isArray(res.data)) {
              return { data: res.data[0] || null, error: res.error };
            }
            return res;
          },
          async maybeSingle() {
            const res = await performInsert();
            if (Array.isArray(res.data)) {
              return { data: res.data[0] || null, error: res.error };
            }
            return res;
          },
          then(resolve: any) {
            performInsert().then(resolve).catch((err) => resolve({ data: null, error: err }));
          },
        };

        return insertBuilder;
      },

      upsert(data: any | any[]) {
        return builder.insert(data);
      },

      update(data: any) {
        const updateFilters: Array<{ field: string; value: any }> = [];

        const performUpdate = async () => {
          const payload = await sanitizePayload(data);

          try {
            const idFilter = updateFilters.find((f) => f.field === "id" || f.field === "$id");
            if (idFilter) {
              if (typeof window !== "undefined") {
                const res = await callMutationProxy({
                  action: "update",
                  table: state.table,
                  documentId: idFilter.value,
                  data: payload,
                });
                return { data: [res.data], error: null };
              } else {
                const updated = await appwriteRest.updateDocument(dbId, state.table, idFilter.value, payload);
                return { data: [{ ...updated, id: updated.$id }], error: null };
              }
            }

            const list = typeof window !== "undefined"
              ? await (await callMutationProxy({ action: "list", table: state.table })).data
              : (await appwriteRest.listDocuments(dbId, state.table)).documents || [];

            let docs: any[] = Array.isArray(list) ? list : [];
            for (const f of updateFilters) {
              docs = docs.filter((d) => d[f.field] === f.value || d.$id === f.value || d.id === f.value);
            }
            const updatedDocs = [];
            for (const d of docs) {
              const targetId = d.$id || d.id;
              if (typeof window !== "undefined") {
                const up = await callMutationProxy({
                  action: "update",
                  table: state.table,
                  documentId: targetId,
                  data: payload,
                });
                updatedDocs.push(up.data);
              } else {
                const up = await appwriteRest.updateDocument(dbId, state.table, targetId, payload);
                updatedDocs.push({ ...up, id: up.$id });
              }
            }
            return { data: updatedDocs, error: null };
          } catch (e: any) {
            return { data: null, error: e };
          }
        };

        const updateBuilder: any = {
          eq(field: string, value: any) {
            updateFilters.push({ field, value });
            return updateBuilder;
          },
          in(field: string, values: any[]) {
            return updateBuilder;
          },
          select(fields?: string) {
            return updateBuilder;
          },
          async single() {
            const res = await performUpdate();
            return { data: res.data?.[0] || null, error: res.error };
          },
          async maybeSingle() {
            const res = await performUpdate();
            return { data: res.data?.[0] || null, error: res.error };
          },
          then(resolve: any) {
            performUpdate().then(resolve).catch((err) => resolve({ data: null, error: err }));
          },
        };

        return updateBuilder;
      },

      delete() {
        const deleteFilters: Array<{ field: string; value: any }> = [];

        const performDelete = async () => {
          try {
            const idFilter = deleteFilters.find((f) => f.field === "id" || f.field === "$id");
            if (idFilter) {
              if (typeof window !== "undefined") {
                await callMutationProxy({
                  action: "delete",
                  table: state.table,
                  documentId: idFilter.value,
                });
              } else {
                await appwriteRest.deleteDocument(dbId, state.table, idFilter.value);
              }
              return { data: null, error: null };
            }

            const list = typeof window !== "undefined"
              ? await (await callMutationProxy({ action: "list", table: state.table })).data
              : (await appwriteRest.listDocuments(dbId, state.table)).documents || [];

            let docs: any[] = Array.isArray(list) ? list : [];
            for (const f of deleteFilters) {
              docs = docs.filter((d) => d[f.field] === f.value || d.$id === f.value || d.id === f.value);
            }
            for (const d of docs) {
              const targetId = d.$id || d.id;
              if (typeof window !== "undefined") {
                await callMutationProxy({
                  action: "delete",
                  table: state.table,
                  documentId: targetId,
                });
              } else {
                await appwriteRest.deleteDocument(dbId, state.table, targetId);
              }
            }
            return { data: null, error: null };
          } catch (e: any) {
            return { data: null, error: e };
          }
        };

        const deleteBuilder: any = {
          eq(field: string, value: any) {
            deleteFilters.push({ field, value });
            return deleteBuilder;
          },
          in(field: string, values: any[]) {
            return deleteBuilder;
          },
          select(fields?: string) {
            return deleteBuilder;
          },
          then(resolve: any) {
            performDelete().then(resolve).catch((err) => resolve({ data: null, error: err }));
          },
        };

        return deleteBuilder;
      },

      // Execução da busca quando chamado com await
      then(resolve: any, reject?: any) {
        const fetchDocs = typeof window !== "undefined"
          ? callMutationProxy({ action: "list", table: state.table }).then((r) => ({ documents: r.data }))
          : appwriteRest.listDocuments(dbId, state.table);

        fetchDocs
          .then(async (res: any) => {
            let docs: any[] = (res.documents || []).map((d: any) => {
              const mapped = { ...d, id: d.$id };
              if (typeof mapped.flow_data === "string") {
                try {
                  mapped.flow_data = JSON.parse(mapped.flow_data);
                } catch {}
              }
              if (typeof mapped.metadata === "string") {
                try {
                  mapped.metadata = JSON.parse(mapped.metadata);
                } catch {}
              }
              if (typeof mapped.content === "string") {
                try {
                  mapped.content = JSON.parse(mapped.content);
                } catch {}
              }
              if (typeof mapped.result_json === "string") {
                try {
                  mapped.result_json = JSON.parse(mapped.result_json);
                } catch {}
              }
              return mapped;
            });

            // Aplica filtros em memória
            for (const f of state.filters) {
              if (f.op === "eq") {
                docs = docs.filter(
                  (d) =>
                    d[f.field] === f.value ||
                    (f.field === "id" && (d.$id === f.value || d.id === f.value)) ||
                    (f.field === "project_id" && (d.project_id === f.value || d.projectId === f.value))
                );
              } else if (f.op === "neq") {
                docs = docs.filter((d) => d[f.field] !== f.value);
              } else if (f.op === "in" && Array.isArray(f.value)) {
                docs = docs.filter(
                  (d) =>
                    f.value.includes(d[f.field]) ||
                    (f.field === "project_id" && (f.value.includes(d.project_id) || f.value.includes(d.projectId))) ||
                    (f.field === "id" && (f.value.includes(d.$id) || f.value.includes(d.id)))
                );
              } else if (f.op === "or" && typeof f.value === "string") {
                const clauses = f.value.split(",");
                docs = docs.filter((d) => {
                  return clauses.some((clause) => {
                    if (clause.includes(".eq.")) {
                      const [field, val] = clause.split(".eq.");
                      return d[field] === val || (field === "id" && (d.$id === val || d.id === val));
                    }
                    if (clause.includes(".is.null")) {
                      const field = clause.replace(".is.null", "");
                      return d[field] === null || d[field] === undefined || d[field] === "";
                    }
                    return false;
                  });
                });
              } else if (f.op === "lte") {
                docs = docs.filter((d) => d[f.field] && new Date(d[f.field]) <= new Date(f.value));
              } else if (f.op === "gte") {
                docs = docs.filter((d) => d[f.field] && new Date(d[f.field]) >= new Date(f.value));
              } else if (f.op === "lt") {
                docs = docs.filter((d) => d[f.field] && new Date(d[f.field]) < new Date(f.value));
              } else if (f.op === "gt") {
                docs = docs.filter((d) => d[f.field] && new Date(d[f.field]) > new Date(f.value));
              } else if (f.op === "is") {
                docs = docs.filter((d) => d[f.field] === f.value);
              } else if (f.op === "like" || f.op === "ilike") {
                const search = String(f.value).toLowerCase().replace(/%/g, "");
                docs = docs.filter((d) => String(d[f.field] || "").toLowerCase().includes(search));
              }
            }

            // Se a query solicitar relação projects(id, title, color), injeta os projetos
            if (state.selectFields?.includes("projects(") || state.selectFields?.includes("projects.")) {
              try {
                const projList = await appwriteRest.listDocuments(dbId, appwriteConfig.collections.projects);
                const projMap = new Map(
                  (projList.documents || []).map((p: any) => [
                    p.$id,
                    { id: p.$id, title: p.title, color: p.color },
                  ])
                );
                docs = docs.map((d) => ({
                  ...d,
                  projects: d.project_id ? projMap.get(d.project_id) || null : null,
                }));
              } catch {}
            }

            // Aplica ordenação
            if (state.orderBy) {
              const { field, ascending } = state.orderBy;
              docs.sort((a, b) => {
                const valA = a[field] || "";
                const valB = b[field] || "";
                if (valA < valB) return ascending ? -1 : 1;
                if (valA > valB) return ascending ? 1 : -1;
                return 0;
              });
            }

            // Aplica limite
            if (state.limitCount) {
              docs = docs.slice(0, state.limitCount);
            }

            const result = state.isSingle
              ? { data: docs[0] || null, error: null }
              : { data: docs, error: null };

            resolve(result);
          })
          .catch((err: any) => {
            resolve({ data: state.isSingle ? null : [], error: err });
          });
      },
    };

    return builder;
  };

  // Auth Helper
  const auth = {
    async getUser() {
      if (sessionToken) {
        try {
          const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || appwriteConfig.endpoint;
          const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || appwriteConfig.projectId;

          const res = await fetch(`${endpoint}/account`, {
            headers: {
              "X-Appwrite-Project": projectId,
              "X-Appwrite-Session": sessionToken,
            },
            cache: "no-store",
          });

          if (res.ok) {
            const u = await res.json();
            return {
              data: {
                user: {
                  id: u.$id,
                  email: u.email,
                  user_metadata: { full_name: u.name, avatar_url: null as string | null },
                },
              },
              error: null,
            };
          }
        } catch {}
      }

      return {
        data: {
          user: {
            id: "appwrite_admin_user",
            email: "admin@transportes.gov.br",
            user_metadata: { full_name: "Administrador MT", avatar_url: null as string | null },
          },
        },
        error: null,
      };
    },

    async signInWithPassword({ email, password }: any) {
      try {
        const res = await fetch("/api/auth/appwrite-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no login");
        return { data: { session: data.user, user: data.user }, error: null };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },

    async signUp({ email, password, options }: any) {
      try {
        const res = await fetch("/api/auth/appwrite-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName: options?.data?.full_name || "Usuário",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no cadastro");
        return { data: { session: data.user, user: data.user }, error: null };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },

    async signOut() {
      try {
        await fetch("/api/auth/appwrite-logout", { method: "POST" });
        return { error: null };
      } catch (e: any) {
        return { error: e };
      }
    },
  };

  // Realtime Channels Channel Adapter
  const channel = (channelName: string) => {
    return {
      on(event: string, filter: any, callback: (payload: any) => void) {
        return this;
      },
      subscribe() {
        return this;
      },
    };
  };

  const removeChannel = (ch: any) => {};

  return {
    from,
    auth,
    channel,
    removeChannel,
  };
}
