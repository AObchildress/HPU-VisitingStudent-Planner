"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Level = "Undergraduate" | "Graduate";

type Course = {
  id: string;
  level: Level;
  college: string;
  campus: string;
  crn: string;
  code: string;
  title: string;
  days: string[];
  begin: string;
  end: string;
  method: string;
  term: string;
  credits: number;
  prerequisite: string;
  description: string;
  corequisite: string;
};

type CourseDetail = Pick<Course, "description" | "corequisite">;

const DRIVE_URL =
  "https://drive.google.com/drive/folders/1JUeKdM27jF4DXjzSjXLi6VSF-ILM7nbP?usp=sharing";
const DAY_NAMES: Record<string, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
};
const DAYS = ["M", "T", "W", "R", "F"];
const PALETTES = [
  ["#cfe7f0", "#002856"],
  ["#fff0bd", "#624a00"],
  ["#dce8f7", "#002856"],
  ["#edf1ad", "#394000"],
  ["#fee2c7", "#7d3e00"],
];

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function splitDays(value: string) {
  return value
    .split(/[,/\s]+/)
    .map((day) => day.trim().toUpperCase())
    .filter((day) => DAYS.includes(day));
}

function buildCourseDetails(csv: string) {
  const [header, ...rows] = parseCsv(csv);
  const details = new Map<string, CourseDetail>();
  if (!header) return details;
  const index = (name: string) => header.findIndex((cell) => cell.trim() === name);
  rows.forEach((row) => {
    const code = row[index("Course")]?.trim();
    if (!code) return;
    details.set(code, {
      description: row[index("Description")]?.trim() || "",
      corequisite: row[index("Co-requisite")]?.trim() || "",
    });
  });
  return details;
}

function buildCourses(csv: string, level: Level, details: Map<string, CourseDetail>): Course[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const index = (name: string) => header.findIndex((cell) => cell.trim() === name);
  return rows
    .map((row) => {
      const code = row[index("Course")]?.trim() || "";
      const crn = row[index("CRN")]?.trim() || "";
      const detail = details.get(code);
      return {
        id: `${level}-${crn}-${code}`,
        level,
        college: row[index("College")]?.trim() || "Other",
        campus: row[index("Campus")]?.trim() || "Campus not listed",
        crn,
        code,
        title: row[index("Title")]?.trim() || "",
        days: splitDays(row[index("Meeting Days")] || ""),
        begin: row[index("Begin Time")]?.trim() || "",
        end: row[index("End Time")]?.trim() || "",
        method:
          level === "Graduate"
            ? row[index("Instructional Method")]?.trim() || "See course listing"
            : "See course listing",
        term:
          level === "Graduate"
            ? row[index("Part of Term")]?.trim() || "Fall 2026"
            : "Fall 2026",
        credits: Number.parseFloat(row[index("Credits")] || "0") || 0,
        prerequisite: row[index("Pre-req?")]?.trim() || "",
        description: detail?.description || "Course description not available.",
        corequisite: detail?.corequisite || "",
      };
    })
    .filter((course) => course.code && course.title);
}

