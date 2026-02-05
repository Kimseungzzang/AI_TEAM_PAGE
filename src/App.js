import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // Import routing components

import { makeId } from './utils';
import { sendLineState } from './websocketHelpers';
import { apiRequest } from './apiClient';

import Sidebar from './components/Sidebar';
import TerminalGrid from './components/TerminalGrid';
import LoginPage from './components/LoginPage'; // Import LoginPage
import RegisterPage from './components/RegisterPage'; // Import RegisterPage


function AppContent() { // Renamed App to AppContent
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [userId, setUserId] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', project: '' });
  const [memberForm, setMemberForm] = useState({ name: '', role: 'LEADER', config: '' });
  const runtime = useRef(new Map());
  const termRefs = useRef({});

  const currentTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(selectedTeamId)),
    [teams, selectedTeamId]
  );
  const currentMembers = useMemo(
    () => (currentTeam && Array.isArray(currentTeam.members) ? currentTeam.members : []),
    [currentTeam]
  );
  function loadTeams(nextUserId) {
    apiRequest(`/api/teams?userId=${nextUserId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load teams');
        }
        return response.json();
      })
      .then((data) => {
        const teamList = Array.isArray(data) ? data : [];
        if (!teamList.length) {
          setTeams([]);
          setSelectedTeamId('');
          return;
        }
        const normalized = teamList.map((team) => ({
          ...team,
          members: (Array.isArray(team.members) ? team.members : []).map((member) => ({
            ...member,
            sessionId: member.id ? `m-${member.id}` : makeId(`${member.role}-${member.name}`)
          }))
        }));
        setTeams(normalized);
        setSelectedTeamId((prev) => prev || String(teamList[0].id));
      })
      .catch(() => {
        setTeams([]);
      });
  }

  useEffect(() => {
    const stored = localStorage.getItem('authUser');
    if (!stored) {
      return;
    }

    let user = null;
    try {
      user = JSON.parse(stored);
    } catch (e) {
      return;
    }

    if (!user || !user.id) {
      return;
    }

    setUserId(user.id);
    loadTeams(user.id);
  }, []);

  function connectMember(member) {
    if (!member || runtime.current.has(member.sessionId)) return;

    const ws = new WebSocket('ws://localhost:8080/ws/terminal');
    const state = {
      role: member.role,
      name: member.name,
      ws,
      buffer: '',
      term: null,
      fitAddon: null,
      initialized: false
    };
    runtime.current.set(member.sessionId, state);

    ws.onopen = () => {
      if (state.initialized) return;
      state.initialized = true;
      setTimeout(() => {
        sendLineState(state, 'claude');
      }, 3000);
    };

    ws.onmessage = (e) => handleChunk(member.sessionId, e.data);
    ws.onerror = () => {
    };
    ws.onclose = () => {
    };
  }

  function connectTeam() {
    currentMembers.forEach((member) => connectMember(member));
  }

  function openTeamModal() {
    setTeamForm({ name: '', project: '' });
    setShowTeamModal(true);
  }

  function openMemberModal() {
    setMemberForm({ name: '', role: 'LEADER', config: '' });
    setShowMemberModal(true);
  }

  function handleCreateTeam() {
    if (!userId) return;
    const payload = {
      name: teamForm.name.trim(),
      project: teamForm.project.trim() || null,
      userId
    };
    apiRequest('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create team');
        }
        return response.json();
      })
      .then(() => {
        setShowTeamModal(false);
        loadTeams(userId);
      })
      .catch(() => {
      });
  }

  function handleCreateMember() {
    if (!selectedTeamId) return;
    const payload = {
      name: memberForm.name.trim(),
      role: memberForm.role,
      config: memberForm.config.trim() || null,
      teamId: Number(selectedTeamId)
    };
    apiRequest('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create member');
        }
        return response.json();
      })
      .then(() => {
        setShowMemberModal(false);
        loadTeams(userId);
      })
      .catch(() => {
      });
  }

  useEffect(() => {
    currentMembers.forEach((member) => {
      const state = runtime.current.get(member.sessionId);
      if (!state || state.term) return;
      const host = termRefs.current[member.sessionId];
      if (!host) return;

      const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: 12,
        theme: {
          background: '#0f1115',
          foreground: '#e6e6e6',
          cursor: '#e6e6e6',
          selection: 'rgba(255,255,255,0.2)'
        }
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(host);
      term.writeln('Connecting...');
      term.onData((data) => {
        if (state.ws.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      function sendResize() {
        const cols = term.cols;
        const rows = term.rows;
        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 1 || rows <= 1) return;
        if (state.ws.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }

      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          sendResize();
        } catch (e) {
          // ignore transient zero-size errors
        }
      });
      resizeObserver.observe(host);

      state.term = term;
      state.fitAddon = fitAddon;
      state.sendResize = sendResize;
      state.resizeObserver = resizeObserver;

      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          sendResize();
        } catch (e) {
          // ignore transient zero-size errors
        }
      });
    });
  }, [currentMembers]);

  function handleChunk(sessionId, chunk) {
    const state = runtime.current.get(sessionId);
    if (!state) return;

    if (state.term) {
      state.term.write(chunk);
    }
  }

  return (
    <div className="layout">
      <Sidebar
        teams={teams}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        sessions={currentMembers}
        onConnectMember={connectMember}
        onConnectTeam={connectTeam}
        onAddTeam={openTeamModal}
        onAddMember={openMemberModal}
      />

      <main className="main">
        <TerminalGrid
          sessions={currentMembers}
          termRefs={termRefs}
        />
      </main>

      {showTeamModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">팀 추가</div>
              <button type="button" className="modal-close" onClick={() => setShowTeamModal(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">팀 이름</label>
              <input
                className="modal-input"
                value={teamForm.name}
                onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <label className="modal-label">프로젝트</label>
              <input
                className="modal-input"
                value={teamForm.project}
                onChange={(e) => setTeamForm((prev) => ({ ...prev, project: e.target.value }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-submit" onClick={handleCreateTeam}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">직원 추가</div>
              <button type="button" className="modal-close" onClick={() => setShowMemberModal(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">이름</label>
              <input
                className="modal-input"
                value={memberForm.name}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <label className="modal-label">역할</label>
              <select
                className="modal-input"
                value={memberForm.role}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="LEADER">LEADER</option>
                <option value="PLANNER">PLANNER</option>
                <option value="FRONTEND_ENGINEER">FRONTEND_ENGINEER</option>
                <option value="BACKEND_ENGINEER">BACKEND_ENGINEER</option>
                <option value="DESIGNER">DESIGNER</option>
              </select>
              <label className="modal-label">설정</label>
              <textarea
                className="modal-textarea"
                value={memberForm.config}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, config: e.target.value }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-submit" onClick={handleCreateMember}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<AppContent />} /> // Main application content
        <Route path="*" element={<Navigate to="/login" replace />} /> // Redirect to login for any unknown routes
      </Routes>
    </Router>
  );
}

export default App;
