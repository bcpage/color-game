# Claude Code — Estimation Guide
# How to plan work within a quota window
Version 1.0 — based on calibration data from real project runs

---

## The One Rule

**Reading is expensive. Writing is cheap.**

Every estimate starts by counting how many files Claude Code
needs to READ before it can do any work. That is where the cost is.
The actual writing — code, markdown, config — costs far less than
most people expect.

If you remember nothing else, remember this.

---

## Why Estimation Is Hard

Claude Code's quota is consumed by tokens — not time, not lines of
code, not number of files. Tokens are the unit of work.

Token cost is driven by:
- **Input tokens:** every file Claude Code reads, every instruction
  it processes, every line of existing code it loads into context
- **Output tokens:** every line of code or text it generates

Input and output cost differently. Input (reading) tends to dominate
on complex tasks because Claude Code needs to understand context
before it can produce anything useful.

This is why a task that "should be simple" sometimes burns through
quota faster than expected — Claude Code read three files you
didn't think to count.

---

## The Cost Hierarchy

From most expensive to least:

### Most expensive — Large file reads
Opening a file over ~50KB costs 4-8 pts before Claude Code
does anything else. If a task requires reading multiple large
files, that cost stacks.

**Validated reference point:** Reading a ~200KB file, cross-referencing
it against a second file, and writing two output files costs
**15-20 pts** in a fresh session. This range is confirmed from
real project data. Use it as a benchmark for similar tasks.

**Examples of large files:**
- A compiled/bundled JS or CSS file
- A large spec or documentation file
- A database schema with many tables
- A long server file that handles many routes

### Expensive — Session startup
The first task of any session costs 5-6 pts just for Claude Code
to orient itself — reading CLAUDE.md (if you have one), checking
project state, understanding what it's working with.

**Rule:** Never start a session by immediately asking for complex
work. A quick orientation task first (read the index, summarize
current state) loads context cheaply and makes everything after
it faster.

### Moderate — Writing substantial code
Writing 200-500 lines of code costs 5-12 pts depending on
complexity. Writing under 200 lines costs 2-6 pts.
Writing markdown or config is nearly free regardless of length.

**Exception — self-contained room/page builds:** Writing a batch
of standalone HTML rooms (each 80-280 lines, no cross-file
dependencies, no debugging) costs roughly **1-2 pts per room**
regardless of room complexity. Four confirmed data points put
9 rooms at 14 pts total, 7 rooms at 11 pts total. If the task
is "write N independent files from spec," use 1.5 pts × N,
not the per-file line-count table above.

### Cheap — Sequential operations on warm context
After Claude Code reads a file in chunk 1, chunks 2 and 3 of
the same task reuse that loaded context. The cost per chunk
drops dramatically after the first.

### Nearly free — File system operations
Creating folders, moving files, deleting files, running shell
commands, writing short files — all cost essentially nothing.

---

## The First-Chunk Effect

In any multi-step task, the first step costs 2-3x more than
subsequent steps of the same type.

**Why:** Step 1 is when Claude Code reads all the reference material
it needs. Steps 2, 3, 4 reuse what is already in context.

**What this means for planning:**
- Do not judge a phase by its first chunk
- Budget extra for chunk 1, less for everything after
- If you are running low on quota, finishing a phase is cheaper
  than starting a new one

---

## The Five-Step Estimation Process

Run through these steps before planning any Claude Code session.

### Step 1 — Count the reads

List every file Claude Code will need to open before starting work.
Be honest — include files it will read "just to understand context."

For each file ask: how large is it?
- Under 10KB: nearly free (~0-1 pts)
- 10-50KB: moderate (~1-3 pts)
- 50-100KB: expensive (~4-6 pts)
- Over 100KB: very expensive (~8-12 pts)

Sum these up. This is your baseline cost before any work begins.

### Step 2 — Estimate the write

What is Claude Code actually producing?

- Config, markdown, short scripts under 100 lines: ~1-2 pts
- Standard code file 100-300 lines: ~3-6 pts
- Complex code file 300-500 lines: ~6-10 pts
- Multiple files totalling 500+ lines: ~10-18 pts

**If the task is N independent self-contained files (rooms, pages,
components) built from clear specs with no expected debugging:**
use **1.0–1.5 pts × N** instead of the table above.
- Fresh session or first batch: use 1.5 pts × N (context loading adds cost)
- Continuing warm session: use 1.0 pts × N (context already loaded, overhead near zero)

The table above was calibrated for single-file tasks with cross-file
context loading. Batch independent writes are significantly cheaper.
Four data points: 7 rooms = 11 pts (1.57/room), 9 rooms = 14 pts (1.56/room),
5 rooms = 5 pts (1.0/room warm session). Warm session cost is noticeably lower.

