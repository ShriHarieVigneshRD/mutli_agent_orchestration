import { BrainCircuit, ChartColumn, Eye, Globe, Newspaper, PenLine, ShieldCheck } from 'lucide-react';

/** The seven desks of the pipeline, in routing-slip order. One source for labels, kinds and icons. */
export const AGENTS = [
  {
    id: 'planner',
    label: 'Planner',
    kind: 'supervisor',
    role: 'Breaks the question into tasks and search queries',
    icon: BrainCircuit,
  },
  {
    id: 'researcher',
    label: 'Researcher',
    kind: 'specialist',
    role: 'Searches the web',
    icon: Globe,
    parallel: true,
  },
  {
    id: 'data_analyst',
    label: 'Data analyst',
    kind: 'specialist',
    role: 'Finds figures in real sources',
    icon: ChartColumn,
    parallel: true,
  },
  {
    id: 'news_agent',
    label: 'News agent',
    kind: 'specialist',
    role: 'Finds recent news',
    icon: Newspaper,
    parallel: true,
  },
  {
    id: 'verifier',
    label: 'Verifier',
    kind: 'reviewer',
    role: 'Checks claims against the sources',
    icon: ShieldCheck,
  },
  { id: 'writer', label: 'Writer', kind: 'writer', role: 'Drafts the cited report', icon: PenLine },
  { id: 'critic', label: 'Critic', kind: 'reviewer', role: 'Approves or returns the draft', icon: Eye },
];

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export const KIND_LABELS = {
  supervisor: 'Supervisor',
  specialist: 'Specialist',
  reviewer: 'Reviewer',
  writer: 'Writer',
};

/** Agents that only run searches; they never call a model. */
export const TOOL_ONLY = new Set(['researcher', 'news_agent']);
