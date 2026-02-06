import React from 'react';
import TerminalCard from './TerminalCard';

function TerminalGrid({ sessions, outputs }) {
  return (
    <section className="terminal-grid">
      {sessions.map((s) => (
        <TerminalCard
          key={s.sessionId}
          session={s}
          output={outputs[s.sessionId] || ''}
        />
      ))}
    </section>
  );
}

export default TerminalGrid;
