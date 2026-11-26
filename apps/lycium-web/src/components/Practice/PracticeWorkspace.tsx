"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ToolWorkspaceHeader from "../Tools/ToolWorkspaceHeader";
import "../Tools/toolFrame.css";
import { checkPracticeAnswer, generateProblem, parsePracticeConfig, practiceCatalog } from "./practiceEngine";
import { Equation, EquationChoices, QuantityCard } from "./PracticeInteractions";
import "./practice.css";

const initial = practiceCatalog[0];
const format = (value: unknown) => JSON.stringify(value, null, 2);

export default function PracticeWorkspace() {
  const [settings, setSettings] = useState({ skill: initial, seed: 0 });
  const [draft, setDraft] = useState(() => format(initial));
  const [seedDraft, setSeedDraft] = useState("0");
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("skill");
    const skill = practiceCatalog.find(item => item.id === id);
    if (skill) {
      setSettings({ skill, seed: 0 });
      setDraft(format(skill));
    }
  }, []);

  function apply() {
    try {
      const skill = parsePracticeConfig(JSON.parse(draft));
      const seed = seedDraft.trim() ? Number(seedDraft) : NaN;
      generateProblem(skill, seed);
      setSettings({ skill, seed });
      setRound(value => value + 1);
      setCompleted(0);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid generation settings.");
    }
  }

  const { skill, seed } = settings;
  return <>
    <ToolWorkspaceHeader title="Practice Studio" />
    <main className="practice-workspace">
      <nav className="practice-skills" aria-label="Practice skills">
      <Link href="/practice">Browse practice skills</Link>
      <h2>{initial.category}</h2>
      {practiceCatalog.map(item => <button key={item.id} type="button" aria-current={item.id === skill.id ? "true" : undefined} onClick={() => {
        setSettings({ skill: item, seed: 0 });
        setDraft(format(item));
        setSeedDraft("0");
        setError("");
        setCompleted(0);
        setRound(value => value + 1);
        const url = new URL(window.location.href);
        url.searchParams.set("skill", item.id);
        window.history.replaceState(null, "", url);
      }}>{item.title}</button>)}
      </nav>
      <Problem key={round} skill={skill} seed={seed} completed={completed} onComplete={() => setCompleted(value => value + 1)} onNext={() => {
        const nextSeed = (seed + 1) >>> 0;
        setSettings({ skill, seed: nextSeed });
        setSeedDraft(String(nextSeed));
        setRound(value => value + 1);
      }} />
      <details>
        <summary>Generation settings</summary>
        <label>Seed <input type="number" min="0" max="4294967295" step="1" value={seedDraft} onChange={event => setSeedDraft(event.target.value)} /></label>
        <label>Skill JSON <textarea rows={12} value={draft} onChange={event => setDraft(event.target.value)} spellCheck={false} /></label>
        <button type="button" onClick={apply}>Apply settings</button>{" "}
        <a href={`data:application/json;charset=utf-8,${encodeURIComponent(format(skill))}`} download="practice-skill.json">Download active skill JSON</a>
        {error && <p role="alert">{error}</p>}
      </details>
    </main>
  </>;
}

function Problem({ skill, seed, completed, onComplete, onNext }: {
  skill: typeof initial; seed: number; completed: number; onComplete: () => void; onNext: () => void;
}) {
  const problem = generateProblem(skill, seed);
  const [operation, setOperation] = useState("");
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);

  return <><section className="practice-problem" aria-label="Practice problem">
    <div className="practice-progress"><span>{skill.category}</span><span>{completed} solved this session</span></div>
    <progress aria-label="Problem steps completed" max={2} value={step} />
    <header className="practice-prompt">
      <h2>{skill.title}</h2>
      <p>Use the given quantities to find {skill.answer.label.toLowerCase()}.</p>
      <div className="practice-givens">
        <QuantityCard {...skill.given} value={problem.given} symbol={skill.symbols.first} />
        <QuantityCard {...skill.factor} value={problem.factor} symbol={skill.symbols.second} />
      </div>
      <p className="practice-target"><span>Find</span> <span className="practice-math"><var>{skill.symbols.result}</var> = ? {skill.answer.unit}</span></p>
    </header>
    <form onSubmit={event => {
      event.preventDefault();
      if (step === 0) {
        if (operation === skill.operation) {
          setStep(1);
          setFeedback("Correct operation. Now calculate the result.");
        } else setFeedback(operation ? "Check which operation leaves you with the requested unit." : "Choose an operation first.");
      } else if (step === 1) {
        const result = checkPracticeAnswer(answer, problem.expected);
        if (result === "correct") {
          setStep(2);
          onComplete();
        }
        setFeedback(result === "correct" ? "Problem complete. Both steps are correct." : result === "invalid" ? "Enter a decimal or a number in scientific notation." : "Check the calculation and rounding, then try again.");
      }
    }}>
      {step === 0 && <EquationChoices value={operation} onChange={setOperation} symbols={skill.symbols} />}
      {step === 1 && <label>2. Calculate the result
        <small>Round to {skill.answer.decimals} decimal places.</small>
        <span className="practice-answer"><input aria-label={`Answer in ${skill.answer.unit}`} value={answer} inputMode="decimal" onChange={event => setAnswer(event.target.value)} /> {skill.answer.unit}</span>
      </label>}
      {step < 2 && <button className="practice-primary" type="submit" disabled={step === 0 ? !operation : !answer.trim()}>{step === 0 ? "Check step" : "Check answer"}</button>}
      <p role="status">{feedback}</p>
    </form>
    <div className="practice-actions">
      {step < 2 && <button type="button" aria-expanded={hint} onClick={() => setHint(!hint)}>Hint</button>}
      <button type="button" aria-expanded={solution} onClick={() => setSolution(!solution)}>Worked solution</button>
      <button type="button" onClick={onNext}>Try a similar problem</button>
    </div>
    {hint && <p>{skill.hint}</p>}
    {solution && <p>{skill.hint} {problem.given} {problem.symbol} {problem.factor} ≈ {problem.expected} {skill.answer.unit}.</p>}
  </section>
  <aside className="practice-notes" aria-label="Solution workspace">
    <h2>Your workspace</h2>
    <h3>Step history</h3>
    <ol>
      <li>{step > 0 ? <Equation operation={operation} {...skill.symbols} /> : "Choose an equation"}</li>
      <li>{step > 1 ? <span className="practice-math">{skill.symbols.result} = {answer.trim()} {skill.answer.unit}</span> : "Calculate the result"}</li>
    </ol>
    <label>Scratchpad <textarea rows={5} placeholder="Write your calculations here" /></label>
    <details><summary>Rounding reference</summary><p>Keep the full value during calculation. Round only the final answer to the requested decimal places.</p></details>
  </aside></>;
}
