import { appwriteConfig } from "./config";
import { appwriteRest } from "./rest";

export function getAppwrite() {
  return {
    endpoint: appwriteConfig.endpoint,
    projectId: appwriteConfig.projectId,
    databases: appwriteRest,
  };
}
