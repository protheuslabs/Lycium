import type { FullCourseModuleSpec } from "../fullCourseScaffold";

const c = (name: string, description: string) => ({ name, description });

export const introToAiModuleSpecs: FullCourseModuleSpec[] = [
  {
    title: "AI as a Field and Practice",
    objective: "Frame artificial intelligence as the design, evaluation, and governance of systems that perceive, reason, learn, and act under constraints.",
    studio: "Draft a one-page analysis of an everyday AI system that identifies its task, inputs, outputs, users, failure modes, and evaluation criteria.",
    topics: [
      { title: "AI systems and agents", description: "Students distinguish AI as a family of computational approaches rather than a single technique, then use the agent model to discuss perception, action, goals, and environment constraints.", concepts: [c("Artificial intelligence", "A field concerned with building systems that perform tasks associated with perception, reasoning, learning, language, planning, or action."), c("Intelligent agent", "A system that observes an environment, selects actions, and evaluates behavior against goals or performance measures.")] },
      { title: "Problem formulations", description: "Students turn messy tasks into computational problem statements with states, actions, constraints, utilities, and measurable outcomes.", concepts: [c("State space", "The set of possible situations a problem-solving system may represent while searching or reasoning."), c("Performance measure", "A criterion used to judge whether an AI system is doing the right thing for the task and stakeholders.")] },
      { title: "Data, models, and behavior", description: "Students connect data pipelines, model assumptions, and observed system behavior so that AI performance is treated as engineered behavior rather than magic.", concepts: [c("Training data", "Examples or observations used to tune a model so it can generalize to future cases."), c("Generalization", "A model's ability to perform well on new examples rather than only memorizing known examples.")] },
      { title: "AI capability and limitation", description: "Students compare useful automation with brittle overclaiming, with attention to uncertainty, distribution shift, and human oversight.", concepts: [c("Distribution shift", "A mismatch between the data a system learned from and the data it encounters after deployment."), c("Human oversight", "A design practice that keeps people able to monitor, correct, or constrain AI system behavior.")] },
    ],
  },
  {
    title: "Search and Problem Solving",
    objective: "Use search algorithms to model decision problems and reason about completeness, optimality, branching, cost, and heuristics.",
    studio: "Model a campus navigation or puzzle problem, compare two search strategies, and justify which one is appropriate under time and memory limits.",
    topics: [
      { title: "Uninformed search", description: "Students implement the logic of breadth-first, depth-first, and uniform-cost search while learning how search frontier choice changes behavior.", concepts: [c("Breadth-first search", "A search strategy that expands shallow states first and can find shortest paths when all step costs are equal."), c("Uniform-cost search", "A search strategy that expands the lowest path-cost frontier node and can find least-cost solutions with nonnegative costs.")] },
      { title: "Heuristic search", description: "Students use problem knowledge to guide search and examine why heuristic quality affects runtime and solution quality.", concepts: [c("Heuristic function", "An estimate that ranks states by likely distance, cost, or promise relative to a goal."), c("A* search", "A best-first search method that combines path cost so far with an admissible heuristic estimate to the goal.")] },
      { title: "Constraint satisfaction", description: "Students represent scheduling, assignment, and configuration problems with variables, domains, and constraints.", concepts: [c("Constraint satisfaction problem", "A problem defined by variables, possible values, and restrictions on which value combinations are allowed."), c("Backtracking", "A search procedure that incrementally assigns values and retreats when constraints are violated.")] },
      { title: "Adversarial search", description: "Students analyze game-playing systems with minimax reasoning and pruning under competitive uncertainty.", concepts: [c("Minimax", "A decision rule that chooses moves by assuming an opponent will also choose their strongest available response."), c("Alpha-beta pruning", "A technique that avoids evaluating game-tree branches that cannot change the final minimax decision.")] },
    ],
  },
  {
    title: "Knowledge Representation and Reasoning",
    objective: "Represent facts, rules, relationships, and uncertainty in forms that support automated inference and explainable reasoning.",
    studio: "Build a small rule base for an advising or troubleshooting domain, then identify what it can infer and where the representation fails.",
    topics: [
      { title: "Logic and propositions", description: "Students translate natural-language claims into symbolic statements and reason about truth-preserving inference.", concepts: [c("Propositional logic", "A formal language for representing statements that are either true or false and combining them with logical operators."), c("Inference rule", "A valid pattern for deriving new statements from existing statements.")] },
      { title: "First-order representations", description: "Students represent objects, properties, and relations with predicates so systems can reason about structured domains.", concepts: [c("Predicate", "A symbolic expression that represents a property of an object or a relationship among objects."), c("Quantifier", "A logical operator that states whether a claim applies to all objects or at least one object in a domain.")] },
      { title: "Ontologies and semantic structure", description: "Students organize domain concepts into taxonomies, entities, relations, and constraints that support retrieval and reasoning.", concepts: [c("Ontology", "A structured representation of the concepts, relationships, and constraints in a domain."), c("Semantic relation", "A typed connection that states how two represented concepts or entities are related.")] },
      { title: "Rule systems and explainability", description: "Students compare transparent rule systems with learned models and examine how reasoning traces support accountability.", concepts: [c("Rule base", "A collection of if-then statements used by a system to derive conclusions or trigger actions."), c("Explanation trace", "A record of the facts and rules used to reach a decision or recommendation.")] },
    ],
  },
  {
    title: "Probability and Uncertainty",
    objective: "Use probabilistic reasoning to make decisions when data is incomplete, noisy, or uncertain.",
    studio: "Create a Bayesian model for a diagnostic scenario and explain how new evidence changes the system's belief.",
    topics: [
      { title: "Probability as belief", description: "Students interpret probability as structured uncertainty and practice working with events, conditional probability, and independence.", concepts: [c("Conditional probability", "The probability of an event given that another event or condition is known."), c("Independence", "A relationship where learning one event occurred does not change the probability assigned to another event.")] },
      { title: "Bayesian reasoning", description: "Students use Bayes' rule to update beliefs and understand how priors and evidence interact.", concepts: [c("Bayes' rule", "A rule for updating the probability of a hypothesis after observing evidence."), c("Prior probability", "The probability assigned to a hypothesis before considering current evidence.")] },
      { title: "Graphical models", description: "Students represent conditional dependencies with directed graphs and reason about compact probabilistic structure.", concepts: [c("Bayesian network", "A graph-based model that represents random variables and conditional dependencies among them."), c("Conditional dependency", "A relationship where the probability of one variable depends on the value of another variable.")] },
      { title: "Decision under uncertainty", description: "Students compare expected value, risk, and utility when choosing actions with uncertain outcomes.", concepts: [c("Expected utility", "A weighted average of possible outcomes that combines probability with preference or value."), c("Risk sensitivity", "The degree to which a decision process accounts for downside, variance, or uncertain harm.")] },
    ],
  },
  {
    title: "Machine Learning Foundations",
    objective: "Explain the supervised learning workflow from data preparation through model selection, evaluation, and error analysis.",
    studio: "Design a supervised learning experiment for a realistic classification task and specify the target, features, split, metric, and error-analysis plan.",
    topics: [
      { title: "Supervised learning", description: "Students distinguish classification and regression and identify labels, features, training examples, and prediction targets.", concepts: [c("Feature", "A measurable input variable used by a model to make a prediction."), c("Label", "The target answer or outcome a supervised model learns to predict.")] },
      { title: "Model fitting", description: "Students connect loss functions, optimization, and parameters to the process of learning from data.", concepts: [c("Loss function", "A mathematical measure of how far a model's predictions are from desired outputs."), c("Parameter", "A value adjusted during training to improve a model's predictions.")] },
      { title: "Evaluation and validation", description: "Students use train, validation, and test splits to estimate future performance and reduce self-deception.", concepts: [c("Validation set", "Data used during model development to compare choices without training directly on final test examples."), c("Test set", "Held-out data used to estimate final model performance after development choices are fixed.")] },
      { title: "Bias, variance, and error", description: "Students diagnose underfitting, overfitting, and data problems by comparing model performance across splits and subgroups.", concepts: [c("Overfitting", "A failure mode where a model captures training details that do not generalize to new examples."), c("Error analysis", "A systematic review of incorrect predictions to identify patterns, causes, and next improvements.")] },
    ],
  },
  {
    title: "Neural Networks and Deep Learning",
    objective: "Describe how neural networks compose learned representations and identify the engineering tradeoffs involved in deep learning.",
    studio: "Sketch a neural architecture for a tabular, image, or text task and explain the representation choices, loss, data needs, and evaluation risks.",
    topics: [
      { title: "Neurons and layers", description: "Students trace how inputs become activations and how layers compose transformations into learned representations.", concepts: [c("Activation", "The output of a neuron or layer after applying a transformation and nonlinear function."), c("Representation", "A learned internal encoding of patterns useful for prediction or generation.")] },
      { title: "Training deep models", description: "Students explain gradient-based learning, backpropagation, and the role of differentiable computation.", concepts: [c("Gradient", "A direction and magnitude that indicates how changing parameters affects the loss."), c("Backpropagation", "An algorithm for efficiently computing gradients through a network of differentiable operations.")] },
      { title: "Architectures", description: "Students compare feedforward, convolutional, recurrent, and transformer architectures by the data patterns they handle.", concepts: [c("Convolution", "A local pattern-detection operation often used for grid-like data such as images."), c("Transformer", "A neural architecture that uses attention mechanisms to model relationships among tokens or elements.")] },
      { title: "Regularization and scale", description: "Students evaluate the tension between model capacity, data volume, compute cost, and generalization.", concepts: [c("Regularization", "A technique that discourages overly complex models and helps improve generalization."), c("Model capacity", "The amount and complexity of patterns a model can represent.")] },
    ],
  },
  {
    title: "Natural Language Processing and Generative AI",
    objective: "Analyze language models, embeddings, prompting, and generated outputs as probabilistic systems with product and safety constraints.",
    studio: "Design a retrieval-augmented assistant for a small document set and specify the prompt, retrieval scope, evaluation questions, and failure-handling rules.",
    topics: [
      { title: "Text representation", description: "Students compare tokens, vectors, embeddings, and language features as ways to represent text computationally.", concepts: [c("Token", "A unit of text, such as a word part or symbol, used as input to a language model."), c("Embedding", "A vector representation that places related words, documents, or concepts near one another in a learned space.")] },
      { title: "Language modeling", description: "Students explain next-token prediction, context windows, and why generated text can be fluent without being reliable.", concepts: [c("Language model", "A model that estimates likely sequences of tokens from patterns in text data."), c("Context window", "The amount of text or tokens a model can consider at one time.")] },
      { title: "Prompting and retrieval", description: "Students design prompts and retrieval contexts that constrain answers and improve traceability.", concepts: [c("Prompt", "The instruction and context supplied to a model to shape its generated output."), c("Retrieval-augmented generation", "A pattern that supplies retrieved source material to a generator so answers can be grounded in external content.")] },
      { title: "Generation risks", description: "Students identify hallucination, bias, leakage, and unsafe output as system design concerns rather than isolated model flaws.", concepts: [c("Hallucination", "A generated claim that appears plausible but is unsupported or false."), c("Content filter", "A control used to detect, block, or route generated content that violates policy or safety expectations.")] },
    ],
  },
  {
    title: "Computer Vision and Multimodal AI",
    objective: "Explain how AI systems process images, video, and multimodal data while accounting for annotation, robustness, and evaluation limits.",
    studio: "Create an evaluation plan for an image-classification or document-understanding system that includes edge cases and subgroup performance.",
    topics: [
      { title: "Image data and features", description: "Students connect pixels, channels, labels, and visual features to the way computer vision systems represent images.", concepts: [c("Pixel", "A numeric element representing intensity or color at a location in an image."), c("Visual feature", "A measurable pattern in image data, such as an edge, texture, part, or learned representation.")] },
      { title: "Vision tasks", description: "Students distinguish classification, detection, segmentation, recognition, and generation by outputs and evaluation methods.", concepts: [c("Object detection", "A task that identifies object categories and their locations in an image."), c("Segmentation", "A task that assigns labels to image regions or individual pixels.")] },
      { title: "Multimodal systems", description: "Students analyze systems that combine text, images, audio, or structured data and discuss alignment between modalities.", concepts: [c("Multimodal model", "A model that processes or relates more than one kind of input or output, such as text and images."), c("Cross-modal alignment", "A learned relationship that connects representations from different data types.")] },
      { title: "Vision robustness", description: "Students examine lighting, framing, sensor quality, annotation noise, and adversarial examples as real-world reliability issues.", concepts: [c("Annotation noise", "Errors or inconsistencies in labels or markup used to train or evaluate a model."), c("Robustness", "A system's ability to maintain acceptable behavior across realistic variation and disturbance.")] },
    ],
  },
  {
    title: "Reinforcement Learning and Sequential Decisions",
    objective: "Model sequential decision problems with states, actions, rewards, policies, and tradeoffs between exploration and exploitation.",
    studio: "Map a recommendation, game, robotics, or operations problem into a reinforcement-learning formulation and identify why it may or may not be appropriate.",
    topics: [
      { title: "Markov decision processes", description: "Students represent sequential decision tasks using states, actions, transitions, rewards, and discounting.", concepts: [c("State", "A representation of the current situation used to choose an action in a sequential decision problem."), c("Reward", "Feedback that assigns value to an outcome or transition in reinforcement learning.")] },
      { title: "Policies and value", description: "Students distinguish what an agent does from how good states or actions are expected to be.", concepts: [c("Policy", "A rule or model that selects actions from states."), c("Value function", "An estimate of expected future reward from a state or state-action pair.")] },
      { title: "Learning from interaction", description: "Students explore trial-and-error learning, exploration strategies, and the cost of gathering experience.", concepts: [c("Exploration", "Choosing actions to gather information rather than only taking the currently best-known action."), c("Exploitation", "Choosing the action currently expected to produce the best reward.")] },
      { title: "RL deployment risks", description: "Students evaluate reward misspecification, unsafe exploration, simulation gaps, and human-in-the-loop constraints.", concepts: [c("Reward hacking", "A failure mode where an agent optimizes the specified reward in a way that violates the intended goal."), c("Simulation-to-real gap", "The mismatch between behavior learned in a simulated environment and behavior in the real world.")] },
    ],
  },
  {
    title: "Data, Evaluation, and Experimentation",
    objective: "Design evaluation systems that measure model quality, user impact, reliability, fairness, and operational behavior.",
    studio: "Build a metric plan for an AI feature that separates offline model metrics, online product metrics, fairness checks, and operational monitors.",
    topics: [
      { title: "Metrics and baselines", description: "Students compare accuracy, precision, recall, calibration, utility, and simple baselines for different task types.", concepts: [c("Baseline", "A simple comparison system used to judge whether a model adds value."), c("Metric", "A quantitative measure used to evaluate a system property or outcome.")] },
      { title: "Experimental design", description: "Students structure experiments so model changes can be compared fairly and conclusions are not confounded.", concepts: [c("Control group", "A comparison group that does not receive the experimental change."), c("Confounder", "A factor that can distort the apparent relationship between a change and an outcome.")] },
      { title: "Fairness and subgroup analysis", description: "Students examine performance variation across groups and learn why aggregate metrics can hide harm.", concepts: [c("Subgroup analysis", "Evaluation that breaks results down by meaningful groups to reveal uneven behavior."), c("Fairness metric", "A measure intended to detect or compare unequal model behavior across groups.")] },
      { title: "Monitoring after launch", description: "Students identify drift, feedback loops, latency, cost, and incidents as part of AI evaluation.", concepts: [c("Model drift", "A decline or change in model behavior as data, users, or environments change over time."), c("Feedback loop", "A cycle where model outputs influence future data or user behavior, changing the system being modeled.")] },
    ],
  },
  {
    title: "Responsible AI, Ethics, and Safety",
    objective: "Apply responsible AI principles to fairness, accountability, transparency, privacy, security, and social impact.",
    studio: "Write a responsible AI review for a proposed AI feature, including stakeholders, harms, mitigations, monitoring, and go/no-go criteria.",
    topics: [
      { title: "Stakeholders and harm", description: "Students identify affected groups and distinguish technical failure from social, legal, and ethical harm.", concepts: [c("Stakeholder", "A person or group affected by a system's design, deployment, or outcomes."), c("Impact assessment", "A structured review of possible benefits, harms, risks, and mitigations before or during deployment.")] },
      { title: "Bias and fairness", description: "Students examine sources of bias in data, labels, objectives, deployment context, and institutional use.", concepts: [c("Bias", "A systematic pattern in data or decisions that can produce unfair or inaccurate outcomes."), c("Fairness tradeoff", "A situation where different fairness goals cannot all be optimized at once.")] },
      { title: "Privacy and security", description: "Students connect data minimization, consent, access control, model leakage, and adversarial threats.", concepts: [c("Data minimization", "The practice of collecting and retaining only the data necessary for a legitimate purpose."), c("Model leakage", "Exposure of sensitive training information or system behavior through model outputs or access patterns.")] },
      { title: "Governance and accountability", description: "Students design documentation, review, ownership, and monitoring structures that make AI systems governable.", concepts: [c("Model card", "Documentation that summarizes a model's intended use, data, evaluation, limitations, and ethical considerations."), c("Accountability", "The assignment of responsibility for decisions, harms, monitoring, and corrective action.")] },
    ],
  },
  {
    title: "AI Systems, Deployment, and MLOps",
    objective: "Explain how AI models become reliable products through pipelines, infrastructure, monitoring, versioning, and operational controls.",
    studio: "Design a deployment plan for a model-backed feature with data flow, model registry, rollout strategy, monitoring, and rollback criteria.",
    topics: [
      { title: "AI pipelines", description: "Students map data ingestion, cleaning, training, evaluation, packaging, deployment, and monitoring as one lifecycle.", concepts: [c("Pipeline", "An ordered workflow that transforms data, trains or evaluates models, and moves artifacts toward deployment."), c("Artifact", "A versioned output such as a dataset, model, metric report, or configuration file.")] },
      { title: "Model serving", description: "Students compare batch, online, edge, and embedded serving patterns against latency, reliability, privacy, and cost constraints.", concepts: [c("Online inference", "Generating predictions in response to live requests."), c("Batch inference", "Generating predictions for many records on a scheduled or offline basis.")] },
      { title: "Versioning and reproducibility", description: "Students explain why models, data, features, code, and parameters must be tracked together.", concepts: [c("Model registry", "A system for storing, versioning, approving, and deploying model artifacts."), c("Reproducibility", "The ability to rerun a process and obtain consistent artifacts or results under documented conditions.")] },
      { title: "Reliability operations", description: "Students plan alerts, fallback behavior, incident response, and change management for AI products.", concepts: [c("Fallback", "A safe alternate behavior used when a model or service is unavailable or unreliable."), c("Rollback", "A controlled return to a previous known-good version after a release problem.")] },
    ],
  },
  {
    title: "Human-AI Interaction and Product Design",
    objective: "Design AI experiences that communicate uncertainty, support user agency, and integrate safely into workflows.",
    studio: "Prototype the interaction contract for an AI assistant, including user intent, control points, confidence signals, and escalation paths.",
    topics: [
      { title: "User workflows", description: "Students place AI features inside real tasks and identify where automation, augmentation, and handoff are appropriate.", concepts: [c("Workflow", "A sequence of activities, decisions, tools, and handoffs used to accomplish a task."), c("Augmentation", "Using AI to support human work without fully replacing human judgment.")] },
      { title: "Uncertainty communication", description: "Students design interfaces that communicate confidence, evidence, limitations, and uncertainty without overwhelming users.", concepts: [c("Confidence signal", "A cue that communicates how certain a system is about an output or recommendation."), c("Evidence display", "Interface material that shows the sources, examples, or reasoning behind a system output.")] },
      { title: "Feedback and correction", description: "Students examine how users can correct errors, report harms, refine outputs, and improve future behavior.", concepts: [c("User feedback", "Information from users about whether a system output was useful, correct, harmful, or incomplete."), c("Correction loop", "A process that lets users fix outputs and routes those fixes into product or model improvement.")] },
      { title: "Trust calibration", description: "Students design against both blind trust and unnecessary distrust by aligning interface claims with actual system capability.", concepts: [c("Trust calibration", "Helping users rely on a system at a level appropriate to its demonstrated ability and risk."), c("Automation bias", "A tendency to over-rely on automated recommendations even when they are wrong.")] },
    ],
  },
  {
    title: "Capstone: AI System Proposal and Critique",
    objective: "Synthesize AI concepts into a complete proposal that includes task framing, modeling approach, evaluation, deployment, governance, and critique.",
    studio: "Produce and present an AI system design brief with problem statement, source assumptions, model strategy, risk review, evaluation plan, and implementation roadmap.",
    topics: [
      { title: "Problem and stakeholder brief", description: "Students define a clear AI opportunity, identify users and affected parties, and state the limits of the proposed system.", concepts: [c("Problem statement", "A concise definition of the need, context, scope, and success conditions for a project."), c("Use case", "A concrete scenario describing who uses a system, for what purpose, and under what conditions.")] },
      { title: "Technical design", description: "Students choose representations, data sources, model approaches, interfaces, and infrastructure patterns that match the problem.", concepts: [c("Design rationale", "An explanation of why a technical choice was made and what alternatives were rejected."), c("Architecture boundary", "A line that separates system responsibilities, interfaces, or ownership areas.")] },
      { title: "Evaluation and governance plan", description: "Students define model, product, safety, fairness, and operations checks required before and after launch.", concepts: [c("Evaluation plan", "A documented strategy for measuring whether a system meets quality, safety, and usefulness goals."), c("Governance checkpoint", "A required review or decision point before a system advances to a new stage.")] },
      { title: "Critique and iteration", description: "Students present tradeoffs, risks, and open questions, then revise their proposal from peer and instructor feedback.", concepts: [c("Design critique", "A structured evaluation of a proposal's strengths, weaknesses, assumptions, and tradeoffs."), c("Iteration", "A cycle of revising a design based on evidence, feedback, or changing constraints.")] },
    ],
  },
];
