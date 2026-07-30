// app/r/[token]/page.js — the PUBLIC candidate microsite.
// Rendered server-side with the service-role client, selecting ONLY safe,
// presentational fields (never salary, raw CV, etc.). Shows only if published.
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const p = await load(params.token);
  if (!p) return { title: "Not found" };
  return {
    title: `${p.full_name} — ${p.headline || "Portfolio"}`,
    description: p.summary?.slice(0, 150) || `${p.full_name}'s work`,
  };
}

async function load(token) {
  if (!token) return null;
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profile")
      .select("user_id, full_name, headline, location, summary, links, education_note, contact_email, public_show_email, public_enabled")
      .eq("public_token", token)
      .eq("public_enabled", true)
      .maybeSingle();
    if (error || !profile) return null; // bad token, unpublished, or schema not migrated -> clean 404
    const [{ data: projects }, { data: employment }, { data: education }] = await Promise.all([
      admin.from("projects").select("name, one_liner, description, story, stack, links").eq("user_id", profile.user_id).order("sort_order"),
      admin.from("employment").select("company, title, start_year, end_year, is_current, location, summary").eq("user_id", profile.user_id).order("sort_order"),
      admin.from("education").select("institution, credential, field, start_year, end_year").eq("user_id", profile.user_id).order("sort_order"),
    ]);
    return { ...profile, projects: projects || [], employment: employment || [], education: education || [] };
  } catch {
    return null;
  }
}

const yr = (e) => [e.start_year, e.is_current ? "Present" : e.end_year].filter(Boolean).join(" – ");

