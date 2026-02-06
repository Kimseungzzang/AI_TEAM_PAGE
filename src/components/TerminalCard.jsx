import React from 'react';

function TerminalCard({ session, output }) {

  return (
    <div className="terminal-card">
      <div className="terminal-header">
        <span>{session.role}</span>
      </div>
      <textarea className="terminal-text" value={output} readOnly />
    </div>
  );
}

export default TerminalCard;
