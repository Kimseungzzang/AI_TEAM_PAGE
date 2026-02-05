import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

function TerminalCard({ session, output, onData, onAttach }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 12,
      theme: {
        background: '#0f1115',
        foreground: '#e6e6e6',
        cursor: '#e6e6e6'
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    term.onData((data) => {
      onData(session.sessionId, data);
    });

    termRef.current = term;
    onAttach(session.sessionId, term, fitAddon);

    const refresh = () => {
      fitAddon.fit();
      term.refresh(0, term.rows - 1);
    };
    requestAnimationFrame(refresh);
    setTimeout(refresh, 200);

    const handleResize = () => {
      fitAddon.fit();
      term.refresh(0, term.rows - 1);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      term.refresh(0, term.rows - 1);
    });
    resizeObserver.observe(containerRef.current);
    observerRef.current = resizeObserver;

    return () => {
      window.removeEventListener('resize', handleResize);
      observerRef.current?.disconnect();
      term.dispose();
    };
  }, [onData, onAttach, session.sessionId]);

  return (
    <div className="terminal-card">
      <div className="terminal-header">
        <span>{session.role}</span>
      </div>
      <div className="terminal-split">
        <div className="terminal-body terminal-xterm" ref={containerRef} />
        <textarea className="terminal-body terminal-text" value={output} readOnly />
      </div>
    </div>
  );
}

export default TerminalCard;