### Step 3 — Add session startup if applicable

First task of a fresh session: add 5-6 pts.
Continuing mid-session with context already loaded: add 0.

### Step 4 — Add a debugging buffer

Clear requirements, simple task: add 0-3 pts.
Moderate complexity or some uncertainty: add 3-8 pts.
Complex, visual, or iterative work: add 8-15 pts.

One round of "that's not quite right, adjust it" costs roughly
the same as the original attempt. If you expect iteration,
budget for it explicitly.

### Step 5 — Check your total against your window

Add steps 1-4. That is your estimate.

If the total exceeds your comfortable chunk size (typically
20-30 pts for predictable work), split the task. Identify a
natural breakpoint — a point where Claude Code will have
produced something verifiable — and plan to pause there.

---

## Patterns That Inflate Cost

These are the most common reasons a task costs more than estimated,
ranked by how often they happen.

### 1. Unexpected file reads
Claude Code decides it needs context you didn't plan for — it opens
a config file, reads a dependency, checks an existing file before
modifying it. Each unplanned read adds 1-6 pts depending on file size.

**Mitigate:** Be explicit in your instructions. "Do not read any
file I have not specifically asked you to read." Claude Code
follows this reliably.

### 2. Debugging iterations
One revision round costs roughly as much as the original task.
Two revision rounds and you have tripled the cost of a task you
planned as a single operation.

**Mitigate:** Write a clear spec before asking Claude Code to build.
The clearer the requirements, the fewer iterations. A 10-minute
spec saves 20 pts.

### 3. Long output
A 600-line file costs twice as much to generate as a 300-line file.
Asking for "everything at once, polished" produces long output.
Asking for a working skeleton first, then iterating, produces
shorter output per step even if the total lines are the same.

**Mitigate:** Ask for structure first, details second. Two shorter
outputs usually cost less than one long one.

### 4. Ambiguous instructions
Claude Code makes a wrong assumption, builds something, you redirect
it, it rebuilds. The wrong build cost as much as the right one will.

**Mitigate:** Spend 2 minutes clarifying before starting. Ask Claude
Code to describe its plan before executing it. Approval costs
almost nothing. Rework costs the same as original work.

### 5. Fresh session penalty on complex tasks
Opening a session and immediately asking for a 40-pt task means
the 5-6 pt startup cost hits you at the worst time. You have less
context loaded and the task costs more than it would mid-session.

**Mitigate:** Start sessions with a lightweight orientation step.
"Read X and tell me the current state." This costs 1-2 pts and
loads the context that makes everything else cheaper.

---

## Chunking Strategy

For tasks too large to do in one shot, break them into chunks
with natural verification points between them.

**A good chunk:**
- Produces something you can verify (a file exists, a feature works)
- Has a clear stopping point that does not leave things broken
- Costs 5-20 pts depending on your risk tolerance

**Chunk size guidelines:**

| Risk tolerance | Chunk size | Why |
|---|---|---|
| Conservative | 5-10 pts | Maximum control, easy to recover |
| Moderate | 10-20 pts | Balanced — good progress per check |
| Aggressive | 20-40 pts | Fast but harder to diagnose if something goes wrong |

**Always verify between chunks.** A quick `ls` or a file read to
confirm the output exists costs nothing and prevents cascading
errors in subsequent chunks.

---

## The Status File Pattern

For any multi-session or multi-phase job, maintain a small status
tracking file in the repo. Claude Code reads it at the start of
each session, skips completed phases, and resumes from where it
left off.

This makes every large job crash-safe and quota-safe.

**Minimum viable status file:**

```
# Setup Status
Started: [date]

## Phases
- [x] Phase 1 — Description (complete)
- [ ] Phase 2 — Description (in progress)
- [ ] Phase 3 — Description (not started)

## Current position
Phase 2, chunk 3 of 5
Last completed: item X
Next: item Y
```

**The resume instruction to include in any long prompt:**

"Before doing anything, check if [STATUS_FILE] exists.
If it does, read it and resume from the first incomplete item.
If it does not, this is a fresh start — begin Phase 1."

---

## Estimation Accuracy Log

Track your estimates against actuals. This is how the estimates
in this document get better over time — and how your own
intuition calibrates.

**Record usage BEFORE starting each chunk, not just after.**
If you only record "after," you cannot calculate the actual cost
of that chunk.

```
| Task / Chunk | Est. pts | Usage before | Usage after | Actual pts | Ratio |
|---|---|---|---|---|---|
| Phase 1 | 5 pts | 0% | 6% | 6 pts | 1.2x |
| Task A chunk 1 | 5 pts | 6% | 13% | 7 pts | 1.4x |
| Task A chunk 2 | 5 pts | 13% | 14% | 1 pt | 0.2x |
```

