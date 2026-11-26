import { describe, expect, it, vi } from "vitest";

import { districtsByState, listPlaces } from "./places.service";

// Districts come back in one request; tehsils page by 1,000.
function supabaseWith(tehsilCount: number) {
  const tehsils = Array.from({ length: tehsilCount }, (_, i) => ({
    code: i + 1,
    name: `Tehsil ${String(i + 1).padStart(4, "0")}`,
    district_code: 1,
  }));
  const range = vi.fn(async (from: number, to: number) => ({
    data: tehsils.slice(from, to + 1),
    error: null,
  }));
  return {
    range,
    client: {
      from: (table: string) => ({
        select: () => ({
          order: () =>
            table === "geo_districts"
              ? Promise.resolve({
                  data: [
                    { code: 2, name: "Agra", state: { name: "Uttar Pradesh" } },
                    { code: 1, name: "Shimla", state: { name: "Himachal Pradesh" } },
                  ],
                  error: null,
                })
              : { range },
        }),
      }),
    },
  };
}

describe("listPlaces", () => {
  it("reads every tehsil, past the 1,000-row page limit", async () => {
    const { client, range } = supabaseWith(1117);
    const places = await listPlaces(client as never);
    expect(places.tehsils).toHaveLength(1117);
    expect(range).toHaveBeenCalledTimes(2);
  });

  it("orders districts by state, then name", async () => {
    const { client } = supabaseWith(1);
    const places = await listPlaces(client as never);
    expect(districtsByState(places.districts).map(([state]) => state)).toEqual([
      "Himachal Pradesh",
      "Uttar Pradesh",
    ]);
  });
});
