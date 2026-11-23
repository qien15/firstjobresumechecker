export type Member = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Manager" | "Recruiter";
  active: boolean;
};
export type Job = {
  id: string;
  title: string;
  client: string;
  location: string;
  salary: string;
  description: string;
  must: string;
  nice: string;
  status: string;
  assignee: string;
  created: string;
  updated: string;
};
export type Event = { id: string; date: string; by: string; note: string };
export type Candidate = {
  id: string;
  name: string;
  contact: string;
  education: string;
  experience: string;
  salary: string;
  availability: string;
  location: string;
  resume: string;
  filename: string;
  job: string;
  stage: string;
  assignee: string;
  answers: Record<string, Record<string, string>>;
  verified: Record<string, Record<string, string>>;
  summary: string;
  events: Event[];
  created: string;
  updated: string;
};
export type Task = {
  id: string;
  candidate: string;
  assignee: string;
  date: string;
  time: string;
  title: string;
  done: boolean;
};
export type Workspace = {
  id: string;
  name: string;
  revision: number;
  members: Member[];
  me: Member;
  jobs: Job[];
  candidates: Candidate[];
  tasks: Task[];
  invites: {
    id: string;
    email: string;
    role: string;
    expires: number;
    used: boolean;
  }[];
};
export const requirements = (job: Job) => [
  ...new Set(
    (job.must + "\n" + job.nice)
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];
