import { auth0 } from "@/lib/auth0";
import { generateReport } from "@/lib/observatory/report-generator";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = generateReport();

  return Response.json(report, {
    headers: {
      "Content-Disposition": `attachment; filename="observatory-report-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
