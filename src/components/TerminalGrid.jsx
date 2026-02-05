import React from 'react';
import TerminalCard from './TerminalCard';

function TerminalGrid({ sessions, outputs, onData, onAttach }) {
  return (
    <section className="terminal-grid">
      {sessions.map((s) => (
        <TerminalCard
          key={s.sessionId}
          session={s}
          output={outputs[s.sessionId] || ''}
          onData={onData}
          onAttach={onAttach}
        />
      ))}
    </section>
  );
}

export default TerminalGrid;
