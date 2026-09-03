/**
 * NFT Metadata Route
 *
 * Returns on-chain metadata for any Solana NFT via Metaplex's DAS API.
 * Includes name, symbol, image, attributes, creators, and collection info.
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/nft-metadata/:mintAddress
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { logger } from "../utilities/logger.js";
import { environmentConfig } from "../config/environment.js";

export function registerNftMetadataRoutes(application: Express): void {
  const pricing = getServicePricing("nft-metadata");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/nft-metadata/:mintAddress", sessionGate, handleNftMetadataRequest);
  application.get("/preview/nft-metadata/:mintAddress", handleNftMetadataRequest);
}

async function handleNftMetadataRequest(
  request: Request,
  response: Response
): Promise<void> {
  const mintAddress = request.params["mintAddress"] as string | undefined;

  if (!mintAddress || mintAddress.length === 0) {
    response.status(400).json({
      error: { message: "NFT mint address is required", code: "MISSING_MINT" },
    });
    return;
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintAddress)) {
    response.status(400).json({
      error: { message: "Invalid Solana address format", code: "INVALID_ADDRESS" },
    });
    return;
  }

  const rpcUrl = environmentConfig.solana.rpcUrl;

  try {
    // Use DAS (Digital Asset Standard) API via Helius RPC
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });

    const rpcResponse = (await res.json()) as {
      result?: {
        id: string;
        content?: {
          json_uri?: string;
          metadata?: { name?: string; symbol?: string; description?: string };
          links?: { image?: string; external_url?: string };
          files?: Array<{ uri?: string; mime?: string }>;
        };
        authorities?: Array<{ address: string; scopes: string[] }>;
        creators?: Array<{ address: string; verified: boolean; share: number }>;
        grouping?: Array<{ group_key: string; group_value: string }>;
        royalty?: { basis_points: number; primary_sale_happened: boolean };
        ownership?: { owner: string; frozen: boolean };
        compression?: { compressed: boolean };
      };
      error?: { message: string };
    };

    if (rpcResponse.error || !rpcResponse.result) {
      const errorMsg = rpcResponse.error?.message ?? "Asset not found";
      logger.warn(`NFT metadata fetch failed for ${mintAddress}: ${errorMsg}`);

      // Fallback: try basic account info
      response.status(404).json({
        error: {
          message: `NFT not found: ${errorMsg}. Ensure the address is a valid NFT/cNFT mint.`,
          code: "NFT_NOT_FOUND",
        },
      });
      return;
    }

    const asset = rpcResponse.result;
    const collection = asset.grouping?.find((g) => g.group_key === "collection");

    response.json({
      source: "metaplex-das",
      provider: "conduit",
      timestamp: new Date().toISOString(),
      nft: {
        mint: asset.id,
        name: asset.content?.metadata?.name ?? null,
        symbol: asset.content?.metadata?.symbol ?? null,
        description: asset.content?.metadata?.description ?? null,
        image: asset.content?.links?.image ?? asset.content?.files?.[0]?.uri ?? null,
        externalUrl: asset.content?.links?.external_url ?? null,
        metadataUri: asset.content?.json_uri ?? null,
      },
      collection: collection
        ? { address: collection.group_value }
        : null,
      creators: asset.creators ?? [],
      royalty: asset.royalty
        ? {
            basisPoints: asset.royalty.basis_points,
            percent: asset.royalty.basis_points / 100,
            primarySaleHappened: asset.royalty.primary_sale_happened,
          }
        : null,
      ownership: asset.ownership ?? null,
      compressed: asset.compression?.compressed ?? false,
    });
  } catch (error) {
    logger.error("NFT metadata fetch error:", error);
    response.status(502).json({
      error: { message: "Failed to fetch NFT metadata", code: "UPSTREAM_ERROR" },
    });
  }
}
