const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const assert = (test, message, status = 400) => {
  if (!test) throw new ApiError(message, status);
};
const clean = (v, max = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const id = () => crypto.randomUUID();
const email = (v) => clean(v).toLowerCase();
const digest = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const workspaceKey = (wid) => "agency/v1/" + encodeURIComponent(wid) + ".json";
const manager = (member) => ["Owner", "Manager"].includes(member.role);
const textFields = (obj, names) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      clean(obj[name], name === "resume" ? 150000 : 20000),
    ]),
  );
async function load(env, wid) {
  const obj = await env.BUCKET.get(workspaceKey(wid));
  assert(obj, "Workspace not found.", 404);
  return { state: await obj.json(), etag: obj.etag };
}
async function write(env, state, etag) {
  const result = await env.BUCKET.put(
    workspaceKey(state.id),
    JSON.stringify(state),
    {
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/json" },
    },
  );
  assert(result, "Someone updated this workspace. Refresh and try again.", 409);
}
function memberFor(state, user) {
  const m = state.members.find((m) => m.id === user.id && m.active);
  assert(m, "You do not have access to this company workspace.", 403);
  return m;
}
function view(state, member) {
  return {
    ...state,
    invites: manager(member)
      ? state.invites.map(({ hash, ...invite }) => invite)
      : [],
    me: member,
  };
}
function canEdit(candidate, member) {
  return manager(member) || candidate.assignee === member.id;
}
function validateAssignee(state, uid) {
  assert(
    !uid || state.members.some((m) => m.id === uid && m.active),
    "Choose an active team member.",
  );
}
function mutate(state, member, action, p) {
  const now = new Date().toISOString();
  if (action === "job.save") {
    const existing = state.jobs.find((j) => j.id === p.id);
    assert(
      !existing || manager(member) || existing.assignee === member.id,
      "Only the assigned recruiter or manager can edit this job.",
      403,
    );
    const value = textFields(p, [
      "title",
      "client",
      "location",
      "salary",
      "description",
      "must",
      "nice",
      "status",
    ]);
    assert(value.title && value.client, "Enter a position and client.");
    for (const field of [
      "workingHours",
      "allowances",
      "interviewDetails",
      "lastConfirmed",
    ]) {
      value[field] = clean(
        p[field] === undefined ? existing?.[field] : p[field],
        5000,
      );
    }
    const rawHeadcount =
      p.headcount === undefined ? existing?.headcount : p.headcount;
    value.headcount =
      rawHeadcount == null || String(rawHeadcount).trim() === ""
        ? null
        : Number(rawHeadcount);
    assert(
      value.headcount === null ||
        (Number.isSafeInteger(value.headcount) && value.headcount > 0),
      "Recruitment headcount must be a positive whole number.",
    );
    assert(
      !value.lastConfirmed ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value.lastConfirmed) &&
          !Number.isNaN(Date.parse(value.lastConfirmed)) &&
          new Date(value.lastConfirmed).toISOString().slice(0, 10) ===
            value.lastConfirmed),
      "Choose a valid last confirmation date.",
    );
    assert(
      ["Open", "On hold", "Closed"].includes(value.status),
      "Invalid job status.",
    );
    const assignee = manager(member)
      ? clean(p.assignee) || member.id
      : existing?.assignee || member.id;
    validateAssignee(state, assignee);
    if (existing) Object.assign(existing, value, { assignee, updated: now });
    else
      state.jobs.push({
        id: id(),
        ...value,
        assignee,
        created: now,
        updated: now,
      });
  } else if (action === "candidate.save") {
    const existing = state.candidates.find((c) => c.id === p.id);
    assert(
      !existing || canEdit(existing, member),
      "Only the assigned recruiter or manager can edit this candidate.",
      403,
    );
    const value = textFields(p, [
      "name",
      "contact",
      "education",
      "experience",
      "salary",
      "availability",
      "location",
      "resume",
      "filename",
      "job",
      "stage",
    ]);
    assert(
      value.name && value.resume,
      "Enter the candidate name and resume text.",
    );
    assert(
      [
        "New",
        "Screening",
        "Submitted",
        "Interview",
        "Placed",
        "Not proceeding",
      ].includes(value.stage),
      "Invalid stage.",
    );
    assert(
      !value.job || state.jobs.some((j) => j.id === value.job),
      "Job not found.",
    );
    const assignee = manager(member)
      ? clean(p.assignee) || member.id
      : existing?.assignee || member.id;
    validateAssignee(state, assignee);
    if (existing) {
      Object.assign(existing, value, { assignee, updated: now });
      state.tasks
        .filter((t) => t.candidate === existing.id && !t.done)
        .forEach((t) => {
          t.assignee = assignee;
        });
    } else
      state.candidates.push({
        id: id(),
        ...value,
        assignee,
        verified: {},
        answers: {},
        summary: "",
        events: [],
        created: now,
        updated: now,
      });
  } else if (
    [
      "screen.save",
      "summary.save",
      "followup.add",
      "candidate.delete",
    ].includes(action)
  ) {
    const candidate = state.candidates.find((c) => c.id === p.id);
    assert(candidate, "Candidate not found.", 404);
    assert(
      canEdit(candidate, member),
      "Only the assigned recruiter or manager can update this candidate.",
      403,
    );
    if (action === "screen.save") {
      assert(
        !p.job || state.jobs.some((j) => j.id === p.job),
        "Job not found.",
      );
      const key = clean(p.job) || "general";
      candidate.job = clean(p.job);
      const answers = Object.fromEntries(
        Object.entries(p.answers || {})
          .slice(0, 100)
          .map(([k, v]) => [clean(k, 200), clean(v, 3000)]),
      );
      const verified = Object.fromEntries(
        Object.entries(p.verified || {})
          .slice(0, 100)
          .map(([k, v]) => [
            clean(k, 200),
            ["Unconfirmed", "Confirmed", "Not met"].includes(v)
              ? v
              : "Unconfirmed",
          ]),
      );
      candidate.answers = { ...candidate.answers, [key]: answers };
      candidate.verified = { ...candidate.verified, [key]: verified };
      candidate.events.push({
        id: id(),
        date: now,
        by: member.name,
        note:
          "Screening notes saved for " +
          (state.jobs.find((j) => j.id === p.job)?.title || "general review"),
      });
    }
    if (action === "summary.save") {
      candidate.summary = clean(p.text, 20000);
      candidate.events.push({
        id: id(),
        date: now,
        by: member.name,
        note: "Client introduction updated",
      });
    }
    if (action === "followup.add") {
      assert(clean(p.note), "Enter a follow-up note.");
      assert(
        !p.date || /^\d{4}-\d{2}-\d{2}$/.test(p.date),
        "Choose a valid date.",
      );
      candidate.events.push({
        id: id(),
        date: now,
        by: member.name,
        note: clean(p.note, 5000),
      });
      if (p.date)
        state.tasks.push({
          id: id(),
          candidate: candidate.id,
          assignee: candidate.assignee,
          date: p.date,
          time: clean(p.time),
          title: clean(p.next) || "Follow up with " + candidate.name,
          done: false,
        });
    }
    if (action === "candidate.delete") {
      state.candidates = state.candidates.filter((c) => c.id !== p.id);
      state.tasks = state.tasks.filter((t) => t.candidate !== p.id);
    } else candidate.updated = now;
  } else if (action === "task.toggle") {
    const t = state.tasks.find((t) => t.id === p.id);
    assert(t, "Task not found.", 404);
    assert(
      manager(member) || t.assignee === member.id,
      "This task is assigned to another recruiter.",
      403,
    );
    t.done = !!p.done;
  } else if (action === "member.update") {
    assert(manager(member), "Manager access required.", 403);
    const target = state.members.find((m) => m.id === p.id);
    assert(target, "Member not found.", 404);
    assert(
      target.role !== "Owner" && target.id !== member.id,
      "The owner and your own access cannot be changed here.",
    );
    assert(
      member.role === "Owner" || target.role === "Recruiter",
      "Only the owner can manage managers.",
      403,
    );
    const role = member.role === "Owner" ? p.role : "Recruiter";
    assert(["Manager", "Recruiter"].includes(role), "Invalid role.");
    Object.assign(target, { role, active: !!p.active });
  } else if (action === "demo.load") {
    assert(manager(member), "Manager access required.", 403);
    assert(
      !state.jobs.some((j) => j.sample),
      "Example records already loaded.",
    );
    const jobid = id(),
      cid = id();
    state.jobs.push({
      id: jobid,
      sample: true,
      title: "IT Support Executive",
      client: "Example Client",
      location: "Johor Bahru",
      salary: "RM3,000–RM3,800",
      must: "Windows\nNetworking\nPrinter troubleshooting",
      nice: "SQL\nGit",
      description:
        "Support office computers, troubleshoot networks and maintain printers.",
      status: "Open",
      assignee: member.id,
      created: now,
      updated: now,
    });
    state.candidates.push({
      id: cid,
      name: "Alex Tan (Example)",
      contact: "alex@example.com",
      education: "Diploma in Computer Science",
      experience: "Web development coursework",
      salary: "RM3,200",
      availability: "One month notice",
      location: "Johor Bahru",
      resume:
        "Alex Tan\nDiploma in Computer Science\nSkills: Windows, Git\nUsed MySQL to store player scores and track level progress.\nConfigured a small office network and tested Wi-Fi connectivity during a course project.",
      filename: "Example resume",
      job: jobid,
      stage: "New",
      assignee: member.id,
      answers: {},
      verified: {},
      summary: "",
      events: [],
      created: now,
      updated: now,
    });
  } else throw new ApiError("Unknown action.");
  state.revision++;
  return state;
}
export async function api(request, env) {
  const url = new URL(request.url);
  const uid = request.headers.get("oai-authenticated-user-id");
  assert(uid, "Sign in with ChatGPT to access your workspace.", 401);
  let full = request.headers.get("oai-authenticated-user-full-name") || "";
  if (
    request.headers.get("oai-authenticated-user-full-name-encoding") ===
    "percent-encoded-utf-8"
  ) {
    try {
      full = decodeURIComponent(full);
    } catch {}
  }
  const user = {
    id: uid,
    email: email(request.headers.get("oai-authenticated-user-email")),
    name:
      clean(full) ||
      email(request.headers.get("oai-authenticated-user-email")) ||
      "Team member",
  };
  if (url.pathname === "/api/session") return json(user);
  assert(env.BUCKET, "Server storage is unavailable.", 503);
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    assert(!origin || origin === url.origin, "Invalid request origin.", 403);
    assert(
      request.headers.get("content-type")?.includes("application/json"),
      "Use JSON for this request.",
      415,
    );
  }
  if (url.pathname === "/api/workspace" && request.method === "GET") {
    const wid = url.searchParams.get("id") || user.id;
    const object = await env.BUCKET.get(workspaceKey(wid));
    if (!object) return json({ exists: false, user });
    const state = await object.json(),
      member = memberFor(state, user);
    return json({ exists: true, workspace: view(state, member), user });
  }
  const body = await request.json();
  if (url.pathname === "/api/create" && request.method === "POST") {
    assert(clean(body.name), "Enter your agency name.");
    const state = {
      id: user.id,
      name: clean(body.name),
      revision: 1,
      members: [{ ...user, role: "Owner", active: true }],
      invites: [],
      jobs: [],
      candidates: [],
      tasks: [],
    };
    await write(env, state, null);
    return json({ workspace: view(state, state.members[0]) });
  }
  if (url.pathname === "/api/join" && request.method === "POST") {
    const [wid, token] = clean(body.code, 1000).split("~");
    assert(wid && token, "Paste the full invitation code.");
    const { state, etag } = await load(env, wid);
    const hash = await digest(token);
    const invite = state.invites.find(
      (i) =>
        i.hash === hash &&
        i.email === user.email &&
        i.expires > Date.now() &&
        !i.used,
    );
    assert(
      invite,
      "Invitation is expired, used, or belongs to a different email.",
      403,
    );
    const existing = state.members.find((m) => m.id === user.id);
    assert(
      !existing || existing.role !== "Owner",
      "Owner is already a member.",
    );
    const member = { ...user, role: invite.role, active: true };
    if (existing) Object.assign(existing, member);
    else state.members.push(member);
    invite.used = true;
    state.revision++;
    await write(env, state, etag);
    return json({ workspace: view(state, member) });
  }
  const { state, etag } = await load(env, clean(body.workspace));
  const member = memberFor(state, user);
  assert(
    body.revision === state.revision,
    "Workspace changed. Refresh before saving again.",
    409,
  );
  if (url.pathname === "/api/invite" && request.method === "POST") {
    assert(manager(member), "Manager access required.", 403);
    const address = email(body.email);
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address), "Enter a valid email.");
    const role =
      member.role === "Owner" && body.role === "Manager"
        ? "Manager"
        : "Recruiter";
    const token = id();
    state.invites.push({
      id: id(),
      email: address,
      role,
      expires: Date.now() + 7 * 86400000,
      hash: await digest(token),
      used: false,
    });
    state.revision++;
    await write(env, state, etag);
    return json({
      workspace: view(state, member),
      code: state.id + "~" + token,
    });
  }
  assert(
    url.pathname === "/api/action" && request.method === "POST",
    "Not found.",
    404,
  );
  mutate(state, member, body.action, body.payload || {});
  await write(env, state, etag);
  return json({ workspace: view(state, member) });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      const asset = ASSETS[url.pathname === "/" ? "/index.html" : url.pathname];
      if (!asset) return new Response("Not found", { status: 404 });
      return new Response(
        Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0)),
        {
          headers: {
            "content-type": asset.type,
            "cache-control": url.pathname.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
            "x-content-type-options": "nosniff",
          },
        },
      );
    } catch (error) {
      return json(
        {
          error:
            error instanceof ApiError
              ? error.message
              : "The server could not complete this request. Try refreshing.",
        },
        error.status || 500,
      );
    }
  },
};
