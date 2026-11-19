import { z } from "zod";

export const supportedLocaleSchema = z.enum(["en", "hi"]);
