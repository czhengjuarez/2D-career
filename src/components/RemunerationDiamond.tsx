import type { AppState, Grade, LeadershipLevel } from '../types';
import { LETTERS, bandFor, formatMoney } from '../scoring';

/** Visual tuning — adjust these, not the layout math below, to change the shape's size. */
const NODE_SIZE = 126;
const ROW_GAP = 172;
const COL_GAP = 234;
const NODE_DIAGONAL = NODE_SIZE * Math.SQRT2;

interface DiamondNode {
  grade: Grade;
  skill: 1 | 2 | 3;
  level: LeadershipLevel;
  x: number;
  y: number;
}

/**
 * Nine grades laid out as a true diamond lattice — skill and leadership each read as a
 * diagonal, so a node's row is fixed by (level − skill). Positions and edges are derived
 * from that relationship rather than hard-coded, so the geometry stays correct if the axes
 * ever change. This is an original layout inspired by the diamond arrangement in the source
 * article, not a reproduction of its artwork — see the credit line beneath the diagram.
 */
function buildDiamond(): { nodes: DiamondNode[]; edges: [Grade, Grade][]; width: number; height: number } {
  const bySkillLevel = new Map<string, DiamondNode>();
  const rows = new Map<number, DiamondNode[]>();

  for (let skill = 1; skill <= 3; skill++) {
    for (let level = 1 as LeadershipLevel; level <= 3; level++) {
      const row = level - skill + 2; // ranges 0..4, five rows
      const grade = `${level}${LETTERS[skill - 1]}` as Grade;
      const node: DiamondNode = { grade, skill: skill as 1 | 2 | 3, level: level as LeadershipLevel, x: 0, y: 0 };
      bySkillLevel.set(`${skill}-${level}`, node);
      rows.set(row, [...(rows.get(row) ?? []), node]);
    }
  }

  const nodes: DiamondNode[] = [];
  for (const [row, rowNodes] of rows) {
    rowNodes.sort((a, b) => a.skill - b.skill);
    const offset = (rowNodes.length - 1) / 2;
    rowNodes.forEach((node, index) => {
      node.x = (index - offset) * COL_GAP;
      node.y = row * ROW_GAP;
      nodes.push(node);
    });
  }

  const edges: [Grade, Grade][] = [];
  for (let skill = 1; skill <= 3; skill++) {
    for (let level = 1; level <= 3; level++) {
      const here = bySkillLevel.get(`${skill}-${level}`)!;
      const right = bySkillLevel.get(`${skill + 1}-${level}`);
      if (right) edges.push([here.grade, right.grade]);
      const down = bySkillLevel.get(`${skill}-${level + 1}`);
      if (down) edges.push([here.grade, down.grade]);
    }
  }

  const xs = nodes.map((n) => n.x);
  const width = Math.max(...xs) - Math.min(...xs) + NODE_DIAGONAL;
  const height = 4 * ROW_GAP + NODE_DIAGONAL;
  const shiftX = width / 2;
  const shiftY = NODE_DIAGONAL / 2;
  for (const node of nodes) {
    node.x += shiftX;
    node.y += shiftY;
  }

  return { nodes, edges, width, height };
}

const DIAMOND = buildDiamond();
const byGrade = new Map(DIAMOND.nodes.map((n) => [n.grade, n]));

export function RemunerationDiamond({ state }: { state: AppState }) {
  return (
    <div className="diamond-scroll">
      <div className="diamond" style={{ width: DIAMOND.width, height: DIAMOND.height }}>
        <svg
          className="diamond__lines"
          width={DIAMOND.width}
          height={DIAMOND.height}
          viewBox={`0 0 ${DIAMOND.width} ${DIAMOND.height}`}
          aria-hidden="true"
        >
          {DIAMOND.edges.map(([from, to]) => {
            const a = byGrade.get(from)!;
            const b = byGrade.get(to)!;
            return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </svg>
        {DIAMOND.nodes.map((node) => {
          const band = bandFor(state, node.grade);
          return (
            <div
              key={node.grade}
              className="diamond__shape"
              style={{ left: node.x, top: node.y, width: NODE_SIZE, height: NODE_SIZE }}
            >
              <div className="diamond__content">
                <span className="diamond__grade">{node.grade}</span>
                <span className="diamond__pay">
                  {band ? formatMoney(band.amount, state.currency) : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
