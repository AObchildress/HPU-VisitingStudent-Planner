const SHEETS = {
  undergraduate:
    "https://docs.google.com/spreadsheets/d/1mlCiaUyAWx2gA9tXy_5BFyO_l_nv3r9t7E0kbd00m8Q/gviz/tq?tqx=out:csv&gid=0",
  graduate:
    "https://docs.google.com/spreadsheets/d/1uO8R3GxkOoXs79bCUFZ01KroHPNtyRxOlb2hLDmb7eI/gviz/tq?tqx=out:csv&gid=0",
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ level: string }> },
) {
  const { level } = await context.params;

  if (level !== "undergraduate" && level !== "graduate") {
    return Response.json(
      { error: "Choose either undergraduate or graduate course data." },
      { status: 400 },
    );
  }

  try {
    const sheetUrl = new URL(SHEETS[level]);
    sheetUrl.searchParams.set("_", Date.now().toString());

    const response = await fetch(sheetUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csv = await response.text();

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch {
    return Response.json(
      { error: "Course data is temporarily unavailable." },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
