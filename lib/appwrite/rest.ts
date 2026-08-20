import { appwriteConfig } from "./config";
export { appwriteConfig };

interface AppwriteRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: any;
  params?: Record<string, string | number | boolean>;
  useKey?: boolean;
}

export async function appwriteFetch({
  method = "GET",
  path,
  body,
  params,
  useKey = false,
}: AppwriteRequestOptions) {
  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    appwriteConfig.endpoint ||
    "https://nyc.cloud.appwrite.io/v1";
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
    appwriteConfig.projectId ||
    "6a84adcc0011196a5ab5";
  const apiKey =
    process.env.APPWRITE_API_KEY ||
    appwriteConfig.apiKey ||
    "";

  let url = `${endpoint}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    "X-Appwrite-Project": projectId,
    "Content-Type": "application/json",
  };

  if (useKey && apiKey) {
    headers["X-Appwrite-Key"] = apiKey.trim();
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const errorMsg =
      data?.message ||
      data?.error ||
      `HTTP ${res.status}: ${res.statusText || text || "Erro ao consultar Appwrite"}`;
    throw new Error(errorMsg);
  }

  return data;
}

// REST Database Helpers
export const appwriteRest = {
  // Databases
  async listDatabases() {
    return appwriteFetch({ path: "/databases", useKey: true });
  },

  async createDatabase(databaseId: string, name: string) {
    return appwriteFetch({
      method: "POST",
      path: "/databases",
      body: { databaseId, name },
      useKey: true,
    });
  },

  // Collections
  async listCollections(databaseId: string) {
    return appwriteFetch({
      path: `/databases/${databaseId}/collections`,
      useKey: true,
    });
  },

  async createCollection(databaseId: string, collectionId: string, name: string, permissions: string[] = []) {
    return appwriteFetch({
      method: "POST",
      path: `/databases/${databaseId}/collections`,
      body: {
        collectionId,
        name,
        permissions: permissions.length > 0 ? permissions : ['read("any")', 'create("users")', 'update("users")', 'delete("users")'],
        documentSecurity: false,
      },
      useKey: true,
    });
  },

  // Attributes
  async createStringAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    size: number,
    required: boolean = false,
    defaultValue?: string
  ) {
    return appwriteFetch({
      method: "POST",
      path: `/databases/${databaseId}/collections/${collectionId}/attributes/string`,
      body: { key, size, required, default: defaultValue },
      useKey: true,
    });
  },

  async createIntegerAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean = false,
    defaultValue: number = 0
  ) {
    return appwriteFetch({
      method: "POST",
      path: `/databases/${databaseId}/collections/${collectionId}/attributes/integer`,
      body: { key, required, default: defaultValue },
      useKey: true,
    });
  },

  async createBooleanAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean = false,
    defaultValue: boolean = false
  ) {
    return appwriteFetch({
      method: "POST",
      path: `/databases/${databaseId}/collections/${collectionId}/attributes/boolean`,
      body: { key, required, default: defaultValue },
      useKey: true,
    });
  },

  // Documents
  async listDocuments(databaseId: string, collectionId: string, queries: string[] = []) {
    const params: Record<string, string> = {};
    if (queries && queries.length > 0) {
      queries.forEach((q, idx) => {
        params[`queries[${idx}]`] = q;
      });
    }
    return appwriteFetch({
      path: `/databases/${databaseId}/collections/${collectionId}/documents`,
      params: Object.keys(params).length > 0 ? params : undefined,
      useKey: true,
    });
  },

  async fetchAllDocuments(databaseId: string, collectionId: string): Promise<any[]> {
    let all: any[] = [];
    let offset = 0;
    const limit = 100;

    for (let page = 0; page < 20; page++) {
      try {
        const params: Record<string, string> = {
          "queries[0]": `limit(${limit})`,
          "queries[1]": `offset(${offset})`,
        };
        const res = await appwriteFetch({
          path: `/databases/${databaseId}/collections/${collectionId}/documents`,
          params,
          useKey: true,
        });
        const docs = res?.documents || [];
        all = all.concat(docs);
        if (docs.length < limit || (res.total && all.length >= res.total)) {
          break;
        }
        offset += limit;
      } catch (err) {
        if (all.length === 0) {
          try {
            const fallback = await appwriteFetch({
              path: `/databases/${databaseId}/collections/${collectionId}/documents`,
              useKey: true,
            });
            return fallback?.documents || [];
          } catch {}
        }
        break;
      }
    }
    return all;
  },

  async createDocument(databaseId: string, collectionId: string, documentId: string, data: any) {
    return appwriteFetch({
      method: "POST",
      path: `/databases/${databaseId}/collections/${collectionId}/documents`,
      body: { documentId, data },
      useKey: true,
    });
  },

  async updateDocument(databaseId: string, collectionId: string, documentId: string, data: any) {
    return appwriteFetch({
      method: "PATCH",
      path: `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
      body: { data },
      useKey: true,
    });
  },

  async deleteDocument(databaseId: string, collectionId: string, documentId: string) {
    return appwriteFetch({
      method: "DELETE",
      path: `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
      useKey: true,
    });
  },
};
