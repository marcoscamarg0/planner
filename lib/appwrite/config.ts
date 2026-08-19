export const appwriteConfig = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "6a84adcc0011196a5ab5",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "planner_db",
  collections: {
    projects: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROJECTS || "projects",
    tasks: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASKS || "tasks",
    pages: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PAGES || "pages",
    insights: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_INSIGHTS || "ai_insights",
    qaReports: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_QA_REPORTS || "qa_reports",
  },
  apiKey: process.env.APPWRITE_API_KEY || "",
};
