/**
 * AgentPay SDK — Public API
 *
 * Everything an AI agent needs to consume paid APIs via state channels.
 */

export { AgentPaySession, bytesToBase58 } from "./session-client.js";
export type { OpenSessionParams } from "./session-client.js";
export { fetchCatalog, findService } from "./catalog-client.js";
export { signIou, buildNextIou, serializeIou } from "./iou-signer.js";

export type {
  IouMessage,
  SessionState,
  OpenSessionResponse,
  CloseSessionResponse,
  CatalogService,
  CatalogResponse,
} from "./types/session.js";
