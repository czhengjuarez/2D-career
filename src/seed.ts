import type { AppState, Capability, LeadershipDimension, Track } from './types';

export const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

const cap = (name: string, a: string, b: string, c: string): Capability => ({
  id: uid('cap'),
  name,
  levels: { 1: a, 2: b, 3: c },
});

/** Examples only — every track, capability and descriptor here is editable or deletable. */
export function seedTracks(): Track[] {
  return [
    {
      id: uid('trk'),
      name: 'UX Design',
      summary: 'Research, interaction and product design for end-to-end experiences.',
      capabilities: [
        cap(
          'Interaction design',
          'Designs single flows against established patterns.',
          'Designs multi-step flows and resolves edge cases without hand-holding.',
          'Designs across products; sets the interaction patterns others build on.',
        ),
        cap(
          'User research',
          'Runs sessions from a prepared script and reports findings.',
          'Chooses methods, recruits, and turns findings into product decisions.',
          'Sets the research strategy and shifts roadmap direction with evidence.',
        ),
        cap(
          'Systems thinking',
          'Works inside an existing system and follows its rules.',
          'Extends the system and spots where it breaks down.',
          'Designs the system and reasons about second-order effects.',
        ),
        cap(
          'Craft & visual quality',
          'Output is clean and on-brand with review.',
          'Output is consistently high quality with little rework.',
          'Raises the bar for the whole team; work is a reference point.',
        ),
      ],
    },
    {
      id: uid('trk'),
      name: 'Brand Design',
      summary: 'Identity, narrative and expression of the brand across surfaces.',
      capabilities: [
        cap(
          'Identity & visual language',
          'Applies an existing identity accurately.',
          'Evolves the identity and extends it to new surfaces.',
          'Defines identity systems from scratch with a defensible rationale.',
        ),
        cap(
          'Narrative & messaging',
          'Writes to an existing tone of voice.',
          'Shapes the story for a campaign or product line.',
          'Owns the brand narrative and how it holds up over years.',
        ),
        cap(
          'Typography & composition',
          'Uses the type scale correctly.',
          'Makes confident typographic choices in new contexts.',
          'Sets typographic standards others adopt.',
        ),
        cap(
          'Production & rollout',
          'Delivers assets to spec.',
          'Manages a rollout across channels and vendors.',
          'Runs org-wide rebrands end to end.',
        ),
      ],
    },
    {
      id: uid('trk'),
      name: 'UX Engineering',
      summary: 'The seam between design and code — design systems, prototypes, front-end craft.',
      capabilities: [
        cap(
          'Design systems',
          'Consumes components correctly and reports gaps.',
          'Builds and maintains components others depend on.',
          'Owns the system architecture, versioning and adoption strategy.',
        ),
        cap(
          'Front-end implementation',
          'Ships well-scoped UI work with review.',
          'Ships features independently, including state and data wiring.',
          'Sets front-end architecture and technical direction.',
        ),
        cap(
          'Prototyping',
          'Builds clickable prototypes to answer a defined question.',
          'Builds high-fidelity prototypes that de-risk real decisions.',
          'Uses prototyping to change what the organisation chooses to build.',
        ),
        cap(
          'Accessibility & performance',
          'Follows the checklist.',
          'Diagnoses and fixes issues in existing work.',
          'Sets the standards and the tooling that enforce them.',
        ),
      ],
    },
    {
      id: uid('trk'),
      name: 'Engineering',
      summary: 'Software engineering across services, data and infrastructure.',
      capabilities: [
        cap(
          'Technical delivery',
          'Completes well-defined tasks reliably.',
          'Breaks down and delivers ambiguous projects.',
          'Delivers multi-team programmes of work.',
        ),
        cap(
          'System design',
          'Works within an existing design.',
          'Designs services and their contracts.',
          'Designs platforms and makes long-lived architectural calls.',
        ),
        cap(
          'Code quality & review',
          'Writes readable, tested code.',
          'Raises the quality of others’ code through review.',
          'Defines engineering standards and practices.',
        ),
        cap(
          'Operational ownership',
          'Follows runbooks and escalates well.',
          'Owns services in production, including on-call.',
          'Owns reliability strategy across the estate.',
        ),
      ],
    },
  ];
}

export function seedLeadership(): LeadershipDimension[] {
  return [
    {
      id: uid('ld'),
      name: 'Scope of responsibility',
      levels: {
        1: 'Takes responsibility for their own contribution to outcomes.',
        2: "Takes responsibility for their own and the team's contributions.",
        3: 'Takes responsibility for organisational outcomes.',
      },
    },
    {
      id: uid('ld'),
      name: 'Decision-making',
      levels: {
        1: 'Decides within their own work; escalates the rest.',
        2: 'Makes calls for the team and carries the consequences.',
        3: 'Makes calls that bind the organisation, with incomplete information.',
      },
    },
    {
      id: uid('ld'),
      name: 'Growing others',
      levels: {
        1: 'Shares what they learn.',
        2: 'Coaches teammates and raises the level around them.',
        3: 'Builds the conditions — hiring, structure, culture — for others to grow.',
      },
    },
    {
      id: uid('ld'),
      name: 'Initiative',
      levels: {
        1: 'Picks up work that needs doing in their patch.',
        2: 'Starts things the team needs before being asked.',
        3: 'Starts things the organisation needs and sees them through.',
      },
    },
  ];
}

export function seedState(): AppState {
  const tracks = seedTracks();
  return {
    currency: '€',
    tracks,
    leadership: seedLeadership(),
    people: [],
    assessments: [],
    bands: [
      { id: uid('bnd'), label: 'Band 1', grades: ['1A'], amount: 50000 },
      { id: uid('bnd'), label: 'Band 2', grades: ['1B', '2A'], amount: 65000 },
      { id: uid('bnd'), label: 'Band 3', grades: ['1C', '2B', '3A'], amount: 90000 },
      { id: uid('bnd'), label: 'Band 4', grades: ['2C', '3B'], amount: 120000 },
      { id: uid('bnd'), label: 'Band 5', grades: ['3C'], amount: 200000 },
    ],
  };
}
