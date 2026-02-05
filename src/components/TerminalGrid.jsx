import React from 'react';
import TerminalCard from './TerminalCard';

function TerminalGrid({ sessions, termRefs }) {
  return (
    <section className="terminal-grid">
      {sessions.map((s) => (
        <TerminalCard
          key={s.sessionId}
          session={s}
          termRef={(el) => {
            if (el) termRefs.current[s.sessionId] = el;
          }}
        />
      ))}
    </section>
  );
}

export default TerminalGrid;
