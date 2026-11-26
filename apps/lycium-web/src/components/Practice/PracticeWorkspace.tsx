"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ToolWorkspaceHeader from "../Tools/ToolWorkspaceHeader";
import "../Tools/toolFrame.css";
import { checkPracticeAnswer, generateProblem, parsePracticeConfig, practiceCatalog } from "./practiceEngine";
import { Equation, EquationChoices, QuantityCard } from "./PracticeInteractions";
import { emptyWork, readSession, SESSION_KEY, startSession, type Attempt, type PracticeWork } from "./practiceSession";
import "./practice.css";

const initial = practiceCatalog[0];
const format = (value: unknown) => JSON.stringify(value, null, 2);

export default function PracticeWorkspace() {
  const [session, setSession] = useState(() => startSession([initial]));
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [draft, setDraft] = useState(() => format(initial));
  const [seedDraft, setSeedDraft] = useState("0");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([initial.id]);
  const [mode, setMode] = useState<"guided" | "independent">("guided");
  const [length, setLength] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = practiceCatalog.find(item => item.id === params.get("skill"));
    const saved = readSession();
    const showPreview = params.has("skill") || params.has("setup") || !saved;
    const restored = showPreview ? startSession([requested ?? initial], 0, "guided", 10) : saved;
    setPreview(showPreview);
    setSession(restored);
    setSelected(restored.skills.map(item => item.id));
    setMode(restored.mode);
    setLength(restored.length);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || preview) return;
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [ready, preview, session]);

  const skill = session.skills[session.index % session.skills.length];
  const seed = (session.seed + session.index) >>> 0;
  useEffect(() => {
    setDraft(format(skill));
    setSeedDraft(String(seed));
  }, [skill, seed]);

  function apply() {
    try {
      const skill = parsePracticeConfig(JSON.parse(draft));
      const seed = seedDraft.trim() ? Number(seedDraft) : NaN;
      generateProblem(skill, seed);
      setSession(startSession([skill], seed, mode, length));
      setSelected([skill.id]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid generation settings.");
    }
  }

  const finished = session.ended || (session.length > 0 && session.index >= session.length);
  const options = [...practiceCatalog.map(item => session.skills.find(active => active.id === item.id) ?? item),
    ...session.skills.filter(item => !practiceCatalog.some(entry => entry.id === item.id))];
  const exampleSkill = options.find(item => selected.includes(item.id));
  const example = exampleSkill && generateProblem(exampleSkill, session.seed);
  return <>
    <ToolWorkspaceHeader title="Practice Studio" backHref="/practice" backLabel={preview || finished ? "Practice library" : "Exit practice"} />
    <main className="practice-workspace practice-focused">
      {!ready ? <p role="status">Loading practice…</p> : preview ? <section className="practice-prompt practice-preview">
      <p>Practice / {initial.category}</p>
      <h2>{exampleSkill?.title ?? initial.category}</h2>
      <p>Practice with generated problems. Choose the skills to include in your session.</p>
      <h3>Skills covered</h3>
      {options.map(item => <label className="practice-session-skill" key={item.id}>
        <input type="checkbox" checked={selected.includes(item.id)} onChange={event => {
          const checked = event.target.checked;
          setSelected(previous => checked ? [...previous, item.id] : previous.filter(id => id !== item.id));
        }} /> {item.title}
      </label>)}
      <label>Mode <select value={mode} onChange={event => setMode(event.target.value === "independent" ? "independent" : "guided")}>
        <option value="guided">Guided</option><option value="independent">Independent</option>
      </select></label>
      <label>Session length <select value={length} onChange={event => setLength(Number(event.target.value))}>
        <option value={0}>Open-ended</option><option value={5}>5 problems</option><option value={10}>10 problems</option><option value={20}>20 problems</option>
      </select></label>
      {exampleSkill && example && <div className="practice-quantity">
        <strong>Example problem</strong>
        <span>Find {exampleSkill.answer.label.toLowerCase()} using {example.given} {exampleSkill.given.unit} and {example.factor} {exampleSkill.factor.unit}.</span>
      </div>}
      <button className="practice-primary" type="button" disabled={!selected.length} onClick={() => {
        const skills = options.filter(item => selected.includes(item.id)).map(item => session.skills.find(active => active.id === item.id) ?? item);
        setSession(startSession(skills, session.seed, mode, length));
        setPreview(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("skill");
        url.searchParams.delete("setup");
        window.history.replaceState(null, "", url);
      }}>Start practice</button>
      </section> : finished ? <section className="practice-prompt"><h2>Session results</h2>
        <p>{session.length && !session.ended ? `${session.completed} of ${session.length} problems solved` : `${session.completed} problems solved`}</p>
        <p>{session.attempts.filter(attempt => attempt.result === "incorrect").length} incorrect checks · {session.attempts.filter(attempt => attempt.assisted).length} assisted checks</p>
        <Link href="/practice">Choose another skill</Link>
      </section> : <Problem skill={skill} seed={seed} mode={session.mode} work={session.work}
        position={session.index + 1} length={session.length} completed={session.completed}
        update={(patch, attempt) => setSession(previous => ({
          ...previous,
          work: { ...previous.work, ...patch },
          completed: previous.completed + (patch.step === 2 && previous.work.step !== 2 ? 1 : 0),
          attempts: attempt ? [...previous.attempts, attempt] : previous.attempts,
        }))}
        onNext={() => setSession(previous => ({ ...previous, index: previous.index + 1, work: emptyWork }))} />}
      {ready && !preview && !finished && !session.length && <button type="button" onClick={() => setSession(previous => ({ ...previous, ended: true }))}>Finish session</button>}
      {storageError && <p role="status">This browser could not save your session.</p>}
      {ready && preview && <details>
        <summary>Generation settings</summary>
        <label>Seed <input type="number" min="0" max="4294967295" step="1" value={seedDraft} onChange={event => setSeedDraft(event.target.value)} /></label>
        <label>Skill JSON <textarea rows={12} value={draft} onChange={event => setDraft(event.target.value)} spellCheck={false} /></label>
        <button type="button" onClick={apply}>Apply settings</button>{" "}
        <a href={`data:application/json;charset=utf-8,${encodeURIComponent(format(skill))}`} download="practice-skill.json">Download active skill JSON</a>
        {error && <p role="alert">{error}</p>}
      </details>}
    </main>
  </>;
}

function Problem({ skill, seed, mode, work, position, length, completed, update, onNext }: {
  skill: typeof initial; seed: number; mode: "guided" | "independent"; work: PracticeWork;
  position: number; length: number; completed: number;
  update: (patch: Partial<PracticeWork>, attempt?: Attempt) => void; onNext: () => void;
}) {
  const problem = generateProblem(skill, seed);
  const { operation, answer, feedback, hint, solution } = work;
  const independent = mode === "independent";
  const step = independent && work.step === 0 ? 1 : work.step;
  function attempt(stage: Attempt["stage"], response: string, result: string): Attempt {
    return { skillId: skill.id, version: skill.version, seed, stage, response, result, assisted: work.assisted };
  }

  return <><section className="practice-problem" aria-label="Practice problem">
    <div className="practice-progress"><span>Problem {position}{length ? ` of ${length}` : ""} · {independent ? "Independent" : "Guided"}</span><span>{completed} solved</span></div>
    <progress aria-label="Problem steps completed" max={independent ? 1 : 2} value={independent ? Number(step === 2) : step} />
    <header className="practice-prompt">
      <h2>{skill.title}</h2>
      <p>Use the given quantities to find {skill.answer.label.toLowerCase()}.</p>
      <div className="practice-givens">
        <QuantityCard {...skill.given} value={problem.given} symbol={skill.symbols.first} />
        <QuantityCard {...skill.factor} value={problem.factor} symbol={skill.symbols.second} />
      </div>
      <p className="practice-target"><span>Find</span> <span className="practice-math"><var>{skill.symbols.result}</var> = ? {skill.answer.unit}</span></p>
    </header>
    {step > 0 && (!independent || step === 2) && <section aria-label="Checked work">
      {!independent && <p><Equation operation={operation} {...skill.symbols} /></p>}
      {step === 2 && <p className="practice-math">{skill.symbols.result} = {answer.trim()} {skill.answer.unit}</p>}
    </section>}
    <form onSubmit={event => {
      event.preventDefault();
      if (step === 0) {
        if (!operation) return;
        const correct = operation === skill.operation;
        update({ step: correct ? 1 : 0, feedback: correct ? "Correct equation. Now calculate the result." : "Check which operation leaves you with the requested unit." },
          attempt("equation", operation, correct ? "correct" : "incorrect"));
      } else if (step === 1) {
        const result = checkPracticeAnswer(answer, problem.expected);
        update({
          step: result === "correct" ? 2 : 1,
          feedback: result === "correct" ? "Problem complete. Your answer is correct." : result === "invalid" ? "Enter a decimal or a number in scientific notation." : "Check the calculation and rounding, then try again.",
        }, attempt("answer", answer, result));
      }
    }}>
      {step === 0 && <EquationChoices value={operation} onChange={value => update({ operation: value })} symbols={skill.symbols} />}
      {step === 1 && <label>{independent ? "Calculate the result" : "2. Calculate the result"}
        <small>Round to {skill.answer.decimals} decimal places.</small>
        <span className="practice-answer"><input aria-label={`Answer in ${skill.answer.unit}`} value={answer} inputMode="decimal" onChange={event => update({ answer: event.target.value })} /> {skill.answer.unit}</span>
      </label>}
      {step < 2 && <button className="practice-primary" type="submit" disabled={step === 0 ? !operation : !answer.trim()}>{step === 0 ? "Check step" : "Check answer"}</button>}
      <p role="status">{feedback}</p>
    </form>
    <div className="practice-actions">
      {step < 2 && <button type="button" aria-expanded={hint} onClick={() => update({ hint: !hint, assisted: true })}>Hint</button>}
      <button type="button" aria-expanded={solution} onClick={() => update({ solution: !solution, assisted: true })}>Worked solution</button>
      <button type="button" onClick={onNext}>{position === length ? "Finish session" : step === 2 ? "Next problem" : "Skip problem"}</button>
    </div>
    {hint && <p>{skill.hint}</p>}
    {solution && <p>{skill.hint} {problem.given} {problem.symbol} {problem.factor} ≈ {problem.expected} {skill.answer.unit}.</p>}
  </section>
  <details className="practice-notes">
    <summary>Your work and reference</summary>
    <label>Scratchpad <textarea rows={5} placeholder="Write your calculations here" value={work.notes} onChange={event => update({ notes: event.target.value })} /></label>
    <details><summary>Rounding reference</summary><p>Keep the full value during calculation. Round only the final answer to the requested decimal places.</p></details>
  </details></>;
}
