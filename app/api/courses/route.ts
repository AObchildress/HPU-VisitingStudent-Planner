const SHEETS = {
  undergraduate:
    "https://docs.google.com/spreadsheets/d/1mlCiaUyAWx2gA9tXy_5BFyO_l_nv3r9t7E0kbd00m8Q/gviz/tq?tqx=out:csv&gid=0",
  graduate:
    "https://docs.google.com/spreadsheets/d/1uO8R3GxkOoXs79bCUFZ01KroHPNtyRxOlb2hLDmb7eI/gviz/tq?tqx=out:csv&gid=0",
} as const;

export const revalidate = 3600;

export async function GET(request: Request) {
  const level = new URL(request.url).searchParams.get("level");

  if (level !== "undergraduate" && level !== "graduate") {
    return Response.json(
      { error: "Choose either undergraduate or graduate course data." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(SHEETS[level], {
      next: { revalidate },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csv = await response.text();

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json(
      { error: "Course data is temporarily unavailable." },
      { status: 502 },
    );
  }
}
