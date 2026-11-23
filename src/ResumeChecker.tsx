import React, { useRef, useState } from "react";

import {
  analyse,
  canonical,
  detect,
  statusLabels,
  type Result,
  type Status,
} from "./matcher";
import "./checker.css";

const sampleJob =
  "IT Intern — Web Development\n\nWe are looking for a student who can help build and maintain web applications.\n\nRequirements\n• Basic SQL knowledge\n• Familiarity with Git\n• Experience building with React\n\nPlease include examples from coursework or personal projects.";
const sampleResume =
  "ALEX TAN\nDiploma in Computer Science\n\nSkills: Git, JavaScript, MySQL\n\nCOURSE PROJECT\nLearning Game Platform\n• Used MySQL to store player scores and track level progress.\n• Designed the login page layout for our group project.";
export default function ResumeChecker() {
  const [job, setJob] = useState("");
  const [resume, setResume] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [reviewedJob, setReviewedJob] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [notice, setNotice] = useState("");
  const [manualCopy, setManualCopy] = useState("");
  const reviewRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const fresh = reviewedJob === job;
  function findRequirements(jobText = job, resumeText = resume) {
    if (!jobText.trim() || !resumeText.trim()) {
      setNotice("Paste both a job description and your resume to continue.");
      return;
    }
    const detected = detect(jobText);
    setRequirements(detected);
    setReviewedJob(jobText);
    setResults(null);
    setNotice(
      detected.length
        ? "Review the requirements below, then check your resume."
        : "No supported skills detected. Add a requirement below to continue.",
    );
  }
  function addRequirement(event: React.FormEvent) {
    event.preventDefault();
    const next = canonical(term);
    if (!next) return;
    if (
      requirements.some((value) => value.toLowerCase() === next.toLowerCase())
    ) {
      setNotice(next + " is already in your requirements.");
      return;
    }
    setRequirements([...requirements, next]);
    setTerm("");
    setResults(null);
    setNotice("Requirement added.");
  }
  function check() {
    if (!fresh || !resume.trim() || !requirements.length) {
      setNotice(
        "Review your current job requirements and enter a resume first.",
      );
      return;
    }
    setResults(analyse(resume, requirements));
    setFilter("all");
    setNotice(
      "Review complete. Select a status to focus on those requirements.",
    );
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Suggestion copied.");
    } catch {
      setManualCopy(text);
      setNotice("Select the text below and copy it manually.");
    }
  }
  function example() {
    setJob(sampleJob);
    setResume(sampleResume);
    setTerm("");
    setManualCopy("");
    setFilter("all");
    findRequirements(sampleJob, sampleResume);
    requestAnimationFrame(() =>
      reviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
  }
  function clear() {
    if (
      (job || resume) &&
      !window.confirm("Clear both inputs and all current results?")
    )
      return;
    setJob("");
    setResume("");
    setRequirements([]);
    setResults(null);
    setReviewedJob(null);
    setTerm("");
    setNotice("Workspace cleared.");
    setManualCopy("");
  }
  const visibleResults = results?.filter(
    (result) => filter === "all" || result.status === filter,
  );
  return (
    <div className="app">
      <header>
        <a className="brand" href="#" aria-label="FirstJob home">
          <span aria-hidden="true">f.</span>FirstJob
        </a>
        <div className="header-note">
          <span aria-hidden="true">◇</span> Your next chapter starts here
        </div>
        <button className="example-button" onClick={example}>
          Try an example
        </button>
      </header>
      <main>
        <section className="intro">
          <div className="intro-copy">
            <p className="eyebrow">RESUME CHECKER FOR STUDENTS</p>
            <h1>
              Your experience.
              <br />
              <em>Better explained.</em>
            </h1>
            <p className="lead">
              See how your resume connects to the role you want. Find the
              evidence, spot the gaps, and make every project count.
            </p>
            <div className="privacy">
              <span aria-hidden="true">▣</span> Checked in your browser · No
              account needed
            </div>
          </div>
          <div className="preview-card" aria-hidden="true">
            <div className="preview-top">
              <span>MY COURSE PROJECT</span>
              <span>✓</span>
            </div>
            <strong>
              “Used MySQL to store
              <br />
              player scores.”
            </strong>
            <div className="preview-rule"></div>
            <span className="status example">SQL · Example found</span>
            <p>Start with what you’ve already done.</p>
          </div>
        </section>
        <section className="input-section" aria-labelledby="input-title">
          <div className="section-heading">
            <div>
              <h2 id="input-title">Bring the role and your resume together</h2>
              <p>
                Coursework, group projects and part-time experience all belong
                here.
              </p>
            </div>
            <button className="text-button" onClick={clear}>
              Clear workspace
            </button>
          </div>
          <div className="input-grid">
            <div className="input-card">
              <div className="card-heading">
                <label htmlFor="job">Job description</label>
                <span>THE OPPORTUNITY</span>
              </div>
              <textarea
                id="job"
                value={job}
                onChange={(event) => {
                  setJob(event.target.value);
                  setResults(null);
                  setManualCopy("");
                }}
                placeholder="Paste the internship or entry-level job description here…"
              />
              <div className="card-footer">
                Include the skills and requirements for the role.
              </div>
            </div>
            <div className="input-card">
              <div className="card-heading">
                <label htmlFor="resume">Your resume</label>
                <span>YOUR EXPERIENCE</span>
              </div>
              <textarea
                id="resume"
                value={resume}
                onChange={(event) => {
                  setResume(event.target.value);
                  setResults(null);
                  setManualCopy("");
                }}
                placeholder="Paste your resume text, including skills, projects and experience…"
              />
              <div className="card-footer">
                Your text stays in this tab and is cleared on reload.
              </div>
            </div>
          </div>
          <div className="input-actions">
            <p className="muted">
              Start with an English resume and job description.
            </p>
            <button className="primary" onClick={() => findRequirements()}>
              Find requirements
            </button>
          </div>
        </section>
        {reviewedJob !== null && fresh && (
          <section
            className="review-panel"
            ref={reviewRef}
            aria-labelledby="review-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="review-title">
                  Make sure we’ve got the requirements right
                </h2>
                <p>Remove anything irrelevant or add something we missed.</p>
              </div>
              <span className="count">{requirements.length} requirements</span>
            </div>
            <div className="tags">
              {requirements.map((value) => (
                <button
                  className="tag"
                  key={value}
                  aria-label={"Remove " + value}
                  onClick={() => {
                    setRequirements(
                      requirements.filter((item) => item !== value),
                    );
                    setResults(null);
                  }}
                >
                  {value}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            {!requirements.length && (
              <p className="muted">
                Add at least one requirement to start your review.
              </p>
            )}
            <div className="review-bottom">
              <form onSubmit={addRequirement} className="add-form">
                <label className="sr-only" htmlFor="term">
                  Add a requirement
                </label>
                <input
                  id="term"
                  value={term}
                  maxLength={100}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Add a skill or requirement"
                />
                <button type="submit">Add</button>
              </form>
              <button
                className="primary"
                disabled={!requirements.length || !resume.trim()}
                onClick={check}
              >
                {results ? "Check again" : "Check my resume"}
              </button>
            </div>
            <p className="small-note">
              Common IT skills are detected automatically. Added phrases are
              matched as written, so review their wording.
            </p>
          </section>
        )}
        {reviewedJob !== null && !fresh && (
          <div className="update-note">
            Job description updated. Select “Find requirements” to review the
            new requirements.
          </div>
        )}
        {results && (
          <section
            className="results"
            ref={resultRef}
            aria-labelledby="result-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR RESUME REVIEW</p>
                <h2 id="result-title">A clearer picture of your experience</h2>
                <p>
                  Use these suggestions to describe work you have actually done.
                </p>
              </div>
              <button onClick={check}>Check again</button>
            </div>
            <div className="summary">
              <button
                className={filter === "all" ? "selected" : ""}
                onClick={() => setFilter("all")}
              >
                <strong>{results.length}</strong>All requirements
              </button>
              {(["example", "mentioned", "missing"] as Status[]).map(
                (status) => (
                  <button
                    key={status}
                    className={
                      filter === status ? "selected " + status : status
                    }
                    onClick={() => setFilter(status)}
                  >
                    <strong>
                      {results.filter((item) => item.status === status).length}
                    </strong>
                    {statusLabels[status]}
                  </button>
                ),
              )}
            </div>
            <div className="results-table">
              <div className="table-heading">
                <span>REQUIREMENT</span>
                <span>YOUR RESUME EVIDENCE</span>
                <span>YOUR NEXT EDIT</span>
              </div>
              {visibleResults?.map((result) => (
                <article className="result-row" key={result.term}>
                  <div>
                    <h3>{result.term}</h3>
                    <span className={"status " + result.status}>
                      {statusLabels[result.status]}
                    </span>
                  </div>
                  <div className="evidence">
                    <span className="mobile-label">Resume evidence</span>
                    {result.evidence ? (
                      <blockquote>{result.evidence}</blockquote>
                    ) : (
                      <p className="muted">No matching line in your resume.</p>
                    )}
                  </div>
                  <div>
                    <span className="mobile-label">Suggested improvement</span>
                    <p>{result.suggestion}</p>
                    <button
                      className="copy-button"
                      onClick={() => copy(result.suggestion)}
                    >
                      Copy suggestion
                    </button>
                  </div>
                </article>
              ))}
              {visibleResults?.length === 0 && (
                <p className="empty">No requirements in this category.</p>
              )}
            </div>
            <p className="small-note">
              This review uses text rules. Check the quoted evidence and adapt
              suggestions to your real experience.
            </p>
          </section>
        )}
        <p className="notice" role="status" aria-live="polite">
          {notice}
        </p>
        {manualCopy && (
          <label>
            Copy this suggestion
            <textarea
              className="manual-copy"
              readOnly
              value={manualCopy}
              onFocus={(event) => event.target.select()}
            />
          </label>
        )}
        <footer>
          <span className="footer-brand">FirstJob</span>
          <span>Make your first impression your own.</span>
        </footer>
      </main>
    </div>
  );
}