function toMinutes(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

function overlaps(a: Course, b: Course) {
  const startA = toMinutes(a.begin);
  const endA = toMinutes(a.end);
  const startB = toMinutes(b.begin);
  const endB = toMinutes(b.end);
  return (
    startA !== null &&
    endA !== null &&
    startB !== null &&
    endB !== null &&
    a.days.some((day) => b.days.includes(day)) &&
    startA < endB &&
    startB < endA
  );
}

function formatMeeting(course: Course) {
  if (!course.days.length || !course.begin) return "Meeting time not listed";
  return `${course.days.map((day) => DAY_NAMES[day]?.slice(0, 3)).join(" · ")} · ${course.begin}–${course.end}`;
}

async function fetchCsv(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.text();
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [level, setLevel] = useState<Level>("Undergraduate");
  const [query, setQuery] = useState("");
  const [college, setCollege] = useState("All colleges");
  const [campus, setCampus] = useState("All campuses");
  const [selected, setSelected] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<"courses" | "schedule">("courses");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchCsv("/undergraduate.csv"),
      fetchCsv("/graduate.csv"),
      fetchCsv("/course-details.csv"),
    ])
      .then(([undergraduate, graduate, courseDetails]) => {
        const details = buildCourseDetails(courseDetails);
        setCourses([
          ...buildCourses(undergraduate, "Undergraduate", details),
          ...buildCourses(graduate, "Graduate", details),
        ]);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));

    const storageFrame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem("hpu-course-plan");
        if (saved) setSelected(JSON.parse(saved));
      } catch {
        // Keep planning available when browser storage is unavailable.
      }
    });

    return () => window.cancelAnimationFrame(storageFrame);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("hpu-course-plan", JSON.stringify(selected));
    } catch {
      // The schedule remains usable for the current session.
    }
  }, [selected]);

  const levelCourses = useMemo(
    () => courses.filter((course) => course.level === level),
    [courses, level],
  );
  const colleges = useMemo(
    () => [...new Set(levelCourses.map((course) => course.college))].sort(),
    [levelCourses],
  );
  const campuses = useMemo(
    () => [...new Set(levelCourses.map((course) => course.campus))].sort(),
    [levelCourses],
  );
  const visibleCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return levelCourses.filter(
      (course) =>
        (college === "All colleges" || course.college === college) &&
        (campus === "All campuses" || course.campus === campus) &&
        (!needle ||
          `${course.code} ${course.title} ${course.crn} ${course.college} ${course.description}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [levelCourses, query, college, campus]);
  const chosenCourses = useMemo(
    () => selected.map((id) => courses.find((course) => course.id === id)).filter(Boolean) as Course[],
    [selected, courses],
  );
  const conflicts = useMemo(() => {
    const ids = new Set<string>();
    chosenCourses.forEach((course, index) => {
      chosenCourses.slice(index + 1).forEach((other) => {
        if (overlaps(course, other)) {
          ids.add(course.id);
          ids.add(other.id);
        }
      });
    });
    return ids;
  }, [chosenCourses]);
  const totalCredits = chosenCourses.reduce((total, course) => total + course.credits, 0);

  function changeLevel(next: Level) {
    setLevel(next);
    setCollege("All colleges");
    setCampus("All campuses");
  }

  function toggleCourse(course: Course) {
    setSelected((current) =>
      current.includes(course.id)
        ? current.filter((id) => id !== course.id)
        : [...current, course.id],
    );
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="HPU course planner home">
          <Image className="brand-logo" src="/hpu-primary-logo.png" alt="Hawai‘i Pacific University" width={1000} height={350} priority />
          <span className="brand-divider" aria-hidden="true" />
          <span className="planner-identity"><strong>Course Planner</strong><small>International Visiting Students</small></span>
        </a>
        <a className="source-link" href={DRIVE_URL} target="_blank" rel="noreferrer">
          Open source folder <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Fall 2026 · Pre-approved courses</div>
        <h1>Build a semester that<br /><em>fits your island life.</em></h1>
        <p>
          Explore courses already approved for visiting students, then add classes to see your week take shape.
        </p>
        <div className="hero-notes">
          <span><b>✓</b> Sourced from HPU’s shared course lists</span>
          <span><b>✓</b> Your plan saves on this device</span>
        </div>
      </section>

      <div className="mobile-switch" aria-label="Choose planner view">
        <button className={mobileView === "courses" ? "active" : ""} onClick={() => setMobileView("courses")}>Courses</button>
        <button className={mobileView === "schedule" ? "active" : ""} onClick={() => setMobileView("schedule")}>My schedule <span>{selected.length}</span></button>
      </div>

      <section className="planner">
        <div className={`catalog ${mobileView === "schedule" ? "mobile-hidden" : ""}`}>
          <div className="section-heading">
            <div><span className="step">01</span><h2>Find your courses</h2></div>
            <span>{loading ? "Loading…" : `${visibleCourses.length} courses`}</span>
          </div>

          <div className="level-tabs" role="tablist" aria-label="Student level">
            {(["Undergraduate", "Graduate"] as Level[]).map((option) => (
              <button key={option} role="tab" aria-selected={level === option} onClick={() => changeLevel(option)}>
                {option}
              </button>
            ))}
          </div>

          <div className="filters">
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course, title, or CRN" />
            </label>
            <label>
              <span className="sr-only">Filter by college</span>
              <select value={college} onChange={(event) => setCollege(event.target.value)}>
                <option>All colleges</option>
                {colleges.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by campus</span>
              <select value={campus} onChange={(event) => setCampus(event.target.value)}>
                <option>All campuses</option>
                {campuses.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>

          <div className="course-list" aria-live="polite">
            {loadError && (
              <div className="empty-results"><strong>Course data could not be loaded.</strong><span>Please refresh the page and try again.</span></div>
            )}
            {!loading && !loadError && visibleCourses.length === 0 && (
              <div className="empty-results"><strong>No courses found.</strong><span>Try a different search or filter.</span></div>
            )}
            {visibleCourses.map((course) => {
              const isSelected = selected.includes(course.id);
              return (
                <article className={`course-card ${isSelected ? "selected" : ""}`} key={course.id}>
                  <div className="course-topline">
                    <span className="course-code">{course.code}</span>
                    <span className="crn">CRN {course.crn}</span>
                    <span className="credits">{course.credits} {course.credits === 1 ? "credit" : "credits"}</span>
                  </div>
                  <h3>{course.title}</h3>
                  <p className="college">{course.college}</p>
                  <p className="course-description">{course.description}</p>
                  <div className="course-details">
                    <span><i aria-hidden="true">◷</i>{formatMeeting(course)}</span>
                    <span><i aria-hidden="true">⌖</i>{course.campus}</span>
                    {course.term !== "Fall 2026" && <span><i aria-hidden="true">◫</i>{course.term}</span>}
                  </div>
                  {course.corequisite && <p className="coreq"><strong>Co-requisite:</strong> {course.corequisite}</p>}
                  {course.prerequisite && <p className="prereq">Prerequisite note: {course.prerequisite}</p>}
                  <button className="add-course" onClick={() => toggleCourse(course)} aria-pressed={isSelected}>
                    <span>{isSelected ? "✓" : "+"}</span>{isSelected ? "Added to schedule" : "Add to schedule"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <aside className={`schedule-panel ${mobileView === "courses" ? "mobile-hidden" : ""}`}>
          <div className="schedule-card">
            <div className="section-heading schedule-heading">
              <div><span className="step coral">02</span><h2>Your weekly schedule</h2></div>
              {selected.length > 0 && <button className="clear" onClick={() => setSelected([])}>Clear all</button>}
            </div>
            <div className="schedule-summary">
              <span><strong>{selected.length}</strong> {selected.length === 1 ? "course" : "courses"}</span>
              <span><strong>{totalCredits}</strong> credits</span>
              {conflicts.size > 0 && <span className="conflict-count"><strong>{conflicts.size}</strong> in conflict</span>}
            </div>

            {chosenCourses.length === 0 ? (
              <div className="empty-schedule">
                <div className="mini-calendar" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
                <h3>Your week is wide open</h3>
                <p>Add a course and it will appear here on your calendar.</p>
              </div>
            ) : (
              <>
                {conflicts.size > 0 && (
                  <div className="conflict-banner"><strong>Schedule conflict</strong><span>Courses outlined in coral overlap.</span></div>
                )}
                <WeeklyCalendar courses={chosenCourses} conflictIds={conflicts} />
                <div className="selected-list">
                  {chosenCourses.map((course, index) => (
                    <div key={course.id}>
                      <span className="color-dot" style={{ background: PALETTES[index % PALETTES.length][0] }} />
                      <span><strong>{course.code}</strong><small>{formatMeeting(course)}</small></span>
                      <button onClick={() => toggleCourse(course)} aria-label={`Remove ${course.code}`}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="planner-note">This planner does not register you for classes. Course availability and details may change.</p>
          </div>
        </aside>
      </section>

      <footer>
        <div className="footer-brand">
          <Image src="/hpu-primary-white.png" alt="Hawai‘i Pacific University" width={1000} height={350} />
          <p><strong>Course Planner</strong><span>International visiting students · Fall 2026</span></p>
        </div>
        <a href={DRIVE_URL} target="_blank" rel="noreferrer">View official course lists ↗</a>
      </footer>
    </main>
  );
}

function WeeklyCalendar({ courses, conflictIds }: { courses: Course[]; conflictIds: Set<string> }) {
  const START = 8 * 60;
  const END = 22 * 60;
  const hours = Array.from({ length: 15 }, (_, index) => index + 8);
  return (
    <div className="calendar-shell">
      <div className="calendar-header"><span />{DAYS.map((day) => <strong key={day}>{DAY_NAMES[day].slice(0, 3)}</strong>)}</div>
      <div className="calendar-body" style={{ "--hours": hours.length - 1 } as React.CSSProperties}>
        <div className="time-axis">{hours.map((hour) => <span key={hour} style={{ top: `${((hour * 60 - START) / (END - START)) * 100}%` }}>{hour > 12 ? hour - 12 : hour}{hour >= 12 ? "p" : "a"}</span>)}</div>
        {DAYS.map((day) => (
          <div className="day-column" key={day}>
            {courses.flatMap((course, courseIndex) => {
              if (!course.days.includes(day)) return [];
              const start = toMinutes(course.begin);
              const end = toMinutes(course.end);
              if (start === null || end === null) return [];
              const top = ((start - START) / (END - START)) * 100;
              const height = ((end - start) / (END - START)) * 100;
              const [background, color] = PALETTES[courseIndex % PALETTES.length];
              return (
                <div
                  className={`calendar-event ${conflictIds.has(course.id) ? "conflict" : ""}`}
                  key={`${course.id}-${day}`}
                  style={{ top: `${top}%`, height: `${Math.max(height, 4)}%`, background, color }}
                  title={`${course.code}: ${course.title}`}
                >
                  <strong>{course.code}</strong><span>{course.begin}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
