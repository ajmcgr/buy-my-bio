import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MarketplaceSnapshot, MarketplaceSort } from "./marketplace.server";

const sortSchema = z.enum(["most-valuable", "trending", "new", "affordable"]);

export const getMarketplace = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ sort: sortSchema.default("most-valuable") }).parse(input),
  )
  .handler(async ({ data }): Promise<MarketplaceSnapshot> => {
    const { loadMarketplace } = await import("./marketplace.server");
    return loadMarketplace(data.sort as MarketplaceSort);
  });
