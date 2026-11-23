import type { TraceFrame, VariableSnapshot } from "../types/trace";

interface MemoryBoxesProps {
  frame: TraceFrame | null;
}

function getActiveGridCursor(vars: Record<string, VariableSnapshot>): { row: number | null; col: number | null } {
  const rowVar = vars.row ?? vars.r ?? vars.y;
  const colVar = vars.col ?? vars.c ?? vars.x;
  return {
    row: rowVar && typeof rowVar.value === "number" ? rowVar.value : null,
    col: colVar && typeof colVar.value === "number" ? colVar.value : null,
  };
}

function isWideShape(shape: VariableSnapshot["shape"]): boolean {
  return shape === "dict" || shape === "list" || shape === "grid2d";
}

function VariableBody({
  snap,
  cursor,
}: {
  snap: VariableSnapshot;
  cursor: { row: number | null; col: number | null };
}) {
  if (snap.shape === "number" && typeof snap.value === "number") {
    const pct = snap.value >= 0 && snap.value <= 100 ? snap.value : null;
    return (
      <div>
        <div className="num-val">{snap.value}</div>
        {pct !== null && (
          <div className="gauge-track">
            <div className="gauge-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (snap.shape === "grid2d" && Array.isArray(snap.value)) {
    const rows = snap.value as (number | string | boolean)[][];
    const colsCount = rows[0]?.length ?? 1;
    return (
      <div className="voxel-grid" style={{ gridTemplateColumns: `repeat(${colsCount}, 36px)` }}>
        {rows.map((r, rIdx) =>
          r.map((cell, cIdx) => {
            const isSolid = cell === 1 || cell === true;
            const isCursor = cursor.row === rIdx && cursor.col === cIdx;
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={`voxel-cell ${isSolid ? "solid" : "empty"} ${isCursor ? "cursor" : ""}`}
                title={`[${rIdx}][${cIdx}] = ${String(cell)}`}
              >
                {String(cell)}
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (snap.shape === "list" && Array.isArray(snap.value)) {
    const items = snap.value as unknown[];
    return (
      <div className="list-strip">
        {items.length === 0 ? (
          <span className="muted-note">[ ] (empty list)</span>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="list-cell">
              <span className="list-idx">[{idx}]</span>
              <span>{JSON.stringify(item)}</span>
            </div>
          ))
        )}
      </div>
    );
  }

  if (snap.shape === "dict" && snap.value && typeof snap.value === "object") {
    const entries = Object.entries(snap.value as Record<string, unknown>);
    return (
      <table className="dict-table">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="dict-key">{k}</td>
              <td>{JSON.stringify(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <div className="scalar-repr">{snap.repr}</div>;
}

export function MemoryBoxes({ frame }: MemoryBoxesProps) {
  const entries = frame ? Object.entries(frame.variables) : [];
  const cursor = frame ? getActiveGridCursor(frame.variables) : { row: null, col: null };

  if (entries.length === 0) {
    return (
      <div className="empty-memory">
        No variables created in this scope yet. Click <strong>Next</strong> to watch data appear.
      </div>
    );
  }

  return (
    <div className="memory-grid">
      {entries.map(([name, snap]) => {
        const isCreated = frame?.changes.created.includes(name) ?? false;
        const updateInfo = frame?.changes.updated[name];
        const statusClass = isCreated ? "created" : updateInfo ? "updated" : "";
        const spanClass = isWideShape(snap.shape) ? "wide" : "scalar";

        return (
          <div key={name} className={`mem-card ${spanClass} ${statusClass}`}>
            <div className="mem-top">
              <span className="mem-name">{name}</span>
              <div className="mem-badges">
                <span className="mem-type">{snap.type}</span>
                {isCreated && <span className="badge-new">NEW</span>}
                {updateInfo && (
                  <span className="badge-upd">
                    {updateInfo.delta !== null
                      ? `${updateInfo.delta > 0 ? "+" : ""}${updateInfo.delta}`
                      : "CHANGED"}
                  </span>
                )}
              </div>
            </div>

            {updateInfo && (
              <div className="diff-line">
                {updateInfo.before} → {updateInfo.after}
              </div>
            )}

            <VariableBody snap={snap} cursor={cursor} />
          </div>
        );
      })}
    </div>
  );
}
