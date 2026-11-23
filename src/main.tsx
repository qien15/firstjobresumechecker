import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ResumeChecker from "./ResumeChecker";
import { analyse, detect, statusLabels } from "./matcher";
import { extractResume } from "./importResume";
import {
  requirements,
  type Workspace,
  type Job,
  type Candidate,
} from "./agencyTypes";
import "./style.css";
type Page =
  | "Overview"
  | "Candidates"
  | "Jobs"
  | "Compare"
  | "Follow-ups"
  | "Team"
  | "Resume checker";
type Modal =
  | { kind: "candidate"; record?: Candidate }
  | { kind: "job"; record?: Job }
  | { kind: "detail"; record: Candidate }
  | null;
async function request(path: string, body?: unknown) {
  const response = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(Error(value.error || "Request failed."), {
      status: response.status,
    });
  return value;
}
function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false);
  const [page, setPage] = useState<Page>("Overview"),
    [modal, setModal] = useState<Modal>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [agency, setAgency] = useState(""),
    [join, setJoin] = useState(""),
    [search, setSearch] = useState(""),
    [stage, setStage] = useState("All stages"),
    [mine, setMine] = useState(false);
  const [compareJob, setCompareJob] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [invite, setInvite] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const wid = localStorage.getItem("firstjob-workspace") || "";
      const value = await request(
        "workspace" + (wid ? "?id=" + encodeURIComponent(wid) : ""),
      );
      setWorkspace(value.workspace || null);
    } catch (e) {
      setError((e as Error).message);
      setAuth((e as { status?: number }).status === 401);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  function apply(value: { workspace: Workspace }) {
    setWorkspace(value.workspace);
    localStorage.setItem("firstjob-workspace", value.workspace.id);
  }
  async function action(action: string, payload: unknown) {
    if (!workspace) return false;
    setBusy(true);
    setError("");
    try {
      apply(
        await request("action", {
          workspace: workspace.id,
          revision: workspace.revision,
          action,
          payload,
        }),
      );
      setNotice("Changes saved.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice(
        "Clipboard unavailable. Select the text and press Ctrl+C or Command+C.",
      );
    }
  }
  const manager = workspace && ["Owner", "Manager"].includes(workspace.me.role);
  const assignee = (id: string) =>
    workspace?.members.find((m) => m.id === id)?.name || "Unassigned";
  const canEdit = (c: Candidate) =>
    !!manager || c.assignee === workspace?.me.id;
  if (loading)
    return (
      <div className="loading">
        <span className="logo">f.</span>
        <h2>Opening your workspace…</h2>
      </div>
    );
  if (!workspace)
    return (
      <main className="welcome">
        <span className="logo">f.</span>
        <h1>FirstJob for agencies</h1>
        <p>
          Screen resumes, record conversations and prepare client introductions
          together.
        </p>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {auth ? (
          <a
            className="button primary"
            target="_top"
            href="/signin-with-chatgpt?returnTo=%2F"
          >
            Sign in with ChatGPT
          </a>
        ) : (
          <div className="two">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  apply(await request("create", { name: agency }));
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Create your agency</h2>
              <label>
                Agency name
                <input
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                Create workspace
              </button>
            </form>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  apply(await request("join", { code: join }));
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Join your team</h2>
              <label>
                Invitation code
                <input
                  value={join}
                  onChange={(e) => setJoin(e.target.value)}
                  required
                />
              </label>
              <button disabled={busy}>Join workspace</button>
            </form>
          </div>
        )}
        <button
          onClick={() => {
            localStorage.removeItem("firstjob-workspace");
            refresh();
          }}
        >
          Open my own workspace
        </button>
      </main>
    );
  const w = workspace;
  const tasks = w.tasks
    .filter((t) => !t.done && (!mine || t.assignee === w.me.id))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const candidates = w.candidates.filter(
    (c) =>
      (!mine || c.assignee === w.me.id) &&
      (stage === "All stages" || c.stage === stage) &&
      (c.name + " " + c.location + " " + c.resume)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const chosenJob = w.jobs.find((j) => j.id === compareJob);
  const nav: Page[] = [
    "Overview",
    "Candidates",
    "Jobs",
    "Compare",
    "Follow-ups",
    "Team",
    "Resume checker",
  ];
  return (
    <div className="agency-app">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="logo">f.</span>
          <span>
            FirstJob<small>RECRUITER WORKSPACE</small>
          </span>
        </a>
        <div className="company">
          <span>YOUR AGENCY</span>
          <strong>{w.name}</strong>
        </div>
        <nav>
          {nav.map((item, i) => (
            <button
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => {
                setPage(item);
                setNotice("");
              }}
            >
              <span aria-hidden="true">
                {["◫", "♙", "▣", "⊞", "◷", "◉", "✓"][i]}
              </span>
              {item}
            </button>
          ))}
        </nav>
        <div className="identity">
          <strong>{w.me.name}</strong>
          <span>{w.me.role}</span>
          <small>{w.me.email}</small>
          <a href="/signout-with-chatgpt?returnTo=%2F" target="_top">
            Sign out
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            {w.name}
            <span className="slash">/</span>
            {page}
          </span>
          <div className="buttons">
            <button onClick={refresh} disabled={busy}>
              Refresh
            </button>
            <span className="avatar">{w.me.name.slice(0, 1)}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">RECRUITER WORKSPACE</p>
              <h1>
                {page === "Overview"
                  ? "A clearer view of your hiring day."
                  : page}
              </h1>
              <p>
                {
                  {
                    Overview:
                      "Your candidates, client requirements and next conversations in one place.",
                    Candidates:
                      "Keep the resume, screening notes and next step together.",
                    Jobs: "Turn client briefs into requirements your team can review.",
                    Compare:
                      "Compare resume evidence for a job and record what still needs a conversation.",
                    "Follow-ups":
                      "Keep track of every call, interview and client update.",
                    Team: "Manage access and assign work within your agency.",
                    "Resume checker":
                      "Review one resume against a job description.",
                  }[page]
                }
              </p>
            </div>
            {page !== "Resume checker" && (
              <div className="buttons">
                <button onClick={() => setModal({ kind: "job" })}>
                  ＋ Add job
                </button>
                <button
                  className="primary"
                  onClick={() => setModal({ kind: "candidate" })}
                >
                  ＋ Add candidate
                </button>
              </div>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {page === "Overview" && (
            <>
              <div className="metrics">
                {[
                  [
                    w.jobs.filter((j) => j.status === "Open").length,
                    "Open jobs",
                    "Client opportunities",
                  ],
                  [w.candidates.length, "Candidates", "Across your agency"],
                  [
                    w.candidates.filter((c) => c.stage === "Screening").length,
                    "In screening",
                    "Conversations in progress",
                  ],
                  [tasks.length, "Open follow-ups", "Your team’s next steps"],
                ].map(([n, label, sub]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{n}</strong>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <div className="two">
                <section className="panel">
                  <div className="section-row">
                    <h2>Next conversations</h2>
                    <button
                      className="text-button"
                      onClick={() => setPage("Follow-ups")}
                    >
                      View all
                    </button>
                  </div>
                  {tasks.slice(0, 5).map((t) => (
                    <div className="task-row" key={t.id}>
                      <span className="date-tag">{t.date.slice(5)}</span>
                      <div>
                        <strong>{t.title}</strong>
                        <small>
                          {w.candidates.find((c) => c.id === t.candidate)?.name}{" "}
                          · {assignee(t.assignee)}
                        </small>
                      </div>
                      <span>{t.time}</span>
                    </div>
                  ))}
                  {!tasks.length && (
                    <Empty
                      title="Your next step starts with a note"
                      text="Open a candidate and add a follow-up with a due date."
                    />
                  )}
                </section>
                <section className="panel">
                  <h2>Recently updated candidates</h2>
                  {[...w.candidates]
                    .sort((a, b) => b.updated.localeCompare(a.updated))
                    .slice(0, 5)
                    .map((c) => (
                      <button
                        className="person-row"
                        key={c.id}
                        onClick={() => setModal({ kind: "detail", record: c })}
                      >
                        <span className="person-avatar">{c.name[0]}</span>
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {w.jobs.find((j) => j.id === c.job)?.title ||
                              "No job assigned"}
                          </small>
                        </div>
                        <span className="badge">{c.stage}</span>
                      </button>
                    ))}
                  {!w.candidates.length && (
                    <Empty
                      title="Start with your first candidate"
                      text="Import a resume and review the extracted text before saving."
                    />
                  )}
                </section>
              </div>
              {manager && !w.candidates.length && (
                <div className="sample">
                  <div>
                    <h3>Try the full workflow</h3>
                    <p>
                      Load a fictional IT Support job and candidate, then try
                      screening and a client introduction.
                    </p>
                  </div>
                  <button
                    onClick={() => action("demo.load", {})}
                    disabled={busy}
                  >
                    Load sample records
                  </button>
                </div>
              )}
            </>
          )}
          {page === "Candidates" && (
            <>
              <div className="filters">
                <input
                  aria-label="Search candidates"
                  placeholder="Search name, location or resume text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Candidate stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {[
                    "All stages",
                    "New",
                    "Screening",
                    "Submitted",
                    "Interview",
                    "Placed",
                    "Not proceeding",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className={mine ? "selected" : ""}
                  onClick={() => setMine(!mine)}
                >
                  Assigned to me
                </button>
              </div>
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job / client</th>
                      <th>Salary / availability</th>
                      <th>Recruiter</th>
                      <th>Stage</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <small>{c.location || "Location to confirm"}</small>
                        </td>
                        <td>
                          {w.jobs.find((j) => j.id === c.job)?.title ||
                            "Unassigned"}
                          <small>
                            {w.jobs.find((j) => j.id === c.job)?.client}
                          </small>
                        </td>
                        <td>
                          {c.salary || "Salary to confirm"}
                          <small>
                            {c.availability || "Availability to confirm"}
                          </small>
                        </td>
                        <td>{assignee(c.assignee)}</td>
                        <td>
                          <span className="badge">{c.stage}</span>
                        </td>
                        <td>
                          <button
                            onClick={() =>
                              setModal({ kind: "detail", record: c })
                            }
                          >
                            Open profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!candidates.length && (
                  <Empty
                    title="No candidates here yet"
                    text="Add a candidate or change your filters."
                  />
                )}
              </div>
            </>
          )}
          {page === "Jobs" && (
            <div className="job-grid">
              {w.jobs.map((j) => (
                <article className="panel job-card" key={j.id}>
                  <div className="section-row">
                    <span className="badge">{j.status}</span>
                    <span className="muted">
                      {w.candidates.filter((c) => c.job === j.id).length}{" "}
                      candidates
                    </span>
                  </div>
                  <h2>{j.title}</h2>
                  <p>
                    {j.client} · {j.location}
                  </p>
                  <p className="salary">{j.salary || "Salary not entered"}</p>
                  <dl className="job-meta">
                    <div>
                      <dt>Recruitment headcount</dt>
                      <dd>
                        {j.headcount == null
                          ? "Not recorded"
                          : `${j.headcount} people`}
                      </dd>
                    </div>
                    <div>
                      <dt>Working hours</dt>
                      <dd>{j.workingHours || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Allowances</dt>
                      <dd>{j.allowances || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Last confirmed with client</dt>
                      <dd>{j.lastConfirmed || "Not recorded"}</dd>
                    </div>
                    <div className="job-interview">
                      <dt>Interview arrangements</dt>
                      <dd>{j.interviewDetails || "Not recorded"}</dd>
                    </div>
                  </dl>
                  <div className="requirement-list">
                    <strong>Must have</strong>
                    {j.must
                      .split("\n")
                      .filter(Boolean)
                      .map((r, i) => (
                        <span key={i}>{r}</span>
                      ))}
                  </div>
                  <small>Assigned to {assignee(j.assignee)}</small>
                  <div className="buttons">
                    <button
                      onClick={() => setModal({ kind: "job", record: j })}
                    >
                      Edit job
                    </button>
                    <button
                      onClick={() => {
                        setCompareJob(j.id);
                        setSelected([]);
                        setPage("Compare");
                      }}
                    >
                      Compare candidates
                    </button>
                  </div>
                </article>
              ))}
              {!w.jobs.length && (
                <Empty
                  title="Add a client job"
                  text="Separate must-have requirements from nice-to-have skills."
                />
              )}
            </div>
          )}
          {page === "Compare" && (
            <>
              <section className="panel">
                <label>
                  Client job
                  <select
                    value={compareJob}
                    onChange={(e) => {
                      setCompareJob(e.target.value);
                      setSelected([]);
                    }}
                  >
                    <option value="">Select a job</option>
                    {w.jobs.map((j) => (
                      <option value={j.id} key={j.id}>
                        {j.client} · {j.title}
                      </option>
                    ))}
                  </select>
                </label>
                {chosenJob && (
                  <>
                    <p className="muted">
                      Choose candidates to compare. Matching is based on resume
                      text. Open a profile to confirm details with the
                      candidate.
                    </p>
                    <div className="chips">
                      {w.candidates.map((c) => (
                        <label className="check-chip" key={c.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, c.id]
                                  : selected.filter((x) => x !== c.id),
                              )
                            }
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </section>
              {chosenJob && selected.length > 0 && (
                <div className="panel table-wrap">
                  <table className="comparison">
                    <thead>
                      <tr>
                        <th>Requirement / detail</th>
                        {selected.map((id) => (
                          <th key={id}>
                            {w.candidates.find((c) => c.id === id)?.name}
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({
                                  kind: "detail",
                                  record: w.candidates.find(
                                    (c) => c.id === id,
                                  )!,
                                })
                              }
                            >
                              Open screening
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {requirements(chosenJob).map((term) => (
                        <tr key={term}>
                          <td>
                            {term}
                            <small>
                              {chosenJob.must
                                .split(/\n|,/)
                                .map((x) => x.trim())
                                .includes(term)
                                ? "Must have"
                                : "Nice to have"}
                            </small>
                          </td>
                          {selected.map((id) => {
                            const c = w.candidates.find((c) => c.id === id)!;
                            const r = analyse(c.resume, [term])[0];
                            return (
                              <td key={id}>
                                <span className={"badge " + r.status}>
                                  {statusLabels[r.status]}
                                </span>
                                <p>{r.evidence || "Ask during screening."}</p>
                                <small>
                                  Recruiter review:{" "}
                                  {c.verified[chosenJob.id]?.[term] ||
                                    "Unconfirmed"}
                                </small>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {(["salary", "availability", "location"] as const).map(
                        (k) => (
                          <tr key={k}>
                            <td>
                              {k === "salary"
                                ? "Expected salary"
                                : k === "availability"
                                  ? "Available to start"
                                  : "Location"}
                            </td>
                            {selected.map((id) => (
                              <td key={id}>
                                {w.candidates.find((c) => c.id === id)?.[k] ||
                                  "To confirm"}
                              </td>
                            ))}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {page === "Follow-ups" && (
            <section className="panel">
              <div className="section-row">
                <h2>Follow-up schedule</h2>
                <button
                  className={mine ? "selected" : ""}
                  onClick={() => setMine(!mine)}
                >
                  Assigned to me
                </button>
              </div>
              {[...w.tasks]
                .filter((t) => !mine || t.assignee === w.me.id)
                .sort(
                  (a, b) =>
                    Number(a.done) - Number(b.done) ||
                    (a.date + a.time).localeCompare(b.date + b.time),
                )
                .map((t) => (
                  <div className="task-row" key={t.id}>
                    <input
                      aria-label={"Complete " + t.title}
                      type="checkbox"
                      checked={t.done}
                      disabled={busy || (!manager && t.assignee !== w.me.id)}
                      onChange={(e) =>
                        action("task.toggle", {
                          id: t.id,
                          done: e.target.checked,
                        })
                      }
                    />
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {t.date} {t.time} · {assignee(t.assignee)} ·{" "}
                        {t.done
                          ? "Completed"
                          : t.date < new Date().toLocaleDateString("en-CA")
                            ? "Overdue"
                            : "Open"}
                      </small>
                    </div>
                    <button
                      onClick={() => {
                        const c = w.candidates.find(
                          (c) => c.id === t.candidate,
                        );
                        if (c) setModal({ kind: "detail", record: c });
                      }}
                    >
                      Open candidate
                    </button>
                  </div>
                ))}
              {!w.tasks.length && (
                <Empty
                  title="Keep your next action visible"
                  text="Add a follow-up from a candidate profile."
                />
              )}
            </section>
          )}
          {page === "Team" && (
            <>
              <section className="panel">
                <h2>Agency team</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Assigned work</th>
                        <th>Access</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.members.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.name}</strong>
                            <small>{m.email}</small>
                          </td>
                          <td>{m.role}</td>
                          <td>
                            {
                              w.candidates.filter((c) => c.assignee === m.id)
                                .length
                            }{" "}
                            candidates ·{" "}
                            {w.jobs.filter((j) => j.assignee === m.id).length}{" "}
                            jobs
                          </td>
                          <td>{m.active ? "Active" : "Disabled"}</td>
                          <td>
                            {manager &&
                              m.id !== w.me.id &&
                              m.role !== "Owner" &&
                              (w.me.role === "Owner" ||
                                m.role === "Recruiter") && (
                                <div className="buttons">
                                  {w.me.role === "Owner" && (
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        action("member.update", {
                                          id: m.id,
                                          active: m.active,
                                          role:
                                            m.role === "Recruiter"
                                              ? "Manager"
                                              : "Recruiter",
                                        })
                                      }
                                    >
                                      {m.role === "Recruiter"
                                        ? "Make manager"
                                        : "Make recruiter"}
                                    </button>
                                  )}
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      action("member.update", {
                                        id: m.id,
                                        active: !m.active,
                                        role: m.role,
                                      })
                                    }
                                  >
                                    {m.active ? "Disable" : "Reactivate"}
                                  </button>
                                </div>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {manager && (
                <section className="panel">
                  <h2>Invite an employee</h2>
                  <p className="muted">
                    The employee signs in with the invited email and enters the
                    one-time code. Invitations expire after 7 days. They also
                    need access to this private Site through its sharing
                    settings.
                  </p>
                  <form
                    className="inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      setBusy(true);
                      try {
                        const result = await request("invite", {
                          workspace: w.id,
                          revision: w.revision,
                          email: f.get("email"),
                          role: f.get("role"),
                        });
                        apply(result);
                        setInvite(result.code);
                        setNotice(
                          "Invitation created. Copy and share the code with the invited employee.",
                        );
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Employee email
                      <input type="email" name="email" required />
                    </label>
                    <label>
                      Role
                      <select name="role">
                        <option>Recruiter</option>
                        {w.me.role === "Owner" && <option>Manager</option>}
                      </select>
                    </label>
                    <button className="primary" disabled={busy}>
                      Create invitation
                    </button>
                  </form>
                  {invite && (
                    <label>
                      Invitation code
                      <input
                        readOnly
                        value={invite}
                        onFocus={(e) => e.target.select()}
                      />
                      <button onClick={() => copy(invite)}>Copy code</button>
                    </label>
                  )}
                  <h3>Invitations</h3>
                  {w.invites.map((i) => (
                    <p key={i.id}>
                      {i.email} · {i.role} ·{" "}
                      {i.used
                        ? "Used"
                        : i.expires < Date.now()
                          ? "Expired"
                          : "Pending"}
                    </p>
                  ))}
                </section>
              )}
              <section className="panel">
                <h2>Switch agency workspace</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      apply(await request("join", { code: join }));
                      setJoin("");
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Invitation code
                    <input
                      value={join}
                      onChange={(e) => setJoin(e.target.value)}
                      required
                    />
                  </label>
                  <button disabled={busy}>Join workspace</button>
                </form>
              </section>
            </>
          )}
          {page === "Resume checker" && (
            <div className="legacy">
              <ResumeChecker />
            </div>
          )}
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section
            className={"modal " + (modal.kind === "detail" ? "wide" : "")}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.kind === "detail"
                ? "Candidate profile"
                : modal.kind === "job"
                  ? "Job editor"
                  : "Candidate editor"
            }
          >
            <div className="modal-top">
              <h2>
                {modal.kind === "detail"
                  ? modal.record.name
                  : modal.kind === "job"
                    ? modal.record
                      ? "Edit job"
                      : "Add client job"
                    : modal.record
                      ? "Edit candidate"
                      : "Add candidate"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close dialog"
                disabled={busy}
              >
                ×
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {modal.kind === "job" && (
              <JobEditor
                job={modal.record}
                workspace={w}
                manager={!!manager}
                busy={busy}
                save={async (p) => {
                  if (await action("job.save", p)) setModal(null);
                }}
              />
            )}
            {modal.kind === "candidate" && (
              <CandidateEditor
                candidate={modal.record}
                workspace={w}
                manager={!!manager}
                busy={busy}
                save={async (p) => {
                  if (await action("candidate.save", p)) setModal(null);
                }}
              />
            )}
            {modal.kind === "detail" && (
              <CandidateDetail
                key={modal.record.id}
                candidate={
                  w.candidates.find((c) => c.id === modal.record.id) ||
                  modal.record
                }
                workspace={w}
                canEdit={canEdit(modal.record)}
                busy={busy}
                action={action}
                copy={copy}
                edit={() => {
                  const record =
                    w.candidates.find((c) => c.id === modal.record.id) ||
                    modal.record;
                  setModal({ kind: "candidate", record });
                }}
                close={() => setModal(null)}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">◇</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Input({
  name,
  label,
  value = "",
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} required={required} />
    </label>
  );
}
function Text({
  name,
  label,
  value = "",
  required = false,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea name={name} defaultValue={value} required={required} />
    </label>
  );
}
function Assignment({
  workspace,
  value,
  manager,
}: {
  workspace: Workspace;
  value?: string;
  manager: boolean;
}) {
  return (
    <label>
      Assigned recruiter
      <select
        name="assignee"
        defaultValue={value || workspace.me.id}
        disabled={!manager}
      >
        {workspace.members
          .filter((m) => m.active || m.id === value)
          .map((m) => (
            <option value={m.id} key={m.id}>
              {m.name}
              {!m.active ? " (disabled)" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}
function JobEditor({
  job: j,
  workspace,
  manager,
  busy,
  save,
}: {
  job?: Job;
  workspace: Workspace;
  manager: boolean;
  busy: boolean;
  save: (p: unknown) => Promise<void>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({
          ...Object.fromEntries(new FormData(e.currentTarget)),
          id: j?.id,
        });
      }}
    >
      <div className="two">
        <Input name="title" label="Position" value={j?.title} required />
        <Input
          name="client"
          label="Client company"
          value={j?.client}
          required
        />
        <Input name="location" label="Location" value={j?.location} />
        <Input name="salary" label="Salary range" value={j?.salary} />
      </div>
      <div className="two">
        <label>
          Recruitment headcount
          <input
            name="headcount"
            type="number"
            min="1"
            step="1"
            defaultValue={j?.headcount ?? ""}
            placeholder="e.g. 5"
          />
        </label>
        <Input
          name="lastConfirmed"
          label="Last confirmed with client"
          type="date"
          value={j?.lastConfirmed}
        />
      </div>
      <Text
        name="workingHours"
        label="Working hours / shifts"
        value={j?.workingHours}
      />
      <Text
        name="allowances"
        label="Allowances and benefits"
        value={j?.allowances}
      />
      <Text
        name="interviewDetails"
        label="Interview arrangements (date, time, location and contact)"
        value={j?.interviewDetails}
      />
      <Text name="description" label="Job description" value={j?.description} />
      <div className="two">
        <Text
          name="must"
          label="Must-have requirements (one per line)"
          value={j?.must}
          required
        />
        <Text
          name="nice"
          label="Nice-to-have requirements (one per line)"
          value={j?.nice}
        />
      </div>
      <div className="two">
        <Assignment
          workspace={workspace}
          value={j?.assignee}
          manager={manager}
        />
        <label>
          Status
          <select name="status" defaultValue={j?.status || "Open"}>
            <option>Open</option>
            <option>On hold</option>
            <option>Closed</option>
          </select>
        </label>
      </div>
      <button disabled={busy} className="primary">
        {busy ? "Saving…" : "Save job"}
      </button>
    </form>
  );
}
function CandidateEditor({
  candidate: c,
  workspace,
  manager,
  busy,
  save,
}: {
  candidate?: Candidate;
  workspace: Workspace;
  manager: boolean;
  busy: boolean;
  save: (p: unknown) => Promise<void>;
}) {
  const [resume, setResume] = useState(c?.resume || ""),
    [name, setName] = useState(c?.name || ""),
    [filename, setFilename] = useState(c?.filename || ""),
    [contact, setContact] = useState(c?.contact || ""),
    [education, setEducation] = useState(c?.education || "");
  const [reading, setReading] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );
  async function upload(file?: File) {
    if (!file) return;
    const current = ++requestId.current;
    setReading(true);
    setError("");
    try {
      const text = await extractResume(file);
      if (current !== requestId.current) return;
      setResume(text);
      setFilename(file.name);
      if (!name)
        setName(
          text
            .split("\n")
            .map((s) => s.trim())
            .find(Boolean)
            ?.slice(0, 100) || file.name,
        );
      if (!contact)
        setContact(
          text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "",
        );
      if (!education)
        setEducation(
          text
            .split("\n")
            .find((l) => /diploma|bachelor|degree|master|phd/i.test(l)) || "",
        );
    } catch (err) {
      if (current === requestId.current) setError((err as Error).message);
    } finally {
      if (current === requestId.current) setReading(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({
          ...Object.fromEntries(new FormData(e.currentTarget)),
          id: c?.id,
          resume,
          filename,
          name,
          contact,
          education,
        });
      }}
    >
      <div className="upload-area">
        <label className="button">
          Open resume from file
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            disabled={reading}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <span>
          {reading
            ? "Reading file…"
            : filename || "PDF, DOCX or TXT · up to 10 MB"}
        </span>
        <small>
          Review the extracted text before saving. Extracted text and candidate
          details are saved to your agency workspace.
        </small>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="two">
        <label>
          Candidate name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Email / phone
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <Input name="location" label="Location" value={c?.location} />
        <label>
          Education
          <input
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          />
        </label>
        <Input name="salary" label="Expected salary" value={c?.salary} />
        <Input
          name="availability"
          label="Available to start / notice period"
          value={c?.availability}
        />
      </div>
      <Text
        name="experience"
        label="Experience summary (review and enter)"
        value={c?.experience}
      />
      <label>
        Resume text
        <textarea
          className="resume-editor"
          value={resume}
          onChange={(e) => {
            requestId.current++;
            setReading(false);
            setResume(e.target.value);
          }}
          required
        />
      </label>
      <div className="skills-found">
        <strong>Skills detected in the resume</strong>
        <div className="chips">
          {detect(resume).map((skill) => (
            <span className="badge" key={skill}>
              {skill}
            </span>
          ))}
          {!detect(resume).length && (
            <span className="muted">No dictionary skills detected yet.</span>
          )}
        </div>
      </div>
      <div className="two">
        <label>
          Client job
          <select name="job" defaultValue={c?.job || ""}>
            <option value="">No job assigned</option>
            {workspace.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.client} · {j.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stage
          <select name="stage" defaultValue={c?.stage || "New"}>
            {[
              "New",
              "Screening",
              "Submitted",
              "Interview",
              "Placed",
              "Not proceeding",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <Assignment workspace={workspace} value={c?.assignee} manager={manager} />
      <button className="primary" disabled={reading || busy}>
        {busy ? "Saving…" : "Save reviewed candidate"}
      </button>
    </form>
  );
}
function CandidateDetail({
  candidate: c,
  workspace: w,
  canEdit,
  busy,
  action,
  copy,
  edit,
  close,
}: {
  candidate: Candidate;
  workspace: Workspace;
  canEdit: boolean;
  busy: boolean;
  action: (a: string, p: unknown) => Promise<boolean>;
  copy: (s: string) => Promise<void>;
  edit: () => void;
  close: () => void;
}) {
  const [tab, setTab] = useState("Screening"),
    [job, setJob] = useState(c.job || ""),
    [answers, setAnswers] = useState(c.answers[c.job || "general"] || {}),
    [verified, setVerified] = useState(c.verified[c.job || "general"] || {}),
    [summary, setSummary] = useState(c.summary || "");
  const selectedJob = w.jobs.find((j) => j.id === job),
    terms = selectedJob ? requirements(selectedJob) : detect(c.resume),
    results = analyse(c.resume, terms);
  function changeJob(value: string) {
    setJob(value);
    setAnswers(c.answers[value || "general"] || {});
    setVerified(c.verified[value || "general"] || {});
  }
  function buildIntro() {
    const confirmed = Object.entries(c.verified[job || "general"] || {})
      .filter(([, value]) => value === "Confirmed")
      .map(([term]) => term);
    setSummary(
      "Candidate introduction — " +
        c.name +
        "\n" +
        (selectedJob
          ? "Position: " +
            selectedJob.title +
            " | Client: " +
            selectedJob.client +
            "\n"
          : "") +
        "\n" +
        [
          c.education && "Education: " + c.education,
          c.experience && "Recorded experience: " + c.experience,
          confirmed.length &&
            "Confirmed during screening: " + confirmed.join(", "),
          c.salary && "Expected salary: " + c.salary,
          c.availability && "Availability: " + c.availability,
          c.location && "Location: " + c.location,
        ]
          .filter(Boolean)
          .join("\n") +
        "\n\nRecruiter notes: [Review and add a client-specific recommendation.]",
    );
  }
  return (
    <>
      <div className="profile-strip">
        <span className="person-avatar large">{c.name[0]}</span>
        <div>
          <strong>{c.name}</strong>
          <small>{c.contact || "Contact to confirm"}</small>
        </div>
        <span className="badge">{c.stage}</span>
        {canEdit && <button onClick={edit}>Edit candidate</button>}
      </div>
      <div className="detail-tabs">
        {[
          "Screening",
          "Resume",
          "Client introduction",
          "Follow-up history",
        ].map((t) => (
          <button
            className={t === tab ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Screening" && (
        <>
          <label>
            Compare against job
            <select value={job} onChange={(e) => changeJob(e.target.value)}>
              <option value="">General skills review</option>
              {w.jobs.map((j) => (
                <option value={j.id} key={j.id}>
                  {j.client} · {j.title}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Review each quoted line and record the candidate’s answer. Save
            screening notes before building the client introduction.
          </p>
          {results.map((r) => (
            <div className="screen-card" key={r.term}>
              <div className="section-row">
                <h3>{r.term}</h3>
                <span className={"badge " + r.status}>
                  {statusLabels[r.status]}
                </span>
              </div>
              {r.evidence ? (
                <blockquote>{r.evidence}</blockquote>
              ) : (
                <p>No matching resume text.</p>
              )}
              <p>
                <strong>Ask the candidate</strong>
                <br />
                {r.status === "example"
                  ? "Can you explain your own contribution using " +
                    r.term +
                    " and give a specific example?"
                  : "Have you used " +
                    r.term +
                    "? Please describe when and what you personally did."}
              </p>
              <label>
                Candidate’s answer
                <textarea
                  disabled={!canEdit}
                  value={answers[r.term] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [r.term]: e.target.value })
                  }
                />
              </label>
              <label>
                Recruiter confirmation
                <select
                  disabled={!canEdit}
                  value={verified[r.term] || "Unconfirmed"}
                  onChange={(e) =>
                    setVerified({ ...verified, [r.term]: e.target.value })
                  }
                >
                  <option>Unconfirmed</option>
                  <option>Confirmed</option>
                  <option>Not met</option>
                </select>
              </label>
            </div>
          ))}
          {!terms.length && (
            <p>
              Add job requirements or a resume with supported skills to start
              screening.
            </p>
          )}
          <button
            className="primary"
            disabled={!canEdit || busy}
            onClick={() =>
              action("screen.save", { id: c.id, job, answers, verified })
            }
          >
            Save screening notes
          </button>
        </>
      )}
      {tab === "Resume" && (
        <>
          <div className="two">
            <section>
              <h3>Education</h3>
              <p>{c.education || "To confirm"}</p>
              <h3>Recorded experience</h3>
              <p>{c.experience || "To confirm"}</p>
            </section>
            <section>
              <h3>Salary / availability</h3>
              <p>
                {c.salary || "To confirm"} · {c.availability || "To confirm"}
              </p>
              <h3>Skills detected</h3>
              <p>
                {detect(c.resume).join(", ") ||
                  "No dictionary skills detected."}
              </p>
            </section>
          </div>
          <label>
            Extracted resume text
            <textarea className="resume-editor" readOnly value={c.resume} />
          </label>
          <small>{c.filename}</small>
        </>
      )}
      {tab === "Client introduction" && (
        <>
          <p className="muted">
            Build an editable introduction from recorded details and saved,
            confirmed screening requirements. Review it before sharing with a
            client.
          </p>
          <button disabled={!canEdit} onClick={buildIntro}>
            Build introduction
          </button>
          <label>
            Client introduction
            <textarea
              className="resume-editor"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              readOnly={!canEdit}
            />
          </label>
          <div className="buttons">
            <button
              disabled={!canEdit || busy}
              className="primary"
              onClick={() =>
                action("summary.save", { id: c.id, text: summary })
              }
            >
              Save introduction
            </button>
            <button disabled={!summary.trim()} onClick={() => copy(summary)}>
              Copy introduction
            </button>
          </div>
        </>
      )}
      {tab === "Follow-up history" && (
        <>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const values = Object.fromEntries(new FormData(form));
              if (await action("followup.add", { id: c.id, ...values }))
                form.reset();
            }}
          >
            <Text name="note" label="Contact / follow-up note" required />
            <div className="two">
              <Input name="date" label="Next follow-up date" type="date" />
              <Input name="time" label="Time" type="time" />
            </div>
            <Input name="next" label="Next action" />
            <button className="primary" disabled={!canEdit || busy}>
              Save follow-up
            </button>
          </form>
          <h3>History</h3>
          {[...c.events].reverse().map((event) => (
            <div className="timeline" key={event.id}>
              <small>
                {new Date(event.date).toLocaleString()} · {event.by}
              </small>
              <p>{event.note}</p>
            </div>
          ))}
          {!c.events.length && (
            <p className="muted">No follow-up records yet.</p>
          )}
        </>
      )}
      {canEdit && (
        <div className="delete-area">
          <button
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (
                window.confirm(
                  "Permanently delete this candidate, resume text, screening notes and follow-up tasks?",
                )
              ) {
                if (await action("candidate.delete", { id: c.id })) close();
              }
            }}
          >
            Delete candidate record
          </button>
        </div>
      )}
    </>
  );
}
const publicDemo = new URLSearchParams(window.location.search).get("demo") === "1";
createRoot(document.getElementById("root")!).render(
  publicDemo ? <ResumeChecker /> : <App />,
);
