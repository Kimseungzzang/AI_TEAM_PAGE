import React from 'react';

function TerminalCard({ session, termRef }) {
  return (
    <div className="terminal-card">
      <div className="terminal-header">
        <span>{session.role}</span>
      </div>
      <div className="terminal-body" ref={termRef} />
    </div>
  );
}

export default TerminalCard;
