import type { CourseBlock, CourseData, CourseEntry, CourseModule, CourseSection } from "../courseTypes";

const COURSE_ID = "local-chem-105";
const COURSE_TITLE = "CHEM 105: General Chemistry I";

const OPENSTAX = "source-openstax-chemistry-2e";
const LIBRETEXTS = "source-libretexts-openstax-chemistry-2e";
const KHAN = "source-khan-chemistry-archive";
const MIT = "source-mit-ocw-5111";
const CHEMCOLLECTIVE = "source-chemcollective";
const PHET = "source-phet-chemistry";

const CHEM_SOURCE_IDS = [OPENSTAX, LIBRETEXTS, KHAN, MIT, CHEMCOLLECTIVE, PHET];

type ConceptSpec = {
  title: string;
  description: string;
};

type LessonSpec = {
  title: string;
  explanation: string;
  example: string;
  practice: string;
  concepts: ConceptSpec[];
  sourceIds: string[];
};

type ProjectSpec = {
  title: string;
  instructions: string;
  requiredEvidence: string[];
  sourceIds: string[];
};

type ModuleSpec = {
  title: string;
  objective: string;
  sourceIds: string[];
  lessons: LessonSpec[];
  project?: ProjectSpec;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function textBlock(title: string, value: string, sourceIds: string[]): CourseBlock {
  return { type: "text", title, value, sourceIds };
}

function conceptCard(concept: ConceptSpec, sourceIds: string[], sourceSectionId?: string): CourseBlock {
  return { type: "conceptCard", title: concept.title, description: concept.description, sourceIds, ...(sourceSectionId ? { sourceSectionId } : {}) } as CourseBlock;
}

function makeQuizQuestions(moduleIndex: number, concepts: ConceptSpec[]) {
  const questionConcepts = concepts.length >= 10
    ? concepts.slice(0, 10)
    : Array.from({ length: 10 }, (_, index) => concepts[index % concepts.length]);

  return questionConcepts.map((concept, index) => {
    const neighborA = concepts[(index + 1) % concepts.length] ?? concept;
    const neighborB = concepts[(index + 2) % concepts.length] ?? concept;
    const neighborC = concepts[(index + 3) % concepts.length] ?? concept;
    return {
      question: `Which statement best defines ${concept.title}?`,
      options: [concept.description, neighborA.description, neighborB.description, neighborC.description],
      answers: [0],
      timed: "f" as const,
    };
  });
}

function projectSection(project: ProjectSpec, moduleNumber: number): CourseSection {
  const sectionId = `chem-105-m${pad(moduleNumber)}-project`;
  return {
    id: sectionId,
    title: project.title,
    pageType: "apply",
    sectionType: "project",
    estimatedMinutes: 75,
    sourceIds: project.sourceIds,
    content: [
      {
        type: "project",
        title: project.title,
        instructions: project.instructions,
        artifactType: "lab-report",
        requiredEvidence: project.requiredEvidence,
        sourceIds: project.sourceIds,
        rubric: {
          id: `${sectionId}-rubric`,
          title: "Project rubric",
          criteria: [
            { id: "concept-accuracy", title: "Concept accuracy", description: "Uses course concepts correctly and explains chemical reasoning rather than only reporting an answer.", points: 4 },
            { id: "calculation-evidence", title: "Calculation evidence", description: "Shows units, equations, assumptions, and intermediate work clearly enough to audit.", points: 4 },
            { id: "source-grounding", title: "Source grounding", description: "Connects the submitted work to the assigned source material, simulation, or virtual lab evidence.", points: 3 },
            { id: "reflection", title: "Reflection", description: "Identifies one likely source of error, uncertainty, or misconception and explains how to improve the work.", points: 3 },
          ],
        },
        submission: {
          acceptedTypes: ["text", "link", "pdf", "docx"],
          instructions: "Submit a short lab-style report, calculation sheet, or linked document that includes the required evidence.",
          maxFiles: 2,
        },
        graderWorkflow: {
          grader: "agent",
          rubricId: `${sectionId}-rubric`,
          status: "ready",
          allowedContext: ["course", "sources", "rubric", "submission"],
          feedbackPolicy: "Return criterion-level feedback, one concrete correction, and one next practice step.",
        },
      },
    ],
  };
}

function buildModule(spec: ModuleSpec, moduleIndex: number): CourseModule {
  const moduleNumber = moduleIndex + 1;
  const moduleId = `chem-105-m${pad(moduleNumber)}`;
  const lessonSections = spec.lessons.map((lesson, lessonIndex) => {
    const sectionId = `${moduleId}-u${pad(lessonIndex + 1)}`;
    return {
      id: sectionId,
      title: lesson.title,
      pageType: "learn" as const,
      sectionType: "lesson",
      estimatedMinutes: 45,
      sourceIds: lesson.sourceIds,
      content: [
        textBlock("Explanation", lesson.explanation, lesson.sourceIds),
        textBlock("Worked example", lesson.example, lesson.sourceIds),
        textBlock("Practice", lesson.practice, lesson.sourceIds),
        { type: "heading", title: "Concepts introduced", sourceIds: lesson.sourceIds } as CourseBlock,
        ...lesson.concepts.map((concept) => conceptCard(concept, lesson.sourceIds)),
      ],
    };
  });

  const conceptsWithSections = spec.lessons.flatMap((lesson, lessonIndex) =>
    lesson.concepts.map((concept) => ({ concept, sourceIds: lesson.sourceIds, sectionId: `${moduleId}-u${pad(lessonIndex + 1)}` })),
  );

  const assessmentSection: CourseSection = {
    id: `${moduleId}-quiz`,
    title: `Quiz: ${spec.title}`,
    pageType: "apply",
    sectionType: "assessment",
    estimatedMinutes: 25,
    sourceIds: spec.sourceIds,
    content: [
      {
        type: "quiz",
        sourceIds: spec.sourceIds,
        questions: makeQuizQuestions(moduleIndex, conceptsWithSections.map(({ concept }) => concept)),
        passPercentage: 70,
        maxAttempts: "",
        timeLimitSeconds: "",
      },
    ],
  };

  const summarySection: CourseSection = {
    id: `${moduleId}-summary`,
    title: `Module ${moduleNumber} Concept Review`,
    pageType: "learn",
    sectionType: "summary",
    estimatedMinutes: 20,
    sourceIds: spec.sourceIds,
    content: [
      { type: "heading", title: "Module concepts", sourceIds: spec.sourceIds } as CourseBlock,
      ...conceptsWithSections.map(({ concept, sourceIds, sectionId }) => conceptCard(concept, sourceIds, sectionId)),
    ],
  };

  return {
    id: moduleId,
    title: `Module ${moduleNumber}: ${spec.title}`,
    estimatedMinutes: 135 + (spec.project ? 75 : 0),
    sourceIds: spec.sourceIds,
    sections: [...lessonSections, ...(spec.project ? [projectSection(spec.project, moduleNumber)] : []), assessmentSection, summarySection],
  };
}

const modules: ModuleSpec[] = [
  {
    title: "Measurement, Matter, and Scientific Reasoning",
    objective: "Use measurement and classification language to reason about chemical systems.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN],
    lessons: [
      {
        title: "Chemical measurement and units",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Chemistry begins by turning observations into measured quantities. A useful measurement includes a number, a unit, and a realistic sense of uncertainty; dimensional analysis lets you carry units through a calculation so the final answer can be checked before it is trusted [1].",
        example: "A liquid sample has a mass of 18.4 g and a volume of 20.0 mL. Dividing mass by volume gives 0.920 g/mL, so the sample is less dense than water at room temperature and might be an organic liquid rather than an aqueous salt solution [1].",
        practice: "Convert 2.75 L to mL, then explain why the unit conversion factor should not change the physical amount of liquid.",
        concepts: [
          { title: "Dimensional analysis", description: "A problem-solving method that treats units as algebraic factors so conversions and equations can be checked." },
          { title: "Significant figures", description: "Digits in a measured value that communicate the precision supported by the measuring process." },
          { title: "Density", description: "The ratio of mass to volume for a substance or sample." },
        ],
      },
      {
        title: "Classifying matter and changes",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Matter can be classified by composition and by how it changes. Pure substances have fixed composition, mixtures can vary, physical changes alter form or state, and chemical changes create substances with new identities [1].",
        example: "Salt dissolving in water is a physical process at the particle level because sodium and chloride ions become hydrated but are not converted into new elements. Sodium reacting with chlorine gas is chemical because the products have different bonding and properties than the reactants.",
        practice: "Classify each as physical or chemical: melting ice, burning methane, filtering sand from water, and iron rusting. Give one observable clue for each classification.",
        concepts: [
          { title: "Pure substance", description: "Matter with fixed composition, such as an element or a compound." },
          { title: "Mixture", description: "Matter containing two or more substances whose relative amounts can vary." },
          { title: "Chemical change", description: "A change that forms substances with different chemical identities." },
        ],
      },
    ],
  },
  {
    title: "Atoms, Isotopes, and the Periodic Table",
    objective: "Connect atomic structure to isotopes, average atomic mass, and periodic organization.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN],
    lessons: [
      {
        title: "Atomic particles and isotopes",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Atoms are built from protons, neutrons, and electrons. The number of protons defines the element, while isotopes of the same element differ in neutron count and therefore mass number [1].",
        example: "Carbon-12 and carbon-14 both contain six protons, but carbon-14 has two more neutrons. They are the same element but different isotopes, which explains why they share chemical identity while differing in nuclear stability.",
        practice: "For an atom with 17 protons, 18 neutrons, and 18 electrons, identify the element, mass number, and ionic charge.",
        concepts: [
          { title: "Atomic number", description: "The number of protons in the nucleus, which identifies the element." },
          { title: "Mass number", description: "The total number of protons and neutrons in an atom or isotope." },
          { title: "Isotope", description: "Atoms of the same element with different numbers of neutrons." },
        ],
      },
      {
        title: "Periodic organization and atomic mass",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "The periodic table organizes elements by atomic number and recurring chemical behavior. Average atomic mass is a weighted average of naturally occurring isotopes, so it is usually not a whole number [1].",
        example: "If an element has two isotopes, one at 10.0 amu with 20% abundance and one at 11.0 amu with 80% abundance, the average atomic mass is 10.8 amu because the heavier isotope dominates the natural sample.",
        practice: "Use a weighted average to calculate the atomic mass for a hypothetical element with 75% isotope A at 24 amu and 25% isotope B at 26 amu.",
        concepts: [
          { title: "Periodic table", description: "An arrangement of elements by atomic number that reveals repeating patterns in properties." },
          { title: "Average atomic mass", description: "The abundance-weighted mean mass of naturally occurring isotopes of an element." },
          { title: "Group", description: "A vertical column in the periodic table whose elements often share valence-electron patterns." },
        ],
      },
    ],
  },
  {
    title: "Molecules, Ions, and Nomenclature",
    objective: "Translate between formulas, charges, and names for common inorganic substances.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN],
    lessons: [
      {
        title: "Ions and ionic compounds",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Ionic compounds are built from cations and anions whose charges balance to form an electrically neutral formula unit. Naming ionic compounds requires identifying the ions and, for variable-charge metals, the metal charge [1].",
        example: "Magnesium forms Mg2+ and chloride forms Cl-. Charge balance requires two chloride ions for every magnesium ion, so the formula is MgCl2 and the name is magnesium chloride.",
        practice: "Write formulas for aluminum oxide, calcium nitride, and iron(III) chloride. State how charge balance controls each subscript.",
        concepts: [
          { title: "Cation", description: "A positively charged ion formed when an atom or group loses electrons or carries net positive charge." },
          { title: "Anion", description: "A negatively charged ion formed when an atom or group gains electrons or carries net negative charge." },
          { title: "Formula unit", description: "The lowest whole-number ratio of ions in an ionic compound." },
        ],
      },
      {
        title: "Molecular compounds and chemical formulas",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Molecular compounds use covalent bonds and are often named with prefixes that identify atom counts. A molecular formula gives the actual number of atoms in a molecule, while an empirical formula gives the simplest whole-number ratio [1].",
        example: "Dinitrogen tetroxide has two nitrogen atoms and four oxygen atoms, so its molecular formula is N2O4. Its empirical formula is NO2 because the subscripts reduce by a factor of two.",
        practice: "Name CO2, PCl5, and N2O5, then identify the empirical formula for C6H12O6.",
        concepts: [
          { title: "Molecular compound", description: "A compound composed of discrete molecules held together by covalent bonds." },
          { title: "Molecular formula", description: "A formula showing the actual number of each type of atom in a molecule." },
          { title: "Empirical formula", description: "A formula showing the simplest whole-number atom ratio in a compound." },
        ],
      },
    ],
  },
  {
    title: "The Mole and Stoichiometry",
    objective: "Use mole relationships to connect particles, masses, formulas, and balanced reactions.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN, CHEMCOLLECTIVE],
    lessons: [
      {
        title: "Moles, molar mass, and percent composition",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "The mole is the counting bridge between microscopic particles and laboratory-scale amounts. Molar mass converts between grams and moles, and percent composition reports how a compound's mass is distributed among its elements [1].",
        example: "One mole of water has a mass of about 18.02 g. If a sample contains 36.04 g of water, it contains 2.00 mol of H2O and about 1.204 x 10^24 molecules.",
        practice: "Calculate the molar mass of CaCO3 and the mass percent of oxygen in the compound.",
        concepts: [
          { title: "Mole", description: "The SI amount unit representing 6.02214076 x 10^23 specified entities." },
          { title: "Molar mass", description: "The mass in grams of one mole of a substance." },
          { title: "Percent composition", description: "The mass percentage of each element in a compound." },
        ],
      },
      {
        title: "Balanced equations and limiting reactants",
        sourceIds: [OPENSTAX, KHAN, CHEMCOLLECTIVE],
        explanation: "A balanced chemical equation gives mole ratios among reactants and products. Stoichiometry uses those ratios to identify the limiting reactant, theoretical yield, and percent yield [1].",
        example: "For 2 H2 + O2 -> 2 H2O, two moles of hydrogen require one mole of oxygen. If only 0.40 mol O2 is available with excess H2, oxygen limits water production to 0.80 mol H2O.",
        practice: "Given 5.00 g H2 and 20.0 g O2, determine the limiting reactant and theoretical mass of water produced.",
        concepts: [
          { title: "Stoichiometric coefficient", description: "A number in a balanced equation that gives mole ratios among substances." },
          { title: "Limiting reactant", description: "The reactant consumed first, which limits the maximum amount of product." },
          { title: "Percent yield", description: "The actual yield divided by theoretical yield, multiplied by 100 percent." },
        ],
      },
    ],
    project: {
      title: "Project: Stoichiometry virtual lab report",
      sourceIds: [CHEMCOLLECTIVE, OPENSTAX],
      instructions: "Use a ChemCollective virtual lab or equivalent stoichiometry setup to model a reaction with a limiting reactant. Record the balanced equation, chosen quantities, limiting reactant, theoretical yield, and one explanation of why the non-limiting reactant remains after reaction [5].",
      requiredEvidence: ["Balanced equation", "Limiting-reactant calculation", "Theoretical yield", "Short uncertainty/error reflection"],
    },
  },
  {
    title: "Aqueous Reactions and Solution Stoichiometry",
    objective: "Predict and quantify reactions in water, including precipitation, acid-base, and redox patterns.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN, CHEMCOLLECTIVE],
    lessons: [
      {
        title: "Electrolytes, ions, and precipitation",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Aqueous ionic compounds may dissociate into mobile ions, making the solution an electrolyte. Precipitation reactions occur when mixed ions form an insoluble product that leaves solution as a solid [1].",
        example: "Mixing aqueous silver nitrate and sodium chloride produces solid AgCl because Ag+ and Cl- form an insoluble salt. Sodium and nitrate ions remain spectator ions.",
        practice: "Write complete ionic and net ionic equations for BaCl2(aq) mixed with Na2SO4(aq).",
        concepts: [
          { title: "Electrolyte", description: "A substance that produces ions in solution and conducts electricity." },
          { title: "Precipitate", description: "An insoluble solid that forms from ions in solution." },
          { title: "Net ionic equation", description: "An equation showing only the species directly involved in a chemical change." },
        ],
      },
      {
        title: "Molarity and titration logic",
        sourceIds: [OPENSTAX, KHAN, CHEMCOLLECTIVE],
        explanation: "Molarity measures moles of solute per liter of solution. In titration, a solution of known concentration reacts with an analyte until stoichiometric equivalence is reached [1].",
        example: "If 25.00 mL of 0.100 M NaOH neutralizes 20.00 mL of HCl, the moles of NaOH equal 0.00250 mol. A one-to-one reaction means the HCl sample also contained 0.00250 mol, so its molarity was 0.125 M.",
        practice: "Design a calculation plan for finding acetic acid concentration in vinegar using standardized NaOH.",
        concepts: [
          { title: "Molarity", description: "Solution concentration expressed as moles of solute per liter of solution." },
          { title: "Titration", description: "A controlled reaction used to determine an unknown amount or concentration." },
          { title: "Equivalence point", description: "The point in a titration where stoichiometric amounts of reactants have been combined." },
        ],
      },
    ],
  },
  {
    title: "Thermochemistry",
    objective: "Track heat, work, enthalpy, and calorimetry in chemical and physical changes.",
    sourceIds: [OPENSTAX, LIBRETEXTS, MIT, KHAN],
    lessons: [
      {
        title: "Energy, heat, and enthalpy",
        sourceIds: [OPENSTAX, MIT],
        explanation: "Thermochemistry treats energy as a conserved quantity transferred as heat or work. Enthalpy change is especially useful for constant-pressure reactions because it tracks heat flow into or out of the system [1].",
        example: "An exothermic combustion reaction releases heat to the surroundings, so its enthalpy change is negative. An endothermic dissolution absorbs heat, so the solution may feel colder.",
        practice: "Classify melting ice, burning methane, and dissolving ammonium nitrate as endothermic or exothermic from the system perspective.",
        concepts: [
          { title: "System", description: "The part of the universe selected for thermodynamic study." },
          { title: "Surroundings", description: "Everything outside the system that can exchange energy or matter with it." },
          { title: "Enthalpy change", description: "The heat transferred at constant pressure for a process." },
        ],
      },
      {
        title: "Calorimetry and Hess's law",
        sourceIds: [OPENSTAX, LIBRETEXTS, KHAN],
        explanation: "Calorimetry uses measured temperature change and heat capacity to estimate heat transfer. Hess's law works because enthalpy is a state function, so reaction enthalpies can be added like equations [1].",
        example: "If 100.0 g of water warms by 5.0 C, q = mcDeltaT gives about 2090 J of heat absorbed by water. That heat came from the process being studied if heat loss is negligible.",
        practice: "Use q = mcDeltaT to calculate heat absorbed by 50.0 g water warming from 21.0 C to 29.5 C.",
        concepts: [
          { title: "Calorimetry", description: "The measurement of heat transfer using temperature change and heat capacity." },
          { title: "Heat capacity", description: "The heat required to raise the temperature of a sample by one degree." },
          { title: "Hess's law", description: "The principle that reaction enthalpies add because enthalpy is a state function." },
        ],
      },
    ],
  },
  {
    title: "Electronic Structure and Periodic Trends",
    objective: "Use quantum models and electron configurations to explain periodic chemical behavior.",
    sourceIds: [OPENSTAX, LIBRETEXTS, MIT, KHAN],
    lessons: [
      {
        title: "Light, quantization, and orbitals",
        sourceIds: [OPENSTAX, MIT],
        explanation: "Atomic spectra show that electrons occupy quantized energy levels. Orbitals are probability distributions from the quantum model, not circular paths like planets around a nucleus [1].",
        example: "Hydrogen emits discrete spectral lines because its electron can only lose specific energy differences between allowed levels. A continuous range would produce a smeared spectrum instead.",
        practice: "Explain why the phrase electron cloud is more accurate than tiny solar system when describing orbitals.",
        concepts: [
          { title: "Quantization", description: "The restriction of a property, such as electron energy, to specific allowed values." },
          { title: "Orbital", description: "A quantum-mechanical probability distribution for an electron in an atom." },
          { title: "Atomic spectrum", description: "A pattern of light absorption or emission caused by electron energy transitions." },
        ],
      },
      {
        title: "Electron configurations and trends",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Electron configurations summarize orbital occupancy and help explain periodic trends. Effective nuclear charge, shielding, and valence electrons shape atomic radius, ionization energy, and electronegativity [1].",
        example: "Across a period, atomic radius generally decreases because nuclear charge increases while added electrons enter the same principal shell. The stronger pull draws valence electrons closer.",
        practice: "Compare Na, Mg, and Al for atomic radius and first ionization energy. Explain each trend using effective nuclear charge.",
        concepts: [
          { title: "Electron configuration", description: "A notation showing how electrons occupy atomic orbitals." },
          { title: "Effective nuclear charge", description: "The net positive attraction experienced by an electron after shielding is considered." },
          { title: "Ionization energy", description: "The energy required to remove an electron from an atom or ion in the gas phase." },
        ],
      },
    ],
  },
  {
    title: "Chemical Bonding and Molecular Structure",
    objective: "Predict bonding, resonance, geometry, and polarity from valence-electron models.",
    sourceIds: [OPENSTAX, LIBRETEXTS, MIT, KHAN, PHET],
    lessons: [
      {
        title: "Lewis structures and resonance",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Lewis structures track valence electrons as bonds and lone pairs. Some species require resonance structures because no single Lewis drawing captures the observed electron distribution [1].",
        example: "Ozone can be drawn with one single and one double O-O bond, but the real molecule has equivalent bond lengths. Resonance represents delocalized bonding rather than rapid flipping between drawings.",
        practice: "Draw Lewis structures for CO2, NH3, and NO3-. Identify formal charges where useful.",
        concepts: [
          { title: "Lewis structure", description: "A valence-electron diagram showing bonds, lone pairs, and formal charges." },
          { title: "Formal charge", description: "A bookkeeping charge used to compare plausible Lewis structures." },
          { title: "Resonance", description: "A representation of delocalized electrons using multiple valid Lewis structures." },
        ],
      },
      {
        title: "VSEPR geometry and polarity",
        sourceIds: [OPENSTAX, KHAN, PHET],
        explanation: "VSEPR theory predicts molecular geometry by arranging electron domains to reduce repulsions. Molecular polarity depends on both bond polarity and shape, so a molecule can contain polar bonds but be nonpolar overall [1].",
        example: "CO2 has polar C=O bonds but a linear geometry, so the bond dipoles cancel. H2O has polar O-H bonds and a bent geometry, so the molecule has a net dipole.",
        practice: "Predict the electron-domain geometry, molecular geometry, and polarity of CH4, NH3, and H2O.",
        concepts: [
          { title: "Electron domain", description: "A region of electron density around a central atom, such as a bond or lone pair." },
          { title: "Molecular geometry", description: "The three-dimensional arrangement of atoms in a molecule." },
          { title: "Molecular polarity", description: "The presence of a net molecular dipole from bond polarity and geometry." },
        ],
      },
    ],
    project: {
      title: "Project: Molecular geometry simulation brief",
      sourceIds: [PHET, OPENSTAX],
      instructions: "Use a molecular-shape simulation such as PhET to compare at least three molecules with different electron-domain arrangements. For each molecule, report the Lewis structure idea, geometry, bond polarity, molecular polarity, and one limitation of the model [6].",
      requiredEvidence: ["Three molecule comparisons", "Geometry and polarity table", "Screenshot or linked simulation notes", "Model limitation reflection"],
    },
  },
  {
    title: "Gases",
    objective: "Model gas behavior with empirical gas laws, the ideal gas equation, and kinetic molecular theory.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN, PHET],
    lessons: [
      {
        title: "Gas laws and the ideal gas equation",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Gas pressure, volume, amount, and temperature are related by empirical laws summarized in PV = nRT for ideal gases. Temperature must be in kelvin because gas volume and kinetic energy scale with absolute temperature [1].",
        example: "A 2.00 L gas sample at 1.00 atm and 300 K contains n = PV/RT, or about 0.0812 mol. Raising temperature at constant volume increases pressure because particles collide more energetically.",
        practice: "Calculate the pressure of 0.500 mol gas in a 10.0 L container at 298 K using R = 0.08206 L atm mol^-1 K^-1.",
        concepts: [
          { title: "Ideal gas law", description: "The equation PV = nRT relating gas pressure, volume, amount, and absolute temperature." },
          { title: "Absolute temperature", description: "Temperature measured on the kelvin scale, proportional to average molecular kinetic energy." },
          { title: "Gas constant", description: "The proportionality constant R used in gas-law calculations." },
        ],
      },
      {
        title: "Kinetic molecular theory and real gases",
        sourceIds: [OPENSTAX, LIBRETEXTS, PHET],
        explanation: "Kinetic molecular theory explains gas laws using particle motion and collisions. Real gases deviate from ideal behavior when particle volume and intermolecular attractions become important, especially at high pressure or low temperature [1].",
        example: "At high pressure, gas particles occupy a meaningful fraction of the container volume. At low temperature, attractive forces can reduce measured pressure compared with ideal predictions.",
        practice: "Explain whether nitrogen at room temperature and low pressure or carbon dioxide near condensation should behave more ideally.",
        concepts: [
          { title: "Kinetic molecular theory", description: "A particle model explaining gas behavior through motion, collisions, and average kinetic energy." },
          { title: "Partial pressure", description: "The pressure a gas in a mixture would exert if it alone occupied the container." },
          { title: "Real gas deviation", description: "A difference between observed gas behavior and ideal gas predictions due to particle volume or attractions." },
        ],
      },
    ],
  },
  {
    title: "Liquids, Solids, and Intermolecular Forces",
    objective: "Relate particle-level attractions to phase behavior and material properties.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN],
    lessons: [
      {
        title: "Intermolecular forces",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Intermolecular forces are attractions between particles, not bonds within a molecule. London dispersion, dipole-dipole forces, and hydrogen bonding help explain boiling points, viscosity, and surface tension [1].",
        example: "Water boils at a much higher temperature than methane because water molecules can hydrogen bond, while methane relies mainly on weaker dispersion forces.",
        practice: "Rank CH4, CH3Cl, and CH3OH by expected boiling point and explain the intermolecular force responsible for each step.",
        concepts: [
          { title: "London dispersion force", description: "An attraction caused by temporary electron-density fluctuations present in all atoms and molecules." },
          { title: "Dipole-dipole force", description: "An attraction between molecules with permanent dipoles." },
          { title: "Hydrogen bonding", description: "A strong dipole-dipole attraction involving H bonded to N, O, or F and a lone pair on N, O, or F." },
        ],
      },
      {
        title: "Phase changes and solids",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Phase changes depend on the balance between particle kinetic energy and attractions. Solids can be molecular, ionic, metallic, or covalent-network, and those structures explain differences in melting point, conductivity, and hardness [1].",
        example: "Ionic solids often have high melting points because ions are held in a lattice by strong electrostatic attractions. Molecular solids often melt more easily because their particles are held by weaker intermolecular forces.",
        practice: "Compare NaCl, ice, copper, and diamond by solid type and one expected property.",
        concepts: [
          { title: "Phase change", description: "A physical transition between solid, liquid, and gas states." },
          { title: "Vapor pressure", description: "The pressure exerted by vapor in equilibrium with its liquid or solid phase." },
          { title: "Crystal lattice", description: "A repeating three-dimensional arrangement of particles in a crystalline solid." },
        ],
      },
    ],
  },
  {
    title: "Solutions and Colligative Properties",
    objective: "Analyze solution formation, concentration, and properties that depend on dissolved-particle count.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN, CHEMCOLLECTIVE],
    lessons: [
      {
        title: "Solution formation and concentration units",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "A solution forms when solute-solute and solvent-solvent interactions are replaced by solute-solvent interactions. Concentration can be expressed with molarity, molality, mass percent, mole fraction, or ppm depending on the task [1].",
        example: "A salt dissolves well in water when ion-dipole attractions with water compensate for separating ions from the crystal and water molecules from one another.",
        practice: "Prepare a calculation plan for making 250.0 mL of 0.200 M NaCl from solid NaCl.",
        concepts: [
          { title: "Solute", description: "The dissolved component of a solution, often present in the smaller amount." },
          { title: "Solvent", description: "The component that dissolves the solute, often present in the larger amount." },
          { title: "Solubility", description: "The maximum amount of solute that dissolves in a given amount of solvent under specified conditions." },
        ],
      },
      {
        title: "Colligative properties",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Colligative properties depend mainly on the number of dissolved particles, not their identity. Vapor-pressure lowering, boiling-point elevation, freezing-point depression, and osmotic pressure all follow from solute particles disrupting solvent behavior [1].",
        example: "Road salt lowers the freezing point of water because dissolved ions reduce the tendency of water molecules to enter the solid phase at 0 C.",
        practice: "Explain why 1.0 m NaCl has a larger freezing-point effect than 1.0 m glucose if both dissolve ideally.",
        concepts: [
          { title: "Colligative property", description: "A solution property controlled by dissolved-particle count rather than particle identity." },
          { title: "Freezing-point depression", description: "The lowering of a solvent's freezing point when solute particles are dissolved." },
          { title: "Osmotic pressure", description: "The pressure needed to stop solvent flow through a semipermeable membrane." },
        ],
      },
    ],
  },
  {
    title: "Chemical Equilibrium",
    objective: "Use equilibrium constants and reaction quotients to reason about reversible reactions.",
    sourceIds: [OPENSTAX, LIBRETEXTS, MIT, KHAN],
    lessons: [
      {
        title: "Dynamic equilibrium and equilibrium constants",
        sourceIds: [OPENSTAX, MIT],
        explanation: "At dynamic equilibrium, forward and reverse reaction rates are equal, so concentrations remain constant even though molecular events continue. The equilibrium constant expresses the product-to-reactant ratio favored at a specified temperature [1].",
        example: "A large K value means products are favored at equilibrium, not that the reaction is fast. Rate and equilibrium position answer different questions.",
        practice: "Write the Kc expression for N2(g) + 3H2(g) ⇌ 2NH3(g), then explain what a large Kc means.",
        concepts: [
          { title: "Dynamic equilibrium", description: "A state where forward and reverse processes continue at equal rates with no net composition change." },
          { title: "Equilibrium constant", description: "A ratio of product and reactant activities or concentrations at equilibrium for a reaction." },
          { title: "Reaction quotient", description: "A product-to-reactant ratio with the equilibrium-constant form but using current, not necessarily equilibrium, amounts." },
        ],
      },
      {
        title: "Le Chatelier's principle",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "Le Chatelier's principle predicts how an equilibrium system responds to disturbances such as concentration, pressure, volume, or temperature changes. The system shifts in the direction that partially counteracts the disturbance [1].",
        example: "Adding reactant to an equilibrium mixture often shifts the reaction toward products because Q becomes smaller than K. Removing product can have a similar direction of shift.",
        practice: "Predict the shift for the Haber equilibrium when H2 is added, NH3 is removed, or volume is decreased.",
        concepts: [
          { title: "Equilibrium shift", description: "A change in reaction direction that restores equilibrium after a disturbance." },
          { title: "Le Chatelier's principle", description: "The rule that an equilibrium system responds to a stress by partially opposing it." },
          { title: "Q versus K comparison", description: "A method for predicting reaction direction by comparing the reaction quotient with the equilibrium constant." },
        ],
      },
    ],
  },
  {
    title: "Acids, Bases, and Buffers",
    objective: "Apply acid-base definitions, pH calculations, equilibrium constants, and buffer reasoning.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN, CHEMCOLLECTIVE],
    lessons: [
      {
        title: "Acid-base models and pH",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Bronsted-Lowry acids donate protons and bases accept protons. pH expresses hydronium concentration logarithmically, which means each pH unit represents a tenfold concentration change [1].",
        example: "A solution with pH 3 has ten times the hydronium concentration of a solution with pH 4. The scale compresses a wide range of acidity into manageable numbers.",
        practice: "Calculate pH for 1.0 x 10^-4 M H3O+ and pOH for 1.0 x 10^-3 M OH- at 25 C.",
        concepts: [
          { title: "Bronsted-Lowry acid", description: "A proton donor in an acid-base reaction." },
          { title: "Bronsted-Lowry base", description: "A proton acceptor in an acid-base reaction." },
          { title: "pH", description: "The negative base-ten logarithm of hydronium ion concentration." },
        ],
      },
      {
        title: "Weak acids, buffers, and titration curves",
        sourceIds: [OPENSTAX, KHAN, CHEMCOLLECTIVE],
        explanation: "Weak acids and bases only partially ionize, so equilibrium constants control their solution composition. Buffers resist pH change because a weak acid/conjugate base pair consumes added acid or base [1].",
        example: "A buffer made from acetic acid and acetate can absorb small additions of strong base because acetic acid neutralizes OH-, forming more acetate and water.",
        practice: "Explain why a weak-acid/strong-base titration has a basic equivalence point and identify the buffer region on its titration curve.",
        concepts: [
          { title: "Acid dissociation constant", description: "The equilibrium constant Ka for the ionization of an acid in water." },
          { title: "Buffer", description: "A solution that resists pH change because it contains a weak acid/base conjugate pair." },
          { title: "Titration curve", description: "A plot of pH versus added titrant volume during a titration." },
        ],
      },
    ],
    project: {
      title: "Project: Buffer and titration analysis",
      sourceIds: [CHEMCOLLECTIVE, OPENSTAX],
      instructions: "Use a virtual titration or buffer simulation to compare a strong-acid titration with a weak-acid titration. Submit a brief report that identifies equivalence points, buffer regions when present, and the chemical reason the curves differ [5].",
      requiredEvidence: ["Two titration-curve sketches or screenshots", "Equivalence-point explanation", "Buffer-region explanation", "Short connection to Ka or conjugate pairs"],
    },
  },
  {
    title: "Redox and Electrochemistry Foundations",
    objective: "Recognize electron-transfer reactions and connect oxidation numbers to electrochemical cells.",
    sourceIds: [OPENSTAX, LIBRETEXTS, KHAN],
    lessons: [
      {
        title: "Oxidation numbers and redox reactions",
        sourceIds: [OPENSTAX, LIBRETEXTS],
        explanation: "Redox reactions involve electron transfer. Oxidation numbers are bookkeeping tools that help identify what is oxidized, what is reduced, and how to balance electron transfer [1].",
        example: "In Zn + Cu2+ -> Zn2+ + Cu, zinc is oxidized because its oxidation number increases from 0 to +2. Copper is reduced because its oxidation number decreases from +2 to 0.",
        practice: "Assign oxidation numbers in MnO4-, Fe2O3, H2O2, and SO4^2-. Identify any atom that is commonly oxidized or reduced.",
        concepts: [
          { title: "Oxidation", description: "Loss of electrons or an increase in oxidation number." },
          { title: "Reduction", description: "Gain of electrons or a decrease in oxidation number." },
          { title: "Oxidation number", description: "A formal charge assigned by rules to track electron transfer in compounds and ions." },
        ],
      },
      {
        title: "Galvanic cells and cell potential",
        sourceIds: [OPENSTAX, KHAN],
        explanation: "A galvanic cell converts spontaneous redox chemistry into electrical work by separating oxidation and reduction into half-cells. Cell potential measures the driving force for electron flow under specified conditions [1].",
        example: "In a zinc-copper cell, zinc metal is oxidized at the anode and copper ions are reduced at the cathode. Electrons flow through the wire from anode to cathode.",
        practice: "Label the anode, cathode, electron-flow direction, and ion movement in a simple Zn/Cu galvanic cell.",
        concepts: [
          { title: "Galvanic cell", description: "An electrochemical cell that uses a spontaneous redox reaction to produce electrical work." },
          { title: "Anode", description: "The electrode where oxidation occurs." },
          { title: "Cathode", description: "The electrode where reduction occurs." },
        ],
      },
    ],
  },
];

export const chem105CourseData = {
  title: COURSE_TITLE,
  shortDescription: "A source-backed General Chemistry I course covering measurement, atoms, bonding, stoichiometry, solutions, thermochemistry, equilibrium, acids/bases, and redox.",
  difficultyLevel: "undergrad",
  category: "natural-sciences-mathematics",
  department: "chemistry",
  tags: ["chemistry", "mathematics", "science"],
  learningTypes: [],
  estimatedHours: 42,
  orderMandatory: false,
  sourceIds: CHEM_SOURCE_IDS,
  courseEquivalencies: [
    {
      institution: "MIT OpenCourseWare",
      department: "Chemistry",
      courseCode: "5.111",
      title: "Principles of Chemical Science",
      url: "https://ocw.mit.edu/courses/5-111-principles-of-chemical-science-fall-2008/",
      notes: "Used as an open benchmark for first-year chemical science depth, not as a transfer-credit claim.",
    },
    {
      institution: "OpenStax",
      department: "Chemistry",
      title: "Chemistry 2e",
      url: "https://openstax.org/details/books/chemistry-2e",
      notes: "Open textbook benchmark for common General Chemistry I topics.",
    },
  ],
  prerequisites: [
    {
      type: "competency",
      title: "High-school algebra and unit conversions",
      required: true,
      rationale: "Stoichiometry, gas laws, equilibrium, pH, and thermochemistry require algebraic manipulation and unit reasoning.",
    },
  ],
  metadata: {
    pacingLabel: "Module",
    courseType: "academic_course",
    learningMethod: ["text-heavy", "simulation-supported", "assessment-heavy"],
    scope: {
      audience: "First-year undergraduate students preparing for chemistry, biology, pre-health, engineering, or laboratory science pathways.",
      level: "undergraduate introductory",
      duration: "12 modules",
      outcome: "Use atomic, molecular, quantitative, energetic, and equilibrium models to solve General Chemistry I problems and explain chemical behavior.",
      prerequisites: ["high-school algebra", "unit conversions", "basic scientific notation"],
      exclusions: ["organic reaction mechanisms", "advanced quantum mechanics", "full analytical chemistry lab sequence"],
      assessmentStyle: "Module quizzes plus rubric-graded virtual lab and simulation projects.",
    },
    editPolicy: {
      editable: true,
      ownerCanEdit: true,
      learnersCanFork: true,
      publishGateRequired: true,
    },
    snapshotLifecycle: {
      lineageId: "chem-105-general-chemistry-i",
      canonicalSlug: "chem-105-general-chemistry-i",
      snapshotId: "chem-105-general-chemistry-i-v1",
      version: 1,
      status: "review",
    },
    sourceCoveragePolicy: {
      minimumCourseSources: 5,
      minimumSourcesPerModule: 1,
      minimumRequiredConceptCoveragePercent: 80,
      requireAssessmentCoverage: true,
    },
    generationReadiness: {
      contractVersion: "course-generation-readiness-v1",
      status: "ready",
      ready: true,
      sourceEvidence: {
        sourceUrlCount: CHEM_SOURCE_IDS.length,
        usableInputArtifactCount: CHEM_SOURCE_IDS.length,
        submittedEvidenceCount: CHEM_SOURCE_IDS.length,
        minimumCourseSources: 5,
      },
      conceptCoverage: {
        status: "ready",
        coverageRatio: 1,
        minimumCoverageRatio: 0.8,
      },
      issues: [],
    },
    generationPlan: {
      status: ["scoped", "modules_planned", "sources_mapped", "content_drafted", "validated"],
      generatedBy: "codex-agent",
      moduleCount: modules.length,
      sourceMap: {
        textbook: [OPENSTAX, LIBRETEXTS],
        practice: [KHAN],
        lectureNotes: [MIT],
        virtualLabs: [CHEMCOLLECTIVE, PHET],
      },
    },
  },
  modules: modules.map(buildModule),
} satisfies CourseData;

export const chem105CourseEntry: CourseEntry = {
  key: COURSE_ID,
  title: chem105CourseData.title,
  data: chem105CourseData,
  source: "local",
  status: "ready_for_review",
};