export default async function Microsite({ params }) {
  const p = await load(params.token);
  if (!p) notFound();

  const links = Array.isArray(p.links) ? p.links : [];
  const email = p.public_show_email ? p.contact_email : null;

  return (
    <div className="ms">
      <style>{CSS}</style>

      <header className="ms-hero">
        <div className="ms-wrap">
          <div className="ms-eyebrow">{p.location || "Available for senior remote roles"}</div>
          <h1 className="ms-name">{p.full_name}</h1>
          {p.headline && <div className="ms-headline">{p.headline}</div>}
          {p.summary && <p className="ms-summary">{p.summary}</p>}
          <div className="ms-links">
            {links.map((l, i) => (
              <a key={i} className="ms-link" href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>
            ))}
            {email && <a className="ms-link ms-link-primary" href={`mailto:${email}`}>Email me</a>}
          </div>
        </div>
      </header>

      <main className="ms-wrap ms-body">
        {p.projects.length > 0 && (
          <section>
            <h2 className="ms-h2">Selected work</h2>
            <div className="ms-grid">
              {p.projects.map((pr, i) => (
                <article className="ms-card" key={i}>
                  <h3 className="ms-card-title">{pr.name}</h3>
                  {pr.one_liner && <div className="ms-card-sub">{pr.one_liner}</div>}
                  {(pr.description || pr.story) && <p className="ms-card-body">{pr.description || pr.story}</p>}
                  {pr.stack?.length > 0 && (
                    <div className="ms-chips">{pr.stack.slice(0, 8).map((s, j) => <span className="ms-chip" key={j}>{s}</span>)}</div>
                  )}
                  {Array.isArray(pr.links) && pr.links.length > 0 && (
                    <div className="ms-card-links">
                      {pr.links.map((l, j) => (
                        <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" className="ms-card-link">{l.label || "View"} ↗</a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {p.employment.length > 0 && (
          <section>
            <h2 className="ms-h2">Experience</h2>
            <div className="ms-timeline">
              {p.employment.map((e, i) => (
                <div className="ms-role" key={i}>
                  <div className="ms-role-head">
                    <div className="ms-role-title">{e.title}{e.company ? <span className="ms-role-co"> · {e.company}</span> : null}</div>
                    <div className="ms-role-date">{yr(e)}</div>
                  </div>
                  {e.location && <div className="ms-role-loc">{e.location}</div>}
                  {e.summary && <p className="ms-role-body">{e.summary}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {(p.education.length > 0 || p.education_note) && (
          <section>
            <h2 className="ms-h2">Education</h2>
            {p.education.map((e, i) => (
              <div className="ms-edu" key={i}>
                <span className="ms-edu-main">{[e.credential, e.field].filter(Boolean).join(" · ") || e.institution}</span>
                {e.institution && <span className="ms-edu-inst"> — {e.institution}</span>}
                <span className="ms-edu-date"> {[e.start_year, e.end_year].filter(Boolean).join(" – ")}</span>
              </div>
            ))}
            {p.education_note && <p className="ms-edu-note">{p.education_note}</p>}
          </section>
        )}

        <footer className="ms-foot">
          {email ? <a className="ms-cta" href={`mailto:${email}`}>Get in touch</a> : links[0] ? <a className="ms-cta" href={links[0].url} target="_blank" rel="noopener noreferrer">Connect</a> : null}
        </footer>
      </main>
    </div>
  );
}

const CSS = `
.ms{--ms-bg:#0b0b0f;--ms-fg:#f4f4f5;--ms-mut:#a1a1aa;--ms-line:#26262c;--ms-card:#141419;--ms-acc:#8b8bff;--ms-body:#c9c9d2;--ms-chip-bg:#1c1c22;min-height:100vh;background:var(--ms-bg);color:var(--ms-fg);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.ms-wrap{max-width:920px;margin:0 auto;padding:0 24px;}
.ms-hero{padding:88px 0 44px;background:radial-gradient(1200px 400px at 50% -80px,rgba(139,139,255,.18),transparent);border-bottom:1px solid var(--ms-line);}
.ms-eyebrow{font-size:13px;color:var(--ms-mut);font-weight:600;letter-spacing:.3px;text-transform:uppercase;}
.ms-name{font-size:clamp(38px,7vw,64px);font-weight:800;letter-spacing:-2px;margin:14px 0 6px;line-height:1.02;}
.ms-headline{font-size:clamp(17px,2.6vw,22px);color:var(--ms-acc);font-weight:600;margin-bottom:18px;}
.ms-summary{font-size:16px;line-height:1.7;color:var(--ms-body);max-width:640px;margin:0 0 22px;}
.ms-links{display:flex;flex-wrap:wrap;gap:10px;}
.ms-link{font-size:14px;font-weight:600;color:var(--ms-fg);border:1px solid var(--ms-line);background:var(--ms-card);padding:9px 16px;border-radius:10px;text-decoration:none;transition:border-color .15s;}
.ms-link:hover{border-color:var(--ms-acc);}
.ms-link-primary{background:var(--ms-acc);color:#0b0b0f;border-color:var(--ms-acc);}
.ms-body{padding:44px 24px 80px;}
.ms-body section{margin-bottom:52px;}
.ms-h2{font-size:14px;text-transform:uppercase;letter-spacing:1.2px;color:var(--ms-mut);font-weight:700;margin:0 0 20px;}
.ms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
.ms-card{background:var(--ms-card);border:1px solid var(--ms-line);border-radius:16px;padding:22px;transition:transform .15s,border-color .15s;}
.ms-card:hover{transform:translateY(-2px);border-color:#3a3a44;}
.ms-card-title{font-size:19px;font-weight:700;margin:0 0 4px;letter-spacing:-.3px;}
.ms-card-sub{font-size:14px;color:var(--ms-acc);font-weight:500;margin-bottom:10px;}
.ms-card-body{font-size:14px;line-height:1.6;color:var(--ms-body);margin:0 0 14px;}
.ms-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
.ms-chip{font-size:11.5px;font-weight:600;color:var(--ms-mut);background:var(--ms-chip-bg);border:1px solid var(--ms-line);border-radius:999px;padding:4px 10px;}
.ms-card-links{display:flex;flex-wrap:wrap;gap:14px;}
.ms-card-link{font-size:13px;font-weight:700;color:var(--ms-acc);text-decoration:none;}
.ms-timeline{border-left:2px solid var(--ms-line);padding-left:22px;display:grid;gap:26px;}
.ms-role-head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:baseline;}
.ms-role-title{font-size:16.5px;font-weight:700;}
.ms-role-co{color:var(--ms-mut);font-weight:500;}
.ms-role-date{font-size:13px;color:var(--ms-mut);white-space:nowrap;}
.ms-role-loc{font-size:13px;color:var(--ms-mut);margin-top:2px;}
.ms-role-body{font-size:14px;line-height:1.6;color:var(--ms-body);margin:8px 0 0;}
.ms-edu{font-size:15px;margin-bottom:6px;}
.ms-edu-inst,.ms-edu-date{color:var(--ms-mut);}
.ms-edu-note{font-size:14px;color:var(--ms-mut);margin-top:8px;line-height:1.6;}
.ms-foot{border-top:1px solid var(--ms-line);padding-top:36px;text-align:center;}
.ms-cta{display:inline-block;background:var(--ms-acc);color:#0b0b0f;font-weight:700;font-size:15px;padding:13px 30px;border-radius:12px;text-decoration:none;}
@media (prefers-color-scheme:light){.ms{--ms-bg:#fbfbfa;--ms-fg:#18181b;--ms-mut:#5b5b63;--ms-line:#e7e5e4;--ms-card:#ffffff;--ms-acc:#4f46e5;--ms-body:#3f3f46;--ms-chip-bg:#f4f4f5;}}
`;
