export const skills: Record<string, string[]> = {
  Windows: ["Microsoft Windows"],
  Networking: ["network", "networks"],
  "Printer troubleshooting": ["printer repair", "printer maintenance"],
  SQL: ["structured query language"],
  Git: [],
  GitHub: [],
  React: ["React.js", "ReactJS"],
  JavaScript: ["JS", "ECMAScript"],
  TypeScript: ["TS"],
  Java: [],
  Python: [],
  HTML: ["HTML5"],
  CSS: ["CSS3"],
  "C++": [],
  "C#": ["C sharp"],
  PHP: [],
  MySQL: [],
  PostgreSQL: ["Postgres"],
  "SQL Server": ["MSSQL"],
  SQLite: [],
  "Node.js": ["NodeJS", "Node JS"],
  "Next.js": ["NextJS"],
  Firebase: [],
  Firestore: [],
  Docker: [],
  Linux: [],
  Figma: [],
  Excel: ["Microsoft Excel"],
  "Power BI": [],
  "REST API": ["REST APIs", "RESTful API", "RESTful APIs"],
  "Unit testing": ["unit tests"],
  Teamwork: [
    "team collaboration",
    "team work",
    "team player",
    "team project experience",
  ],
};
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function contains(text: string, term: string): boolean {
  return new RegExp(
    "(^|[^a-z0-9+#])" + escapeRegex(term) + "(?=$|[^a-z0-9+#])",
    "i",
  ).test(text);
}
export function canonical(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return (
    Object.keys(skills).find((key) =>
      [key, ...skills[key]].some(
        (alias) => alias.toLowerCase() === clean.toLowerCase(),
      ),
    ) || clean
  );
}
function hasSkill(text: string, term: string, evidence = false): boolean {
  const extra =
    evidence && term === "SQL"
      ? ["MySQL", "PostgreSQL", "SQLite", "SQL Server"]
      : [];
  return [term, ...(skills[term] || []), ...extra].some((alias) =>
    contains(text, alias),
  );
}
export function detect(job: string): string[] {
  return Object.keys(skills).filter((skill) => hasSkill(job, skill));
}
export type Status = "example" | "mentioned" | "missing";
export type Result = {
  term: string;
  status: Status;
  evidence: string;
  suggestion: string;
};
export const statusLabels: Record<Status, string> = {
  example: "Example found",
  mentioned: "Mentioned · add an example",
  missing: "No matching text found",
};
const specific: Record<string, string> = {
  Git: "If you used Git in a group project, describe your role using branches, commits or pull requests.",
  SQL: "If you used SQL or a relational database, explain what data you stored or queried and which part you implemented.",
  React:
    "If you built with React, name a component or feature you worked on and explain how it behaved.",
  JavaScript:
    "If you used JavaScript, describe a feature you built, such as form validation or an interactive page.",
  Teamwork:
    "If you worked on a team, describe your own contribution and how you coordinated with other members.",
};
export function analyse(resume: string, requirements: string[]): Result[] {
  const lines = resume
    .split(/\r?\n|(?<=[!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return requirements.map((term) => {
    const mentions = lines.filter((line) => hasSkill(line, term, true));
    const example = mentions.find(
      (line) =>
        !/^(?:[-•]\s*)?(?:(?:technical|programming|core)\s+)?(?:skills|technologies|tools)\s*[:–—-]/i.test(
          line,
        ) &&
        /\b(built|developed|created|designed|used|implemented|tested|managed|wrote|deployed|collaborated|configured|analysed|analyzed|maintained|stored|queried|integrated|debugged|automated)\b/i.test(
          line,
        ) &&
        line.split(/\s+/).length >= 6,
    );
    const status: Status = example
      ? "example"
      : mentions.length
        ? "mentioned"
        : "missing";
    return {
      term,
      status,
      evidence: example || mentions[0] || "",
      suggestion: example
        ? "You have a relevant example. Clarify your personal contribution and the result. Add a specific outcome if you can support it."
        : specific[term] ||
          "If you have used " +
            term +
            ", add a coursework, project or experience bullet explaining what you personally did and what it achieved.",
    };
  });
}
