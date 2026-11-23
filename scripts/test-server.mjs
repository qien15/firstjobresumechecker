import assert from "node:assert/strict";
import { api } from "../server/worker.js";
class MemoryBucket {
  objects = new Map();
  async get(key) {
    const item = this.objects.get(key);
    return item
      ? { etag: item.etag, json: async () => structuredClone(item.value) }
      : null;
  }
  async put(key, text, options) {
    const current = this.objects.get(key);
    const c = options.onlyIf;
    if (c.etagMatches && current?.etag !== c.etagMatches) return null;
    if (c.etagDoesNotMatch === "*" && current) return null;
    const item = { etag: crypto.randomUUID(), value: JSON.parse(text) };
    this.objects.set(key, item);
    return item;
  }
}
const env = { BUCKET: new MemoryBucket() };
async function call(
  path,
  body,
  user = "owner",
  address = user + "@example.com",
) {
  const headers = {
    "oai-authenticated-user-id": user,
    "oai-authenticated-user-email": address,
    "content-type": "application/json",
    origin: "https://agency.test",
  };
  const response = await api(
    new Request("https://agency.test/api/" + path, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  return response.json();
}
let w = (await call("create", { name: "Agency A" })).workspace;
async function act(action, payload, user = "owner", revision = w.revision) {
  const result = await call(
    "action",
    { workspace: w.id, revision, action, payload },
    user,
  );
  w = result.workspace;
  return w;
}
await act("demo.load", {});
assert.equal(w.jobs.length, 1);
assert.equal(w.candidates.length, 1);
const cid = w.candidates[0].id,
  jid = w.jobs[0].id;
// Existing job records can receive the new order details without a data migration.
const orderDetails = {
  headcount: "5",
  workingHours: "Mon–Fri 08:00–18:00",
  allowances: "Attendance allowance RM50",
  interviewDetails: "Tuesday 14:00\nFactory reception · Ask for HR",
  lastConfirmed: "2026-11-23",
};
await act("job.save", { ...w.jobs[0], ...orderDetails });
assert.equal(w.jobs[0].headcount, 5);
assert.equal(w.jobs[0].interviewDetails, orderDetails.interviewDetails);
const {
  headcount,
  workingHours,
  allowances,
  interviewDetails,
  lastConfirmed,
  ...legacyJob
} = w.jobs[0];
await act("job.save", { ...legacyJob, title: "Updated IT Support Executive" });
assert.equal(w.jobs[0].headcount, 5);
assert.equal(w.jobs[0].allowances, orderDetails.allowances);
assert.equal(w.jobs[0].lastConfirmed, orderDetails.lastConfirmed);
for (const value of [0, -1, 1.5, "abc"]) {
  await assert.rejects(
    () =>
      call("action", {
        workspace: w.id,
        revision: w.revision,
        action: "job.save",
        payload: { ...w.jobs[0], headcount: value },
      }),
    /whole number/,
  );
}
await assert.rejects(
  () =>
    call("action", {
      workspace: w.id,
      revision: w.revision,
      action: "job.save",
      payload: { ...w.jobs[0], lastConfirmed: "2026-02-30" },
    }),
  /confirmation date/,
);
await act("job.save", {
  ...w.jobs[0],
  headcount: "",
  lastConfirmed: "",
  allowances: "",
});
assert.equal(w.jobs[0].headcount, null);
assert.equal(w.jobs[0].lastConfirmed, "");
await act("job.save", { ...w.jobs[0], ...orderDetails });
await act("screen.save", {
  id: cid,
  job: jid,
  answers: { Windows: "Configured a laptop" },
  verified: { Windows: "Confirmed" },
});
assert.equal(w.candidates[0].verified[jid].Windows, "Confirmed");
await act("followup.add", {
  id: cid,
  note: "Called candidate",
  date: "2026-12-01",
  next: "Confirm interview",
});
assert.equal(w.tasks.length, 1);
await act("summary.save", { id: cid, text: "Reviewed client introduction" });
assert.equal(w.candidates[0].summary, "Reviewed client introduction");
await assert.rejects(
  () => call("workspace?id=" + w.id, undefined, "outsider"),
  /access/,
);
await call("create", { name: "Agency B" }, "outsider");
await assert.rejects(
  () => call("create", { name: "Overwrite" }, "owner"),
  /updated/,
);
const invitation = await call("invite", {
  workspace: w.id,
  revision: w.revision,
  email: "staff@example.com",
  role: "Recruiter",
});
w = invitation.workspace;
await assert.rejects(
  () => call("join", { code: invitation.code }, "wrong"),
  /Invitation/,
);
const joined = await call("join", { code: invitation.code }, "staff");
w = (await call("workspace?id=owner")).workspace;
assert.equal(joined.workspace.me.role, "Recruiter");
assert.equal(joined.workspace.invites.length, 0);
await assert.rejects(
  () => call("join", { code: invitation.code }, "staff"),
  /Invitation/,
);
await assert.rejects(
  () =>
    call(
      "action",
      {
        workspace: w.id,
        revision: w.revision,
        action: "summary.save",
        payload: { id: cid, text: "Unauthorized" },
      },
      "staff",
    ),
  /assigned/,
);
await assert.rejects(
  () =>
    call(
      "action",
      {
        workspace: w.id,
        revision: w.revision,
        action: "member.update",
        payload: { id: "owner", role: "Recruiter", active: false },
      },
      "staff",
    ),
  /Manager/,
);
await assert.rejects(
  () =>
    call("action", {
      workspace: w.id,
      revision: w.revision - 1,
      action: "demo.load",
      payload: {},
    }),
  /changed/,
);
await act("candidate.save", { ...w.candidates[0], assignee: "staff" });
await act(
  "summary.save",
  { id: cid, text: "Staff can update assigned records" },
  "staff",
);
await act("task.toggle", { id: w.tasks[0].id, done: true });
assert.equal(w.tasks[0].done, true);
await act("member.update", { id: "staff", role: "Recruiter", active: false });
await assert.rejects(
  () => call("workspace?id=owner", undefined, "staff"),
  /access/,
);
await act("candidate.delete", { id: cid });
assert.equal(w.candidates.length, 0);
assert.equal(w.tasks.length, 0);
await assert.rejects(
  () => api(new Request("https://agency.test/api/session"), env),
  /Sign in/,
);
console.log(
  "Server workflow checks passed: screening, follow-ups, introductions, invitations, role enforcement, company isolation, stale writes, deactivation and deletion.",
);
