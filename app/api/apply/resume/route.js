// app/api/apply/resume/route.js
// Download the tailored resume for one job as a Word .docx. The tailored
// Markdown was generated when the job was first opened in the copilot; this
// converts it to a real file named for the candidate + company.
import { createClient } from "@/lib/supabase/server";
import { resumeToDocxBuffer } from "@/lib/apply/resumeDocx";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

const safe = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in.", { status: 401 });

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId.", { status: 400 });

  const { data: app } = await supabase
    .from("applications")
    .select("resume_md")
    .eq("user_id", user.id)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!app?.resume_md) return new Response("No tailored resume yet. Open this job in the copilot first.", { status: 404 });

  const [{ data: profile }, { data: job }] = await Promise.all([
    supabase.from("profile").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("jobs").select("company").eq("id", jobId).maybeSingle(),
  ]);

  try {
    const buffer = await resumeToDocxBuffer(app.resume_md);
    const fname = `${safe(profile?.full_name) || "Resume"}_${safe(job?.company) || "Application"}.docx`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error("apply.resume_docx_failed", { error: String(err?.message || err) });
    return new Response("Could not build the document.", { status: 500 });
  }
}
