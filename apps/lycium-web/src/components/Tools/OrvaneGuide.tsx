"use client";

import type { RefObject } from "react";
import { CircleHelp } from "lucide-react";

export default function OrvaneGuide({ helpRef, id }: { helpRef: RefObject<HTMLDetailsElement | null>; id: string }) {
  return <details ref={helpRef} className="graph-help-menu"><summary className="graph-workspace-icon-button" aria-label="Orvane help" title="Orvane help"><CircleHelp size={19} aria-hidden="true" /></summary><div className="graph-help-popover">
    <h2>Orvane guide</h2>
    <p>Plot functions, explore their behavior, and visualize data.</p>
    <nav aria-label="Guide contents"><strong>Contents</strong><div className="graph-help-contents">
      {[["expressions", "Functions & sliders"], ["workspace", "Graph & navigation"], ["data", "Data & points"], ["analysis", "Analysis"], ["settings", "Graph settings"], ["files", "Import & export"]].map(([key, title]) => <a key={key} href={`#${id}-help-${key}`}>{title}</a>)}
    </div></nav>
    <section id={`${id}-help-expressions`}><h3>Functions & sliders</h3>
      <p>Select a function row and type an expression such as <code>x^2</code>, <code>sin(x)</code>, or <code>2*x+1</code>. You can also include <code>y=</code>. Use the keyboard icon in the selected field for mathematical symbols; angles are in radians.</p>
      <p>Use the plus row to add a function and the × to remove it. Select a row to reveal its transformation sliders. If an expression uses an undefined parameter, use the suggested button to create a slider; its controls include range, step, and animation.</p>
      <p>For a finite domain, append a restriction such as <code>x^2 {'{-2<=x<3}'}</code>. Separate restricted pieces with semicolons, for example <code>x {'{-2<=x<0}'}; x^2 {'{0<=x<=2}'}</code>. Piece domains must not overlap.</p>
    </section>
    <section id={`${id}-help-workspace`}><h3>Graph & navigation</h3>
      <p>Drag the graph to pan; scroll, pinch, or use + and − to zoom. Use Reset view to return to the default viewport. Drag the divider to resize the sidebar, or use its toggle to hide and show it. Drag a numbered color strip to reorder rows.</p>
      <p>Hover over a curve to inspect coordinates and click to pin the readout. The coordinate snap setting controls whether the hover x-value follows grid increments.</p>
    </section>
    <section id={`${id}-help-data`}><h3>Data & points</h3>
      <p>Use + to add a data table or point. Enter x and y values in the table, add or remove rows, choose whether to connect points, and select a linear or exponential fit. Fit data in view uses independent scales; Fit equal scale keeps the axes equally scaled. Use column labels for axes to copy the table labels to the graph.</p>
      <p>Edit a point’s coordinates in its row or drag it on the graph. Dragging can snap to grid positions and nearby calculated intercepts or intersections.</p>
    </section>
    <section id={`${id}-help-analysis`}><h3>Analysis</h3>
      <p>Open the calculator button. For a tangent, integral, or table of values, select a function first, enter the requested x-values, and calculate. Intersections and intercepts are searched in the current view; results can be added as points.</p>
      <p>For area between curves, select the first function in the sidebar, choose the second, enter bounds, and calculate. Drag the vertical handles to change the bounds. Area is nonnegative; the signed integral retains its sign. Numerical results are approximate and some crossings or tangencies may be missed.</p>
    </section>
    <section id={`${id}-help-settings`}><h3>Graph settings</h3>
      <p>Use the gear to show or hide the grid, set coordinate precision and snapping, or enter axis bounds. Under Titles and annotations, add a graph title, axis names and units, and positioned text annotations.</p>
    </section>
    <section id={`${id}-help-files`}><h3>Import & export</h3>
      <p>Use the top-bar import menu to open a graph JSON file. Export JSON to save a graph document, or export SVG or PNG for an image. Importing a document replaces the current graph.</p>
    </section>
  </div></details>;
}