**Reading your ratio column:**

| Ratio | Meaning | Action |
|---|---|---|
| > 1.5x | Consistently underestimating | Add more read cost to future estimates |
| 1.0-1.5x | Good estimates | No change needed |
| 0.5-1.0x | Consistently overestimating | Reduce write cost in future estimates |
| < 0.5x | Massively overestimating | You are counting writing as expensive — it isn't |

A ratio below 0.5x usually means the task was mostly writing
with less reading than expected. That is the cheapest kind of work.
A ratio above 1.5x usually means an unexpected file read happened.

---

## Quick Planning Reference

### Under 10 pts — safe for any remaining window
- Writing a short new file from scratch
- Modifying one existing small file
- Running verification or audit tasks
- Any file system reorganization

### 10-25 pts — plan before starting
- Building one moderate feature or component
- Refactoring one file with context needed
- Writing several related files
- Any task requiring reading 2-3 existing files first

### 25-50 pts — use a fresh session
- Building a complex feature end to end
- Tasks requiring reading large reference files
- Anything with significant debugging expected
- Multi-file changes with dependencies between them

### 50+ pts — consider splitting
- Full feature with tests and documentation
- Large refactors touching many files
- Anything where requirements are not yet fully clear

---

## Calibration Log

Record project-level calibration runs here to track how
accurate these guidelines are over time.

| Date | Project | Task type | Est. total | Actual total | Ratio | Notes |
|---|---|---|---|---|---|---|
| 2026-05-23 | NULL | Repo restructure, 52 SPEC files (phases 1-6, 8-11) | 86 pts | ~45 pts | 1.9x over | Writing was 4x cheaper than estimated. Reads underestimated. |
| 2026-05-23 | NULL | Large file cross-reference: read 200KB, compare, write 2 output files (phase 7) | 17 pts | 18 pts | 1.0x | Most accurate estimate of the project. Validates large-file-read cost range. |
| 2026-05-23 | NULL | Full project total across both windows | 103 pts | 63 pts | 1.63x over | Writing phases drove the overestimate. Large file phase was accurate. |
| 2026-05-23 | NULL | 7 quick-win rooms (session started at 46% used); read 2 small files for nav context, wrote 7 HTML + 7 SPEC.md + updated 4 files | ~17 pts est. | 11 pts actual | 1.55x over | Measured post-completion (46%→57%). Writing 7 rooms cost far less than estimated — the 3 empty rooms (~15 lines each) barely registered, and even the larger rooms (Man Page ~280 lines, Illegal Prime ~230 lines) were cheap output. Pattern holds: writing is cheap, reading drives cost. |
| 2026-05-23 | NULL | 9 rooms (00059–00067): 4 paradox rooms, 3 canvas games, river crossing puzzle, countdown timer; read minimal (nav tail only); wrote 9 HTML + 9 SPEC.md + updated 4 files | ~28 pts est. | 14 pts actual | 2.0x over | Measured post-completion (64%→78%). Worst write-heavy overestimate yet. Canvas games (Pong, Snake, Breakout) estimated at 4 pts each — actually ~1.5 pts each. Batch of independent rooms consistently runs ~1.5 pts/room regardless of complexity. |
| 2026-05-23 | NULL | 5 rooms (00068–00072): 2 static content, 2 dead rooms, 1 input room; wrote 5 HTML + 5 SPEC.md + updated 4 files | ~9.5 pts est. | 5 pts actual | 1.9x over | Measured post-completion (78%→83%). 1.5 pts/room rule predicted 7.5 pts write + 2 pts overhead = 9.5 pts. Actual was 5 pts. Overhead was ~0 (context warm, minimal reads). Rule still overshoots by ~2x. True cost for warm-session trivial rooms is closer to 1.0 pts/room. |
| 2026-05-23 | NULL | 5 rooms (00073–00077): Prime Generator, Jump Scare, Black Hole, Switchboard, Wrong Space Invaders; session started at 84% after context compaction; wrote 5 HTML + 5 SPEC.md + updated 4 files | ~8.5 pts est. | 9 pts actual | 0.94x (accurate) | Measured post-completion (84%→93%). Most accurate estimate yet — essentially on-target. Post-compaction continuation behaves like a fresh session: summary context adds overhead similar to cold start. 1.5 pts/room fresh-session rate confirmed (9 pts / 5 rooms = 1.8 pts/room including overhead). |

Add rows as data is collected. If the ratio column drifts
consistently above 1.5x or below 0.7x, revise the base
cost hierarchy at the top of this document.
